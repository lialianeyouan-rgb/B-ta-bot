// This file handles programmatic and environment-based configuration.
// It complements the static configuration from config.json.
import 'dotenv/config';

/**
 * Retrieves the Gemini API key from environment variables.
 * @returns {string | undefined} The Gemini API key.
 */
export const getGeminiApiKey = () => {
    return process.env.GEMINI_API_KEY;
};