import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { db } from '../db/db';
import { computeSummary, latestBalanceMap, toSnapshot } from '../domain/valuation';
import { todayStr } from '../lib/date';
import { useMarketData } from './useMarketData';

/** 目前所有帳戶的估值，並自動寫入今日快照供趨勢圖使用 */
export function usePortfolio() {
  const accounts = useLiveQuery(() => db.accounts.where('archived').equals(0).toArray(), []);
  const balances = useLiveQuery(() => db.balances.toArray(), []);
  const holdings = useLiveQuery(() => db.holdings.toArray(), []);

  const symbols = useMemo(() => [...new Set((holdings ?? []).map((h) => h.symbol))].sort(), [holdings]);
  const market = useMarketData(symbols);

  const summary = useMemo(() => {
    if (!accounts || !balances || !holdings) return undefined;
    return computeSummary(accounts, latestBalanceMap(balances), holdings, market.quotes, market.fx);
  }, [accounts, balances, holdings, market.quotes, market.fx]);

  useEffect(() => {
    if (!summary?.accounts.length) return;
    const t = setTimeout(() => db.snapshots.put(toSnapshot(todayStr(), summary)), 800);
    return () => clearTimeout(t);
  }, [summary]);

  return { summary, ...market };
}
