const { ethers } = require('ethers');
const { GoogleGenAI, Type } = require('@google/genai');
const appConfig = require('./config'); // Use the new config file

const ai = new GoogleGenAI({ apiKey: appConfig.geminiApiKey });

const IUniswapV2PairABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
];
const IUniswapV2FactoryABI = [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

// Assuming common 18 decimals for formatting. A production system would fetch decimals for each token.
const WETH_ADDRESS = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619".toLowerCase();
const WMATIC_ADDRESS = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270".toLowerCase();


const DEX_CONFIG = {
    'QuickSwap': { factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' },
    'Sushiswap': { factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506' },
    'DFYN': { factory: '0xEb6330c2d584E523c2325c3451B42551e6eb5324', router: '0xA102072A4C07F06EC3B4900FDC4C7B80b6c57429' },
    'ApeSwap': { factory: '0xCf083Be4164828F00Cae704EC15a36D711491284', router: '0xC0788A3aD43d79aa53541c3223E44293D76b3258' },
    // NOTE: DODO uses a Proactive Market Maker (PMM) model, which is not a Uniswap V2 fork.
    // Integrating DODO would require a custom data collection logic and different ABIs.
    // 'DODO': { factory: '...', router: '...' } 
};

// --- Caching Implementation to Reduce RPC Calls ---

/**
 * Creates a standardized cache key for a token pair, independent of order.
 * @param {string} tokenA Address of token A.
 * @param {string} tokenB Address of token B.
 * @returns {string} A sorted, hyphen-separated key.
 */
const getSortedPairKey = (tokenA, tokenB) => {
    return [tokenA.toLowerCase(), tokenB.toLowerCase()].sort().join('-');
};

/**
 * Fetches a pair address from a factory, using a cache to avoid redundant calls.
 * @param {ethers.Contract} factory The Uniswap V2 factory contract instance.
 * @param {string} tokenA Address of token A.
 * @param {string} tokenB Address of token B.
 * @param {Map<string, string>} cache The cache for pair addresses.
 * @returns {Promise<string>} The address of the pair contract.
 */
const getPairAddress = async (factory, tokenA, tokenB, cache) => {
    const key = `${factory.target}-${getSortedPairKey(tokenA, tokenB)}`;
    if (cache.has(key)) {
        return cache.get(key);
    }
    try {
        const address = await factory.getPair(tokenA, tokenB);
        cache.set(key, address);
        return address;
    } catch (e) {
        console.error(`Could not get pair for ${tokenA}-${tokenB}: ${e.message}`);
        return ethers.ZeroAddress;
    }
};

/**
 * Fetches reserves and token addresses for a pair, using a cache to avoid redundant calls.
 * @param {string} pairAddress The address of the pair contract.
 * @param {ethers.Provider} provider The Ethers provider.
 * @param {Map<string, object>} pairDataCache The cache for pair data.
 * @returns {Promise<object|null>} The pair data or null if fetching fails.
 */
async function getPriceFromPair(pairAddress, provider, pairDataCache) {
    if (!pairAddress || pairAddress === ethers.ZeroAddress) return null;
    
    // Check cache first
    if (pairDataCache.has(pairAddress)) {
        return pairDataCache.get(pairAddress);
    }
    try {
        const pairContract = new ethers.Contract(pairAddress, IUniswapV2PairABI, provider);
        const [[reserve0, reserve1], token0, token1] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0(),
            pairContract.token1()
        ]);
        if (reserve0 === 0n || reserve1 === 0n) return null;

        const pairData = { reserve0, reserve1, token0Address: token0, token1Address: token1 };
        // Store in cache for this scan cycle
        pairDataCache.set(pairAddress, pairData);
        return pairData;
    } catch (e) {
        // This can be noisy if a pair doesn't exist, so we don't log the error by default.
        // console.error(`Could not fetch price from pair ${pairAddress}: ${e.message}`);
        return null;
    }
}
// --- End Caching Implementation ---


function getLiquidityString(pairData, tokenA_addr, tokenB_addr) {
    let reserveA, reserveB;
    if (pairData.token0Address.toLowerCase() === tokenA_addr.toLowerCase()) {
        reserveA = pairData.reserve0;
        reserveB = pairData.reserve1;
    } else {
        reserveA = pairData.reserve1;
        reserveB = pairData.reserve0;
    }
    
    // Prioritize showing WETH or WMATIC reserve as they are more common base pairs
    if (tokenA_addr.toLowerCase() === WETH_ADDRESS || tokenA_addr.toLowerCase() === WMATIC_ADDRESS) {
        return `${parseFloat(ethers.formatUnits(reserveA, 18)).toFixed(2)} ${tokenA_addr.toLowerCase() === WETH_ADDRESS ? 'WETH' : 'WMATIC'}`;
    }
    if (tokenB_addr.toLowerCase() === WETH_ADDRESS || tokenB_addr.toLowerCase() === WMATIC_ADDRESS) {
        return `${parseFloat(ethers.formatUnits(reserveB, 18)).toFixed(2)} ${tokenB_addr.toLowerCase() === WETH_ADDRESS ? 'WETH' : 'WMATIC'}`;
    }

    // Fallback
    return `${ethers.formatUnits(reserveA, 18)} / ${ethers.formatUnits(reserveB, 18)}`;
}


async function getTriangularOpportunities(token, provider, pairAddressCache, pairDataCache) {
    const [dexName] = token.dexs;
    const dex = DEX_CONFIG[dexName];
    if (!dex) return null;
    
    const factory = new ethers.Contract(dex.factory, IUniswapV2FactoryABI, provider);
    const { tokenA, tokenB, tokenC } = token.addresses;

    const [pairAB_addr, pairBC_addr, pairCA_addr] = await Promise.all([
        getPairAddress(factory, tokenA, tokenB, pairAddressCache),
        getPairAddress(factory, tokenB, tokenC, pairAddressCache),
        getPairAddress(factory, tokenC, tokenA, pairAddressCache)
    ]);

    const [pairAB_data, pairBC_data, pairCA_data] = await Promise.all([
        getPriceFromPair(pairAB_addr, provider, pairDataCache),
        getPriceFromPair(pairBC_addr, provider, pairDataCache),
        getPriceFromPair(pairCA_addr, provider, pairDataCache),
    ]);
    
    if (!pairAB_data || !pairBC_data || !pairCA_data) return null;

    const priceAB = pairAB_data.token0Address.toLowerCase() === tokenA.toLowerCase() ? Number(pairAB_data.reserve1) / Number(pairAB_data.reserve0) : Number(pairAB_data.reserve0) / Number(pairAB_data.reserve1);
    const priceBC = pairBC_data.token0Address.toLowerCase() === tokenB.toLowerCase() ? Number(pairBC_data.reserve1) / Number(pairBC_data.reserve0) : Number(pairBC_data.reserve0) / Number(pairBC_data.reserve1);
    const priceCA = pairCA_data.token0Address.toLowerCase() === tokenC.toLowerCase() ? Number(pairCA_data.reserve1) / Number(pairCA_data.reserve0) : Number(pairCA_data.reserve0) / Number(pairCA_data.reserve1);

    // Formula: (1 / priceAB) * (1 / priceBC) * priceCA should be > 1 for profit
    const arbitrageRatio = (1 / priceAB) * (1 / priceBC) * priceCA;
    const spread = Math.abs(1 - arbitrageRatio);
    
    const liquidity = getLiquidityString(pairAB_data, tokenA, tokenB);

    if (arbitrageRatio > (1 + token.minSpread)) {
         return {
            id: `${token.symbol}-${Date.now()}`,
            token: token,
            strategy: token.strategy,
            spread: spread,
            liquidity: liquidity,
            timestamp: Date.now(),
        };
    }
    return null;
}

async function getPairwiseInterDEXOpportunities(token, provider, pairAddressCache, pairDataCache) {
    const [dex1Name, dex2Name] = token.dexs;
    const dex1 = DEX_CONFIG[dex1Name];
    const dex2 = DEX_CONFIG[dex2Name];
    if (!dex1 || !dex2) return null;

    const factory1 = new ethers.Contract(dex1.factory, IUniswapV2FactoryABI, provider);
    const factory2 = new ethers.Contract(dex2.factory, IUniswapV2FactoryABI, provider);

    const { tokenA, tokenB } = token.addresses;

    const [pair1_addr, pair2_addr] = await Promise.all([
        getPairAddress(factory1, tokenA, tokenB, pairAddressCache),
        getPairAddress(factory2, tokenA, tokenB, pairAddressCache)
    ]);

    const [pair1_data, pair2_data] = await Promise.all([
        getPriceFromPair(pair1_addr, provider, pairDataCache),
        getPriceFromPair(pair2_addr, provider, pairDataCache)
    ]);
    
    if (!pair1_data || !pair2_data) return null;
    
    const price1 = pair1_data.token0Address.toLowerCase() === tokenA.toLowerCase() ? Number(pair1_data.reserve1) / Number(pair1_data.reserve0) : Number(pair1_data.reserve0) / Number(pair1_data.reserve1);
    const price2 = pair2_data.token0Address.toLowerCase() === tokenA.toLowerCase() ? Number(pair2_data.reserve1) / Number(pair2_data.reserve0) : Number(pair2_data.reserve0) / Number(pair2_data.reserve1);
    
    const spread = Math.abs(price2 - price1) / Math.min(price1, price2);
    
    const liquidity = `${dex1Name}: ${getLiquidityString(pair1_data, tokenA, tokenB)} | ${dex2Name}: ${getLiquidityString(pair2_data, tokenA, tokenB)}`;

    if (spread > token.minSpread) {
        // We need to determine which way the arbitrage goes (buy on DEX1 sell on DEX2, or vice versa)
        // For simplicity, we create one opportunity and the executor/analyzer will know the path.
        // A more advanced version would create two potential trades.
        return {
            id: `${token.symbol}-${Date.now()}`,
            token: token,
            strategy: token.strategy,
            spread: spread,
            liquidity: liquidity,
            timestamp: Date.now(),
        };
    }
    return null;
}


async function getOpportunities(config, provider) {
    // Caches are scoped to a single run of getOpportunities to ensure data is fresh.
    const pairAddressCache = new Map();
    const pairDataCache = new Map();

    const promises = config.tokens.map(token => {
        switch (token.strategy) {
            case 'flashloan-triangular':
                return getTriangularOpportunities(token, provider, pairAddressCache, pairDataCache);
            case 'flashloan-pairwise-interdex':
                return getPairwiseInterDEXOpportunities(token, provider, pairAddressCache, pairDataCache);
            default:
                return null;
        }
    });
    const results = await Promise.all(promises);
    return results.filter(Boolean); // Filter out nulls
}


async function getMarketContext(provider) {
    try {
        const feeData = await provider.getFeeData();
        const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');
        
        const block = await provider.getBlock('latest');
        const gasRatio = Number(block.gasUsed) / Number(block.gasLimit);
        let volatility = 'low';
        if (gasRatio > 0.8) volatility = 'high';
        else if (gasRatio > 0.6) volatility = 'moderate';

        return {
            gasPriceGwei: parseFloat(gasPriceGwei).toFixed(2),
            volatility: volatility,
        };
    } catch (error) {
        console.error("Failed to fetch market context:", error);
        return { gasPriceGwei: '50', volatility: 'unknown' };
    }
}

async function getSentimentAnalysis(tokens) {
    const model = "gemini-2.5-flash";
    const prompt = `
        Based on simulated general market news, provide a sentiment analysis for the following crypto tokens:
        ${tokens.map(t => t.symbol).join(', ')}.
        
        Also provide an 'overall' market sentiment.
        Possible sentiments are: bullish, bearish, neutral.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            overall: { type: Type.STRING },
            tokens: {
                type: Type.OBJECT,
                properties: tokens.reduce((acc, token) => {
                    acc[token.symbol] = { type: Type.STRING };
                    return acc;
                }, {})
            }
        },
        required: ['overall', 'tokens']
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Error fetching sentiment from Gemini:", e);
        return { overall: 'neutral', tokens: {} };
    }
}


module.exports = { getOpportunities, getMarketContext, getSentimentAnalysis, DEX_CONFIG };