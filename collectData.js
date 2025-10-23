// This file finds REAL arbitrage opportunities by scanning DEX pairs on-chain.
import { ethers } from "ethers";

// A minimalist ABI for a Uniswap V2-style pair contract.
const pairABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
];

/**
 * Calculates the price from reserves.
 * Note: This is a simplified calculation. A production bot would need to handle token decimals precisely.
 */
function getPrice(reserveA, reserveB) {
    if (reserveA.isZero() || reserveB.isZero()) return 0;
    return reserveB.div(reserveA);
}

export async function collectData(config, provider) {
    const opportunities = [];
    
    for (const tokenConfig of config.tokens) {
        if (tokenConfig.strategy !== 'flashloan-pairwise-interdex' || tokenConfig.dexs.length !== 2) {
            // This real-time scanner currently only supports pairwise inter-dex strategies.
            // Triangular arbitrage requires more complex path finding.
            continue;
        }

        try {
            const [dexA, dexB] = tokenConfig.dexs;
            const pairAddressA = tokenConfig.pairAddresses[dexA];
            const pairAddressB = tokenConfig.pairAddresses[dexB];
            
            if (!pairAddressA || !pairAddressB) continue;

            const contractA = new ethers.Contract(pairAddressA, pairABI, provider);
            const contractB = new ethers.Contract(pairAddressB, pairABI, provider);
            
            const [reservesA, reservesB] = await Promise.all([
                contractA.getReserves(),
                contractB.getReserves()
            ]);

            // Assuming tokenA is reserve0 and tokenB is reserve1 for simplicity.
            // A robust implementation needs to check token0() and token1() addresses.
            const priceA = getPrice(reservesA.reserve0, reservesA.reserve1);
            const priceB = getPrice(reservesB.reserve0, reservesB.reserve1);

            if (priceA === 0 || priceB === 0) continue;

            const spread = (priceA.gt(priceB))
                ? (priceA.sub(priceB)).div(priceB)
                : (priceB.sub(priceA)).div(priceA);
            
            const spreadFloat = parseFloat(ethers.utils.formatEther(spread));

            if (spreadFloat > tokenConfig.minSpread) {
                 const opportunity = {
                    id: `opp-${Date.now()}-${tokenConfig.symbol}`,
                    token: tokenConfig,
                    strategy: tokenConfig.strategy,
                    spread: spreadFloat,
                    // Real liquidity is complex to calculate; using reserves as a proxy.
                    liquidity: `${ethers.utils.formatEther(reservesA.reserve0)} / ${ethers.utils.formatEther(reservesB.reserve0)}`,
                    timestamp: Date.now(),
                    // Propose a loan amount based on configured capital.
                    loanAmount: config.riskManagement.capitalEth || 1.0, 
                };
                opportunities.push(opportunity);
            }

        } catch (error) {
            console.error(`Error collecting data for ${tokenConfig.symbol}: ${error.message}`);
        }
    }
    
    return opportunities;
}