import axios from 'axios';
import { logger } from '../utils/logger';
import { AmmInfo } from '../types';
import { config } from '../config/env';

const REST_API_URL = config.HTTP_URL || 'https://s.altnet.rippletest.net:51234'; // Default XRPL REST API URL

export async function infoAmm(currency: string, issuer: string): Promise<number> {
  try {
    const ammInfoRequest = {
      method: 'amm_info',
      params: [
        {
          asset: {
            currency: currency,
            issuer: issuer || null, // Define o issuer como null se não fornecido
          },
          asset2: {
            currency: 'XRP',
            issuer: null, // issuer obrigatório como null para XRP
          },
          ledger_index: 'validated',
        },
      ],
    };

    // Requisição para obter informações do AMM
    const response = await axios.post(REST_API_URL, ammInfoRequest);
    
    const result = response.data.result;

    if (!result || !result.amm) {
      throw new Error('AMM data not found in response.');
    }

    const amm = result.amm;
    
    // Converte os valores para float
    const amount = parseFloat(amm.amount?.value || '0'); // Quantidade do ativo principal
    const amount2 = parseFloat(amm.amount2 || '0'); // Quantidade do ativo secundário (em drops de XRP)

    if (amount === 0 || amount2 === 0) {
      throw new Error('Invalid AMM values: amount or amount2 is zero.');
    }

    // Calcula o valor do token (amount2 em XRP dividido pela quantidade do token)
    const tokenValue = (amount2 / 1_000_000) / amount;

    return tokenValue; // Retorna o valor calculado do token
  } catch (err) {
    // Loga qualquer erro encontrado durante a obtenção das informações do AMM
    if (axios.isAxiosError(err)) {
      logger.error(`Axios error: ${JSON.stringify(err.response?.data, null, 2)}`);
    } else {
      logger.error(`Unexpected error: ${(err as Error).message}`);
    }
    return 0; // Retorna 0 em caso de erro
  }
}