import React, { useMemo } from 'react';
import type { UseArbitrageBot, Trade } from '../types';

// Fix: Define an interface for the performance stats object to ensure type safety.
interface StrategyStats {
  totalPnl: number;
  count: number;
  success: number;
}

const StatCard: React.FC<{ title: string; value: string | number; className?: string }> = ({ title, value, className }) => (
  <div className={`bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-md ${className}`}>
    <h3 className="text-sm font-medium text-gray-400">{title}</h3>
    <p className="text-2xl font-semibold text-white mt-2">{value}</p>
  </div>
);

const TradeTable: React.FC<{ trades: Trade[] }> = ({ trades }) => {
    // Basic table for now, can be expanded with filtering/sorting
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
                            <td className="px-6 py-4 text-sm text-gray-300">{trade.strategy}</td>
                            <td className="px-6 py-4 text-sm text-gray-300">{trade.opportunity.token.dexs.join(', ')}</td>
                            <td className="px-6 py-4 text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${trade.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
  const completedTrades = useMemo(() => bot.tradeHistory.filter(t => t.status !== 'simulated'), [bot.tradeHistory]);

  const analysis = useMemo(() => {
    const statsByStrategy: { [key: string]: StrategyStats } = {};
    const statsByDex: { [key: string]: StrategyStats } = {};

    for (const trade of completedTrades) {
      // By Strategy
      if (!statsByStrategy[trade.strategy]) {
        statsByStrategy[trade.strategy] = { totalPnl: 0, count: 0, success: 0 };
      }
      statsByStrategy[trade.strategy].totalPnl += trade.profit;
      statsByStrategy[trade.strategy].count++;
      if (trade.status === 'success') statsByStrategy[trade.strategy].success++;

      // By DEX
      for (const dex of trade.opportunity.token.dexs) {
        if (!statsByDex[dex]) {
          statsByDex[dex] = { totalPnl: 0, count: 0, success: 0 };
        }
        // NOTE: This attributes the full PnL to each DEX in the path.
        // A more complex model could divide it, but this shows involvement.
        statsByDex[dex].totalPnl += trade.profit;
        statsByDex[dex].count++;
        if (trade.status === 'success') statsByDex[dex].success++;
      }
    }
    
    return { statsByStrategy, statsByDex };

  }, [completedTrades]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Strategy Performance Analysis</h2>
      
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Performance by Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(analysis.statsByStrategy).map(([strategy, stats]) => {
                // Fix: Cast the `stats` object, which is inferred as `unknown` by Object.entries, to the correct type.
                const typedStats = stats as StrategyStats;
                return (
                <div key={strategy} className="bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-2 col-span-1 md:col-span-2">
                    <h4 className="font-bold text-white capitalize">{strategy}</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-400">Total PnL</p>
                            <p className={`font-semibold text-lg ${typedStats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{typedStats.totalPnl.toFixed(4)} ETH</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Trades</p>
                            <p className="font-semibold text-lg text-white">{typedStats.count}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Success Rate</p>
                            <p className="font-semibold text-lg text-white">{typedStats.count > 0 ? ((typedStats.success/typedStats.count) * 100).toFixed(1) : 0}%</p>
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Performance by DEX</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(analysis.statsByDex).map(([dex, stats]) => {
            // Fix: Cast the `stats` object to ensure type safety.
            const typedStats = stats as StrategyStats;
            return (
            <StatCard
              key={dex}
              title={dex}
              value={`${typedStats.totalPnl.toFixed(4)} ETH`}
              className="border-blue-800"
            />
          )})}
        </div>
      </div>

       <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-300">Full Trade Log</h3>
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <TradeTable trades={completedTrades} />
          </div>
       </div>
    </div>
  );
};
