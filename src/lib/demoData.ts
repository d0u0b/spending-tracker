import { clearAll, db } from '../db/db';
import type { Account, Holding, LoanTerms, Snapshot, Transaction } from '../db/types';
import { ASSET_CLASSES, type AssetClassId } from '../domain/assetClasses';
import { remainingPrincipal } from '../domain/loan';
import { computeSummary, latestBalanceMap, toSnapshot } from '../domain/valuation';
import { getFxRates } from '../services/fx';
import { getQuotes } from '../services/quotes/quoteService';
import { addDays, todayStr } from './date';

interface DemoAccount {
  name: string;
  cls: AssetClassId;
  subtype: string;
  inst?: string;
  currency?: string;
  balance?: number;
  loan?: LoanTerms;
  holdings?: Omit<Holding, 'id' | 'accountId'>[];
}

const DEMO: DemoAccount[] = [
  { name: '錢包', cls: 'cash', subtype: 'wallet', balance: 8_500 },
  { name: '國泰世華 薪轉', cls: 'deposit', subtype: 'demand', inst: '國泰世華', balance: 356_000 },
  { name: '中信 一年定存', cls: 'deposit', subtype: 'time', inst: '中國信託', balance: 500_000 },
  { name: '玉山 美元帳戶', cls: 'deposit', subtype: 'foreign', inst: '玉山銀行', currency: 'USD', balance: 12_000 },
  {
    name: '元大 台股',
    cls: 'stock',
    subtype: 'tw',
    inst: '元大證券',
    holdings: [
      { symbol: 'TW:2330', name: '台積電', quantity: 200, avgCost: 980 },
      { symbol: 'TW:0050', name: '元大台灣50', quantity: 3000, avgCost: 85 },
      { symbol: 'TW:00679B', name: '元大美債20年', quantity: 5000, avgCost: 28 },
    ],
  },
  {
    name: '富邦 複委託',
    cls: 'stock',
    subtype: 'us',
    inst: '富邦證券',
    holdings: [
      { symbol: 'US:VOO', name: 'Vanguard S&P 500 ETF', quantity: 30, avgCost: 480 },
      { symbol: 'US:AAPL', name: 'Apple', quantity: 40, avgCost: 190 },
    ],
  },
  { name: '基富通 全球股票基金', cls: 'fund', subtype: 'offshore', inst: '基富通', balance: 180_000 },
  { name: '元大期貨 保證金', cls: 'futures', subtype: 'futures', inst: '元大期貨', balance: 120_000 },
  {
    name: 'Binance',
    cls: 'crypto',
    subtype: 'exchange',
    inst: 'Binance',
    holdings: [{ symbol: 'CRYPTO:BTC', name: 'BTC', quantity: 0.05, avgCost: 60_000 }],
  },
  { name: '自住 公寓', cls: 'realEstate', subtype: 'residence', balance: 12_800_000 },
  { name: '國壽 儲蓄險', cls: 'insurance', subtype: 'savings', inst: '國泰人壽', balance: 420_000 },
  {
    name: '富邦 房貸',
    cls: 'loan',
    subtype: 'mortgage',
    inst: '台北富邦',
    loan: { principal: 9_000_000, annualRate: 2.185, termMonths: 360, startDate: '2021-06-01' },
  },
  {
    name: '永豐 信貸',
    cls: 'loan',
    subtype: 'personal',
    inst: '永豐銀行',
    loan: { principal: 600_000, annualRate: 3.5, termMonths: 84, startDate: '2024-03-01' },
  },
  {
    name: '台新 車貸',
    cls: 'loan',
    subtype: 'auto',
    inst: '台新銀行',
    loan: { principal: 800_000, annualRate: 2.8, termMonths: 60, startDate: '2023-09-01' },
  },
  { name: '玉山 信用卡', cls: 'creditCard', subtype: 'card', inst: '玉山銀行', balance: 23_450 },
];

