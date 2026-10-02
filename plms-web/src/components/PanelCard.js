import AppIcon from './AppIcon.js'

/**
 * 可点击的图表面板。
 * 统一承载卡片标题、副标题、右侧自定义区域，并在可下钻时给出明确的「查看详情」提示。
 */
export default {
  name: 'PanelCard',
  components: { AppIcon },
  props: {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    /** 是否可点击进入详情 */
    clickable: { type: Boolean, default: false },
    /** 详情提示文案 */
    hintText: { type: String, default: '查看详情' },
    /** 内容区额外样式 */
    bodyStyle: { type: [String, Object], default: '' },
    /** 是否显示底部「查看详情」条（图表类面板建议开启，更易发现） */
    footerHint: { type: Boolean, default: false },
  },
  emits: ['detail'],
  template: `
    <div class="card panel-card" :class="{ clickable }" @click="onClick">
      <div v-if="title" class="card-head">
        <h3>{{ title }}</h3>
        <span v-if="subtitle" class="sub">{{ subtitle }}</span>
        <div class="right">
          <slot name="right" />
          <span v-if="clickable" class="detail-hint"><AppIcon name="eye" :size="13" /> {{ hintText }}</span>
        </div>
      </div>
      <div class="card-pad" :style="bodyStyle">
        <slot />
      </div>
      <div v-if="clickable && footerHint" class="panel-foot">
        <span><AppIcon name="chart" :size="13" /> 点击查看详细数据与说明</span>
        <AppIcon name="chevronRight" :size="14" />
      </div>
    </div>
  `,
  setup(props, { emit }) {
    function onClick(e) {
      if (!props.clickable) return
      // 面板内的按钮/链接等交互元素不触发下钻
      const tag = (e.target && e.target.closest) ? e.target.closest('button, a, .el-switch, input, select, textarea') : null
      if (tag) return
      emit('detail')
    }
    return { onClick }
  },
}
