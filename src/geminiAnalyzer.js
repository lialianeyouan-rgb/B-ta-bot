
const { GoogleGenAI, Type } = require('@google/genai');
const { VectorStore } = require('./memory/vectorStore');
const appConfig = require('./config');

if (!appConfig.geminiApiKey || appConfig.geminiApiKey.includes('VOTRE_CLE_API_GEMINI')) {
    throw new Error("GEMINI_API_KEY for Gemini API is not defined in src/config.js");
}

const ai = new GoogleGenAI({ apiKey: appConfig.geminiApiKey });

const flashLoanAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        pSuccess: { type: Type.NUMBER, description: "The estimated probability of the atomic transaction succeeding (0.0 to 1.0)." },
        loanAmount: { type: Type.NUMBER, description: "The suggested loan amount in ETH to borrow for the flash loan." },
        rationale: { type: Type.STRING, description: "A brief explanation of the decision, considering flash loan risks." },
        useFlashbots: { type: Type.BOOLEAN, description: "True if Flashbots execution is recommended to prevent front-running." }
    },
    required: ["pSuccess", "loanAmount", "rationale", "useFlashbots"]
};


/**
 * Analyzes a trade opportunity using Gemini for a strategic assessment.
 * @param {object} opportunity The opportunity details.
 * @param {object} marketContext Current market conditions (gas, volatility, sentiment, flash loan config).
 * @param {VectorStore} vectorStore The long-term memory of past trades.
 * @returns {Promise<object>} A promise that resolves to the opportunity augmented with Gemini's analysis.
 */
async function analyzeOpportunity(opportunity, marketContext, vectorStore) {
    const model = "gemini-2.5-flash";
    const similarTrades = vectorStore.findSimilar(opportunity);
    const memoryContext = similarTrades.length > 0
        ? `
        Historical Memory (Similar Past Trades):
        ${similarTrades.map(t => `- ${t.status.toUpperCase()}: PnL ${t.profit.toFixed(4)} ETH. Reason: ${t.postMortem || 'N/A'}`).join('\n')}
        `
        : "No similar trades in memory.";
    opportunity.similarPastTrades = memoryContext;

    const tokenSentiment = marketContext.sentiment?.tokens?.[opportunity.token.symbol] || 'neutral';
    
    let prompt;

    if (opportunity.strategy === 'flashloan-triangular') {
        prompt = `
        Analyze this complex FLASH LOAN TRIANGULAR arbitrage opportunity on ${opportunity.token.chain}.
        This is an atomic transaction: borrow -> swap A->B -> swap B->C -> swap C->A' -> repay. All must succeed.

        Flash Loan Provider: ${marketContext.flashLoan.provider}
        Flash Loan Fee: ${marketContext.flashLoan.fee * 100}%

        Market Context:
        - Gas Price: ${marketContext.gasPriceGwei} Gwei
        - Network Volatility: ${marketContext.volatility}
        - Overall Market Sentiment: ${marketContext.sentiment?.overall || 'neutral'}
        - Token Route Sentiment (${opportunity.token.symbol}): ${tokenSentiment}

        Opportunity Details:
        - Strategy: ${opportunity.strategy}
        - Token Route: ${opportunity.token.symbol}
        - DEX: ${opportunity.token.dexs[0]}
        - Gross Spread: ${(opportunity.spread * 100).toFixed(4)}%
        - Net Spread (after loan fee): ${((opportunity.spread - marketContext.flashLoan.fee) * 100).toFixed(4)}%
        - Pool Liquidity: ${opportunity.liquidity}

        ${memoryContext}

        Task: Provide a strategic assessment for a TRIANGULAR flash loan.
        1.  pSuccess: Probability of success. This is lower than pairwise due to 3 swaps (3x slippage risk). High volatility is extremely risky here. Low liquidity greatly increases slippage risk.
        2.  loanAmount: Optimal loan amount in ETH to borrow. Must be conservative due to multi-leg slippage. A small loan is safer if liquidity is low.
        3.  rationale: Explain the decision, highlighting the heightened risk of triangular routes and considering the available liquidity.
        4.  useFlashbots: Mandatory recommendation. Triangular arbitrage is impossible without MEV protection.
        `;
    } else if (opportunity.strategy === 'flashloan-pairwise-interdex') {
        prompt = `
        Analyze this FLASH LOAN PAIRWISE INTER-DEX arbitrage opportunity on ${opportunity.token.chain}.
        This involves an atomic transaction: borrow -> buy on DEX A -> sell on DEX B -> repay.

        Flash Loan Provider: ${marketContext.flashLoan.provider}
        Flash Loan Fee: ${marketContext.flashLoan.fee * 100}%
        
        Market Context:
        - Gas Price: ${marketContext.gasPriceGwei} Gwei
        - Network Volatility: ${marketContext.volatility}
        - Overall Market Sentiment: ${marketContext.sentiment?.overall || 'neutral'}
        - Token Sentiment (${opportunity.token.symbol}): ${tokenSentiment}

        Opportunity Details:
        - Strategy: ${opportunity.strategy}
        - Token Pair: ${opportunity.token.symbol}
        - Arbitrage Route: ${opportunity.token.dexs[0]} -> ${opportunity.token.dexs[1]}
        - Gross Spread: ${(opportunity.spread * 100).toFixed(4)}%
        - Net Spread (after loan fee): ${((opportunity.spread - marketContext.flashLoan.fee) * 100).toFixed(4)}%
        - Pool Liquidity: ${opportunity.liquidity}

        ${memoryContext}

        Task: Provide a strategic assessment for an INTER-DEX flash loan.
        1.  pSuccess: Probability of success. Must account for gas cost of swapping on TWO different DEXs and network latency. Check if liquidity is sufficient on both ends.
        2.  loanAmount: Optimal loan amount in ETH. Consider the liquidity on the thinner of the two DEXs to avoid massive slippage on the sell-side.
        3.  rationale: Explain if the spread is large enough to cover the higher gas fees of a multi-DEX transaction and if liquidity supports the loan.
        4.  useFlashbots: Mandatory recommendation to prevent front-running.
        `;
    } else {
        // Fallback for unknown strategies
        return { ...opportunity, pSuccess: 0, loanAmount: 0, rationale: "Unknown strategy type.", useFlashbots: false };
    }


    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: flashLoanAnalysisSchema, temperature: 0.5 }
        });
        
        const analysis = JSON.parse(response.text);
        return { ...opportunity, ...analysis };

    } catch (error) {
        console.error("Error calling Gemini API for opportunity analysis:", error);
        return { ...opportunity, pSuccess: 0, loanAmount: 0, rationale: "AI analysis failed.", useFlashbots: false };
    }
}

