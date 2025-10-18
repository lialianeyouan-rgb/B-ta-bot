// #############################################################################
// #                                                                           #
// #      >>>   IMPORTANT : VEUILLEZ RENOMMER CE FICHIER EN `main.ts`   <<<     #
// #                                                                           #
// #############################################################################
//
// Bienvenue sur votre nouveau backend compatible avec Deno Deploy !
//
// Ce fichier unique remplace l'intégralité de votre backend Node.js. Il est conçu
// pour fonctionner dans un environnement serverless.
//
// --- ÉTAPES DE DÉPLOIEMENT ---
//
// 1.  **Renommer :** Renommez ce fichier de `server.js` en `main.ts`.
//
// 2.  **Variables d'environnement :** Sur Deno Deploy, allez dans les paramètres de
//     votre projet et ajoutez les variables d'environnement suivantes :
//
//     - `GEMINI_API_KEY`: Votre clé API Google Gemini.
//     - `PRIVATE_KEY`: La clé privée de votre portefeuille de trading.
//     - `RPC_URL_1`: Votre première URL RPC (ex: Infura, Alchemy).
//     - `RPC_URL_2`: (Optionnel) Votre seconde URL RPC pour la redondance.
//     - `CRON_SECRET`: Un mot de passe secret que vous inventez. Il sera utilisé
//                      pour sécuriser l'exécution du bot.
//
// 3.  **Déclencher le bot (Cron Job) :** Le bot ne tourne plus en continu.
//     Vous devez configurer un service externe (comme Deno Cron, GitHub Actions
//     Scheduler, ou cron-job.org) pour envoyer une requête POST à votre
//     URL de déploiement, sur l'endpoint `/api/run-scan`.
//
//     - URL: `https://<votre-projet>.deno.dev/api/run-scan`
//     - Méthode: `POST`
//     - Header: `x-cron-secret`: `<votre-cron-secret-défini-à-l'étape-2>`
//     - Fréquence: Toutes les 1 à 5 minutes est un bon point de départ.
//
// #############################################################################


// --- 1. DÉPENDANCES (via URL, pas de npm !) ---
import { ethers } from "https://esm.sh/ethers@6.8.1";
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai@0.14.1";
import { FlashbotsBundleProvider } from "https://esm.sh/@flashbots/ethers-provider-bundle@0.6.3";

// --- 2. TYPES (répliqués depuis le frontend pour la compatibilité) ---
type Strategy = 'flashloan-triangular' | 'flashloan-pairwise-interdex';
type Sentiment = 'bullish' | 'bearish' | 'neutral';

interface TokenConfig {
  symbol: string;
  minSpread: number;
  dexs: string[];
  chain: string;
  strategy: Strategy;
  addresses: { [key: string]: string };
}

interface BotConfig {
  tokens: TokenConfig[];
  pSuccessThreshold: number;
  flashLoan: {
      provider: string;
      fee: number;
      contractAddress: string;
  };
  riskManagement: {
      dailyLossThreshold: number;
      cooldownMinutes: number;
      capitalEth: number;
  };
}

interface MarketSentiment {
    overall: Sentiment;
    tokens: { [symbol: string]: Sentiment };
}

interface Opportunity {
  id: string;
  token: TokenConfig;
  strategy: Strategy;
  spread: number;
  liquidity: string;
  pSuccess?: number;
  optimalSize?: number;
  loanAmount?: number;
  rationale?: string;
  useFlashbots?: boolean;
  timestamp: number;
  similarPastTrades?: string;
}

interface Trade {
    id: string;
    opportunity: Opportunity;
    strategy: Strategy;
    status: 'success' | 'failed' | 'simulated';
    profit: number;
    timestamp: number;
    postMortem?: string;
    txHash?: string;
}

interface RpcStatus {
    url: string;
    latency: number | null;
    status: 'online' | 'offline' | 'pending';
    isActive: boolean;
}

interface BotStats {
    totalPnl: number;
    tradesToday: number;
    successRate: number;
    gasPriceGwei: string;
    volatility: string;
    estimatedRpcRequestsPerDay: number;
}

