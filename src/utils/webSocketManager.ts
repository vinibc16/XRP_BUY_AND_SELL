import { Client } from 'xrpl';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private client: Client | null = null;
  private readonly url: string;
  private readonly timeout: number;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10; // Limite de tentativas de reconexão
  private reconnectDelay: number = 5000; // 5 segundos entre tentativas

  private constructor() {
    this.url = config.WSS_URL || '';
    this.timeout = 60 * 1000;
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public async getClient(): Promise<Client> {
    if (this.client && this.client.isConnected()) {
      return this.client;
    }

    logger.info('Creating new WebSocket client...');
    this.client = new Client(this.url, { timeout: this.timeout });

    try {
      await this.client.connect();
      logger.info('Connected to XRPL WebSocket.');
      this.setupListeners(this.client);
    } catch (error) {
      logger.error(`Failed to connect to WebSocket: ${(error as Error).message}`);
      this.client = null;
      throw error;
    }

    return this.client;
  }

  private setupListeners(client: Client): void {
    client.on('connected', () => {
      logger.info('WebSocket connected.');
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    });

    client.on('disconnected', async (code: number) => {
      logger.error(`WebSocket disconnected with code: ${code}`);
      await this.reconnect(); // Attempt to reconnect on disconnection
    });

    client.on('error', (error: Error) => {
      logger.error(`WebSocket error: ${error.message}`);
    });

    client.on('ledgerClosed', (ledger) => {
      logger.info(`Ledger closed: ${ledger.ledger_index}`);
    });
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached. Unable to reconnect to WebSocket.');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Reconnecting to WebSocket... Attempt ${this.reconnectAttempts}`);
    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.getClient();
      logger.info('Reconnected to WebSocket.');
    } catch (error) {
      logger.error(`Reconnection attempt failed: ${(error as Error).message}`);
      await this.reconnect(); // Retry reconnection
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        logger.info('WebSocket disconnected successfully.');
      } catch (error) {
        logger.error(`Error during WebSocket disconnection: ${(error as Error).message}`);
      } finally {
        this.client = null;
      }
    }
  }

  public async ensureConnected(): Promise<void> {
    if (!this.client || !this.client.isConnected()) {
      logger.error('WebSocket is not connected. Reconnecting...');
      await this.getClient();
    }
  }
}
