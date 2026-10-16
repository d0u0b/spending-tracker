import type { Market } from './types';

function zonedNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { weekday: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const SESSIONS: Record<Exclude<Market, 'CRYPTO'>, { tz: string; open: number; close: number }> = {
  // 13:30 收盤後還有零股與盤後交易，多留 5 分鐘抓最後成交價
  TW: { tz: 'Asia/Taipei', open: 9 * 60, close: 13 * 60 + 35 },
  US: { tz: 'America/New_York', open: 9 * 60 + 30, close: 16 * 60 },
};

/** 只判斷週一到週五的交易時段，不處理國定假日 */
export function isMarketOpen(market: Market): boolean {
  if (market === 'CRYPTO') return true;
  const s = SESSIONS[market];
  const { weekday, minutes } = zonedNow(s.tz);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minutes >= s.open && minutes <= s.close;
}
