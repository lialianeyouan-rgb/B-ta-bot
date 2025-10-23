import { GoogleGenAI, Type } from "@google/genai";

/**
 * Analyzes a trade opportunity using Google Gemini.
 * @param {Opportunity} opportunity - The opportunity data.
 * @param {string} similarTradesContext - Context from the vector store.
 * @param {GoogleGenAI | null} ai - The initialized Gemini AI client.
 * @param {number} flashLoanFee - The flash loan provider fee.
 * @returns {Promise<Opportunity>} The enriched opportunity.
 */
export async function geminiAnalyze(opportunity, similarTradesContext, ai, flashLoanFee) {
    if (!ai) {
        // Fallback simulation if Gemini API key is missing
        return {
            ...opportunity,
            pSuccess: 0.85,
            rationale: "AI analysis disabled (API key missing). Using simulated data.",
            useFlashbots: true,
            similarPastTrades: similarTradesContext,
        };
    }
    
    // In a real implementation, you might use a more advanced model
    const model = 'gemini-2.5-flash';

    const prompt = `
        Analyze this crypto arbitrage opportunity for a flash loan bot on Polygon and provide a JSON response.
        
        Opportunity Details:
        - Strategy: ${opportunity.strategy}
        - Token Pair: ${opportunity.token.symbol}
        - DEX Path: ${opportunity.token.dexs.join(' -> ')}
        - Potential Spread: ${(opportunity.spread * 100).toFixed(4)}%
        - Estimated Liquidity: ${opportunity.liquidity}
        - Proposed Loan Amount: ${opportunity.loanAmount.toFixed(4)} ETH
        - Flash Loan Fee: ${(flashLoanFee * 100).toFixed(4)}%

        Historical Context (similar past trades):
        ${similarTradesContext}
        
        Current Market Conditions (Hypothetical):
        - Gas Price: High (80 Gwei)
        - Market Volatility: Medium
        - General Sentiment: Neutral
        - Potential for Slippage: Medium

        Based on all this information, including transaction fees (gas), flash loan fees, and potential price slippage, 
        estimate the probability of a PROFITABLE success (pSuccess) as a float between 0.0 and 1.0. 
        Provide a brief rationale for your estimation. 
        Also, decide if using Flashbots for MEV protection is recommended (useFlashbots).
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        pSuccess: { type: Type.NUMBER },
                        rationale: { type: Type.STRING },
                        useFlashbots: { type: Type.BOOLEAN },
                    }
                }
            }
        });
        
        const result = JSON.parse(response.text);

        return {
            ...opportunity,
            pSuccess: result.pSuccess,
            rationale: result.rationale,
            useFlashbots: result.useFlashbots,
            similarPastTrades: similarTradesContext,
        };
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Fallback on API error
        return { ...opportunity, pSuccess: 0.5, rationale: "Gemini API call failed. Could not analyze.", useFlashbots: false };
    }
}

/**
 * Generates high-level strategic advice based on overall performance.
 * @param {BotStats} stats - Current bot statistics.
 * @param {Trade[]} recentTrades - A list of the most recent trades.
 * @param {GoogleGenAI | null} ai - The initialized Gemini AI client.
 * @returns {Promise<string>} A string containing strategic advice.
 */
export async function getStrategicAdvice(stats, recentTrades, ai) {
     if (!ai) return "AI analysis disabled (API key missing).";
     
     const prompt = `
        As a crypto trading strategist, provide concise advice for an arbitrage bot operator based on this data:
        - Total PnL: ${stats.totalPnl.toFixed(4)} ETH
        - Success Rate: ${stats.successRate.toFixed(2)}%
        - Trades Today: ${stats.tradesToday}
        - Recent Trades Summary: ${recentTrades.length > 0 ? recentTrades.map(t => `${t.status} trade with ${t.profit.toFixed(4)} ETH PnL`).join(', ') : 'None'}

        Suggest one key action. For example: 'Consider increasing risk capital', 'Focus on higher-spread opportunities', or 'Pause trading if volatility increases'.
     `;
     
     try {
         const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
         return response.text;
     } catch (error) {
         console.error("Error fetching strategic advice:", error);
         return "Could not fetch new strategic advice from Gemini.";
     }
}
