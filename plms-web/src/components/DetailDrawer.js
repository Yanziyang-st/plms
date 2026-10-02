import { computed } from 'vue'
import AppIcon from './AppIcon.js'
import EChart from './EChart.js'
import { renderMarkdown } from '../utils/format.js'

/**
 * 通用详情抽屉。
 * 每个图表面板点击后打开，统一承载：说明 → 关键指标 → 大图 → 数据明细 → 注意事项。
 *
 * detail 结构：
 * {
 *   title, subtitle,
 *   desc,                        // Markdown 说明（指标口径 / 计算方式）
 *   metrics: [{ label, value, unit, hint }],
 *   chart: { option, height },   // ECharts option（可选）
 *   series: [{ name, option }],  // 多图（可选，优先于 chart）
 *   table: { columns: [{ key, label, width, align, type }], rows: [], empty },
 *   notes: [ '注意事项' ],
 *   actions: [{ label, icon, key }],   // 触发 @action(key)
 * }
 */
export default {
  name: 'DetailDrawer',
  components: { AppIcon, EChart },
  props: {
    modelValue: { type: Boolean, default: false },
    detail: { type: Object, default: null },
    size: { type: String, default: '760px' },
  },
  emits: ['update:modelValue', 'action'],
  template: `
    <el-drawer
      :model-value="modelValue"
      :size="size"
      :title="detail?.title || '详情'"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <div v-if="detail" class="detail-wrap">
        <div v-if="detail.subtitle" class="detail-sub">{{ detail.subtitle }}</div>

        <!-- 关键指标 -->
        <div v-if="detail.metrics && detail.metrics.length" class="grid g-3 mb-4">
          <div v-for="m in detail.metrics" :key="m.label" class="detail-metric">
            <small>{{ m.label }}</small>
            <b>
              {{ m.value }}<i v-if="m.unit">{{ m.unit }}</i>
            </b>
            <span v-if="m.hint" class="hint">{{ m.hint }}</span>
          </div>
        </div>

        <!-- 图表 -->
        <div v-if="chartList.length" class="mb-4">
          <div v-for="c in chartList" :key="c.name" class="detail-chart">
            <div v-if="c.name" class="detail-chart-title">{{ c.name }}</div>
            <EChart :option="c.option" :height="c.height || '300px'" />
          </div>
        </div>

        <!-- 说明 -->
        <div v-if="detail.desc" class="detail-desc-box">
          <div class="detail-sec-title"><AppIcon name="file" :size="14" /> 指标说明</div>
          <div class="doc-body" v-html="renderMarkdown(detail.desc)"></div>
        </div>

        <!-- 数据明细 -->
        <div v-if="detail.table" class="mt-4">
          <div class="flex items-center mb-2" style="justify-content:space-between">
            <div class="detail-sec-title" style="margin:0">
              <AppIcon name="list" :size="14" /> 数据明细
              <span class="badge gray" style="margin-left:6px">{{ (detail.table.rows || []).length }} 条</span>
            </div>
            <button v-if="detail.table.exportable" class="btn btn-sm" @click="$emit('action','export')">
              <AppIcon name="download" :size="13" /> 导出
            </button>
          </div>
          <el-table :data="detail.table.rows || []" max-height="360" size="small" style="width:100%">
            <el-table-column
              v-for="col in detail.table.columns || []"
              :key="col.key"
              :label="col.label"
              :width="col.width"
              :align="col.align || 'left'"
              :min-width="col.minWidth"
            >
              <template #default="{ row }">
                <span v-if="col.type === 'mono'" class="mono fs-12">{{ row[col.key] }}</span>
                <span v-else-if="col.type === 'pct'">{{ row[col.key] }}%</span>
                <span v-else>{{ row[col.key] }}</span>
              </template>
            </el-table-column>
            <template #empty>
              <div class="hint" style="padding:18px;text-align:center">{{ detail.table.empty || '暂无数据' }}</div>
            </template>
          </el-table>
        </div>

        <!-- 注意事项 -->
        <div v-if="detail.notes && detail.notes.length" class="mt-4">
          <div class="detail-sec-title"><AppIcon name="alert" :size="14" /> 注意事项</div>
          <ul class="detail-notes">
            <li v-for="(n, i) in detail.notes" :key="i">{{ n }}</li>
          </ul>
        </div>
      </div>

      <template #footer>
        <div class="flex gap-2" style="justify-content:flex-end;width:100%">
          <button
            v-for="a in (detail?.actions || [])"
            :key="a.key"
            class="btn"
            :class="a.primary ? 'btn-primary' : ''"
            @click="$emit('action', a.key)"
          >
            <AppIcon v-if="a.icon" :name="a.icon" :size="14" /> {{ a.label }}
          </button>
          <button class="btn" @click="$emit('update:modelValue', false)">关闭</button>
        </div>
      </template>
    </el-drawer>
  `,
  setup(props) {
    /** 支持单图或多图 */
    const chartList = computed(() => {
      if (!props.detail) return []
      if (props.detail.series && props.detail.series.length) return props.detail.series
      if (props.detail.chart && props.detail.chart.option) {
        return [{ name: '', ...props.detail.chart }]
      }
      return []
    })
    return { chartList, renderMarkdown }
  },
}
