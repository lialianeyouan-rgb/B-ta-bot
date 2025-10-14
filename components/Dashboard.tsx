import React, { useState } from 'react';
import type { UseArbitrageBot, Opportunity, TokenConfig, Sentiment } from '../types';
import { AiInsightCard } from './AiInsightCard';
import PnlChart from './PnlChart';

const StatCard: React.FC<{ title: string; value: string | number; change?: string }> = ({ title, value, change }) => (
  <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-md">
    <h3 className="text-sm font-medium text-gray-400">{title}</h3>
    <div className="flex items-baseline space-x-2 mt-2">
        <p className="text-2xl font-semibold text-white">{value}</p>
        {change && <p className="text-sm text-green-400">{change}</p>}
    </div>
  </div>
);

const SentimentStatus: React.FC<{ tokens: TokenConfig[], sentimentData: { [symbol: string]: Sentiment } | undefined }> = ({ tokens, sentimentData }) => (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-md col-span-1 md:col-span-3">
        <h3 className="text-lg font-semibold text-white mb-4">Token Sentiment Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tokens.map(token => {
                const sentiment = sentimentData?.[token.symbol] || 'neutral';
                const colors = {
                    bullish: 'border-green-500 bg-green-500/10 text-green-400',
                    bearish: 'border-red-500 bg-red-500/10 text-red-400',
                    neutral: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
                };
                return (
                    <div key={token.symbol} className={`p-3 rounded-lg border text-center ${colors[sentiment]}`}>
                        <p className="font-bold text-sm text-white">{token.symbol}</p>
                        <p className="font-semibold text-xs capitalize">{sentiment}</p>
                    </div>
                );
            })}
        </div>
    </div>
);


const OpportunitiesTable: React.FC<{ opportunities: Opportunity[] }> = ({ opportunities }) => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const handleRowClick = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pair</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Strategy</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">P(Success)</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Optimal Size</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">DEXs</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Execution</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {opportunities.map(opp => (
                        <React.Fragment key={opp.id}>
                            <tr onClick={() => handleRowClick(opp.id)} className="hover:bg-gray-700/50 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{opp.token.symbol}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{opp.strategy}</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${opp.spread > opp.token.minSpread ? 'text-green-400' : 'text-gray-300'}`}>{(opp.spread * 100).toFixed(3)}%</td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm ${opp.pSuccess && opp.pSuccess > 0.6 ? 'text-green-400' : 'text-yellow-400'}`}>{(opp.pSuccess ? opp.pSuccess * 100 : 0).toFixed(2)}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{opp.optimalSize?.toFixed(4)} ETH</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{opp.token.dexs.join(' -> ')}</td>
                                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                    {opp.useFlashbots ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-200 text-purple-800">Flashbots</span>
                                     ) : (
                                        <span className="text-gray-400">Standard</span>
                                     )}
                                </td>
                            </tr>
                            {expandedRow === opp.id && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 bg-gray-900/50">
                                        <div className="text-sm text-gray-300">
                                            <span className="font-semibold text-blue-400">Gemini Rationale:</span> {opp.rationale || 'No analysis provided.'}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const LogsPanel: React.FC<{ logs: string[] }> = ({ logs }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-64 overflow-y-auto flex flex-col-reverse">
        <div className="font-mono text-xs text-gray-400 space-y-1">
            {logs.map((log, i) => <p key={i}>{log}</p>)}
        </div>
    </div>
);

export const Dashboard: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total P&L" value={`${bot.stats.totalPnl.toFixed(4)} ETH`} />
                <StatCard title="Trades Today" value={bot.stats.tradesToday} />
                <StatCard title="Success Rate" value={`${bot.stats.successRate}%`} />
                <AiInsightCard advice={bot.strategicAdvice} className="col-span-1 md:col-span-2 lg:col-span-3" />
                {bot.config.tokens.length > 0 && bot.marketSentiment && <SentimentStatus tokens={bot.config.tokens} sentimentData={bot.marketSentiment.tokens} />}
            </div>
            
            <div>
                <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-96 flex items-center justify-center">
                    <PnlChart trades={bot.tradeHistory} />
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-4">Live Opportunities</h3>
                    <div className="bg-gray-800 rounded-lg border border-gray-700">
                        <OpportunitiesTable opportunities={bot.opportunities} />
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4">Live Logs</h3>
                    <LogsPanel logs={bot.logs} />
                </div>
            </div>
        </div>
    );
};