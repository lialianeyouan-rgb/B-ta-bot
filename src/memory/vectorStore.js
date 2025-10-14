/**
 * A simple in-memory simulation of a vector store for trade history.
 * In a production system, this would be replaced by a real vector database like Pinecone or ChromaDB.
 */
class VectorStore {
  constructor() {
    this.trades = [];
    console.log("In-memory VectorStore initialized.");
  }

  /**
   * Adds a trade to the memory.
   * In a real implementation, this would involve creating a vector embedding of the trade data.
   * @param {object} trade The trade object to add.
   */
  addTrade(trade) {
    this.trades.push(trade);
  }

  /**
   * Finds trades that are similar to a given opportunity.
   * This simple implementation uses basic heuristics instead of vector similarity search.
   * @param {object} opportunity The opportunity to find similar trades for.
   * @returns {Array<object>} A list of similar trades, sorted by relevance.
   */
  findSimilar(opportunity) {
    if (this.trades.length === 0) {
      return [];
    }
    
    const similar = this.trades
      .map(trade => {
        let score = 0;
        // Compare by token symbol
        if (trade.opportunity.token.symbol === opportunity.token.symbol) {
          score += 5;
        }
        // Compare by strategy
        if (trade.strategy === opportunity.strategy) {
          score += 3;
        }
        // Compare by spread (closer is better)
        const spreadDiff = Math.abs(trade.opportunity.spread - opportunity.spread);
        score += 1 / (spreadDiff + 0.1);

        return { trade, score };
      })
      .sort((a, b) => b.score - a.score); // Sort by highest score

    // Return the top 3 most similar trades
    return similar.slice(0, 3).map(item => item.trade);
  }
}

module.exports = { VectorStore };