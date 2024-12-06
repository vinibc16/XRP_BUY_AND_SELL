import axios, { AxiosInstance } from 'axios';
import { Wallet, Payment, PaymentFlags, Client } from 'xrpl';
import { delay, dropsToXrp, getDeliveredAmountBuy, getDeliveredAmountSell, getTransactionResult, xrpToDrops } from './helpers';
import { logger } from '../utils/logger';
import { config } from '../config/env';

// Constants
const REST_API_URL = config.HTTP_URL || 'https://s.altnet.rippletest.net:51234'; // Default XRPL REST API URL
const PURCHASE_AMOUNT_XRP = config.AMOUNT_XRP ? parseFloat(config.AMOUNT_XRP) : 0.01; // Default XRP amount to spend
const MAIN_WALLET = config.MAIN_WALLET || '';
const PROXY_LIST = config.PROXY_LIST || []; // Proxy list loaded from the environment variables

/**
 * Gets an Axios instance configured with a random proxy from the list.
 * @returns {AxiosInstance} Configured Axios instance with a proxy.
 */
function getAxiosWithRandomProxy(): AxiosInstance {
  if (!PROXY_LIST || PROXY_LIST.length === 0) {
    return axios; // No proxy, return default axios instance
  }

  // Select a random proxy from the list
  const randomProxy = PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];

  // Extract proxy details
  const [host, port, username, password] = randomProxy.split(':');

  // Create Axios instance with proxy
  const proxyConfig = {
    proxy: {
      host,
      port: parseInt(port, 10),
      auth: username && password ? { username, password } : undefined,
    },
  };

  return axios.create(proxyConfig);
}

/**
 * Swaps XRP for a token using a payment transaction.
 */
export async function swapXRPtoToken(
  client: Client,
  wallet: Wallet,
  currency: string,
  issuer: string,
  ticketSequence: number,
  id: number
): Promise<boolean> {
  const axiosInstance = getAxiosWithRandomProxy();
  try {
    const ledgerResponse = await axiosInstance.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10; // Buffer for ledger expiration

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: {
        currency,
        value: '1000000000000',
        issuer,
      },
      SendMax: xrpToDrops(PURCHASE_AMOUNT_XRP),
      Flags: PaymentFlags.tfPartialPayment,
      TicketSequence: ticketSequence,
      Fee: '2000',
      Sequence: 0,
      LastLedgerSequence: lastLedgerSequence,
      SourceTag: 555981,
    };

    const signed = wallet.sign(swapTxData);

    const submitResponse = await axiosInstance.post(REST_API_URL, {
      method: 'submit',
      params: [
        {
          tx_blob: signed.tx_blob,
          fail_hard: true,
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
    if (axios.isAxiosError(error)) {
      logger.error(`[${id}] Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.error(`[${id}] Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

/**
 * Transfers excess XRP to the main wallet if the balance exceeds 300 XRP.
 */
export async function sendToMain(wallet: Wallet): Promise<boolean> {
  const axiosInstance = getAxiosWithRandomProxy();
  try {
    const ledgerResponse = await axiosInstance.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    const accountInfoResponse = await axiosInstance.post(REST_API_URL, {
      method: 'account_info',
      params: [
        {
          account: wallet.address,
          ledger_index: 'validated',
        },
      ],
    });

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10;
    const accountData = accountInfoResponse.data.result.account_data;
    const balanceDrops = parseInt(accountData.Balance, 10);
    const sequence = accountData.Sequence;

    const XRP_PER_DROP = 1_000_000;
    const balanceXRP = balanceDrops / XRP_PER_DROP;

    if (balanceXRP > 300) {
      const excessXRP = balanceXRP - 300;
      const excessDrops = Math.floor(excessXRP * XRP_PER_DROP).toString();

      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: MAIN_WALLET,
        Amount: excessDrops,
        Fee: '100',
        Sequence: sequence,
        LastLedgerSequence: lastLedgerSequence,
      };

      const signed = wallet.sign(paymentTx);

      const submitResponse = await axiosInstance.post(REST_API_URL, {
        method: 'submit',
        params: [
          {
            tx_blob: signed.tx_blob,
            fail_hard: true,
          },
        ],
      });

      const result = submitResponse.data.result;

      if (result.engine_result === 'tesSUCCESS') {
        logger.info(`Transferência de ${excessXRP} XRP para MAIN_WALLET concluída com sucesso.`);
        return true;
      } else {
        logger.error(`Falha na transferência: ${result.engine_result_message}`);
        return false;
      }
    } else {
      logger.info('Saldo é menor ou igual a 300 XRP. Nenhuma transferência necessária.');
      return true;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Erro Axios: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.error(`Erro inesperado: ${(error as Error).message}`);
    }
    return false;
  }
}

/**
 * Swaps tokens back to XRP.
 */
export async function swapTokentoXRP(
  wallet: Wallet,
  currency: string,
  issuer: string,
  balance: string
): Promise<boolean> {
  const axiosInstance = getAxiosWithRandomProxy();
  try {
    const ledgerResponse = await axiosInstance.post(REST_API_URL, {
      method: 'ledger',
      params: [{ ledger_index: 'validated' }],
    });

    const accountInfoResponse = await axiosInstance.post(REST_API_URL, {
      method: 'account_info',
      params: [
        {
          account: wallet.address,
        },
      ],
    });

    const sequence = accountInfoResponse.data.result.account_data.Sequence;

    const validatedLedgerIndex = ledgerResponse.data.result.ledger_index;
    const lastLedgerSequence = validatedLedgerIndex + 10;

    const swapTxData: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: '10000000000000',
      SendMax: {
        currency,
        value: balance,
        issuer,
      },
      Flags: PaymentFlags.tfPartialPayment,
      Fee: '1000',
      Sequence: sequence,
      LastLedgerSequence: lastLedgerSequence,
    };

    const signed = wallet.sign(swapTxData);

    const submitResponse = await axiosInstance.post(REST_API_URL, {
      method: 'submit',
      params: [
        {
          tx_blob: signed.tx_blob,
          fail_hard: true,
        },
      ],
    });

    const result = submitResponse.data.result;

    if (result.engine_result === 'tesSUCCESS') {
      logger.info(`[SELL] - Swap successful.`);
      return true;
    } else {
      logger.error(`Swap failed: ${JSON.stringify(result, null, 2)}`);
      return false;
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Axios error: ${JSON.stringify(error.response?.data, null, 2)}`);
    } else {
      logger.error(`Unexpected error: ${(error as Error).message}`);
    }
    return false;
  }
}

/**
 * Swaps tokens back to XRP using a WebSocket client.
 */
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
      Amount: '1000000000000000',
      SendMax: {
        currency,
        value: tokenQuantity,
        issuer,
      },
      Flags: PaymentFlags.tfPartialPayment,
      Fee: '5000',
      SourceTag: 555981,
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
    logger.error(`[SELL] - Error during swap operation: ${(error as Error).message}`);
  }

  return 0;
}
