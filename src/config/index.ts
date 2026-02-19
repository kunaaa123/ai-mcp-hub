import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const config: AppConfig = {
  port: parseInt(optional('PORT', '4000')),
  nodeEnv: optional('NODE_ENV', 'development'),
  productionSafeMode: optional('PRODUCTION_SAFE_MODE', 'false') === 'true',

  database: {
    type: 'mysql',
    host: optional('DB_HOST', 'localhost'),
    port: parseInt(optional('DB_PORT', '3306')),
    user: optional('DB_USER', 'root'),
    password: optional('DB_PASSWORD', ''),
    database: optional('DB_NAME', 'mcp_hub'),
  },

  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379')),
    password: process.env['REDIS_PASSWORD'],
    db: parseInt(optional('REDIS_DB', '0')),
  },

  ollama: {
    baseUrl: optional('OLLAMA_BASE_URL', 'http://localhost:11434'),
    model: optional('OLLAMA_MODEL', 'llama3.1'),
    temperature: parseFloat(optional('OLLAMA_TEMPERATURE', '0.1')),
    contextLength: parseInt(optional('OLLAMA_CONTEXT_LENGTH', '4096')),
    timeout: parseInt(optional('OLLAMA_TIMEOUT', '60000')),
  },
};

export default config;
