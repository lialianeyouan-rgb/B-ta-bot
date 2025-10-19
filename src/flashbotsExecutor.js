import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";

/**
 * Handles the creation and submission of transaction bundles to Flashbots.
 */
export class FlashbotsExecutor {
  constructor(flashbotsProvider, wallet, provider) {
    this.flashbotsProvider = flashbotsProvider;
    this.wallet = wallet;
    this.provider = provider;
  }

  /**
   * Creates an instance of the FlashbotsExecutor.
   * @param {ethers.Provider} provider - The standard Ethers provider.
   * @param {ethers.Wallet} wallet - The wallet for signing transactions.
   * @returns {Promise<FlashbotsExecutor | null>}
   */
  static async create(provider, wallet) {
    try {
        const authSigner = ethers.Wallet.createRandom();
        // Using Polygon mainnet relay for this example
        const flashbotsProvider = await FlashbotsBundleProvider.create(
            provider,
            authSigner,
            "https://relay-polygon.flashbots.net",
            "matic"
        );
        return new FlashbotsExecutor(flashbotsProvider, wallet, provider);
    } catch (e) {
        console.warn(`Could not initialize Flashbots: ${e.message}.`);
        return null;
    }
  }

  /**
   * Simulates and sends a bundle of transactions to Flashbots.
   * @param {ethers.TransactionRequest} transaction - The transaction to include in the bundle.
   * @returns {Promise<{success: boolean, txHash: string}>}
   */
  async sendBundle(transaction) {
    const signedTx = await this.wallet.signTransaction(transaction);
    const bundle = [{ signedTransaction: signedTx }];
    const blockNumber = await this.provider.getBlockNumber();

    console.log("Simulating Flashbots bundle for block:", blockNumber + 1);
    const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber + 1);
    
    if ('error' in simulation || (simulation.results && simulation.results[0].revert)) {
        const revertReason = simulation.results ? simulation.results[0].revert : "Unknown";
        throw new Error(`Flashbots simulation failed: ${simulation.error?.message || revertReason}`);
    }
    console.log("Flashbots simulation successful.");

    console.log("Sending Flashbots bundle...");
    const flashbotsResponse = await this.flashbotsProvider.sendRawBundle(bundle, blockNumber + 1);
    
    if ('error' in flashbotsResponse) {
        throw new Error(`Flashbots submission error: ${flashbotsResponse.error.message}`);
    }
    
    const txHash = flashbotsResponse.bundleTransactions[0].hash;
    console.log(`Bundle submitted, tx hash: ${txHash}`);
    
    // It's good practice to wait for the transaction to be included
    // await flashbotsResponse.wait();
    
    return { success: true, txHash };
  }
}
