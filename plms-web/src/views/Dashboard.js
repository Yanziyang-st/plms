import { ref, computed, onMounted } from 'vue'

import AppIcon from '../components/AppIcon.js'
import { StatCard, PageHeader, Avatar, StatusBadge, EmptyState, AvatarStack } from '../components/ui.js'
import { BarChart, Donut } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { exportUrl } from '../api/index.js'
import { fmtDate, fromNow, statusKind, priorityColor } from '../utils/format.js'
import { barOption, donutOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

export default {
  name: 'DashboardView',
  components: {
    AppIcon, StatCard, PageHeader, Avatar, StatusBadge, EmptyState, AvatarStack, AvatarStack,
    BarChart, Donut, PanelCard, DetailDrawer,
  },
  template: `
    <div>
      <PageHeader :title="'你好，' + (auth.user?.name || '') + ' 👋'" :description="subtitle">
        <template #actions>
          <button class="btn" @click="$router.push('/metrics')">
            <AppIcon name="metrics" :size="16" /> 效能度量
          </button>
          <button class="btn btn-primary" @click="$router.push('/project')">
            <AppIcon name="project" :size="16" /> 进入项目
          </button>
        </template>
      </PageHeader>

      <!-- 统计卡（全部可点击进入详情） -->
      <div class="grid g-4 mb-4">
        <StatCard label="待我处理" :value="mine.length" icon="inbox" clickable
                  :foot="'其中高优先级 ' + highPriority + ' 项'"
                  bg="var(--mint-50)" color="var(--mint-700)" @detail="openDetail('todos')" />
        <StatCard label="进行中项目" :value="activeProjects.length" icon="project" clickable
                  :foot="'共 ' + data.projects.length + ' 个项目'"
                  bg="#e8f7fe" color="#0284c7" @detail="openDetail('projects')" />
        <StatCard label="需求总数" :value="data.requirements.length" icon="product" clickable
                  :foot="'覆盖 ' + data.projects.length + ' 个项目'"
                  bg="#f1eefe" color="#6d5dd3" @detail="openDetail('requirements')" />
        <StatCard label="我已完成" :value="myDone" icon="checkCircle" clickable
                  :foot="'团队已完成 ' + doneItems + ' 项'"
                  bg="#fff6e5" color="#c2820f" @detail="openDetail('done')" />
      </div>

      <!-- 图表 -->
      <div class="grid g-2-1 mb-4">
        <PanelCard title="迭代交付速率" subtitle="各迭代完成的故事点（仅顶层工作项）" clickable footer-hint
                   @detail="openDetail('velocity')">
          <template #right>
            <span class="badge green"><AppIcon name="layers" :size="12" /> 共 {{ velocity.length }} 个迭代</span>
          </template>
          <BarChart :items="velocity" :height="200" unit=" 点" interactive @chart-click="onVelocityClick" />
        </PanelCard>

        <PanelCard title="需求状态分布" :subtitle="'按需求当前状态统计 · 共 ' + data.requirements.length + ' 条'"
                   clickable footer-hint @detail="openDetail('reqStatus')">
          <Donut :items="reqStatus" center-label="需求" :size="215" interactive @chart-click="onReqStatusClick" />
        </PanelCard>
      </div>

      <!-- 待办 + 动态 -->
      <div class="grid g-2-1 mb-4">
        <PanelCard title="我的待办" :subtitle="mine.length + ' 项待处理' + (subtaskTodoCount ? '（含 ' + subtaskTodoCount + ' 个子任务）' : '')"
                   clickable @detail="openDetail('todoList')">
          <template #right>
            <span class="detail-hint"><AppIcon name="eye" :size="13" /> 详情</span>
          </template>
          <div v-for="t in mine.slice(0, 6)" :key="t.id" class="list-row"
               @click.stop="$router.push('/project/' + t.projectId)">
            <span class="prio"><span class="pbar" :style="{ background: priorityColor(t.priority) }"></span></span>
            <div class="grow">
              <b>
                <span v-if="t.parentId" class="sub-mark" :title="'子任务 · 父项 ' + parentCodeOf(t)">↳</span>{{ t.title }}
              </b>
              <small>
                {{ t.code }} · 截止 {{ fmtDate(t.endDate) }}
                <template v-if="t.parentId"> · 子任务（父项 {{ parentCodeOf(t) }}）</template>
              </small>
            </div>
            <StatusBadge :text="t.status" :kind="statusKind(t.status)" />
          </div>
          <EmptyState v-if="!mine.length" title="太棒了，暂无待办" description="所有工作项都已完成" icon="checkCircle" />
        </PanelCard>

        <PanelCard title="团队动态" :subtitle="data.activities.length + ' 条记录'" clickable @detail="openDetail('activity')">
          <template #right>
            <span class="detail-hint"><AppIcon name="eye" :size="13" /> 详情</span>
          </template>
          <div class="feed">
            <div v-for="a in data.activities.slice(0, 7)" :key="a.id" class="feed-item">
              <Avatar :user="data.userById(a.userId)" size="sm" />
              <div>
                <div class="txt">
                  <b>{{ data.userById(a.userId).name }}</b> {{ a.action }}
                  <span class="text-2">{{ a.target }}</span>
                </div>
                <div class="time">{{ fromNow(a.occurredAt || a.createdAt) }}</div>
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      <!-- 项目进度 -->
      <PanelCard title="项目进度" :subtitle="'共 ' + data.projects.length + ' 个项目 · 进度 = 已完成工作项 / 工作项总数'"
                 clickable @detail="openDetail('projectProgress')">
        <template #right>
          <span class="detail-hint"><AppIcon name="eye" :size="13" /> 详情</span>
        </template>
        <div class="grid g-3">
          <div v-for="p in data.projects" :key="p.id" class="list-row"
               style="align-items:flex-start;flex-direction:column;gap:12px;background:rgba(255,255,255,.4);border:1px solid var(--glass-border)"
               @click.stop="$router.push('/project/' + p.id)">
            <div class="flex items-center gap-2" style="width:100%">
              <span :style="{ width:'10px', height:'10px', borderRadius:'3px', background:p.color }"></span>
              <b style="font-size:14px">{{ p.name }}</b>
              <StatusBadge style="margin-left:auto" :text="p.status" :kind="statusKind(p.status)" />
            </div>
            <div class="fs-12 text-3">{{ p.identifier }} · {{ p.type }} · {{ data.userById(p.owner).name }}</div>
            <div style="width:100%">
              <div class="progress"><i :style="{ width: p.progress + '%' }"></i></div>
              <div class="flex items-center" style="justify-content:space-between;margin-top:8px">
                <span class="hint">进度 {{ p.progress }}%</span>
                <span class="hint">{{ fmtDate(p.startDate) }} ~ {{ fmtDate(p.endDate) }}</span>
              </div>
            </div>
          </div>
        </div>
      </PanelCard>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const auth = useAuthStore()
    const data = useDataStore()

    const loading = ref(false)

    /* ---------------- 派生数据 ---------------- */
    const mine = computed(() =>
      data.workItems.filter((w) => w.assignee === auth.userId && w.status !== '已完成'),
    )
    const highPriority = computed(() => mine.value.filter((t) => ['高', '紧急'].includes(t.priority)).length)
    const activeProjects = computed(() => data.projects.filter((p) => p.status === '进行中'))
    const doneItems = computed(() => data.workItems.filter((w) => w.status === '已完成').length)
    const myDone = computed(() =>
      data.workItems.filter((w) => w.assignee === auth.userId && w.status === '已完成').length,
    )

    const velocityItems = computed(() => {
      // 直接用「迭代 + 顶层已完成工作项」在本地聚合，避免依赖 /api/metrics
      // （度量模块有独立读权限，开发/测试等角色无权访问，跨模块调用会 403）
      const sprints = [...data.sprints].sort((a, b) =>
        String(a.endDate || '').localeCompare(String(b.endDate || '')),
      )
      const recent = sprints.slice(-6)
      const label = (s) => {
        const m = String(s.name || '').match(/Sprint\s*\d+|迭代\s*\d+/i)
        return m ? m[0].replace(/\s+/g, '') : String(s.name || '').slice(0, 6)
      }
      const rows = recent.map((s) => ({
        label: label(s),
        value: data.workItems
          .filter((w) => w.sprintId === s.id && !w.parentId && w.status === '已完成')
          .reduce((a, w) => a + (w.points || 0), 0),
      }))
      // 没有迭代数据时，退化为按项目聚合已完成故事点
      if (!rows.length) {
        return data.projects.map((p) => ({
          label: p.identifier,
          value: data.workItems
            .filter((w) => w.projectId === p.id && !w.parentId && w.status === '已完成')
            .reduce((a, w) => a + (w.points || 0), 0),
        }))
      }
      return rows
    })

    const REQ_COLORS = { 已完成: '#23d3a9', 开发中: '#38bdf8', 已排期: '#8b7cf6', 待评审: '#ffb020' }
    const reqStatusItems = computed(() => {
      const by = groupCount(data.requirements, 'status')
      return Object.keys(by).map((k) => ({ label: k, value: by[k], color: REQ_COLORS[k] }))
    })

    const subtitle = computed(() => {
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return `${auth.user?.dept || ''} · ${auth.user?.role || ''}　今天是 ${today}，你有 ${mine.value.length} 项待办需要处理。`
    })

    /** 子任务显示所属父项编号 */
    const parentCodeOf = (w) => {
      if (!w || !w.parentId) return ''
      const p = data.workItems.find((x) => x.id === w.parentId)
      return p ? p.code : ''
    }
    const subtaskTodoCount = computed(() => mine.value.filter((t) => !!t.parentId).length)

    /* ---------------- 图表点击下钻 ---------------- */
    function onVelocityClick(params) {
      openDetail('velocity')
      void params
    }
    function onReqStatusClick(params) {
      openDetail(params && params.name ? `reqStatus:${params.name}` : 'reqStatus')
    }

    /* ---------------- 详情构造 ---------------- */
    function buildDetail(key) {
      const k = key.startsWith('reqStatus:') ? 'reqStatus' : key
      const focus = key.startsWith('reqStatus:') ? key.split(':')[1] : null

      switch (k) {
        /* --- 待我处理 --- */
        case 'todos': {
          const list = mine.value
          return {
            title: '待我处理',
            subtitle: `${auth.user?.name} 名下未完成的工作项`,
            metrics: [
              { label: '待处理总数', value: list.length, unit: '项' },
              { label: '高优先级', value: highPriority.value, unit: '项', hint: '高 / 紧急' },
              { label: '涉及项目', value: new Set(list.map((t) => t.projectId)).size, unit: '个' },
            ],
            chart: {
              height: '260px',
              option: donutOption({
                items: ['待处理', '进行中', '待测试'].map((s, i) => ({
                  label: s,
                  value: list.filter((t) => t.status === s).length,
                  color: ['#a3bdb7', '#38bdf8', '#8b7cf6'][i],
                })),
                centerLabel: '待办',
              }),
            },
            desc:
              '统计**当前登录人名下所有未完成工作项**，包含「待处理 / 进行中 / 待测试」三种状态。\n\n' +
              '排序规则：按截止日期升序，逾期项优先展示。点击明细行可跳转到对应项目看板。',
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 110, type: 'mono' },
                { key: 'title', label: '标题', minWidth: 200 },
                { key: 'priority', label: '优先级', width: 90 },
                { key: 'status', label: '状态', width: 100 },
                { key: 'project', label: '所属项目', width: 160 },
                { key: 'endDate', label: '截止日期', width: 110 },
              ],
              rows: list.map((t) => ({
                code: t.code,
                title: t.title,
                priority: t.priority,
                status: t.status,
                project: data.projectById(t.projectId)?.name || '—',
                endDate: fmtDate(t.endDate),
              })),
              empty: '当前没有待处理的工作项',
            },
            notes: [
              '只统计「指派给我」的工作项，未指派或指派给他人的不计入。',
              '已完成的工作项不计入待办，可在「我已完成」中查看。',
            ],
          }
        }

        /* --- 进行中项目 --- */
        case 'projects': {
          const list = activeProjects.value
          return {
            title: '进行中项目',
            subtitle: '状态为「进行中」的项目',
            metrics: [
              { label: '进行中', value: list.length, unit: '个' },
              { label: '项目总数', value: data.projects.length, unit: '个' },
              { label: '平均进度', value: data.projects.length ? Math.round(data.projects.reduce((a, p) => a + (p.progress || 0), 0) / data.projects.length) : 0, unit: '%' },
            ],
            chart: {
              height: '240px',
              option: barOption({ items: list.map((p) => ({ label: p.identifier, value: p.progress || 0 })), unit: '%' }),
            },
            desc:
              '项目进度 = **该项目已完成工作项数 ÷ 工作项总数 × 100%**，由「工作项状态流转」自动触发重算，无需手工维护。\n\n' +
              '当项目下没有工作项时，进度记为 0。',
            table: {
              columns: [
                { key: 'identifier', label: '标识', width: 90, type: 'mono' },
                { key: 'name', label: '项目名称', minWidth: 180 },
                { key: 'type', label: '模型', width: 90 },
                { key: 'owner', label: '负责人', width: 100 },
                { key: 'progress', label: '进度', width: 80, align: 'right', type: 'pct' },
                { key: 'range', label: '周期', width: 190 },
              ],
              rows: list.map((p) => ({
                identifier: p.identifier,
                name: p.name,
                type: p.type,
                owner: data.userById(p.owner).name,
                progress: p.progress || 0,
                range: `${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}`,
              })),
            },
            notes: ['进度为派生字段，修改工作项状态后自动更新，不要手工推算。'],
          }
        }

        /* --- 需求总数 --- */
        case 'requirements': {
          const byStatus = groupCount(data.requirements, 'status')
          const byType = groupCount(data.requirements, 'type')
          return {
            title: '需求总数',
            subtitle: '全部产品的需求与工单',
            metrics: [
              { label: '需求/工单', value: data.requirements.length, unit: '条' },
              { label: '已完成', value: byStatus['已完成'] || 0, unit: '条' },
              { label: '完成率', value: pct(byStatus['已完成'] || 0, data.requirements.length), unit: '%' },
              { label: '故事点合计', value: data.requirements.reduce((a, r) => a + (r.points || 0), 0), unit: '点' },
              { label: '待评审', value: byStatus['待评审'] || 0, unit: '条' },
              { label: '开发中', value: byStatus['开发中'] || 0, unit: '条' },
            ],
            chart: {
              height: '260px',
              option: barOption({
                items: Object.keys(byType).map((k) => ({ label: k, value: byType[k] })),
                unit: ' 条',
              }),
            },
            desc:
              '需求与工单共用同一张表，通过 `type` 字段区分（`需求` / `工单`）。\n\n' +
              '**状态流转**：待评审 → 已排期 → 开发中 → 已完成。',
            table: {
              columns: [
                { key: 'code', label: '编号', width: 130, type: 'mono' },
                { key: 'title', label: '标题', minWidth: 200 },
                { key: 'type', label: '类型', width: 80 },
                { key: 'priority', label: '优先级', width: 85 },
                { key: 'status', label: '状态', width: 95 },
                { key: 'points', label: '点数', width: 70, align: 'right' },
              ],
              rows: data.requirements.map((r) => ({
                code: r.code, title: r.title, type: r.type,
                priority: r.priority, status: r.status, points: r.points,
              })),
            },
            notes: ['需求来源（客户反馈 / 产品规划 / 内部需求 / 数据分析）用于分析需求质量。'],
          }
        }

        /* --- 我已完成 --- */
        case 'done': {
          const list = data.workItems.filter((w) => w.assignee === auth.userId && w.status === '已完成')
          const points = list.reduce((a, w) => a + (w.points || 0), 0)
          return {
            title: '我已完成',
            subtitle: '指派给我且状态为「已完成」的工作项',
            metrics: [
              { label: '完成项数', value: list.length, unit: '项' },
              { label: '完成故事点', value: points, unit: '点' },
              { label: '团队完成', value: doneItems.value, unit: '项' },
              { label: '占比', value: pct(list.length, doneItems.value), unit: '%', hint: '占团队完成量' },
            ],
            chart: {
              height: '240px',
              option: barOption({
                items: [
                  { label: '我已完成', value: list.length },
                  { label: '进行中', value: data.workItems.filter((w) => w.assignee === auth.userId && w.status === '进行中').length },
                  { label: '待处理', value: data.workItems.filter((w) => w.assignee === auth.userId && w.status === '待处理').length },
                  { label: '待测试', value: data.workItems.filter((w) => w.assignee === auth.userId && w.status === '待测试').length },
                ],
                unit: ' 项',
              }),
            },
            desc: '用于个人产出回顾：完成项数与故事点均计入「效能度量 → 成员效能报表」。',
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 110, type: 'mono' },
                { key: 'title', label: '标题', minWidth: 200 },
                { key: 'type', label: '类型', width: 80 },
                { key: 'points', label: '点数', width: 70, align: 'right' },
                { key: 'project', label: '所属项目', width: 160 },
              ],
              rows: list.map((w) => ({
                code: w.code, title: w.title, type: w.type, points: w.points,
                project: data.projectById(w.projectId)?.name || '—',
              })),
            },
            notes: ['「已完成」是工作项状态机的终态，如需重新打开，可从看板拖回「进行中」。'],
          }
        }

        /* --- 迭代交付趋势 --- */
        case 'velocity': {
          const items = velocityItems.value
          const vals = items.map((i) => i.value)
          const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
          const last = vals[vals.length - 1] || 0
          const prev = vals[vals.length - 2] || 0
          return {
            title: '迭代交付速率',
            subtitle: '各迭代完成的故事点总量',
            metrics: [
              { label: '最新迭代', value: last, unit: '点' },
              { label: '平均速率', value: avg, unit: '点' },
              { label: '环比', value: prev ? (last - prev > 0 ? '+' : '') + pct(last - prev, prev) : '—', unit: prev ? '%' : '' },
              { label: '峰值', value: vals.length ? Math.max(...vals) : 0, unit: '点' },
            ],
            chart: {
              height: '300px',
              option: barOption({ items, unit: ' 点' }),
            },
            desc:
              '**交付速率（Velocity）** 指团队在每个迭代中实际完成的故事点总量，是敏捷估算与承诺能力的核心指标。\n\n' +
              '**统计口径**：\n' +
              '- 只统计**顶层工作项**（子任务不单独计分，避免与父项重复）\n' +
              '- 只统计状态为「已完成」的工作项\n' +
              '- 数据直接来自你可见的工作项与迭代，按迭代结束时间排序',
            table: {
              columns: [
                { key: 'label', label: '迭代', width: 120 },
                { key: 'value', label: '完成故事点', width: 130, align: 'right' },
                { key: 'diff', label: '环比变化', width: 120, align: 'right' },
                { key: 'trend', label: '趋势', minWidth: 100 },
              ],
              rows: items.map((it, i) => ({
                label: it.label,
                value: it.value,
                diff: i === 0 ? '—' : (it.value - items[i - 1].value >= 0 ? '+' : '') + (it.value - items[i - 1].value),
                trend: i === 0 ? '—' : it.value > items[i - 1].value ? '上升' : it.value < items[i - 1].value ? '下降' : '持平',
              })),
              empty: '暂无迭代数据',
            },
            notes: [
              '迭代数少于 6 个时按实际数量展示，不会用样本数据补齐。',
              '工作台不依赖度量模块接口，因此无「度量」权限的角色同样可以看到本图。',
            ],
          }
        }

        /* --- 需求状态分布 --- */
        case 'reqStatus': {
          const by = groupCount(data.requirements, 'status')
          const rows = Object.keys(by).map((k) => ({
            status: k,
            count: by[k],
            ratio: pct(by[k], data.requirements.length),
            color: REQ_COLORS[k] || '#a3bdb7',
          }))
          return {
            title: focus ? `需求状态分布 · ${focus}` : '需求状态分布',
            subtitle: focus ? `筛选状态：${focus}` : `按状态统计 · 共 ${data.requirements.length} 条`,
            chart: {
              height: '300px',
              option: donutOption({
                items: rows.map((r) => ({ label: r.status, value: r.count, color: r.color })),
                centerLabel: '需求',
              }),
            },
            desc:
              '反映需求在流水线各阶段的堆积情况：\n\n' +
              '- **待评审** 堆积过多 → 需求评审节奏跟不上录入速度\n' +
              '- **开发中** 长期高位 → 在制品（WIP）过高，切换成本上升\n' +
              '- **已完成** 占比高 → 交付顺畅',
            table: {
              columns: [
                { key: 'status', label: '状态', width: 120 },
                { key: 'count', label: '数量', width: 90, align: 'right' },
                { key: 'ratio', label: '占比', minWidth: 100, align: 'right', type: 'pct' },
              ],
              rows: focus ? rows.filter((r) => r.status === focus) : rows,
            },
            notes: ['点击环形图的扇区可直接查看该状态的需求明细。'],
          }
        }

        /* --- 我的待办面板 --- */
        case 'todoList': {
          const list = mine.value
          const overdue = list.filter((t) => t.endDate && new Date(t.endDate) < new Date())
          return {
            title: '我的待办 · 明细',
            subtitle: '按截止日期排序',
            metrics: [
              { label: '待办总数', value: list.length, unit: '项' },
              { label: '已逾期', value: overdue.length, unit: '项', hint: '截止日期早于今天' },
              { label: '跨项目', value: new Set(list.map((t) => t.projectId)).size, unit: '个' },
            ],
            chart: {
              height: '240px',
              option: barOption({
                items: ['紧急', '高', '中', '低'].map((p) => ({
                  label: p, value: list.filter((t) => t.priority === p).length,
                })),
                unit: ' 项',
              }),
            },
            desc: '按优先级分布查看待办的紧急程度构成，便于决定处理顺序。',
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 110, type: 'mono' },
                { key: 'title', label: '标题', minWidth: 190 },
                { key: 'priority', label: '优先级', width: 85 },
                { key: 'status', label: '状态', width: 95 },
                { key: 'endDate', label: '截止', width: 110 },
                { key: 'overdue', label: '是否逾期', width: 100 },
              ],
              rows: list.map((t) => ({
                code: t.code, title: t.title, priority: t.priority, status: t.status,
                endDate: fmtDate(t.endDate),
                overdue: t.endDate && new Date(t.endDate) < new Date() ? '是' : '否',
              })),
              empty: '暂无待办',
            },
            notes: ['「立即处理」只做筛选展示，不会修改工作项数据。'],
          }
        }

        /* --- 团队动态 --- */
        case 'activity': {
          const byUser = groupCount(data.activities, 'userId')
          const byAction = groupCount(data.activities, 'action')
          return {
            title: '团队动态',
            subtitle: `最近 ${data.activities.length} 条操作记录`,
            metrics: [
              { label: '记录数', value: data.activities.length, unit: '条' },
              { label: '参与成员', value: Object.keys(byUser).length, unit: '人' },
              { label: '操作类型', value: Object.keys(byAction).length, unit: '种' },
            ],
            chart: {
              height: '260px',
              option: barOption({
                items: Object.keys(byAction)
                  .map((k) => ({ label: k, value: byAction[k] }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8),
                horizontal: true,
                unit: ' 次',
              }),
            },
            desc:
              '活动日志记录**所有写操作**（创建 / 更新 / 删除 / 状态流转 / 评论 / 关联 / 执行测试 / 自动化），' +
              '服务端在业务事务中同步落库，用于审计与协作感知。',
            table: {
              exportable: true,
              columns: [
                { key: 'user', label: '成员', width: 100 },
                { key: 'action', label: '动作', width: 150 },
                { key: 'target', label: '对象', minWidth: 220 },
                { key: 'time', label: '时间', width: 140 },
              ],
              rows: data.activities.map((a) => ({
                user: data.userById(a.userId).name,
                action: a.action,
                target: a.target,
                time: fromNow(a.occurredAt || a.createdAt),
              })),
            },
            notes: ['活动日志最多保留最近 80 条，超出后自动淘汰最旧记录。'],
          }
        }

        /* --- 项目进度面板 --- */
        case 'projectProgress': {
          const list = data.projects
          return {
            title: '项目进度 · 明细',
            subtitle: '进度 = 已完成工作项 ÷ 工作项总数',
            metrics: list.map((p) => ({
              label: p.name,
              value: p.progress || 0,
              unit: '%',
              hint: `${data.workItems.filter((w) => w.projectId === p.id && w.status === '已完成').length}/${data.workItems.filter((w) => w.projectId === p.id).length} 项`,
            })),
            chart: {
              height: '260px',
              option: barOption({ items: list.map((p) => ({ label: p.identifier, value: p.progress || 0 })), unit: '%' }),
            },
            desc:
              '进度由「工作项状态流转」自动重算：每次看板拖拽或状态变更，服务端在**同一事务内**更新项目进度。\n\n' +
              '这样可避免手工维护造成的口径不一致。',
            table: {
              exportable: true,
              columns: [
                { key: 'name', label: '项目', minWidth: 180 },
                { key: 'total', label: '工作项总数', width: 110, align: 'right' },
                { key: 'done', label: '已完成', width: 90, align: 'right' },
                { key: 'progress', label: '进度', width: 80, align: 'right', type: 'pct' },
                { key: 'status', label: '状态', width: 90 },
              ],
              rows: list.map((p) => {
                const all = data.workItems.filter((w) => w.projectId === p.id)
                return {
                  name: p.name,
                  total: all.length,
                  done: all.filter((w) => w.status === '已完成').length,
                  progress: p.progress || 0,
                  status: p.status,
                }
              }),
            },
            notes: ['若项目下工作项为 0，进度固定为 0，不会出现除零异常。'],
          }
        }

        default:
          return null
      }
    }

    /* ---------------- 详情动作 ---------------- */
    function onDetailAction(key) {
      if (key === 'export') {
        const map = {
          todos: 'work-items', done: 'work-items', todoList: 'work-items',
          activity: 'activities', projectProgress: 'projects',
        }
        const resource = map[detailKey.value]
        if (!resource) return
        const a = document.createElement('a')
        a.href = exportUrl(resource, { pageSize: 500 })
        a.download = `${resource}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    onMounted(() => {
      // 工作台全部数据来自 bootstrap 水合缓存（已按角色权限过滤），
      // 不再调用 /api/metrics，避免无度量权限的角色打开工作台即报 403。
      loading.value = false
    })

    return {
      auth, data, mine, highPriority, activeProjects, doneItems, myDone,
      velocity: velocityItems, reqStatus: reqStatusItems, subtitle, loading,
      parentCodeOf, subtaskTodoCount,
      detailVisible, detailConfig, openDetail, onDetailAction,
      onVelocityClick, onReqStatusClick,
      fmtDate, fromNow, statusKind, priorityColor,
    }
  },
}
