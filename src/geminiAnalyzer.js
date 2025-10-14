require('dotenv').config();
const { GoogleGenAI, Type } = require('@google/genai');
const { VectorStore } = require('./memory/vectorStore');


if (!process.env.API_KEY) {
    throw new Error("API_KEY for Gemini API is not defined in .env file");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        pSuccess: { type: Type.NUMBER, description: "The estimated probability of the trade succeeding (0.0 to 1.0)." },
        optimalSize: { type: Type.NUMBER, description: "The suggested trade size in ETH to maximize profit." },
        rationale: { type: Type.STRING, description: "A brief explanation of the decision." },
        useFlashbots: { type: Type.BOOLEAN, description: "True if Flashbots execution is recommended." }
    },
    required: ["pSuccess", "optimalSize", "rationale", "useFlashbots"]
};


/**
 * Analyzes a trade opportunity using Gemini for a strategic assessment.
 * @param {object} opportunity The opportunity details.
 * @param {object} marketContext Current market conditions (gas, volatility, sentiment).
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

    const prompt = `
        Analyze this crypto arbitrage opportunity on ${opportunity.token.chain}.

        Market Context:
        - Gas Price: ${marketContext.gasPriceGwei} Gwei
        - Network Volatility: ${marketContext.volatility}
        - Overall Market Sentiment: ${marketContext.sentiment?.overall || 'neutral'}
        - Token Pair Sentiment (${opportunity.token.symbol}): ${tokenSentiment}

        Opportunity Details:
        - Strategy: ${opportunity.strategy}
        - Token Pair: ${opportunity.token.symbol}
        - DEXs: ${opportunity.token.dexs.join(' -> ')}
        - Spread: ${(opportunity.spread * 100).toFixed(4)}%
        - Available Liquidity: ${opportunity.liquidity.toFixed(2)} ETH

        ${memoryContext}

        Task: Provide a strategic assessment.
        1.  pSuccess: Probability of success. Decrease if gas is high, volatility is high, sentiment is bearish, or past similar trades failed.
        2.  optimalSize: Optimal trade size in ETH.
        3.  rationale: A brief explanation incorporating market context and memory.
        4.  useFlashbots: Recommend if potential profit is high and vulnerable to MEV.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: analysisSchema, temperature: 0.5 }
        });
        
        const analysis = JSON.parse(response.text);
        return { ...opportunity, ...analysis };

    } catch (error) {
        console.error("Error calling Gemini API for opportunity analysis:", error);
        return { ...opportunity, pSuccess: 0, optimalSize: 0, rationale: "AI analysis failed.", useFlashbots: false };
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
        - Token Pair: ${trade.opportunity.token.symbol}
        - Predicted P(Success): ${trade.opportunity.pSuccess * 100}%
        - Status: ${trade.status}
        - Actual PnL: ${trade.profit.toFixed(5)} ETH

        Task: Explain the likely reason for the outcome and provide a one-sentence learning.
        - If SUCCESS: What contributed? (e.g., accurate prediction, low congestion).
        - If FAILED: What was the likely cause? (e.g., front-run by MEV, high slippage, gas fees).
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
            `- ${t.opportunity.token.symbol}: ${t.status}, PnL: ${t.profit.toFixed(4)} ETH`
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


/**
 * Asks Gemini to generate the transaction payload for an arbitrage swap.
 * This is a placeholder as real payload generation is highly complex and specific.
 * @param {object} trade The trade opportunity object.
 * @param {string} walletAddress The address of the executing wallet.
 * @returns {Promise<object>} A promise that resolves to { to, data, value }.
 */
async function generateTransactionPayload(trade, walletAddress) {
    // For safety, this function will now return a hardcoded, non-executable payload.
    // In a real system, this would involve complex prompts and rigorous validation.
    console.log(`[SIMULATION] Generating payload for ${trade.strategy} trade on ${trade.token.symbol}.`);
    return {
        to: "0x0000000000000000000000000000000000000000", // Null address
        data: "0x", // No data
        value: "0" // No value
    };
}


module.exports = { analyzeOpportunity, analyzeTradeResult, generateTransactionPayload, suggestConfigChanges };