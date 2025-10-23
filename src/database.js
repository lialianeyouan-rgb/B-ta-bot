import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class Database {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });
        console.log('Connected to the SQLite database.');
        await this.initSchema();
    }

    async initSchema() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                opportunity TEXT NOT NULL,
                strategy TEXT NOT NULL,
                status TEXT NOT NULL,
                profit REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                txHash TEXT,
                postMortem TEXT
            );
        `);
        await this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);');
        console.log('Database schema and indexes initialized.');
    }

    async addTrade(trade) {
        const { id, opportunity, strategy, status, profit, timestamp, txHash, postMortem } = trade;
        await this.db.run(
            `INSERT INTO trades (id, opportunity, strategy, status, profit, timestamp, txHash, postMortem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            JSON.stringify(opportunity), // Stocker l'objet complexe en tant que chaîne JSON
            strategy,
            status,
            profit,
            timestamp,
            txHash,
            postMortem
        );
    }

    async getTrades(options = {}) {
        const { limit, offset = 0 } = options;
        let query = 'SELECT * FROM trades ORDER BY timestamp DESC';
        const params = [];

        if (limit) {
            query += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);
        }

        const rows = await this.db.all(query, ...params);
        return rows.map(row => ({
            ...row,
            opportunity: JSON.parse(row.opportunity) // Reconvertir la chaîne JSON en objet
        }));
    }
    
    async getStats() {
        const liveTradesFilter = "WHERE status <> 'simulated'";

        const result = await this.db.get(`
            SELECT
                SUM(profit) as totalPnl,
                COUNT(*) as totalTrades
            FROM trades
            ${liveTradesFilter}
        `);

        const tradesTodayResult = await this.db.get(`
            SELECT COUNT(*) as count
            FROM trades
            WHERE timestamp >= ? AND status <> 'simulated'
        `, new Date().setHours(0, 0, 0, 0));

        const successfulTradesResult = await this.db.get(`
            SELECT COUNT(*) as count
            FROM trades
            WHERE status = 'success'
        `);
        
        const totalTrades = result.totalTrades || 0;
        const successCount = successfulTradesResult.count || 0;
        const successRate = totalTrades > 0 ? (successCount / totalTrades) * 100 : 0;

        return {
            totalPnl: result.totalPnl || 0,
            tradesToday: tradesTodayResult.count || 0,
            successRate: parseFloat(successRate.toFixed(2)),
        };
    }
}
