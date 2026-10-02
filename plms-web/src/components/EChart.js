import * as echarts from 'echarts'
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

/**
 * ECharts 通用容器组件。
 * 负责实例生命周期（init / setOption / resize / dispose），option 由外部传入。
 *
 * 注意：容器必须有确定高度，ECharts 依赖 DOM 尺寸做布局。
 */
export default {
  name: 'EChart',
  props: {
    /** ECharts option 对象 */
    option: { type: Object, required: true },
    /** 容器高度，如 '220px' / '100%' */
    height: { type: [String, Number], default: '220px' },
    /** 是否对外抛出图表元素点击事件（用于图表内下钻） */
    clickable: { type: Boolean, default: false },
  },
  emits: ['chart-click'],
  template: `<div ref="el" class="echart" :style="{ height: cssHeight }"></div>`,
  setup(props, { emit }) {
    const el = ref(null)
    let chart = null
    let observer = null

    const cssHeight = ref(typeof props.height === 'number' ? props.height + 'px' : props.height)

    const resize = () => {
      if (chart) chart.resize()
    }

    function apply() {
      if (!chart || !props.option) return
      // notMerge=true：系列数量/类型变化时避免残留旧系列
      chart.setOption(props.option, true)
    }

    onMounted(async () => {
      await nextTick()
      if (!el.value) return
      chart = echarts.init(el.value, null, { renderer: 'canvas' })
      apply()
      if (props.clickable) {
        chart.on('click', (params) => emit('chart-click', params))
      }
      window.addEventListener('resize', resize)
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize)
        observer.observe(el.value)
      }
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', resize)
      if (observer) {
        observer.disconnect()
        observer = null
      }
      if (chart) {
        chart.dispose()
        chart = null
      }
    })

    watch(
      () => [props.option, props.height],
      () => {
        cssHeight.value = typeof props.height === 'number' ? props.height + 'px' : props.height
        nextTick(resize)
        apply()
      },
      { deep: true },
    )

    return { el, cssHeight }
  },
}
