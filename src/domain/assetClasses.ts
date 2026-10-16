import type { InstitutionType } from '../db/types';

export type Side = 'asset' | 'liability';

/** balance：手動記錄餘額；holdings：持有數量 × 即時報價 */
export type ValuationMode = 'balance' | 'holdings';

export interface AssetClassDef {
  label: string;
  side: Side;
  mode: ValuationMode;
  /** 圖表用色，亮暗模式都能辨識 */
  color: string;
  subtypes: Record<string, string>;
  /** 可選擇的金融機構類型；空陣列代表不需要機構 */
  institutionTypes: InstitutionType[];
}

export const ASSET_CLASSES = {
  cash: {
    label: '現金',
    side: 'asset',
    mode: 'balance',
    color: '#94a3b8',
    subtypes: { wallet: '現金', prepaid: '電子票證／儲值' },
    institutionTypes: [],
  },
  deposit: {
    label: '存款',
    side: 'asset',
    mode: 'balance',
    color: '#3b82f6',
    subtypes: { demand: '活期存款', time: '定期存款', foreign: '外幣存款', foreignTime: '外幣定存' },
    institutionTypes: ['bank'],
  },
  stock: {
    label: '股票',
    side: 'asset',
    mode: 'holdings',
    color: '#8b5cf6',
    subtypes: { tw: '台股', us: '美股（複委託／海外券商）', other: '其他市場' },
    institutionTypes: ['broker'],
  },
  fund: {
    label: '基金',
    side: 'asset',
    mode: 'balance',
    color: '#06b6d4',
    subtypes: { domestic: '境內基金', offshore: '境外基金', moneyMarket: '貨幣型基金' },
    institutionTypes: ['bank', 'fund', 'broker'],
  },
  futures: {
    label: '期貨',
    side: 'asset',
    mode: 'balance',
    color: '#f59e0b',
    subtypes: { futures: '期貨保證金', options: '選擇權' },
    institutionTypes: ['futures'],
  },
  crypto: {
    label: '加密貨幣',
    side: 'asset',
    mode: 'holdings',
    color: '#f97316',
    subtypes: { exchange: '交易所', wallet: '自管錢包' },
    institutionTypes: ['crypto'],
  },
  realEstate: {
    label: '不動產',
    side: 'asset',
    mode: 'balance',
    color: '#10b981',
    subtypes: { residence: '自住', investment: '投資／出租', land: '土地', parking: '車位' },
    institutionTypes: [],
  },
  insurance: {
    label: '保險',
    side: 'asset',
    mode: 'balance',
    color: '#ec4899',
    subtypes: { savings: '儲蓄險', investmentLinked: '投資型保單', annuity: '年金險' },
    institutionTypes: ['insurance'],
  },
  otherAsset: {
    label: '其他資產',
    side: 'asset',
    mode: 'balance',
    color: '#a3a3a3',
    subtypes: { vehicle: '車輛', receivable: '應收款項', other: '其他' },
    institutionTypes: [],
  },
  loan: {
    label: '貸款',
    side: 'liability',
    mode: 'balance',
    color: '#ef4444',
    subtypes: {
      mortgage: '房貸',
      personal: '信貸',
      auto: '車貸',
      student: '學貸',
      pledge: '股票質押／借貸',
      other: '其他貸款',
    },
    institutionTypes: ['bank', 'broker', 'other'],
  },
  creditCard: {
    label: '信用卡',
    side: 'liability',
    mode: 'balance',
    color: '#f43f5e',
    subtypes: { card: '信用卡' },
    institutionTypes: ['bank'],
  },
  otherLiability: {
    label: '其他負債',
    side: 'liability',
    mode: 'balance',
    color: '#be123c',
    subtypes: { family: '親友借款', payable: '應付款項', other: '其他' },
    institutionTypes: [],
  },
} as const satisfies Record<string, AssetClassDef>;

export type AssetClassId = keyof typeof ASSET_CLASSES;

export const ASSET_CLASS_IDS = Object.keys(ASSET_CLASSES) as AssetClassId[];

export function classDef(id: AssetClassId): AssetClassDef {
  return ASSET_CLASSES[id];
}

export function subtypeLabel(id: AssetClassId, subtype: string): string {
  return (classDef(id).subtypes as Record<string, string>)[subtype] ?? subtype;
}

export const CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP', 'AUD'] as const;
export type Currency = (typeof CURRENCIES)[number];
