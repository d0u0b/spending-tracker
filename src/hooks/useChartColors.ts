import { useMemo } from 'react';
import { cssVar, useTheme } from '../theme/theme';

let ctx: CanvasRenderingContext2D | null = null;

/** 把任何 CSS 色彩字串轉成 ECharts 看得懂的 #rrggbb / rgba(r,g,b,a) */
function normalize(color: string): string {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return color;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  return ctx.fillStyle;
}

export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function useChartColors() {
  const { resolved, updown } = useTheme();
  return useMemo(
    () => ({
      dark: resolved === 'dark',
      text: normalize(cssVar('--text')),
      text2: normalize(cssVar('--text-2')),
      text3: normalize(cssVar('--text-3')),
      line: normalize(cssVar('--line')),
      surface: normalize(cssVar('--surface-solid')),
      accent: normalize(cssVar('--accent')),
      up: normalize(cssVar('--up')),
      down: normalize(cssVar('--down')),
    }),
    // 主題切換後 CSS 變數值會變，依主題重新讀取
    [resolved, updown],
  );
}

export type ChartColors = ReturnType<typeof useChartColors>;
