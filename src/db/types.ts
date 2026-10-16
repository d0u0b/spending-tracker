import type { AssetClassId } from '../domain/assetClasses';

export type InstitutionType = 'bank' | 'broker' | 'futures' | 'fund' | 'insurance' | 'crypto' | 'other';

export interface Institution {
  id?: number;
  name: string;
  /** 顯示用短名，例如「國泰世華」 */
  shortName: string;
  type: InstitutionType;
  /** 銀行代碼（例如 013），券商可留空 */
  code?: string;
  builtin: 0 | 1;
}

export interface LoanTerms {
  principal: number;
  /** 年利率，百分比，例如 2.185 */
  annualRate: number;
  termMonths: number;
  /** 首次撥款日 YYYY-MM-DD */
  startDate: string;
}

export interface Account {
  id?: number;
  name: string;
  assetClass: AssetClassId;
  subtype: string;
  institutionId?: number;
  currency: string;
  note?: string;
  loan?: LoanTerms;
  /** 0/1 方便 IndexedDB 建索引 */
  archived: 0 | 1;
  createdAt: number;
}

/** 手動記錄的餘額。負債一律存正數（欠多少） */
export interface BalanceEntry {
  id?: number;
  accountId: number;
  date: string;
  amount: number;
}

export interface Holding {
  id?: number;
  accountId: number;
  /** 內部統一代號：TW:2330、US:AAPL、CRYPTO:BTC */
  symbol: string;
  name?: string;
  quantity: number;
  /** 平均成本（報價幣別） */
  avgCost?: number;
}

/** 每日資產快照，趨勢圖的資料來源（金額皆為台幣） */
export interface Snapshot {
  date: string;
  assets: number;
  liabilities: number;
  net: number;
  byClass: Partial<Record<AssetClassId, number>>;
}

export type TxnKind = 'expense' | 'income';

export interface Category {
  id?: number;
  name: string;
  kind: TxnKind;
  order: number;
}

export interface Transaction {
  id?: number;
  date: string;
  kind: TxnKind;
  amount: number;
  categoryId?: number;
  accountId?: number;
  note?: string;
  createdAt: number;
}
