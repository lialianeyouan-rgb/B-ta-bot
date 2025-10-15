const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");

class FlashbotsExecutor {
  constructor(flashbotsProvider, wallet, provider) {
    this.flashbotsProvider = flashbotsProvider;
    this.wallet = wallet;
    this.provider = provider;
  }
  
  /**
   * Creates and initializes a FlashbotsExecutor instance.
   * @param {ethers.Provider} provider The Ethers provider.
   * @param {ethers.Wallet} wallet The wallet to sign transactions.
   * @returns {Promise<FlashbotsExecutor>} A new instance of FlashbotsExecutor.
   */
  static async create(provider, wallet) {
    const network = await provider.getNetwork();
    
    // Using a random wallet for authentication is standard practice. It doesn't need funds.
    const authSigner = ethers.Wallet.createRandom();
    
    // Note: Flashbots has different relay URLs for different networks.
    // For Polygon, use the "matic" network name and a compatible relay.
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      "https://rpc.flashbots.net", // Correct relay for Polygon Mainnet
      "matic" // Correct network name for Polygon
    );
    
    return new FlashbotsExecutor(flashbotsProvider, wallet, provider);
  }

  /**
   * Signs, simulates, and sends a transaction as a Flashbots bundle.
   * @param {ethers.TransactionRequest} transaction The transaction to bundle.
   * @returns {Promise<object>} The result of the bundle submission.
   */
  async sendBundle(transaction) {
    if (!this.flashbotsProvider) {
      throw new Error("Flashbots provider is not initialized.");
    }

    const signedTx = await this.wallet.signTransaction(transaction);
    const bundle = [{ signedTransaction: signedTx }];
    const blockNumber = await this.provider.getBlockNumber();

    try {
        const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber + 1);
        if ('error' in simulation || simulation.results[0].revert) {
            const reason = simulation.results[0]?.revert || simulation.error?.message;
            throw new Error(`Flashbots simulation failed: ${reason}`);
        }
    } catch (e) {
        console.error(`Flashbots simulation failed: ${e.message}`);
        throw e;
    }
    
    const flashbotsResponse = await this.flashbotsProvider.sendRawBundle(bundle, blockNumber + 1);
    
    if ('error' in flashbotsResponse) {
      throw new Error(flashbotsResponse.error.message);
    }
    
    const txHash = flashbotsResponse.bundleTransactions[0].hash;
    
    // Return the hash and wait for it in the main loop
    return {
      success: true,
      txHash: txHash,
    };
  }
}

module.exports = { FlashbotsExecutor };