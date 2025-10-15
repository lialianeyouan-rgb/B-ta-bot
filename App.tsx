import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Configuration } from './components/Configuration';
import { TradeHistory } from './components/TradeHistory';
import { Logs } from './components/Logs';
import { useArbitrageBot } from './hooks/useArbitrageBot';
import type { View } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const bot = useArbitrageBot();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard bot={bot} />;
      case 'configuration':
        return <Configuration bot={bot} />;
      case 'history':
        return <TradeHistory bot={bot} />;
      case 'logs':
        return <Logs logs={bot.logs} />;
      default:
        return <Dashboard bot={bot} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          botStatus={bot.isRunning ? 'running' : 'stopped'} 
          statusMessage={bot.statusMessage} 
          marketStats={{ 
            gasPriceGwei: bot.stats.gasPriceGwei, 
            volatility: bot.stats.volatility,
            sentiment: bot.marketSentiment?.overall || 'neutral'
          }} 
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-900 p-4 md:p-8">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
