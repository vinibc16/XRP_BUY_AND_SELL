import { Client } from 'xrpl';
import { logger } from '../utils/logger';

/**
 * Fetches the current balance of an XRP account.
 * Converts the balance from drops (smallest XRP unit) to XRP.
 *
 * @param client - An XRPL client instance for interacting with the ledger.
 * @param address - The XRP account address for which the balance is retrieved.
 * @returns A string representing the balance in XRP (up to 6 decimal places), or null if an error occurs.
 */
export async function getBalance(client: Client, address: string): Promise<string | null> {
  try {
    // Request account information from the XRPL ledger
    const accountInfo = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated", // Use the most recently validated ledger
    });

    const balanceInDrops = accountInfo.result.account_data.Balance; // Get the balance in drops (smallest unit)
    return (Number(balanceInDrops) / 1_000_000).toFixed(6); // Convert drops to XRP and format to 6 decimal places
  } catch (error) {
    logger.error(`Error fetching balance: ${error}`); // Log any errors encountered
    return null; // Return null if an error occurs
  }
}

/**
 * Calculates and logs the account reserve details for an XRP account.
 * The reserve is the minimum amount of XRP required to maintain the account and its ledger objects (e.g., trust lines, offers).
 * 
 * @param client - An XRPL client instance for interacting with the ledger.
 * @param account - The XRP account address for which reserve details are calculated.
 * @returns Logs details such as base reserve, incremental reserve, ledger objects (OwnerCount), and total reserve in XRP.
 */
export async function getAccountReserves(client: Client, account: string) {
  try {
    // Fetch account information
    const accountInfo = await client.request({
      command: 'account_info',
      account: account,
      ledger_index: 'validated', // Use the most recently validated ledger
    });

    const accountData = accountInfo.result.account_data; // Extract account data

    // Fetch server state to get reserve details
    const serverState = await client.request({
      command: 'server_info',
    });

    const validatedLedger = serverState.result.info?.validated_ledger; // Get validated ledger information
    if (!validatedLedger) {
      throw new Error("Validated ledger information unavailable."); // Throw error if ledger info is missing
    }

    const reserveBaseXRP = parseFloat(String(validatedLedger.reserve_base_xrp)); // Base reserve in XRP
    const reserveIncrementXRP = parseFloat(String(validatedLedger.reserve_inc_xrp)); // Incremental reserve per ledger object

    const ownerCount = accountData.OwnerCount || 0; // Number of ledger objects owned by the account
    const totalReserveXRP = reserveBaseXRP + reserveIncrementXRP * ownerCount; // Total reserve calculation

    // Log account reserve details
    logger.info('--- Account Reserve Details ---');
    logger.info(`Account Address: ${account}`);
    logger.info(`Base Reserve: ${reserveBaseXRP} XRP`);
    logger.info(`Increment Reserve: ${reserveIncrementXRP} XRP`);
    logger.info(`Ledger Objects (OwnerCount): ${ownerCount}`);
    logger.info(`Total Reserve: ${totalReserveXRP.toFixed(6)} XRP`);
    logger.info('--------------------------------------');
  } catch (error) {
    logger.error(`Error calculating account reserves: ${error}`); // Log any errors encountered
  }
}
