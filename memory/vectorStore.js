// VectorStore provides a simplified long-term memory for the bot,
// allowing it to recall past trades to provide context for new opportunities.
// It now queries the database directly, making it a stateless service.

export class VectorStore {
    /**
     * Finds the most similar past trades to a new opportunity by querying the database.
     * This uses a simple heuristic scoring model, not actual vectors.
     * @param {Opportunity} opportunity - The new opportunity.
     * @param {Database} db - The database instance.
     * @returns {Promise<Trade[]>} An array of up to 3 similar trades.
     */
    async findSimilar(opportunity, db) {
        // NOTE: In a production system with millions of trades, this would be a targeted SQL query
        // or a call to a dedicated vector database. For this project's scale, fetching and processing
        // in memory is acceptable and avoids complex SQL with JSON parsing.
        const allTrades = await db.getTrades();
        if (allTrades.length === 0) return [];
        
        return allTrades
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
     * @param {Database} db - The database instance.
     * @returns {Promise<string>} A string summary.
     */
    async getSimilarTradesContext(opportunity, db) {
        const similarTrades = await this.findSimilar(opportunity, db);
        if (similarTrades.length === 0) {
            return "No similar trades found in history.";
        }
        const summary = similarTrades.map(trade => 
            `- A trade on ${trade.opportunity.token.symbol} with spread ${(trade.opportunity.spread * 100).toFixed(2)}% was ${trade.status}, resulting in ${trade.profit.toFixed(5)} ETH PnL.`
        ).join(' ');
        return `Found ${similarTrades.length} similar past trade(s): ${summary}`;
    }
}