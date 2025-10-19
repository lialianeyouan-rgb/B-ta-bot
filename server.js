// server.js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { ArbitrageBot } from './src/ArbitrageBot.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

function broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client WebSocket connecté');
    broadcast({ type: 'log', data: 'Un nouveau client frontend est connecté.' });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client WebSocket déconnecté');
    });

    ws.onerror = (err) => console.error("Erreur WebSocket:", err);
});

try {
    // Créer et initialiser le bot
    const bot = new ArbitrageBot(broadcast);

    // Endpoints de l'API
    app.get('/api/status', (req, res) => {
        res.json({
            isRunning: bot.isRunning,
            statusMessage: bot.statusMessage,
            stats: bot.stats,
            logs: bot.logs,
            strategicAdvice: bot.strategicAdvice,
        });
    });

    app.get('/api/config', (req, res) => {
        res.json(bot.config);
    });

    app.post('/api/config', (req, res) => {
        try {
            bot.updateConfig(req.body);
            res.json({ message: "Configuration mise à jour." });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update configuration.' });
        }
    });

    app.get('/api/history', (req, res) => {
        res.json(bot.tradeHistory);
    });

    app.get('/api/sentiment', (req, res) => {
        res.json(bot.marketSentiment);
    });

    app.get('/api/rpc-status', (req, res) => {
        res.json(bot.rpcStatus);
    });

    server.listen(PORT, () => {
        console.log(`Serveur Node.js démarré sur http://localhost:${PORT}`);
        // Démarrer le bot automatiquement au lancement du serveur
        bot.start();
    });

} catch (error) {
    console.error("ERREUR FATALE AU DÉMARRAGE :", error.message);
    process.exit(1);
}
