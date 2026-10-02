import { h } from 'vue'
import { ICON_PATHS } from './icons.js'

/** 内联 SVG 图标组件 */
export default {
  name: 'AppIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 18 },
    stroke: { type: [Number, String], default: 1.9 },
  },
  render() {
    return h('svg', {
      width: this.size,
      height: this.size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': this.stroke,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      style: 'flex-shrink:0;display:block',
      innerHTML: ICON_PATHS[this.name] || ICON_PATHS.dashboard,
    })
  },
}
