import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, StatusBadge, UserChip, EmptyState, StatCard } from '../components/ui.js'
import { Donut, BarChart, Gauge } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useDataStore } from '../stores/data.js'
import { useAuthStore } from '../stores/auth.js'
import { errorMessage } from '../api/request.js'
import { exportUrl } from '../api/index.js'
import { fmtDate, statusKind, priorityColor } from '../utils/format.js'
import { donutOption, barOption, gaugeOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

const RESULTS = [
  ['通过', '#23d3a9'],
  ['失败', '#ff7a6b'],
  ['阻塞', '#ffb020'],
  ['未执行', '#a3bdb7'],
]

export default {
  name: 'TestView',
  components: {
    AppIcon, PageHeader, StatusBadge, UserChip, EmptyState, StatCard,
    Donut, BarChart, Gauge, PanelCard, DetailDrawer,
  },
  template: `
    <div>
      <PageHeader title="测试管理" description="用例维护、测试计划编排与执行，自动汇总测试报告">
        <template #actions>
          <button class="btn" @click="exportCases"><AppIcon name="download" :size="16" /> 导出用例</button>
          <button v-if="canWrite" class="btn" @click="openPlanDialog"><AppIcon name="plus" :size="16" /> 新建测试计划</button>
          <button v-if="canWrite" class="btn btn-primary" @click="openCaseDialog"><AppIcon name="plus" :size="16" /> 新建用例</button>
        </template>
      </PageHeader>

      <!-- 统计卡（可点击） -->
      <div class="grid g-4 mb-4">
        <StatCard label="用例总数" :value="cases.length" icon="test" clickable
                  :foot="'覆盖 ' + moduleCount + ' 个模块'" @detail="openDetail('cases')" />
        <StatCard label="通过率" :value="passRate + '%'" icon="checkCircle" clickable
                  :foot="'通过 ' + countBy('通过') + ' / ' + cases.length" bg="#e8f7fe" color="#0284c7"
                  @detail="openDetail('passRate')" />
        <StatCard label="待执行" :value="countBy('未执行')" icon="clock" clickable
                  foot="尚未执行任何结果" bg="#fff6e5" color="#c2820f" @detail="openDetail('pending')" />
        <StatCard label="失败 / 阻塞" :value="countBy('失败') + countBy('阻塞')" icon="bug" clickable
                  :foot="'失败 ' + countBy('失败') + ' · 阻塞 ' + countBy('阻塞')"
                  bg="#ffefec" color="#d64534" @detail="openDetail('failed')" />
      </div>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'cases' }" @click="tab = 'cases'">测试用例</button>
        <button class="tab" :class="{ active: tab === 'plans' }" @click="tab = 'plans'">测试计划</button>
        <button class="tab" :class="{ active: tab === 'report' }" @click="tab = 'report'">测试报告</button>
      </div>

      <!-- 用例 -->
      <div v-if="tab === 'cases'" class="grid g-2-1">
        <div>
          <div class="filters">
            <div class="search-input" style="width:220px">
              <AppIcon name="search" :size="16" />
              <input class="input" v-model="keyword" placeholder="搜索用例" @keyup.enter="fetchCases" />
            </div>
            <select class="select" style="width:190px" v-model="libraryId" @change="fetchCases">
              <option value="">全部测试库</option>
              <option v-for="l in data.testLibraries" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
            <button class="btn btn-sm" @click="fetchCases"><AppIcon name="refresh" :size="14" /> 刷新</button>
          </div>
          <div class="card">
            <el-table :data="caseList" v-loading="loading" style="width:100%">
              <el-table-column label="编号" width="120">
                <template #default="{ row }"><span class="mono fs-12 muted">{{ row.code }}</span></template>
              </el-table-column>
              <el-table-column label="用例标题" min-width="200">
                <template #default="{ row }">
                  <span class="c-title" @click="openCaseDrawer(row)">{{ row.title }}</span>
                  <div class="fs-12 text-3">{{ row.type }} · {{ libraryName(row.libraryId) }}</div>
                </template>
              </el-table-column>
              <el-table-column label="模块" width="110">
                <template #default="{ row }"><span class="tag fs-12">{{ row.module }}</span></template>
              </el-table-column>
              <el-table-column label="优先级" width="90">
                <template #default="{ row }">
                  <span class="prio"><span class="pbar" :style="{ background: priorityColor(row.priority) }"></span>{{ row.priority }}</span>
                </template>
              </el-table-column>
              <el-table-column label="最近结果" width="110">
                <template #default="{ row }"><StatusBadge :text="row.lastResult" :kind="statusKind(row.lastResult)" dot /></template>
              </el-table-column>
              <el-table-column label="维护人" width="120">
                <template #default="{ row }"><UserChip :user="data.userById(row.maintainer)" /></template>
              </el-table-column>
              <template #empty><EmptyState v-if="!loading" title="暂无用例" icon="test" /></template>
            </el-table>
          </div>
        </div>

        <PanelCard title="执行结果分布" :subtitle="cases.length + ' 条用例'" clickable footer-hint
                   @detail="openDetail('resultDist')">
          <Donut :items="resultDist" center-label="用例" :size="228" interactive
                 @chart-click="(p) => openDetail('result:' + p.name)" />
        </PanelCard>
      </div>

      <!-- 计划 -->
      <div v-else-if="tab === 'plans'" class="grid g-2">
        <PanelCard v-for="p in data.testPlans" :key="p.id" :title="p.name"
                   :subtitle="'已执行 ' + planExecuted(p) + '/' + (p.caseIds || []).length"
                   clickable footer-hint @detail="openDetail('plan:' + p.id)">
          <template #right><StatusBadge :text="p.status" :kind="statusKind(p.status)" /></template>
          <dl class="kv mb-3" style="grid-template-columns:88px 1fr;font-size:13px">
            <dt>所属项目</dt><dd>{{ data.projectById(p.projectId)?.name || '—' }}</dd>
            <dt>周期</dt><dd>{{ fmtDate(p.startDate) }} ~ {{ fmtDate(p.endDate) }}</dd>
            <dt>负责人</dt><dd><UserChip :user="data.userById(p.owner)" /></dd>
          </dl>
          <div class="progress"><i :style="{ width: planProgress(p) + '%' }"></i></div>
          <div class="flex items-center" style="justify-content:space-between;margin-top:7px">
            <span class="hint">进度 {{ planProgress(p) }}%</span>
            <span class="hint">通过 {{ planPassed(p) }} 条</span>
          </div>
          <button class="btn btn-primary btn-block mt-3" @click.stop="openExec(p)">
            <AppIcon name="play" :size="15" /> 执行测试计划
          </button>
        </PanelCard>
        <EmptyState v-if="!data.testPlans.length" title="暂无测试计划" icon="calendar" />
      </div>

      <!-- 报告 -->
      <div v-else class="grid g-2-1">
        <PanelCard title="各模块用例数量" :subtitle="'共 ' + moduleCount + ' 个模块'" clickable footer-hint
                   @detail="openDetail('moduleDist')">
          <BarChart :items="moduleDist" :height="220" horizontal unit=" 条" />
        </PanelCard>

        <PanelCard title="本次回归概览" :subtitle="'通过率 ' + passRate + '%'" clickable footer-hint
                   @detail="openDetail('report')">
          <div style="text-align:center">
            <Gauge :value="passRate" :size="180" label="用例通过率" />
          </div>
          <div class="hr"></div>
          <div v-for="[r, c] in RESULTS" :key="r" class="flex items-center mt-2"
               style="justify-content:space-between;font-size:13px">
            <span class="flex items-center gap-2">
              <span :style="{ width:'9px', height:'9px', borderRadius:'3px', background:c }"></span>{{ r }}
            </span>
            <b>{{ countBy(r) }}</b>
          </div>
        </PanelCard>
      </div>

      <!-- 用例详情抽屉 -->
      <el-drawer v-model="caseDrawer" size="620px" :title="currentCase ? currentCase.code + ' · 用例详情' : ''">
        <div v-if="currentCase">
          <div class="flex items-center gap-2 mb-4">
            <StatusBadge :text="currentCase.lastResult" :kind="statusKind(currentCase.lastResult)" dot />
            <span class="prio"><span class="pbar" :style="{ background: priorityColor(currentCase.priority) }"></span>{{ currentCase.priority }}优先级</span>
            <span class="tag">{{ currentCase.module }}</span>
            <span class="chip">{{ currentCase.type }}</span>
          </div>
          <h4 style="font-weight:700;margin-bottom:8px">前置条件</h4>
          <p class="text-2 fs-13 mb-3">{{ currentCase.precondition || '—' }}</p>
          <h4 style="font-weight:700;margin-bottom:8px">测试步骤</h4>
          <ol class="doc-body" style="font-size:13.5px;padding-left:20px;margin-bottom:14px">
            <li v-for="(s, i) in (currentCase.steps || [])" :key="i">{{ s }}</li>
          </ol>
          <h4 style="font-weight:700;margin-bottom:8px">预期结果</h4>
          <p class="text-2 fs-13 mb-3">{{ currentCase.expected }}</p>
          <div class="hr"></div>
          <h4 style="font-weight:700;margin-bottom:10px">标记执行结果</h4>
          <div class="flex gap-2 wrap">
            <button v-for="[r, c] in RESULTS" :key="r" class="btn btn-sm" :disabled="submitting || !canWrite"
                    :style="currentCase.lastResult === r ? { borderColor: c, color: c, background: c + '18' } : {}"
                    @click="markResult(r)">{{ r }}</button>
            <span v-if="!canWrite" class="hint">当前角色无测试写权限</span>
          </div>
        </div>
      </el-drawer>

      <!-- 执行计划抽屉 -->
      <el-drawer v-model="execDrawer" size="700px" :title="currentPlan ? '执行：' + currentPlan.name : ''">
        <div v-if="currentPlan">
          <div class="flex items-center gap-3 mb-4">
            <div style="flex:1">
              <div class="progress"><i :style="{ width: planProgress(currentPlan) + '%' }"></i></div>
              <div class="hint mt-2">已执行 {{ planExecuted(currentPlan) }} / {{ (currentPlan.caseIds || []).length }}</div>
            </div>
            <div style="flex-shrink:0"><Gauge :value="planPassRate(currentPlan)" :size="110" label="通过率" /></div>
          </div>

          <div v-if="canWrite" class="flex gap-2 mb-3">
            <el-select v-model="casesToAdd" multiple filterable size="small" style="flex:1" placeholder="选择要加入计划的用例">
              <el-option v-for="c in addableCases" :key="c.id" :label="c.code + ' ' + c.title" :value="c.id" />
            </el-select>
            <button class="btn btn-sm btn-primary" :disabled="!casesToAdd.length || saving" @click="doAddCases">
              <AppIcon name="plus" :size="13" /> 加入
            </button>
          </div>

          <div class="form-grid">
            <div v-for="c in planCases(currentPlan)" :key="c.id" class="list-row"
                 style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45)">
              <div class="grow"><b>{{ c.title }}</b><small>{{ c.code }} · {{ c.module }}</small></div>
              <StatusBadge :text="planResult(currentPlan, c)" :kind="statusKind(planResult(currentPlan, c))" />
              <div class="flex gap-2">
                <button v-for="[r, col] in RESULTS.slice(0, 3)" :key="r" class="btn btn-sm"
                        :disabled="submitting || !canWrite" :style="{ color: col }"
                        @click="execCase(c, r)">{{ r }}</button>
                <button v-if="canWrite" class="btn btn-sm btn-ghost" :disabled="saving"
                        @click="doRemoveCase(c)"><AppIcon name="close" :size="13" /></button>
              </div>
            </div>
            <EmptyState v-if="!planCases(currentPlan).length" title="计划内暂无用例" icon="test" />
          </div>
        </div>
      </el-drawer>

      <!-- 新建用例 -->
      <el-dialog v-model="caseDialog" title="新建测试用例" width="640px">
        <el-form label-position="top">
          <el-form-item label="用例标题" :error="formErrors.title" required>
            <el-input v-model="caseForm.title" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="测试库" :error="formErrors.libraryId">
              <el-select v-model="caseForm.libraryId" style="width:100%">
                <el-option v-for="l in data.testLibraries" :key="l.id" :label="l.name" :value="l.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属模块">
              <el-input v-model="caseForm.module" />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="caseForm.type" style="width:100%">
                <el-option v-for="t in ['功能','接口','性能','兼容']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="caseForm.priority" style="width:100%">
                <el-option v-for="p in ['高','中','低']" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="前置条件"><el-input v-model="caseForm.precondition" /></el-form-item>
          <el-form-item label="测试步骤（每行一步）">
            <el-input v-model="caseForm.stepsText" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="预期结果"><el-input v-model="caseForm.expected" /></el-form-item>
          <el-form-item label="维护人">
            <el-select v-model="caseForm.maintainer" style="width:100%">
              <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="caseDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveCase">{{ saving ? '保存中…' : '保存' }}</button>
        </template>
      </el-dialog>

      <!-- 新建计划 -->
      <el-dialog v-model="planDialog" title="新建测试计划" width="600px">
        <el-form label-position="top">
          <el-form-item label="计划名称" :error="formErrors.name" required>
            <el-input v-model="planForm.name" placeholder="例如：V2.1 迭代回归测试" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="关联项目">
              <el-select v-model="planForm.projectId" style="width:100%">
                <el-option v-for="p in data.projects" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="planForm.owner" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="选择用例" :error="formErrors.caseIds" required>
            <el-select v-model="planForm.caseIds" multiple filterable style="width:100%" placeholder="请选择用例">
              <el-option v-for="c in data.testCases" :key="c.id" :label="c.code + ' ' + c.title" :value="c.id" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="planDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="savePlan">{{ saving ? '创建中…' : '创建' }}</button>
        </template>
      </el-dialog>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()

    const tab = ref('cases')
    const keyword = ref('')
    const libraryId = ref('')
    const caseList = ref([])
    const loading = ref(false)
    const submitting = ref(false)
    const saving = ref(false)
    const caseDrawer = ref(false)
    const execDrawer = ref(false)
    const caseDialog = ref(false)
    const planDialog = ref(false)
    const formErrors = ref({})
    const currentCase = ref(null)
    const currentPlan = ref(null)
    const caseForm = ref({})
    const planForm = ref({ name: '', projectId: '', owner: '', caseIds: [] })
    const casesToAdd = ref([])

    const canWrite = computed(() => auth.canWrite('test'))
    const addableCases = computed(() => {
      const inPlan = new Set(currentPlan.value?.caseIds || [])
      return data.testCases.filter((c) => !inPlan.has(c.id))
    })

    /* ---------------- 派生 ---------------- */
    const cases = computed(() => data.testCases)
    const countBy = (r) => cases.value.filter((c) => c.lastResult === r).length
    const passRate = computed(() => (cases.value.length ? Math.round((countBy('通过') / cases.value.length) * 100) : 0))
    const moduleCount = computed(() => new Set(cases.value.map((c) => c.module)).size)
    const resultDist = computed(() => RESULTS.map(([label, color]) => ({ label, value: countBy(label), color })))
    const moduleDist = computed(() =>
      Object.keys(groupCount(cases.value, 'module'))
        .map((m) => ({ label: m, value: groupCount(cases.value, 'module')[m] }))
        .sort((a, b) => b.value - a.value),
    )
    const libraryName = (id) => data.libraryById(id)?.name || '—'

    const planCases = (p) => (p.caseIds || []).map((id) => data.testCases.find((c) => c.id === id)).filter(Boolean)
    const planResult = (p, c) => (p.results && p.results[c.id]) || c.lastResult
    const planExecuted = (p) => planCases(p).filter((c) => planResult(p, c) !== '未执行').length
    const planPassed = (p) => planCases(p).filter((c) => planResult(p, c) === '通过').length
    const planProgress = (p) => {
      const list = planCases(p)
      return list.length ? Math.round((planExecuted(p) / list.length) * 100) : 0
    }
    const planPassRate = (p) => {
      const list = planCases(p)
      return list.length ? Math.round((planPassed(p) / list.length) * 100) : 0
    }

    /* ---------------- 详情 ---------------- */
    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null

      const caseRows = (list) =>
        list.map((c) => ({
          code: c.code, title: c.title, module: c.module,
          priority: c.priority, result: c.lastResult,
          library: libraryName(c.libraryId), maintainer: data.userById(c.maintainer).name,
        }))
      const caseColumns = [
        { key: 'code', label: '编号', width: 120, type: 'mono' },
        { key: 'title', label: '用例', minWidth: 190 },
        { key: 'module', label: '模块', width: 95 },
        { key: 'priority', label: '优先级', width: 85 },
        { key: 'result', label: '最近结果', width: 100 },
      ]

      switch (k) {
        case 'cases':
          return {
            title: '测试用例总数',
            subtitle: `覆盖 ${moduleCount.value} 个模块 · ${data.testLibraries.length} 个测试库`,
            metrics: [
              { label: '用例总数', value: cases.value.length, unit: '条' },
              { label: '模块数', value: moduleCount.value, unit: '个' },
              { label: '测试库', value: data.testLibraries.length, unit: '个' },
              { label: '高优先级', value: cases.value.filter((c) => c.priority === '高').length, unit: '条' },
              { label: '接口类', value: cases.value.filter((c) => c.type === '接口').length, unit: '条' },
              { label: '功能类', value: cases.value.filter((c) => c.type === '功能').length, unit: '条' },
            ],
            chart: {
              height: '250px',
              option: barOption({ items: moduleDist.value, horizontal: true, unit: ' 条' }),
            },
            desc:
              '用例是测试活动的原子单位，归属测试库并按**模块**组织。\n\n' +
              '用例类型：功能 / 接口 / 性能 / 兼容，用于区分不同的验证手段与执行成本。',
            table: { exportable: true, columns: [...caseColumns, { key: 'library', label: '测试库', width: 170 }], rows: caseRows(cases.value) },
            notes: ['用例的 `lastResult` 会随「测试计划执行」自动更新，无需手工维护。'],
          }

        case 'passRate':
        case 'report': {
          const byResult = groupCount(cases.value, 'lastResult')
          const executed = cases.value.length - (byResult['未执行'] || 0)
          return {
            title: k === 'report' ? '测试报告概览' : '用例通过率',
            subtitle: `${cases.value.length} 条用例 · 已执行 ${executed} 条`,
            metrics: [
              { label: '整体通过率', value: passRate.value, unit: '%', hint: '分母含未执行' },
              { label: '已执行通过率', value: executed ? pct(byResult['通过'] || 0, executed) : 0, unit: '%', hint: '分母仅含已执行' },
              { label: '通过', value: byResult['通过'] || 0, unit: '条' },
              { label: '失败', value: byResult['失败'] || 0, unit: '条' },
              { label: '阻塞', value: byResult['阻塞'] || 0, unit: '条' },
              { label: '未执行', value: byResult['未执行'] || 0, unit: '条' },
            ],
            series: [
              {
                name: '结果分布',
                height: '250px',
                option: donutOption({ items: resultDist.value, centerLabel: '用例' }),
              },
              {
                name: '各模块通过情况',
                height: '230px',
                option: barOption({
                  items: Object.keys(groupCount(cases.value, 'module')).map((m) => ({
                    label: m,
                    value: cases.value.filter((c) => c.module === m && c.lastResult === '通过').length,
                  })),
                  horizontal: true, unit: ' 条',
                }),
              },
            ],
            desc:
              '存在两种口径：\n\n' +
              '- **整体通过率** = 通过 ÷ 用例总数（含未执行）—— 反映测试**覆盖**进度\n' +
              '- **已执行通过率** = 通过 ÷ 已执行数 —— 反映已测部分的**质量**\n\n' +
              '汇报时建议同时给出，避免「通过率很低」被误读为质量差（可能只是还没测）。',
            table: {
              exportable: true,
              columns: caseColumns,
              rows: caseRows(cases.value),
            },
            notes: ['「阻塞」通常是环境或依赖问题导致，应在报告中单独说明原因。'],
          }
        }

        case 'pending': {
          const list = cases.value.filter((c) => c.lastResult === '未执行')
          return {
            title: '待执行用例',
            subtitle: '最近结果为空或标记为「未执行」',
            metrics: [
              { label: '待执行', value: list.length, unit: '条' },
              { label: '占比', value: pct(list.length, cases.value.length), unit: '%' },
              { label: '涉及模块', value: new Set(list.map((c) => c.module)).size, unit: '个' },
            ],
            chart: {
              height: '230px',
              option: barOption({
                items: Object.keys(groupCount(list, 'module')).map((m) => ({ label: m, value: groupCount(list, 'module')[m] })),
                horizontal: true, unit: ' 条',
              }),
            },
            desc: '待执行用例是测试覆盖的**缺口**。可将其加入测试计划，通过「执行测试计划」批量推进。',
            table: { exportable: true, columns: caseColumns, rows: caseRows(list), empty: '全部用例均已执行 🎉' },
            notes: ['未执行用例仍计入通过率分母，因此会拉低整体通过率。'],
            actions: [{ key: 'gotoPlans', label: '去测试计划', icon: 'calendar', primary: true }],
          }
        }

        case 'failed': {
          const list = cases.value.filter((c) => c.lastResult === '失败' || c.lastResult === '阻塞')
          const relatedBugs = data.workItems.filter((w) => w.type === '缺陷')
          return {
            title: '失败 / 阻塞用例',
            subtitle: '需要重点跟进的异常用例',
            metrics: [
              { label: '失败', value: countBy('失败'), unit: '条' },
              { label: '阻塞', value: countBy('阻塞'), unit: '条' },
              { label: '关联缺陷', value: relatedBugs.length, unit: '个' },
              { label: '未完成缺陷', value: relatedBugs.filter((w) => w.status !== '已完成').length, unit: '个' },
            ],
            chart: {
              height: '250px',
              option: barOption({
                items: list.map((c) => ({ label: c.code.replace(/^[A-Z]+-TC-/, 'TC-'), value: c.priority === '高' ? 3 : c.priority === '中' ? 2 : 1 })),
                unit: ' 级',
              }),
            },
            desc:
              '用例执行结果为「失败」时，若自动化规则 **a3（测试失败自动创建缺陷）** 处于启用状态，' +
              '系统会自动创建缺陷工作项并指派给用例维护人。\n\n' +
              '因此「关联缺陷」数可能与失败用例数不一致 —— 规则关闭或重复失败不会重复建单。',
            table: {
              exportable: true,
              columns: [...caseColumns, { key: 'maintainer', label: '维护人', width: 100 }],
              rows: caseRows(list),
              empty: '没有失败或阻塞的用例 👍',
            },
            notes: ['「阻塞」建议在报告中标注原因（环境未就绪 / 依赖未交付），避免被统计为质量缺陷。'],
            actions: [{ key: 'gotoItems', label: '查看缺陷工作项', icon: 'bug' }],
          }
        }

        case 'resultDist': {
          return {
            title: arg ? `执行结果分布 · ${arg}` : '执行结果分布',
            subtitle: `${cases.value.length} 条用例`,
            chart: { height: '300px', option: donutOption({ items: resultDist.value, centerLabel: '用例' }) },
            desc: '点击扇区可下钻到对应结果的用例明细。',
            table: {
              columns: [
                { key: 'result', label: '结果', width: 110 },
                { key: 'count', label: '数量', width: 90, align: 'right' },
                { key: 'ratio', label: '占比', minWidth: 100, align: 'right', type: 'pct' },
              ],
              rows: resultDist.value.map((r) => ({
                result: r.label, count: r.value, ratio: pct(r.value, cases.value.length),
              })),
            },
            notes: [],
          }
        }

        case 'moduleDist': {
          const by = groupCount(cases.value, 'module')
          return {
            title: '各模块用例数量',
            subtitle: '按模块统计用例分布',
            chart: { height: '300px', option: barOption({ items: moduleDist.value, horizontal: true, unit: ' 条' }) },
            desc: '用于识别测试覆盖是否均衡：某模块用例数显著偏少，可能意味着覆盖不足。',
            table: {
              columns: [
                { key: 'module', label: '模块', width: 120 },
                { key: 'count', label: '用例数', width: 90, align: 'right' },
                { key: 'pass', label: '通过', width: 80, align: 'right' },
                { key: 'fail', label: '失败', minWidth: 80, align: 'right' },
                { key: 'rate', label: '通过率', width: 90, align: 'right', type: 'pct' },
              ],
              rows: Object.keys(by).map((m) => {
                const list = cases.value.filter((c) => c.module === m)
                const pass = list.filter((c) => c.lastResult === '通过').length
                return {
                  module: m, count: list.length, pass,
                  fail: list.filter((c) => c.lastResult === '失败').length,
                  rate: pct(pass, list.length),
                }
              }),
            },
            notes: [],
          }
        }

        case 'plan': {
          const p = data.testPlans.find((x) => x.id === arg)
          if (!p) return null
          const list = planCases(p)
          const byPlanResult = { 通过: 0, 失败: 0, 阻塞: 0, 未执行: 0 }
          list.forEach((c) => { byPlanResult[planResult(p, c)] = (byPlanResult[planResult(p, c)] || 0) + 1 })
          return {
            title: `${p.name} · 执行详情`,
            subtitle: `${data.projectById(p.projectId)?.name || '—'} · ${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}`,
            metrics: [
              { label: '用例数', value: list.length, unit: '条' },
              { label: '已执行', value: planExecuted(p), unit: '条' },
              { label: '进度', value: planProgress(p), unit: '%' },
              { label: '通过', value: byPlanResult['通过'], unit: '条' },
              { label: '失败', value: byPlanResult['失败'], unit: '条' },
              { label: '通过率', value: planPassRate(p), unit: '%' },
            ],
            series: [
              {
                name: '执行结果',
                height: '250px',
                option: donutOption({
                  items: RESULTS.map(([label, color]) => ({ label, value: byPlanResult[label] || 0, color })),
                  centerLabel: '用例',
                }),
              },
              {
                name: '用例执行进度',
                height: '200px',
                option: gaugeOption({ value: planProgress(p), name: '执行进度', size: 220 }),
              },
            ],
            desc:
              '计划内**所有用例均已给出结果**时，计划状态自动置为「已完成」。\n\n' +
              '执行结果为「失败」会按自动化规则自动创建缺陷。',
            table: {
              columns: [
                ...caseColumns.slice(0, 4),
                { key: 'planResult', label: '计划内结果', width: 110 },
              ],
              rows: list.map((c) => ({
                code: c.code, title: c.title, module: c.module, priority: c.priority,
                planResult: planResult(p, c),
              })),
            },
            notes: ['计划至少需要保留一条用例，移除最后一条会被拒绝。'],
            actions: [{ key: 'execPlan', label: '打开执行面板', icon: 'play', primary: true }],
          }
        }

        default:
          return null
      }
    }

    function onDetailAction(key) {
      if (key === 'export') {
        const a = document.createElement('a')
        a.href = exportUrl('test-cases', { pageSize: 500 })
        a.download = '测试用例清单.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else if (key === 'gotoPlans') {
        tab.value = 'plans'
        detailVisible.value = false
      } else if (key === 'gotoItems') {
        window.location.hash = '#/project'
      } else if (key === 'execPlan') {
        const p = data.testPlans.find((x) => x.id === detailKey.value.split(':')[1])
        detailVisible.value = false
        if (p) openExec(p)
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    /* ---------------- 数据加载与操作 ---------------- */
    async function fetchCases() {
      loading.value = true
      try {
        const params = { pageSize: 200, sort: 'code', order: 'asc' }
        if (keyword.value) params.keyword = keyword.value
        if (libraryId.value) params.libraryId = libraryId.value
        const res = await data.query('test-cases', params)
        caseList.value = res.list
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载用例失败'))
        caseList.value = []
      } finally {
        loading.value = false
      }
    }

    function openCaseDrawer(row) {
      currentCase.value = row
      caseDrawer.value = true
    }

    async function markResult(result) {
      submitting.value = true
      try {
        const updated = await data.recordCaseResult(currentCase.value.id, result)
        currentCase.value = updated
        const idx = caseList.value.findIndex((c) => c.id === updated.id)
        if (idx >= 0) caseList.value.splice(idx, 1, updated)
        ElMessage.success(`已标记为「${result}」`)
      } catch (e) {
        ElMessage.error(errorMessage(e, '提交失败'))
      } finally {
        submitting.value = false
      }
    }

    function openExec(p) {
      currentPlan.value = data.testPlans.find((x) => x.id === p.id) || p
      casesToAdd.value = []
      execDrawer.value = true
    }

    async function execCase(c, result) {
      submitting.value = true
      try {
        const res = await data.executeTestPlan(currentPlan.value.id, c.id, result)
        currentPlan.value = res.plan
        if (caseList.value.length) fetchCases()
        if (res.autoCreatedDefect) {
          ElMessage.warning(`已按自动化规则自动创建缺陷：${res.autoCreatedDefect.code}`)
        } else {
          ElMessage.success(`「${c.title}」→ ${result}`)
        }
      } catch (e) {
        ElMessage.error(errorMessage(e, '执行失败'))
      } finally {
        submitting.value = false
      }
    }

    async function doAddCases() {
      if (!casesToAdd.value.length) return
      saving.value = true
      try {
        currentPlan.value = await data.planAddCases(currentPlan.value.id, casesToAdd.value)
        casesToAdd.value = []
        ElMessage.success('用例已加入计划')
      } catch (e) {
        ElMessage.error(errorMessage(e, '加入失败'))
      } finally {
        saving.value = false
      }
    }

    async function doRemoveCase(c) {
      saving.value = true
      try {
        currentPlan.value = await data.planRemoveCase(currentPlan.value.id, c.id)
        ElMessage.success('用例已移出计划')
      } catch (e) {
        ElMessage.error(errorMessage(e, '移除失败'))
      } finally {
        saving.value = false
      }
    }

    function openCaseDialog() {
      formErrors.value = {}
      caseForm.value = {
        title: '', libraryId: data.testLibraries[0]?.id || '', module: '通用',
        type: '功能', priority: '中', precondition: '用户已登录且拥有对应权限',
        stepsText: '进入目标页面\n执行操作\n观察结果',
        expected: '系统按预期返回结果，数据一致且无异常。',
        maintainer: data.users[3]?.id || data.users[0]?.id,
      }
      caseDialog.value = true
    }

    async function saveCase() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = caseForm.value
        await data.save('test-cases', {
          title: f.title, libraryId: f.libraryId, module: f.module, type: f.type,
          priority: f.priority, precondition: f.precondition,
          steps: f.stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
          expected: f.expected, maintainer: f.maintainer,
        })
        ElMessage.success('用例已创建')
        caseDialog.value = false
        fetchCases()
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '创建失败'))
      } finally {
        saving.value = false
      }
    }

    async function openPlanDialog() {
      formErrors.value = {}
      planForm.value = {
        name: '', projectId: data.projects[0]?.id || '',
        owner: data.users[3]?.id || data.users[0]?.id, caseIds: [],
      }
      planDialog.value = true
    }

    async function savePlan() {
      formErrors.value = {}
      if (!planForm.value.caseIds.length) {
        ElMessage.warning('请至少选择一条用例')
        return
      }
      saving.value = true
      try {
        await data.save('test-plans', {
          name: planForm.value.name, projectId: planForm.value.projectId || null,
          owner: planForm.value.owner, status: '进行中', caseIds: planForm.value.caseIds,
        })
        ElMessage.success(`测试计划已创建（含 ${planForm.value.caseIds.length} 条用例）`)
        planDialog.value = false
        tab.value = 'plans'
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '创建失败'))
      } finally {
        saving.value = false
      }
    }

    function exportCases() {
      const params = { pageSize: 500 }
      if (libraryId.value) params.libraryId = libraryId.value
      if (keyword.value) params.keyword = keyword.value
      const a = document.createElement('a')
      a.href = exportUrl('test-cases', params)
      a.download = '测试用例清单.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('已开始下载')
    }

    onMounted(fetchCases)

    return {
      data, auth, canWrite, tab, keyword, libraryId, caseList, loading, submitting, saving,
      caseDrawer, execDrawer, caseDialog, planDialog, formErrors,
      currentCase, currentPlan, caseForm, planForm, casesToAdd, addableCases, RESULTS,
      cases, countBy, passRate, moduleCount, resultDist, moduleDist, libraryName,
      fetchCases, openCaseDrawer, markResult,
      planCases, planResult, planExecuted, planPassed, planProgress, planPassRate,
      openExec, execCase, doAddCases, doRemoveCase, exportCases,
      openCaseDialog, saveCase, openPlanDialog, savePlan,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction,
      fmtDate, statusKind, priorityColor,
    }
  },
}
