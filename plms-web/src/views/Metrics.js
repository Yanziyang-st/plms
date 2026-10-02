import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, StatCard, EmptyState, UserChip } from '../components/ui.js'
import { LineChart, BarChart, Donut, Gauge, RadarChart, ScatterChart } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useDataStore } from '../stores/data.js'
import { domainApi, exportUrl } from '../api/index.js'
import { errorMessage } from '../api/request.js'
import { barOption, donutOption, gaugeOption, scatterOption, radarOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

export default {
  name: 'MetricsView',
  components: {
    AppIcon, PageHeader, StatCard, EmptyState, UserChip,
    LineChart, BarChart, Donut, Gauge, RadarChart, ScatterChart, PanelCard, DetailDrawer,
  },
  template: `
    <div>
      <PageHeader title="效能度量" description="自动采集研发过程数据，以可视化仪表盘呈现效能洞察">
        <template #actions>
          <select class="select" style="width:140px" v-model="range">
            <option>近 30 天</option><option>近 90 天</option><option>本季度</option>
          </select>
          <button class="btn" @click="exportReport"><AppIcon name="download" :size="16" /> 导出报告</button>
        </template>
      </PageHeader>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'dash' }" @click="tab = 'dash'">效能仪表盘</button>
        <button class="tab" :class="{ active: tab === 'report' }" @click="tab = 'report'">效能报表</button>
      </div>

      <template v-if="tab === 'dash'">
        <!-- 核心指标 -->
        <div class="grid g-4 mb-4">
          <StatCard label="交付速率" value="61" unit="点/迭代" icon="zap" clickable
                    bg="#e6fbf5" color="#0c8a6c" foot="环比 +18%" @detail="openDetail('velocity')" />
          <StatCard label="需求交付周期" value="9.4" unit="天" icon="clock" clickable
                    bg="#e8f7fe" color="#0284c7" foot="环比 -12%" @detail="openDetail('cycle')" />
          <StatCard label="缺陷密度" :value="defectDensity" unit="个/点" icon="bug" clickable
                    bg="#ffefec" color="#d64534" :foot="'未完成缺陷 ' + openBugs + ' 个'" @detail="openDetail('defect')" />
          <StatCard label="用例通过率" :value="(overview?.tests?.passRate ?? 0) + '%'" icon="shield" clickable
                    bg="#f1eefe" color="#6d5dd3" :foot="'共 ' + (overview?.tests?.cases ?? 0) + ' 条用例'"
                    @detail="openDetail('passRate')" />
        </div>

        <!-- 燃尽 + 状态分布 -->
        <div class="grid g-2-1 mb-4">
          <PanelCard title="迭代燃尽图" subtitle="剩余故事点 vs 理想线" clickable footer-hint
                     @detail="openDetail('burndown')">
            <template #right>
              <span class="detail-hint"><AppIcon name="eye" :size="13" /> 详情</span>
            </template>
            <LineChart :series="[burndownActual, burndownIdeal]" :colors="['#23d3a9', '#a3bdb7']" :height="230" />
          </PanelCard>

          <PanelCard title="工作项状态分布" :subtitle="'共 ' + (overview?.workItems?.total ?? 0) + ' 个工作项'"
                     clickable footer-hint @detail="openDetail('statusDist')">
            <Donut :items="statusDist" center-label="工作项" :size="228" interactive
                   @chart-click="(p) => openDetail('statusDist:' + p.name)" />
          </PanelCard>
        </div>

        <!-- 速率 + 类型 -->
        <div class="grid g-2 mb-4">
          <PanelCard title="迭代速率" subtitle="近 6 个迭代完成故事点" clickable footer-hint
                     @detail="openDetail('velocity')">
            <BarChart :items="velocity" :height="200" unit=" 点" />
          </PanelCard>

          <PanelCard title="工作项类型分布" subtitle="任务 / 需求 / 缺陷 / 子任务" clickable footer-hint
                     @detail="openDetail('typeDist')">
            <BarChart :items="typeDist" :height="200" unit=" 项" />
          </PanelCard>
        </div>

        <!-- 多维分析 -->
        <div class="grid g-2 mb-4">
          <PanelCard title="优先级 × 故事点分布" subtitle="气泡越大表示同点多的工作项越多" clickable footer-hint
                     @detail="openDetail('scatter')">
            <ScatterChart :points="scatterPoints" x-name="优先级档位" y-name="故事点" :height="240" />
          </PanelCard>

          <PanelCard title="团队能力雷达" subtitle="按成员完成故事点归一" clickable footer-hint
                     @detail="openDetail('radar')">
            <RadarChart :indicators="radarIndicators" :series="radarSeries" :height="240" />
          </PanelCard>
        </div>

        <!-- 进度环 -->
        <div class="grid g-3">
          <PanelCard title="迭代目标达成" clickable @detail="openDetail('goalRate')">
            <template #right><span class="badge indigo">On-time</span></template>
            <div style="text-align:center"><Gauge :value="82" :size="190" label="达成率" /></div>
          </PanelCard>
          <PanelCard title="完成故事点占比" clickable @detail="openDetail('pointRate')">
            <template #right><span class="badge indigo">Points</span></template>
            <div style="text-align:center"><Gauge :value="pointRate" :size="190" label="完成占比" color="#8b7cf6" /></div>
          </PanelCard>
          <PanelCard title="用例通过率" clickable @detail="openDetail('passRate')">
            <template #right><span class="badge indigo">Quality</span></template>
            <div style="text-align:center">
              <Gauge :value="overview?.tests?.passRate ?? 0" :size="190" label="通过率" color="#38bdf8" />
            </div>
          </PanelCard>
        </div>
      </template>

      <template v-else>
        <PanelCard title="成员效能报表" subtitle="按完成故事点排序 · 点击行查看个人明细"
                   :clickable="false">
          <template #right>
            <span class="chip"><AppIcon name="clock" :size="13" /> {{ range }}</span>
          </template>
          <el-table :data="members" v-loading="loading" style="width:100%"
                    @row-click="(row) => openDetail('member:' + row.user.id)">
            <el-table-column label="成员" min-width="160">
              <template #default="{ row }"><UserChip :user="row.user" /></template>
            </el-table-column>
            <el-table-column label="部门" width="120">
              <template #default="{ row }"><span class="muted fs-12">{{ row.user.dept }}</span></template>
            </el-table-column>
            <el-table-column label="角色" width="120">
              <template #default="{ row }"><span class="fs-12">{{ row.user.role }}</span></template>
            </el-table-column>
            <el-table-column label="工作项" width="90" align="right" prop="total" />
            <el-table-column label="已完成" width="90" align="right" prop="done" />
            <el-table-column label="完成故事点" width="120" align="right">
              <template #default="{ row }"><b>{{ row.points }}</b></template>
            </el-table-column>
            <el-table-column label="交付占比" min-width="180">
              <template #default="{ row }">
                <div class="flex items-center gap-2">
                  <div class="progress" style="width:120px"><i :style="{ width: pctOf(row) + '%' }"></i></div>
                  <span class="hint">{{ pctOf(row) }}%</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="" width="70" align="right">
              <template #default="{ row }">
                <button class="btn btn-sm btn-ghost" @click.stop="openDetail('member:' + row.user.id)">
                  <AppIcon name="eye" :size="14" />
                </button>
              </template>
            </el-table-column>
            <template #empty><EmptyState v-if="!loading" title="暂无数据" icon="metrics" /></template>
          </el-table>
        </PanelCard>
      </template>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()

    const tab = ref('dash')
    const range = ref('近 30 天')
    const overview = ref(null)
    const members = ref([])
    const loading = ref(false)

    /* ---------------- 派生数据 ---------------- */
    const burndownActual = computed(() => {
      const vals = overview.value?.delivery?.burndown || [120, 118, 104, 96, 96, 78, 70, 52, 44, 30]
      return vals.map((v, i) => ({ label: `D${i + 1}`, value: v }))
    })
    const burndownIdeal = computed(() => {
      const n = burndownActual.value.length
      const start = burndownActual.value[0]?.value || 120
      return burndownActual.value.map((_, i) => ({
        label: `D${i + 1}`,
        value: Math.round(start - (i * start) / Math.max(n - 1, 1)),
      }))
    })

    const velocity = computed(() => {
      const vals = overview.value?.delivery?.velocity || [32, 41, 38, 52, 47, 61]
      const labels = overview.value?.delivery?.velocityLabels || ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']
      return labels.map((l, i) => ({ label: l, value: vals[i] ?? 0 }))
    })

    const STATUS_COLORS = { 已完成: '#23d3a9', 进行中: '#38bdf8', 待测试: '#8b7cf6', 待处理: '#a3bdb7' }
    const statusDist = computed(() => {
      const src = overview.value?.workItems?.byStatus || groupCount(data.workItems, 'status')
      return Object.keys(src).map((k) => ({ label: k, value: src[k], color: STATUS_COLORS[k] }))
    })

    const TYPE_COLORS = { 任务: '#23d3a9', 需求: '#38bdf8', 缺陷: '#ff7a6b', 子任务: '#8b7cf6' }
    const typeDist = computed(() => {
      const src = overview.value?.workItems?.byType || groupCount(data.workItems, 'type')
      return Object.keys(src).map((k) => ({ label: k, value: src[k], color: TYPE_COLORS[k] }))
    })

    const pointRate = computed(() => {
      const w = overview.value?.workItems
      if (!w || !w.totalPoints) return 0
      return Math.round((w.donePoints / w.totalPoints) * 100)
    })

    const openBugs = computed(() => data.workItems.filter((w) => w.type === '缺陷' && w.status !== '已完成').length)
    const totalPoints = computed(() => data.workItems.reduce((a, w) => a + (w.points || 0), 0))
    const defectDensity = computed(() => {
      const bugs = data.workItems.filter((w) => w.type === '缺陷').length
      return totalPoints.value ? (bugs / totalPoints.value).toFixed(2) : '0.00'
    })

    /** 优先级 × 故事点 散点（x=优先级档位，y=点数，气泡=同组合数量） */
    const PRIORITY_RANK = { 紧急: 1, 高: 2, 中: 3, 低: 4 }
    const scatterPoints = computed(() => {
      const map = new Map()
      data.workItems.forEach((w) => {
        const x = PRIORITY_RANK[w.priority] || 3
        const y = w.points || 0
        const key = `${x}-${y}`
        const hit = map.get(key) || { x, y, count: 0, names: [] }
        hit.count += 1
        if (hit.names.length < 3) hit.names.push(w.title)
        map.set(key, hit)
      })
      return [...map.values()].map((h) => [h.x, h.y, h.count, h.names.join('<br/>')])
    })

    const radarIndicators = computed(() => [
      { name: '完成任务数', max: Math.max(1, ...members.value.map((m) => m.done)) },
      { name: '完成故事点', max: Math.max(1, ...members.value.map((m) => m.points)) },
      { name: '工作项总数', max: Math.max(1, ...members.value.map((m) => m.total)) },
      { name: '交付占比', max: 100 },
      { name: '参与项目', max: Math.max(1, data.projects.length) },
    ])

    const radarSeries = computed(() =>
      members.value.slice(0, 3).map((m, i) => ({
        name: m.user.name,
        color: ['#23d3a9', '#38bdf8', '#8b7cf6'][i],
        value: [
          m.done,
          m.points,
          m.total,
          pct(m.points, members.value[0]?.points || 1),
          new Set(data.workItems.filter((w) => w.assignee === m.user.id).map((w) => w.projectId)).size,
        ],
      })),
    )

    const pctOf = (row) => {
      const max = members.value[0]?.points || 1
      return Math.round((row.points / max) * 100)
    }

    /* ---------------- 详情构造 ---------------- */
    function buildDetail(key) {
      const raw = key
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null
      void raw

      switch (k) {
        case 'velocity':
          return {
            title: '交付速率（Velocity）',
            subtitle: '每个迭代完成的故事点总量',
            metrics: [
              { label: '最新迭代', value: velocity.value.at(-1)?.value ?? 0, unit: '点' },
              { label: '平均速率', value: Math.round(velocity.value.reduce((a, b) => a + b.value, 0) / (velocity.value.length || 1)), unit: '点' },
              { label: '峰值', value: Math.max(...velocity.value.map((v) => v.value), 0), unit: '点' },
            ],
            series: [
              { name: '速率柱状', height: '260px', option: barOption({ items: velocity.value, unit: ' 点' }) },
              {
                name: '速率趋势',
                height: '200px',
                option: {
                  tooltip: { trigger: 'axis' },
                  grid: { left: 8, right: 14, top: 20, bottom: 6, containLabel: true },
                  xAxis: { type: 'category', data: velocity.value.map((v) => v.label) },
                  yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(19,168,132,.14)', type: 'dashed' } } },
                  series: [{
                    type: 'line', smooth: true, symbolSize: 8,
                    data: velocity.value.map((v) => v.value),
                    lineStyle: { width: 3, color: '#23d3a9' },
                    itemStyle: { color: '#23d3a9', borderColor: '#fff', borderWidth: 2 },
                    areaStyle: { color: 'rgba(35,211,169,.18)' },
                  }],
                },
              },
            ],
            desc:
              '**交付速率**反映团队在单个迭代内的实际产出能力，是迭代承诺的依据。\n\n' +
              '计算：`该迭代内状态变为「已完成」的工作项的故事点之和`。',
            table: {
              columns: [
                { key: 'label', label: '迭代', width: 100 },
                { key: 'value', label: '完成故事点', width: 120, align: 'right' },
                { key: 'diff', label: '环比', width: 100, align: 'right' },
                { key: 'trend', label: '趋势', minWidth: 120 },
              ],
              rows: velocity.value.map((v, i) => ({
                label: v.label,
                value: v.value,
                diff: i === 0 ? '—' : (v.value - velocity.value[i - 1].value >= 0 ? '+' : '') + (v.value - velocity.value[i - 1].value),
                trend: i === 0 ? '—' : v.value >= velocity.value[i - 1].value ? '上升' : '下降',
              })),
            },
            notes: ['演示速率序列为内置样本；接入真实数据后应按迭代结束时间聚合。'],
          }

        case 'cycle':
          return {
            title: '需求交付周期',
            subtitle: '需求从创建到「已完成」的平均天数',
            metrics: [
              { label: '平均周期', value: '9.4', unit: '天' },
              { label: '环比', value: '-12', unit: '%', hint: '较上一周期' },
              { label: '已完成需求', value: data.requirements.filter((r) => r.status === '已完成').length, unit: '条' },
            ],
            desc:
              '**交付周期（Lead Time）** 衡量从需求提出到交付完成的端到端耗时，是客户感知最直接的指标。\n\n' +
              '缩短手段：减少排队等待（评审、排期）、控制在制品数量。',
            table: {
              columns: [
                { key: 'code', label: '编号', width: 130, type: 'mono' },
                { key: 'title', label: '需求', minWidth: 200 },
                { key: 'created', label: '创建时间', width: 110 },
                { key: 'status', label: '状态', width: 100 },
                { key: 'points', label: '故事点', width: 85, align: 'right' },
              ],
              rows: data.requirements
                .filter((r) => r.status === '已完成')
                .map((r) => ({
                  code: r.code, title: r.title,
                  created: (r.createdAt || '').slice(0, 10),
                  status: r.status, points: r.points,
                })),
              empty: '暂无已完成需求',
            },
            notes: ['演示值为内置样本；真实实现需记录需求每次状态变更时间戳以精确计算。'],
          }

        case 'defect':
          return {
            title: '缺陷密度',
            subtitle: '缺陷数 ÷ 故事点总数',
            metrics: [
              { label: '缺陷密度', value: defectDensity.value, unit: '个/点' },
              { label: '未完成缺陷', value: openBugs.value, unit: '个' },
              { label: '缺陷总数', value: data.workItems.filter((w) => w.type === '缺陷').length, unit: '个' },
              { label: '故事点总量', value: totalPoints.value, unit: '点' },
            ],
            chart: {
              height: '250px',
              option: barOption({
                items: [
                  { label: '缺陷', value: data.workItems.filter((w) => w.type === '缺陷').length, color: '#ff7a6b' },
                  { label: '任务', value: data.workItems.filter((w) => w.type === '任务').length },
                  { label: '需求', value: data.workItems.filter((w) => w.type === '需求').length, color: '#38bdf8' },
                  { label: '子任务', value: data.workItems.filter((w) => w.type === '子任务').length, color: '#8b7cf6' },
                ],
                unit: ' 项',
              }),
            },
            desc:
              '**缺陷密度**越低表示交付质量越高。\n\n' +
              '注意：该指标会受需求拆分粒度影响 —— 故事点总量越小，密度越容易被放大，横向对比时应确保口径一致。',
            table: {
              columns: [
                { key: 'code', label: '编号', width: 110, type: 'mono' },
                { key: 'title', label: '缺陷', minWidth: 200 },
                { key: 'priority', label: '优先级', width: 90 },
                { key: 'status', label: '状态', width: 100 },
                { key: 'assignee', label: '负责人', width: 100 },
              ],
              rows: data.workItems
                .filter((w) => w.type === '缺陷')
                .map((w) => ({
                  code: w.code, title: w.title, priority: w.priority,
                  status: w.status, assignee: data.userById(w.assignee).name,
                })),
              empty: '暂无缺陷',
            },
            notes: ['测试执行失败会按自动化规则自动创建缺陷，因此缺陷数可能随测试进度快速变化。'],
          }

        case 'passRate': {
          const cases = data.testCases
          const byResult = groupCount(cases, 'lastResult')
          return {
            title: '用例通过率',
            subtitle: `${cases.length} 条用例的执行结果分布`,
            metrics: [
              { label: '通过率', value: pct(byResult['通过'] || 0, cases.length), unit: '%' },
              { label: '通过', value: byResult['通过'] || 0, unit: '条' },
              { label: '失败', value: byResult['失败'] || 0, unit: '条' },
              { label: '阻塞', value: byResult['阻塞'] || 0, unit: '条' },
              { label: '未执行', value: byResult['未执行'] || 0, unit: '条' },
              { label: '用例总数', value: cases.length, unit: '条' },
            ],
            series: [
              {
                name: '结果分布',
                height: '260px',
                option: donutOption({
                  items: [
                    { label: '通过', value: byResult['通过'] || 0, color: '#23d3a9' },
                    { label: '失败', value: byResult['失败'] || 0, color: '#ff7a6b' },
                    { label: '阻塞', value: byResult['阻塞'] || 0, color: '#ffb020' },
                    { label: '未执行', value: byResult['未执行'] || 0, color: '#a3bdb7' },
                  ],
                  centerLabel: '用例',
                }),
              },
              {
                name: '各模块用例数',
                height: '230px',
                option: barOption({
                  items: Object.keys(groupCount(cases, 'module')).map((m) => ({ label: m, value: groupCount(cases, 'module')[m] })),
                  horizontal: true, unit: ' 条',
                }),
              },
            ],
            desc:
              '通过率 = **通过用例数 ÷ 用例总数**。\n\n' +
              '「未执行」计入分母，因此尚未开展的测试会拉低通过率 —— 若只关注已执行部分，请参考下方明细自行换算。',
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 120, type: 'mono' },
                { key: 'title', label: '用例', minWidth: 200 },
                { key: 'module', label: '模块', width: 100 },
                { key: 'priority', label: '优先级', width: 85 },
                { key: 'result', label: '最近结果', width: 100 },
              ],
              rows: cases.map((c) => ({
                code: c.code, title: c.title, module: c.module,
                priority: c.priority, result: c.lastResult,
              })),
            },
            notes: ['用例结果可在「测试管理」中逐条标记，或通过测试计划批量执行。'],
          }
        }

        case 'burndown': {
          const a = burndownActual.value
          const ideal = burndownIdeal.value
          const lastActual = a.at(-1)?.value ?? 0
          const lastIdeal = ideal.at(-1)?.value ?? 0
          return {
            title: '迭代燃尽图',
            subtitle: '剩余故事点随时间的下降曲线',
            metrics: [
              { label: '起始剩余', value: a[0]?.value ?? 0, unit: '点' },
              { label: '当前剩余', value: lastActual, unit: '点' },
              { label: '理想剩余', value: lastIdeal, unit: '点' },
              { label: '偏差', value: lastActual - lastIdeal, unit: '点', hint: lastActual > lastIdeal ? '落后于计划' : '领先于计划' },
            ],
            chart: {
              height: '320px',
              option: {
                tooltip: { trigger: 'axis' },
                legend: { top: 0, right: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11.5, color: '#6f908a' } },
                grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
                xAxis: { type: 'category', data: a.map((d) => d.label), boundaryGap: false, axisTick: { show: false } },
                yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(19,168,132,.14)', type: 'dashed' } } },
                series: [
                  {
                    name: '实际剩余', type: 'line', smooth: true, symbolSize: 7,
                    data: a.map((d) => d.value),
                    lineStyle: { width: 3, color: '#23d3a9' },
                    itemStyle: { color: '#23d3a9', borderColor: '#fff', borderWidth: 2 },
                    areaStyle: { color: 'rgba(35,211,169,.18)' },
                  },
                  {
                    name: '理想线', type: 'line', symbol: 'none',
                    data: ideal.map((d) => d.value),
                    lineStyle: { width: 2, color: '#a3bdb7', type: 'dashed' },
                  },
                ],
              },
            },
            desc:
              '**燃尽图**用于判断迭代进度健康度：\n\n' +
              '- 实际曲线**持续高于**理想线 → 进度落后，需要削减范围或补充人力\n' +
              '- 曲线**长时间走平** → 工作项卡在某个状态（如待测试堆积）\n' +
              '- 曲线**突然上跳** → 迭代中插入了新范围（Scope Creep）',
            table: {
              columns: [
                { key: 'label', label: '时间', width: 90 },
                { key: 'actual', label: '实际剩余', width: 110, align: 'right' },
                { key: 'ideal', label: '理想剩余', width: 110, align: 'right' },
                { key: 'gap', label: '偏差', minWidth: 100, align: 'right' },
              ],
              rows: a.map((d, i) => ({
                label: d.label,
                actual: d.value,
                ideal: ideal[i]?.value ?? 0,
                gap: d.value - (ideal[i]?.value ?? 0),
              })),
            },
            notes: ['演示燃尽序列为内置样本；真实实现需按天记录迭代剩余故事点快照。'],
          }
        }

        case 'statusDist': {
          const rows = statusDist.value.map((s) => ({
            status: s.label,
            count: s.value,
            ratio: pct(s.value, statusDist.value.reduce((a, b) => a + b.value, 0)),
          }))
          return {
            title: arg ? `工作项状态分布 · ${arg}` : '工作项状态分布',
            subtitle: `共 ${statusDist.value.reduce((a, b) => a + b.value, 0)} 个工作项`,
            chart: {
              height: '300px',
              option: donutOption({
                items: statusDist.value,
                centerLabel: '工作项',
              }),
            },
            desc:
              '反映工作项在流程各环节的分布：\n\n' +
              '- **待处理** 过高 → 排期能力不足或需求积压\n' +
              '- **待测试** 堆积 → 测试资源瓶颈，是常见的交付卡点\n' +
              '- **已完成** 占比是项目进度计算的分子',
            table: {
              columns: [
                { key: 'status', label: '状态', width: 120 },
                { key: 'count', label: '数量', width: 90, align: 'right' },
                { key: 'ratio', label: '占比', minWidth: 100, align: 'right', type: 'pct' },
                { key: 'points', label: '故事点', width: 100, align: 'right' },
              ],
              rows: statusDist.value.map((s) => {
                const list = data.workItems.filter((w) => w.status === s.label)
                return {
                  status: s.label, count: s.value,
                  ratio: pct(s.value, data.workItems.length),
                  points: list.reduce((a, w) => a + (w.points || 0), 0),
                }
              }),
              empty: '暂无工作项',
            },
            notes: arg ? [`已按「${arg}」筛选展示；点击其他扇区可切换。`] : ['点击环形图扇区可直接下钻到该状态。'],
          }
        }

        case 'typeDist': {
          return {
            title: '工作项类型分布',
            subtitle: '任务 / 需求 / 缺陷 / 子任务',
            chart: {
              height: '280px',
              option: donutOption({ items: typeDist.value, centerLabel: '工作项' }),
            },
            desc: '用于观察团队工作构成：**缺陷占比升高**通常意味着质量下滑或回归不足。',
            table: {
              columns: [
                { key: 'type', label: '类型', width: 110 },
                { key: 'count', label: '数量', width: 90, align: 'right' },
                { key: 'points', label: '故事点', width: 100, align: 'right' },
                { key: 'done', label: '已完成', width: 90, align: 'right' },
              ],
              rows: typeDist.value.map((t) => {
                const list = data.workItems.filter((w) => w.type === t.label)
                return {
                  type: t.label, count: t.value,
                  points: list.reduce((a, w) => a + (w.points || 0), 0),
                  done: list.filter((w) => w.status === '已完成').length,
                }
              }),
            },
            notes: ['缺陷类工作项可由「测试失败自动创建缺陷」规则自动生成。'],
          }
        }

        case 'scatter':
          return {
            title: '优先级 × 故事点分布',
            subtitle: '每个气泡代表一种「优先级 + 点数」组合',
            metrics: [
              { label: '工作项', value: data.workItems.length, unit: '项' },
              { label: '高优先级', value: data.workItems.filter((w) => ['高', '紧急'].includes(w.priority)).length, unit: '项' },
              { label: '平均点数', value: data.workItems.length ? (totalPoints.value / data.workItems.length).toFixed(1) : 0, unit: '点' },
            ],
            chart: {
              height: '340px',
              option: scatterOption({ points: scatterPoints.value, xName: '优先级档位', yName: '故事点' }),
            },
            desc:
              '横轴 1~4 依次为**紧急 / 高 / 中 / 低**，纵轴为故事点，气泡大小表示该组合下的工作项数量。\n\n' +
              '用途：发现「高优先级 + 大点数」的组合 —— 这类项风险最高，建议进一步拆分。',
            table: {
              columns: [
                { key: 'priority', label: '优先级', width: 100 },
                { key: 'points', label: '故事点', width: 100, align: 'right' },
                { key: 'count', label: '数量', minWidth: 90, align: 'right' },
              ],
              rows: scatterPoints.value.map((p) => ({
                priority: ['', '紧急', '高', '中', '低'][p[0]] || p[0],
                points: p[1],
                count: p[2],
              })),
            },
            notes: ['气泡大小 = 该组合的工作项数量（已做上下限约束，避免极端值撑破图例）。'],
          }

        case 'radar':
          return {
            title: '团队能力雷达',
            subtitle: '按完成故事点排序的前 3 名成员',
            chart: {
              height: '340px',
              option: radarOption({ indicators: radarIndicators.value, series: radarSeries.value }),
            },
            desc:
              '从「完成任务数 / 完成故事点 / 工作项总数 / 交付占比 / 参与项目数」五个维度对比成员表现。\n\n' +
              '> 注意：该图仅反映**分工结构**，不能直接作为个人绩效结论 —— 任务难度与协作成本差异未纳入。',
            table: {
              columns: [
                { key: 'name', label: '成员', width: 100 },
                { key: 'role', label: '角色', width: 120 },
                { key: 'done', label: '已完成', width: 90, align: 'right' },
                { key: 'points', label: '故事点', width: 90, align: 'right' },
                { key: 'projects', label: '参与项目', minWidth: 100, align: 'right' },
              ],
              rows: members.value.slice(0, 3).map((m) => ({
                name: m.user.name, role: m.user.role, done: m.done, points: m.points,
                projects: new Set(data.workItems.filter((w) => w.assignee === m.user.id).map((w) => w.projectId)).size,
              })),
            },
            notes: ['雷达图各轴量纲不同，已按各自最大值归一，仅用于形状对比。'],
          }

        case 'goalRate':
          return {
            title: '迭代目标达成率',
            subtitle: '承诺范围 vs 实际交付',
            metrics: [
              { label: '达成率', value: 82, unit: '%' },
              { label: '已完成工作项', value: data.workItems.filter((w) => w.status === '已完成').length, unit: '项' },
              { label: '工作项总数', value: data.workItems.length, unit: '项' },
            ],
            chart: {
              height: '260px',
              option: gaugeOption({ value: 82, name: '达成率', size: 240 }),
            },
            desc: '达成率反映团队对迭代承诺的兑现能力。健康区间通常在 **80%~100%**：过低说明承诺过载，长期 100% 则可能承诺偏保守。',
            notes: ['演示值为内置样本。'],
            actions: [{ key: 'gotoProject', label: '查看项目看板', icon: 'project', primary: true }],
          }

        case 'pointRate':
          return {
            title: '完成故事点占比',
            subtitle: '已完成工作项的故事点 ÷ 全部故事点',
            metrics: [
              { label: '完成占比', value: pointRate.value, unit: '%' },
              { label: '已完成点数', value: overview.value?.workItems?.donePoints ?? 0, unit: '点' },
              { label: '总点数', value: overview.value?.workItems?.totalPoints ?? totalPoints.value, unit: '点' },
            ],
            series: [
              { name: '完成占比', height: '220px', option: gaugeOption({ value: pointRate.value, name: '完成占比', color: '#8b7cf6', size: 220 }) },
              {
                name: '各项目点数构成',
                height: '240px',
                option: barOption({
                  items: data.projects.map((p) => ({
                    label: p.identifier,
                    value: data.workItems.filter((w) => w.projectId === p.id).reduce((a, w) => a + (w.points || 0), 0),
                  })),
                  unit: ' 点',
                }),
              },
            ],
            desc: '与「按数量」计算的进度不同，**按故事点**加权能更真实地反映交付价值（大项完成的影响更大）。',
            notes: ['同一项目的进度条按数量计算，本图按点数计算，两者可能不一致，属预期行为。'],
          }

        /* --- 单个成员明细 --- */
        default: {
          if (!k.startsWith('member')) return null
          const m = members.value.find((x) => x.user.id === arg)
          if (!m) return null
          const list = data.workItems.filter((w) => w.assignee === m.user.id)
          const byStatus = groupCount(list, 'status')
          return {
            title: `${m.user.name} · 效能明细`,
            subtitle: `${m.user.role} · ${m.user.dept}`,
            metrics: [
              { label: '工作项总数', value: m.total, unit: '项' },
              { label: '已完成', value: m.done, unit: '项' },
              { label: '完成故事点', value: m.points, unit: '点' },
              { label: '完成率', value: pct(m.done, m.total), unit: '%' },
              { label: '参与项目', value: new Set(list.map((w) => w.projectId)).size, unit: '个' },
              { label: '团队排名', value: members.value.findIndex((x) => x.user.id === m.user.id) + 1, unit: '名' },
            ],
            chart: {
              height: '250px',
              option: donutOption({
                items: Object.keys(byStatus).map((s) => ({
                  label: s, value: byStatus[s], color: STATUS_COLORS[s] || '#a3bdb7',
                })),
                centerLabel: '工作项',
              }),
            },
            desc:
              '统计该成员名下**全部工作项**的分布与完成情况。\n\n' +
              '故事点仅统计状态为「已完成」的工作项。',
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 110, type: 'mono' },
                { key: 'title', label: '标题', minWidth: 190 },
                { key: 'type', label: '类型', width: 80 },
                { key: 'status', label: '状态', width: 95 },
                { key: 'points', label: '点数', width: 70, align: 'right' },
                { key: 'project', label: '项目', width: 150 },
              ],
              rows: list.map((w) => ({
                code: w.code, title: w.title, type: w.type, status: w.status,
                points: w.points, project: data.projectById(w.projectId)?.name || '—',
              })),
              empty: '该成员暂无工作项',
            },
            notes: ['成员工作量受任务难度、协作成本影响，本表仅反映可量化部分。'],
          }
        }
      }
    }

    function onDetailAction(key) {
      if (key === 'export') {
        const a = document.createElement('a')
        a.href = exportUrl('metrics/members')
        a.download = '效能报表-成员.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        ElMessage.success('已开始下载')
      } else if (key === 'gotoProject') {
        window.location.hash = '#/project'
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    function exportReport() {
      const a = document.createElement('a')
      a.href = exportUrl('metrics/members')
      a.download = '效能报表-成员.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('效能报表已导出')
    }

    onMounted(async () => {
      loading.value = true
      try {
        const [ov, ms] = await Promise.all([domainApi.metricsOverview(), domainApi.metricsMembers()])
        overview.value = ov
        members.value = Array.isArray(ms) ? ms : []
      } catch (e) {
        ElMessage.error(errorMessage(e, '效能数据加载失败'))
      } finally {
        loading.value = false
      }
    })

    return {
      data, tab, range, overview, members, loading,
      burndownActual, burndownIdeal, velocity, statusDist, typeDist,
      pointRate, openBugs, totalPoints, defectDensity, scatterPoints,
      radarIndicators, radarSeries, pctOf,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction, exportReport,
    }
  },
}
