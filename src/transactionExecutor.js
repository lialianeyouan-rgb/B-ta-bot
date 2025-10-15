const { ethers } = require('ethers');
const { DEX_CONFIG } = require('./collectData');

// --- IMPORTANT SAFETY NOTICE ---
// This file executes REAL transactions on the blockchain.
// It is NOT A SIMULATION. A bug or misconfiguration can lead to a
// total and irreversible loss of funds.
//
// FLASH LOAN WARNING: Real flash loan arbitrage requires a custom, highly-optimized,
// and multiple-times-audited smart contract. The functions called in this script
// are ASSUMED to exist on your contract. If they don't, transactions will fail,
// but you will still pay gas fees. A bug in your contract could be exploited
// and lead to a 100% loss of funds.
//
// --- PROCEED WITH EXTREME CAUTION ---

const FLASH_LOAN_ABI = [
    "function executeFlashLoanTriangular(address tokenA, address tokenB, address tokenC, address dex, uint256 loanAmount)",
    "function executeFlashLoanPairwiseInterDEX(address tokenA, address tokenB, address dex1, address dex2, uint256 loanAmount)"
];


async function executeArbitrage(wallet, provider, trade, config, flashbotsExecutor) {
    const { gasPrice } = (await provider.getFeeData());
    const flashLoanContract = new ethers.Contract(config.flashLoan.contractAddress, FLASH_LOAN_ABI, wallet);
    const loanAmountWei = ethers.parseEther(trade.loanAmount.toString());

    try {
        let estimatedGas;
        let populatedTx;

        if (trade.strategy === 'flashloan-triangular') {
            const dexRouter = DEX_CONFIG[trade.token.dexs[0]].router;
            const args = [
                trade.token.addresses.tokenA,
                trade.token.addresses.tokenB,
                trade.token.addresses.tokenC,
                dexRouter,
                loanAmountWei
            ];
            estimatedGas = await flashLoanContract.executeFlashLoanTriangular.estimateGas(...args);
            populatedTx = await flashLoanContract.executeFlashLoanTriangular.populateTransaction(...args);
        } else if (trade.strategy === 'flashloan-pairwise-interdex') {
            const dex1Router = DEX_CONFIG[trade.token.dexs[0]].router;
            const dex2Router = DEX_CONFIG[trade.token.dexs[1]].router;
             const args = [
                trade.token.addresses.tokenA,
                trade.token.addresses.tokenB,
                dex1Router,
                dex2Router,
                loanAmountWei
            ];
            estimatedGas = await flashLoanContract.executeFlashLoanPairwiseInterDEX.estimateGas(...args);
            populatedTx = await flashLoanContract.executeFlashLoanPairwiseInterDEX.populateTransaction(...args);
        } else {
            throw new Error(`Unsupported strategy for execution: ${trade.strategy}`);
        }
        
        // Add a 20% buffer to the estimated gas for safety
        const gasLimit = (estimatedGas * 120n) / 100n;

        const tx = {
            ...populatedTx,
            gasPrice,
            gasLimit,
            chainId: (await provider.getNetwork()).chainId,
            nonce: await provider.getTransactionCount(wallet.address)
        };


        let txResponse;
        let txHash;

        if (trade.useFlashbots && flashbotsExecutor) {
            const bundleResponse = await flashbotsExecutor.sendBundle(tx);
            // Flashbots response doesn't give a standard ethers response object,
            // so we wait for the transaction hash it provides.
            txHash = bundleResponse.txHash;
        } else {
            const signedTx = await wallet.signTransaction(tx);
            txResponse = await provider.broadcastTransaction(signedTx);
            txHash = txResponse.hash;
        }

        console.log(`Transaction sent. Hash: ${txHash}. Waiting for receipt...`);
        const receipt = await provider.waitForTransaction(txHash);

        if (receipt.status === 1) {
            // Transaction succeeded. Calculate profit.
            const gasUsed = receipt.gasUsed;
            const gasCost = parseFloat(ethers.formatEther(gasUsed * receipt.gasPrice));
            let grossProfit = trade.loanAmount * (trade.spread - config.flashLoan.fee);
            
            return {
                success: true,
                profit: grossProfit - gasCost,
                txHash: receipt.hash,
                message: `SUCCESS: Trade executed on-chain.`
            };
        } else {
            // Transaction failed (reverted).
            const gasUsed = receipt.gasUsed;
            const gasCost = parseFloat(ethers.formatEther(gasUsed * receipt.gasPrice));
            return {
                success: false,
                profit: -gasCost,
                txHash: receipt.hash,
                message: `FAILED: Transaction reverted on-chain.`
            };
        }

    } catch (e) {
        console.error("Error during transaction execution:", e);
        // Calculate gas cost if a transaction was actually sent and failed before receipt
        if (e.receipt) {
             const gasCost = parseFloat(ethers.formatEther(e.receipt.gasUsed * e.receipt.gasPrice));
             return { success: false, profit: -gasCost, txHash: e.receipt.hash, message: `Execution error: ${e.message}` };
        }
        return { success: false, profit: 0, txHash: null, message: `Execution error: ${e.message}` };
    }
}

module.exports = { executeArbitrage };