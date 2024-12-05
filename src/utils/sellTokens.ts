import { Client, Wallet } from 'xrpl';
import { logger } from './logger';
import { infoAmm } from '../xrpl/amm';
import { swapTokentoXRP, swapTokentoXRPWS } from '../xrpl/swap';
import { update, readFile, add } from '../data/manageData';
import { config } from '../config/env'; 
import { delay, dropsToXrp } from '../xrpl/helpers';
import { AmmInfo } from '../types';

export async function newToken(wallet: any, tx: any) {
  try {
    const transaction = tx.tx_json || tx;
    if (transaction?.TransactionType === 'Payment' && transaction.Account === wallet.address) {
      
      if (transaction.DeliverMax?.currency) {
        const tokensDelivered = tx.meta.DeliveredAmount.value;
        const xrpPaid = dropsToXrp(transaction.SendMax);
        const currency = tx.meta.DeliveredAmount.currency;
        const issuer = tx.meta.DeliveredAmount.issuer;
        logger.info(`Received ${tokensDelivered} tokens and paid ${xrpPaid}`);
        add(currency,issuer,wallet.address,parseFloat(xrpPaid),0,tokensDelivered,tokensDelivered);
      }
    }
  } catch (err) {
    logger.error(`Unexpected error in token monitoring routine: ${err}`);
  }
}

// Function to process tokens and monitor targets
async function processTokens(client: Client, wallet: Wallet) {
  try {
    const data = readFile(); // Reads token data from the JSON file

    for (const token of data) {
      const {
        currency,
        issuer,
        wallet: tokenWallet,
        buyAmount,
        totalTokensInicial,
        tokensBalance,
        target1Achieved,
        target2Achieved,
        target3Achieved,
        target4Achieved,
        target5Achieved,
        target6Achieved,
        target7Achieved,
        target8Achieved,
        target9Achieved,
        target10Achieved,
      } = token;

      try {
        const tokenValue = await infoAmm(currency, issuer); // Current token value in XRP
        const initialUnitValue = buyAmount / totalTokensInicial; // Initial token price in XRP

        // Configure targets based on the environment configuration
        const targets = [
          { multiplier: config.TARGET1 / 100, achieved: target1Achieved, field: 'target1Achieved' },
          { multiplier: config.TARGET2 / 100, achieved: target2Achieved, field: 'target2Achieved' },
          { multiplier: config.TARGET3 / 100, achieved: target3Achieved, field: 'target3Achieved' },
          { multiplier: config.TARGET4 / 100, achieved: target4Achieved, field: 'target4Achieved' },
          { multiplier: config.TARGET5 / 100, achieved: target5Achieved, field: 'target5Achieved' },
          { multiplier: config.TARGET6 / 100, achieved: target6Achieved, field: 'target6Achieved' },
          { multiplier: config.TARGET7 / 100, achieved: target7Achieved, field: 'target7Achieved' },
          { multiplier: config.TARGET8 / 100, achieved: target8Achieved, field: 'target8Achieved' },
          { multiplier: config.TARGET9 / 100, achieved: target9Achieved, field: 'target9Achieved' },
          { multiplier: config.TARGET10 / 100, achieved: target10Achieved, field: 'target10Achieved' },
        ];

        const percentages = [config.TARGET1_PERC / 100,
                             config.TARGET2_PERC / 100,
                             config.TARGET3_PERC / 100,
                             config.TARGET4_PERC / 100,
                             config.TARGET5_PERC / 100,
                             config.TARGET6_PERC / 100,
                             config.TARGET7_PERC / 100,
                             config.TARGET8_PERC / 100,
                             config.TARGET9_PERC / 100,
                             config.TARGET10_PERC/ 100,
                            ]; // Sell percentage for each target

        for (let i = 0; i < targets.length; i++) {
          const { multiplier, achieved, field } = targets[i];
        
          // Para todos os alvos após o primeiro, verifica se o alvo anterior foi atingido
          if (i > 0 && !targets[i - 1].achieved) {
            break; // Sai do loop se o alvo anterior não foi alcançado
          }
        
          // Ignora se o alvo atual já foi atingido
          if (achieved) {
            continue;
          }
        
          // Calcula o valor do target
          const targetValue = initialUnitValue * multiplier;
        
          // Verifica se o valor atual do token atingiu o alvo
          if (tokenValue >= targetValue && tokensBalance > 0) {
            try {
              const sellPercentage = percentages[i];
              const tokensToSell = totalTokensInicial * sellPercentage;
              const newBalance = tokensBalance - tokensToSell;
        
              // Executa a venda dos tokens
              const sellResult = await swapTokentoXRPWS(client, wallet, currency, issuer, tokensToSell.toString());
        
              if (sellResult > 0) {
                // Atualiza os dados após a venda
                update(
                  currency,
                  issuer,
                  tokenWallet,
                  undefined, // buyAmount remains unchanged
                  (token.sellAmount || 0) + sellResult, // Update sellAmount
                  undefined, // totalTokensInicial remains unchanged
                  newBalance, // Update tokensBalance
                  { [field]: true }, // Marca o alvo como atingido
                  tokensToSell,
                  i + 1
                );
                logger.info(`Sold ${tokensToSell} of ${currency} at target ${multiplier * 100}%`);
        
                // Interrompe o loop após atingir um alvo
                break;
              }
            } catch (sellError) {
              logger.error(`Error selling tokens for target ${multiplier * 100}%: ${sellError}`);
            }
          }
        }                                      
      } catch (err) {
        logger.error(`Error processing token ${currency}: ${err}`); // Log errors for individual token processing
      }
    }
  } catch (err) {
    logger.error(`Failed to process tokens: ${err}`); // Log general processing errors
  }
}


export function startTokenMonitor(client: Client, wallet: Wallet) {
  // Função para iniciar o processo de monitoramento
  const runProcessTokens = () => {
    processTokens(client, wallet)
      .then(() => {
        logger.log('Token processing completed successfully.');
      })
      .catch((err) => {
        logger.error(`Error in token monitor: ${err}`); // Log errors during token monitoring
      })
      .finally(() => {
        // Agendar a próxima execução após a conclusão
        logger.info(`Sell checked!`)
        setTimeout(runProcessTokens, 10 * 1000); // Runs every 10s
      });
  };

  // Inicia o monitoramento
  runProcessTokens();
}
