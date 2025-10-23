import React from 'react';
import type { BotStatus, Sentiment } from '../types';

interface HeaderProps {
    botStatus: BotStatus;
    statusMessage: string;
    isKillSwitchActive: boolean;
    isSimulationMode: boolean;
    toggleSimulationMode: () => void;
    marketStats: { 
        gasPriceGwei: string; 
        volatility: string;
        sentiment: Sentiment;
        estimatedRpcRequestsPerDay: number;
    };
}

const SentimentIndicator: React.FC<{ sentiment: Sentiment }> = ({ sentiment }) => {
    const sentimentStyles = {
        bullish: { text: 'Bullish', color: 'text-green-400' },
        bearish: { text: 'Bearish', color: 'text-red-400' },
        neutral: { text: 'Neutral', color: 'text-yellow-400' },
    }
    const style = sentimentStyles[sentiment] || sentimentStyles.neutral;
    return <span className={`font-semibold capitalize ${style.color}`}>{style.text}</span>;
}

const RpcIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10m16-10v10M4 13h16m-16-6h16M4 7a2 2 0 012-2h12a2 2 0 012 2m-2 10a2 2 0 01-2 2H6a2 2 0 01-2-2" />
    </svg>
);


export const Header: React.FC<HeaderProps> = ({ botStatus, statusMessage, isKillSwitchActive, isSimulationMode, toggleSimulationMode, marketStats }) => {
    const statusColor = botStatus === 'running' ? 'bg-green-500' : 'bg-yellow-500';

    return (
        <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
            <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3" title="Toggle simulation mode. Trades will not execute on-chain.">
                    <span className={`text-sm font-medium ${isSimulationMode ? 'text-blue-400' : 'text-gray-400'}`}>Simulation Mode</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isSimulationMode} onChange={toggleSimulationMode} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
                 <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-400">Gas:</span>
                    <span className="font-semibold text-white">{marketStats.gasPriceGwei} Gwei</span>
                </div>
                 <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-400">Volatility:</span>
                    <span className="font-semibold text-white capitalize">{marketStats.volatility}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm" title="Estimated daily RPC requests. High usage may incur costs.">
                    <RpcIcon />
                    <span className="font-semibold text-white">~{(marketStats.estimatedRpcRequestsPerDay / 1000).toFixed(0)}k</span>
                </div>
                 <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-400">Sentiment:</span>
                    <SentimentIndicator sentiment={marketStats.sentiment} />
                </div>
                {isKillSwitchActive ? (
                     <div className="flex items-center space-x-3 px-4 py-2 rounded-lg bg-red-900 border border-red-600 animate-pulse">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-300">KILL SWITCH ACTIVE</span>
                    </div>
                ) : (
                    <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${statusColor} ${botStatus === 'running' ? 'animate-pulse' : ''}`}></div>
                        <span className="text-sm font-medium uppercase tracking-wider">{statusMessage}</span>
                    </div>
                )}
            </div>
        </header>
    );
};
