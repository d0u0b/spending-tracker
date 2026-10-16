import type { Account, BalanceEntry, Holding, Snapshot } from '../db/types';
import { toTWD, type FxRates } from '../services/fx';
import { marketCurrency, parseSymbol, type Quote } from '../services/quotes/types';
import { ASSET_CLASSES, type AssetClassId } from './assetClasses';

export interface HoldingValue {
  holding: Holding;
  quote?: Quote;
  price: number;
  currency: string;
  /** 台幣市值 */
  value: number;
  /** 台幣未實現損益（有成本才算） */
  pnl?: number;
  /** 今日漲跌（台幣） */
  dayChange: number;
}

export interface AccountValue {
  account: Account;
  /** 台幣金額，負債也是正數 */
  value: number;
  /** 帳戶原幣金額（balance 模式才有意義） */
  native?: number;
  lastUpdated?: string;
  holdings?: HoldingValue[];
}

export interface PortfolioSummary {
  assets: number;
  liabilities: number;
  net: number;
  byClass: Partial<Record<AssetClassId, number>>;
  accounts: AccountValue[];
}

export function valueHolding(h: Holding, quote: Quote | undefined, fx: FxRates): HoldingValue {
  const currency = quote?.currency ?? marketCurrency(parseSymbol(h.symbol).market);
  // 沒有報價時先用成本估，避免總額突然掉成 0
  const price = quote?.price ?? h.avgCost ?? 0;
  const value = toTWD(h.quantity * price, currency, fx);
  const pnl = h.avgCost != null ? toTWD(h.quantity * (price - h.avgCost), currency, fx) : undefined;
  const dayChange = quote ? toTWD(h.quantity * quote.change, currency, fx) : 0;
  return { holding: h, quote, price, currency, value, pnl, dayChange };
}

export function computeSummary(
  accounts: Account[],
  latestBalances: Map<number, BalanceEntry>,
  holdings: Holding[],
  quotes: Record<string, Quote>,
  fx: FxRates,
): PortfolioSummary {
  const holdingsByAccount = new Map<number, Holding[]>();
  for (const h of holdings) {
    const list = holdingsByAccount.get(h.accountId) ?? [];
    list.push(h);
    holdingsByAccount.set(h.accountId, list);
  }

  const summary: PortfolioSummary = { assets: 0, liabilities: 0, net: 0, byClass: {}, accounts: [] };

  for (const account of accounts) {
    const def = ASSET_CLASSES[account.assetClass];
    let av: AccountValue;
    if (def.mode === 'holdings') {
      const hv = (holdingsByAccount.get(account.id!) ?? []).map((h) => valueHolding(h, quotes[h.symbol], fx));
      av = { account, value: hv.reduce((s, x) => s + x.value, 0), holdings: hv };
    } else {
      const b = latestBalances.get(account.id!);
      const native = b?.amount ?? 0;
      av = { account, value: toTWD(native, account.currency, fx), native, lastUpdated: b?.date };
    }

    summary.accounts.push(av);
    summary.byClass[account.assetClass] = (summary.byClass[account.assetClass] ?? 0) + av.value;
    if (def.side === 'asset') summary.assets += av.value;
    else summary.liabilities += av.value;
  }

  summary.net = summary.assets - summary.liabilities;
  return summary;
}

export function toSnapshot(date: string, s: PortfolioSummary): Snapshot {
  const byClass: Snapshot['byClass'] = {};
  for (const [k, v] of Object.entries(s.byClass)) byClass[k as AssetClassId] = Math.round(v);
  return { date, assets: Math.round(s.assets), liabilities: Math.round(s.liabilities), net: Math.round(s.net), byClass };
}

/** 每個帳戶取日期最新的一筆餘額 */
export function latestBalanceMap(entries: BalanceEntry[]): Map<number, BalanceEntry> {
  const map = new Map<number, BalanceEntry>();
  for (const e of entries) {
    const cur = map.get(e.accountId);
    if (!cur || e.date > cur.date || (e.date === cur.date && (e.id ?? 0) > (cur.id ?? 0))) map.set(e.accountId, e);
  }
  return map;
}
