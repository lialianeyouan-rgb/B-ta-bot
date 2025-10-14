export type Strategy = 'pairwise' | 'triangular';
export type Sentiment = 'bullish' | 'bearish' | 'neutral';

export interface TokenConfig {
  symbol: string;
  minSpread: number;
  dexs: string[]; // Can be 2 for pairwise, 3 for triangular
  chain: string;
  strategy: Strategy;
  addresses: { [key: string]: string }; // e.g., tokenA, tokenB, tokenC
}

export interface BotConfig {
  tokens: TokenConfig[];
  pSuccessThreshold: number;
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
  liquidity: number;
  pSuccess?: number;
  optimalSize?: number;
  rationale?: string;
  useFlashbots?: boolean;
  timestamp: number;
}

export interface Trade {
    id: string;
    opportunity: Opportunity;
    strategy: Strategy;
    status: 'success' | 'failed' | 'simulated';
    profit: number;
    timestamp: number;
    postMortem?: string; // Gemini's post-trade analysis
    similarPastTrades?: string; // Analysis from vector memory
}

export type BotStatus = 'running' | 'stopped' | 'error' | 'paused';

export type View = 'dashboard' | 'configuration' | 'history' | 'backtesting';

export interface BacktestResult {
    summary: {
        totalPnl: number;
        totalTrades: number;
        successRate: number;
        startDate: string;
        endDate: string;
    };
    trades: Trade[];
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
    stats: {
        totalPnl: number;
        tradesToday: number;
        successRate: number;
        gasPriceGwei: string;
        volatility: string;
    };
    backtestResults: BacktestResult | null;
    isBacktesting: boolean;
    updateConfig: (newConfig: BotConfig) => void;
    runBacktest: (startDate: string, endDate: string) => Promise<void>;
}