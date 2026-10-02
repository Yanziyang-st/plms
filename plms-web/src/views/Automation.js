import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, StatCard, EmptyState } from '../components/ui.js'
import { Donut, BarChart } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useDataStore } from '../stores/data.js'
import { errorMessage } from '../api/request.js'
import { fromNow } from '../utils/format.js'
import { donutOption, barOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

const TRIGGERS = ['工作项创建时', '工作项状态变更时', '用例执行失败时', '迭代状态变更时', '每日定时']

const TEMPLATES = [
  { name: '新任务默认优先级', triggerEvent: '工作项创建时', scope: '全部项目', conditionExpr: '工作项类型 = 任务', actions: ['设置优先级为「中」'] },
  { name: '缺陷自动指派', triggerEvent: '工作项创建时', scope: '全部项目', conditionExpr: '工作项类型 = 缺陷', actions: ['通知工作项负责人'] },
  { name: '用例失败建缺陷', triggerEvent: '用例执行失败时', scope: '全部测试库', conditionExpr: '执行结果 = 失败', actions: ['创建缺陷工作项'] },
  { name: '迭代结束归档', triggerEvent: '迭代状态变更时', scope: '全部项目', conditionExpr: '迭代状态 = 已完成', actions: ['移动未完成工作项'] },
]

export default {
  name: 'AutomationView',
  components: { AppIcon, PageHeader, StatCard, EmptyState, Donut, BarChart, PanelCard, DetailDrawer },
  template: `
    <div>
      <PageHeader title="自动化" description="通过触发规则自动完成重复性任务，降低人工成本与错误率">
        <template #actions>
          <button class="btn" @click="templateDialog = true"><AppIcon name="sparkles" :size="16" /> 从模板创建</button>
          <button class="btn btn-primary" @click="openRuleDialog()"><AppIcon name="plus" :size="16" /> 新建规则</button>
        </template>
      </PageHeader>

      <div class="grid g-4 mb-4">
        <StatCard label="规则总数" :value="data.automations.length" icon="automation" clickable
                  :foot="'覆盖 ' + triggerTypes + ' 类触发时机'" bg="#e6fbf5" color="#0c8a6c"
                  @detail="openDetail('rules')" />
        <StatCard label="已启用" :value="enabledCount" icon="zap" clickable
                  :foot="'停用 ' + (data.automations.length - enabledCount) + ' 条'" bg="#e8f7fe" color="#0284c7"
                  @detail="openDetail('enabled')" />
        <StatCard label="累计执行" :value="totalRuns" icon="refresh" clickable
                  :foot="'平均 ' + avgRuns + ' 次/条'" bg="#f1eefe" color="#6d5dd3"
                  @detail="openDetail('runs')" />
        <StatCard label="节省人工" :value="totalRuns * 2 + ' 分钟'" icon="clock" clickable
                  foot="按每次执行省 2 分钟估算" bg="#fff6e5" color="#c2820f" @detail="openDetail('saved')" />
      </div>

      <div class="grid g-2-1">
        <PanelCard title="自动化规则" :subtitle="data.automations.length + ' 条规则'" clickable footer-hint
                   :body-style="{ padding: '10px' }" @detail="openDetail('rules')">
          <div v-loading="loading">
            <div v-for="r in data.automations" :key="r.id" class="card card-pad mb-3" style="background:rgba(255,255,255,.4)">
              <div class="flex items-center gap-2 mb-3">
                <span :style="{ width:'34px', height:'34px', borderRadius:'11px', display:'grid', placeItems:'center',
                                background: r.enabled ? 'var(--mint-grad)' : 'rgba(163,189,183,.4)',
                                color: r.enabled ? '#04352c' : '#6f908a' }">
                  <AppIcon name="zap" :size="17" />
                </span>
                <div style="flex:1">
                  <b style="font-size:14px">{{ r.name }}</b>
                  <div class="fs-12 text-3">{{ r.scope }} · 已执行 {{ r.runs }} 次 · {{ r.lastRun ? fromNow(r.lastRun) : '未执行' }}</div>
                </div>
                <el-switch :model-value="r.enabled" @change="toggle(r)" :loading="pendingId === r.id" />
              </div>

              <div class="flex items-center gap-2 wrap fs-12">
                <span class="chip" style="background:var(--sky-50);color:#0284c7;border-color:rgba(56,189,248,.3)">
                  <AppIcon name="play" :size="12" /> 当 {{ r.triggerEvent }}
                </span>
                <AppIcon name="chevronRight" :size="14" />
                <span class="chip" style="background:var(--amber-50);color:#c2820f;border-color:rgba(255,176,32,.3)">
                  <AppIcon name="filter" :size="12" /> {{ r.conditionExpr }}
                </span>
                <AppIcon name="chevronRight" :size="14" />
                <span class="chip" style="background:var(--mint-50);color:var(--mint-700);border-color:rgba(35,211,169,.3)">
                  <AppIcon name="zap" :size="12" /> {{ (r.actions || []).join(' + ') }}
                </span>
              </div>

              <div class="flex gap-2 mt-3">
                <button class="btn btn-sm" @click="openRuleDialog(r)"><AppIcon name="edit" :size="13" /> 编辑</button>
                <button class="btn btn-sm btn-ghost" :disabled="pendingId === r.id" @click="runNow(r)">
                  <AppIcon name="play" :size="13" /> 立即执行
                </button>
                <button class="btn btn-sm btn-danger" @click="removeRule(r)"><AppIcon name="trash" :size="13" /> 删除</button>
              </div>
            </div>
            <EmptyState v-if="!data.automations.length" title="暂无自动化规则" description="点击右上角新建或从模板创建" icon="automation" />
          </div>
        </PanelCard>

        <div style="display:flex;flex-direction:column;gap:18px">
          <PanelCard title="触发类型分布" subtitle="按触发时机统计" clickable footer-hint
                     @detail="openDetail('triggerDist')">
            <Donut :items="triggerDist" center-label="规则" :size="215" interactive
                   @chart-click="(p) => openDetail('trigger:' + p.name)" />
          </PanelCard>

          <PanelCard title="执行次数 TOP" subtitle="按累计执行次数排序" clickable footer-hint
                     @detail="openDetail('runsTop')">
            <BarChart :items="runsTop" :height="190" horizontal unit=" 次" />
          </PanelCard>

          <PanelCard title="动作类型分布" subtitle="规则配置的执行动作" clickable footer-hint
                     @detail="openDetail('actionDist')">
            <BarChart :items="actionDist" :height="190" horizontal unit=" 次" />
          </PanelCard>
        </div>
      </div>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />

      <!-- 新建 / 编辑规则 -->
      <el-dialog v-model="ruleDialog" :title="ruleForm.id ? '编辑自动化规则' : '新建自动化规则'" width="620px">
        <el-form label-position="top">
          <el-form-item label="规则名称" :error="formErrors.name" required>
            <el-input v-model="ruleForm.name" placeholder="例如：新任务自动设置优先级" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="触发时机" :error="formErrors.triggerEvent">
              <el-select v-model="ruleForm.triggerEvent" style="width:100%">
                <el-option v-for="t in TRIGGERS" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="生效范围">
              <el-input v-model="ruleForm.scope" />
            </el-form-item>
          </div>
          <el-form-item label="触发条件">
            <el-input v-model="ruleForm.conditionExpr" placeholder="例如：工作项类型 = 缺陷" />
          </el-form-item>
          <el-form-item label="执行动作（多个用 + 分隔）" :error="formErrors.actions" required>
            <el-input v-model="ruleForm.actionsText" placeholder="例如：通知负责人 + 添加标签" />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-switch v-model="ruleForm.enabled" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="ruleDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveRule">{{ saving ? '保存中…' : '保存' }}</button>
        </template>
      </el-dialog>

      <!-- 模板 -->
      <el-dialog v-model="templateDialog" title="从模板创建" width="560px">
        <div class="form-grid">
          <div v-for="(t, i) in TEMPLATES" :key="i" class="list-row"
               style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45);cursor:pointer"
               @click="useTemplate(i)">
            <div class="grow"><b>{{ t.name }}</b><small>{{ t.triggerEvent }} → {{ t.actions.join(' + ') }}</small></div>
            <AppIcon name="plus" :size="16" />
          </div>
        </div>
      </el-dialog>
    </div>
  `,
  setup() {
    const data = useDataStore()

    const ruleDialog = ref(false)
    const templateDialog = ref(false)
    const saving = ref(false)
    const loading = ref(false)
    const pendingId = ref('')
    const formErrors = ref({})
    const ruleForm = ref(blank())

    function blank() {
      return { id: '', name: '', triggerEvent: TRIGGERS[0], scope: '全部项目', conditionExpr: '', actionsText: '', enabled: true }
    }

    const enabledCount = computed(() => data.automations.filter((r) => r.enabled).length)
    const totalRuns = computed(() => data.automations.reduce((a, r) => a + (r.runs || 0), 0))

    const triggerDist = computed(() => {
      const colors = ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#f472b6']
      const by = {}
      data.automations.forEach((r) => { by[r.triggerEvent] = (by[r.triggerEvent] || 0) + 1 })
      return Object.keys(by).map((k, i) => ({ label: k, value: by[k], color: colors[i % colors.length] }))
    })

    const runsTop = computed(() =>
      data.automations.slice(0, 4).map((r) => ({ label: r.name.slice(0, 5), value: r.runs || 0 })),
    )

    /* ---------------- 详情派生 ---------------- */
    const triggerTypes = computed(() => new Set(data.automations.map((r) => r.triggerEvent)).size)
    const avgRuns = computed(() =>
      data.automations.length ? Math.round(totalRuns.value / data.automations.length) : 0,
    )
    /** 动作维度：统计每个动作被多少条规则使用、累计执行多少次 */
    const actionDist = computed(() => {
      const map = {}
      data.automations.forEach((r) => {
        ;(r.actions || []).forEach((a) => {
          map[a] = (map[a] || 0) + (r.runs || 0)
        })
      })
      return Object.keys(map)
        .map((k) => ({ label: k.length > 10 ? k.slice(0, 10) + '…' : k, value: map[k] }))
        .sort((a, b) => b.value - a.value)
    })

    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null

      const ruleRows = (list) =>
        list.map((r) => ({
          name: r.name, trigger: r.triggerEvent, condition: r.conditionExpr,
          actions: (r.actions || []).join(' + '), scope: r.scope,
          enabled: r.enabled ? '已启用' : '已停用',
          runs: r.runs || 0,
          lastRun: r.lastRun ? fromNow(r.lastRun) : '未执行',
        }))
      const ruleColumns = [
        { key: 'name', label: '规则名称', minWidth: 170 },
        { key: 'trigger', label: '触发时机', width: 140 },
        { key: 'condition', label: '条件', width: 150 },
        { key: 'runs', label: '执行次数', width: 90, align: 'right' },
        { key: 'enabled', label: '状态', width: 90 },
      ]

      switch (k) {
        case 'rules':
          return {
            title: '自动化规则总览',
            subtitle: `${data.automations.length} 条规则 · 覆盖 ${triggerTypes.value} 类触发时机`,
            metrics: [
              { label: '规则总数', value: data.automations.length, unit: '条' },
              { label: '已启用', value: enabledCount.value, unit: '条' },
              { label: '停用', value: data.automations.length - enabledCount.value, unit: '条' },
              { label: '累计执行', value: totalRuns.value, unit: '次' },
              { label: '触发时机', value: triggerTypes.value, unit: '类' },
              { label: '平均执行', value: avgRuns.value, unit: '次/条' },
            ],
            series: [
              { name: '触发类型分布', height: '250px', option: donutOption({ items: triggerDist.value, centerLabel: '规则' }) },
              { name: '各规则执行次数', height: '240px', option: barOption({ items: data.automations.map((r) => ({ label: r.name.slice(0, 8), value: r.runs || 0 })), horizontal: true, unit: ' 次' }) },
            ],
            desc:
              '每条规则由三段式构成：**触发时机 → 触发条件 → 执行动作**。\n\n' +
              '规则启用后，业务事件发生时由服务端匹配并执行；停用后不参与匹配，但历史执行次数保留。',
            table: {
              columns: [...ruleColumns, { key: 'scope', label: '生效范围', width: 170 }, { key: 'actions', label: '动作', minWidth: 200 }],
              rows: ruleRows(data.automations),
            },
            notes: ['「测试失败自动创建缺陷」是唯一会在业务接口中直接产生副作用的规则（执行用例失败时触发）。'],
          }

        case 'enabled': {
          const on = data.automations.filter((r) => r.enabled)
          const off = data.automations.filter((r) => !r.enabled)
          return {
            title: '规则启停状态',
            subtitle: `启用 ${on.length} 条 · 停用 ${off.length} 条`,
            metrics: [
              { label: '已启用', value: on.length, unit: '条' },
              { label: '已停用', value: off.length, unit: '条' },
              { label: '启用率', value: pct(on.length, data.automations.length), unit: '%' },
              { label: '停用规则执行量', value: off.reduce((a, r) => a + (r.runs || 0), 0), unit: '次' },
            ],
            chart: {
              height: '250px',
              option: donutOption({
                items: [
                  { label: '已启用', value: on.length, color: '#23d3a9' },
                  { label: '已停用', value: off.length, color: '#a3bdb7' },
                ],
                centerLabel: '规则',
              }),
            },
            desc: '停用规则不会删除历史执行记录；重新启用后立即生效。',
            table: {
              columns: [...ruleColumns, { key: 'lastRun', label: '最近执行', width: 110 }],
              rows: ruleRows(data.automations),
            },
            notes: [],
          }
        }

        case 'runs': {
          const sorted = [...data.automations].sort((a, b) => (b.runs || 0) - (a.runs || 0))
          return {
            title: '执行次数统计',
            subtitle: `累计 ${totalRuns.value} 次 · 平均 ${avgRuns.value} 次/条`,
            metrics: [
              { label: '累计执行', value: totalRuns.value, unit: '次' },
              { label: '平均', value: avgRuns.value, unit: '次/条' },
              { label: '最高', value: sorted[0]?.runs || 0, unit: '次', hint: sorted[0]?.name || '' },
              { label: '最少', value: sorted.at(-1)?.runs || 0, unit: '次', hint: sorted.at(-1)?.name || '' },
            ],
            chart: {
              height: '280px',
              option: barOption({ items: sorted.map((r) => ({ label: r.name.slice(0, 8), value: r.runs || 0 })), horizontal: true, unit: ' 次' }),
            },
            desc:
              '执行次数包含**自动触发**与**手动执行**两种来源。\n\n' +
              '某条规则执行次数远高于其他规则，通常说明该场景重复劳动多，自动化收益明显。',
            table: {
              columns: [
                { key: 'name', label: '规则名称', minWidth: 180 },
                { key: 'runs', label: '执行次数', width: 100, align: 'right' },
                { key: 'lastRun', label: '最近执行', width: 120 },
                { key: 'enabled', label: '状态', minWidth: 90 },
              ],
              rows: sorted.map((r) => ({
                name: r.name, runs: r.runs || 0,
                lastRun: r.lastRun ? fromNow(r.lastRun) : '未执行',
                enabled: r.enabled ? '已启用' : '已停用',
              })),
            },
            notes: ['「节省人工」按每次执行 2 分钟估算，仅作量级参考。'],
          }
        }

        case 'saved':
          return {
            title: '节省人工估算',
            subtitle: '按每次自动执行替代 2 分钟人工操作估算',
            metrics: [
              { label: '累计节省', value: (totalRuns.value * 2 / 60).toFixed(1), unit: '小时' },
              { label: '折算', value: totalRuns.value * 2, unit: '分钟' },
              { label: '执行次数', value: totalRuns.value, unit: '次' },
              { label: '单次假设', value: 2, unit: '分钟' },
            ],
            chart: {
              height: '250px',
              option: barOption({
                items: data.automations.map((r) => ({ label: r.name.slice(0, 8), value: (r.runs || 0) * 2 })),
                horizontal: true, unit: ' 分钟',
              }),
            },
            desc:
              '**估算口径**：`节省时间 = 执行次数 × 2 分钟`。\n\n' +
              '该系数为演示假设值。真实场景应区分规则类型：\n' +
              '- 通知类规则：单次约 1 分钟\n' +
              '- 创建/流转类规则：单次约 3~5 分钟',
            table: {
              columns: [
                { key: 'name', label: '规则', minWidth: 180 },
                { key: 'runs', label: '执行次数', width: 100, align: 'right' },
                { key: 'minutes', label: '节省(分钟)', minWidth: 110, align: 'right' },
              ],
              rows: data.automations.map((r) => ({
                name: r.name, runs: r.runs || 0, minutes: (r.runs || 0) * 2,
              })),
            },
            notes: ['该指标为**估算值**，不应用于绩效考核。'],
          }

        case 'triggerDist': {
          return {
            title: arg ? `触发类型分布 · ${arg}` : '触发类型分布',
            subtitle: `${triggerTypes.value} 类触发时机`,
            chart: { height: '300px', option: donutOption({ items: triggerDist.value, centerLabel: '规则' }) },
            desc: '反映自动化的生效场景分布。若某类触发时机没有规则，说明该场景仍靠人工。',
            table: {
              columns: [
                { key: 'trigger', label: '触发时机', minWidth: 160 },
                { key: 'count', label: '规则数', width: 90, align: 'right' },
                { key: 'runs', label: '累计执行', width: 110, align: 'right' },
                { key: 'ratio', label: '占比', width: 90, align: 'right', type: 'pct' },
              ],
              rows: Object.keys(groupCount(data.automations, 'triggerEvent')).map((t) => ({
                trigger: t,
                count: groupCount(data.automations, 'triggerEvent')[t],
                runs: data.automations.filter((r) => r.triggerEvent === t).reduce((a, r) => a + (r.runs || 0), 0),
                ratio: pct(groupCount(data.automations, 'triggerEvent')[t], data.automations.length),
              })),
            },
            notes: ['点击环形图扇区可查看该触发时机的规则明细。'],
          }
        }

        case 'trigger': {
          const list = data.automations.filter((r) => r.triggerEvent === arg)
          return {
            title: `触发时机 · ${arg}`,
            subtitle: `${list.length} 条规则`,
            metrics: [
              { label: '规则数', value: list.length, unit: '条' },
              { label: '已启用', value: list.filter((r) => r.enabled).length, unit: '条' },
              { label: '累计执行', value: list.reduce((a, r) => a + (r.runs || 0), 0), unit: '次' },
            ],
            chart: {
              height: '230px',
              option: barOption({ items: list.map((r) => ({ label: r.name.slice(0, 8), value: r.runs || 0 })), unit: ' 次' }),
            },
            desc: `筛选触发时机为「${arg}」的规则。`,
            table: {
              columns: [...ruleColumns, { key: 'actions', label: '动作', minWidth: 200 }],
              rows: ruleRows(list),
              empty: '该触发时机下暂无规则',
            },
            notes: [],
          }
        }

        case 'runsTop':
          return {
            title: '执行次数 TOP 4',
            subtitle: '执行最频繁的规则',
            chart: { height: '300px', option: barOption({ items: runsTop.value, horizontal: true, unit: ' 次' }) },
            desc: '这些规则覆盖了最高频的重复劳动，是自动化投入产出比最高的部分。',
            table: {
              columns: [
                { key: 'name', label: '规则名称', minWidth: 180 },
                { key: 'runs', label: '执行次数', width: 100, align: 'right' },
                { key: 'scope', label: '生效范围', minWidth: 170 },
              ],
              rows: data.automations
                .slice(0, 4)
                .map((r) => ({ name: r.name, runs: r.runs || 0, scope: r.scope })),
            },
            notes: [],
          }

        case 'actionDist':
          return {
            title: '动作类型分布',
            subtitle: '所有规则配置的动作及其累计执行次数',
            metrics: [
              { label: '动作种类', value: Object.keys(groupCount(data.automations.flatMap((r) => (r.actions || []).map((a) => ({ a }))), 'a')).length, unit: '种' },
              { label: '规则总数', value: data.automations.length, unit: '条' },
              { label: '累计执行', value: totalRuns.value, unit: '次' },
            ],
            chart: { height: '280px', option: barOption({ items: actionDist.value, horizontal: true, unit: ' 次' }) },
            desc:
              '按**动作**维度聚合累计执行次数（一条规则含多个动作时，每个动作都计入其所属规则的全部执行次数）。\n\n' +
              '因此该图数值之和会大于总执行次数，属于预期行为。',
            table: {
              columns: [
                { key: 'action', label: '动作', minWidth: 200 },
                { key: 'value', label: '累计执行', width: 110, align: 'right' },
              ],
              rows: actionDist.value.map((a) => ({ action: a.label, value: a.value })),
            },
            notes: ['该统计为「动作 × 规则执行次数」的加权聚合，非独立计数。'],
          }

        default:
          return null
      }
    }

    function onDetailAction(key) {
      if (key === 'export') {
        /* 自动化规则暂无后端导出，这里给出提示 */
        ElMessage.info('自动化规则导出暂未开放')
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    async function toggle(r) {
      pendingId.value = r.id
      try {
        const updated = await data.toggleAutomation(r.id)
        ElMessage.success(updated.enabled ? '规则已启用' : '规则已停用')
      } catch (e) {
        ElMessage.error(errorMessage(e, '切换失败'))
      } finally {
        pendingId.value = ''
      }
    }

    async function runNow(r) {
      pendingId.value = r.id
      try {
        await data.runAutomation(r.id)
        ElMessage.success(`规则「${r.name}」已执行一次`)
      } catch (e) {
        ElMessage.error(errorMessage(e, '执行失败'))
      } finally {
        pendingId.value = ''
      }
    }

    function openRuleDialog(row) {
      formErrors.value = {}
      ruleForm.value = row
        ? { ...blank(), ...row, actionsText: (row.actions || []).join(' + ') }
        : blank()
      ruleDialog.value = true
    }

    async function saveRule() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = ruleForm.value
        const payload = {
          name: f.name, triggerEvent: f.triggerEvent, scope: f.scope,
          conditionExpr: f.conditionExpr || '无', enabled: f.enabled,
          actions: f.actionsText.split('+').map((s) => s.trim()).filter(Boolean),
        }
        if (f.id) {
          await data.edit('automations', f.id, payload)
          ElMessage.success('规则已保存')
        } else {
          await data.save('automations', payload)
          ElMessage.success('规则已创建')
        }
        ruleDialog.value = false
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function removeRule(r) {
      try {
        await ElMessageBox.confirm(`确定删除规则「${r.name}」？`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) {
        return
      }
      try {
        await data.destroy('automations', r.id)
        ElMessage.success('已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    async function useTemplate(i) {
      try {
        await data.save('automations', { ...TEMPLATES[i], enabled: true, runs: 0 })
        ElMessage.success('已从模板创建规则')
        templateDialog.value = false
      } catch (e) {
        ElMessage.error(errorMessage(e, '创建失败'))
      }
    }

    return {
      data, ruleDialog, templateDialog, saving, loading, pendingId, formErrors, ruleForm,
      enabledCount, totalRuns, triggerDist, runsTop, triggerTypes, avgRuns, actionDist,
      TRIGGERS, TEMPLATES,
      toggle, runNow, openRuleDialog, saveRule, removeRule, useTemplate, fromNow,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction,
    }
  },
}
