require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { ArbitrageBot } = require('./src/ArbitrageBot');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;
const server = http.createServer(app);

// WebSocket Server Setup
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Frontend client connected');
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Frontend client disconnected');
  });
  ws.on('error', console.error);
});

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

// Instantiate and start the bot automatically
const bot = new ArbitrageBot(broadcast);
bot.start();

// API Endpoints
app.get('/api/status', (req, res) => {
  res.json({
    isRunning: bot.isRunning,
    statusMessage: bot.statusMessage,
    stats: bot.getStats(),
    logs: bot.getLogs(),
    strategicAdvice: bot.strategicAdvice,
  });
});

app.post('/api/start', (req, res) => {
  bot.start();
  res.json({ message: 'Bot started successfully.' });
});

app.post('/api/stop', (req, res) => {
  bot.stop();
  res.json({ message: 'Bot stopped successfully.' });
});

app.get('/api/config', (req, res) => {
    res.json(bot.getConfig());
});

app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  if (!newConfig) {
    return res.status(400).json({ error: 'No config provided.' });
  }
  bot.updateConfig(newConfig, true); // Mark as manual override
  res.json({ message: 'Configuration updated.' });
});

app.get('/api/history', (req, res) => {
    res.json(bot.getTradeHistory());
});

app.get('/api/sentiment', (req, res) => {
    res.json(bot.getMarketSentiment());
});

app.post('/api/backtest', async (req, res) => {
    const { startDate, endDate, config } = req.body;
    if (!startDate || !endDate || !config) {
        return res.status(400).json({ message: 'Missing parameters for backtest.' });
    }
    try {
        const results = await bot.runBacktest(startDate, endDate, config);
        res.json(results);
    } catch(e) {
        res.status(500).json({ message: e.message });
    }
});


server.listen(port, () => {
  console.log(`Arbitrage Bot backend running on http://localhost:${port}`);
});