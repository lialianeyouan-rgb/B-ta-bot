import React from 'react';
import type { View } from '../types';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.25278C12 6.25278 6.75 4.5 3.75 4.5C3.75 4.5 3.75 14.25 3.75 15.75C3.75 17.25 4.5 19.5 8.25 19.5C12 19.5 12.75 17.25 12.75 15.75C12.75 14.25 12.75 6.25278 12.75 6.25278" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.25278C12 6.25278 17.25 4.5 20.25 4.5C20.25 4.5 20.25 14.25 20.25 15.75C20.25 17.25 19.5 19.5 15.75 19.5C12 19.5 11.25 17.25 11.25 15.75C11.25 14.25 11.25 6.25278 11.25 6.25278" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9.75L12 12L9 9.75" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12V15" />
  </svg>
);

const DashboardIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M4 4h16v4H4zM4 18h16v-2H4z" />
    </svg>
);

const HistoryIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LogsIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
);


const SettingsIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-all duration-200 ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </button>
  );
};


export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  return (
    <div className="w-64 bg-gray-800 p-4 flex flex-col space-y-4 border-r border-gray-700">
      <div className="flex items-center space-x-3 p-2 mb-6">
        <BotIcon />
        <h1 className="text-xl font-bold text-white">Arbitrage Bot</h1>
      </div>
      
      <nav className="flex flex-col space-y-2">
        <NavItem icon={<DashboardIcon />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
        <NavItem icon={<HistoryIcon />} label="Trade History" isActive={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <NavItem icon={<LogsIcon />} label="Live Logs" isActive={currentView === 'logs'} onClick={() => setCurrentView('logs')} />
        <NavItem icon={<SettingsIcon />} label="Configuration" isActive={currentView === 'configuration'} onClick={() => setCurrentView('configuration')} />
      </nav>
      
      <div className="mt-auto p-2 text-center text-xs text-gray-500">
        <p>Gemini Arbitrage Engine v2.1</p>
        <p>&copy; 2024</p>
      </div>
    </div>
  );
};
