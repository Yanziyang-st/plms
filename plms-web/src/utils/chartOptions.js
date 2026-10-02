/* ==========================================================================
   ECharts 统一配置与图表 option 构造器
   —— 所有图表的配色、字体、tooltip、网格都收敛在这里，保证视觉一致
   ========================================================================== */

/** 设计系统调色板 */
export const PALETTE = ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#ff7a6b', '#46dfd0', '#f472b6', '#a3bdb7']

export const INK = {
  primary: '#0f2f29',
  regular: '#37605a',
  secondary: '#6f908a',
  line: 'rgba(19,168,132,.14)',
}

/** 玻璃质感 tooltip */
const GLASS_TOOLTIP = {
  backgroundColor: 'rgba(255,255,255,.94)',
  borderColor: 'rgba(255,255,255,.9)',
  borderWidth: 1,
  padding: [8, 12],
  extraCssText:
    'border-radius:12px;box-shadow:0 18px 40px -18px rgba(9,62,52,.35);backdrop-filter:blur(12px);',
  textStyle: { color: INK.regular, fontSize: 12.5, fontWeight: 600 },
}

const BASE_TEXT = { fontFamily: 'inherit', color: INK.regular }

/** 通用网格 */
const grid = (extra = {}) => ({ left: 8, right: 14, top: 26, bottom: 6, containLabel: true, ...extra })

/** 通用坐标轴 */
const categoryAxis = (data, extra = {}) => ({
  type: 'category',
  data,
  axisLine: { lineStyle: { color: INK.line } },
  axisTick: { show: false },
  axisLabel: { color: INK.secondary, fontSize: 11, ...(extra.axisLabel || {}) },
  ...extra,
})

const valueAxis = (extra = {}) => ({
  type: 'value',
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: INK.secondary, fontSize: 11 },
  splitLine: { lineStyle: { color: INK.line, type: 'dashed' } },
  ...extra,
})

/* ==========================================================================
   柱状图
   @param items [{ label, value, color? }]
   ========================================================================== */
export function barOption({ items = [], horizontal = false, showLabel = true, unit = '' }) {
  const labels = items.map((i) => i.label)
  const values = items.map((i) => ({
    value: i.value,
    itemStyle: i.color
      ? { color: i.color, borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0] }
      : undefined,
  }))

  const cat = categoryAxis(labels)
  const val = valueAxis()

  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(35,211,169,.08)' } },
      ...GLASS_TOOLTIP,
      valueFormatter: (v) => `${v}${unit}`,
    },
    grid: grid({ top: showLabel ? 30 : 20 }),
    xAxis: horizontal ? val : { ...cat, axisLabel: { ...cat.axisLabel, interval: 0 } },
    yAxis: horizontal ? { ...cat, inverse: true } : val,
    series: [
      {
        type: 'bar',
        data: values,
        barMaxWidth: horizontal ? 16 : 30,
        itemStyle: {
          borderRadius: horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1,
            colorStops: [
              { offset: 0, color: '#3fe3bd' },
              { offset: 1, color: '#12b894' },
            ],
          },
        },
        emphasis: { itemStyle: { color: '#0ea98a' } },
        label: showLabel
          ? {
              show: true,
              position: horizontal ? 'right' : 'top',
              color: INK.regular,
              fontSize: 11,
              fontWeight: 700,
              formatter: `{c}${unit}`,
            }
          : { show: false },
      },
    ],
  }
}

/* ==========================================================================
   折线 / 面积图
   @param series [{ name, data: [{label,value}], color?, area?, dashed? }]
   ========================================================================== */
export function lineOption({ series = [], labels = [], unit = '' }) {
  const names = labels.length ? labels : series[0]?.data.map((d) => d.label) || []

  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: { trigger: 'axis', ...GLASS_TOOLTIP, valueFormatter: (v) => `${v}${unit}` },
    legend: series.length > 1
      ? {
          top: 0,
          right: 0,
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: INK.secondary, fontSize: 11.5 },
        }
      : { show: false },
    grid: grid({ top: series.length > 1 ? 34 : 20 }),
    xAxis: { ...categoryAxis(names), boundaryGap: false },
    yAxis: valueAxis(),
    series: series.map((s, i) => {
      const color = s.color || PALETTE[i % PALETTE.length]
      return {
        name: s.name || `系列${i + 1}`,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: s.data.map((d) => d.value),
        itemStyle: { color, borderWidth: 2, borderColor: '#fff' },
        lineStyle: { width: 2.6, color, type: s.dashed ? 'dashed' : 'solid' },
        areaStyle: s.area === false ? undefined : {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexA(color, 0.28) },
              { offset: 1, color: hexA(color, 0) },
            ],
          },
        },
        emphasis: { focus: 'series' },
      }
    }),
  }
}

/* ==========================================================================
   环形图
   @param items [{ label, value, color? }]
   ========================================================================== */
