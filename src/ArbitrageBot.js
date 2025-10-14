const { ethers } = require('ethers');
const { getOpportunities, getMarketContext, getSentimentAnalysis } = require('./collectData');
const { sendTransaction } = require('./transactionExecutor');
const { analyzeOpportunity, analyzeTradeResult, suggestConfigChanges } = require('./geminiAnalyzer');
const { FlashbotsExecutor } = require('./flashbotsExecutor');
const { VectorStore } = require('./memory/vectorStore');
const fs = require('fs');

class ArbitrageBot {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.isRunning = false;
    this.statusMessage = "Initialized";
    this.opportunities = [];
    this.tradeHistory = [];
    this.logs = ['Bot initialized with Gemini AI Engine v2.0.'];
    this.config = JSON.parse(fs.readFileSync('./src/config.json', 'utf-8'));
    this.stats = { totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low' };
    this.marketSentiment = { overall: 'neutral', tokens: {} };
    this.interval = null;
    this.adviceInterval = null;
    this.sentimentInterval = null;
    this.strategicAdvice = null;
    this.cooldownUntil = 0; // For risk management

    this.vectorStore = new VectorStore();
    this.tradeHistory.forEach(trade => this.vectorStore.addTrade(trade));

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    this.provider = provider;
    this.flashbotsExecutor = null;
  }

  addLog(message) {
    this.logs.unshift(message);
    if (this.logs.length > 100) this.logs.pop();
    this.broadcast({ type: 'log', data: message });
  }
  
  setStatus(isRunning, message) {
      this.isRunning = isRunning;
      this.statusMessage = message;
      this.broadcast({ type: 'status_update', data: { isRunning: this.isRunning, statusMessage: this.statusMessage } });
  }

  updateStats(marketContext = {}) {
    const today = new Date().toDateString();
    const tradesTodayList = this.tradeHistory.filter(t => new Date(t.timestamp).toDateString() === today && t.status !== 'simulated');
    
    const successfulTrades = tradesTodayList.filter(t => t.status === 'success');
    const totalPnl = this.tradeHistory.reduce((acc, trade) => acc + (trade.profit || 0), 0);
    const successRate = tradesTodayList.length > 0 ? (successfulTrades.length / tradesTodayList.length) * 100 : 0;
    
    this.stats = {
      totalPnl: totalPnl,
      tradesToday: tradesTodayList.length,
      successRate: parseFloat(successRate.toFixed(2)),
      gasPriceGwei: marketContext.gasPriceGwei || this.stats.gasPriceGwei,
      volatility: marketContext.volatility || this.stats.volatility,
    };
    this.broadcast({ type: 'stats_update', data: this.stats });
  }
  
  checkRiskManagement() {
      const { dailyLossThreshold, cooldownMinutes } = this.config.riskManagement;
      const today = new Date().toDateString();
      const pnlToday = this.tradeHistory
          .filter(t => new Date(t.timestamp).toDateString() === today)
          .reduce((sum, t) => sum + (t.profit || 0), 0);
      
      // Assuming a capital of 10 ETH for threshold calculation. This should be configured.
      const capital = 10; 
      const lossPercentage = Math.abs(pnlToday / capital);

      if (pnlToday < 0 && lossPercentage > dailyLossThreshold) {
          this.cooldownUntil = Date.now() + cooldownMinutes * 60 * 1000;
          const reason = `Daily loss limit of ${dailyLossThreshold * 100}% hit. Pausing for ${cooldownMinutes} mins.`;
          this.addLog(`RISK ALERT: ${reason}`);
          this.broadcast({ type: 'risk_triggered', data: reason });
          return true;
      }
      return false;
  }


  async getStrategicUpdate() {
      if (this.tradeHistory.length < 5) return;
      this.addLog("Asking Gemini for a strategic performance review...");
      const advice = await suggestConfigChanges(this.tradeHistory, this.config);
      this.strategicAdvice = advice;
      this.addLog(`Gemini Suggestion: ${advice}`);
      this.broadcast({ type: 'strategic_advice', data: advice });
  }

  async updateMarketSentiment() {
      this.addLog("Fetching market sentiment analysis from Gemini...");
      const sentiments = await getSentimentAnalysis(this.config.tokens);
      this.marketSentiment = sentiments;
      this.broadcast({ type: 'sentiment_update', data: this.marketSentiment });
  }