/** 往回推算歷史時，各類別每日的漂移與波動 */
const WALK: Partial<Record<AssetClassId, [drift: number, vol: number]>> = {
  cash: [0, 0.04],
  deposit: [0.0004, 0.003],
  stock: [0.0005, 0.012],
  fund: [0.0003, 0.007],
  futures: [0, 0.02],
  crypto: [0.001, 0.03],
  realEstate: [0.00015, 0.0004],
  insurance: [0.0002, 0],
  loan: [-0.00025, 0],
  creditCard: [0, 0.06],
};

function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

/** 清空資料並寫入一組範例帳戶、兩年快照與近兩個月記帳 */
export async function loadDemoData() {
  await clearAll();
  const today = todayStr();
  const institutions = await db.institutions.toArray();
  const instId = (short?: string) => institutions.find((i) => i.shortName === short)?.id;

  for (const d of DEMO) {
    const account: Account = {
      name: d.name,
      assetClass: d.cls,
      subtype: d.subtype,
      institutionId: instId(d.inst),
      currency: d.currency ?? 'TWD',
      loan: d.loan,
      archived: 0,
      createdAt: Date.now(),
    };
    const id = (await db.accounts.add(account)) as number;
    const balance = d.loan ? Math.round(remainingPrincipal(d.loan, today)) : d.balance;
    if (balance != null) await db.balances.add({ accountId: id, date: today, amount: balance });
    if (d.holdings) await db.holdings.bulkAdd(d.holdings.map((h) => ({ ...h, accountId: id })));
  }

  // 以目前估值為終點，往回隨機漫步產生歷史快照
  const [accounts, balances, holdings] = await Promise.all([db.accounts.toArray(), db.balances.toArray(), db.holdings.toArray()]);
  // 先抓一次報價，讓今天的快照跟畫面上的即時估值一致
  const [quotes, fx] = await Promise.all([getQuotes(holdings.map((h) => h.symbol)).catch(() => ({})), getFxRates()]);
  const now = computeSummary(accounts, latestBalanceMap(balances), holdings, quotes, fx);

  const snapshots: Snapshot[] = [];
  const values = { ...now.byClass };
  for (let i = 0; i <= 730; i++) {
    const date = addDays(today, -i);
    let assets = 0;
    let liabilities = 0;
    for (const [cls, v] of Object.entries(values) as [AssetClassId, number][]) {
      if (ASSET_CLASSES[cls].side === 'asset') assets += v;
      else liabilities += v;
    }
    snapshots.push(toSnapshot(date, { assets, liabilities, net: assets - liabilities, byClass: { ...values }, accounts: [] }));

    for (const cls of Object.keys(values) as AssetClassId[]) {
      const [drift, vol] = WALK[cls] ?? [0, 0];
      values[cls] = Math.max(0, values[cls]! / (1 + drift + vol * gaussian()));
    }
  }
  await db.snapshots.bulkPut(snapshots);

  // 記帳：本月與上個月
  const cats = await db.categories.toArray();
  const expense = cats.filter((c) => c.kind === 'expense');
  const salary = cats.find((c) => c.name === '薪資');
  const card = accounts.find((a) => a.assetClass === 'creditCard')?.id;
  const txns: Transaction[] = [];
  for (let i = 0; i < 60; i++) {
    const date = addDays(today, -i);
    if (date.endsWith('-05')) txns.push({ date, kind: 'income', amount: 68_000, categoryId: salary?.id, note: '薪資', createdAt: Date.now() });
    const n = Math.floor(Math.random() * 3) + 1;
    for (let k = 0; k < n; k++) {
      const c = expense[Math.floor(Math.random() * Math.min(expense.length, 8))];
      const amount = Math.round((c.name === '餐飲' ? 80 + Math.random() * 400 : 100 + Math.random() * 1800) / 5) * 5;
      txns.push({ date, kind: 'expense', amount, categoryId: c.id, accountId: Math.random() < 0.5 ? card : undefined, createdAt: Date.now() });
    }
  }
  await db.transactions.bulkAdd(txns);
}