export function donutOption({ items = [], centerLabel = '总计', centerValue, unit = '' }) {
  const total = items.reduce((a, b) => a + (b.value || 0), 0)
  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: { trigger: 'item', ...GLASS_TOOLTIP, valueFormatter: (v) => `${v}${unit}` },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { color: INK.secondary, fontSize: 11.5 },
    },
    graphic: centerValue === false
      ? undefined
      : [
          {
            type: 'text',
            left: 'center',
            top: '40%',
            style: {
              text: String(centerValue !== undefined ? centerValue : total),
              fontSize: 24,
              fontWeight: 800,
              fill: INK.primary,
              textAlign: 'center',
            },
          },
          {
            type: 'text',
            left: 'center',
            top: '52%',
            style: { text: centerLabel, fontSize: 11.5, fill: INK.secondary, textAlign: 'center' },
          },
        ],
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        padAngle: 1.5,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 6 },
        data: items.map((i) => ({
          name: i.label,
          value: i.value,
          itemStyle: i.color ? { color: i.color } : undefined,
        })),
      },
    ],
  }
}

/* ==========================================================================
   仪表盘 / 进度环
   ========================================================================== */
export function gaugeOption({ value = 0, name = '', unit = '%', color = '#23d3a9', max = 100 }) {
  return {
    textStyle: BASE_TEXT,
    tooltip: { show: false },
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max,
        radius: '92%',
        center: ['50%', '56%'],
        progress: {
          show: true,
          width: 12,
          roundCap: true,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color },
                { offset: 1, color: '#38bdf8' },
              ],
            },
          },
        },
        axisLine: { roundCap: true, lineStyle: { width: 12, color: [[1, 'rgba(19,168,132,.14)']] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: {
          show: !!name,
          offsetCenter: [0, '32%'],
          fontSize: 11.5,
          color: INK.secondary,
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '2%'],
          fontSize: 22,
          fontWeight: 800,
          color: INK.primary,
          formatter: `{value}${unit}`,
        },
        data: [{ value, name }],
      },
    ],
  }
}

/* ==========================================================================
   横向堆叠条形（用于类型占比）
   @param rows [{ name, values: [{label,value}], color? }]
   ========================================================================== */
export function stackBarOption({ categories = [], series = [] }) {
  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...GLASS_TOOLTIP },
    legend: {
      bottom: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10,
      textStyle: { color: INK.secondary, fontSize: 11.5 },
    },
    grid: grid({ top: 16, bottom: 26 }),
    xAxis: valueAxis(),
    yAxis: { ...categoryAxis(categories), inverse: true },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 18,
      data: s.data,
      itemStyle: { color: s.color || PALETTE[i % PALETTE.length], borderRadius: 3 },
    })),
  }
}

/* ==========================================================================
   雷达图（能力 / 多维对比）
   ========================================================================== */
export function radarOption({ indicators = [], series = [] }) {
  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: { ...GLASS_TOOLTIP },
    legend: {
      bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8,
      textStyle: { color: INK.secondary, fontSize: 11.5 },
    },
    radar: {
      indicator: indicators,
      center: ['50%', '46%'],
      radius: '64%',
      axisName: { color: INK.secondary, fontSize: 11 },
      splitLine: { lineStyle: { color: INK.line } },
      splitArea: { areaStyle: { color: ['rgba(35,211,169,.03)', 'rgba(35,211,169,.07)'] } },
      axisLine: { lineStyle: { color: INK.line } },
    },
    series: [
      {
        type: 'radar',
        data: series.map((s, i) => ({
          name: s.name,
          value: s.value,
          areaStyle: { color: hexA(s.color || PALETTE[i % PALETTE.length], 0.22) },
          lineStyle: { width: 2.2, color: s.color || PALETTE[i % PALETTE.length] },
          itemStyle: { color: s.color || PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  }
}

/* ==========================================================================
   散点图（如 优先级 × 故事点分布）
   ========================================================================== */
export function scatterOption({ points = [], xName = '', yName = '' }) {
  return {
    color: PALETTE,
    textStyle: BASE_TEXT,
    tooltip: {
      ...GLASS_TOOLTIP,
      formatter: (p) => `${p.data[3] || ''}<br/>${xName}: ${p.data[0]}<br/>${yName}: ${p.data[1]}`,
    },
    grid: grid({ top: 26 }),
    xAxis: { ...valueAxis(), name: xName, nameTextStyle: { color: INK.secondary, fontSize: 11 } },
    yAxis: { ...valueAxis(), name: yName, nameTextStyle: { color: INK.secondary, fontSize: 11 } },
    series: [
      {
        type: 'scatter',
        symbolSize: (d) => Math.max(10, Math.min(34, (d[2] || 1) * 5)),
        data: points,
        itemStyle: { color: 'rgba(35,211,169,.75)', borderColor: '#fff', borderWidth: 1.5 },
        emphasis: { itemStyle: { color: '#0ea98a' } },
      },
    ],
  }
}

/* ==========================================================================
   工具
   ========================================================================== */
/** hex -> rgba */
export function hexA(hex, alpha) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export const CHART_COLORS = {
  mint: '#23d3a9', sky: '#38bdf8', violet: '#8b7cf6', amber: '#ffb020', coral: '#ff7a6b',
}

export default {
  PALETTE, INK, CHART_COLORS, hexA,
  barOption, lineOption, donutOption, gaugeOption, stackBarOption, radarOption, scatterOption,
}
