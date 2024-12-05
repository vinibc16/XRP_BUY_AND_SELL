export type TokenInfo = {
  currency: string | null;
  value: string;
  issuer?: string | null;
};
  
export type AmmInfo = {
  command: string;
  asset: {
    currency: string;
    issuer: string;
  };
  asset2: {
    currency: string;
    issuer: string | null;
  } | null;
  ledger_index: string;
};

export type TokenData = {
  token: string;
  issuer: string;
  qtyTokens: string;
  paidAmountXRP: number;
  hash: string;
  date: string;
};
