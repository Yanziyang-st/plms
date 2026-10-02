import { computed } from 'vue'
import EChart from './EChart.js'
import {
  barOption, lineOption, donutOption, gaugeOption, radarOption, scatterOption,
} from '../utils/chartOptions.js'

/* ==========================================================================
   业务图表组件：都是 EChart 的薄封装，保持简洁 props 以便视图使用。
   全部支持 @chart-click（用于图表内下钻）。
   ========================================================================== */

/** 柱状图：items = [{ label, value, color? }] */
export const BarChart = {
  name: 'BarChart',
  components: { EChart },
  props: {
    items: { type: Array, default: () => [] },
    height: { type: [Number, String], default: 190 },
    horizontal: { type: Boolean, default: false },
    unit: { type: String, default: '' },
    interactive: { type: Boolean, default: false },
  },
  emits: ['chart-click'],
  template: `<EChart :option="option" :height="px" :clickable="interactive" @chart-click="$emit('chart-click', $event)" />`,
  setup(props) {
    const option = computed(() => barOption({
      items: props.items, horizontal: props.horizontal, unit: props.unit,
    }))
    const px = computed(() => (typeof props.height === 'number' ? props.height + 'px' : props.height))
    return { option, px }
  },
}

/**
 * 折线 / 面积图
 * 兼容两种 series 写法：
 *   新：[{ name, data: [{label,value}], color?, area? }]
 *   旧：[[{label,value}], [{label,value}]]
 */
export const LineChart = {
  name: 'LineChart',
  components: { EChart },
  props: {
    series: { type: Array, default: () => [] },
    labels: { type: Array, default: () => [] },
    colors: { type: Array, default: () => [] },
    width: { type: Number, default: 0 },
    height: { type: [Number, String], default: 190 },
    unit: { type: String, default: '' },
    interactive: { type: Boolean, default: false },
  },
  emits: ['chart-click'],
  template: `<EChart :option="option" :height="px" :clickable="interactive" @chart-click="$emit('chart-click', $event)" />`,
  setup(props) {
    const normalized = computed(() =>
      (props.series || []).map((s, i) => {
        if (Array.isArray(s)) {
          return { name: `系列${i + 1}`, data: s, color: props.colors[i], area: props.colors[i] !== '#a3bdb7' }
        }
        return { area: true, ...s }
      }),
    )
    const option = computed(() => lineOption({
      series: normalized.value, labels: props.labels, unit: props.unit,
    }))
    const px = computed(() => (typeof props.height === 'number' ? props.height + 'px' : props.height))
    return { option, px }
  },
}

/** 环形图：items = [{ label, value, color? }] */
export const Donut = {
  name: 'Donut',
  components: { EChart },
  props: {
    items: { type: Array, default: () => [] },
    size: { type: [Number, String], default: 210 },
    thickness: { type: Number, default: 22 },
    centerLabel: { type: String, default: '总计' },
    centerValue: { type: [Number, String, Boolean], default: undefined },
    unit: { type: String, default: '' },
    interactive: { type: Boolean, default: false },
  },
  emits: ['chart-click'],
  template: `<EChart :option="option" :height="px" :clickable="interactive" @chart-click="$emit('chart-click', $event)" />`,
  setup(props) {
    const option = computed(() => donutOption({
      items: props.items, centerLabel: props.centerLabel,
      centerValue: props.centerValue, unit: props.unit,
    }))
    const px = computed(() => (typeof props.size === 'number' ? props.size + 'px' : props.size))
    return { option, px }
  },
}

/** 仪表盘进度环（替代原 SVG 实现） */
export const Gauge = {
  name: 'Gauge',
  components: { EChart },
  props: {
    value: { type: Number, default: 0 },
    size: { type: [Number, String], default: 130 },
    color: { type: String, default: '#23d3a9' },
    label: { type: String, default: '' },
    unit: { type: String, default: '%' },
    max: { type: Number, default: 100 },
  },
  template: `<EChart :option="option" :height="px" />`,
  setup(props) {
    const option = computed(() => gaugeOption({
      value: props.value, name: props.label, color: props.color, unit: props.unit, max: props.max,
    }))
    const px = computed(() => (typeof props.size === 'number' ? props.size + 'px' : props.size))
    return { option, px }
  },
}

/** 雷达图：indicators = [{ name, max }]，series = [{ name, value: [], color? }] */
export const RadarChart = {
  name: 'RadarChart',
  components: { EChart },
  props: {
    indicators: { type: Array, default: () => [] },
    series: { type: Array, default: () => [] },
    height: { type: [Number, String], default: 260 },
  },
  template: `<EChart :option="option" :height="px" />`,
  setup(props) {
    const option = computed(() => radarOption({ indicators: props.indicators, series: props.series }))
    const px = computed(() => (typeof props.height === 'number' ? props.height + 'px' : props.height))
    return { option, px }
  },
}

/** 散点图：points = [[x, y, size, name]] */
export const ScatterChart = {
  name: 'ScatterChart',
  components: { EChart },
  props: {
    points: { type: Array, default: () => [] },
    xName: { type: String, default: '' },
    yName: { type: String, default: '' },
    height: { type: [Number, String], default: 240 },
  },
  template: `<EChart :option="option" :height="px" />`,
  setup(props) {
    const option = computed(() => scatterOption({ points: props.points, xName: props.xName, yName: props.yName }))
    const px = computed(() => (typeof props.height === 'number' ? props.height + 'px' : props.height))
    return { option, px }
  },
}

export default { BarChart, LineChart, Donut, Gauge, RadarChart, ScatterChart }
