import { Client } from "xrpl";
import { logger } from "../utils/logger";
import axios from 'axios';
import * as toml from 'toml';

/**
 * Extracts the transaction result from transaction metadata.
 * @param meta Transaction metadata returned by the XRPL client.
 * @returns The TransactionResult as a string, or undefined if not found.
 */
export function getTransactionResult(meta: any): string | undefined {
  if (meta && typeof meta !== "string" && meta.TransactionResult) {
    return meta.TransactionResult as string;
  }
  if (meta && typeof meta === "object" && "meta" in meta && meta.meta.TransactionResult) {
    return meta.meta.TransactionResult as string;
  }
  return undefined;
}

/**
 * Extracts the delivered amount for a "buy" transaction from metadata.
 * @param meta Metadata of the transaction.
 * @returns The delivered amount as a number, or undefined if not found.
 */
export function getDeliveredAmountBuy(meta: any): number | undefined {
  if (meta && typeof meta !== "string" && meta.DeliveredAmount?.value) {
    const deliveredAmount = meta.DeliveredAmount.value;
    return typeof deliveredAmount === "string" ? parseFloat(deliveredAmount) * 1_000_000 : deliveredAmount * 1_000_000;
  }
  if (meta?.meta?.DeliveredAmount?.value) {
    const deliveredAmount = meta.meta.DeliveredAmount.value;
    return typeof deliveredAmount === "string" ? parseFloat(deliveredAmount) * 1_000_000 : deliveredAmount * 1_000_000;
  }
  return undefined;
}

/**
 * Extracts the delivered amount for a "sell" transaction from metadata.
 * @param meta Metadata of the transaction.
 * @returns The delivered amount as a number, or undefined if not found.
 */
export function getDeliveredAmountSell(meta: any): number | undefined {
  const deliveredAmount = meta?.DeliveredAmount || meta?.meta?.DeliveredAmount;
  return typeof deliveredAmount === "string" ? parseFloat(deliveredAmount) : deliveredAmount;
}

/**
 * Extracts the amount of XRP paid in a transaction from metadata.
 * @param meta Metadata of the transaction.
 * @returns The amount of XRP paid as a number, or undefined if not available.
 */
export function getPaidAmountInXRP(meta: any): number | undefined {
  if (!meta || typeof meta !== "object") return undefined;

  if ("delivered_amount" in meta) {
    const deliveredAmount = meta.delivered_amount;
    if (typeof deliveredAmount === "string") return Number(deliveredAmount) / 1_000_000; // Convert drops to XRP
    if (deliveredAmount?.currency === "XRP") return Number(deliveredAmount.value); // Handle complex payments
  }
  return undefined;
}

/**
 * Converts drops (smallest XRP unit) to XRP.
 * @param drops The value in drops.
 * @returns The value converted to XRP.
 */
export function dropsToXrp(drops: string | number): string {
  const dropsNum = typeof drops === 'string' ? parseFloat(drops) : drops;
  return (dropsNum / 1_000_000).toFixed(6);
}

/**
 * Converts XRP to drops (smallest XRP unit).
 * @param xrp The value in XRP.
 * @returns The value converted to drops.
 */
export function xrpToDrops(xrp: string | number): string {
  const xrpNum = typeof xrp === 'string' ? parseFloat(xrp) : xrp;
  return (xrpNum * 1_000_000).toFixed(0);
}

/**
 * Logs the result of a transaction.
 * @param result The transaction result to log.
 */
export function logTransactionResult(result: any): void {
  logger.log(`Transaction Result: ${JSON.stringify(result, null, 2)}`);
}

/**
 * Formats a Date object into a readable date-time string.
 * @param date The date to format.
 * @returns The formatted date-time string.
 */
export function formatDateTime(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/` +
         `${(date.getMonth() + 1).toString().padStart(2, '0')} ` +
         `${date.getHours().toString().padStart(2, '0')}:` +
         `${date.getMinutes().toString().padStart(2, '0')}:` +
         `${date.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * Fetches token details (issuer and currency) from a domain using TOML.
 * @param domain The domain to query.
 * @param retries Number of retry attempts (default is 20).
 * @param delayMs Delay between retries in milliseconds (default is 1000).
 * @returns Token details or null if not found.
 */
export async function fetchTokenDetails(domain: string, retries = 20, delayMs = 1000): Promise<{ issuer: string; currency: string } | null> {
  const domainConverted = hexToAscii(domain);
  const tomlUrl = `https://${domainConverted}/.well-known/xrp-ledger.toml`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(tomlUrl);
      const parsedToml = toml.parse(response.data);
      if (parsedToml.TOKENS?.[0]) {
        const token = parsedToml.TOKENS[0];
        return { issuer: token.issuer, currency: hexToAscii(token.currency) };
      }
      return null;
    } catch (error) {
      if (attempt < retries) await delay(delayMs); // Retry after a delay
    }
  }
  return null;
}

/**
 * Converts a hex string to an ASCII string.
 * @param hexString The hex string to convert.
 * @returns The converted ASCII string.
 */
export function hexToAscii(hexString: string): string {
  return /^[0-9a-fA-F]+$/.test(hexString)
    ? Array.from({ length: hexString.length / 2 }, (_, i) => String.fromCharCode(parseInt(hexString.slice(i * 2, i * 2 + 2), 16))).join('')
    : hexString;
}

/**
 * Measures the latency to an XRPL node.
 * @param nodeUrl The URL of the XRPL node.
 * @returns The latency in milliseconds.
 */
export async function measureLatency(nodeUrl: string): Promise<number> {
  try {
    const startTime = Date.now();
    await axios.post(nodeUrl, { method: "server_info", params: [] });
    return Date.now() - startTime;
  } catch (error) {
    logger.error(`Error connecting to node: ${error}`);
    throw error;
  }
}

/**
 * Connects to an XRPL client with retries in case of failure.
 * @param client The XRPL client instance.
 * @param maxRetries Maximum retry attempts (default is 10).
 */
export async function connectWithRetry(client: Client, maxRetries = 10): Promise<void> {
  for (let attempts = 0; attempts < maxRetries; attempts++) {
    try {
      logger.info('Attempting to connect to XRPL...');
      await client.connect();
      logger.info('Connected to XRPL.');
      return; // Exit on successful connection
    } catch (error) {
      const retryDelay = Math.min(3 * (attempts + 1), 30); // Progressive delay up to 30 seconds
      logger.error(`Reconnection attempt ${attempts + 1} failed. Retrying in ${retryDelay} seconds...`);
      await delay(retryDelay * 1000);
    }
  }
  logger.error('Max reconnection attempts reached. Could not reconnect to XRPL.');
  throw new Error('Unable to reconnect to XRPL after multiple attempts.');
}

/**
 * Introduces a delay in milliseconds.
 * @param ms The duration of the delay in milliseconds.
 */
export async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}
