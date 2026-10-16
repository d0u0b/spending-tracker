import type { EChartOption } from '../../components/EChart';
import { ASSET_CLASS_IDS, ASSET_CLASSES, type AssetClassId } from '../../domain/assetClasses';
import type { TrendPoint } from '../../domain/trend';
import { withAlpha, type ChartColors } from '../../hooks/useChartColors';
import { fmtCompact, fmtMoney, fmtPct, fmtSigned } from '../../lib/format';

function baseTooltip(c: ChartColors) {
  return {
    trigger: 'axis',
    backgroundColor: c.surface,
    borderColor: c.line,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: c.text, fontSize: 12 },
    extraCssText: 'border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.12);',
    axisPointer: { type: 'line', lineStyle: { color: c.text3, type: 'dashed' }, link: [{ xAxisIndex: 'all' }] },
  };
}

function signColor(n: number | null, c: ChartColors) {
  if (!n) return c.text2;
  return n > 0 ? c.up : c.down;
}

/** 淨值折線 ＋ 下方每期變化長條 */
export function netWorthOption(points: TrendPoint[], c: ChartColors): EChartOption {
  const labels = points.map((p) => p.label);
  const axisLabel = { color: c.text3, fontSize: 11 };

  return {
    animationDuration: 500,
    tooltip: {
      ...baseTooltip(c),
      formatter: (params: { dataIndex: number }[]) => {
        const p = points[params[0].dataIndex];
        const s = p.snapshot;
        const dc = signColor(p.delta, c);
        return `
          <div style="font-weight:600;margin-bottom:6px">${p.date}</div>
          <div style="display:flex;justify-content:space-between;gap:20px"><span style="color:${c.text2}">淨資產</span><b>${fmtMoney(s.net)}</b></div>
          <div style="display:flex;justify-content:space-between;gap:20px"><span style="color:${c.text2}">變化</span><span style="color:${dc}">${p.delta == null ? '—' : `${fmtSigned(p.delta)} (${fmtPct(p.deltaPct)})`}</span></div>
          <div style="display:flex;justify-content:space-between;gap:20px;margin-top:4px"><span style="color:${c.text3}">資產／負債</span><span style="color:${c.text2}">${fmtCompact(s.assets)}／${fmtCompact(s.liabilities)}</span></div>`;
      },
    },
    grid: [
      { left: 4, right: 8, top: 12, height: '64%' },
      { left: 4, right: 8, top: '76%', bottom: 4 },
    ],
    xAxis: [
      { type: 'category', data: labels, gridIndex: 0, boundaryGap: false, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
      { type: 'category', data: labels, gridIndex: 1, axisTick: { show: false }, axisLine: { lineStyle: { color: c.line } }, axisLabel },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        scale: true,
        splitNumber: 4,
        axisLabel: { ...axisLabel, formatter: fmtCompact },
        splitLine: { lineStyle: { color: c.line, type: 'dashed' } },
      },
      { type: 'value', gridIndex: 1, splitNumber: 1, axisLabel: { ...axisLabel, formatter: fmtCompact }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '淨資產',
        type: 'line',
        data: points.map((p) => p.snapshot.net),
        smooth: 0.3,
        showSymbol: points.length <= 12,
        symbolSize: 6,
        lineStyle: { width: 2.5, color: c.accent },
        itemStyle: { color: c.accent },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: withAlpha(c.accent, c.dark ? 0.35 : 0.22) },
              { offset: 1, color: withAlpha(c.accent, 0) },
            ],
          },
        },
      },
      {
        name: '變化',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        barMaxWidth: 18,
        data: points.map((p) => ({
          value: p.delta ?? 0,
          itemStyle: { color: signColor(p.delta, c), borderRadius: (p.delta ?? 0) >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] },
        })),
      },
    ],
  };
}

/** 依資產類別堆疊：資產在 0 以上、負債在 0 以下，再疊一條淨值線 */
export function compositionOption(points: TrendPoint[], c: ChartColors): EChartOption {
  const present = ASSET_CLASS_IDS.filter((id) => points.some((p) => (p.snapshot.byClass[id] ?? 0) !== 0));
  const series = present.map((id: AssetClassId) => {
    const def = ASSET_CLASSES[id];
    const sign = def.side === 'liability' ? -1 : 1;
    return {
      name: def.label,
      type: 'line',
      stack: def.side,
      smooth: 0.3,
      showSymbol: false,
      lineStyle: { width: 0 },
      itemStyle: { color: def.color },
      areaStyle: { color: withAlpha(def.color, c.dark ? 0.75 : 0.85) },
      emphasis: { focus: 'series' },
      data: points.map((p) => sign * (p.snapshot.byClass[id] ?? 0)),
    };
  });

  return {
    animationDuration: 500,
    tooltip: {
      ...baseTooltip(c),
      formatter: (params: { dataIndex: number }[]) => {
        const p = points[params[0].dataIndex];
        const rows = present
          .map((id) => ({ id, v: p.snapshot.byClass[id] ?? 0 }))
          .filter((r) => r.v)
          .map(({ id, v }) => {
            const def = ASSET_CLASSES[id];
            return `<div style="display:flex;justify-content:space-between;gap:20px"><span><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${def.color};margin-right:6px"></span>${def.label}</span><span>${def.side === 'liability' ? '-' : ''}${fmtMoney(v)}</span></div>`;
          })
          .join('');
        return `<div style="font-weight:600;margin-bottom:6px">${p.date}</div>${rows}
          <div style="display:flex;justify-content:space-between;gap:20px;margin-top:6px;padding-top:6px;border-top:1px solid ${c.line}"><span>淨資產</span><b>${fmtMoney(p.snapshot.net)}</b></div>`;
      },
    },
    grid: { left: 4, right: 8, top: 12, bottom: 4 },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: c.line } },
      axisLabel: { color: c.text3, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLabel: { color: c.text3, fontSize: 11, formatter: fmtCompact },
      splitLine: { lineStyle: { color: c.line, type: 'dashed' } },
    },
    series: [
      ...series,
      {
        name: '淨資產',
        type: 'line',
        smooth: 0.3,
        showSymbol: false,
        z: 10,
        lineStyle: { width: 2, color: c.text, type: 'dashed' },
        itemStyle: { color: c.text },
        data: points.map((p) => p.snapshot.net),
      },
    ],
  };
}
