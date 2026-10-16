/** 匯率：1 單位外幣 = 多少台幣 */
export type FxRates = Record<string, number>;

const CACHE_KEY = 'fx-cache-v1';
const TTL = 6 * 60 * 60_000;

/** 離線且沒有快取時的備用值（2026-10 概略值），只為了讓畫面不至於空白 */
const FALLBACK: FxRates = { TWD: 1, USD: 32.4, JPY: 0.205, EUR: 36.3, CNY: 4.82, HKD: 4.13, GBP: 42.9, AUD: 22.4 };

let memory: { fetchedAt: number; rates: FxRates } | null = null;
let inflight: Promise<FxRates> | null = null;

function readCache() {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
  } catch {
    memory = null;
  }
  return memory;
}

export function getCachedFx(): FxRates {
  return readCache()?.rates ?? FALLBACK;
}

export async function getFxRates(): Promise<FxRates> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < TTL) return cached.rates;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/TWD');
      const json = await res.json();
      if (json?.result !== 'success') throw new Error('fx api error');
      const rates: FxRates = { TWD: 1 };
      for (const [code, perTwd] of Object.entries(json.rates as Record<string, number>)) {
        if (perTwd > 0) rates[code] = 1 / perTwd;
      }
      memory = { fetchedAt: Date.now(), rates };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(memory));
      } catch {
        // 忽略
      }
      return rates;
    } catch (err) {
      console.warn('[fx] failed, using cached/fallback rates', err);
      return cached?.rates ?? FALLBACK;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function toTWD(amount: number, currency: string, rates: FxRates): number {
  return amount * (rates[currency] ?? FALLBACK[currency] ?? 1);
}
