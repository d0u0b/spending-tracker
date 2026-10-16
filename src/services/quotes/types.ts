/** 內部統一代號：TW:2330、US:AAPL、CRYPTO:BTC */
export type Market = 'TW' | 'US' | 'CRYPTO';

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  name?: string;
  /** 報價時間 (ms) */
  time: number;
  source: string;
}

export interface QuoteProvider {
  name: string;
  /** 同一個 provider 兩次呼叫之間的最短間隔 */
  minIntervalMs: number;
  supports(symbol: string): boolean;
  /** 批次查詢；查不到的代號直接略過，不要 throw */
  fetch(symbols: string[]): Promise<Quote[]>;
}

export function parseSymbol(symbol: string): { market: Market; code: string } {
  const [market, ...rest] = symbol.split(':');
  return { market: market as Market, code: rest.join(':') };
}

export function marketCurrency(market: Market): string {
  return market === 'TW' ? 'TWD' : 'USD';
}
