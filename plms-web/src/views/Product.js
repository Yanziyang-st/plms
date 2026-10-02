import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, StatusBadge, UserChip, EmptyState, Avatar } from '../components/ui.js'
import { Donut, BarChart, Gauge } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { errorMessage } from '../api/request.js'
import { exportUrl } from '../api/index.js'
import { fmtDate, fromNow, statusKind, priorityColor } from '../utils/format.js'
import { donutOption, barOption, gaugeOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'

const STATUSES = ['待评审', '已排期', '开发中', '已完成']
const PRIORITIES = ['高', '中', '低']
const SOURCES = ['客户反馈', '产品规划', '内部需求', '数据分析']

export default {
  name: 'ProductView',
  components: { AppIcon, PageHeader, StatusBadge, UserChip, EmptyState, Avatar, Donut, BarChart, Gauge, PanelCard, DetailDrawer },
  template: `
    <div>
      <PageHeader title="产品管理" description="收集多渠道需求，评审排期并跟踪到交付与验证的完整链路">
        <template #actions>
          <button class="btn" @click="exportList"><AppIcon name="download" :size="16" /> 导出</button>
          <button v-if="canWrite" class="btn" @click="openProductDialog"><AppIcon name="plus" :size="16" /> 新建产品</button>
          <button v-if="canWrite" class="btn btn-primary" :disabled="!currentProduct" @click="openReqDialog()">
            <AppIcon name="plus" :size="16" /> 新建{{ tab === 'ticket' ? '工单' : '需求' }}
          </button>
        </template>
      </PageHeader>

      <!-- 产品切换 -->
      <div class="grid g-3 mb-4">
        <div v-for="p in data.products" :key="p.id" class="card card-pad"
             :style="{ cursor: 'pointer', boxShadow: p.id === productId ? '0 0 0 2px var(--mint), var(--shadow)' : '' }"
             @click="selectProduct(p.id)">
          <div class="flex items-center gap-2">
            <span :style="{ width:'38px', height:'38px', borderRadius:'12px', background:p.color, display:'grid', placeItems:'center', color:'#fff', fontWeight:800, boxShadow:'inset 0 1px 0 rgba(255,255,255,.5)' }">
              {{ p.identifier.slice(0, 2) }}
            </span>
            <div style="flex:1;min-width:0">
              <b style="font-size:14px">{{ p.name }}</b>
              <div class="fs-12 text-3">{{ p.identifier }} · {{ data.userById(p.owner).name }}</div>
            </div>
            <StatusBadge :text="p.status" :kind="statusKind(p.status)" />
          </div>
          <p class="fs-12 text-3 mt-3" style="line-height:1.6;min-height:34px">{{ p.description }}</p>
          <div class="progress mt-2"><i :style="{ width: coverageOf(p.id) + '%' }"></i></div>
          <div class="flex items-center gap-3 mt-2">
            <span class="chip"><AppIcon name="product" :size="13" /> {{ reqCountOf(p.id) }} 需求</span>
            <span class="chip"><AppIcon name="check" :size="13" /> 覆盖 {{ coverageOf(p.id) }}%</span>
            <span class="detail-hint" style="margin-left:auto" @click.stop="openDetail('product:' + p.id)">
              <AppIcon name="eye" :size="12" /> 详情
            </span>
          </div>
        </div>
        <EmptyState v-if="!data.products.length" title="暂无产品" description="点击右上角新建产品" icon="product" />
      </div>

      <!-- 标签页 -->
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'req' }" @click="switchTab('req')">
          需求 <span class="cnt">{{ tabCounts.req }}</span>
        </button>
        <button class="tab" :class="{ active: tab === 'ticket' }" @click="switchTab('ticket')">
          工单 <span class="cnt">{{ tabCounts.ticket }}</span>
        </button>
        <button class="tab" :class="{ active: tab === 'matrix' }" @click="switchTab('matrix')">需求跟踪矩阵</button>
      </div>

      <!-- 列表 -->
      <template v-if="tab !== 'matrix'">
        <div class="filters">
          <div class="search-input" style="width:260px">
            <AppIcon name="search" :size="16" />
            <input class="input" v-model="filters.keyword" placeholder="搜索标题或编号" @keyup.enter="reload" />
          </div>
          <select class="select" style="width:140px" v-model="filters.status" @change="reload">
            <option value="">全部状态</option>
            <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
          <select class="select" style="width:130px" v-model="filters.priority" @change="reload">
            <option value="">全部优先级</option>
            <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
          </select>
          <span class="spacer"></span>
          <span class="hint">共 {{ total }} 条</span>
          <button class="btn btn-sm" @click="reload"><AppIcon name="refresh" :size="14" /> 刷新</button>
        </div>

        <div v-if="selected.length" class="batch-bar">
          <b>已选 {{ selected.length }} 项</b>
          <button class="btn btn-sm btn-danger" :disabled="saving" @click="doBatchDelete">
            <AppIcon name="trash" :size="14" /> 批量删除
          </button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" @click="selected = []">取消选择</button>
        </div>

        <div class="card">
          <el-table :data="list" v-loading="loading" style="width:100%" @selection-change="onSelect">
            <el-table-column type="selection" width="46" />
            <el-table-column label="编号" width="130">
              <template #default="{ row }"><span class="mono fs-12 muted">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column label="标题" min-width="240">
              <template #default="{ row }">
                <span class="c-title" @click="openReqDetail(row)">{{ row.title }}</span>
                <div class="fs-12 text-3">来源：{{ row.source }}</div>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="90">
              <template #default="{ row }">
                <StatusBadge :text="row.type" :kind="row.type === '工单' ? 'orange' : 'indigo'" />
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="100">
              <template #default="{ row }">
                <span class="prio"><span class="pbar" :style="{ background: priorityColor(row.priority) }"></span>{{ row.priority }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><StatusBadge :text="row.status" :kind="statusKind(row.status)" dot /></template>
            </el-table-column>
            <el-table-column label="负责人" width="140">
              <template #default="{ row }"><UserChip :user="data.userById(row.assignee)" /></template>
            </el-table-column>
            <el-table-column label="追踪" width="90" align="center">
              <template #default="{ row }">
                <span v-if="traceMeta[row.id]" class="badge"
                      :class="traceMeta[row.id].fullyCovered ? 'green' : (traceMeta[row.id].hasWorkItem ? 'orange' : 'gray')">
                  {{ traceMeta[row.id].fullyCovered ? '已覆盖' : (traceMeta[row.id].hasWorkItem ? '部分' : '未关联') }}
                </span>
                <span v-else class="text-3">—</span>
              </template>
            </el-table-column>
            <el-table-column label="点数" width="70" align="right">
              <template #default="{ row }">{{ row.points }}</template>
            </el-table-column>
            <el-table-column label="创建时间" width="110">
              <template #default="{ row }"><span class="muted fs-12">{{ fmtDate(row.createdAt) }}</span></template>
            </el-table-column>
            <el-table-column label="" width="90" align="right">
              <template #default="{ row }">
                <button v-if="canWrite" class="btn btn-sm btn-ghost" @click.stop="openReqDialog(row)"><AppIcon name="edit" :size="14" /></button>
                <button v-if="canWrite" class="btn btn-sm btn-ghost" @click.stop="removeReq(row)"><AppIcon name="trash" :size="14" /></button>
              </template>
            </el-table-column>
            <template #empty>
              <EmptyState v-if="!loading" title="暂无匹配的需求" description="调整筛选条件或新建一条需求" icon="product" />
            </template>
          </el-table>

          <div class="card-pad" style="padding-top:0">
            <el-pagination
              background layout="total, sizes, prev, pager, next"
              :total="total" :current-page="page" :page-size="pageSize"
              :page-sizes="[10, 20, 50]"
              @current-change="(v) => { page = v; fetchList() }"
              @size-change="(v) => { pageSize = v; page = 1; fetchList() }"
            />
          </div>
        </div>
      </template>

      <!-- 需求跟踪矩阵（真实数据） -->
      <div v-else class="card" v-loading="matrixLoading">
        <div class="card-head">
          <h3>需求跟踪矩阵 (RTM)</h3>
          <span class="sub">需求 → 工作项 → 测试用例 全链路追溯（数据来自 /api/trace/matrix）</span>
          <div class="right">
            <span class="badge" :class="matrixRate >= 80 ? 'green' : matrixRate >= 50 ? 'orange' : 'red'">
              覆盖率 {{ matrixRate }}%
            </span>
          </div>
        </div>
        <div class="card-pad" style="padding-top:6px">
          <div class="grid g-4 mb-4">
            <div class="list-row stat-mini" @click="openDetail('rtm:total')">
              <div class="grow"><small>需求总数</small><b>{{ matrixSummary.total }}</b></div>
              <AppIcon name="eye" :size="13" class="mini-hint" />
            </div>
            <div class="list-row stat-mini" @click="openDetail('rtm:covered')">
              <div class="grow"><small>完整覆盖</small><b>{{ matrixSummary.fullyCovered }}</b></div>
              <AppIcon name="eye" :size="13" class="mini-hint" />
            </div>
            <div class="list-row stat-mini" @click="openDetail('rtm:gap')">
              <div class="grow"><small>覆盖缺口</small><b>{{ matrixSummary.total - matrixSummary.fullyCovered }}</b></div>
              <AppIcon name="eye" :size="13" class="mini-hint" />
            </div>
            <div class="list-row stat-mini" @click="openDetail('rtm:rate')">
              <div class="grow"><small>覆盖率</small><b>{{ matrixRate }}%</b></div>
              <AppIcon name="eye" :size="13" class="mini-hint" />
            </div>
          </div>

          <div class="grid g-3 mb-4">
            <div class="card card-pad" style="text-align:center;background:rgba(255,255,255,.4);cursor:pointer"
                 @click="openDetail('rtm:rate')">
              <div class="detail-sec-title" style="justify-content:center">追溯覆盖率</div>
              <Gauge :value="matrixRate" :size="170" label="覆盖率" />
            </div>
            <div class="card card-pad" style="background:rgba(255,255,255,.4);cursor:pointer"
                 @click="openDetail('rtm:coverage')">
              <div class="detail-sec-title">覆盖状态分布</div>
              <Donut :items="coverageDist" center-label="需求" :size="200" interactive
                     @chart-click="(p) => openDetail('rtm:cov:' + p.name)" />
            </div>
            <div class="card card-pad" style="background:rgba(255,255,255,.4);cursor:pointer"
                 @click="openDetail('rtm:cases')">
              <div class="detail-sec-title">用例验证结果</div>
              <BarChart :items="verifyDist" :height="185" unit=" 条" />
            </div>
          </div>
        </div>
        <el-table :data="matrixRows" style="width:100%">
          <el-table-column label="需求编号" width="140">
            <template #default="{ row }"><span class="mono fs-12 muted">{{ row.requirement.code }}</span></template>
          </el-table-column>
          <el-table-column label="需求" min-width="200">
            <template #default="{ row }">
              <span class="c-title" @click="openReqDetail(row.requirement)">{{ row.requirement.title }}</span>
            </template>
          </el-table-column>
          <el-table-column label="关联工作项" min-width="200">
            <template #default="{ row }">
              <span v-if="!row.workItems.length" class="text-3">未关联</span>
              <div v-else>
                <div v-for="w in row.workItems" :key="w.id" class="fs-13">
                  <span class="mono fs-12 muted">{{ w.code }}</span> {{ w.title }}
                  <StatusBadge :text="w.status" :kind="statusKind(w.status)" />
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="关联用例" min-width="200">
            <template #default="{ row }">
              <span v-if="!row.testCases.length" class="text-3">未关联</span>
              <div v-else>
                <div v-for="t in row.testCases" :key="t.id" class="fs-13">
                  <span class="mono fs-12 muted">{{ t.code }}</span> {{ t.title }}
                  <StatusBadge :text="t.lastResult" :kind="statusKind(t.lastResult)" />
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="覆盖度" width="120" align="center">
            <template #default="{ row }">
              <span class="badge" :class="row.coverage.fullyCovered ? 'green' : (row.coverage.hasWorkItem ? 'orange' : 'gray')">
                {{ row.coverage.fullyCovered ? '已覆盖' : (row.coverage.hasWorkItem ? '部分' : '未关联') }}
              </span>
              <div class="hint mt-2">{{ row.coverage.passed }}/{{ row.testCases.length }} 通过</div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="right">
            <template #default="{ row }">
              <button class="btn btn-sm" @click="openReqDetail(row.requirement)"><AppIcon name="eye" :size="14" /> 追溯</button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 新建 / 编辑需求 -->
      <el-dialog v-model="reqDialog" :title="reqForm.id ? '编辑需求' : (tab === 'ticket' ? '新建工单' : '新建需求')" width="600px">
        <el-form label-position="top">
          <el-form-item label="标题" :error="formErrors.title" required>
            <el-input v-model="reqForm.title" placeholder="一句话描述需求" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="类型">
              <el-select v-model="reqForm.type" style="width:100%">
                <el-option label="需求" value="需求" /><el-option label="工单" value="工单" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="reqForm.priority" style="width:100%">
                <el-option v-for="p in PRIORITIES" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="reqForm.status" style="width:100%">
                <el-option v-for="s in STATUSES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="reqForm.assignee" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name + '（' + u.role + '）'" :value="u.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="故事点" :error="formErrors.points">
              <el-input-number v-model="reqForm.points" :min="0" :max="100" style="width:100%" />
            </el-form-item>
            <el-form-item label="来源">
              <el-select v-model="reqForm.source" style="width:100%">
                <el-option v-for="s in SOURCES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="所属产品">
            <el-select v-model="reqForm.productId" style="width:100%">
              <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="reqForm.description" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="reqDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveReq">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </template>
      </el-dialog>

      <!-- 新建产品 -->
      <el-dialog v-model="productDialog" title="新建产品" width="520px">
        <el-form label-position="top">
          <el-form-item label="产品名称" :error="formErrors.name" required>
            <el-input v-model="productForm.name" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="标识符" :error="formErrors.identifier" required>
              <el-input v-model="productForm.identifier" placeholder="OA" />
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="productForm.owner" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="产品描述">
            <el-input v-model="productForm.description" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="productDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveProduct">
            {{ saving ? '创建中…' : '创建' }}
          </button>
        </template>
      </el-dialog>

      <!-- 需求详情（真实追溯） -->
      <el-drawer v-model="detailDrawer" size="680px" :title="detail ? detail.code + ' · 需求详情' : ''">
        <div v-if="detail" v-loading="traceLoading">
          <div class="flex items-center gap-2 mb-3 wrap">
            <StatusBadge :text="detail.type" :kind="detail.type === '工单' ? 'orange' : 'indigo'" />
            <StatusBadge :text="detail.status" :kind="statusKind(detail.status)" dot />
            <span class="prio"><span class="pbar" :style="{ background: priorityColor(detail.priority) }"></span>{{ detail.priority }}优先级</span>
            <span class="chip"><AppIcon name="target" :size="12" /> {{ detail.points }} 点</span>
          </div>
          <h3 style="font-size:19px;font-weight:800;margin-bottom:14px">{{ detail.title }}</h3>

          <dl class="kv mb-4">
            <dt>所属产品</dt><dd>{{ data.productById(detail.productId)?.name || '—' }}</dd>
            <dt>负责人</dt><dd><UserChip :user="data.userById(detail.assignee)" /></dd>
            <dt>需求来源</dt><dd>{{ detail.source }}</dd>
            <dt>创建时间</dt><dd>{{ fmtDate(detail.createdAt) }}</dd>
          </dl>

          <div v-if="detail.description" class="detail-desc mb-4">{{ detail.description }}</div>

          <!-- 覆盖度 -->
          <div class="hr"></div>
          <h4 class="drawer-sec">追踪覆盖度</h4>
          <div class="grid g-3 mb-3">
            <div class="list-row" style="background:rgba(255,255,255,.45);border:1px solid var(--glass-border)">
              <div class="grow"><small>关联工作项</small><b style="font-size:18px">{{ trace.workItems.length }}</b></div>
            </div>
            <div class="list-row" style="background:rgba(255,255,255,.45);border:1px solid var(--glass-border)">
              <div class="grow"><small>关联用例</small><b style="font-size:18px">{{ trace.testCases.length }}</b></div>
            </div>
            <div class="list-row" style="background:rgba(255,255,255,.45);border:1px solid var(--glass-border)">
              <div class="grow"><small>用例通过</small><b style="font-size:18px">{{ trace.coverage.passed }}</b></div>
            </div>
          </div>
          <div v-if="!trace.coverage.fullyCovered" class="readonly-tip mb-3">
            <AppIcon name="alert" :size="14" />
            该需求尚未形成完整追溯闭环（{{ trace.coverage.hasWorkItem ? '缺测试用例' : '缺工作项' }}），建议补齐。
          </div>

          <h4 class="drawer-sec">关联工作项 ({{ trace.workItems.length }})</h4>
          <div v-for="w in trace.workItems" :key="w.id" class="list-row" style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45)">
            <div class="grow"><b>{{ w.code }} {{ w.title }}</b><small>{{ w.type }} · 负责人 {{ data.userById(w.assignee).name }}</small></div>
            <StatusBadge :text="w.status" :kind="statusKind(w.status)" />
          </div>
          <div v-if="!trace.workItems.length" class="hint mb-3">暂无关联工作项</div>

          <h4 class="drawer-sec mt-3">关联测试用例 ({{ trace.testCases.length }})</h4>
          <div v-for="t in trace.testCases" :key="t.id" class="list-row" style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45)">
            <div class="grow"><b>{{ t.code }} {{ t.title }}</b><small>{{ t.module }} · 维护人 {{ data.userById(t.maintainer).name }}</small></div>
            <StatusBadge :text="t.lastResult" :kind="statusKind(t.lastResult)" />
          </div>
          <div v-if="!trace.testCases.length" class="hint">暂无关联测试用例</div>
        </div>
        <template #footer>
          <button class="btn" @click="detailDrawer = false">关闭</button>
          <button v-if="canWrite" class="btn btn-primary" @click="openReqDialog(detail); detailDrawer = false">
            <AppIcon name="edit" :size="15" /> 编辑
          </button>
        </template>
      </el-drawer>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()
    const canWrite = computed(() => auth.canWrite('product'))

    const productId = ref('')
    const tab = ref('req')
    const list = ref([])
    const total = ref(0)
    const page = ref(1)
    const pageSize = ref(20)
    const loading = ref(false)
    const saving = ref(false)
    const selected = ref([])
    const filters = ref({ keyword: '', status: '', priority: '' })

    const reqDialog = ref(false)
    const productDialog = ref(false)
    const detailDrawer = ref(false)
    const detail = ref(null)
    const formErrors = ref({})
    const reqForm = ref(blankReq())
    const productForm = ref({ name: '', identifier: '', owner: '', description: '' })

    const matrixRows = ref([])
    const matrixSummary = ref({ total: 0, fullyCovered: 0, coverageRate: 0 })
    const matrixLoading = ref(false)
    const traceMeta = ref({})
    const trace = ref({ workItems: [], testCases: [], coverage: {} })
    const traceLoading = ref(false)

    /* ==================== 详情视图 ==================== */
    const COV_COLORS = { 已覆盖: '#23d3a9', 部分覆盖: '#ffb020', 未关联: '#a3bdb7' }

    const coverageDist = computed(() => {
      const rows = matrixRows.value
      const full = rows.filter((r) => r.coverage.fullyCovered).length
      const partial = rows.filter((r) => !r.coverage.fullyCovered && r.coverage.hasWorkItem).length
      const none = rows.length - full - partial
      return [
        { label: '已覆盖', value: full, color: COV_COLORS['已覆盖'] },
        { label: '部分覆盖', value: partial, color: COV_COLORS['部分覆盖'] },
        { label: '未关联', value: none, color: COV_COLORS['未关联'] },
      ].filter((x) => x.value > 0)
    })

    const verifyDist = computed(() => {
      const by = {}
      matrixRows.value.forEach((r) => {
        ;(r.testCases || []).forEach((t) => {
          by[t.lastResult || '未执行'] = (by[t.lastResult || '未执行'] || 0) + 1
        })
      })
      return Object.keys(by).map((k) => ({ label: k, value: by[k] }))
    })

    /** 覆盖缺口：未形成「工作项 + 用例」闭环的需求 */
    const gapRows = computed(() =>
      matrixRows.value.filter((r) => !r.coverage.fullyCovered),
    )

    const matrixRowTable = (rows) => ({
      columns: [
        { key: 'code', label: '需求编号', width: 130, type: 'mono' },
        { key: 'title', label: '需求', minWidth: 190 },
        { key: 'workItems', label: '工作项', width: 80, align: 'right' },
        { key: 'testCases', label: '用例', width: 80, align: 'right' },
        { key: 'state', label: '覆盖状态', width: 100 },
        { key: 'passed', label: '已通过', width: 85, align: 'right' },
      ],
      rows: rows.map((r) => ({
        code: r.requirement.code,
        title: r.requirement.title,
        workItems: (r.workItems || []).length,
        testCases: (r.testCases || []).length,
        state: r.coverage.fullyCovered ? '已覆盖' : r.coverage.hasWorkItem ? '部分覆盖' : '未关联',
        passed: r.coverage.passed || 0,
      })),
      empty: '暂无数据',
    })

    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const sub = key.includes(':') ? key.split(':')[1] : null
      const sub2 = key.split(':')[2] || null

      switch (k) {
        /* ---------- 产品级详情 ---------- */
        case 'product': {
          const p = data.productById(sub)
          if (!p) return null
          const reqs = data.requirements.filter((r) => r.productId === p.id)
          const byStatus = groupCount(reqs, 'status')
          const myRows = matrixRows.value.filter((r) => r.requirement.productId === p.id)
          return {
            title: `${p.name} · 产品详情`,
            subtitle: `${p.identifier} · 负责人 ${data.userById(p.owner).name} · 状态 ${p.status}`,
            metrics: [
              { label: '需求 / 工单', value: reqs.length, unit: '条' },
              { label: '已完成', value: byStatus['已完成'] || 0, unit: '条' },
              { label: '完成率', value: pct(byStatus['已完成'] || 0, reqs.length), unit: '%' },
              { label: '故事点', value: reqs.reduce((a, r) => a + (r.points || 0), 0), unit: '点' },
              { label: '关联项目', value: data.projects.filter((x) => x.productId === p.id).length, unit: '个' },
              { label: '追溯覆盖', value: myRows.length ? pct(myRows.filter((r) => r.coverage.fullyCovered).length, myRows.length) : 0, unit: '%' },
            ],
            series: [
              {
                name: '需求状态分布',
                height: '250px',
                option: donutOption({
                  items: Object.keys(byStatus).map((s) => ({
                    label: s, value: byStatus[s],
                    color: { 已完成: '#23d3a9', 开发中: '#38bdf8', 已排期: '#8b7cf6', 待评审: '#ffb020' }[s],
                  })),
                  centerLabel: '需求',
                }),
              },
              {
                name: '需求按优先级分布',
                height: '220px',
                option: barOption({
                  items: ['高', '中', '低'].map((pr) => ({ label: pr, value: reqs.filter((r) => r.priority === pr).length })),
                  unit: ' 条',
                }),
              },
            ],
            desc: `**${p.name}** 的产品描述：${p.description || '（未填写）'}\n\n产品是所有需求的归属容器，需求通过产品标识符生成业务编号。`,
            table: {
              exportable: true,
              columns: [
                { key: 'code', label: '编号', width: 130, type: 'mono' },
                { key: 'title', label: '需求', minWidth: 190 },
                { key: 'type', label: '类型', width: 75 },
                { key: 'priority', label: '优先级', width: 80 },
                { key: 'status', label: '状态', width: 95 },
                { key: 'points', label: '点数', width: 65, align: 'right' },
              ],
              rows: reqs.map((r) => ({
                code: r.code, title: r.title, type: r.type,
                priority: r.priority, status: r.status, points: r.points,
              })),
            },
            notes: ['产品标识符创建后不可修改（用于生成业务编号），如需变更请新建产品。'],
            actions: [{ key: 'selectProduct', label: `切换到 ${p.identifier}`, icon: 'product', primary: true }],
          }
        }

        /* ---------- 覆盖度相关 ---------- */
        case 'rtm': {
          const rows = matrixRows.value
          const full = rows.filter((r) => r.coverage.fullyCovered).length
          const base = {
            'rtm:total': {
              title: '需求追踪矩阵 · 需求总数',
              subtitle: `当前产品（${currentProduct.value?.name || '—'}）纳入追溯的需求`,
              metrics: [
                { label: '纳入追溯', value: rows.length, unit: '条' },
                { label: '产品内需求', value: data.requirements.filter((r) => r.productId === productId.value).length, unit: '条' },
              ],
              chart: { height: '240px', option: donutOption({ items: coverageDist.value, centerLabel: '需求' }) },
              desc: '矩阵只统计**当前选中产品**的需求。切换产品卡片可查看其他产品的追溯情况。',
            },
            'rtm:covered': {
              title: '完整覆盖的需求',
              subtitle: '同时具备关联工作项与关联用例',
              metrics: [
                { label: '完整覆盖', value: full, unit: '条' },
                { label: '覆盖率', value: pct(full, rows.length), unit: '%' },
                { label: '需求总数', value: rows.length, unit: '条' },
              ],
              chart: { height: '250px', option: gaugeOption({ value: pct(full, rows.length), name: '覆盖率', size: 240 }) },
              desc: '**完整覆盖** = 需求既有关联工作项（被实现），又有关联测试用例（被验证）。',
            },
            'rtm:gap': {
              title: '覆盖缺口',
              subtitle: '尚未形成「实现 + 验证」闭环的需求',
              metrics: [
                { label: '缺口需求', value: gapRows.value.length, unit: '条' },
                { label: '缺工作项', value: gapRows.value.filter((r) => !r.coverage.hasWorkItem).length, unit: '条' },
                { label: '缺用例', value: gapRows.value.filter((r) => r.coverage.hasWorkItem && !r.coverage.hasTestCase).length, unit: '条' },
              ],
              chart: {
                height: '250px',
                option: donutOption({
                  items: [
                    { label: '缺工作项', value: gapRows.value.filter((r) => !r.coverage.hasWorkItem).length, color: '#ff7a6b' },
                    { label: '缺用例', value: gapRows.value.filter((r) => r.coverage.hasWorkItem && !r.coverage.hasTestCase).length, color: '#ffb020' },
                  ],
                  centerLabel: '缺口',
                }),
              },
              desc: '这些需求存在**追溯断链**：未被实现、或实现了但缺少验证。建议优先补齐再推动发布。',
              table: matrixRowTable(gapRows.value),
              notes: ['「缺用例」说明工作项已存在但未建立验证关系，测试覆盖无法自证。'],
            },
            'rtm:rate': {
              title: '追溯覆盖率',
              subtitle: '完整覆盖需求 ÷ 纳入追溯的需求',
              metrics: [
                { label: '覆盖率', value: pct(full, rows.length), unit: '%' },
                { label: '完整覆盖', value: full, unit: '条' },
                { label: '需求总数', value: rows.length, unit: '条' },
                { label: '缺口', value: rows.length - full, unit: '条' },
              ],
              series: [
                { name: '覆盖率', height: '240px', option: gaugeOption({ value: pct(full, rows.length), name: '覆盖率', size: 240 }) },
                { name: '覆盖状态分布', height: '230px', option: barOption({ items: coverageDist.value.map((c) => ({ label: c.label, value: c.value })), unit: ' 条' }) },
              ],
              desc:
                '**追溯覆盖率**衡量需求是否形成「需求 → 工作项 → 测试用例」的完整链路。\n\n' +
                '建议目标：核心需求 100%，整体不低于 80%。',
              table: matrixRowTable(rows),
              notes: ['覆盖率按需求条数计算，未按故事点加权。'],
            },
            'rtm:coverage': {
              title: '覆盖状态分布',
              subtitle: '已覆盖 / 部分覆盖 / 未关联',
              chart: { height: '300px', option: donutOption({ items: coverageDist.value, centerLabel: '需求' }) },
              desc:
                '三种状态的定义：\n\n' +
                '- **已覆盖**：有关联工作项，也有关联用例\n' +
                '- **部分覆盖**：只有工作项（实现了但未验证）\n' +
                '- **未关联**：既无工作项也无用例（尚未落地）',
              table: matrixRowTable(rows),
              notes: [],
            },
            'rtm:cov': {
              title: `覆盖状态 · ${sub2 || ''}`,
              subtitle: '按覆盖状态筛选的需求',
              table: matrixRowTable(
                rows.filter((r) => {
                  const st = r.coverage.fullyCovered ? '已覆盖' : r.coverage.hasWorkItem ? '部分覆盖' : '未关联'
                  return st === sub2
                }),
              ),
              desc: '点击环形图扇区可查看对应状态的需求明细。',
              notes: [],
            },
            'rtm:cases': {
              title: '关联用例验证结果',
              subtitle: '矩阵中所有关联用例的执行结果',
              metrics: (() => {
                const all = rows.flatMap((r) => r.testCases || [])
                const by = {}
                all.forEach((t) => { by[t.lastResult || '未执行'] = (by[t.lastResult || '未执行'] || 0) + 1 })
                return [
                  { label: '关联用例', value: all.length, unit: '条' },
                  { label: '通过', value: by['通过'] || 0, unit: '条' },
                  { label: '失败', value: by['失败'] || 0, unit: '条' },
                  { label: '未执行', value: by['未执行'] || 0, unit: '条' },
                ]
              })(),
              chart: { height: '260px', option: barOption({ items: verifyDist.value, unit: ' 条' }) },
              desc: '只统计**已被需求或工作项关联**的用例，未被关联的用例不计入（这正是追溯的价值）。',
              table: {
                columns: [
                  { key: 'code', label: '编号', width: 120, type: 'mono' },
                  { key: 'title', label: '用例', minWidth: 200 },
                  { key: 'module', label: '模块', width: 100 },
                  { key: 'result', label: '结果', width: 100 },
                ],
                rows: rows.flatMap((r) => r.testCases || []).map((t) => ({
                  code: t.code, title: t.title, module: t.module, result: t.lastResult,
                })),
                empty: '暂无关联用例',
              },
              notes: [],
            },
          }
          const baseKey = key.startsWith('rtm:cov:') ? 'rtm:cov' : key
          return base[baseKey] || null
        }

        default:
          return null
      }
    }

    function onDetailAction(key) {
      if (key === 'export') {
        const a = document.createElement('a')
        a.href = exportUrl('requirements', { productId: productId.value, pageSize: 500 })
        a.download = '需求清单.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else if (key === 'selectProduct') {
        const pid = detailKey.value.split(':')[1]
        detailVisible.value = false
        if (pid) selectProduct(pid)
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    function blankReq() {
      return {
        id: '', title: '', type: '需求', priority: '中', status: '待评审',
        assignee: '', points: 3, source: '内部需求', productId: '', description: '',
      }
    }

    const currentProduct = computed(() => data.productById(productId.value))
    const matrixRate = computed(() => matrixSummary.value.coverageRate || 0)

    const tabCounts = computed(() => {
      const all = data.requirements.filter((r) => r.productId === productId.value)
      return {
        req: all.filter((r) => r.type !== '工单').length,
        ticket: all.filter((r) => r.type === '工单').length,
      }
    })

    const reqCountOf = (pid) => data.requirements.filter((r) => r.productId === pid).length
    const coverageOf = (pid) => {
      const rows = matrixRows.value.filter((r) => r.requirement.productId === pid)
      if (!rows.length) return 0
      return Math.round((rows.filter((r) => r.coverage.fullyCovered).length / rows.length) * 100)
    }

    /* ---------------- 列表 ---------------- */
    async function fetchList() {
      if (!productId.value || tab.value === 'matrix') return
      loading.value = true
      try {
        const params = {
          page: page.value, pageSize: pageSize.value, productId: productId.value,
          sort: 'createdAt', order: 'desc',
        }
        if (filters.value.keyword) params.keyword = filters.value.keyword
        if (filters.value.status) params.status = filters.value.status
        if (filters.value.priority) params.priority = filters.value.priority
        params.type = tab.value === 'ticket' ? '工单' : '需求'

        const res = await data.query('requirements', params)
        list.value = res.list
        total.value = res.total
        loadTraceMeta(res.list)
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载需求列表失败'))
        list.value = []
        total.value = 0
      } finally {
        loading.value = false
      }
    }

    /** 为当前页需求批量取覆盖状态（用矩阵结果，避免 N 次请求） */
    async function loadTraceMeta(rows) {
      try {
        const res = await data.fetchMatrix(productId.value)
        matrixRows.value = res.rows || []
        matrixSummary.value = res.summary || { total: 0, fullyCovered: 0, coverageRate: 0 }
        const map = {}
        matrixRows.value.forEach((r) => { map[r.requirement.id] = r.coverage })
        traceMeta.value = map
        void rows
      } catch (e) {
        traceMeta.value = {}
      }
    }

    /* ---------------- 矩阵 ---------------- */
    async function fetchMatrix() {
      matrixLoading.value = true
      try {
        const res = await data.fetchMatrix(productId.value)
        matrixRows.value = res.rows || []
        matrixSummary.value = res.summary || { total: 0, fullyCovered: 0, coverageRate: 0 }
        const map = {}
        matrixRows.value.forEach((r) => { map[r.requirement.id] = r.coverage })
        traceMeta.value = map
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载追踪矩阵失败'))
        matrixRows.value = []
      } finally {
        matrixLoading.value = false
      }
    }

    function reload() {
      page.value = 1
      tab.value === 'matrix' ? fetchMatrix() : fetchList()
    }

    function switchTab(t) {
      tab.value = t
      page.value = 1
      t === 'matrix' ? fetchMatrix() : fetchList()
    }

    function selectProduct(id) {
      productId.value = id
      page.value = 1
      tab.value === 'matrix' ? fetchMatrix() : fetchList()
    }

    /* ---------------- 详情追溯 ---------------- */
    /** 需求详情抽屉（含真实追溯链路） */
    async function openReqDetail(row) {
      detail.value = row
      detailDrawer.value = true
      traceLoading.value = true
      try {
        const res = await data.fetchTrace(row.id)
        trace.value = {
          workItems: res.workItems || [],
          testCases: res.testCases || [],
          coverage: res.coverage || {},
        }
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载追溯信息失败'))
        trace.value = { workItems: [], testCases: [], coverage: {} }
      } finally {
        traceLoading.value = false
      }
    }

    /* ---------------- CRUD ---------------- */
    function openReqDialog(row) {
      formErrors.value = {}
      reqForm.value = row
        ? { ...blankReq(), ...row }
        : {
            ...blankReq(), productId: productId.value,
            type: tab.value === 'ticket' ? '工单' : '需求',
            assignee: data.users[0]?.id || '',
          }
      reqDialog.value = true
    }

    async function saveReq() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = reqForm.value
        const payload = {
          title: f.title, type: f.type, priority: f.priority, status: f.status,
          assignee: f.assignee, points: Number(f.points), source: f.source,
          productId: f.productId, description: f.description || '',
        }
        if (f.id) await data.edit('requirements', f.id, payload)
        else await data.save('requirements', payload)
        ElMessage.success(f.id ? '需求已更新' : '需求已创建')
        reqDialog.value = false
        reload()
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function removeReq(row) {
      try {
        await ElMessageBox.confirm(`确定删除需求「${row.title}」？关联关系与评论将一并清理。`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.destroy('requirements', row.id)
        ElMessage.success('已删除')
        reload()
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    function onSelect(rows) {
      selected.value = rows.map((r) => r.id)
    }

    async function doBatchDelete() {
      try {
        await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 条需求/工单？`, '批量删除', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      saving.value = true
      try {
        const res = await data.batchDelete('requirements', selected.value)
        ElMessage.success(`删除完成：成功 ${res.success} 条，失败 ${res.failed} 条`)
        if (res.failures?.length) ElMessage.warning(`首条失败原因：${res.failures[0].message}`)
        selected.value = []
        reload()
      } catch (e) {
        ElMessage.error(errorMessage(e, '批量删除失败'))
      } finally {
        saving.value = false
      }
    }

    async function saveProduct() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = productForm.value
        const created = await data.save('products', {
          name: f.name, identifier: f.identifier, owner: f.owner || data.users[0]?.id,
          description: f.description || '', status: '规划中',
        })
        ElMessage.success('产品已创建')
        productDialog.value = false
        selectProduct(created.id)
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '创建失败'))
      } finally {
        saving.value = false
      }
    }

    function openProductDialog() {
      formErrors.value = {}
      productForm.value = { name: '', identifier: '', owner: data.users[0]?.id || '', description: '' }
      productDialog.value = true
    }

    /* ---------------- 导出 ---------------- */
    function exportList() {
      const params = { pageSize: 500 }
      if (productId.value) params.productId = productId.value
      if (tab.value === 'ticket') params.type = '工单'
      else if (tab.value === 'req') params.type = '需求'
      if (filters.value.status) params.status = filters.value.status
      // 需求/工单都属于 requirements 资源
      const url = exportUrl('requirements', params)
      const a = document.createElement('a')
      a.href = url
      a.download = '需求清单.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('已开始下载')
    }

    /** 默认选中需求最多的产品（通常是主力产品），更符合使用习惯 */
    function pickDefaultProduct() {
      if (!data.products.length) return ''
      let best = data.products[0]
      let bestCount = -1
      data.products.forEach((p) => {
        const n = data.requirements.filter((r) => r.productId === p.id).length
        if (n > bestCount) { best = p; bestCount = n }
      })
      return best.id
    }

    onMounted(() => {
      if (data.products.length) {
        productId.value = pickDefaultProduct()
        fetchList()
      }
    })

    watch(() => data.products.length, (n) => {
      if (n && !productId.value) {
        productId.value = pickDefaultProduct()
        fetchList()
      }
    })

    return {
      data, auth, canWrite, productId, tab, list, total, page, pageSize, loading, saving, selected, filters,
      reqDialog, productDialog, detailDrawer, detail, formErrors, reqForm, productForm,
      currentProduct, tabCounts, matrixRows, matrixSummary, matrixRate, matrixLoading, traceMeta, trace, traceLoading,
      STATUSES, PRIORITIES, SOURCES,
      reqCountOf, coverageOf, fetchList, fetchMatrix, reload, switchTab, selectProduct, openReqDetail,
      openReqDialog, saveReq, removeReq, onSelect, doBatchDelete, saveProduct, openProductDialog, exportList,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction,
      coverageDist, verifyDist, gapRows,
      fmtDate, fromNow, statusKind, priorityColor,
    }
  },
}
