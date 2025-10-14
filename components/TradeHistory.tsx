import React, { useState } from 'react';
import type { UseArbitrageBot, Trade } from '../types';

const getStatusBadge = (status: Trade['status']) => {
    switch (status) {
        case 'success':
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Success</span>;
        case 'failed':
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Failed</span>;
        case 'simulated':
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Simulated</span>;
        default:
            return null;
    }
}

export const TradeHistory: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleRowClick = (id: string) => {
      setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Trade History</h2>
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pair</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Strategy</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">PnL (ETH)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Size</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {bot.tradeHistory.map(trade => (
                <React.Fragment key={trade.id}>
                    <tr onClick={() => handleRowClick(trade.id)} className="hover:bg-gray-700/50 cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(trade.timestamp).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{trade.opportunity.token.symbol}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{trade.strategy}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(trade.status)}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.profit.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(trade.opportunity.spread * 100).toFixed(3)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trade.opportunity.optimalSize?.toFixed(4)}</td>
                    </tr>
                    {expandedRow === trade.id && (
                        <tr>
                            <td colSpan={7} className="px-6 py-4 bg-gray-900/50 space-y-3">
                                <div className="text-sm text-gray-300">
                                    <p className="font-semibold text-blue-400 mb-1">Gemini Post-Mortem:</p>
                                    <p>{trade.postMortem || 'No analysis available.'}</p>
                                </div>
                                 <div className="text-sm text-gray-300">
                                    <p className="font-semibold text-purple-400 mb-1">Vector Memory Analysis:</p>
                                    <p>{trade.similarPastTrades || 'No similar past trades found in memory.'}</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};