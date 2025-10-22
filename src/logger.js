import fs from 'fs';
import path from 'path';

const logDirectory = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDirectory, 'bot.log');

// Assurer que le répertoire des logs existe
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

export class Logger {
    static log(message) {
        const logMessage = `[${new Date().toISOString()}] ${message}\n`;
        try {
            fs.appendFileSync(logFilePath, logMessage);
            console.log(message); // Garder le logging console pour le développement
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    static getRecentLogs(lines = 100) {
        try {
            if (!fs.existsSync(logFilePath)) {
                return ['Log file not yet created.'];
            }
            const data = fs.readFileSync(logFilePath, 'utf8');
            const logLines = data.split('\n').filter(line => line.length > 0);
            
            return logLines.slice(-lines).map(line => {
                // Embellir le timestamp pour l'affichage sur le frontend
                const match = line.match(/\[(.*?)\] (.*)/);
                if (match && match[1] && match[2]) {
                    const timestamp = new Date(match[1]).toLocaleTimeString();
                    const message = match[2];
                    return `[${timestamp}] ${message}`;
                }
                return line;
            });
        } catch (error) {
            console.error('Failed to read log file:', error);
            return ['Error reading log file.'];
        }
    }
}