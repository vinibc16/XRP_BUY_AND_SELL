import { Client, Wallet } from 'xrpl';
import { config } from './config/env';
import { logger } from './utils/logger';
import { getAccountReserves, getBalance } from './xrpl/account';
import { buyTokens } from './utils/buyTokens';
import { measureLatency } from './xrpl/helpers';
import { updateTicketCache } from './xrpl/ticket';
import { WebSocketManager } from './utils/webSocketManager';
import { sendToMain } from './xrpl/swap';

// Load configuration from .env file
const wssUrl = config.WSS_URL;
const httpUrl = config.HTTP_URL || '';
const secrect = config.SECRET || '';

// Control flag for reconnection attempts
let isReconnecting = false;

/**
 * Main function to initialize the XRP ledger operations.
 */
async function main() {
  try {
    // Validate WebSocket URL
    if (!wssUrl) {
      throw new Error("WSS_URL is not defined in the .env file");
    }

    // Measure latency to the HTTP endpoint
    const latency = await measureLatency(httpUrl);
    logger.info(`Latency: ${latency}ms`);

    // Manage WebSocket connections
    const webSocketManager = WebSocketManager.getInstance();
    const client = await webSocketManager.getClient();

    // Initialize wallet using the secret
    const wallet = Wallet.fromSecret(secrect);
    logger.info(`Wallet: ${wallet.classicAddress}`);

    // Fetch and log account reserves
    await getAccountReserves(client, wallet.address);

    // Update ticket cache for the wallet
    await updateTicketCache(client, wallet);

    // Fetch and log initial wallet balance
    const initialBalance = await getBalance(client, wallet.classicAddress);
    if (initialBalance) {
      logger.info(`Initial Balance: ${initialBalance} XRP`);
    }

    logger.info("--- AUTO BUY Started ---");
    await setupListeners(client, wallet);

    // Handle graceful shutdown on SIGINT
    process.on('SIGINT', async () => {
      logger.error('SIGINT received. Disconnecting...');
      await webSocketManager.disconnect();
      process.exit();
    });

    setInterval(async () => {
      try {
        await sendToMain(wallet);
      } catch (err) {
        logger.error(`Error during token check and sell routine: ${err}`);
      }
    }, 10 * 60 * 1000); // 10-minute interval
  } catch (err) {
    logger.error(`Error in main: ${err}`);
  }
}

/**
 * Sets up listeners for XRPL transactions and processes them.
 * @param client - XRPL client instance.
 * @param wallet - Wallet instance.
 */
async function setupListeners(client: Client, wallet: any) {
  try {
    // Subscribe to global proposed transaction stream
    await client.request({
      command: 'subscribe',
      streams: ['transactions_proposed'], // Global stream for proposed transactions
    });

    // Event listener for transactions
    client.on('transaction', async (tx: any) => {
      const transaction = tx.tx_json || tx; // Parse transaction JSON
      if (!transaction) return;

      try {
        // Process token purchase logic
        buyTokens(client, wallet, transaction);
        //newToken(wallet, tx);
      } catch (err) {
        logger.error(`Error processing transaction: ${err}`);
      }
    });
  } catch (err) {
    logger.error(`Error setting up listeners: ${err}`);
  }
}

// Start the main function and handle uncaught errors
main().catch((error) => {
  logger.error(`Error: ${(error as Error).message || "Unknown error"}`);
});
