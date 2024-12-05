import { Client, Wallet, TrustSet, TrustSetFlags } from 'xrpl';
import { logger } from '../utils/logger'; // Ensure the correct logger path
import { formatDateTime, hexToAscii } from './helpers';

/**
 * Extracts the transaction result status from the metadata object of a transaction.
 * 
 * @param meta - The metadata object from a transaction, which contains the details of the transaction processing.
 * 
 * @returns The transaction result as a string, if found; otherwise, returns undefined.
 * 
 * @example
 * const meta = { TransactionResult: "tesSUCCESS" };
 * const result = getTransactionResult(meta); // Returns "tesSUCCESS"
 */
function getTransactionResult(meta: any): string | undefined {
  if (meta && typeof meta !== "string" && "TransactionResult" in meta) {
    return meta.TransactionResult as string;
  }
  return undefined;
}

/**
 * Sets a trust line for a specific token issuer.
 * 
 * @param client - XRPL Client instance for ledger interactions.
 * @param wallet - XRPL Wallet instance used for signing the transaction.
 * @param currency_code - The currency code of the token.
 * @param issuer_wallet - The issuer's wallet address for the token.
 * 
 * @returns True if the trust line is successfully set, otherwise false.
 */
export async function setTrustLine(
  client: Client,
  wallet: Wallet,
  currency_code: string,
  issuer_wallet: string
): Promise<boolean> {
  try {
    // Construct the TrustSet transaction
    const trustSetTransaction: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet.address,
      LimitAmount: {
        currency: currency_code,
        issuer: issuer_wallet,
        value: "10000000000000000", // Arbitrary high limit for the trust line
      },
      Flags: TrustSetFlags.tfSetNoRipple, // Set No Ripple flag
    };

    // Prepare and autofill transaction details
    const prepared = await client.autofill(trustSetTransaction);
    prepared.Fee = "200"; // Override transaction fee
    const signed = wallet.sign(prepared); // Sign the transaction
    const result = await client.submitAndWait(signed.tx_blob); // Submit the transaction

    const transactionResult = getTransactionResult(result.result.meta);
    if (transactionResult === "tesSUCCESS") {
      logger.info(`[TRUSTLINE] Successfully set for ${hexToAscii(currency_code)} with issuer ${issuer_wallet}.`);
      const currentTime = formatDateTime(new Date());
      logger.log(`TrustSet completed at ${currentTime}`);
      return true;
    } else {
      logger.error(`Failed to set Trust Line: ${transactionResult}`);
    }
  } catch (error) {
    logger.error(`Error setting Trust Line: ${(error as Error).message}`);
  }
  return false;
}

/**
 * Cancels a specific trust line for a given currency and issuer.
 * 
 * @param client - XRPL Client instance for ledger interactions.
 * @param wallet - XRPL Wallet instance used for signing the transaction.
 * @param currency - The currency code of the trust line.
 * @param issuer - The issuer's wallet address for the trust line.
 */
export async function cancelSpecificTrustLine(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string
) {
  try {
    // Construct the TrustSet transaction for cancellation
    const trustSet: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet.address,
      LimitAmount: {
        currency: currency,
        issuer: issuer,
        value: "0", // Set limit to 0 to cancel the trust line
      },
      Flags: TrustSetFlags.tfSetNoRipple | TrustSetFlags.tfClearFreeze, // Proper flag for TrustLine cancellation
    };

    // Prepare and sign the transaction
    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const transactionResult = getTransactionResult(result.result.meta);
    if (transactionResult === "tesSUCCESS") {
      logger.log(`Successfully canceled Trust Line for ${currency} issued by ${issuer}.`);
    } else {
      logger.error(`Failed to cancel Trust Line: ${transactionResult}`);
    }
  } catch (error) {
    logger.error(`Error canceling Trust Line for ${currency} issued by ${issuer}: ${error}`);
  }
}

/**
 * Cancels all trust lines with a limit or balance of 0 for the specified wallet.
 * 
 * @param client - XRPL Client instance for ledger interactions.
 * @param wallet - XRPL Wallet instance to check and cancel trust lines.
 */
export async function cancelTrustLines(client: Client, wallet: Wallet): Promise<void> {
  try {
    // Fetch all trust lines for the wallet
    const accountLinesResponse = await client.request({
      command: "account_lines",
      account: wallet.classicAddress,
    });

    const trustLines = accountLinesResponse.result.lines;

    logger.log(`Found ${trustLines.length} trust lines.`);

    // Loop through trust lines and cancel those with limit and balance of 0
    for (const line of trustLines) {
      if (parseFloat(line.limit) === 0 && parseFloat(line.balance) === 0) {
        logger.log(`Canceling trust line: ${line.currency} issued by ${line.account}...`);

        // Construct the TrustSet transaction for cancellation
        const trustSet: TrustSet = {
          TransactionType: "TrustSet",
          Account: wallet.classicAddress,
          LimitAmount: {
            currency: line.currency,
            issuer: line.account,
            value: "0", // Set limit to 0 to cancel the trust line
          },
          Flags: TrustSetFlags.tfClearNoRipple, // Clear No Ripple flag
        };

        // Prepare, sign, and submit the transaction
        const prepared = await client.autofill(trustSet as any);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        const transactionResult = getTransactionResult(result.result.meta);
        if (transactionResult === "tesSUCCESS") {
          logger.log(`Successfully canceled trust line for ${line.currency}.`);
        } else {
          logger.error(`Failed to cancel trust line: ${transactionResult}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Error canceling trust lines: ${(error as Error).message}`);
  }
}
