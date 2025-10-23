import React, { useState, useEffect } from 'react';
import type { UseArbitrageBot, BotConfig, TokenConfig, Strategy } from '../types';
import { AiInsightCard } from './AiInsightCard';

const MainnetWarning = () => (
    <div className="p-4 rounded-lg bg-orange-900/50 border border-orange-600 text-orange-200 animate-pulse">
        <h4 className="font-bold text-lg">DANGER: MAINNET IS ACTIVE</h4>
        <p className="text-sm mt-2">
            The bot is configured to run on the <strong>Polygon Mainnet</strong>. All actions, including trades, will use <strong>REAL FUNDS</strong> from your wallet. Double-check all configurations. Any losses will be irreversible.
        </p>
    </div>
);


export const Configuration: React.FC<{ bot: UseArbitrageBot }> = ({ bot }) => {
  const [localConfig, setLocalConfig] = useState<BotConfig>(bot.config);
  const [newToken, setNewToken] = useState({ symbol: '', minSpread: 0, dexs: '', chain: 'Polygon', strategy: 'flashloan-triangular' as Strategy, addresses: '' });
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
  
  const handleGeneralConfigChange = (field: keyof BotConfig | keyof BotConfig['flashLoan'], value: any) => {
    if (field in localConfig.flashLoan) {
        setLocalConfig(prev => ({ ...prev, flashLoan: { ...prev.flashLoan, [field]: value } }));
    } else {
        setLocalConfig(prev => ({ ...prev, [field]: value as any }));
    }
  }

  const handleTokenChange = (index: number, field: keyof TokenConfig | 'addresses', value: string) => {
    const updatedTokens = [...localConfig.tokens];
    const token = updatedTokens[index];

    if (field === 'dexs') {
        const dexsArray = value.split(',').map(d => d.trim());
        updatedTokens[index] = { ...token, dexs: dexsArray };
    } else if (field === 'minSpread') {
        updatedTokens[index] = { ...token, [field]: parseFloat(value) / 100 };
    } else if (field === 'addresses') {
        try {
            const parsedAddresses = JSON.parse(value);
            updatedTokens[index] = { ...token, addresses: parsedAddresses };
        } catch (e) { console.error("Invalid address JSON"); }
    }
    else {
        updatedTokens[index] = { ...token, [field]: value as any };
    }
    setLocalConfig(prev => ({ ...prev, tokens: updatedTokens }));
  };

  const handleRemoveToken = (index: number) => {
    const updatedTokens = localConfig.tokens.filter((_, i) => i !== index);
    setLocalConfig(prev => ({ ...prev, tokens: updatedTokens }));
  }

  const handleAddToken = () => {
    try {
        const dexsArray = newToken.dexs.split(',').map(d => d.trim());
        const addressesObj = JSON.parse(newToken.addresses);
        const tokenToAdd: TokenConfig = {
            symbol: newToken.symbol,
            minSpread: newToken.minSpread / 100,
            dexs: dexsArray,
            chain: newToken.chain,
            strategy: newToken.strategy,
            addresses: addressesObj
        };
        setLocalConfig(prev => ({...prev, tokens: [...prev.tokens, tokenToAdd]}));
        setNewToken({ symbol: '', minSpread: 0, dexs: '', chain: 'Polygon', strategy: 'flashloan-triangular', addresses: '' });
    } catch(e) {
        alert("Failed to add token. Ensure addresses are in valid JSON format.");
    }
  }
  
  const inputClasses = "mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-800 disabled:text-gray-400";
  const smallInputClasses = "bg-gray-600 border border-gray-500 rounded p-2 text-sm w-full disabled:bg-gray-700 disabled:text-gray-400";
  
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Token & Strategy Configuration</h2>
        <div className="flex items-center space-x-3">
            <span className={`text-sm font-medium ${manualOverride ? 'text-yellow-400' : 'text-gray-400'}`}>Manual Override</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={manualOverride} onChange={() => setManualOverride(!manualOverride)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
      </div>
      
      <MainnetWarning />
      <AiInsightCard advice={bot.strategicAdvice} />
      
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
            <h3 className="text-lg font-semibold">General Settings</h3>
             <div>
                <label htmlFor="pSuccessThreshold" className="block text-sm font-medium text-gray-300">P(Success) Threshold (%)</label>
                <input type="number" id="pSuccessThreshold" value={(localConfig.pSuccessThreshold * 100).toFixed(1)} onChange={(e) => handleGeneralConfigChange('pSuccessThreshold', parseFloat(e.target.value) / 100)} className={inputClasses} disabled={!manualOverride} />
                <p className="mt-2 text-xs text-gray-400">Bot auto-adjusts this. Override to set manually.</p>
            </div>
             <div>
                <label htmlFor="flashLoanFee" className="block text-sm font-medium text-gray-300">Flash Loan Fee (%)</label>
                <input type="number" id="flashLoanFee" value={(localConfig.flashLoan.fee * 100).toFixed(4)} onChange={(e) => handleGeneralConfigChange('fee', parseFloat(e.target.value) / 100)} className={inputClasses} disabled={!manualOverride} />
                <p className="mt-2 text-xs text-gray-400">Fee for the flash loan provider (e.g., Aave V3 is ~0.09%).</p>
            </div>
            <div>
                <label htmlFor="flashLoanContract" className="block text-sm font-medium text-gray-300">Flash Loan Contract Address</label>
                <input type="text" id="flashLoanContract" value={localConfig.flashLoan.contractAddress} className={inputClasses} disabled />
                <p className="mt-2 text-xs text-gray-400">The audited smart contract used for executing flash loans.</p>
            </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold">Monitored Tokens</h3>
        {localConfig.tokens.map((token, index) => (
            <div key={index} className="space-y-3 p-4 bg-gray-700/50 rounded-md">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                    <input type="text" value={token.symbol} onChange={(e) => handleTokenChange(index, 'symbol', e.target.value)} placeholder="Symbol" className={smallInputClasses} disabled={!manualOverride}/>
                    <input type="text" value={token.chain} onChange={(e) => handleTokenChange(index, 'chain', e.target.value)} placeholder="Chain" className={smallInputClasses} disabled={!manualOverride}/>
                    <select value={token.strategy} onChange={(e) => handleTokenChange(index, 'strategy', e.target.value)} className={smallInputClasses} disabled={!manualOverride}>
                        <option value="flashloan-triangular">Flashloan Triangular</option>
                        <option value="flashloan-pairwise-interdex">Flashloan Pairwise Inter-DEX</option>
                    </select>
                    <input type="number" value={token.minSpread * 100} onChange={(e) => handleTokenChange(index, 'minSpread', e.target.value)} placeholder="Min Spread %" className={smallInputClasses} disabled={!manualOverride}/>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <input type="text" value={token.dexs.join(', ')} onChange={(e) => handleTokenChange(index, 'dexs', e.target.value)} placeholder="DEXs (comma separated)" className={`${smallInputClasses} md:col-span-2`} disabled={!manualOverride}/>
                    <input type="text" value={JSON.stringify(token.addresses)} onChange={(e) => handleTokenChange(index, 'addresses', e.target.value)} placeholder='Addresses JSON: {"tokenA": "0x..."}' className={`${smallInputClasses} md:col-span-2`} disabled={!manualOverride}/>
                    <button onClick={() => handleRemoveToken(index)} className="text-red-500 hover:text-red-400 font-semibold text-sm disabled:text-gray-500 disabled:cursor-not-allowed" disabled={!manualOverride}>Remove</button>
                </div>
            </div>
        ))}
        
        {manualOverride && (
             <div className="space-y-3 p-4 border-t border-gray-700 pt-6">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                     <input type="text" value={newToken.symbol} onChange={(e) => setNewToken(p => ({...p, symbol: e.target.value}))} placeholder="Symbol" className={smallInputClasses}/>
                     <input type="text" value={newToken.chain} onChange={(e) => setNewToken(p => ({...p, chain: e.target.value}))} placeholder="Chain" className={smallInputClasses}/>
                      <select value={newToken.strategy} onChange={(e) => setNewToken(p => ({...p, strategy: e.target.value as Strategy}))} className={smallInputClasses}>
                        <option value="flashloan-triangular">Flashloan Triangular</option>
                        <option value="flashloan-pairwise-interdex">Flashloan Pairwise Inter-DEX</option>
                    </select>
                     <input type="number" value={newToken.minSpread} onChange={(e) => setNewToken(p => ({...p, minSpread: parseFloat(e.target.value)}))} placeholder="Min Spread %" className={smallInputClasses}/>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <input type="text" value={newToken.dexs} onChange={(e) => setNewToken(p => ({...p, dexs: e.target.value}))} placeholder="DEXs (comma separated)" className={`${smallInputClasses} md:col-span-2`}/>
                    <input type="text" value={newToken.addresses} onChange={(e) => setNewToken(p => ({...p, addresses: e.target.value}))} placeholder='Addresses JSON: {"tokenA": "0x..."}' className={`${smallInputClasses} md:col-span-2`}/>
                    <button onClick={handleAddToken} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm h-full">Add Token</button>
                </div>
            </div>
        )}
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
