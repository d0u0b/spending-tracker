import { useCallback, useEffect, useState } from 'react';
import { getCachedFx, getFxRates, type FxRates } from '../services/fx';
import { getCachedQuote, getQuotes } from '../services/quotes/quoteService';
import type { Quote } from '../services/quotes/types';

type CachedQuote = Quote & { fetchedAt: number };

function fromCache(symbols: string[]) {
  const out: Record<string, CachedQuote> = {};
  for (const s of symbols) {
    const q = getCachedQuote(s);
    if (q) out[s] = q;
  }
  return out;
}

const POLL_MS = 60_000;

/**
 * 報價與匯率。每分鐘輪詢一次（頁面隱藏時暫停），
 * 是否真的打 API 由 quoteService 依開收盤 TTL 決定。
 */
export function useMarketData(symbols: string[]) {
  const key = symbols.join(',');
  const [quotes, setQuotes] = useState(() => fromCache(symbols));
  const [fx, setFx] = useState<FxRates>(getCachedFx);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (force = false) => {
      const list = key ? key.split(',') : [];
      setRefreshing(true);
      try {
        const [q, rates] = await Promise.all([list.length ? getQuotes(list, { force }) : {}, getFxRates()]);
        setQuotes(q);
        setFx(rates);
      } finally {
        setRefreshing(false);
      }
    },
    [key],
  );

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === 'visible' && load();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const updatedAt = Object.values(quotes).reduce((m, q) => Math.max(m, q.fetchedAt), 0) || undefined;

  return { quotes, fx, refreshing, updatedAt, refresh: () => load(true) };
}
