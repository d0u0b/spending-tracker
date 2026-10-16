import { isMarketOpen } from './market';
import { DEFAULT_PROVIDERS } from './providers';
import { parseSymbol, type Quote, type QuoteProvider } from './types';

const CACHE_KEY = 'quote-cache-v1';
const TTL_OPEN = 60_000;
const TTL_CLOSED = 30 * 60_000;

type CachedQuote = Quote & { fetchedAt: number };

const cache: Record<string, CachedQuote> = loadCache();
/** 各代號進行中的請求，重疊的查詢會共用同一個 */
const inflight = new Map<string, Promise<void>>();
const lastCall = new Map<string, number>();

function loadCache(): Record<string, CachedQuote> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 無痕模式或空間不足時忽略，只是少了跨頁面快取
  }
}

function ttl(symbol: string) {
  return isMarketOpen(parseSymbol(symbol).market) ? TTL_OPEN : TTL_CLOSED;
}

export function getCachedQuote(symbol: string): CachedQuote | undefined {
  return cache[symbol];
}

/**
 * 取得報價：快取未過期直接回傳；過期的才打 API。
 * - 同一個代號同時被要求時只發一次請求
 * - 每個 provider 各自 throttle，冷卻中就換下一個，沒得換就等冷卻結束
 * - 全部失敗時回傳舊快取（呼叫端可用 fetchedAt 顯示更新時間）
 */
export async function getQuotes(
  symbols: string[],
  { force = false, providers = DEFAULT_PROVIDERS }: { force?: boolean; providers?: QuoteProvider[] } = {},
): Promise<Record<string, CachedQuote>> {
  const unique = [...new Set(symbols)];
  const now = Date.now();
  const stale = unique.filter((s) => force || !cache[s] || now - cache[s].fetchedAt > ttl(s));

  const waiting = new Set<Promise<void>>();
  const toFetch: string[] = [];
  for (const s of stale) {
    const job = inflight.get(s);
    if (job) waiting.add(job);
    else toFetch.push(s);
  }
  if (toFetch.length) {
    const job = refresh(toFetch, providers).finally(() => {
      for (const s of toFetch) if (inflight.get(s) === job) inflight.delete(s);
    });
    for (const s of toFetch) inflight.set(s, job);
    waiting.add(job);
  }
  await Promise.all(waiting);

  const result: Record<string, CachedQuote> = {};
  for (const s of unique) if (cache[s]) result[s] = cache[s];
  return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refresh(symbols: string[], providers: QuoteProvider[]) {
  let remaining = symbols;
  for (const [i, provider] of providers.entries()) {
    const targets = remaining.filter((s) => provider.supports(s));
    if (!targets.length) continue;

    const wait = (lastCall.get(provider.name) ?? 0) + provider.minIntervalMs - Date.now();
    if (wait > 0) {
      // 後面還有 provider 能處理就先換人；沒有的話等冷卻結束
      const hasBackup = providers.slice(i + 1).some((p) => targets.some((s) => p.supports(s)));
      if (hasBackup) continue;
      await sleep(wait);
    }
    lastCall.set(provider.name, Date.now());

    try {
      const quotes = await provider.fetch(targets);
      const fetchedAt = Date.now();
      for (const q of quotes) cache[q.symbol] = { ...q, fetchedAt };
      const got = new Set(quotes.map((q) => q.symbol));
      remaining = remaining.filter((s) => !got.has(s));
    } catch (err) {
      console.warn(`[quotes] ${provider.name} failed`, err);
    }
    if (!remaining.length) break;
  }
  saveCache();
}
