// This file is responsible for executing the trade on the blockchain.
// This is a REAL implementation that will spend funds.
import { ethers } from "ethers";

// #############################################################################
// # CRITICAL: ACTION REQUIRED                                                 #
// #############################################################################
// # To execute flash loan arbitrage, you need your own smart contract deployed
// # on Polygon. This script calls that contract.
// #
// # 1. Write and deploy your arbitrage contract.
// # 2. Paste the contract's address below.
// # 3. Paste the contract's ABI below.
// #############################################################################

const ARBITRAGE_CONTRACT_ADDRESS = "0x...YOUR_ARBITRAGE_CONTRACT_ADDRESS"; // <-- PASTE YOUR CONTRACT ADDRESS HERE

const ARBITRAGE_CONTRACT_ABI = [
    // This is an EXAMPLE ABI. Your contract's function will be different.
    // It should accept the loan amount and the path of tokens to trade.
    "function executeArbitrage(address loanToken, uint256 loanAmount, address[] memory tradePath) external"
];

/**
 * Executes a real trade on-chain by calling a dedicated arbitrage smart contract.
 * @param {Opportunity} opportunity - The opportunity to execute.
 * @param {ethers.Wallet} wallet - The wallet to send the transaction from.
 * @param {FlashbotsExecutor | null} flashbotsExecutor - The Flashbots provider instance.
 * @returns {Promise<{success: boolean, txHash: string | null, profit: number, postMortem: string}>}
 */
export async function executeTransaction(opportunity, wallet, flashbotsExecutor) {
    if (!ARBITRAGE_CONTRACT_ADDRESS || ARBITRAGE_CONTRACT_ADDRESS.startsWith("0x...")) {
        throw new Error("Arbitrage contract address is not set in src/transactionExecutor.js");
    }

    const arbitrageContract = new ethers.Contract(ARBITRAGE_CONTRACT_ADDRESS, ARBITRAGE_CONTRACT_ABI, wallet);

    try {
        console.log(`Preparing real transaction for ${opportunity.token.symbol} with loan ${opportunity.loanAmount.toFixed(4)} ETH.`);
        
        // --- Prepare the smart contract call ---
        // This is an example. You must adapt this to your contract's function signature.
        const loanTokenAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"; // WETH on Polygon for flash loan
        const loanAmountWei = ethers.utils.parseEther(opportunity.loanAmount.toString());
        // Example trade path: TokenA -> TokenB -> TokenA
        const tradePath = [
            opportunity.token.addresses.tokenA, 
            opportunity.token.addresses.tokenB, 
            opportunity.token.addresses.tokenA
        ];

        // --- Build the transaction ---
        const txRequest = await arbitrageContract.populateTransaction.executeArbitrage(
            loanTokenAddress,
            loanAmountWei,
            tradePath
        );

        // Add gas details
        txRequest.gasPrice = await wallet.provider.getGasPrice();
        txRequest.gasLimit = await arbitrageContract.estimateGas.executeArbitrage(
            loanTokenAddress, 
            loanAmountWei, 
            tradePath
        );
        
        let txHash;
        let postMortem;
        
        if (opportunity.useFlashbots && flashbotsExecutor) {
            console.log("Attempting execution via Flashbots...");
            const bundleResult = await flashbotsExecutor.sendBundle(txRequest);
            txHash = bundleResult.txHash;
            postMortem = "Transaction sent privately via Flashbots to mitigate front-running. Waiting for inclusion.";
        } else {
            console.log("Attempting execution via public mempool...");
            const txResponse = await wallet.sendTransaction(txRequest);
            txHash = txResponse.hash;
            postMortem = "Transaction sent to public mempool. Waiting for confirmation.";
        }
        
        console.log(`Transaction sent. Hash: ${txHash}`);
        
        // NOTE: In a production bot, you would now wait for the transaction receipt
        // and parse the event logs to determine the *actual* profit.
        // For this implementation, we optimistically return 0 profit and let the user
        // track the outcome on-chain. The database will reflect the PnL later
        // once an external process updates it.
        
        return {
            success: true, // Indicates the transaction was successfully broadcasted
            txHash: txHash,
            profit: 0, // Actual profit is unknown until transaction is mined
            postMortem,
        };

    } catch (error) {
        console.error("On-chain execution failed:", error);
        return {
            success: false,
            txHash: null,
            profit: 0, // You might lose gas on a failed transaction
            postMortem: `Execution failed before sending: ${error.message}`,
        };
    }
}