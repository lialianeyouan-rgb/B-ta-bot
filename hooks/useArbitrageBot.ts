import { useState, useEffect, useRef, useCallback } from 'react';
import type { Opportunity, Trade, BotConfig, UseArbitrageBot, MarketSentiment, BacktestResult } from '../types';

const API_BASE_URL = 'http://localhost:3001';

export const useArbitrageBot = (): UseArbitrageBot => {
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting...');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<string[]>(['Connecting to bot backend...']);
  const [config, setConfig] = useState<BotConfig>({ tokens: [], pSuccessThreshold: 0, riskManagement: { dailyLossThreshold: 0.02, cooldownMinutes: 60 } });
  const [stats, setStats] = useState({ totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low' });
  const [strategicAdvice, setStrategicAdvice] = useState<string | null>(null);
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null);
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  const ws = useRef<WebSocket | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 99)]);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const [statusRes, configRes, historyRes, sentimentRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/status`),
                fetch(`${API_BASE_URL}/api/config`),
                fetch(`${API_BASE_URL}/api/history`),
                fetch(`${API_BASE_URL}/api/sentiment`),
            ]);
            
            if (!statusRes.ok || !configRes.ok || !historyRes.ok || !sentimentRes.ok) {
                 throw new Error('Failed to fetch initial data from backend.');
            }

            const statusData = await statusRes.json();
            const configData = await configRes.json();
            const historyData = await historyRes.json();
            const sentimentData = await sentimentRes.json();

            setIsRunning(statusData.isRunning);
            setStatusMessage(statusData.statusMessage);
            setStats(statusData.stats);
            setStrategicAdvice(statusData.strategicAdvice);
            setLogs(statusData.logs.reverse());
            setConfig(configData);
            setTradeHistory(historyData);
            setMarketSentiment(sentimentData);
        } catch (error) {
            addLog(`Error connecting to backend: ${error.message}`);
            console.error(error);
        }
    };
    fetchInitialData();
    
    ws.current = new WebSocket('ws://localhost:3001');
    ws.current.onopen = () => addLog('WebSocket connection established.');
    ws.current.onclose = () => addLog('WebSocket connection closed.');
    ws.current.onerror = (err) => addLog(`WebSocket error: ${err.toString()}`);

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'log':
          addLog(message.data);
          break;
        case 'stats_update':
          setStats(message.data);
          break;
        case 'status_update':
          setIsRunning(message.data.isRunning);
          setStatusMessage(message.data.statusMessage);
          break;
        case 'opportunities_update':
          setOpportunities(message.data);
          break;
        case 'history_update':
          setTradeHistory(prev => [message.data, ...prev]);
          break;
        case 'config_update':
          setConfig(message.data);
          addLog("Bot configuration has been auto-adjusted by Gemini.");
          break;
        case 'strategic_advice':
          setStrategicAdvice(message.data);
          break;
        case 'sentiment_update':
          setMarketSentiment(message.data);
          break;
        case 'risk_triggered':
            addLog(`RISK MANAGEMENT TRIGGERED: ${message.data}`);
            setStatusMessage(`Paused - Risk Limit Hit`);
            break;
        default:
          break;
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [addLog]);

  const updateConfig = useCallback(async (newConfig: BotConfig) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig),
        });
        if (response.ok) {
            setConfig(newConfig);
            addLog('Manual configuration override applied.');
        } else {
            addLog('Failed to save configuration override.');
        }
    } catch(err) {
        addLog(`Error updating config: ${err.message}`);
    }
  }, [addLog]);

  const runBacktest = useCallback(async (startDate: string, endDate: string) => {
    setIsBacktesting(true);
    setBacktestResults(null);
    addLog(`Starting backtest from ${startDate} to ${endDate}...`);
    try {
        const response = await fetch(`${API_BASE_URL}/api/backtest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, config }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Backtest failed on the server.');
        }
        const results = await response.json();
        setBacktestResults(results);
        addLog('Backtest completed successfully.');
    } catch (err) {
        addLog(`Backtest error: ${err.message}`);
    } finally {
        setIsBacktesting(false);
    }
  }, [addLog, config]);

  return { isRunning, statusMessage, opportunities, tradeHistory, logs, config, stats, strategicAdvice, updateConfig, marketSentiment, backtestResults, isBacktesting, runBacktest };
};