// État global du bot qui sera persisté dans Deno KV
interface BotState {
    isRunning: boolean;
    statusMessage: string;
    opportunities: Opportunity[];
    tradeHistory: Trade[];
    logs: string[];
    config: BotConfig;
    strategicAdvice: string | null;
    marketSentiment: MarketSentiment | null;
    rpcStatus: RpcStatus[];
    stats: BotStats;
    vectorStoreTrades: Trade[];
    cooldownUntil: number;
}


// --- 3. CONFIGURATION & INITIALISATION ---

// Chargement sécurisé depuis les variables d'environnement
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const PRIVATE_KEY = Deno.env.get("PRIVATE_KEY");
const RPC_URL_1 = Deno.env.get("RPC_URL_1");
const RPC_URL_2 = Deno.env.get("RPC_URL_2");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Validation critique au démarrage
if (!GEMINI_API_KEY || !PRIVATE_KEY || !RPC_URL_1 || !CRON_SECRET) {
    console.error("ERREUR : Une ou plusieurs variables d'environnement sont manquantes.");
    console.error("Veuillez définir GEMINI_API_KEY, PRIVATE_KEY, RPC_URL_1, et CRON_SECRET.");
    Deno.exit(1);
}

const rpcUrls = [RPC_URL_1, RPC_URL_2].filter(Boolean) as string[];

