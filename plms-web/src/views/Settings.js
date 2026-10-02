import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, Avatar, EmptyState } from '../components/ui.js'
import { Donut, BarChart } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { errorMessage } from '../api/request.js'
import { exportUrl } from '../api/index.js'
import { fromNow } from '../utils/format.js'
import { donutOption, barOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

const ROLES = ['管理员', '项目经理', '产品经理', '开发工程师', '测试工程师', 'UI 设计师', '运维工程师']

export default {
  name: 'SettingsView',
  components: { AppIcon, PageHeader, Avatar, EmptyState, Donut, BarChart, PanelCard, DetailDrawer },
  template: `
    <div>
      <PageHeader title="后台管理" description="成员与角色权限、系统参数配置">
        <template #actions>
          <button class="btn" @click="exportMembers"><AppIcon name="download" :size="16" /> 导出成员</button>
          <button class="btn btn-primary" @click="openUserDialog()"><AppIcon name="plus" :size="16" /> 新增成员</button>
        </template>
      </PageHeader>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'members' }" @click="tab = 'members'">成员管理</button>
        <button class="tab" :class="{ active: tab === 'roles' }" @click="tab = 'roles'">角色权限</button>
        <button class="tab" :class="{ active: tab === 'config' }" @click="tab = 'config'">系统配置</button>
      </div>

      <!-- 成员 -->
      <template v-if="tab === 'members'">
        <div class="filters">
          <div class="search-input" style="width:220px">
            <AppIcon name="search" :size="16" />
            <input class="input" v-model="memberKeyword" placeholder="搜索姓名或账号" />
          </div>
          <select class="select" style="width:150px" v-model="memberRole">
            <option value="">全部角色</option>
            <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
          </select>
          <select class="select" style="width:130px" v-model="memberEnabled">
            <option value="">全部状态</option>
            <option value="1">已启用</option>
            <option value="0">已停用</option>
          </select>
          <span class="spacer"></span>
          <span class="hint">共 {{ filteredMembers.length }} 人</span>
        </div>

        <div class="card">
          <el-table :data="filteredMembers" style="width:100%">
            <el-table-column label="成员" min-width="200">
              <template #default="{ row }">
                <span class="user-cell">
                  <Avatar :user="row" />
                  <span>
                    <b>{{ row.name }}</b>
                    <div class="fs-12 text-3">@{{ row.username }}</div>
                  </span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="角色" width="150">
              <template #default="{ row }">
                <el-select :model-value="row.role" size="small" style="width:130px"
                           @change="(v) => changeRole(row, v)">
                  <el-option v-for="r in ROLES" :key="r" :label="r" :value="r" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="部门" width="120">
              <template #default="{ row }"><span class="muted">{{ row.dept }}</span></template>
            </el-table-column>
            <el-table-column label="邮箱" min-width="180">
              <template #default="{ row }"><span class="muted fs-13">{{ row.email || '—' }}</span></template>
            </el-table-column>
            <el-table-column label="参与工作项" width="110" align="right">
              <template #default="{ row }">{{ workItemCount(row.id) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <span class="badge" :class="row.enabled ? 'green' : 'gray'">{{ row.enabled ? '已启用' : '已停用' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="" width="210" align="right">
              <template #default="{ row }">
                <button class="btn btn-sm btn-ghost" @click="openUserDialog(row)"><AppIcon name="edit" :size="14" /></button>
                <button class="btn btn-sm btn-ghost" @click="resetPwd(row)" title="重置密码"><AppIcon name="lock" :size="14" /></button>
                <button class="btn btn-sm btn-ghost" @click="toggleUser(row)" :title="row.enabled ? '停用' : '启用'">
                  <AppIcon :name="row.enabled ? 'close' : 'check'" :size="14" />
                </button>
                <button class="btn btn-sm btn-ghost" @click="removeUser(row)" title="删除"><AppIcon name="trash" :size="14" /></button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>

      <!-- 角色权限（来自后端 /api/auth/permissions） -->
      <div v-else-if="tab === 'roles'" class="card">
        <div class="card-head">
          <h3>角色权限矩阵</h3><span class="sub">数据来自服务端，后端按同一份规则强制校验（403）</span>
        </div>
        <el-table :data="matrix" style="width:100%">
          <el-table-column label="角色" width="140" prop="role" />
          <el-table-column label="权限点" width="120" align="center">
            <template #default="{ row }">
              <span class="badge indigo">{{ row.permissions.length }}</span>
            </template>
          </el-table-column>
          <el-table-column v-for="m in modules" :key="m.key" :label="m.label" align="center" width="104">
            <template #default="{ row }">
              <span v-if="permOf(row, m.key) === 'write'" class="badge green">读写</span>
              <span v-else-if="permOf(row, m.key) === 'read'" class="badge blue">只读</span>
              <span v-else class="text-3">—</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="card-pad">
          <div class="readonly-tip">
            <AppIcon name="shield" :size="15" />
            权限在服务端由 <b>PermissionInterceptor</b> 强制校验：GET 需 <code>模块:read</code>，写操作需 <code>模块:write</code>，越权返回 403。前端仅做按钮显隐，不作为安全边界。
          </div>
        </div>
      </div>

      <!-- 配置 -->
      <div v-else class="grid g-2">
        <div class="card">
          <div class="card-head"><h3>外观主题</h3></div>
          <div class="card-pad">
            <div class="field mb-3">
              <label>主题色</label>
              <div class="flex gap-2 wrap">
                <span v-for="(c, i) in ['#23d3a9','#38bdf8','#8b7cf6','#ffb020','#f472b6']" :key="c"
                      :style="{ width:'38px', height:'38px', borderRadius:'12px', background:c, cursor:'pointer',
                                boxShadow:'inset 0 1px 0 rgba(255,255,255,.6)', outline: i===0 ? '2px solid #fff' : 'none', outlineOffset:'2px' }"></span>
              </div>
            </div>
            <div class="field mb-3">
              <label>界面风格</label>
              <select class="select"><option>Liquid Glass 液态玻璃（当前）</option><option>经典扁平</option></select>
            </div>
            <div class="field">
              <label>强调效果</label>
              <select class="select"><option>磨砂模糊 + 高光边缘</option><option>极简无模糊</option></select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>系统参数</h3></div>
          <div class="card-pad">
            <div class="field mb-3"><label>系统名称</label><input class="input" value="Mint PLM · 软件生命周期管理" /></div>
            <div class="field mb-3"><label>默认语言</label><select class="select"><option>简体中文</option><option>English</option></select></div>
            <div class="flex items-center mb-3" style="justify-content:space-between">
              <span class="fs-13 text-2">启用 AI 智能协同</span>
              <el-switch :model-value="true" />
            </div>
            <div class="hr"></div>
            <div class="flex items-center" style="justify-content:space-between">
              <div>
                <b class="fs-13">重置演示数据</b>
                <div class="hint">清空全部改动并恢复初始数据</div>
              </div>
              <button class="btn btn-danger btn-sm" @click="resetDemo"><AppIcon name="refresh" :size="14" /> 重置</button>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1">
          <div class="card-head">
            <h3>数据概览</h3><span class="sub">来自服务端统计 · 点击卡片查看明细</span>
          </div>
          <div class="card-pad">
            <div class="grid g-4 mb-4">
              <div v-for="s in stats" :key="s.label" class="list-row stat-mini" @click="openDetail('stat:' + s.key)">
                <div class="grow"><small>{{ s.label }}</small><b style="font-size:20px">{{ s.value }}</b></div>
                <AppIcon name="eye" :size="13" class="mini-hint" />
              </div>
            </div>

            <div class="grid g-2">
              <div class="card card-pad" style="background:rgba(255,255,255,.4);cursor:pointer"
                   @click="openDetail('dataCompose')">
                <div class="detail-sec-title">数据资产构成</div>
                <Donut :items="dataCompose" center-label="记录" :size="215" interactive
                       @chart-click="(p) => openDetail('stat:' + p.name)" />
              </div>
              <div class="card card-pad" style="background:rgba(255,255,255,.4);cursor:pointer"
                   @click="openDetail('roleDist')">
                <div class="detail-sec-title">成员角色分布</div>
                <BarChart :items="roleDist" :height="200" horizontal unit=" 人" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 成员弹窗 -->
      <el-dialog v-model="userDialog" :title="userForm.id ? '编辑成员' : '新增成员'" width="560px">
        <el-form label-position="top">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="姓名" :error="formErrors.name" required>
              <el-input v-model="userForm.name" />
            </el-form-item>
            <el-form-item label="登录账号" :error="formErrors.username" required>
              <el-input v-model="userForm.username" :disabled="!!userForm.id" placeholder="字母开头，3~30 位" />
            </el-form-item>
            <el-form-item v-if="!userForm.id" label="初始密码">
              <el-input v-model="userForm.password" placeholder="留空则使用默认 123456" />
            </el-form-item>
            <el-form-item label="角色">
              <el-select v-model="userForm.role" style="width:100%">
                <el-option v-for="r in ROLES" :key="r" :label="r" :value="r" />
              </el-select>
            </el-form-item>
            <el-form-item label="部门">
              <el-input v-model="userForm.dept" />
            </el-form-item>
            <el-form-item label="邮箱" :error="formErrors.email">
              <el-input v-model="userForm.email" placeholder="name@demo.com" />
            </el-form-item>
          </div>
          <el-form-item v-if="userForm.id" label="账号状态">
            <el-switch v-model="userForm.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="userDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveUser">{{ saving ? '保存中…' : '保存' }}</button>
        </template>
      </el-dialog>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()

    const tab = ref('members')
    const saving = ref(false)
    const memberKeyword = ref('')
    const memberRole = ref('')
    const memberEnabled = ref('')
    const userDialog = ref(false)
    const formErrors = ref({})
    const userForm = ref(blankUser())
    const matrix = ref([])
    const modules = ref([])

    function blankUser() {
      return { id: '', name: '', username: '', password: '', role: '开发工程师', dept: '研发一部', email: '', enabled: true }
    }

    const filteredMembers = computed(() =>
      data.users.filter((u) => {
        if (memberRole.value && u.role !== memberRole.value) return false
        if (memberEnabled.value === '1' && !u.enabled) return false
        if (memberEnabled.value === '0' && u.enabled) return false
        const kw = memberKeyword.value.trim().toLowerCase()
        if (kw && !(`${u.name} ${u.username}`.toLowerCase().includes(kw))) return false
        return true
      }),
    )

    const stats = computed(() => [
      { key: 'users', label: '用户', value: data.users.length },
      { key: 'products', label: '产品', value: data.products.length },
      { key: 'requirements', label: '需求', value: data.requirements.length },
      { key: 'projects', label: '项目', value: data.projects.length },
      { key: 'work-items', label: '工作项', value: data.workItems.length },
      { key: 'test-cases', label: '测试用例', value: data.testCases.length },
      { key: 'wiki-pages', label: '知识页面', value: data.wikiPages.length },
      { key: 'links', label: '实体关联', value: data.links.length },
    ])

    const dataCompose = computed(() =>
      stats.value
        .filter((s) => s.value > 0)
        .map((s, i) => ({ label: s.label, value: s.value, color: ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#ff7a6b', '#46dfd0', '#f472b6', '#a3bdb7'][i % 8] })),
    )

    const roleDist = computed(() => {
      const by = groupCount(data.users, 'role')
      return Object.keys(by)
        .map((r) => ({ label: r, value: by[r] }))
        .sort((a, b) => b.value - a.value)
    })

    /* ==================== 详情视图 ==================== */
    const STAT_DEFS = {
      users: {
        label: '用户',
        desc: '系统成员。角色决定其可见模块与可执行操作（RBAC），停用后无法登录。',
        columns: [
          { key: 'name', label: '姓名', width: 100 },
          { key: 'username', label: '账号', width: 130, type: 'mono' },
          { key: 'role', label: '角色', width: 120 },
          { key: 'dept', label: '部门', width: 120 },
          { key: 'enabled', label: '状态', width: 90 },
        ],
        rows: () => data.users.map((u) => ({
          name: u.name, username: u.username, role: u.role,
          dept: u.dept, enabled: u.enabled ? '已启用' : '已停用',
        })),
      },
      products: {
        label: '产品',
        desc: '产品的标识符用于生成需求业务编号，创建后不可修改。',
        columns: [
          { key: 'name', label: '产品名称', minWidth: 170 },
          { key: 'identifier', label: '标识符', width: 100, type: 'mono' },
          { key: 'owner', label: '负责人', width: 100 },
          { key: 'status', label: '状态', width: 100 },
          { key: 'reqs', label: '需求数', width: 90, align: 'right' },
        ],
        rows: () => data.products.map((p) => ({
          name: p.name, identifier: p.identifier,
          owner: data.userById(p.owner).name, status: p.status,
          reqs: data.requirements.filter((r) => r.productId === p.id).length,
        })),
      },
      requirements: {
        label: '需求',
        desc: '需求与工单共用同一张表，由 `type` 字段区分。',
        columns: [
          { key: 'code', label: '编号', width: 130, type: 'mono' },
          { key: 'title', label: '标题', minWidth: 190 },
          { key: 'type', label: '类型', width: 75 },
          { key: 'status', label: '状态', width: 100 },
        ],
        rows: () => data.requirements.map((r) => ({
          code: r.code, title: r.title, type: r.type, status: r.status,
        })),
      },
      projects: {
        label: '项目',
        desc: '项目进度由工作项状态自动重算，无需手工维护。',
        columns: [
          { key: 'name', label: '项目', minWidth: 180 },
          { key: 'identifier', label: '标识', width: 100, type: 'mono' },
          { key: 'type', label: '模型', width: 90 },
          { key: 'progress', label: '进度', width: 85, align: 'right', type: 'pct' },
        ],
        rows: () => data.projects.map((p) => ({
          name: p.name, identifier: p.identifier, type: p.type, progress: p.progress || 0,
        })),
      },
      'work-items': {
        label: '工作项',
        desc: '工作项受状态机约束，流转成功会同步重算项目进度。',
        columns: [
          { key: 'code', label: '编号', width: 110, type: 'mono' },
          { key: 'title', label: '标题', minWidth: 190 },
          { key: 'type', label: '类型', width: 80 },
          { key: 'status', label: '状态', width: 100 },
          { key: 'assignee', label: '负责人', width: 100 },
        ],
        rows: () => data.workItems.map((w) => ({
          code: w.code, title: w.title, type: w.type, status: w.status,
          assignee: data.userById(w.assignee).name,
        })),
      },
      'test-cases': {
        label: '测试用例',
        desc: '用例结果由测试计划执行自动更新。',
        columns: [
          { key: 'code', label: '编号', width: 125, type: 'mono' },
          { key: 'title', label: '用例', minWidth: 190 },
          { key: 'module', label: '模块', width: 100 },
          { key: 'result', label: '最近结果', width: 100 },
        ],
        rows: () => data.testCases.map((c) => ({
          code: c.code, title: c.title, module: c.module, result: c.lastResult,
        })),
      },
      'wiki-pages': {
        label: '知识页面',
        desc: '知识页面支持父子层级，删除父页面需先清空子页面。',
        columns: [
          { key: 'title', label: '页面', minWidth: 200 },
          { key: 'space', label: '所属空间', width: 160 },
          { key: 'author', label: '作者', width: 100 },
          { key: 'parent', label: '父页面', width: 120 },
        ],
        rows: () => data.wikiPages.map((p) => ({
          title: p.title,
          space: data.spaceById(p.spaceId)?.name || '—',
          author: data.userById(p.author).name,
          parent: data.wikiPages.find((x) => x.id === p.parentId)?.title || '—',
        })),
      },
      links: {
        label: '实体关联',
        desc: '关联关系构成需求追踪矩阵的数据基础，删除实体时会自动清理关联。',
        columns: [
          { key: 'source', label: '源对象', minWidth: 180 },
          { key: 'type', label: '关联类型', width: 110 },
          { key: 'target', label: '目标对象', minWidth: 180 },
        ],
        rows: () =>
          data.links.map((l) => {
            const src = findEntity(l.sourceType, l.sourceId)
            const tgt = findEntity(l.targetType, l.targetId)
            return {
              source: src, target: tgt,
              type: { implements: '实现', verifies: '验证', relates: '相关' }[l.linkType] || l.linkType,
            }
          }),
      },
    }

    function findEntity(type, id) {
      const map = {
        requirement: data.requirements,
        'work-item': data.workItems,
        'test-case': data.testCases,
      }
      const hit = (map[type] || []).find((x) => x.id === id)
      return hit ? `${hit.code || ''} ${hit.title || ''}`.trim() : id
    }

    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null

      if (k === 'stat') {
        // 支持按 key 或按中文标签查找
        const def = STAT_DEFS[arg] || Object.values(STAT_DEFS).find((d) => d.label === arg)
        if (!def) return null
        const rows = def.rows()
        return {
          title: `${def.label} · 数据明细`,
          subtitle: `共 ${rows.length} 条记录`,
          metrics: [{ label: '记录数', value: rows.length, unit: '条' }],
          desc: def.desc,
          table: { columns: def.columns, rows, empty: `暂无${def.label}数据` },
          notes: [],
        }
      }

      if (k === 'dataCompose') {
        const total = stats.value.reduce((a, s) => a + s.value, 0)
        return {
          title: '数据资产构成',
          subtitle: `共 ${total} 条业务记录`,
          metrics: stats.value.map((s) => ({
            label: s.label, value: s.value, unit: '',
            hint: `${pct(s.value, total)}%`,
          })),
          chart: { height: '320px', option: donutOption({ items: dataCompose.value, centerLabel: '记录' }) },
          desc: '展示当前数据库中各业务实体的记录量分布，用于快速判断数据是否完整。',
          table: {
            columns: [
              { key: 'label', label: '实体', width: 140 },
              { key: 'value', label: '记录数', width: 110, align: 'right' },
              { key: 'ratio', label: '占比', minWidth: 100, align: 'right', type: 'pct' },
            ],
            rows: stats.value.map((s) => ({ label: s.label, value: s.value, ratio: pct(s.value, total) })),
          },
          notes: ['可通过「重置演示数据」恢复初始数据量。'],
        }
      }

      if (k === 'roleDist') {
        const by = groupCount(data.users, 'role')
        return {
          title: '成员角色分布',
          subtitle: `${data.users.length} 名成员 · ${Object.keys(by).length} 种角色`,
          metrics: Object.keys(by).map((r) => ({ label: r, value: by[r], unit: '人' })),
          chart: { height: '300px', option: barOption({ items: roleDist.value, horizontal: true, unit: ' 人' }) },
          desc: '不同角色对应不同权限集，可在「角色权限」标签页查看完整矩阵。',
          table: {
            columns: [
              { key: 'role', label: '角色', width: 130 },
              { key: 'count', label: '人数', width: 90, align: 'right' },
              { key: 'permCount', label: '权限点数', width: 110, align: 'right' },
              { key: 'modules', label: '可读模块', minWidth: 200 },
            ],
            rows: Object.keys(by).map((r) => {
              const row = matrix.value.find((m) => m.role === r)
              return {
                role: r, count: by[r],
                permCount: row ? row.permissions.length : 0,
                modules: row ? (row.modules || []).join(' / ') : '—',
              }
            }),
          },
          notes: ['权限在以服务端 `PermissionService` 为唯一来源，此处展示与后端完全一致。'],
        }
      }

      return null
    }

    function onDetailAction() { /* 预留 */ }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    const workItemCount = (uid) => data.workItems.filter((w) => w.assignee === uid).length

    /** 角色在某模块上的权限等级：write / read / null */
    function permOf(row, moduleKey) {
      if (row.permissions.includes(moduleKey + ':write')) return 'write'
      if (row.permissions.includes(moduleKey + ':read')) return 'read'
      return null
    }

    async function loadPermissions() {
      await auth.loadPermissions()
      matrix.value = auth.matrix
      modules.value = auth.modules
    }

    /* ---------------- 成员管理 ---------------- */
    function openUserDialog(row) {
      formErrors.value = {}
      userForm.value = row ? { ...blankUser(), ...row, password: '' } : blankUser()
      userDialog.value = true
    }

    async function saveUser() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = userForm.value
        if (f.id) {
          await data.edit('users', f.id, {
            name: f.name, role: f.role, dept: f.dept, email: f.email, enabled: f.enabled,
          })
          ElMessage.success('成员已更新')
        } else {
          await data.createUser({
            name: f.name, username: f.username, password: f.password || undefined,
            role: f.role, dept: f.dept, email: f.email,
          })
          ElMessage.success('成员已创建' + (f.password ? '' : '（初始密码 123456）'))
        }
        userDialog.value = false
        // 角色变化可能影响矩阵展示
        if (f.id) loadPermissions()
      } catch (e) {
        const errs = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        formErrors.value = errs
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function changeRole(row, role) {
      try {
        await data.edit('users', row.id, { role })
        ElMessage.success(`${row.name} 的角色已更新为 ${role}`)
      } catch (e) {
        ElMessage.error(errorMessage(e, '更新失败'))
      }
    }

    async function toggleUser(row) {
      try {
        const u = await data.toggleUser(row.id)
        ElMessage.success(u.enabled ? `${u.name} 已启用` : `${u.name} 已停用`)
      } catch (e) {
        ElMessage.error(errorMessage(e, '操作失败'))
      }
    }

    async function resetPwd(row) {
      try {
        const { value } = await ElMessageBox.prompt(
          `为「${row.name}」设置新密码（留空则重置为默认 123456）`,
          '重置密码',
          { confirmButtonText: '确定', cancelButtonText: '取消', inputPlaceholder: '至少 6 位' },
        )
        const res = await data.resetPassword(row.id, value || '')
        ElMessage.success(`密码已重置为：${res.resetTo}`)
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') ElMessage.error(errorMessage(e, '重置失败'))
      }
    }

    async function removeUser(row) {
      try {
        await ElMessageBox.confirm(
          `确定删除成员「${row.name}」？若其名下仍有工作项或为最后一名管理员，将被拒绝。`,
          '删除确认',
          { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
        )
      } catch (e) { return }
      try {
        await data.destroy('users', row.id)
        ElMessage.success('已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    function exportMembers() {
      const a = document.createElement('a')
      a.href = exportUrl('users', { pageSize: 500 })
      a.download = '成员清单.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('已开始下载')
    }

    async function resetDemo() {
      try {
        await ElMessageBox.confirm('将清空当前所有改动并恢复初始演示数据，确定继续？', '重置演示数据', {
          type: 'warning', confirmButtonText: '确定重置', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.resetDemo()
        await loadPermissions()
        ElMessage.success('演示数据已重置')
      } catch (e) {
        ElMessage.error(errorMessage(e, '重置失败'))
      }
    }

    onMounted(loadPermissions)

    return {
      data, auth, ROLES, tab, saving, memberKeyword, memberRole, memberEnabled,
      userDialog, formErrors, userForm, matrix, modules,
      filteredMembers, stats, dataCompose, roleDist, workItemCount, permOf,
      openUserDialog, saveUser, changeRole, toggleUser, resetPwd, removeUser, exportMembers, resetDemo,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction,
      fromNow,
    }
  },
}
