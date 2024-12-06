import { Client } from 'xrpl';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private client: Client | null = null;
  private readonly url: string;
  private readonly timeout: number;

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
    } catch (error) {
      logger.error(`Failed to connect to WebSocket: ${(error as Error).message}`);
      this.client = null;
      throw error;
    }

    return this.client;
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
