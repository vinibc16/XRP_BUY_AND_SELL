import { Client, TrustSetFlags, Wallet, Payment, TrustSet, PaymentFlags } from 'xrpl';
import { logger } from './logger';
import { swapTokentoXRP } from '../xrpl/swap';
import { hexToAscii } from '../xrpl/helpers';
import { setTrustLine } from '../xrpl/trustlines';

// Function to check and sell tokens, send tokens to issuer, and remove trustlines
export async function checkAndSellTokens(client: Client, wallet: Wallet) {
  try {
    logger.info("--- AUTO BURN Started ---"); // Log the start of the auto-burn process

    // Fetch the trustlines of the wallet
    const accountLines = await client.request({
      command: "account_lines",
      account: wallet.address,
    });

    const trustlines = accountLines.result.lines;

    // Iterate over each trustline
    for (const line of trustlines) {
        const { currency, balance, account: issuer } = line;

        logger.info(`Trying to burn ${hexToAscii(currency)} - ${issuer}`)
    
        // Variável para verificar o sucesso da venda ou devolução dos tokens
        let tokensProcessed = false;
        
        // Tentar vender os tokens primeiro
        if (parseFloat(balance) > 0) {
            try {
            await setTrustLine(client,wallet,currency,issuer);
            tokensProcessed = await swapTokentoXRP(wallet, currency, issuer, balance); // Trocar tokens por XRP
            } catch (error) {
            logger.info(`Error while selling tokens: ${error}`); // Logar erros durante a venda dos tokens
            }
        }
        
        // Tentar devolver os tokens para o emissor se não foram vendidos
        if (!tokensProcessed && parseFloat(balance) > 0) {
            try {
            // Configurar a transação de pagamento
            const paymentTx: Payment = {
                TransactionType: "Payment",
                Account: wallet.address,
                Destination: issuer, // Enviar tokens de volta ao emissor
                Amount: {
                currency: currency,
                issuer: issuer,
                value: balance.toString(), // Saldo de tokens a ser enviado
                },
                SendMax: {
                currency: currency,
                value: balance.toString(), // Quantidade máxima a ser enviada
                issuer: issuer,
                },
                Flags: PaymentFlags.tfPartialPayment, // Flag de pagamento parcial
            };
        
            // Autofill da transação com detalhes de taxa e ledger
            const preparedPayment = await client.autofill(paymentTx);
            const signedPaymentTx = wallet.sign(preparedPayment);
            await client.submitAndWait(signedPaymentTx.tx_blob); // Submeter a transação e aguardar confirmação
            logger.info(`[BURN] Tokens sent back to issuer: ${currency}`); // Logar sucesso na devolução dos tokens
            tokensProcessed = true;
            } catch (error) {
            logger.info(`Error while sending tokens to issuer: ${error}`); // Logar erros na devolução dos tokens
            }
        }
        
        // Somente tente remover a trustline se o saldo for zero
        if (parseFloat(balance) === 0 || tokensProcessed) {
            try {
            // Configurar a transação de remoção de trustline
            const trustSetTx: TrustSet = {
                TransactionType: "TrustSet",
                Account: wallet.address,
                LimitAmount: {
                currency: currency,
                issuer: issuer,
                value: "0", // Remover trustline configurando o limite para zero
                },
                Flags: TrustSetFlags.tfSetNoRipple | TrustSetFlags.tfClearFreeze, // Setar No Ripple e limpar flags de congelamento
            };
        
            // Autofill da transação com detalhes de taxa e ledger
            const preparedTrustSet = await client.autofill(trustSetTx);
            const signedTrustSetTx = wallet.sign(preparedTrustSet);
            await client.submitAndWait(signedTrustSetTx.tx_blob); // Submeter a transação e aguardar confirmação
            logger.info(`[TRUSTSET] Trustline removed for ${currency}`); // Logar sucesso na remoção da trustline
            } catch (error) {
            logger.info(`Error while removing trustline for ${currency}: ${error}`); // Logar erros na remoção da trustline
            }
        } else {
            logger.info(`Skipping trustline removal for ${currency} due to non-zero balance.`); // Logar quando a remoção for ignorada
        }
    }
    logger.info("--- AUTO BURN Finished ---"); // Log the end of the auto-burn process
  } catch (error) {
    logger.error(`Unexpected error: ${error}`); // Log any unexpected errors
  }
}