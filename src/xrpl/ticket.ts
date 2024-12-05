import { Client, Wallet, TicketCreate } from 'xrpl';
import { logger } from '../utils/logger';
import { getTransactionResult } from './helpers';
import { Mutex } from 'async-mutex';

// Cache to store ticket sequences
export let ticketCache: number[] = [];
const mutex = new Mutex();

/**
 * Creates a new TicketCreate transaction to generate additional tickets.
 * @param client XRPL client instance to interact with the ledger.
 * @param wallet XRPL wallet instance to sign the transaction.
 * @returns A boolean indicating whether the ticket creation was successful.
 */
export async function createTicket(
  client: Client,
  wallet: Wallet
): Promise<boolean> {
  try {
    // Construct the TicketCreate transaction
    const ticketTransaction: TicketCreate = {
      TicketCount: 5, // Number of tickets to create
      TransactionType: 'TicketCreate',
      Account: wallet.address, // The account creating the tickets
    };

    // Prepare and autofill the transaction details
    const prepared = await client.autofill(ticketTransaction);
    prepared.Fee = "200"; // Set transaction fee

    // Sign the transaction
    const signed = wallet.sign(prepared);

    // Submit the transaction and wait for validation
    const result = await client.submitAndWait(signed.tx_blob);

    // Check the transaction result
    const transactionResult = getTransactionResult(result.result.meta);
    if (transactionResult === 'tesSUCCESS') {
      return true; // Return success if the transaction was successful
    } else {
      logger.error(`Failed to create tickets. Result: ${transactionResult}`);
    }
  } catch (error) {
    // Log any errors encountered
    logger.error(`Error creating tickets: ${(error as Error).message}`);
  }
  return false; // Return failure if an error occurred
}

/**
 * Updates the ticket cache by fetching active tickets from the ledger.
 * If the number of tickets in the cache is below a threshold, additional tickets are created.
 * @param client XRPL client instance to interact with the ledger.
 * @param wallet XRPL wallet instance to fetch tickets for.
 */
export async function updateTicketCache(client: Client, wallet: any) {
  try {
    // Fetch account objects of type 'ticket'
    const response = await client.request({
      command: 'account_objects',
      account: wallet.address,
      type: 'ticket', // Fetch only ticket objects
      limit: 400
    });
    
    const tickets = response.result.account_objects || [];

    // Log the raw ticket data for debugging
    logger.info(`Fetched ${tickets.length} ticket(s) for account ${wallet.address}.`);
    
    // Extract and sort ticket sequences
    ticketCache = tickets
      .map((ticket: any) => ticket.TicketSequence)
      .sort((a: number, b: number) => a - b);

    // If fewer than 10 tickets exist, create more tickets
    if (ticketCache.length < 10) {
      logger.info(`Less than 10 tickets found. Creating additional tickets...`);
      await createTicket(client, wallet);
    }
  } catch (error) {
    logger.error(`Error updating ticket cache: ${(error as Error).message}`);
  }
}


/**
 * Retrieves and removes the next available ticket sequence from the cache.
 * @returns The next ticket sequence or null if the cache is empty.
 */
export async function getTicketFromCache(): Promise<number | null> {
  return await mutex.runExclusive(() => {
    const ticket = ticketCache.length > 0 ? ticketCache.shift() || null : null;
    return ticket;
  });
}
