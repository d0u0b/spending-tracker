import { marketCurrency, parseSymbol, type Quote, type QuoteProvider } from './types';

/**
 * 以下端點皆為免 API key、允許 CORS 的公開端點，但都不是官方文件化的 API，
 * 隨時可能改版。新增或替換 provider 時只要實作 QuoteProvider 即可。
 */

// ---------- 鉅亨 cnyes：台股（上市、上櫃、ETF 都用 TWS）與美股 ----------
const CNYES_PREFIX = { TW: 'TWS', US: 'USS' } as const;

export const cnyesProvider: QuoteProvider = {
  name: 'cnyes',
  minIntervalMs: 10_000,
  supports: (s) => {
    const { market } = parseSymbol(s);
    return market === 'TW' || market === 'US';
  },
  async fetch(symbols) {
    const toRemote = new Map<string, string>();
    for (const s of symbols) {
      const { market, code } = parseSymbol(s);
      toRemote.set(`${CNYES_PREFIX[market as 'TW' | 'US']}:${code}:STOCK`, s);
    }
    const url = `https://ws.api.cnyes.com/ws/api/v1/quote/quotes/${[...toRemote.keys()].join(',')}?column=G`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`cnyes ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json?.data)) return [];

    const quotes: Quote[] = [];
    for (const r of json.data as Record<string, unknown>[]) {
      const symbol = toRemote.get(String(r['0']));
      const price = Number(r['6']);
      if (!symbol || !Number.isFinite(price)) continue;
      quotes.push({
        symbol,
        price,
        change: Number(r['11']) || 0,
        changePct: Number(r['56']) || 0,
        currency: marketCurrency(parseSymbol(symbol).market),
        name: typeof r['200009'] === 'string' ? r['200009'] : undefined,
        time: Number(r['200007']) * 1000 || Date.now(),
        source: 'cnyes',
      });
    }
    return quotes;
  },
};

// ---------- TradingView scanner：備援，需要指定交易所 ----------
const TV_EXCHANGES = { TW: ['TWSE', 'TPEX'], US: ['NASDAQ', 'NYSE', 'AMEX'] } as const;

export const tradingViewProvider: QuoteProvider = {
  name: 'tradingview',
  minIntervalMs: 15_000,
  supports: (s) => {
    const { market } = parseSymbol(s);
    return market === 'TW' || market === 'US';
  },
  async fetch(symbols) {
    // 不知道是上市還是上櫃、NASDAQ 還是 NYSE，就全部送出，取有回傳的
    const toRemote = new Map<string, string>();
    for (const s of symbols) {
      const { market, code } = parseSymbol(s);
      for (const ex of TV_EXCHANGES[market as 'TW' | 'US']) toRemote.set(`${ex}:${code}`, s);
    }
    const res = await fetch('https://scanner.tradingview.com/global/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // 用 simple request 避免 preflight
      body: JSON.stringify({
        symbols: { tickers: [...toRemote.keys()] },
        columns: ['close', 'change', 'change_abs', 'description', 'currency'],
      }),
    });
    if (!res.ok) throw new Error(`tradingview ${res.status}`);
    const json = await res.json();

    const quotes = new Map<string, Quote>();
    for (const row of (json?.data ?? []) as { s: string; d: unknown[] }[]) {
      const symbol = toRemote.get(row.s);
      const [close, changePct, changeAbs, description, currency] = row.d;
      if (!symbol || quotes.has(symbol) || typeof close !== 'number') continue;
      quotes.set(symbol, {
        symbol,
        price: close,
        change: Number(changeAbs) || 0,
        changePct: Number(changePct) || 0,
        currency: typeof currency === 'string' ? currency : marketCurrency(parseSymbol(symbol).market),
        name: typeof description === 'string' ? description : undefined,
        time: Date.now(),
        source: 'tradingview',
      });
    }
    return [...quotes.values()];
  },
};

// ---------- Binance：加密貨幣，以 USDT 計價視為 USD ----------
export const binanceProvider: QuoteProvider = {
  name: 'binance',
  minIntervalMs: 5_000,
  supports: (s) => parseSymbol(s).market === 'CRYPTO',
  async fetch(symbols) {
    const fetchOne = async (pairs: string[]) => {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`binance ${res.status}`);
      return (await res.json()) as { symbol: string; lastPrice: string; priceChange: string; priceChangePercent: string; closeTime: number }[];
    };
    const toRemote = new Map(symbols.map((s) => [`${parseSymbol(s).code.toUpperCase()}USDT`, s]));
    const pairs = [...toRemote.keys()];

    // 只要有一個代號無效，Binance 整批回 400；這時改成逐一查詢
    let rows: Awaited<ReturnType<typeof fetchOne>>;
    try {
      rows = await fetchOne(pairs);
    } catch {
      const results = await Promise.allSettled(pairs.map((p) => fetchOne([p])));
      rows = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    }

    return rows.flatMap((r) => {
      const symbol = toRemote.get(r.symbol);
      if (!symbol) return [];
      return [
        {
          symbol,
          price: Number(r.lastPrice),
          change: Number(r.priceChange),
          changePct: Number(r.priceChangePercent),
          currency: 'USD',
          name: parseSymbol(symbol).code.toUpperCase(),
          time: r.closeTime,
          source: 'binance',
        },
      ];
    });
  },
};

/** 依序嘗試，前面的失敗或冷卻中就換下一個 */
export const DEFAULT_PROVIDERS: QuoteProvider[] = [cnyesProvider, tradingViewProvider, binanceProvider];
