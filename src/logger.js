import fs from 'fs';
import path from 'path';

const logDirectory = path.join(process.cwd(), 'logs');
const logFilePath = path.join(logDirectory, 'bot.log');

// Assurer que le répertoire des logs existe
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

export class Logger {
    static log(message, level = 'INFO') {
        const logMessage = `[${new Date().toISOString()}] [${level}] ${message}\n`;
        try {
            fs.appendFileSync(logFilePath, logMessage);
            console.log(`[${level}] ${message}`); // Garder le logging console pour le développement
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    static getRecentLogs(lines = 200) {
        try {
            if (!fs.existsSync(logFilePath)) {
                return ['Log file not yet created.'];
            }
            const data = fs.readFileSync(logFilePath, 'utf8');
            const logLines = data.split('\n').filter(line => line.length > 0);
            
            return logLines.slice(-lines).map(line => {
                // Embellir le timestamp pour l'affichage sur le frontend
                const match = line.match(/\[(.*?)\] \[(.*?)\] (.*)/s);
                if (match && match[1] && match[2] && match[3]) {
                    const timestamp = new Date(match[1]).toLocaleTimeString();
                    const level = match[2];
                    const message = match[3];
                    return `[${timestamp}] [${level}] ${message}`;
                }
                return line;
            });
        } catch (error) {
            console.error('Failed to read log file:', error);
            return ['Error reading log file.'];
        }
    }
}
