import { Client } from 'xrpl';
import { logger } from './logger';
import { cancelSpecificTrustLine, setTrustLine } from '../xrpl/trustlines';
import { swapXRPtoToken } from '../xrpl/swap';
import { delay, hexToAscii } from '../xrpl/helpers';
import { getTicketFromCache, updateTicketCache } from '../xrpl/ticket';

// Constants to track processed trust lines and monitored accounts
const processedTrustLines: Set<string> = new Set();
const monitorAccounts: Set<string> = new Set();

// Function to handle the token-buying process based on specific transactions
export async function buyTokens(client: Client, wallet: any, transaction: any) {
  try {
    // Process "AccountSet" transactions to monitor accounts with specific domains
    if (transaction?.TransactionType === 'AccountSet') {
      if (transaction.Domain) {
        try {
          // Decode the domain from hex to ASCII
          const domain = hexToAscii(transaction.Domain);
          if (domain.endsWith('toml.firstledger.net') && !domain.startsWith('https://')) {
            monitorAccounts.add(transaction.Account);

            // Fetch account information
            const accountInfo = await client.request({
              command: 'account_info',
              account: transaction.Account,
              ledger_index: 'validated',
            });

            // Log the account information
            logger.log(`Account info for ${transaction.Account}: ${JSON.stringify(accountInfo.result)}`);
          }
        } catch (err) {
          logger.error(`Error decoding domain: ${err}`);
        }
      }
    }
    // Process "TrustSet" transactions to handle trust lines and buy tokens
    else if (transaction?.TransactionType === 'TrustSet') {
      try {
        const limitAmount = transaction.LimitAmount;
        if (!limitAmount) {
          return; // Exit if no limit amount is provided
        }

        // Ensure the issuer is being monitored
        if (!monitorAccounts.has(limitAmount.issuer)) {
          return; // Exit if issuer is not in the monitored list
        }

        const { currency, issuer } = limitAmount;

        // Skip if the trust line has already been processed
        if (processedTrustLines.has(issuer)) {
          return;
        }

        logger.log(`Processing BUY for ${hexToAscii(currency)}`);
        processedTrustLines.add(issuer); // Mark issuer as processed
        const ticketSequence1 = await getTicketFromCache(); // Get ticket sequence from cache
        logger.log(`ticket: ${ticketSequence1}`);
        // Set up the trust line
        await setTrustLine(client, wallet, currency, issuer);
        if (ticketSequence1) {          
          for (let i = 0; i < 30; i++) {
            swapXRPtoToken(client, wallet, currency, issuer, ticketSequence1, i+1);      
            await delay(1000);
          }
          monitorAccounts.delete(limitAmount.issuer); // Remove issuer from monitored accounts
          setTimeout(async () => {
            await Promise.all([
              updateTicketCache(client, wallet),
            ]);
          }, 10000);
          setTimeout(async () => {
            await Promise.all([
              cancelSpecificTrustLine(client, wallet, currency, issuer),
            ]);
          }, 15000);
          
          
        }
      } catch (err) {
        null; // Ignore errors in the TrustSet handling
      }
    }
  } catch (err) {
    logger.error(`Unexpected error in token monitoring routine: ${err}`);
  }
}
