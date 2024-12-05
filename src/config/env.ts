import dotenv from 'dotenv';

// Load environment variables from a .env file into process.env
dotenv.config();

export const config = {
  WSS_URL: process.env.WSS_URL, // WebSocket URL for connecting to the server
  SECRET: process.env.SECRET, // Secret key for authentication or encryption
  DEBUG: process.env.DEBUG, // Debug flag for logging or development
  AMOUNT_XRP: process.env.AMOUNT_XRP, // Amount of XRP (Ripple cryptocurrency) to handle
  HTTP_URL: process.env.HTTP_URL, // HTTP URL for API requests or communication
  MAIN_WALLET: process.env.MAIN_WALLET
};