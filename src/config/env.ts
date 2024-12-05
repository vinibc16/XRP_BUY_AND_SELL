import dotenv from 'dotenv';

// Load environment variables from a .env file into process.env
dotenv.config();

export const config = {
  WSS_URL: process.env.WSS_URL, // WebSocket URL for connecting to the server
  SECRET: process.env.SECRET, // Secret key for authentication or encryption
  DEBUG: process.env.DEBUG, // Debug flag for logging or development
  AMOUNT_XRP: process.env.AMOUNT_XRP, // Amount of XRP (Ripple cryptocurrency) to handle
  AUTO_BURN: process.env.AUTO_BURN, // Flag to enable or disable auto-burn feature
  HTTP_URL: process.env.HTTP_URL, // HTTP URL for API requests or communication
  WEBHOOK: process.env.WEBHOOK, // Webhook URL for receiving events or notifications
  AUTO_SELL: process.env.AUTO_SELL, // Flag to enable or disable auto-sell functionality
  AUTO_BUY: process.env.AUTO_BUY, // Flag to enable or disable auto-buy functionality
  AFTER_FIRST_DUMP: process.env.AFTER_FIRST_DUMP,
  TARGET1: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET1_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET2: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET2_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET3: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET3_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET4: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET4_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET5: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET5_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET6: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET6_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET7: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET7_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET8: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET8_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET9: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET9_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
  TARGET10: Number(process.env.TARGET1), // Target 1 value converted to a number
  TARGET10_PERC: Number(process.env.TARGET1_PERC), // Target Percentage 1 value converted to a number
};