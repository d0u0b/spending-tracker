import Dexie, { type EntityTable, type Table } from 'dexie';
import { CATEGORY_SEED, INSTITUTION_SEED } from './seed';
import type { Account, BalanceEntry, Category, Holding, Institution, Snapshot, Transaction } from './types';

export const db = new Dexie('spending-tracker') as Dexie & {
  institutions: EntityTable<Institution, 'id'>;
  accounts: EntityTable<Account, 'id'>;
  balances: EntityTable<BalanceEntry, 'id'>;
  holdings: EntityTable<Holding, 'id'>;
  snapshots: EntityTable<Snapshot, 'date'>;
  categories: EntityTable<Category, 'id'>;
  transactions: EntityTable<Transaction, 'id'>;
};

db.version(1).stores({
  institutions: '++id, type, name',
  accounts: '++id, assetClass, institutionId, archived',
  balances: '++id, accountId, date, [accountId+date]',
  holdings: '++id, accountId, symbol',
  snapshots: 'date',
  categories: '++id, kind',
  transactions: '++id, date, kind, categoryId, accountId',
});

async function seed(tx: { table: (name: string) => Table }) {
  await tx.table('institutions').bulkAdd(INSTITUTION_SEED.map((i) => ({ ...i, builtin: 1 })));
  await tx.table('categories').bulkAdd(CATEGORY_SEED);
}

db.on('populate', seed);

export const ALL_TABLES = ['institutions', 'accounts', 'balances', 'holdings', 'snapshots', 'categories', 'transactions'] as const;

/** 匯出全部資料為 JSON（備份用） */
export async function exportAll() {
  const data: Record<string, unknown[]> = {};
  for (const name of ALL_TABLES) data[name] = await db.table(name).toArray();
  return { app: 'spending-tracker', version: 1, exportedAt: new Date().toISOString(), data };
}

export async function importAll(json: { data: Record<string, unknown[]> }) {
  await db.transaction('rw', ALL_TABLES as unknown as string[], async () => {
    for (const name of ALL_TABLES) {
      await db.table(name).clear();
      if (json.data[name]) await db.table(name).bulkAdd(json.data[name]);
    }
  });
}

/** 清空所有資料並重新寫入預設的機構與分類 */
export async function clearAll() {
  await db.transaction('rw', ALL_TABLES as unknown as string[], async () => {
    for (const name of ALL_TABLES) await db.table(name).clear();
    await seed(db);
  });
}
