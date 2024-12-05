import axios from 'axios';
import { Wallet, Payment, PaymentFlags, Client } from 'xrpl';
import { delay, dropsToXrp, getDeliveredAmountBuy, getDeliveredAmountSell, getTransactionResult, xrpToDrops } from './helpers';
import { logger } from '../utils/logger';
import { config } from '../config/env';

// Constants
const REST_API_URL = config.HTTP_URL || 'https://s.altnet.rippletest.net:51234'; // Default XRPL REST API URL
const PURCHASE_AMOUNT_XRP = config.AMOUNT_XRP ? parseFloat(config.AMOUNT_XRP) : 0.01; // Default XRP amount to spend

/**
 * Swaps XRP for a token using a payment transaction.
 * @param wallet The XRPL wallet instance for signing transactions.
 * @param currency The token currency code to purchase.
 * @param issuer The issuer address of the token.
 * @param ticketSequence The ticket sequence for the transaction.
 * @param id An identifier for logging purposes.
 * @returns A boolean indicating whether the swap was successful.
 */
export async function swapXRPtoToken(
  client:Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  ticketSequence: number,
  id: number
): Promise<boolean> {
  try {
    const ledgerResponse = await axios.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10; // Buffer for ledger expiration

    // Construct the payment transaction for swapping XRP to the token
    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: {
        currency, // Token currency to purchase
        value: '1000000000000', // Placeholder for maximum amount
        issuer, // Token issuer
      },
      SendMax: xrpToDrops(PURCHASE_AMOUNT_XRP), // Maximum XRP to spend (converted to drops)
      Flags: PaymentFlags.tfPartialPayment, // Allow partial payment
      TicketSequence: ticketSequence, // Use ticket sequence for transaction
      Fee: "1000", // Transaction fee in drops
      Sequence: 0, // Sequence is set to 0 because tickets are used
      LastLedgerSequence: lastLedgerSequence, // Expiration for the transaction
    };

    // Sign the transaction
    const signed = wallet.sign(swapTxData);

    // Submit the transaction to the XRPL network
    const submitResponse = await axios.post(REST_API_URL, {
      method: 'submit',
      params: [
        {
          tx_blob: signed.tx_blob,
          fail_hard: true, // Ensures transaction fails completely if there's an issue
        },
      ],
    });

    const result = submitResponse.data.result;

    if (result.engine_result === 'tesSUCCESS') {
      logger.info(`[BUY] - [${id}] - Swap successful.`);
      await swapTokentoXRPWS(client, wallet, currency, issuer, '1000000000000000');   
      return true;
    } else {
      logger.error(`[${id}] Swap failed: ${result.engine_result_message}`);
      return false;
    }
  } catch (error) {
    // Handle errors during the transaction process
    if (axios.isAxiosError(error)) {
      logger.error(`[${id}] Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.error(`[${id}] Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

export async function dummySwap(
  wallet: Wallet
): Promise<boolean> {
  try {
    // Fetch the current validated ledger index
    const ledgerResponse = await axios.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    const accountInfoResponse = await axios.post(REST_API_URL, {
      method: 'account_info',
      params: [
        {
          account: wallet.address,
          ledger_index: 'validated',
        },
      ],
    });


    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10; // Buffer for ledger expiration
    const sequence = accountInfoResponse.data.result.account_data.Sequence; // Número de sequência correto

    for (let i = 0; i < 10; i++) {
      // Construct the payment transaction for swapping XRP to the token
      const swapTxData: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: 'rfFDX1CF6AnDcBsEdqHzXJidR2K7dBAAo6',
        Amount: '1', // Amount in drops (1 XRP = 1,000,000 drops)
        Fee: "100", // Fee in drops
        Sequence: sequence + i,
        LastLedgerSequence: lastLedgerSequence, // Expiration for the transaction
      };


      // Sign the transaction
      const signed = wallet.sign(swapTxData);

      // Submit the transaction to the XRPL network
      const submitResponse = await axios.post(REST_API_URL, {
        method: 'submit',
        params: [
          {
            tx_blob: signed.tx_blob,
            fail_hard: true, // Ensures transaction fails completely if there's an issue
          },
        ],
      });

      const result = submitResponse.data.result;

      if (result.engine_result === 'tesSUCCESS') {
        logger.info(`[DUMMY] - [${i+1}] - Swap successful.`);
      } else {
        logger.error(`[${i+1}] Swap failed: ${result.engine_result_message}`);
      }
      await delay(100);
    }
    return true;
  } catch (error) {
    // Handle errors during the transaction process
    if (axios.isAxiosError(error)) {
      logger.error(`Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.error(`Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

export async function swapXRPtoTokenWS(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  ticketSequence: number,
  id: number
): Promise<boolean> {
  try {
    if (!currency || !issuer) {
      logger.error('Currency or issuer is missing.');
      return false;
    }

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: {
        currency,
        value: '1000000000000', // Valor simbólico
        issuer,
      },
      SendMax: xrpToDrops(PURCHASE_AMOUNT_XRP), // Envia no máximo este valor
      Flags: PaymentFlags.tfPartialPayment, // Permite pagamento parcial
      TicketSequence: ticketSequence,
      Sequence: 0,
      Fee: "1000"
    };

    const prepared = await client.autofill(swapTxData);
    const signed = wallet.sign(prepared);

    const result = await client.submitAndWait(signed.tx_blob, { failHard: true });
    const transactionResult = getTransactionResult(result.result.meta);

    if (transactionResult === 'tesSUCCESS') {
      logger.info(`[${id}] - [BUY] - Swap successful.`);
      return true;
    } else {
      logger.error(`[${id}] - Swap transaction failed: ${transactionResult || 'Unknown error'}`);
    }
  } catch (error) {
    logger.error(`[${id}] - Error during swap operation: ${(error as Error).message}`);
  }

  return false;
}

export async function swapTokentoXRPWithTicket(
  wallet: Wallet,
  currency: string,
  issuer: string,
  ticketSequence: number
): Promise<boolean> {
  try {
    // Obter índice atual do ledger
    const ledgerResponse = await axios.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    // Obter sequência da conta
    const accountInfoResponse = await axios.post(REST_API_URL, {
      method: 'account_info',
      params: [
        {
          account: wallet.address
        },
      ],
    });

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10; // Buffer de 10

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: '10000000000000',
      SendMax: {
        currency, // A moeda que está sendo trocada para XRP
        value: '10000000000000', // Quantidade da moeda
        issuer, // Issuer da moeda que está sendo trocada
      },
      Flags: PaymentFlags.tfPartialPayment,
      Fee: "200",
      TicketSequence: ticketSequence,
      Sequence: 0,
      LastLedgerSequence: lastLedgerSequence, // Adicionado
    };

    const signed = wallet.sign(swapTxData);

    const submitResponse = await axios.post(REST_API_URL, {
      method: 'submit',
      params: [
        {
          tx_blob: signed.tx_blob,
          fail_hard: true, // Inclui a opção fail_hard
        },
      ],
    });

    const result = submitResponse.data.result;

    if (result.engine_result === 'tesSUCCESS') {
      logger.info(`[SELL] - Swap successful.`);
      return true;
    } else {
      logger.log(`Swap failed: ${JSON.stringify(result, null, 2)}`);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.log(`Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.log(`Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

export async function swapTokentoXRP(
  wallet: Wallet,
  currency: string,
  issuer: string,
  balance: string
): Promise<boolean> {
  try {
    // Obter índice atual do ledger
    const ledgerResponse = await axios.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    // Obter sequência da conta
    const accountInfoResponse = await axios.post(REST_API_URL, {
      method: 'account_info',
      params: [
        {
          account: wallet.address,
        },
      ],
    });

    const sequence = accountInfoResponse.data.result.account_data.Sequence; // Número de sequência correto

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10; // Buffer de 10

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: '10000000000000',
      SendMax: {
        currency, // A moeda que está sendo trocada para XRP
        value: balance, // Quantidade da moeda
        issuer, // Issuer da moeda que está sendo trocada
      },
      Flags: PaymentFlags.tfPartialPayment,
      Fee: "1000",
      Sequence: sequence,
      LastLedgerSequence: lastLedgerSequence, // Adicionado
    };

    const signed = wallet.sign(swapTxData);

    const submitResponse = await axios.post(REST_API_URL, {
      method: 'submit',
      params: [
        {
          tx_blob: signed.tx_blob,
          fail_hard: true, // Inclui a opção fail_hard
        },
      ],
    });

    const result = submitResponse.data.result;

    if (result.engine_result === 'tesSUCCESS') {
      logger.info(`[SELL] - Swap successful.`);
      return true;
    } else {
      logger.log(`Swap failed: ${JSON.stringify(result, null, 2)}`);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.log(`Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.log(`Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

export async function swapTokentoXRPWS(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  tokenQuantity: string
): Promise<number> {
  try {
    if (!currency || !issuer) {
      logger.error('Currency or issuer is missing.');
      return 0;
    }

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: '1000000000000000', // Define o valor de XRP em drops
      SendMax: {
        currency, // A moeda que está sendo trocada para XRP
        value: tokenQuantity, // Quantidade da moeda
        issuer, // Issuer da moeda que está sendo trocada
      },
      Flags: PaymentFlags.tfPartialPayment,
      Fee: '5000',
    };

    const prepared = await client.autofill(swapTxData);
    const signed = wallet.sign(prepared);

    const result = await client.submitAndWait(signed.tx_blob, { failHard: true });
    const transactionResult = getTransactionResult(result.result.meta);

    if (transactionResult === 'tesSUCCESS') {
      logger.info('[SELL] - Swap successful.');
      const deliveredAmount = getDeliveredAmountSell(result.result.meta);
      return deliveredAmount ? Number(dropsToXrp(deliveredAmount)) : 0;
    } else {
      logger.error(`[SELL] - Swap transaction failed: ${transactionResult || 'Unknown error'}`);
    }
  } catch (error) {
    null;
    logger.error(`[SELL] - Error during swap operation: ${(error as Error).message}`);
  }

  return 0;
}