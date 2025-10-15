export type Strategy = 'flashloan-triangular' | 'flashloan-pairwise-interdex';
export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface TokenConfig {
  symbol: string;
  minSpread: number;
  dexs: string[]; // Can be 1 for triangular, 2 for pairwise-interdex
  chain: string;
  strategy: Strategy;
  addresses: { [key: string]: string }; // e.g., tokenA, tokenB, tokenC
}

export interface BotConfig {
  tokens: TokenConfig[];
  pSuccessThreshold: number;
  flashLoan: {
      provider: string;
      fee: number; // e.g., 0.0009 for 0.09%
      contractAddress: string;
  };
  riskManagement: {
      dailyLossThreshold: number; // as a percentage, e.g., 0.02 for 2%
      cooldownMinutes: number;
  };
}

export interface MarketSentiment {
    overall: Sentiment;
    tokens: { [symbol: string]: Sentiment };
}

export interface Opportunity {
  id: string;
  token: TokenConfig;
  strategy: Strategy;
  spread: number;
  liquidity: string; // Changed from number to string to hold descriptive liquidity info
  pSuccess?: number;
  optimalSize?: number; // For classic arbitrage
  loanAmount?: number; // For flash loan arbitrage
  rationale?: string;
  useFlashbots?: boolean;
  timestamp: number;
  similarPastTrades?: string;
}

export interface Trade {
    id: string;
    opportunity: Opportunity;
    strategy: Strategy;
    status: 'success' | 'failed' | 'simulated';
    profit: number;
    timestamp: number;
    postMortem?: string; // Gemini's post-trade analysis
    txHash?: string;
}

export type BotStatus = 'running' | 'stopped' | 'error' | 'paused';

export type View = 'dashboard' | 'configuration' | 'history' | 'logs' | 'backtesting';

export interface RpcStatus {
    url: string;
    latency: number | null;
    status: 'online' | 'offline' | 'pending';
    isActive: boolean;
}

export interface UseArbitrageBot {
    isRunning: boolean;
    statusMessage: string;
    opportunities: Opportunity[];
    tradeHistory: Trade[];
    logs: string[];
    config: BotConfig;
    strategicAdvice: string | null;
    marketSentiment: MarketSentiment | null;
    rpcStatus: RpcStatus[];
    stats: {
        totalPnl: number;
        tradesToday: number;
        successRate: number;
        gasPriceGwei: string;
        volatility: string;
    };
    updateConfig: (newConfig: BotConfig) => void;
}