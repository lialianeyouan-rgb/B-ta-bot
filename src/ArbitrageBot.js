import 'dotenv/config';
import { ethers } from "ethers";
import configData from './config.json' assert { type: 'json' };
import { VectorStore } from '../memory/vectorStore.js';
import { FlashbotsExecutor } from './flashbotsExecutor.js';
import { geminiAnalyze, getStrategicAdvice } from './geminiAnalyzer.js';
import { GoogleGenAI } from "@google/genai";
import { Database } from './database.js';
import { Logger } from './logger.js';

// Fonctions simulées pour la démonstration
import { collectData } from './collectData.js';
import { executeTransaction } from './transactionExecutor.js';

export class ArbitrageBot {
    constructor(broadcastCallback) {
        this.broadcast = broadcastCallback;
        
        // Database & Logger
        this.db = new Database('./arbitrage.db');
        this.vectorStore = new VectorStore();
        
        // State
        this.isRunning = false;
        this.statusMessage = "Initializing...";
        this.opportunities = [];
        this.tradeHistory = []; // Maintenu en mémoire pour l'UI, mais avec une taille limitée.
        this.logs = ['Bot initializing...'];
        this.config = configData;
        this.strategicAdvice = "Strategic analysis will be available after a few trades.";
        this.marketSentiment = { overall: 'neutral', tokens: {} };
        this.stats = { totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low', estimatedRpcRequestsPerDay: 0 };
        this.cooldownUntil = 0;
        this.mainLoopInterval = null;
        this.geminiAi = null;

        // Ethers & Wallet Setup
        const { rpcUrls, privateKey } = this.config;
        if (!rpcUrls || rpcUrls.length === 0) throw new Error("FATAL: rpcUrls ne sont pas configurés dans src/config.json");
        if (!privateKey || privateKey.startsWith("0x...")) throw new Error("FATAL: La clé privée n'est pas définie dans src/config.json. Veuillez remplacer la valeur par défaut.");
        
        this.rpcStatus = rpcUrls.map(url => ({ url, latency: null, status: 'pending', isActive: false }));
        
        const providers = rpcUrls.map(url => new ethers.providers.JsonRpcProvider(url));
        this.provider = new ethers.providers.FallbackProvider(providers, 1);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.flashbotsExecutor = null;
    }

    async initialize() {
        // Initialiser la base de données et le logger en premier
        await this.db.connect();
        this.logs = Logger.getRecentLogs();
        this.addLog("Logger and Database initialized.");

        // Charger l'historique récent pour l'affichage initial
        this.tradeHistory = await this.db.getTrades({ limit: 100 });
        this.addLog(`Loaded ${this.tradeHistory.length} recent trades from database for UI.`);
        await this.updateStats();

        this.initGemini();
        this.addLog(`Bot initialized. Wallet Address: ${this.wallet.address}`);
        await this.initFlashbots();
    }

    initGemini() {
        const apiKey = this.config.geminiApiKey;
        if (!apiKey || apiKey.startsWith("AIza...")) {
            this.addLog("WARN: Gemini API key not set in src/config.json. AI features disabled.");
            this.geminiAi = null;
        } else {
            this.geminiAi = new GoogleGenAI({ apiKey: apiKey });
            this.addLog("Gemini AI client initialized.");
        }
    }
    
    async initFlashbots() {
        this.flashbotsExecutor = await FlashbotsExecutor.create(this.provider, this.wallet);
        this.addLog(this.flashbotsExecutor ? "Flashbots executor initialized." : "Flashbots initialization failed, using standard transactions.");
    }

    addLog(message) {
        Logger.log(message);
        const logMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.logs = [logMessage, ...this.logs.slice(0, 99)];
        this.broadcast({ type: 'log', data: logMessage });
    }

    updateConfig(newConfig) {
        this.config = newConfig;
        this.addLog("Configuration updated manually via dashboard.");
        this.broadcast({ type: 'config_update', data: this.config });
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.statusMessage = "Starting...";
        this.addLog("Arbitrage bot starting...");
        this.broadcast({ type: 'status_update', data: { isRunning: this.isRunning, statusMessage: this.statusMessage }});
        // Run main loop every 15 seconds
        this.mainLoopInterval = setInterval(() => this.mainLoop(), 15000);
        // Update strategic advice every 5 minutes
        setInterval(() => this.updateStrategicAdvice(), 300000);
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.statusMessage = "Stopped";
        this.addLog("Arbitrage bot stopping...");
        clearInterval(this.mainLoopInterval);
        this.mainLoopInterval = null;
        this.broadcast({ type: 'status_update', data: { isRunning: this.isRunning, statusMessage: this.statusMessage }});
    }

    async mainLoop() {
        if (Date.now() < this.cooldownUntil) {
             const remaining = ((this.cooldownUntil - Date.now()) / 60000).toFixed(1);
            const msg = `On Cooldown (${remaining}m)`;
            if (this.statusMessage !== msg) {
                this.statusMessage = msg;
                this.addLog(`Bot is on cooldown. Resuming in ${remaining}m.`);
                this.broadcast({ type: 'status_update', data: { isRunning: true, statusMessage: this.statusMessage } });
            }
            return;
        }

        try {
            this.statusMessage = "Scanning for opportunities...";
            this.broadcast({ type: 'status_update', data: { isRunning: true, statusMessage: this.statusMessage }});
            
            const potentialOpportunities = await collectData(this.config, this.provider);
            
            if (potentialOpportunities.length === 0) return;

            for (const opp of potentialOpportunities) {
                this.addLog(`Potential opportunity for ${opp.token.symbol}. Analyzing...`);
                
                const context = await this.vectorStore.getSimilarTradesContext(opp, this.db);
                const analyzedOpp = await geminiAnalyze(opp, context, this.geminiAi);

                this.opportunities = [analyzedOpp, ...this.opportunities.slice(0, 19)];
                this.broadcast({ type: 'opportunities_update', data: this.opportunities });

                if (analyzedOpp.pSuccess && analyzedOpp.pSuccess >= this.config.pSuccessThreshold) {
                    this.addLog(`Executing trade for ${analyzedOpp.token.symbol} with P(Success) of ${(analyzedOpp.pSuccess * 100).toFixed(1)}%`);
                    
                    const result = await executeTransaction(analyzedOpp, this.wallet, this.flashbotsExecutor);
                    
                    const newTrade = {
                        id: `trade-${Date.now()}`,
                        opportunity: analyzedOpp,
                        strategy: analyzedOpp.strategy,
                        status: result.success ? 'success' : 'failed',
                        profit: result.profit,
                        timestamp: Date.now(),
                        txHash: result.txHash,
                        postMortem: result.postMortem || (result.success ? "Execution successful." : "Execution failed.")
                    };
                    
                    this.addLog(`Trade Result: ${newTrade.status.toUpperCase()}, PnL: ${newTrade.profit.toFixed(5)} ETH`);

                    // Persist trade and update UI
                    await this.db.addTrade(newTrade);
                    this.tradeHistory.unshift(newTrade);
                    if (this.tradeHistory.length > 100) this.tradeHistory.pop(); // Cap in-memory history
                    
                    this.broadcast({ type: 'history_update', data: newTrade });
                    await this.updateStats();
                }
            }
        } catch (error) {
            this.addLog(`CRITICAL ERROR in main loop: ${error.message}`);
            this.statusMessage = "Error - check logs.";
        } finally {
            this.statusMessage = "Monitoring...";
            this.broadcast({ type: 'status_update', data: { isRunning: true, statusMessage: this.statusMessage } });
        }
    }
    
    async updateStrategicAdvice() {
        this.addLog("Fetching new strategic advice from Gemini...");
        // Use in-memory recent trades for context
        const recentTrades = this.tradeHistory.slice(0, 10);
        this.strategicAdvice = await getStrategicAdvice(this.stats, recentTrades, this.geminiAi);
        this.broadcast({ type: 'strategic_advice', data: this.strategicAdvice });
    }

    async updateStats() {
        const dbStats = await this.db.getStats();
        
        this.stats = {
            ...this.stats, // Conserve les stats non persistées comme le gas, etc.
            ...dbStats,
        };
        this.broadcast({ type: 'stats_update', data: this.stats });
    }
}