// VectorStore provides a simplified long-term memory for the bot,
// allowing it to recall past trades to provide context for new opportunities.
// A real implementation would use a proper vector database and embeddings.

export class VectorStore {
    constructor(initialTrades = []) {
        this.trades = initialTrades;
    }

    /**
     * Adds a completed trade to the store.
     * @param {Trade} trade - The trade to add.
     */
    addTrade(trade) {
        this.trades.push(trade);
    }

    /**
     * Finds the most similar past trades to a new opportunity.
     * This uses a simple heuristic scoring model, not actual vectors.
     * @param {Opportunity} opportunity - The new opportunity.
     * @returns {Trade[]} An array of up to 3 similar trades.
     */
    findSimilar(opportunity) {
        if (this.trades.length === 0) return [];
        
        return this.trades
            .map(trade => {
                let score = 0;
                if (trade.opportunity.token.symbol === opportunity.token.symbol) score += 5;
                if (trade.strategy === opportunity.strategy) score += 3;
                
                // Closer spread = higher score
                const spreadDiff = Math.abs(trade.opportunity.spread - opportunity.spread);
                score += 1 / (spreadDiff + 0.1);

                return { trade, score };
            })
            .sort((a, b) => b.score - a.score) // Sort by highest score
            .slice(0, 3) // Return top 3
            .map(item => item.trade);
    }

    /**
     * Generates a concise text summary of similar past trades for the AI prompt.
     * @param {Opportunity} opportunity - The current opportunity to find context for.
     * @returns {string} A string summary.
     */
    getSimilarTradesContext(opportunity) {
        const similarTrades = this.findSimilar(opportunity);
        if (similarTrades.length === 0) {
            return "No similar trades found in history.";
        }
        const summary = similarTrades.map(trade => 
            `- A trade on ${trade.opportunity.token.symbol} with spread ${(trade.opportunity.spread * 100).toFixed(2)}% was ${trade.status}, resulting in ${trade.profit.toFixed(5)} ETH PnL.`
        ).join(' ');
        return `Found ${similarTrades.length} similar past trade(s): ${summary}`;
    }
}
