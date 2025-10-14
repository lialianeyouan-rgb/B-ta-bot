import React, { useState } from 'react';
import type { UseArbitrageBot, BacktestResult } from '../types';
import PnlChart from './PnlChart';

const BacktestResults: React.FC<{ results: BacktestResult }> = ({ results }) => (
    <div className="space-y-6 mt-8">
        <h3 className="text-xl font-bold">Backtest Results</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400">Total P&L</h4>
                <p className={`text-2xl font-semibold ${results.summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {results.summary.totalPnl.toFixed(5)} ETH
                </p>
            </div>
             <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400">Total Trades</h4>
                <p className="text-2xl font-semibold text-white">{results.summary.totalTrades}</p>
            </div>
             <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400">Success Rate</h4>
                <p className="text-2xl font-semibold text-white">{results.summary.successRate.toFixed(2)}%</p>
            </div>
        </div>
        <div>
            <h4 className="text-lg font-semibold mb-4">Performance Chart</h4>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-96">
                <PnlChart trades={results.trades} />
            </div>
        </div>
         <div>
            <h4 className="text-lg font-semibold mb-4">Simulated Trades</h4>
             <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Pair</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Strategy</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Profit</th>
                        </tr>
                    </thead>
                     <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {results.trades.map(trade => (
                             <tr key={trade.id}>
                                <td className="px-6 py-4 text-sm text-gray-300">{new Date(trade.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm font-medium text-white">{trade.opportunity.token.symbol}</td>
                                <td className="px-6 py-4 text-sm text-gray-300 capitalize">{trade.strategy}</td>
                                <td className={`px-6 py-4 text-sm font-semibold ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{trade.profit.toFixed(5)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
);


export const Backtesting: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleRunBacktest = () => {
        if (startDate && endDate) {
            bot.runBacktest(startDate, endDate);
        } else {
            alert('Please select a start and end date.');
        }
    };

    const inputClasses = "block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold">Strategy Backtesting</h2>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                 <p className="text-sm text-gray-400">
                    Test the bot's current configuration against historical simulated data. 
                    This helps validate strategies and AI parameters without risking real assets.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-300">Start Date</label>
                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClasses}/>
                    </div>
                     <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-300">End Date</label>
                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClasses}/>
                    </div>
                    <button 
                        onClick={handleRunBacktest} 
                        disabled={bot.isBacktesting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {bot.isBacktesting ? 'Running Simulation...' : 'Run Backtest'}
                    </button>
                </div>
            </div>

            {bot.isBacktesting && (
                <div className="text-center py-8">
                    <p className="text-lg font-semibold animate-pulse">Simulating historical market data...</p>
                </div>
            )}

            {bot.backtestResults && <BacktestResults results={bot.backtestResults} />}
        </div>
    );
};
