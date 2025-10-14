const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");

class FlashbotsExecutor {
  constructor(flashbotsProvider, wallet, provider) {
    this.flashbotsProvider = flashbotsProvider;
    this.wallet = wallet;
    this.provider = provider;
    console.log("Flashbots Executor initialized in REAL mode.");
  }
  
  /**
   * Creates and initializes a FlashbotsExecutor instance.
   * @param {ethers.Provider} provider The Ethers provider.
   * @param {ethers.Wallet} wallet The wallet to sign transactions.
   * @returns {Promise<FlashbotsExecutor>} A new instance of FlashbotsExecutor.
   */
  static async create(provider, wallet) {
    const network = await provider.getNetwork();
    
    // IMPORTANT: Flashbots is primarily for Ethereum Mainnet.
    // Using it on other networks might not work or require different relay URLs.
    // This chainID check is commented out for demonstration purposes on testnets/other chains.
    // if (network.chainId !== 1n) {
    //   throw new Error("Flashbots is officially supported on Ethereum Mainnet (ChainID 1).");
    // }
    
    // Using a random wallet for authentication is standard practice. It doesn't need funds.
    const authSigner = ethers.Wallet.createRandom();
    
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      "https://relay.flashbots.net",
      network.name
    );
    
    return new FlashbotsExecutor(flashbotsProvider, wallet, provider);
  }

  /**
   * Signs, simulates, and sends a transaction as a Flashbots bundle.
   * @param {ethers.TransactionRequest} transaction The transaction to bundle.
   * @returns {Promise<object>} The result of the bundle submission.
   */
  async sendBundle(transaction) {
    console.log("Attempting to send transaction via Flashbots bundle...");
    
    if (!this.flashbotsProvider) {
      throw new Error("Flashbots provider is not initialized.");
    }

    // 1. Sign the transaction
    const signedTx = await this.wallet.signTransaction(transaction);
    const bundle = [{ signedTransaction: signedTx }];
    const blockNumber = await this.provider.getBlockNumber();

    // 2. Simulate the bundle
    console.log(`Simulating Flashbots bundle for block ${blockNumber + 1}...`);
    try {
        const simulation = await this.flashbotsProvider.simulate(bundle, blockNumber + 1);
        if ('error' in simulation) {
            throw new Error(`Flashbots simulation error: ${simulation.error.message}`);
        }
        if (simulation.results[0].revert) {
            throw new Error(`Transaction will revert: ${simulation.results[0].revert}`);
        }
        console.log("Flashbots simulation successful.");
    } catch (e) {
        console.error(`Flashbots simulation failed: ${e.message}`);
        throw e; // Propagate error
    }
    
    // 3. Send the bundle to the relay for the next block
    const flashbotsResponse = await this.flashbotsProvider.sendRawBundle(bundle, blockNumber + 1);
    
    if ('error' in flashbotsResponse) {
      throw new Error(flashbotsResponse.error.message);
    }
    
    const txHash = flashbotsResponse.bundleTransactions[0].hash;
    console.log(`Flashbots bundle submitted. Awaiting inclusion... Tx Hash: ${txHash}`);
    
    // In a real app, you would use flashbotsResponse.wait() to see if the bundle was included.
    // For this implementation, we optimistically assume success upon submission.
    return {
      success: true,
      txHash: txHash,
      message: `Transaction sent via Flashbots bundle. Hash: ${txHash}`
    };
  }
}

module.exports = { FlashbotsExecutor };