/**
 * Analyzes the result of an executed trade to provide insights.
 * @param {object} trade The executed trade object.
 * @returns {Promise<string>} A promise that resolves to a string with the analysis.
 */
async function analyzeTradeResult(trade) {
    const model = "gemini-2.5-flash";
    const prompt = `
        A crypto arbitrage trade was executed. Provide a brief post-mortem analysis.

        Trade Details:
        - Strategy: ${trade.strategy}
        - Token Pair: ${trade.opportunity.token.symbol}
        - Predicted P(Success): ${(trade.opportunity.pSuccess * 100).toFixed(2)}%
        - Execution: ${trade.opportunity.useFlashbots ? 'Flashbots (MEV Protected)' : 'Standard'}
        - Status: ${trade.status}
        - Actual PnL: ${trade.profit.toFixed(5)} ETH
        - On-Chain Tx: ${trade.txHash}

        Task: Explain the likely reason for the outcome and provide a one-sentence learning.
        - If SUCCESS: What contributed? (e.g., accurate prediction, low congestion, effective MEV protection).
        - If FAILED: What was the likely cause? (e.g. reverted due to slippage, front-run by MEV, high gas fees).
    `;
    
    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for post-trade analysis:", error);
        return "Post-trade analysis by AI failed.";
    }
}

/**
 * Asks Gemini to suggest strategic changes to the bot's configuration.
 * @param {Array} tradeHistory The recent trade history.
 * @param {object} currentConfig The current bot config.
 * @returns {Promise<string>} A promise that resolves to a string with the suggested advice.
 */
async function suggestConfigChanges(tradeHistory, currentConfig) {
    const model = "gemini-2.5-flash";
    const prompt = `
        Act as a quantitative analyst. Based on recent trade history and bot config, suggest one single improvement.

        Current Config:
        - P(Success) Threshold: ${currentConfig.pSuccessThreshold}
        - Daily Loss Threshold: ${currentConfig.riskManagement.dailyLossThreshold * 100}%

        Recent Trades (last 10):
        ${tradeHistory.slice(0, 10).map(t => 
            `- ${t.opportunity.token.symbol} (${t.strategy}): ${t.status}, PnL: ${t.profit.toFixed(4)} ETH`
        ).join('\n')}

        Analysis Task: Suggest one actionable sentence.
        - If many failed trades with high P(Success), suggest increasing the threshold.
        - If few trades, suggest decreasing the threshold.
        - If losses are frequent, suggest tightening the daily loss threshold.
    `;
    
    try {
        const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 0.7 } });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for strategic advice:", error);
        return "Could not retrieve AI-driven advice.";
    }
}

module.exports = { analyzeOpportunity, analyzeTradeResult, suggestConfigChanges };