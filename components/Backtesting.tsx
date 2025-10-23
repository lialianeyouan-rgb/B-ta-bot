import React, { useMemo, useState } from 'react';
import type { UseArbitrageBot, Trade } from '../types';

interface StrategyStats {
  totalPnl: number;
  count: number;
  success: number;
}

type AnalysisMode = 'live' | 'simulation';

const StatCard: React.FC<{ title: string; value: string | number; className?: string }> = ({ title, value, className }) => (
  <div className={`bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-md ${className}`}>
    <h3 className="text-sm font-medium text-gray-400">{title}</h3>
    <p className="text-2xl font-semibold text-white mt-2">{value}</p>
  </div>
);

const TradeTable: React.FC<{ trades: Trade[] }> = ({ trades }) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Timestamp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Pair</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Strategy</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">DEXs</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">PnL (ETH)</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {trades.map(trade => (
                        <tr key={trade.id} className="hover:bg-gray-700/50">
                            <td className="px-6 py-4 text-sm text-gray-300">{new Date(trade.timestamp).toLocaleString()}</td>
                            <td className="px-6 py-4 text-sm font-medium text-white">{trade.opportunity.token.symbol}</td>
                            <td className="px-6 py-4 text-sm text-gray-300 capitalize">{trade.strategy}</td>
                            <td className="px-6 py-4 text-sm text-gray-300">{trade.opportunity.token.dexs.join(', ')}</td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    trade.status === 'success' ? 'bg-green-100 text-green-800' : 
                                    trade.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                    {trade.status}
                                </span>
                            </td>
                            <td className={`px-6 py-4 text-sm font-semibold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{trade.profit.toFixed(6)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}


export const Backtesting: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
  const [mode, setMode] = useState<AnalysisMode>('live');

  const filteredTrades = useMemo(() => {
    if (mode === 'live') {
      return bot.tradeHistory.filter(t => t.status === 'success' || t.status === 'failed');
    }
    return bot.tradeHistory.filter(t => t.status === 'simulated');
  }, [bot.tradeHistory, mode]);

  const analysis = useMemo(() => {
    const statsByStrategy: { [key: string]: StrategyStats } = {};
    const statsByDex: { [key: string]: StrategyStats } = {};

    for (const trade of filteredTrades) {
      // By Strategy
      if (!statsByStrategy[trade.strategy]) {
        statsByStrategy[trade.strategy] = { totalPnl: 0, count: 0, success: 0 };
      }
      statsByStrategy[trade.strategy].totalPnl += trade.profit;
      statsByStrategy[trade.strategy].count++;
      if (trade.status === 'success' || (mode === 'simulation' && trade.profit > 0)) { // count profit as 'success' in simulation
          statsByStrategy[trade.strategy].success++;
      }

      // By DEX
      for (const dex of trade.opportunity.token.dexs) {
        if (!statsByDex[dex]) {
          statsByDex[dex] = { totalPnl: 0, count: 0, success: 0 };
        }
        statsByDex[dex].totalPnl += trade.profit;
        statsByDex[dex].count++;
        if (trade.status === 'success' || (mode === 'simulation' && trade.profit > 0)) {
            statsByDex[dex].success++;
        }
      }
    }
    
    return { statsByStrategy, statsByDex };

  }, [filteredTrades, mode]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Strategy Performance Analysis</h2>
        <div className="flex items-center space-x-2 p-1 bg-gray-700 rounded-lg">
            <button onClick={() => setMode('live')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'live' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                Live Performance
            </button>
            <button onClick={() => setMode('simulation')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mode === 'simulation' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>
                Simulation Results
            </button>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Performance by Strategy ({mode})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* FIX: Use Object.keys to iterate and ensure proper typing for `stats`. Object.entries infers the value as `unknown` for objects with index signatures. */}
            {Object.keys(analysis.statsByStrategy).map((strategy) => {
                const stats = analysis.statsByStrategy[strategy];
                return (
                <div key={strategy} className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-2 col-span-1 md:col-span-2">
                    <h4 className="font-bold text-white capitalize">{strategy}</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-400">Total PnL</p>
                            <p className={`font-semibold text-lg ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.totalPnl.toFixed(4)} ETH</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Trades</p>
                            <p className="font-semibold text-lg text-white">{stats.count}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Success Rate</p>
                            <p className="font-semibold text-lg text-white">{stats.count > 0 ? ((stats.success/stats.count) * 100).toFixed(1) : 0}%</p>
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Performance by DEX ({mode})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* FIX: Use Object.keys to iterate and ensure proper typing for `stats`. Object.entries infers the value as `unknown` for objects with index signatures. */}
          {Object.keys(analysis.statsByDex).map((dex) => {
            const stats = analysis.statsByDex[dex];
            return (
            <StatCard
              key={dex}
              title={dex}
              value={`${stats.totalPnl.toFixed(4)} ETH`}
              className="border-blue-800"
            />
          )})}
        </div>
      </div>

       <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-300">Full Trade Log ({mode})</h3>
           {filteredTrades.length > 0 ? (
                <div className="bg-gray-800 rounded-lg border border-gray-700">
                    <TradeTable trades={filteredTrades} />
                </div>
            ) : (
                <div className="text-center py-10 bg-gray-800 rounded-lg border border-gray-700 text-gray-500">
                    No {mode} trades to display.
                </div>
            )}
       </div>
    </div>
  );
};