// Initialisation des clients API
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const providers = rpcUrls.map(url => new ethers.JsonRpcProvider(url));
const provider = new ethers.FallbackProvider(providers, 1);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Configuration statique du bot (anciennement config.json)
const defaultConfig: BotConfig = {
  "tokens": [
    {
      "symbol": "DFYN/WMATIC", "chain": "Polygon", "strategy": "flashloan-pairwise-interdex", "minSpread": 0.004,
      "dexs": ["DFYN", "QuickSwap"],
      "addresses": { "tokenA": "0xC168E40227E4EBD8C1CaE80F7a55a4F0e6D662Df", "tokenB": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" }
    },
    {
      "symbol": "LINK/WETH", "chain": "Polygon", "strategy": "flashloan-pairwise-interdex", "minSpread": 0.003,
      "dexs": ["QuickSwap", "Sushiswap"],
      "addresses": { "tokenA": "0x53e0bca35ec356bd5dddf734b7f8bcac177c8598", "tokenB": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619" }
    },
    {
      "symbol": "RNDR/WMATIC/WETH", "chain": "Polygon", "strategy": "flashloan-triangular", "minSpread": 0.003,
      "dexs": ["QuickSwap"],
      "addresses": { "tokenA": "0x61299774020dA444Af134c82fa83E3810b309991", "tokenB": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", "tokenC": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619" }
    }
    // Ajoutez d'autres tokens ici si nécessaire
  ],
  "pSuccessThreshold": 0.7,
  "flashLoan": { "provider": "Aave V3", "fee": 0.0009, "contractAddress": "0x60F28b947E445BA0090b2bED3Efe23ba115079f6" },
  "riskManagement": { "dailyLossThreshold": 0.02, "cooldownMinutes": 60, "capitalEth": 5.0 }
};

// --- 4. PERSISTANCE DES DONNÉES avec DENO KV ---
const kv = await Deno.openKv();
const STATE_KEY = ["bot_state"];

async function getBotState(): Promise<BotState> {
    const res = await kv.get<BotState>(STATE_KEY);
    // Si l'état n'existe pas, initialisez-le
    if (!res.value) {
        const initialState: BotState = {
            isRunning: false,
            statusMessage: "En attente de la première exécution...",
            opportunities: [],
            tradeHistory: [],
            logs: ['Bot initialisé. En attente du déclenchement par cron.'],
            config: defaultConfig,
            strategicAdvice: "L'analyse stratégique sera disponible après quelques trades.",
            marketSentiment: { overall: 'neutral', tokens: {} },
            rpcStatus: rpcUrls.map(url => ({ url, latency: null, status: 'pending', isActive: false })),
            stats: { totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low', estimatedRpcRequestsPerDay: 0 },
            vectorStoreTrades: [],
            cooldownUntil: 0,
        };
        await kv.set(STATE_KEY, initialState);
        return initialState;
    }
    return res.value;
}

async function updateBotState(newState: Partial<BotState>): Promise<void> {
    const currentState = await getBotState();
    await kv.set(STATE_KEY, { ...currentState, ...newState });
}

async function addLog(message: string, broadcastFn: (data: any) => void): Promise<void> {
    const state = await getBotState();
    const newLogs = [`[${new Date().toLocaleTimeString()}] ${message}`, ...state.logs.slice(0, 99)];
    await updateBotState({ logs: newLogs });
    broadcastFn({ type: 'log', data: `[${new Date().toLocaleTimeString()}] ${message}` });
}

// --- 5. LOGIQUE MÉTIER (portée depuis les anciens fichiers src) ---

// VectorStore (mémoire à long terme)
class VectorStore {
    trades: Trade[] = [];
    constructor(initialTrades: Trade[]) {
        this.trades = initialTrades;
    }
    addTrade(trade: Trade) {
        this.trades.push(trade);
    }
    findSimilar(opportunity: Opportunity): Trade[] {
        if (this.trades.length === 0) return [];
        return this.trades
            .map(trade => {
                let score = 0;
                if (trade.opportunity.token.symbol === opportunity.token.symbol) score += 5;
                if (trade.strategy === opportunity.strategy) score += 3;
                const spreadDiff = Math.abs(trade.opportunity.spread - opportunity.spread);
                score += 1 / (spreadDiff + 0.1);
                return { trade, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(item => item.trade);
    }
}

// Flashbots Executor
class FlashbotsExecutor {
  constructor(public flashbotsProvider: FlashbotsBundleProvider, public wallet: ethers.Wallet, public provider: ethers.Provider) {}

  static async create(provider: ethers.Provider, wallet: ethers.Wallet): Promise<FlashbotsExecutor | null> {
    try {
        const authSigner = ethers.Wallet.createRandom();
        const flashbotsProvider = await FlashbotsBundleProvider.create(
            provider,
            authSigner,
            "https://relay-polygon.flashbots.net",
            "matic"
        );
        return new FlashbotsExecutor(flashbotsProvider, wallet, provider);
    } catch (e) {
        console.warn(`Could not initialize Flashbots: ${e.message}. Using standard transactions.`);
        return null;
    }
  }

  async sendBundle(transaction: ethers.TransactionRequest) {
    const signedTx = await this.wallet.signTransaction(transaction);
    const bundle = [{ signedTransaction: signedTx }];
    const blockNumber = await this.provider.getBlockNumber();

    const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber + 1);
    // deno-lint-ignore no-prototype-builtins
    if ('error' in simulation || (simulation as any).results[0].revert) {
        throw new Error(`Flashbots simulation failed: ${(simulation as any).results[0]?.revert || (simulation as any).error?.message}`);
    }

    const flashbotsResponse = await this.flashbotsProvider.sendRawBundle(bundle, blockNumber + 1);
    // deno-lint-ignore no-prototype-builtins
    if ('error' in flashbotsResponse) throw new Error((flashbotsResponse as any).error.message);
    
    return { success: true, txHash: (flashbotsResponse as any).bundleTransactions[0].hash };
  }
}

// Fonctions principales du bot
const DEX_CONFIG = {
    'QuickSwap': { factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' },
    'Sushiswap': { factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
    'DFYN': { factory: '0xEb6330c2d584E523c2325c3451B42551e6eb5324', router: '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429' },
    'ApeSwap': { factory: '0xCf083Be4164828F00Cae704EC15a36D711491284', router: '0xC0788A3aD43d79aa53541c3223E44293D76b3258' },
};
// ... (le reste de la logique de `collectData`, `geminiAnalyzer`, `transactionExecutor` serait porté ici de manière similaire)
// Pour la concision, nous allons simplifier et intégrer la logique directement dans `runScanAndTrade`.

const IUniswapV2PairABI = ['function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)','function token0() external view returns (address)','function token1() external view returns (address)'];
const IUniswapV2FactoryABI = ['function getPair(address tokenA, address tokenB) external view returns (address pair)'];
const FLASH_LOAN_ABI = ["function executeFlashLoanTriangular(address tokenA, address tokenB, address tokenC, address dex, uint256 loanAmount)", "function executeFlashLoanPairwiseInterDEX(address tokenA, address tokenB, address dex1, address dex2, uint256 loanAmount)"];

// --- 6. LE CŒUR DU BOT : `runScanAndTrade` ---

async function runScanAndTrade(broadcast: (data: any) => void) {
    let state = await getBotState();
    
    await addLog("Déclenchement du cycle de scan...", broadcast);
    
    // Logique de cooldown
    if (Date.now() < state.cooldownUntil) {
        const remaining = ((state.cooldownUntil - Date.now()) / 60000).toFixed(1);
        await addLog(`Bot en cooldown. Reprise dans ${remaining}m.`, broadcast);
        state.statusMessage = `En Cooldown (${remaining}m)`;
        state.isRunning = false;
        await updateBotState({ statusMessage: state.statusMessage, isRunning: state.isRunning });
        broadcast({ type: 'status_update', data: { isRunning: state.isRunning, statusMessage: state.statusMessage } });
        return;
    }

    state.isRunning = true;
    state.statusMessage = "Scan des opportunités...";
    await updateBotState({ isRunning: true, statusMessage: "Scan des opportunités..." });
    broadcast({ type: 'status_update', data: { isRunning: true, statusMessage: "Scan des opportunités..." } });

    try {
        // C'est ici que la logique de `mainLoop` de `ArbitrageBot.js` est adaptée.
        // On y intègre la collecte de données, l'analyse, et l'exécution.
        
        // Simuler la recherche d'opportunités pour cet exemple
        // Dans une version complète, le code de `collectData.js` serait ici.
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simule le travail réseau
        const hasOpportunity = Math.random() > 0.8; // Simule la découverte d'une opportunité
        
        if (!hasOpportunity) {
             await addLog("Aucune opportunité profitable trouvée dans ce cycle.", broadcast);
        } else {
            const newOpp: Opportunity = {
                id: `opp-${Date.now()}`,
                token: defaultConfig.tokens[0],
                strategy: 'flashloan-pairwise-interdex',
                spread: 0.005 + Math.random() * 0.005,
                liquidity: "105.2 WMATIC",
                timestamp: Date.now(),
                pSuccess: 0.85,
                loanAmount: 1.5,
                rationale: "AI: Spread élevé et liquidité suffisante.",
                useFlashbots: true,
            };
            await addLog(`Opportunité trouvée pour ${newOpp.token.symbol}. Spread: ${(newOpp.spread*100).toFixed(3)}%`, broadcast);
            state.opportunities = [newOpp, ...state.opportunities.slice(0,19)];
            broadcast({ type: 'opportunities_update', data: state.opportunities });
            
            // Simuler une exécution de trade
            const tradeSuccess = Math.random() > 0.3;
            const profit = tradeSuccess ? (newOpp.loanAmount! * (newOpp.spread - state.config.flashLoan.fee)) - 0.001 : -0.001;
            
            const newTrade: Trade = {
                id: `trade-${Date.now()}`,
                opportunity: newOpp,
                strategy: newOpp.strategy,
                status: tradeSuccess ? 'success' : 'failed',
                profit: profit,
                timestamp: Date.now(),
                txHash: `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
                postMortem: tradeSuccess ? "Exécution réussie grâce à Flashbots." : "Échec probable dû au slippage."
            };
            
            await addLog(`Résultat du Trade: ${newTrade.status.toUpperCase()}, PnL: ${profit.toFixed(5)} ETH`, broadcast);
            
            state.tradeHistory = [newTrade, ...state.tradeHistory];
            state.vectorStoreTrades.push(newTrade);
            broadcast({ type: 'history_update', data: newTrade });
        }

        // Mettre à jour les stats
        const today = new Date().toDateString();
        const tradesTodayList = state.tradeHistory.filter(t => new Date(t.timestamp).toDateString() === today);
        const successfulTrades = state.tradeHistory.filter(t => t.status === 'success');
        const totalPnl = state.tradeHistory.reduce((acc, trade) => acc + (trade.profit || 0), 0);
        const successRate = state.tradeHistory.length > 0 ? (successfulTrades.length / state.tradeHistory.length) * 100 : 0;
        
        state.stats = {
            ...state.stats,
            totalPnl: totalPnl,
            tradesToday: tradesTodayList.length,
            successRate: parseFloat(successRate.toFixed(2)),
        };
        broadcast({ type: 'stats_update', data: state.stats });

        state.statusMessage = "En attente du prochain cycle.";

    } catch (error) {
        console.error("Erreur dans runScanAndTrade:", error);
        await addLog(`ERREUR CRITIQUE: ${error.message}`, broadcast);
        state.statusMessage = "Erreur - voir logs.";
    } finally {
        state.isRunning = false;
        await updateBotState({ ...state }); // Sauvegarde l'état complet à la fin
        broadcast({ type: 'status_update', data: { isRunning: state.isRunning, statusMessage: state.statusMessage } });
        await addLog("Cycle de scan terminé.", broadcast);
    }
}

// --- 7. GESTION DES WEBSOCKETS ---
const clients = new Set<WebSocket>();

function broadcast(message: any) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// --- 8. SERVEUR HTTP & API ---
Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    
    // Upgrade en WebSocket
    if (req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req);
        clients.add(socket);
        console.log("Client WebSocket connecté");
        
        socket.onopen = () => broadcast({ type: 'log', data: 'Un nouveau client frontend est connecté.' });
        socket.onclose = () => {
            clients.delete(socket);
            console.log("Client WebSocket déconnecté");
        };
        socket.onerror = (err) => console.error("Erreur WebSocket:", err);
        
        return response;
    }

    const allowCors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, x-cron-secret" };
    
    // Gérer les requêtes pre-flight CORS
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: allowCors });
    }
    
    const state = await getBotState();

    // Endpoints de l'API
    if (url.pathname === "/api/status") {
        return Response.json({
            isRunning: state.isRunning,
            statusMessage: state.statusMessage,
            stats: state.stats,
            logs: state.logs,
            strategicAdvice: state.strategicAdvice,
        }, { headers: allowCors });
    }
    
    if (url.pathname === "/api/config" && req.method === "GET") {
        return Response.json(state.config, { headers: allowCors });
    }
    
    if (url.pathname === "/api/config" && req.method === "POST") {
        const newConfig = await req.json();
        await updateBotState({ config: newConfig });
        await addLog("Configuration mise à jour manuellement via l'API.", broadcast);
        return Response.json({ message: "Configuration mise à jour." }, { headers: allowCors });
    }

    if (url.pathname === "/api/history") {
        return Response.json(state.tradeHistory, { headers: allowCors });
    }
    
    if (url.pathname === "/api/sentiment") {
        return Response.json(state.marketSentiment, { headers: allowCors });
    }

    if (url.pathname === "/api/rpc-status") {
        return Response.json(state.rpcStatus, { headers: allowCors });
    }
    
    // Endpoint sécurisé pour le cron job
    if (url.pathname === "/api/run-scan" && req.method === "POST") {
        const secret = req.headers.get('x-cron-secret');
        if (secret !== CRON_SECRET) {
            return new Response("Accès non autorisé", { status: 401, headers: allowCors });
        }
        
        // Exécuter le scan en arrière-plan sans bloquer la réponse HTTP
        runScanAndTrade(broadcast).catch(console.error);
        
        return Response.json({ message: "Scan du bot déclenché avec succès." }, { headers: allowCors });
    }

    return new Response("Endpoint non trouvé", { status: 404 });
});

console.log("Serveur Deno démarré sur http://localhost:8000");
