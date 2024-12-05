import * as fs from 'fs';
import * as path from 'path';
import { sendMessageBuy, sendMessageSell } from '../utils/discord';

const filePath = path.resolve('./src/data/profits.json');

// Ensures the JSON file exists, creating it if necessary
function ensureFileExists(): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([])); // Initializes the file as an empty array
  }
}

// Reads and returns the data from the JSON file
export function readFile(): any[] {
  ensureFileExists();
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Error reading file: ${error}`);
  }
}

// Writes the given data to the JSON file
function writeFile(data: any[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new Error(`Error writing file: ${error}`);
  }
}

// Adds a new item to the JSON file
export function add(
  currency: string,
  issuer: string,
  wallet: string,
  buyAmount: number,
  sellAmount: number,
  totalTokensInicial: number,
  tokensBalance: number
): void {
  const data = readFile();
  if (!exist(currency, issuer, wallet)) {
    data.push({
      currency,
      issuer,
      wallet,
      buyAmount,
      sellAmount,
      totalTokensInicial,
      tokensBalance,
      target1Achieved: false, // Initial state for target achievements
      target2Achieved: false,
      target3Achieved: false,
      target4Achieved: false,
      target5Achieved: false,
      target6Achieved: false,
      target7Achieved: false,
      target8Achieved: false,
      target9Achieved: false,
      target10Achieved: false,
    });
    writeFile(data);
    sendMessageBuy(currency, issuer, wallet, totalTokensInicial, buyAmount); // Sends a buy notification
  }
}

// Removes an item from the JSON file
export function remove(currency: string, issuer: string, wallet: string): void {
  const data = readFile();
  const filteredData = data.filter(
    (entry: any) =>
      entry.currency !== currency || entry.issuer !== issuer || entry.wallet !== wallet
  );
  writeFile(filteredData); // Saves the filtered data back to the file
}

// Checks if an item exists in the JSON file
export function exist(currency: string, issuer: string, wallet: string): boolean {
  const data = readFile();
  return data.some(
    (entry: any) =>
      entry.currency === currency && entry.issuer === issuer && entry.wallet === wallet
  );
}

// Updates an item in the JSON file based on `currency`, `issuer`, and `wallet`
export function update(
  currency: string,
  issuer: string,
  wallet: string,
  buyAmount?: number,
  sellAmount?: number,
  totalTokensInicial?: number,
  tokensBalance?: number,
  extraFields?: { [key: string]: any }, // Optional new fields
  sellResult?: number,
  target?: number
): void {
  const data = readFile();

  // Finds the index of the item to update
  const index = data.findIndex(
    (entry: any) =>
      entry.currency === currency && entry.issuer === issuer && entry.wallet === wallet
  );

  if (index !== -1) {
    // Updates the specified fields for the item at the found index
    if (buyAmount !== undefined) data[index].buyAmount = buyAmount;
    if (sellAmount !== undefined) data[index].sellAmount = sellAmount;
    if (totalTokensInicial !== undefined) data[index].totalTokensInicial = totalTokensInicial;
    if (tokensBalance !== undefined) data[index].tokensBalance = tokensBalance;

    // Updates additional fields like `target1Achieved`
    if (extraFields) {
      Object.entries(extraFields).forEach(([key, value]) => {
        data[index][key] = value;
      });
    }

    writeFile(data); // Saves the updated data to the file

    sendMessageSell(currency, issuer, wallet, sellResult, sellAmount, target, tokensBalance, sellAmount); // Sends a sell notification
  } else {
    throw new Error(
      `Item with currency = ${currency}, issuer = ${issuer}, and wallet = ${wallet} not found.`
    );
  }
}
