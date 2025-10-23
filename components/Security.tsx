import React, { useState, useEffect } from 'react';
import type { UseArbitrageBot, BotConfig, RpcStatus } from '../types';

const SecurityWarning = () => (
    <div className="p-4 rounded-lg bg-red-900/50 border border-red-700 text-red-300">
        <h4 className="font-bold">Security Best Practice: Key Management</h4>
        <p className="text-sm mt-2">
            This bot operates using a private key stored directly in the <strong>src/config.json</strong> file for demonstration purposes.
            Exposing this file publicly will result in the <strong>theft of all funds</strong>.
            For real funds, always use a secure key management solution like a hardware wallet or a cloud KMS, and never commit secrets to version control.
        </p>
    </div>
);

const SecurityInfoCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
     <div className="p-4 rounded-lg bg-gray-700/50 border border-gray-600 text-gray-300">
        <h4 className="font-bold text-blue-400">{title}</h4>
        <div className="text-sm mt-2 space-y-2">
            {children}
        </div>
    </div>
)

const RpcMonitor: React.FC<{ rpcStatus: RpcStatus[] }> = ({ rpcStatus }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">RPC Node Monitor</h3>
            <p className="text-xs text-gray-400 mb-4">The bot automatically uses the fastest available RPC and provides failover. Status is updated every minute.</p>
            <div className="space-y-3">
                {rpcStatus.map((rpc, index) => {
                    const statusColor = rpc.status === 'online' ? 'text-green-400' : 'text-red-400';
                    const latencyColor = rpc.latency && rpc.latency < 100 ? 'text-green-400' : rpc.latency && rpc.latency < 300 ? 'text-yellow-400' : 'text-red-400';

                    return (
                        <div key={index} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                            <div className="flex items-center space-x-3">
                                <span className={`font-bold capitalize ${statusColor}`}>
                                    {rpc.status}
                                </span>
                                <span className="text-sm font-mono text-gray-300 truncate">{rpc.url}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                {rpc.isActive && <span className="px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-full">ACTIVE</span>}
                                <span className={`text-sm font-semibold ${latencyColor}`}>
                                    {rpc.latency !== null ? `${rpc.latency} ms` : 'N/A'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


export const Security: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
  const [localConfig, setLocalConfig] = useState<BotConfig>(bot.config);
  const [manualOverride, setManualOverride] = useState(false);
  
  useEffect(() => {
    if (!manualOverride) {
      setLocalConfig(bot.config);
    }
  }, [bot.config, manualOverride]);

  const handleApplyOverride = () => {
    bot.updateConfig(localConfig);
    setManualOverride(false);
  };
  
  const handleRiskConfigChange = (field: keyof BotConfig['riskManagement'] | keyof BotConfig['riskManagement']['killSwitch'], value: any) => {
    setLocalConfig(prev => {
        const newRiskManagement = { ...prev.riskManagement };
        if (field in newRiskManagement.killSwitch) {
            (newRiskManagement.killSwitch as any)[field] = value;
        } else {
            (newRiskManagement as any)[field] = value;
        }
        return { ...prev, riskManagement: newRiskManagement };
    });
  }
  
  const inputClasses = "mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-800 disabled:text-gray-400";
  
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Security & Health</h2>
        <div className="flex items-center space-x-3">
            <span className={`text-sm font-medium ${manualOverride ? 'text-yellow-400' : 'text-gray-400'}`}>Manual Override</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={manualOverride} onChange={() => setManualOverride(!manualOverride)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
      </div>
      
      <SecurityWarning />
      
      <RpcMonitor rpcStatus={bot.rpcStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
             <h3 className="text-lg font-semibold">Risk Management</h3>
             <div>
                <label htmlFor="dailyLossThreshold" className="block text-sm font-medium text-gray-300">Daily Loss Threshold (%)</label>
                <input type="number" id="dailyLossThreshold" value={(localConfig.riskManagement.dailyLossThreshold * 100).toFixed(2)} onChange={(e) => handleRiskConfigChange('dailyLossThreshold', parseFloat(e.target.value) / 100)} className={inputClasses} disabled={!manualOverride} />
                <p className="mt-2 text-xs text-gray-400">Pause bot if daily PnL drops below this % of capital.</p>
            </div>
            <div>
                <label htmlFor="cooldownMinutes" className="block text-sm font-medium text-gray-300">Cooldown (Minutes)</label>
                <input type="number" id="cooldownMinutes" value={localConfig.riskManagement.cooldownMinutes} onChange={(e) => handleRiskConfigChange('cooldownMinutes', parseInt(e.target.value))} className={inputClasses} disabled={!manualOverride} />
                <p className="mt-2 text-xs text-gray-400">How long to pause after risk threshold is hit.</p>
            </div>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Capital Safety Kill-Switch</h3>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={localConfig.riskManagement.killSwitch.enabled} onChange={(e) => handleRiskConfigChange('enabled', e.target.checked)} className="sr-only peer" disabled={!manualOverride}/>
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
             <div>
                <label htmlFor="balanceThresholdEth" className="block text-sm font-medium text-gray-300">Balance Threshold (ETH)</label>
                <input type="number" id="balanceThresholdEth" value={localConfig.riskManagement.killSwitch.balanceThresholdEth} onChange={(e) => handleRiskConfigChange('balanceThresholdEth', parseFloat(e.target.value))} className={inputClasses} disabled={!manualOverride || !localConfig.riskManagement.killSwitch.enabled} />
                <p className="mt-2 text-xs text-gray-400">If wallet balance drops below this, bot will stop all activity.</p>
            </div>
             {bot.isKillSwitchActive && (
                 <div className="text-center p-4 rounded-md bg-red-900/70">
                    <p className="font-bold text-red-300">KILL SWITCH IS ACTIVE</p>
                    <p className="text-xs text-red-400 mt-1">Bot has been stopped due to safety triggers.</p>
                    <button onClick={bot.resetKillSwitch} className="mt-3 text-sm bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded">
                        Manually Reset Switch
                    </button>
                 </div>
            )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SecurityInfoCard title="Database Encryption">
            <p>For production systems, your SQLite database file should be encrypted at rest using a filesystem-level encryption like dm-crypt on Linux. This protects sensitive trade history data if the server is compromised.</p>
          </SecurityInfoCard>
          <SecurityInfoCard title="Least Privilege Principle">
            <p>Ensure the bot process runs under a dedicated, non-root user with limited permissions. The user should only have read/write access to its own directory and the log files. This minimizes the potential damage an attacker could cause if they exploit a vulnerability in the bot.</p>
          </SecurityInfoCard>
      </div>

      {manualOverride && (
          <div className="flex justify-end">
            <button onClick={handleApplyOverride} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                Apply Manual Override
            </button>
          </div>
      )}
    </div>
  );
};
