import { Client, Wallet, Transaction } from 'xrpl';
import { logger } from '../utils/logger';
import { getTransactionResult, xrpToDrops } from './helpers';
import { config } from '../config/env';
import { TokenInfo } from '../types';

// Constants
const PERCENTAGE_TO_SELL = '100'; // Percentage markup for the sell offer
const XRP_AMOUNT_TO_BUY = parseFloat(config.AMOUNT_XRP?.toString() || "0"); // XRP amount used for buying tokens

/**
 * Creates a sell offer for a token at a specified percentage above the purchase price.
 * @param client XRPL Client instance for ledger interaction.
 * @param wallet XRPL Wallet instance for signing transactions.
 * @param tokenInfo Information about the token (currency and issuer).
 * @param tokenAmount The amount of tokens to sell.
 */
export async function createSellOffer(
  client: Client,
  wallet: Wallet,
  tokenInfo: TokenInfo,
  tokenAmount: string
): Promise<void> {
  try {
    // Calculate the sell price per token
    const sellPricePerToken = XRP_AMOUNT_TO_BUY * (1 + parseFloat(PERCENTAGE_TO_SELL) / 100);

    // Create the offer transaction object
    const offerTransaction: Transaction = {
      TransactionType: 'OfferCreate', // Specify the transaction type as OfferCreate
      Account: wallet.address, // The account creating the offer
      TakerGets: {
        currency: tokenInfo.currency || '', // Currency of the token to sell
        issuer: tokenInfo.issuer || '', // Issuer of the token
        value: parseFloat(tokenAmount).toFixed(6), // Amount of tokens to sell
      },
      Fee: "200", // Transaction fee in drops
      TakerPays: xrpToDrops(sellPricePerToken), // Amount to be paid in XRP, converted to drops
      Flags: 0x00080000, // Sell offer flag
    };

    logger.log(`Preparing offer transaction: ${JSON.stringify(offerTransaction, null, 2)}`);

    // Prepare, autofill missing fields, and adjust the fee
    const prepared = await client.autofill(offerTransaction);
    prepared.Fee = "200"; // Override autofilled fee if necessary

    // Sign the transaction with the wallet's private key
    const signed = wallet.sign(prepared);

    // Submit the transaction and wait for validation
    const result = await client.submitAndWait(signed.tx_blob);

    // Log the transaction result
    const transactionResult = getTransactionResult(result.result.meta);
    if (transactionResult === 'tesSUCCESS') {
      logger.info(`Sell offer created successfully with hash: ${signed.hash}`);
      logger.info(`Sell Offer Details: Token ${tokenInfo.currency}, Issuer ${tokenInfo.issuer}, Amount ${tokenAmount}, Price per Token ${sellPricePerToken.toFixed(6)} XRP.`);
    } else {
      logger.error(`Failed to create sell offer. Result: ${transactionResult}`);
    }
  } catch (error) {
    logger.error(`Error creating sell offer: ${(error as Error).message}`); // Log any errors encountered
  }
}
