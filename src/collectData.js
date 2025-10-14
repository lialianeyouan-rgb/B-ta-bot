const { ethers } = require('ethers');
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const IUniswapV2PairABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
];
const IUniswapV2FactoryABI = [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

// Simplified for demonstration. Real implementation would need more complex address management.
const DEX_CONFIG = {
    'QuickSwap': { factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32' },
    'Sushiswap': { factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4' }
};

const pairCache = new Map();

async function getPriceFromPair(pairAddress, provider) {
    if (!pairAddress || pairAddress === ethers.ZeroAddress) return null;
    try {
        const pairContract = new ethers.Contract(pairAddress, IUniswapV2PairABI, provider);
        const [reserves, token0] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0()
        ]);
        const { reserve0, reserve1 } = reserves;
        if (reserve0 === 0n || reserve1 === 0n) return null;
        // Price is always reserve1 / reserve0. The calling function must handle token order.
        return { price: Number(reserve1) / Number(reserve0), reserve0, reserve1, token0 };
    } catch(e) {
        return null;
    }
}

async function getOpportunities(config, provider) {
    let opportunities = [];

    // Pairwise Arbitrage
    for (const token of config.tokens.filter(t => t.strategy === 'pairwise')) {
        const [dex1Name, dex2Name] = token.dexs;
        const dex1 = DEX_CONFIG[dex1Name];
        const dex2 = DEX_CONFIG[dex2Name];
        if (!dex1 || !dex2) continue;

        const factory1 = new ethers.Contract(dex1.factory, IUniswapV2FactoryABI, provider);
        const factory2 = new ethers.Contract(dex2.factory, IUniswapV2FactoryABI, provider);
        
        const tokenA = token.addresses.tokenA;
        const tokenB = token.addresses.tokenB;

        const [pair1Addr, pair2Addr] = await Promise.all([
            factory1.getPair(tokenA, tokenB),
            factory2.getPair(tokenA, tokenB),
        ]);

        const [data1, data2] = await Promise.all([
             getPriceFromPair(pair1Addr, provider),
             getPriceFromPair(pair2Addr, provider)
        ]);
        
        if (!data1 || !data2) continue;

        const price1 = data1.token0.toLowerCase() === tokenA.toLowerCase() ? data1.price : 1 / data1.price;
        const price2 = data2.token0.toLowerCase() === tokenA.toLowerCase() ? data2.price : 1 / data2.price;
        
        const spread = Math.abs(price1 - price2) / Math.max(price1, price2);

        if (spread > token.minSpread) {
            opportunities.push({
                id: `${token.symbol}-${Date.now()}`,
                token: token,
                strategy: 'pairwise',
                spread: spread,
                liquidity: 1, // Placeholder
                timestamp: Date.now(),
            });
        }
    }
    
    // NOTE: Triangular Arbitrage logic is complex. This is a simplified placeholder.
    // A real implementation would need to check 3 pairs on a single DEX.
    for (const token of config.tokens.filter(t => t.strategy === 'triangular')) {
        if (Math.random() < 0.05) { // Simulate finding a rare triangular opportunity
             opportunities.push({
                id: `${token.symbol}-${Date.now()}`,
                token: token,
                strategy: 'triangular',
                spread: 0.01 + Math.random() * 0.01,
                liquidity: 1,
                timestamp: Date.now(),
            });
        }
    }

    return opportunities;
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


module.exports = { getOpportunities, getMarketContext, getSentimentAnalysis };