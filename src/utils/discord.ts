import axios from 'axios';
import { config } from '../config/env';
import { logger } from './logger';
import * as path from 'path';
import { hexToAscii } from '../xrpl/helpers';

// Fila de Mensagens
class WebhookQueue {
  private queue: { webhookUrl: string; payload: any }[] = [];
  private isProcessing = false;

  addToQueue(webhookUrl: string, payload: any) {
    this.queue.push({ webhookUrl, payload });
    this.processQueue(); // Garante que o processamento inicie
  }

  private async processQueue() {
    if (this.isProcessing) return; // Evita múltiplas instâncias do loop de processamento

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { webhookUrl, payload } = this.queue.shift()!;
      try {
        await axios.post(webhookUrl, payload); // Envia para o webhook
        logger.log(`Payload enviado com sucesso: ${payload}`);
      } catch (error) {
        logger.error(`Erro ao enviar payload: ${error}`);
      }
      await this.sleep(2000); // Aguarda 2 segundos antes de processar o próximo
    }

    this.isProcessing = false;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const webhookQueue = new WebhookQueue();

// Função para enviar mensagem de compra
export async function sendMessageBuy(
  currency: string,
  issuer: string,
  wallet: string,
  purchasedTokens: number,
  purchasedAmount: number
): Promise<void> {
  try {
    const webhookUrl = config.WEBHOOK;
    if (!webhookUrl) {
      throw new Error('Webhook URL is not defined in the configuration.');
    }

    const tokens = parseFloat(purchasedTokens.toString()) || 0;
    const amount = parseFloat(purchasedAmount.toString()) || 0;

    const payload = {
      embeds: [
        {
          title: 'NEW BUY',
          description: wallet,
          fields: [
            { name: 'Currency', value: hexToAscii(currency), inline: false },
            { name: 'Issuer', value: issuer, inline: false },
            { name: 'Purchased Tokens', value: tokens.toFixed(2), inline: true },
            { name: 'Purchased Amount', value: amount.toFixed(2), inline: true },
          ],
          color: 0x3498db,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    webhookQueue.addToQueue(webhookUrl, payload); // Adiciona à fila
  } catch (error) {
    logger.error(`Error sending buy message: ${error}`);
    throw error;
  }
}

// Função para enviar mensagem de venda
export async function sendMessageSell(
  currency: string,
  issuer: string,
  wallet: string,
  soldTokens?: number,
  soldAmount?: number,
  target?: number,
  balance?: number,
  sumProfit?: number
): Promise<void> {
  try {
    const webhookUrl = config.WEBHOOK;
    if (!webhookUrl) {
      throw new Error('Webhook URL is not defined in the configuration.');
    }

    let targetPerc = 0;
    let soldPerc = 0;

    switch (target) {
      case 1:
        targetPerc = config.TARGET1;
        soldPerc = config.TARGET1_PERC;
        break;
      case 2:
        targetPerc = config.TARGET2;
        soldPerc = config.TARGET2_PERC;
        break;
      case 3:
        targetPerc = config.TARGET3;
        soldPerc = config.TARGET3_PERC;
        break;
      case 4:
        targetPerc = config.TARGET4;
        soldPerc = config.TARGET4_PERC;
        break;
      case 5:
        targetPerc = config.TARGET5;
        soldPerc = config.TARGET5_PERC;
        break;
      case 6:
        targetPerc = config.TARGET6;
        soldPerc = config.TARGET6_PERC;
        break;
      case 7:
        targetPerc = config.TARGET7;
        soldPerc = config.TARGET7_PERC;
        break;
      case 8:
        targetPerc = config.TARGET8;
        soldPerc = config.TARGET8_PERC;
        break;
      case 9:
        targetPerc = config.TARGET9;
        soldPerc = config.TARGET9_PERC;
        break;
      case 10:
        targetPerc = config.TARGET10;
        soldPerc = config.TARGET10_PERC;
        break;
    }

    const payload = {
      embeds: [
        {
          title: 'NEW SELL',
          description: wallet,
          fields: [
            {
              name: 'Target',
              value: `Target %:[${targetPerc}%] - Sold %:[${soldPerc}]`,
              inline: false,
            },
            { name: 'Currency', value: hexToAscii(currency), inline: false },
            { name: 'Issuer', value: issuer, inline: false },
            { name: 'Sold Tokens', value: soldTokens?.toFixed(2), inline: true },
            {
              name: 'Sold Amount (Estimated)',
              value: soldAmount?.toFixed(2),
              inline: true,
            },
            {
              name: 'Tokens Balance',
              value: balance?.toFixed(2),
              inline: false,
            },
            {
              name: 'Accumulated profit',
              value: sumProfit?.toFixed(2),
              inline: false,
            },
          ],
          color: 0xff0000,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    webhookQueue.addToQueue(webhookUrl, payload); // Adiciona à fila
  } catch (error) {
    logger.error(`Error sending sell message: ${error}`);
    throw error;
  }
}
