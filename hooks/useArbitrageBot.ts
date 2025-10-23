import { useState, useEffect, useRef, useCallback } from 'react';
import type { Opportunity, Trade, BotConfig, UseArbitrageBot, MarketSentiment, RpcStatus } from '../types';

const API_BASE_URL = 'http://localhost:3001';

const initialBotConfig: BotConfig = {
  tokens: [],
  pSuccessThreshold: 0,
  flashLoan: { provider: '', fee: 0, contractAddress: '' },
  riskManagement: { 
    dailyLossThreshold: 0.02, 
    cooldownMinutes: 60,
    killSwitch: { enabled: false, balanceThresholdEth: 0 }
  }
};

export const useArbitrageBot = (): UseArbitrageBot => {
  const [isRunning, setIsRunning] = useState(false);
  const [isKillSwitchActive, setIsKillSwitchActive] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting...');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<string[]>(['Connecting to bot backend...']);
  const [config, setConfig] = useState<BotConfig>(initialBotConfig);
  const [stats, setStats] = useState({ totalPnl: 0, tradesToday: 0, successRate: 0, gasPriceGwei: '0', volatility: 'low', estimatedRpcRequestsPerDay: 0 });
  const [strategicAdvice, setStrategicAdvice] = useState<string | null>(null);
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null);
  const [rpcStatus, setRpcStatus] = useState<RpcStatus[]>([]);

  const ws = useRef<WebSocket | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs(prev => [message, ...prev.slice(0, 199)]);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const [statusRes, configRes, historyRes, sentimentRes, rpcRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/status`),
                fetch(`${API_BASE_URL}/api/config`),
                fetch(`${API_BASE_URL}/api/history`),
                fetch(`${API_BASE_URL}/api/sentiment`),
                fetch(`${API_BASE_URL}/api/rpc-status`),
            ]);
            
            if (!statusRes.ok || !configRes.ok || !historyRes.ok || !sentimentRes.ok || !rpcRes.ok) {
                 throw new Error('Failed to fetch initial data from backend.');
            }

            const statusData = await statusRes.json();
            const configData = await configRes.json();
            const historyData = await historyRes.json();
            const sentimentData = await sentimentRes.json();
            const rpcData = await rpcRes.json();

            setIsRunning(statusData.isRunning);
            setIsKillSwitchActive(statusData.isKillSwitchActive);
            setIsSimulationMode(statusData.isSimulationMode);
            setStatusMessage(statusData.statusMessage);
            setStats(statusData.stats);
            setStrategicAdvice(statusData.strategicAdvice);
            setLogs(statusData.logs.reverse());
            setConfig(configData);
            setTradeHistory(historyData);
            setMarketSentiment(sentimentData);
            setRpcStatus(rpcData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Error connecting to backend: ${errorMessage}`);
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
          setTradeHistory(prev => [message.data, ...prev].slice(0, 200)); // Cap history size
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
        case 'rpc_status_update':
          setRpcStatus(message.data);
          break;
        case 'kill_switch_update':
          setIsKillSwitchActive(message.data);
          if (message.data === true) {
            addLog("CRITICAL: Kill switch has been activated by the backend!");
          }
          break;
        case 'simulation_mode_update':
          setIsSimulationMode(message.data);
          addLog(`Simulation mode is now ${message.data ? 'ON' : 'OFF'}.`);
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
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        addLog(`Error updating config: ${errorMessage}`);
    }
  }, [addLog]);
  
  const sendControlCommand = useCallback(async (action: string) => {
      try {
          await fetch(`${API_BASE_URL}/api/control`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action }),
          });
      } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          addLog(`Error sending control command '${action}': ${errorMessage}`);
      }
  }, [addLog]);

  const toggleSimulationMode = useCallback(() => {
    sendControlCommand('toggleSimulation');
  }, [sendControlCommand]);

  const resetKillSwitch = useCallback(() => {
    sendControlCommand('resetKillSwitch');
  }, [sendControlCommand]);

  return { isRunning, statusMessage, opportunities, tradeHistory, logs, config, stats, strategicAdvice, updateConfig, marketSentiment, rpcStatus, isKillSwitchActive, isSimulationMode, toggleSimulationMode, resetKillSwitch };
};
