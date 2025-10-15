import React from 'react';
import type { BotStatus, Sentiment } from '../types';

interface HeaderProps {
    botStatus: BotStatus;
    statusMessage: string;
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


export const Header: React.FC<HeaderProps> = ({ botStatus, statusMessage, marketStats }) => {
    const statusColor = botStatus === 'running' ? 'bg-green-500' : 'bg-yellow-500';

    return (
        <header className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
            <div className="flex items-center space-x-6">
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
                    <span className="text-gray-400">RPC/day:</span>
                    <span className="font-semibold text-white">~{(marketStats.estimatedRpcRequestsPerDay / 1000).toFixed(0)}k</span>
                </div>
                 <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-400">Sentiment:</span>
                    <SentimentIndicator sentiment={marketStats.sentiment} />
                </div>
                <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${statusColor} ${botStatus === 'running' ? 'animate-pulse' : ''}`}></div>
                    <span className="text-sm font-medium uppercase tracking-wider">{statusMessage}</span>
                </div>
            </div>
        </header>
    );
};