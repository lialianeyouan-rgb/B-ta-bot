
const { ethers } = require('ethers');
const fs = require('fs');
const { getOpportunities, getMarketContext, getSentimentAnalysis } = require('./collectData');
const { executeArbitrage } = require('./transactionExecutor');
const { analyzeOpportunity, analyzeTradeResult, suggestConfigChanges } = require('./geminiAnalyzer');
const { FlashbotsExecutor } = require('./flashbotsExecutor');
const { VectorStore } = require('./memory/vectorStore');
const appConfig = require('./config'); // Use the new config file

const HISTORY_FILE = './tradeHistory.json';

class ArbitrageBot {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.isRunning = false;
    this.statusMessage = "Initialized";
    this.opportunities = [];
    this.tradeHistory = [];
    this.logs = ['Bot initialized with Gemini AI Engine v2.1.'];
    this.config = JSON.parse(fs.readFileSync('./src/config.json', 'utf-8'));
    this.stats = { totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low' };
    this.marketSentiment = { overall: 'neutral', tokens: {} };
    this.interval = null;
    this.adviceInterval = null;
    this.sentimentInterval = null;
    this.rpcMonitorInterval = null;
    this.strategicAdvice = null;
    this.cooldownUntil = 0; // For risk management

    this.vectorStore = new VectorStore();
    this.loadHistory(); // Load persistent history on startup

    // --- RPC Redundancy & Failover ---
    const rpcUrls = [
        process.env.RPC_URL_1,
        process.env.RPC_URL_2,
        process.env.RPC_URL_3,
    ].filter(Boolean); // Filter out any undefined URLs

    if (rpcUrls.length === 0) {
        throw new Error("No RPC URLs configured in .env file. Please provide at least one (e.g., RPC_URL_1).");
    }
    this.addLog(`Initializing with ${rpcUrls.length} RPC endpoints for performance and redundancy.`);
    const providers = rpcUrls.map(url => new ethers.JsonRpcProvider(url));
    this.provider = new ethers.FallbackProvider(providers, 1);
    this.rpcStatus = rpcUrls.map(url => ({ url, latency: null, status: 'pending', isActive: false }));
    // --- End RPC Upgrade ---
    
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not defined in .env file.");
    }
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.flashbotsExecutor = null;
  }

  loadHistory() {
      try {
          if (fs.existsSync(HISTORY_FILE)) {
              const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
              this.tradeHistory = JSON.parse(data);
              this.addLog(`Loaded ${this.tradeHistory.length} trades from persistent history.`);
              this.tradeHistory.forEach(trade => this.vectorStore.addTrade(trade));
          }
      } catch (err) {
          this.addLog(`Error loading trade history: ${err.message}`);
          console.error("Error loading trade history:", err);
      }
  }

  saveHistory() {
      try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.tradeHistory, null, 2));
      } catch (err) {
          this.addLog(`Error saving trade history: ${err.message}`);
          console.error("Error saving trade history:", err);
      }
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
    
    const successfulTrades = this.tradeHistory.filter(t => t.status === 'success');
    const completedTrades = this.tradeHistory.filter(t => t.status !== 'simulated');

    const totalPnl = this.tradeHistory.reduce((acc, trade) => acc + (trade.profit || 0), 0);
    const successRate = completedTrades.length > 0 ? (successfulTrades.length / completedTrades.length) * 100 : 0;
    
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
      const { dailyLossThreshold, cooldownMinutes, capitalEth } = this.config.riskManagement;
      const today = new Date().toDateString();
      const pnlToday = this.tradeHistory
          .filter(t => new Date(t.timestamp).toDateString() === today)
          .reduce((sum, t) => sum + (t.profit || 0), 0);
      
      // Use configured capital. Fallback to 10 if not set.
      const capital = capitalEth || 10; 
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

  async monitorRpcStatus() {
      const activeProvider = this.provider.provider; // The currently active provider in the FallbackProvider
      
      const statusPromises = this.rpcStatus.map(async (rpc) => {
          const provider = new ethers.JsonRpcProvider(rpc.url);
          const startTime = Date.now();
          try {
              await provider.getBlockNumber();
              const latency = Date.now() - startTime;
              return { ...rpc, latency, status: 'online', isActive: activeProvider.connection.url === rpc.url };
          } catch (e) {
              return { ...rpc, latency: null, status: 'offline', isActive: false };
          }
      });
      this.rpcStatus = await Promise.all(statusPromises);
      this.broadcast({ type: 'rpc_status_update', data: this.rpcStatus });
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
        
        const fullContext = { 
            ...marketContext, 
            sentiment: this.marketSentiment,
            flashLoan: this.config.flashLoan
        };
        const scoredPromises = opportunities.map(o => analyzeOpportunity(o, fullContext, this.vectorStore));
        const scored = await Promise.all(scoredPromises);

        this.opportunities = [...scored.filter(s => s.pSuccess > 0), ...this.opportunities].slice(0, 20);
        this.broadcast({ type: 'opportunities_update', data: this.opportunities });

        const toTrade = scored.filter(t => t.pSuccess > this.config.pSuccessThreshold);
        if (toTrade.length > 0) this.addLog(`Gemini approved ${toTrade.length} trade(s) for execution.`);

        for (const trade of toTrade) {
          this.setStatus(true, `Executing ${trade.token.symbol}...`);
          const result = await executeArbitrage(this.wallet, this.provider, trade, this.config, this.flashbotsExecutor);
          
          const newTrade = {
              id: `trade-${trade.id}`,
              opportunity: trade,
              strategy: trade.strategy,
              status: result.success ? 'success' : 'failed',
              profit: result.profit,
              timestamp: Date.now(),
              txHash: result.txHash,
          };
          this.tradeHistory.unshift(newTrade);
          this.vectorStore.addTrade(newTrade); // Add to long-term memory
          this.addLog(`Trade ${trade.token.symbol}: ${newTrade.status.toUpperCase()}. PnL: ${result.profit.toFixed(6)} ETH. Hash: ${result.txHash}`);
          
          const postMortem = await analyzeTradeResult(newTrade);
          this.addLog(`Gemini Post-Mortem: ${postMortem}`);
          newTrade.postMortem = postMortem;
         
          this.broadcast({ type: 'history_update', data: newTrade });
          this.updateStats(marketContext);
          this.saveHistory(); // Persist history after each trade
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

  start() {
    if (this.interval) return;

    (async () => {
      this.addLog('Initializing Flashbots executor...');
      try {
        this.flashbotsExecutor = await FlashbotsExecutor.create(this.provider, this.wallet);
        this.addLog('Flashbots executor initialized. MEV protection is ACTIVE.');
      } catch (e) {
        this.addLog(`Could not initialize Flashbots: ${e.message}. Bot will use standard transactions.`);
        this.flashbotsExecutor = null;
      }
      
      await this.monitorRpcStatus();
      this.addLog('Initial RPC health check complete.');

      this.addLog('Bot is now fully autonomous...');
      await this.updateMarketSentiment();
      this.updateStats(); // Initial stats calculation from loaded history
      await this.mainLoop();
      await this.getStrategicUpdate();
      
      this.interval = setInterval(() => this.mainLoop(), 20000); // 20s interval
      this.adviceInterval = setInterval(() => this.getStrategicUpdate(), 1000 * 60 * 5); // 5 mins
      this.sentimentInterval = setInterval(() => this.updateMarketSentiment(), 1000 * 60 * 15); // 15 mins
      this.rpcMonitorInterval = setInterval(() => this.monitorRpcStatus(), 1000 * 60); // 1 min
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
    clearInterval(this.rpcMonitorInterval);
    this.interval = null;
    this.adviceInterval = null;
    this.sentimentInterval = null;
    this.rpcMonitorInterval = null;
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
  getRpcStatus() { return this.rpcStatus; }
}

module.exports = { ArbitrageBot };