  async mainLoop() {
    try {
      if (Date.now() < this.cooldownUntil) {
          const remaining = ((this.cooldownUntil - Date.now()) / 60000).toFixed(1);
          this.setStatus(false, `Paused - Risk Cooldown (${remaining}m)`);
          return;
      }
      if (this.checkRiskManagement()) return;

      this.setStatus(true, "Scanning for opportunities...");
      const [opportunities, marketContext] = await Promise.all([
          getOpportunities(this.config, this.provider),
          getMarketContext(this.provider)
      ]);

      this.updateStats(marketContext);

      if (opportunities.length > 0) {
        this.addLog(`Found ${opportunities.length} potential opportunities. Analyzing with Gemini...`);
        
        const fullContext = { ...marketContext, sentiment: this.marketSentiment };
        const scoredPromises = opportunities.map(o => analyzeOpportunity(o, fullContext, this.vectorStore));
        const scored = await Promise.all(scoredPromises);

        this.opportunities = [...scored, ...this.opportunities].slice(0, 20);
        this.broadcast({ type: 'opportunities_update', data: this.opportunities });

        const toTrade = scored.filter(t => t.pSuccess > this.config.pSuccessThreshold);
        if (toTrade.length > 0) this.addLog(`Gemini approved ${toTrade.length} trade(s) for execution.`);

        for (const trade of toTrade) {
          this.setStatus(true, `Executing ${trade.token.symbol}...`);
          const result = await sendTransaction(this.wallet, trade, this.flashbotsExecutor);
          
          const newTrade = {
              id: `trade-${trade.id}`,
              opportunity: trade,
              strategy: trade.strategy,
              status: result.success ? 'success' : 'failed',
              profit: result.profit,
              timestamp: Date.now(),
              message: result.message
          };
          this.tradeHistory.unshift(newTrade);
          this.vectorStore.addTrade(newTrade); // Add to long-term memory
          this.addLog(`Trade ${trade.token.symbol}: ${newTrade.status.toUpperCase()}. PnL: ${result.profit.toFixed(4)} ETH.`);
          
          const postMortem = await analyzeTradeResult(newTrade);
          this.addLog(`Gemini Post-Mortem: ${postMortem}`);
          newTrade.postMortem = postMortem;
          newTrade.similarPastTrades = trade.similarPastTrades; // Add memory context

          this.broadcast({ type: 'history_update', data: newTrade });
          this.updateStats(marketContext);
        }
      } else {
          this.addLog("No new opportunities found in this scan.");
      }
    } catch (err) {
      console.error('Error in mainLoop:', err);
      this.addLog(`ERROR: ${err.message}`);
      this.setStatus(false, "Error State");
    }
  }
  
  async runBacktest(startDate, endDate, config) {
      this.addLog("Running backtest simulation...");
      // In a real scenario, this would query a database of historical tick data.
      // Here, we simulate it by running the main loop logic with generated data.
      const simulatedTrades = [];
      let currentSimDate = new Date(startDate);
      const endSimDate = new Date(endDate);
      
      while(currentSimDate <= endSimDate) {
          // Simulate market data for this interval
          const fakePrice = 1 + (Math.random() - 0.5) * 0.1; // +/- 5% volatility
          const spread = 0.005 + Math.random() * 0.01;
          
          if(Math.random() > 0.7) { // 30% chance of an opportunity
               const trade = {
                   id: `sim-${currentSimDate.getTime()}`,
                   strategy: 'pairwise',
                   status: Math.random() > 0.3 ? 'success' : 'failed', // 70% success rate
                   profit: (Math.random() > 0.3 ? 1 : -1) * (0.01 + Math.random() * 0.05),
                   timestamp: currentSimDate.getTime(),
                   opportunity: { token: { symbol: 'SIM/ETH' }, spread }
               };
               simulatedTrades.push(trade);
          }
          currentSimDate.setHours(currentSimDate.getHours() + 4); // Advance time
      }
      
      const summary = {
          totalPnl: simulatedTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
          totalTrades: simulatedTrades.length,
          successRate: (simulatedTrades.filter(t => t.status === 'success').length / simulatedTrades.length) * 100,
          startDate,
          endDate
      };
      
      return { summary, trades: simulatedTrades };
  }

  start() {
    if (this.interval) return;

    (async () => {
      this.addLog('Initializing Flashbots executor...');
      try {
        this.flashbotsExecutor = await FlashbotsExecutor.create(this.provider, this.wallet);
        this.addLog('Flashbots executor initialized.');
      } catch (e) {
        this.addLog(`Could not initialize Flashbots: ${e.message}. Using standard transactions.`);
        this.flashbotsExecutor = null;
      }

      this.addLog('Bot is now fully autonomous...');
      await this.updateMarketSentiment();
      await this.mainLoop();
      await this.getStrategicUpdate();
      
      this.interval = setInterval(() => this.mainLoop(), 20000); // 20s interval
      this.adviceInterval = setInterval(() => this.getStrategicUpdate(), 1000 * 60 * 5); // 5 mins
      this.sentimentInterval = setInterval(() => this.updateMarketSentiment(), 1000 * 60 * 15); // 15 mins
    })().catch(err => {
      console.error('Bot startup failed:', err);
      this.addLog(`FATAL: Bot failed to start: ${err.message}`);
      this.setStatus(false, "Error State");
    });
  }

  stop() {
    if (!this.interval) return;
    this.addLog('Stopping bot via manual override...');
    clearInterval(this.interval);
    clearInterval(this.adviceInterval);
    clearInterval(this.sentimentInterval);
    this.interval = null;
    this.adviceInterval = null;
    this.sentimentInterval = null;
    this.setStatus(false, "Stopped (Manual)");
  }
  
  updateConfig(newConfig, isManual = false) {
    this.config = newConfig;
    fs.writeFileSync('./src/config.json', JSON.stringify(newConfig, null, 2));
    if(isManual) this.addLog('Manual configuration override has been applied.');
    this.broadcast({type: 'config_update', data: newConfig});
  }
  
  getStats() { return this.stats; }
  getLogs() { return this.logs; }
  getConfig() { return this.config; }
  getTradeHistory() { return this.tradeHistory; }
  getMarketSentiment() { return this.marketSentiment; }
}

module.exports = { ArbitrageBot };