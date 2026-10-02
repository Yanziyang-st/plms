import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, StatusBadge, UserChip, EmptyState, AvatarStack, StatCard, Avatar } from '../components/ui.js'
import { Gauge, BarChart, Donut } from '../components/charts.js'
import { barOption, donutOption, gaugeOption } from '../utils/chartOptions.js'
import { useDetail, pct, groupCount } from '../utils/useDetail.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useAuthStore } from '../stores/auth.js'
import { useDataStore } from '../stores/data.js'
import { errorMessage } from '../api/request.js'
import { exportUrl } from '../api/index.js'
import { fmtDate, fromNow, statusKind, priorityColor, stageColor } from '../utils/format.js'

const STAGES = ['待处理', '进行中', '待测试', '已完成']
const TYPES = ['任务', '需求', '缺陷', '子任务']
const PRIORITIES = ['紧急', '高', '中', '低']

/** 前端镜像的工作项状态机（后端仍会独立校验，此处仅用于即时反馈） */
const TRANSITIONS = {
  待处理: ['进行中', '已完成'],
  进行中: ['待测试', '已完成', '待处理'],
  待测试: ['已完成', '进行中', '待处理'],
  已完成: ['进行中'],
}

export default {
  name: 'ProjectView',
  components: {
    AppIcon, PageHeader, StatusBadge, UserChip, EmptyState, AvatarStack, StatCard, Avatar,
    Gauge, BarChart, Donut, PanelCard, DetailDrawer,
  },
  template: `
    <div v-if="!projectId">
      <!-- ============ 项目列表 ============ -->
      <PageHeader title="项目管理" description="支持 Scrum / Kanban / 瀑布开发模型，按团队节奏推进交付">
        <template #actions>
          <button class="btn" @click="exportList"><AppIcon name="download" :size="16" /> 导出</button>
          <button v-if="auth.canWrite('project')" class="btn btn-primary" @click="openProjectDialog">
            <AppIcon name="plus" :size="16" /> 新建项目
          </button>
        </template>
      </PageHeader>

      <div class="filters">
        <div class="search-input" style="width:240px">
          <AppIcon name="search" :size="16" />
          <input class="input" v-model="projKeyword" placeholder="搜索项目名称或标识" />
        </div>
        <select class="select" style="width:140px" v-model="projStatus">
          <option value="">全部状态</option>
          <option v-for="s in ['进行中','已完成','已暂停']" :key="s" :value="s">{{ s }}</option>
        </select>
        <span class="spacer"></span>
        <span class="hint">共 {{ filteredProjects.length }} 个</span>
      </div>

      <div class="grid g-3">
        <div v-for="p in filteredProjects" :key="p.id" class="card card-pad" style="cursor:pointer" @click="$router.push('/project/' + p.id)">
          <div class="flex items-center gap-2 mb-3">
            <span :style="{ width:'40px', height:'40px', borderRadius:'12px', background:p.color, display:'grid', placeItems:'center', color:'#fff', fontWeight:800 }">
              {{ p.identifier.slice(0,2) }}
            </span>
            <div style="flex:1;min-width:0">
              <b style="font-size:14.5px">{{ p.name }}</b>
              <div class="fs-12 text-3">{{ p.identifier }} · {{ p.type }} 模型</div>
            </div>
            <StatusBadge :text="p.status" :kind="statusKind(p.status)" />
          </div>
          <p class="fs-12 text-3" style="line-height:1.6;min-height:34px">{{ p.description }}</p>
          <div class="mt-3">
            <div class="progress"><i :style="{ width: p.progress + '%' }"></i></div>
            <div class="flex items-center" style="justify-content:space-between;margin-top:7px">
              <span class="hint">{{ doneCount(p.id) }}/{{ itemCount(p.id) }} 工作项完成</span>
              <span class="hint fw-7" style="color:var(--mint-700)">{{ p.progress }}%</span>
            </div>
          </div>
          <div class="flex items-center mt-3" style="justify-content:space-between">
            <AvatarStack :users="(p.members || []).map(m => data.userById(m))" />
            <span class="hint">{{ fmtDate(p.startDate) }} ~ {{ fmtDate(p.endDate) }}</span>
          </div>
        </div>
        <EmptyState v-if="!filteredProjects.length" title="暂无匹配项目" description="调整筛选条件或新建项目" icon="project" />
      </div>

      <!-- 新建项目 -->
      <el-dialog v-model="projectDialog" title="新建项目" width="600px">
        <el-form label-position="top">
          <el-form-item label="项目名称" :error="formErrors.name" required>
            <el-input v-model="projectForm.name" placeholder="例如：协同办公平台 V3.0" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="标识符" :error="formErrors.identifier" required>
              <el-input v-model="projectForm.identifier" placeholder="OAV3" />
            </el-form-item>
            <el-form-item label="开发模型">
              <el-select v-model="projectForm.type" style="width:100%">
                <el-option v-for="t in ['Scrum','Kanban','瀑布']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="projectForm.owner" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="关联产品">
              <el-select v-model="projectForm.productId" style="width:100%" clearable>
                <el-option v-for="p in data.products" :key="p.id" :label="p.name" :value="p.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="开始日期" :error="formErrors.startDate">
              <el-date-picker v-model="projectForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="projectForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </div>
          <el-form-item label="项目描述">
            <el-input v-model="projectForm.description" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="projectDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveProject">{{ saving ? '创建中…' : '创建' }}</button>
        </template>
      </el-dialog>
    </div>

    <!-- ============ 项目详情 ============ -->
    <div v-else>
      <PageHeader :title="project?.name || '项目详情'"
                  :description="project ? project.identifier + ' · 负责人 ' + data.userById(project.owner).name + ' · ' + fmtDate(project.startDate) + ' ~ ' + fmtDate(project.endDate) : ''">
        <template #actions>
          <button class="btn" @click="$router.push('/project')"><AppIcon name="chevronLeft" :size="16" /> 项目列表</button>
          <button class="btn" @click="exportItems"><AppIcon name="download" :size="16" /> 导出工作项</button>
          <button v-if="canWrite" class="btn btn-primary" @click="openItemDialog()">
            <AppIcon name="plus" :size="16" /> 新建工作项
          </button>
        </template>
      </PageHeader>

      <div class="grid g-4 mb-4">
        <StatCard label="工作项" :value="topItems.length" icon="list" clickable
                  :foot="subtaskCount ? '含 ' + subtaskCount + ' 个子任务' : '覆盖 ' + sprints.length + ' 个迭代'"
                  @detail="openDetail('items')" />
        <StatCard label="已完成" :value="byStage('已完成').length" icon="checkCircle" clickable
                  :foot="'完成率 ' + pct(byStage('已完成').length, topItems.length) + '%'"
                  bg="#e6fbf5" color="var(--mint-700)" @detail="openDetail('done')" />
        <StatCard label="进行中" :value="byStage('进行中').length" icon="play" clickable
                  :foot="'待处理 ' + byStage('待处理').length + ' · 待测试 ' + byStage('待测试').length"
                  bg="#e8f7fe" color="#0284c7" @detail="openDetail('doing')" />
        <StatCard label="故事点" :value="totalPoints" icon="target" clickable
                  :foot="'已完成 ' + donePoints + ' 点（仅顶层）'" bg="#f1eefe" color="#6d5dd3"
                  @detail="openDetail('points')" />
      </div>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'kanban' }" @click="tab = 'kanban'">工作项看板</button>
        <button class="tab" :class="{ active: tab === 'list' }" @click="tab = 'list'">工作项列表</button>
        <button class="tab" :class="{ active: tab === 'sprint' }" @click="tab = 'sprint'">迭代 ({{ sprints.length }})</button>
        <button class="tab" :class="{ active: tab === 'release' }" @click="tab = 'release'">发布</button>
        <span class="spacer"></span>
        <button class="btn btn-sm" @click="fetchItems"><AppIcon name="refresh" :size="14" /> 刷新</button>
      </div>

      <!-- 看板 -->
      <div v-if="tab === 'kanban'">
        <div class="filters">
          <span class="hint">看板默认只显示顶层工作项，子任务在列表视图与父项详情中管理</span>
          <span class="spacer"></span>
          <label class="flex items-center gap-2 fs-13" style="cursor:pointer">
            <el-switch v-model="showSubtasks" size="small" />
            <span class="text-2">显示子任务</span>
          </label>
          <span class="chip"><AppIcon name="layers" :size="13" /> 顶层 {{ topItems.length }}</span>
          <span class="chip" style="cursor:pointer" @click="openDetail('subtasks')">
            <AppIcon name="layers" :size="13" /> 子任务 {{ subtaskCount }}
            <AppIcon name="eye" :size="12" style="opacity:.6" />
          </span>
        </div>

        <div class="kanban" v-loading="loading">
        <div v-for="st in STAGES" :key="st" class="kcol"
             :class="{ 'drag-over': dragOver === st, 'drop-blocked': draggingItem && !canDropTo(st) && draggingItem.status !== st }"
             @dragover.prevent="onDragOver(st)"
             @dragleave="dragOver = ''"
             @drop="onDrop($event, st)">
          <div class="kcol-head" @click="openDetail('stage:' + st)" style="cursor:pointer">
            <span class="kdot" :style="{ background: stageColor(st), color: stageColor(st) }"></span>
            {{ st }}
            <span class="cnt">{{ kanbanStage(st).length }}</span>
            <AppIcon name="eye" :size="12" style="margin-left:auto;opacity:.5" />
          </div>
          <div class="kcol-body">
            <div v-for="w in kanbanStage(st)" :key="w.id" class="kcard" draggable="true"
                 @dragstart="onDragStart($event, w)"
                 @dragend="onDragEnd"
                 @click="openItemDrawer(w)"
                 :class="{ dragging: dragging === w.id, 'is-subtask': !!w.parentId }">
              <div class="kt">
                <span v-if="w.parentId" class="sub-mark" :title="'子任务 · 父项 ' + (parentOf(w)?.code || '')">↳</span>
                {{ w.title }}
              </div>
              <div class="flex items-center gap-2 wrap">
                <span class="prio fs-12"><span class="pbar" :style="{ background: priorityColor(w.priority) }"></span>{{ w.priority }}</span>
                <span class="tag fs-12" style="padding:1px 7px">{{ w.type }}</span>
                <span v-if="childStats(w.id).total" class="badge" :class="childStats(w.id).allDone ? 'green' : 'indigo'">
                  <AppIcon name="layers" :size="11" /> {{ childStats(w.id).done }}/{{ childStats(w.id).total }}
                </span>
                <span v-if="commentCount(w.id)" class="badge gray" style="margin-left:auto">
                  <AppIcon name="comment" :size="11" /> {{ commentCount(w.id) }}
                </span>
              </div>
              <div v-if="childStats(w.id).total" class="progress" style="margin-top:8px;height:5px">
                <i :style="{ width: childStats(w.id).progress + '%' }"></i>
              </div>
              <div class="kmeta">
                <UserChip :user="data.userById(w.assignee)" :show-name="false" />
                <span class="kfoot"><AppIcon name="clock" :size="12" /> {{ fmtDate(w.endDate) }}</span>
                <span class="sp">{{ w.points }}</span>
              </div>
            </div>
            <div v-if="!kanbanStage(st).length" class="hint" style="text-align:center;padding:14px">
              {{ draggingItem && canDropTo(st) ? '松开以移动到此列' : '暂无工作项' }}
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- 列表 -->
      <div v-else-if="tab === 'list'" class="card">
        <div v-if="selected.length" class="batch-bar">
          <b>已选 {{ selected.length }} 项</b>
          <select class="select" style="width:130px" v-model="batchStatus">
            <option value="">批量改状态</option>
            <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
          </select>
          <select class="select" style="width:130px" v-model="batchAssignee">
            <option value="">批量改负责人</option>
            <option v-for="u in data.users" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
          <button class="btn btn-sm btn-primary" :disabled="!batchStatus && !batchAssignee || saving" @click="doBatchUpdate">
            应用
          </button>
          <button class="btn btn-sm btn-danger" :disabled="saving" @click="doBatchDelete">
            <AppIcon name="trash" :size="14" /> 批量删除
          </button>
          <span class="spacer"></span>
          <button class="btn btn-sm btn-ghost" @click="selected = []">取消选择</button>
        </div>
        <div class="hint mb-2" style="padding:0 4px">
          <AppIcon name="layers" :size="13" /> 列表按父子层级展示（顶层 {{ topItems.length }} · 子任务 {{ subtaskCount }}）；
          展开父项可查看其子项，批量删除时会自动先删子项再删父项。
        </div>
        <el-table :data="treeRows" v-loading="loading" style="width:100%"
                  row-key="id" :tree-props="{ children: 'children' }" default-expand-all
                  @selection-change="onSelect">
          <el-table-column type="selection" width="46" />
          <el-table-column label="编号" width="150">
            <template #default="{ row }">
              <span class="mono fs-12 muted">{{ row.code }}</span>
              <div v-if="row.parentId" class="fs-12 text-3" style="line-height:1.3">
                ↳ {{ parentOf(row)?.code || '' }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="标题" min-width="240">
            <template #default="{ row }">
              <span class="c-title" @click="openItemDrawer(row)">{{ row.title }}</span>
              <div v-if="childStats(row.id).total" class="fs-12 text-3">
                子项 {{ childStats(row.id).done }}/{{ childStats(row.id).total }} · {{ childStats(row.id).progress }}%
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90">
            <template #default="{ row }"><span class="tag fs-12">{{ row.type }}</span></template>
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
          <el-table-column label="点数" width="70" align="right">
            <template #default="{ row }">{{ row.points }}</template>
          </el-table-column>
          <el-table-column label="截止" width="110">
            <template #default="{ row }"><span class="muted fs-12">{{ fmtDate(row.endDate) }}</span></template>
          </el-table-column>
          <el-table-column label="" width="80" align="right">
            <template #default="{ row }">
              <button v-if="canWrite" class="btn btn-sm btn-ghost" @click.stop="openItemDialog(row)"><AppIcon name="edit" :size="14" /></button>
              <button v-if="canWrite" class="btn btn-sm btn-ghost" @click.stop="removeItem(row)"><AppIcon name="trash" :size="14" /></button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 迭代 -->
      <div v-else-if="tab === 'sprint'">
        <div v-if="canWrite" class="filters">
          <button class="btn btn-sm btn-primary" @click="openSprintDialog()"><AppIcon name="plus" :size="14" /> 新建迭代</button>
        </div>
        <div class="grid g-2">
          <PanelCard v-for="s in sprints" :key="s.id" :title="s.name"
                     :subtitle="fmtDate(s.startDate) + ' ~ ' + fmtDate(s.endDate)"
                     clickable footer-hint @detail="openDetail('sprint:' + s.id)">
            <template #right><StatusBadge :text="s.status" :kind="statusKind(s.status)" /></template>
            <p class="fs-13 text-2 mb-3">目标：{{ s.goal || '—' }}</p>
            <div class="progress mb-3"><i :style="{ width: sprintProgress(s) + '%' }"></i></div>
            <div class="flex items-center mb-3" style="justify-content:space-between">
              <span class="hint">{{ sprintDone(s) }}/{{ sprintItems(s).length }} 完成</span>
              <span class="hint">{{ sprintPoints(s) }} 点</span>
            </div>
            <Donut :items="sprintDist(s)" center-label="工作项" :size="170" />
            <div v-if="canWrite" class="flex gap-2 mt-3">
              <button class="btn btn-sm" @click.stop="openSprintDialog(s)"><AppIcon name="edit" :size="13" /> 编辑</button>
              <button class="btn btn-sm btn-ghost" @click.stop="copySprint(s)"><AppIcon name="copy" :size="13" /> 复制</button>
              <button class="btn btn-sm btn-danger" @click.stop="removeSprint(s)"><AppIcon name="trash" :size="13" /> 删除</button>
            </div>
          </PanelCard>
          <EmptyState v-if="!sprints.length" title="暂无迭代" description="点击上方新建迭代" icon="layers" />
        </div>
      </div>

      <!-- 发布 -->
      <div v-else class="grid g-2-1">
        <PanelCard title="发布路线图" subtitle="版本发布计划与状态" clickable footer-hint
                   @detail="openDetail('release')">
          <div class="timeline">
            <div v-for="r in releases" :key="r.v" class="tl-item" :class="{ done: r.status === '已发布' }">
              <b>{{ r.v }} · {{ r.desc }}</b>
              <small>{{ fmtDate(r.date) }} · <StatusBadge :text="r.status" :kind="statusKind(r.status)" /></small>
            </div>
          </div>
        </PanelCard>

        <div style="display:flex;flex-direction:column;gap:18px">
          <PanelCard title="发布就绪度" :subtitle="'由完成率扣除阻塞缺陷得出'" clickable footer-hint
                     @detail="openDetail('readiness')">
            <div style="text-align:center">
              <Gauge :value="readiness" :size="190" label="版本就绪度" />
            </div>
          </PanelCard>

          <PanelCard title="质量与进度" subtitle="阻塞项与阶段分布" clickable footer-hint
                     @detail="openDetail('quality')">
            <div class="flex mb-2" style="justify-content:space-between;font-size:13px">
              <span class="text-3">阻塞缺陷</span><b>{{ openBugs }}</b>
            </div>
            <div class="flex mb-2" style="justify-content:space-between;font-size:13px">
              <span class="text-3">待测试</span><b>{{ byStage('待测试').length }}</b>
            </div>
            <div class="flex mb-3" style="justify-content:space-between;font-size:13px">
              <span class="text-3">关联迭代</span><b>{{ sprints.length }}</b>
            </div>
            <Donut :items="stageDist" center-label="工作项" :size="200" interactive
                   @chart-click="(p) => openDetail('stage:' + p.name)" />
          </PanelCard>
        </div>
      </div>

      <!-- 工作项弹窗 -->
      <el-dialog v-model="itemDialog" :title="itemForm.id ? '编辑工作项' : '新建工作项'" width="600px">
        <el-form label-position="top">
          <el-form-item label="标题" :error="formErrors.title" required>
            <el-input v-model="itemForm.title" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="类型">
              <el-select v-model="itemForm.type" style="width:100%">
                <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="itemForm.priority" style="width:100%">
                <el-option v-for="p in PRIORITIES" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="itemForm.status" style="width:100%">
                <el-option v-for="s in STAGES" :key="s" :label="s" :value="s" />
              </el-select>
            </el-form-item>
            <el-form-item label="负责人">
              <el-select v-model="itemForm.assignee" style="width:100%">
                <el-option v-for="u in data.users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="所属迭代">
              <el-select v-model="itemForm.sprintId" style="width:100%" clearable>
                <el-option v-for="s in sprints" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="父工作项" :error="formErrors.parentId">
              <el-select v-model="itemForm.parentId" style="width:100%" clearable filterable
                         placeholder="留空则为顶层工作项">
                <el-option v-for="c in parentCandidates" :key="c.id" :label="c.code + ' ' + c.title" :value="c.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="故事点" :error="formErrors.points">
              <el-input-number v-model="itemForm.points" :min="0" :max="100" style="width:100%" />
            </el-form-item>
            <el-form-item label="开始日期" :error="formErrors.startDate">
              <el-date-picker v-model="itemForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
            <el-form-item label="截止日期">
              <el-date-picker v-model="itemForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </div>
          <el-form-item label="描述">
            <el-input v-model="itemForm.description" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="itemDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveItem">{{ saving ? '保存中…' : '保存' }}</button>
        </template>
      </el-dialog>

      <!-- 迭代弹窗 -->
      <el-dialog v-model="sprintDialog" :title="sprintForm.id ? '编辑迭代' : '新建迭代'" width="560px">
        <el-form label-position="top">
          <el-form-item label="迭代名称" :error="formErrors.name" required>
            <el-input v-model="sprintForm.name" placeholder="例如：Sprint 7 · 消息中心" />
          </el-form-item>
          <el-form-item label="迭代目标">
            <el-input v-model="sprintForm.goal" placeholder="本迭代要达成的目标" />
          </el-form-item>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <el-form-item label="开始日期" :error="formErrors.startDate">
              <el-date-picker v-model="sprintForm.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="sprintForm.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
            </el-form-item>
          </div>
          <el-form-item label="状态">
            <el-select v-model="sprintForm.status" style="width:100%">
              <el-option v-for="s in ['未开始','进行中','已完成']" :key="s" :label="s" :value="s" />
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="sprintDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveSprint">{{ saving ? '保存中…' : '保存' }}</button>
        </template>
      </el-dialog>

      <!-- 工作项详情抽屉 -->
      <el-drawer v-model="itemDrawer" size="680px" :title="currentItem ? currentItem.code + ' · 工作项详情' : ''">
        <div v-if="currentItem" v-loading="drawerLoading">
          <div class="flex items-center gap-2 mb-4 wrap">
            <StatusBadge :text="currentItem.status" :kind="statusKind(currentItem.status)" dot />
            <span class="tag">{{ currentItem.type }}</span>
            <span class="prio"><span class="pbar" :style="{ background: priorityColor(currentItem.priority) }"></span>{{ currentItem.priority }}优先级</span>
            <span class="chip"><AppIcon name="target" :size="12" /> {{ currentItem.points }} 点</span>
          </div>

          <h3 style="font-size:19px;font-weight:800;margin-bottom:14px">{{ currentItem.title }}</h3>

          <!-- 子任务所在父项 -->
          <div v-if="parentOf(currentItem)" class="parent-bar mb-3" @click="openItemDrawer(parentOf(currentItem))">
            <AppIcon name="layers" :size="14" />
            <span>子任务 · 所属父项</span>
            <b>{{ parentOf(currentItem).code }} {{ parentOf(currentItem).title }}</b>
            <AppIcon name="chevronRight" :size="14" style="margin-left:auto" />
          </div>

          <div v-if="currentItem.description" class="detail-desc mb-4">{{ currentItem.description }}</div>

          <dl class="kv mb-4">
            <dt>所属项目</dt><dd>{{ data.projectById(currentItem.projectId)?.name || '—' }}</dd>
            <dt>所属迭代</dt><dd>{{ data.sprintById(currentItem.sprintId)?.name || '未分配' }}</dd>
            <dt>负责人</dt><dd><UserChip :user="data.userById(currentItem.assignee)" /></dd>
            <dt>起止日期</dt><dd>{{ fmtDate(currentItem.startDate) }} ~ {{ fmtDate(currentItem.endDate) }}</dd>
            <dt>更新时间</dt><dd>{{ fromNow(currentItem.updatedAt || currentItem.createdAt) }}</dd>
          </dl>

          <!-- 状态流转 -->
          <div class="hr"></div>
          <h4 class="drawer-sec">状态流转</h4>
          <div class="hint mb-2">
            当前「{{ currentItem.status }}」可流转到：
            <b v-if="!allowedNext.length">无（终态，可重新打开）</b>
          </div>
          <div class="flex gap-2 wrap">
            <button v-for="s in allowedNext" :key="s" class="btn btn-sm" :disabled="!canWrite || saving"
                    @click="changeStatus(s)">
              <AppIcon name="arrowUp" :size="13" /> {{ s }}
            </button>
            <span v-if="!canWrite" class="hint">当前角色无项目写权限</span>
          </div>

          <!-- 子项 -->
          <div class="hr"></div>
          <div class="flex items-center" style="justify-content:space-between">
            <h4 class="drawer-sec" style="margin:0">
              子项 ({{ childStats(currentItem.id).done }}/{{ childStats(currentItem.id).total }})
            </h4>
            <button v-if="canWrite && canHaveChildren(currentItem)" class="btn btn-sm" @click="addChild(currentItem)">
              <AppIcon name="plus" :size="13" /> 添加子项
            </button>
          </div>

          <div v-if="canHaveChildren(currentItem)" class="mt-2">
            <div v-if="childStats(currentItem.id).total" class="child-summary mb-3">
              <div class="progress" style="height:6px">
                <i :style="{ width: childStats(currentItem.id).progress + '%' }"></i>
              </div>
              <div class="flex items-center mt-2" style="justify-content:space-between">
                <span class="hint">
                  完成 {{ childStats(currentItem.id).done }} / {{ childStats(currentItem.id).total }}
                  · 子项点数 {{ childStats(currentItem.id).points }}
                </span>
                <span class="badge" :class="childStats(currentItem.id).allDone ? 'green' : 'indigo'">
                  {{ childStats(currentItem.id).progress }}%
                </span>
              </div>
            </div>

            <div v-for="c in childrenOf(currentItem.id)" :key="c.id" class="list-row child-row">
              <span class="sub-mark">↳</span>
              <div class="grow" @click="openItemDrawer(c)">
                <b>{{ c.title }}</b>
                <small>{{ c.code }} · {{ data.userById(c.assignee).name }} · {{ c.points }} 点</small>
              </div>
              <StatusBadge :text="c.status" :kind="statusKind(c.status)" />
              <button v-if="canWrite" class="btn btn-sm btn-ghost" title="移出子任务"
                      @click.stop="detachChild(c)"><AppIcon name="close" :size="13" /></button>
            </div>
            <div v-if="!childStats(currentItem.id).total" class="hint mb-2">
              暂无子项。可将该工作项拆解为若干子任务，父项进度会按子项完成情况汇总。
            </div>

            <div v-if="blockedByChildren" class="readonly-tip mt-2">
              <AppIcon name="alert" :size="14" />
              仍有 {{ childStats(currentItem.id).pending }} 个子项未完成，关闭父项前需先完成它们。
            </div>
          </div>
          <div v-else class="hint mt-2 mb-2">
            该工作项本身是「子任务」，不能再挂子项（工作项层级最多两层）。
          </div>

          <!-- 关联 -->
          <div class="hr"></div>
          <div class="flex items-center" style="justify-content:space-between">
            <h4 class="drawer-sec" style="margin:0">关联对象 ({{ links.length }})</h4>
            <button v-if="canWrite" class="btn btn-sm" @click="linkDialog = true">
              <AppIcon name="link" :size="13" /> 建立关联
            </button>
          </div>
          <div class="mt-2">
            <div v-for="l in links" :key="l.linkId" class="list-row" style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45)">
              <span class="badge indigo">{{ typeLabel(l.entityType) }}</span>
              <div class="grow">
                <b>{{ l.entity.code || '' }} {{ l.entity.title }}</b>
                <small>{{ linkLabel(l.linkType) }} · {{ l.direction === 'out' ? '指向' : '来自' }}</small>
              </div>
              <button v-if="canWrite" class="btn btn-sm btn-ghost" @click="unlink(l.linkId)"><AppIcon name="close" :size="13" /></button>
            </div>
            <div v-if="!links.length" class="hint">暂无关联对象。可关联需求、用例或其他工作项以建立追溯关系。</div>
          </div>

          <!-- 评论 -->
          <div class="hr"></div>
          <h4 class="drawer-sec">评论 ({{ comments.length }})</h4>
          <div class="feed">
            <div v-for="c in comments" :key="c.id" class="feed-item">
              <Avatar :user="data.userById(c.author)" />
              <div style="flex:1">
                <div class="txt"><b>{{ data.userById(c.author).name }}</b>
                  <span class="hint" style="margin-left:6px">{{ fromNow(c.createdAt) }}</span>
                </div>
                <div class="fs-13 mt-2" style="line-height:1.6">{{ c.content }}</div>
              </div>
              <button v-if="canDeleteComment(c)" class="btn btn-sm btn-ghost" @click="removeComment(c)">
                <AppIcon name="trash" :size="13" />
              </button>
            </div>
            <div v-if="!comments.length" class="hint">还没有评论</div>
          </div>
          <div class="flex gap-2 mt-3">
            <div class="search-input" style="flex:1">
              <AppIcon name="comment" :size="15" />
              <input class="input" v-model="commentText" placeholder="写下你的想法…" @keyup.enter="sendComment" />
            </div>
            <button class="btn btn-primary" :disabled="sending" @click="sendComment">
              <AppIcon name="send" :size="15" /> {{ sending ? '发送中…' : '发送' }}
            </button>
          </div>
        </div>
        <template #footer>
          <button class="btn" @click="itemDrawer = false">关闭</button>
          <button v-if="canWrite" class="btn btn-primary" @click="openItemDialog(currentItem); itemDrawer = false">
            <AppIcon name="edit" :size="15" /> 编辑
          </button>
        </template>
      </el-drawer>

      <!-- 建立关联 -->
      <el-dialog v-model="linkDialog" title="建立关联" width="520px">
        <el-form label-position="top">
          <el-form-item label="关联类型">
            <el-select v-model="linkForm.linkType" style="width:100%">
              <el-option label="implements（实现）" value="implements" />
              <el-option label="verifies（验证）" value="verifies" />
              <el-option label="relates（相关）" value="relates" />
            </el-select>
          </el-form-item>
          <el-form-item label="选择对象">
            <el-select v-model="linkForm.target" style="width:100%" filterable placeholder="选择要关联的需求 / 用例 / 工作项">
              <el-option-group v-for="g in linkCandidates" :key="g.label" :label="g.label">
                <el-option v-for="o in g.options" :key="o.value" :label="o.label" :value="o.value" />
              </el-option-group>
            </el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="linkDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="!linkForm.target || saving" @click="submitLink">建立关联</button>
        </template>
      </el-dialog>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()
    const route = useRoute()
    const router = useRouter()

    const projectId = computed(() => route.params.id || '')
    const project = computed(() => (projectId.value ? data.projectById(projectId.value) : null))
    const canWrite = computed(() => auth.canWrite('project'))

    const items = ref([])
    const loading = ref(false)
    const saving = ref(false)
    const tab = ref('kanban')
    const dragging = ref(null)
    const dragOver = ref('')
    const selected = ref([])
    const batchStatus = ref('')
    const batchAssignee = ref('')
    const projKeyword = ref('')
    const projStatus = ref('')
    /** 看板是否显示子任务（默认只显示顶层） */
    const showSubtasks = ref(false)

    const itemDialog = ref(false)
    const projectDialog = ref(false)
    const sprintDialog = ref(false)
    const itemDrawer = ref(false)
    const linkDialog = ref(false)
    const drawerLoading = ref(false)
    const formErrors = ref({})

    const itemForm = ref(blankItem())
    const projectForm = ref(blankProject())
    const sprintForm = ref(blankSprint())

    const currentItem = ref(null)
    const comments = ref([])
    const links = ref([])
    const commentText = ref('')
    const sending = ref(false)
    const linkForm = ref({ linkType: 'relates', target: '' })

    const sprints = computed(() => data.sprints.filter((s) => s.projectId === projectId.value))
    const openBugs = computed(() => items.value.filter((i) => i.type === '缺陷' && i.status !== '已完成').length)
    /** 故事点只统计顶层工作项，避免与子任务重复计算（与后端口径一致） */
    const totalPoints = computed(() =>
      topItems.value.reduce((a, b) => a + (b.points || 0), 0),
    )

    const filteredProjects = computed(() =>
      data.projects.filter((p) => {
        if (projStatus.value && p.status !== projStatus.value) return false
        const kw = projKeyword.value.trim().toLowerCase()
        if (kw && !(`${p.name} ${p.identifier}`.toLowerCase().includes(kw))) return false
        return true
      }),
    )

    const releases = computed(() => [
      { v: 'V2.0.0', date: project.value?.endDate, status: '规划中', desc: '流程引擎重构 + 新工作台' },
      { v: 'V1.9.0', date: '2026-09-11', status: '已发布', desc: '仪表盘部件与移动端优化' },
      { v: 'V1.8.0', date: '2026-08-02', status: '已发布', desc: '组织架构同步与 SSO' },
    ])

    const readiness = computed(() => {
      if (!items.value.length) return 0
      const done = items.value.filter((i) => i.status === '已完成').length
      return Math.max(0, Math.min(100, Math.round((done / items.value.length) * 100) - openBugs.value * 5))
    })

    const allowedNext = computed(() => {
      if (!currentItem.value) return []
      return TRANSITIONS[currentItem.value.status] || []
    })

    const linkCandidates = computed(() => {
      if (!currentItem.value) return []
      const curId = currentItem.value.id
      return [
        {
          label: '需求',
          options: data.requirements.map((r) => ({ label: `${r.code} ${r.title}`, value: `requirement:${r.id}` })),
        },
        {
          label: '测试用例',
          options: data.testCases.map((c) => ({ label: `${c.code} ${c.title}`, value: `test-case:${c.id}` })),
        },
        {
          label: '工作项',
          options: data.workItems
            .filter((w) => w.id !== curId)
            .map((w) => ({ label: `${w.code} ${w.title}`, value: `work-item:${w.id}` })),
        },
      ]
    })

    function blankItem() {
      return {
        id: '', title: '', type: '任务', priority: '中', status: '待处理',
        assignee: '', sprintId: '', parentId: '', points: 3,
        startDate: '', endDate: '', description: '',
      }
    }
    function blankProject() {
      return { name: '', identifier: '', type: 'Scrum', owner: '', productId: '', startDate: '', endDate: '', description: '' }
    }
    function blankSprint() {
      return { id: '', name: '', goal: '', startDate: '', endDate: '', status: '未开始' }
    }

    const itemCount = (pid) => data.workItems.filter((w) => w.projectId === pid).length
    const doneCount = (pid) => data.workItems.filter((w) => w.projectId === pid && w.status === '已完成').length

    /* ==================== 父子结构 ==================== */
    /** 顶层工作项（无 parentId） */
    const topItems = computed(() => items.value.filter((w) => !w.parentId))
    /** 子任务（有 parentId） */
    const subtaskItems = computed(() => items.value.filter((w) => !!w.parentId))
    const subtaskCount = computed(() => subtaskItems.value.length)

    const isSubtask = (w) => !!(w && w.parentId)
    const parentOf = (w) => (w && w.parentId ? data.workItems.find((x) => x.id === w.parentId) : null)
    const childrenOf = (id) => items.value.filter((w) => w.parentId === id)

    /** 子项汇总（本地计算，保证新增/删除后即时刷新） */
    const childStats = (id) => {
      const list = childrenOf(id)
      const done = list.filter((c) => c.status === '已完成').length
      return {
        total: list.length,
        done,
        pending: list.length - done,
        progress: list.length ? Math.round((done / list.length) * 100) : 0,
        points: list.reduce((a, c) => a + (c.points || 0), 0),
        allDone: list.length > 0 && done === list.length,
      }
    }

    /** 「子任务」类型不能再挂子项 —— 与后端校验保持一致 */
    const canHaveChildren = (w) => !!w && w.type !== '子任务'
    const blockedByChildren = computed(() => {
      const w = currentItem.value
      if (!w || w.status === '已完成') return false
      const s = childStats(w.id)
      return s.total > 0 && s.pending > 0
    })

    /** 可选的父项：同项目的顶层工作项，排除自身与已选中的子孙 */
    const parentCandidates = computed(() =>
      items.value.filter((w) => !w.parentId && w.id !== itemForm.value.id && w.type !== '子任务'),
    )

    /** 列表用树形数据：顶层 + 嵌套子项 */
    const treeRows = computed(() =>
      topItems.value.map((w) => ({ ...w, children: childrenOf(w.id) })),
    )

    /** 看板数据源：默认只显示顶层，可切换显示子任务 */
    const kanbanStage = (st) => {
      const src = showSubtasks.value ? items.value : topItems.value
      return src.filter((w) => w.status === st)
    }

    /** 统计口径统一按顶层（与项目进度、故事点一致） */
    const byStage = (st) => topItems.value.filter((w) => w.status === st)
    const sprintItems = (s) => items.value.filter((w) => w.sprintId === s.id && !w.parentId)
    const sprintDone = (s) => sprintItems(s).filter((w) => w.status === '已完成').length
    const sprintPoints = (s) => sprintItems(s).reduce((a, b) => a + (b.points || 0), 0)
    const sprintProgress = (s) => {
      const list = sprintItems(s)
      return list.length ? Math.round((sprintDone(s) / list.length) * 100) : 0
    }

    /* ==================== 详情视图 ==================== */
    const STAGE_COLORS = { 待处理: '#a3bdb7', 进行中: '#38bdf8', 待测试: '#8b7cf6', 已完成: '#23d3a9' }
    const donePoints = computed(() =>
      topItems.value.filter((w) => w.status === '已完成').reduce((a, w) => a + (w.points || 0), 0),
    )
    const stageDist = computed(() =>
      STAGES.map((s) => ({ label: s, value: byStage(s).length, color: STAGE_COLORS[s] })).filter((s) => s.value > 0),
    )
    const sprintDist = (s) =>
      STAGES.map((st) => ({
        label: st,
        value: sprintItems(s).filter((w) => w.status === st).length,
        color: STAGE_COLORS[st],
      })).filter((x) => x.value > 0)

    const itemRows = (list) =>
      list.map((w) => {
        const p = w.parentId ? data.workItems.find((x) => x.id === w.parentId) : null
        return {
          code: w.code, title: w.title, type: w.type, priority: w.priority,
          status: w.status, points: w.points,
          assignee: data.userById(w.assignee).name,
          sprint: data.sprintById(w.sprintId)?.name || '未分配',
          hierarchy: p ? `↳ ${p.code}` : '顶层',
          subtasks: childStats(w.id).total ? `${childStats(w.id).done}/${childStats(w.id).total}` : '—',
          endDate: fmtDate(w.endDate),
        }
      })
    const itemColumns = [
      { key: 'code', label: '编号', width: 105, type: 'mono' },
      { key: 'title', label: '标题', minWidth: 180 },
      { key: 'hierarchy', label: '层级', width: 95 },
      { key: 'type', label: '类型', width: 75 },
      { key: 'priority', label: '优先级', width: 80 },
      { key: 'status', label: '状态', width: 90 },
      { key: 'subtasks', label: '子项', width: 75, align: 'right' },
      { key: 'points', label: '点数', width: 65, align: 'right' },
    ]

    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null
      const projName = project.value?.name || ''

      switch (k) {
        case 'subtasks': {
          const parents = topItems.value.filter((w) => childStats(w.id).total > 0)
          const totalSubs = subtaskItems.value.length
          const doneSubs = subtaskItems.value.filter((w) => w.status === '已完成').length
          return {
            title: '子任务汇总',
            subtitle: `${totalSubs} 个子任务分布在 ${parents.length} 个父项下`,
            metrics: [
              { label: '子任务总数', value: totalSubs, unit: '项' },
              { label: '已完成', value: doneSubs, unit: '项' },
              { label: '完成率', value: pct(doneSubs, totalSubs), unit: '%' },
              { label: '有子项的父项', value: parents.length, unit: '个' },
              { label: '子任务点数', value: subtaskItems.value.reduce((a, w) => a + (w.points || 0), 0), unit: '点', hint: '不计入速率' },
              { label: '未拆解的父项', value: topItems.value.filter((w) => !childStats(w.id).total).length, unit: '个' },
            ],
            series: [
              {
                name: '各父项子任务完成进度',
                height: '260px',
                option: barOption({
                  items: parents.map((w) => ({ label: w.code, value: childStats(w.id).progress })),
                  unit: '%',
                }),
              },
              {
                name: '子任务状态分布',
                height: '220px',
                option: donutOption({
                  items: STAGES.map((s) => ({
                    label: s,
                    value: subtaskItems.value.filter((w) => w.status === s).length,
                    color: STAGE_COLORS[s],
                  })).filter((x) => x.value > 0),
                  centerLabel: '子任务',
                }),
              },
            ],
            desc:
              '子任务用于把较大的工作项**拆解为可独立指派、独立跟踪的最小单元**。\n\n' +
              '规则：\n' +
              '- 子任务必须与父项**同一项目**，且父项不能是子任务（最多两层）\n' +
              '- 父项在仍有未完成子项时**不允许关闭**\n' +
              '- 子任务的故事点**不计入项目速率**，避免与父项重复计算',
            table: {
              exportable: true,
              columns: [
                ...itemColumns,
                { key: 'assignee', label: '负责人', width: 95 },
              ],
              rows: itemRows(subtaskItems.value),
              empty: '该项目暂无子任务',
            },
            notes: ['将子任务从父项移出后，它会成为顶层工作项并开始计入进度统计。'],
          }
        }

        case 'items':
          return {
            title: '工作项总览',
            subtitle: `${projName} · 顶层 ${topItems.value.length} 项 + 子任务 ${subtaskCount.value} 项`,
            metrics: [
              { label: '顶层工作项', value: topItems.value.length, unit: '项' },
              { label: '子任务', value: subtaskCount.value, unit: '项' },
              { label: '已完成', value: byStage('已完成').length, unit: '项', hint: '按顶层计' },
              { label: '完成率', value: pct(byStage('已完成').length, topItems.value.length), unit: '%' },
              { label: '故事点', value: totalPoints.value, unit: '点', hint: '仅顶层' },
              { label: '缺陷数', value: items.value.filter((w) => w.type === '缺陷').length, unit: '个' },
            ],
            series: [
              { name: '阶段分布（顶层）', height: '250px', option: donutOption({ items: stageDist.value, centerLabel: '工作项' }) },
              {
                name: '子任务完成情况',
                height: '230px',
                option: barOption({
                  items: topItems.value
                    .filter((w) => childStats(w.id).total > 0)
                    .map((w) => ({ label: w.code.replace(/^[A-Z]+\d*-/, ''), value: childStats(w.id).progress })),
                  unit: '%',
                }),
              },
            ],
            desc:
              '工作项支持**父子两层结构**：\n\n' +
              '- 顶层工作项（任务 / 需求 / 缺陷）可挂若干**子任务**\n' +
              '- 子任务不能再挂子项（层级最多两层，由后端校验强制）\n\n' +
              '**统计口径**：项目进度与故事点**只统计顶层工作项**，避免父子重复计算；\n' +
              '父项的完成度由其子项完成情况汇总得出。',
            table: { exportable: true, columns: itemColumns, rows: itemRows(items.value) },
            notes: [
              '父项仍有未完成子项时不允许关闭（流转到「已完成」会被拒绝）。',
              '删除父项前需先删除或移出其子项。',
            ],
          }

        case 'done':
        case 'doing': {
          const status = k === 'done' ? '已完成' : '进行中'
          const list = byStage(status)
          return {
            title: `${status}工作项`,
            subtitle: `${projName} · ${list.length} 项`,
            metrics: [
              { label: '数量', value: list.length, unit: '项' },
              { label: '占比', value: pct(list.length, items.value.length), unit: '%' },
              { label: '故事点', value: list.reduce((a, w) => a + (w.points || 0), 0), unit: '点' },
              { label: '高优先级', value: list.filter((w) => ['高', '紧急'].includes(w.priority)).length, unit: '项' },
            ],
            chart: { height: '250px', option: barOption({ items: ['紧急', '高', '中', '低'].map((p) => ({ label: p, value: list.filter((w) => w.priority === p).length })), unit: ' 项' }) },
            desc: `筛选状态为「${status}」的工作项。`,
            table: { exportable: true, columns: [...itemColumns, { key: 'assignee', label: '负责人', width: 95 }], rows: itemRows(list), empty: `暂无${status}工作项` },
            notes: [],
          }
        }

        case 'points': {
          const byType = {}
          items.value.forEach((w) => { byType[w.type] = (byType[w.type] || 0) + (w.points || 0) })
          const byAssignee = {}
          items.value.filter((w) => w.status === '已完成').forEach((w) => {
            byAssignee[data.userById(w.assignee).name] = (byAssignee[data.userById(w.assignee).name] || 0) + (w.points || 0)
          })
          return {
            title: '故事点分布',
            subtitle: `${projName} · 共 ${totalPoints.value} 点`,
            metrics: [
              { label: '总故事点', value: totalPoints.value, unit: '点' },
              { label: '已完成', value: donePoints.value, unit: '点' },
              { label: '完成占比', value: pct(donePoints.value, totalPoints.value), unit: '%' },
              { label: '平均点数', value: items.value.length ? (totalPoints.value / items.value.length).toFixed(1) : 0, unit: '点/项' },
            ],
            series: [
              { name: '按类型', height: '240px', option: donutOption({ items: Object.keys(byType).map((t) => ({ label: t, value: byType[t] })), centerLabel: '故事点' }) },
              { name: '按成员（已完成）', height: '240px', option: barOption({ items: Object.keys(byAssignee).map((n) => ({ label: n, value: byAssignee[n] })), horizontal: true, unit: ' 点' }) },
            ],
            desc: '故事点用于估算工作量，与工时无关。已完成的点数计入团队交付速率。',
            table: {
              columns: [
                { key: 'type', label: '类型', width: 100 },
                { key: 'count', label: '工作项数', width: 100, align: 'right' },
                { key: 'points', label: '故事点', width: 100, align: 'right' },
                { key: 'done', label: '已完成点数', minWidth: 110, align: 'right' },
              ],
              rows: Object.keys(byType).map((t) => {
                const list = items.value.filter((w) => w.type === t)
                return {
                  type: t, count: list.length, points: byType[t],
                  done: list.filter((w) => w.status === '已完成').reduce((a, w) => a + (w.points || 0), 0),
                }
              }),
            },
            notes: [],
          }
        }

        case 'stage': {
          const list = byStage(arg)
          return {
            title: `看板列 · ${arg}`,
            subtitle: `${projName} · ${list.length} 项 · 点击卡片可打开工作项详情`,
            metrics: [
              { label: '数量', value: list.length, unit: '项' },
              { label: '占比', value: pct(list.length, items.value.length), unit: '%' },
              { label: '故事点', value: list.reduce((a, w) => a + (w.points || 0), 0), unit: '点' },
              { label: '可流转到', value: (TRANSITIONS[arg] || []).join(' / ') || '无（终态）', unit: '' },
            ],
            chart: {
              height: '240px',
              option: barOption({
                items: (TRANSITIONS[arg] || []).map((s) => ({ label: s, value: byStage(s).length })),
                unit: ' 项',
              }),
            },
            desc:
              `**状态机规则**：处于「${arg}」的工作项只能流转到 ${
                (TRANSITIONS[arg] || []).length ? '`' + (TRANSITIONS[arg] || []).join('` / `') + '`' : '（无，属终态）'
              }。\n\n` +
              '非法流转会被服务端拒绝（422），看板上不可投放的列会半透明化。',
            table: { exportable: true, columns: [...itemColumns, { key: 'assignee', label: '负责人', width: 95 }, { key: 'endDate', label: '截止', width: 105 }], rows: itemRows(list), empty: '该列暂无工作项' },
            notes: ['同一状态重复设置会被拒绝；已完成项如需返工，只能回到「进行中」。'],
          }
        }

        case 'sprint': {
          const s = sprints.value.find((x) => x.id === arg)
          if (!s) return null
          const list = sprintItems(s)
          return {
            title: `${s.name} · 迭代详情`,
            subtitle: `${s.goal || '未设置目标'} · ${fmtDate(s.startDate)} ~ ${fmtDate(s.endDate)}`,
            metrics: [
              { label: '工作项', value: list.length, unit: '项' },
              { label: '已完成', value: sprintDone(s), unit: '项' },
              { label: '进度', value: sprintProgress(s), unit: '%' },
              { label: '故事点', value: sprintPoints(s), unit: '点' },
              { label: '状态', value: s.status, unit: '' },
              { label: '未完成', value: list.length - sprintDone(s), unit: '项' },
            ],
            series: [
              { name: '阶段分布', height: '250px', option: donutOption({ items: sprintDist(s), centerLabel: '工作项' }) },
              { name: '迭代进度', height: '200px', option: gaugeOption({ value: sprintProgress(s), name: '完成进度', size: 220 }) },
            ],
            desc: '迭代是 Scrum 的交付周期。迭代结束时未完成的工作项需评估是否转移到下一迭代。',
            table: {
              exportable: true,
              columns: [...itemColumns, { key: 'assignee', label: '负责人', width: 95 }],
              rows: itemRows(list),
              empty: '该迭代暂无工作项',
            },
            notes: ['演示系统的迭代进度为实时计算；真实场景通常还会记录迭代快照用于燃尽图。'],
            actions: [{ key: 'editSprint', label: '编辑迭代', icon: 'edit', primary: true }],
          }
        }

        case 'release':
          return {
            title: '发布路线图',
            subtitle: `${projName} · ${releases.value.length} 个版本`,
            metrics: releases.value.map((r) => ({
              label: `${r.v}`,
              value: r.status,
              unit: '',
              hint: fmtDate(r.date),
            })),
            desc: '版本发布计划。就绪度由工作项完成率扣除阻塞缺陷影响得出。',
            table: {
              columns: [
                { key: 'v', label: '版本', width: 100 },
                { key: 'desc', label: '主要内容', minWidth: 200 },
                { key: 'date', label: '计划日期', width: 110 },
                { key: 'status', label: '状态', width: 90 },
              ],
              rows: releases.value.map((r) => ({ v: r.v, desc: r.desc, date: fmtDate(r.date), status: r.status })),
            },
            notes: ['演示版本数据为内置样本。'],
          }

        case 'readiness':
          return {
            title: '发布就绪度',
            subtitle: '完成率扣除阻塞缺陷惩罚后的综合得分',
            metrics: [
              { label: '就绪度', value: readiness.value, unit: '%' },
              { label: '完成率', value: pct(byStage('已完成').length, items.value.length), unit: '%' },
              { label: '阻塞缺陷', value: openBugs.value, unit: '个', hint: '每项扣 5 分' },
              { label: '待测试', value: byStage('待测试').length, unit: '项' },
            ],
            chart: { height: '280px', option: gaugeOption({ value: readiness.value, name: '版本就绪度', size: 260 }) },
            desc:
              '**计算公式**：`就绪度 = 完成率 − 未完成缺陷数 × 5`，并约束在 `[0, 100]` 区间。\n\n' +
              '这是为了在进度之外体现**质量风险**：即使完成率很高，只要还有阻塞缺陷，就不应视为可发布。',
            notes: ['该公式为演示规则，可在服务端按团队实际发布标准调整。'],
          }

        case 'quality':
          return {
            title: '质量与进度',
            subtitle: '阻塞项与阶段分布',
            metrics: [
              { label: '阻塞缺陷', value: openBugs.value, unit: '个' },
              { label: '缺陷总数', value: items.value.filter((w) => w.type === '缺陷').length, unit: '个' },
              { label: '待测试', value: byStage('待测试').length, unit: '项' },
              { label: '迭代数', value: sprints.value.length, unit: '个' },
            ],
            series: [
              { name: '阶段分布', height: '240px', option: donutOption({ items: stageDist.value, centerLabel: '工作项' }) },
              { name: '缺陷状态', height: '220px', option: barOption({ items: STAGES.map((s) => ({ label: s, value: items.value.filter((w) => w.type === '缺陷' && w.status === s).length })), unit: ' 个' }) },
            ],
            desc: '「待测试」积压是交付的常见卡点；缺陷若长期停留在「待处理」则说明修复资源不足。',
            table: {
              columns: itemColumns,
              rows: itemRows(items.value.filter((w) => w.type === '缺陷')),
              empty: '该项目暂无缺陷',
            },
            notes: ['缺陷可由「用例执行失败」按自动化规则自动创建。'],
          }

        default:
          return null
      }
    }

    function onDetailAction(key) {
      if (key === 'export') {
        const a = document.createElement('a')
        a.href = exportUrl('work-items', { projectId: projectId.value, pageSize: 500 })
        a.download = '工作项清单.csv'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else if (key === 'editSprint') {
        const s = sprints.value.find((x) => x.id === detailKey.value.split(':')[1])
        detailVisible.value = false
        if (s) openSprintDialog(s)
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)
    const commentCount = (id) => data.comments.filter((c) => c.targetType === 'work-item' && c.targetId === id).length
    const typeLabel = (t) => ({ requirement: '需求', 'work-item': '工作项', 'test-case': '用例' }[t] || t)
    const linkLabel = (t) => ({ implements: '实现', verifies: '验证', relates: '相关' }[t] || t)
    const canDeleteComment = (c) => auth.isAdmin || c.author === auth.userId

    /* ---------------- 数据加载 ---------------- */
    async function fetchItems() {
      if (!projectId.value) return
      loading.value = true
      try {
        const res = await data.query('work-items', { projectId: projectId.value, pageSize: 200 })
        items.value = res.list
        if (res.total > res.list.length) {
          ElMessage.warning(`该项目共有 ${res.total} 个工作项，当前仅加载前 ${res.list.length} 条`)
        }
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载工作项失败'))
        items.value = []
      } finally {
        loading.value = false
      }
    }

    /* ---------------- 看板拖拽（状态机约束） ---------------- */
    const draggingItem = computed(() => (dragging.value ? items.value.find((x) => x.id === dragging.value) : null))
    function canDropTo(status) {
      const w = draggingItem.value
      if (!w) return false
      if (w.status === status) return false
      return (TRANSITIONS[w.status] || []).includes(status)
    }

    function onDragStart(e, w) {
      if (!canWrite.value) {
        e.preventDefault()
        ElMessage.warning('当前角色没有项目操作权限')
        return
      }
      dragging.value = w.id
      e.dataTransfer.setData('text/plain', w.id)
      e.dataTransfer.effectAllowed = 'move'
    }
    function onDragOver(st) {
      const w = draggingItem.value
      dragOver.value = w && canDropTo(st) ? st : ''
    }
    function onDragEnd() {
      dragging.value = null
      dragOver.value = ''
    }

    async function onDrop(e, status) {
      e.preventDefault()
      const id = e.dataTransfer.getData('text/plain') || dragging.value
      const w = items.value.find((x) => x.id === id)
      const target = status
      dragOver.value = ''
      dragging.value = null
      if (!w || w.status === target) return
      if (!canDropTo2(w, target)) {
        ElMessage.warning(`不允许从「${w.status}」直接流转到「${target}」`)
        return
      }
      await applyStatus(w, target)
    }

    function canDropTo2(w, status) {
      return (TRANSITIONS[w.status] || []).includes(status)
    }

    async function applyStatus(w, status) {
      loading.value = true
      try {
        const res = await data.changeWorkItemStatus(w.id, status)
        const idx = items.value.findIndex((x) => x.id === w.id)
        if (idx >= 0) items.value.splice(idx, 1, res.item)
        if (currentItem.value && currentItem.value.id === w.id) {
          currentItem.value = res.item
        }
        ElMessage.success(`已移动到「${status}」`)
      } catch (err) {
        ElMessage.error(errorMessage(err, '状态更新失败'))
      } finally {
        loading.value = false
      }
    }

    /* ---------------- 工作项详情 ---------------- */
    async function openItemDrawer(w) {
      currentItem.value = data.workItems.find((x) => x.id === w.id) || w
      itemDrawer.value = true
      commentText.value = ''
      drawerLoading.value = true
      try {
        const [cm, lk] = await Promise.all([
          data.fetchComments('work-item', w.id),
          data.fetchLinks('work-item', w.id),
        ])
        comments.value = cm
        links.value = lk
      } catch (e) {
        ElMessage.error(errorMessage(e, '加载详情失败'))
        comments.value = []
        links.value = []
      } finally {
        drawerLoading.value = false
      }
    }

    async function changeStatus(status) {
      if (!currentItem.value) return
      await applyStatus(currentItem.value, status)
    }

    async function sendComment() {
      const v = commentText.value.trim()
      if (!v) {
        ElMessage.warning('请输入评论内容')
        return
      }
      sending.value = true
      try {
        const c = await data.postComment('work-item', currentItem.value.id, v)
        comments.value.push(c)
        commentText.value = ''
        ElMessage.success('评论已发表')
      } catch (e) {
        ElMessage.error(errorMessage(e, '评论失败'))
      } finally {
        sending.value = false
      }
    }

    async function removeComment(c) {
      try {
        await data.deleteComment(c.id)
        comments.value = comments.value.filter((x) => x.id !== c.id)
        ElMessage.success('评论已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    async function submitLink() {
      const [type, id] = linkForm.value.target.split(':')
      saving.value = true
      try {
        await data.createLink({
          sourceType: 'work-item',
          sourceId: currentItem.value.id,
          targetType: type,
          targetId: id,
          linkType: linkForm.value.linkType,
        })
        links.value = await data.fetchLinks('work-item', currentItem.value.id)
        linkDialog.value = false
        linkForm.value.target = ''
        ElMessage.success('关联已建立')
      } catch (e) {
        ElMessage.error(errorMessage(e, '建立关联失败'))
      } finally {
        saving.value = false
      }
    }

    async function unlink(linkId) {
      try {
        await data.deleteLink(linkId)
        links.value = links.value.filter((l) => l.linkId !== linkId)
        ElMessage.success('关联已解除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '解除失败'))
      }
    }

    /* ---------------- 工作项 CRUD ---------------- */
    function openItemDialog(row) {
      formErrors.value = {}
      itemForm.value = row
        ? { ...blankItem(), ...row, parentId: row.parentId || '' }
        : { ...blankItem(), assignee: data.users[0]?.id || '', sprintId: sprints.value[0]?.id || '' }
      itemDialog.value = true
    }

    /** 为某工作项添加子项：预填父项并默认类型为「子任务」 */
    function addChild(parent) {
      formErrors.value = {}
      itemForm.value = {
        ...blankItem(),
        parentId: parent.id,
        type: '子任务',
        sprintId: parent.sprintId || '',
        assignee: parent.assignee || data.users[0]?.id || '',
        startDate: parent.startDate || '',
        endDate: parent.endDate || '',
        points: 2,
      }
      itemDialog.value = true
    }

    /** 把子任务从父项下移出（变为顶层工作项） */
    async function detachChild(child) {
      try {
        await ElMessageBox.confirm(`确定将「${child.title}」从父项下移出？移出后它将成为顶层工作项。`, '移出子项', {
          type: 'warning', confirmButtonText: '移出', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        const updated = await data.edit('work-items', child.id, { parentId: null })
        const idx = items.value.findIndex((x) => x.id === child.id)
        if (idx >= 0) items.value.splice(idx, 1, updated)
        if (currentItem.value && currentItem.value.id === child.id) currentItem.value = updated
        ElMessage.success('已移出子项')
      } catch (e) {
        ElMessage.error(errorMessage(e, '移出失败'))
      }
    }

    async function saveItem() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = itemForm.value
        const payload = {
          title: f.title, projectId: projectId.value, sprintId: f.sprintId || null,
          parentId: f.parentId || null,
          type: f.type, priority: f.priority, status: f.status, assignee: f.assignee,
          points: Number(f.points), startDate: f.startDate || null, endDate: f.endDate || null,
          description: f.description || '',
        }
        if (f.id) await data.edit('work-items', f.id, payload)
        else await data.save('work-items', payload)
        ElMessage.success(f.id ? '工作项已更新' : '工作项已创建')
        itemDialog.value = false
        fetchItems()
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function removeItem(row) {
      try {
        await ElMessageBox.confirm(`确定删除工作项「${row.title}」？关联关系与评论将一并清理。`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.destroy('work-items', row.id)
        ElMessage.success('已删除')
        fetchItems()
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    /* ---------------- 批量操作 ---------------- */
    function onSelect(rows) {
      selected.value = rows.map((r) => r.id)
    }

    async function doBatchUpdate() {
      const patch = {}
      if (batchStatus.value) patch.status = batchStatus.value
      if (batchAssignee.value) patch.assignee = batchAssignee.value
      saving.value = true
      try {
        const res = await data.batchUpdate('work-items', selected.value, patch)
        ElMessage.success(`批量更新完成：成功 ${res.success} 条，失败 ${res.failed} 条`)
        if (res.failures?.length) {
          ElMessage.warning(`首条失败原因：${res.failures[0].message}`)
        }
        batchStatus.value = ''
        batchAssignee.value = ''
        selected.value = []
        fetchItems()
      } catch (e) {
        ElMessage.error(errorMessage(e, '批量更新失败'))
      } finally {
        saving.value = false
      }
    }

    async function doBatchDelete() {
      try {
        await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 个工作项？`, '批量删除', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      saving.value = true
      try {
        // 子项必须先于父项删除，否则父项会因"仍有子项"被拒。
        // 这里把有 parentId 的排在前面，让一次批量删除即可成功。
        const ordered = [...selected.value].sort((a, b) => {
          const wa = items.value.find((x) => x.id === a)
          const wb = items.value.find((x) => x.id === b)
          return (wb && wb.parentId ? 1 : 0) - (wa && wa.parentId ? 1 : 0)
        })
        const res = await data.batchDelete('work-items', ordered)
        ElMessage.success(`删除完成：成功 ${res.success} 条，失败 ${res.failed} 条`)
        if (res.failures?.length) ElMessage.warning(`首条失败原因：${res.failures[0].message}`)
        selected.value = []
        fetchItems()
      } catch (e) {
        ElMessage.error(errorMessage(e, '批量删除失败'))
      } finally {
        saving.value = false
      }
    }

    /* ---------------- 项目 / 迭代 ---------------- */
    function openProjectDialog() {
      formErrors.value = {}
      projectForm.value = { ...blankProject(), owner: data.users[0]?.id || '', productId: data.products[0]?.id || '' }
      projectDialog.value = true
    }

    async function saveProject() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = projectForm.value
        const created = await data.save('projects', {
          name: f.name, identifier: f.identifier, type: f.type, owner: f.owner,
          productId: f.productId || null, startDate: f.startDate || null, endDate: f.endDate || null,
          description: f.description || '', status: '进行中', progress: 0, members: [f.owner],
        })
        ElMessage.success('项目已创建')
        projectDialog.value = false
        router.push('/project/' + created.id)
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '创建失败'))
      } finally {
        saving.value = false
      }
    }

    function openSprintDialog(s) {
      formErrors.value = {}
      sprintForm.value = s
        ? { ...blankSprint(), ...s }
        : { ...blankSprint(), startDate: new Date().toISOString().slice(0, 10) }
      sprintDialog.value = true
    }

    async function saveSprint() {
      formErrors.value = {}
      saving.value = true
      try {
        const f = sprintForm.value
        const payload = {
          name: f.name, projectId: projectId.value, goal: f.goal || '',
          startDate: f.startDate || null, endDate: f.endDate || null, status: f.status,
        }
        if (f.id) await data.edit('sprints', f.id, payload)
        else await data.save('sprints', payload)
        ElMessage.success(f.id ? '迭代已更新' : '迭代已创建')
        sprintDialog.value = false
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '保存失败'))
      } finally {
        saving.value = false
      }
    }

    async function copySprint(s) {
      try {
        await data.save('sprints', {
          name: s.name + '（副本）', projectId: s.projectId, goal: s.goal,
          startDate: s.endDate, endDate: s.endDate, status: '未开始',
        })
        ElMessage.success('迭代已复制')
      } catch (e) {
        ElMessage.error(errorMessage(e, '复制失败'))
      }
    }

    async function removeSprint(s) {
      try {
        await ElMessageBox.confirm(`确定删除迭代「${s.name}」？`, '删除确认', {
          type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
        })
      } catch (e) { return }
      try {
        await data.destroy('sprints', s.id)
        ElMessage.success('已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    /* ---------------- 导出 ---------------- */
    function download(url, name) {
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      ElMessage.success('已开始下载')
    }

    function exportItems() {
      download(exportUrl('work-items', { projectId: projectId.value, pageSize: 500 }), '工作项清单.csv')
    }
    function exportList() {
      download(exportUrl('projects', { pageSize: 500 }), '项目清单.csv')
    }

    onMounted(() => { if (projectId.value) fetchItems() })
    watch(() => route.params.id, (id) => {
      items.value = []
      selected.value = []
      if (id) fetchItems()
    })

    return {
      data, auth, route, projectId, project, canWrite,
      items, loading, saving, tab, dragging, draggingItem, dragOver, selected,
      batchStatus, batchAssignee, projKeyword, projStatus, showSubtasks,
      itemDialog, projectDialog, sprintDialog, itemDrawer, linkDialog, drawerLoading,
      formErrors, itemForm, projectForm, sprintForm,
      currentItem, comments, links, commentText, sending, linkForm, linkCandidates,
      sprints, releases, readiness, openBugs, totalPoints, donePoints, filteredProjects, allowedNext,
      stageDist, sprintDist,
      topItems, subtaskItems, subtaskCount, isSubtask, parentOf, childrenOf, childStats,
      canHaveChildren, blockedByChildren, parentCandidates, treeRows, kanbanStage,
      addChild, detachChild,
      STAGES, TYPES, PRIORITIES,
      itemCount, doneCount, byStage, sprintItems, sprintDone, sprintPoints, sprintProgress,
      commentCount, typeLabel, linkLabel, canDeleteComment,
      fetchItems, canDropTo, onDragStart, onDragOver, onDragEnd, onDrop,
      openItemDrawer, changeStatus, sendComment, removeComment, submitLink, unlink,
      openItemDialog, saveItem, removeItem, onSelect, doBatchUpdate, doBatchDelete,
      openProjectDialog, saveProject, openSprintDialog, saveSprint, copySprint, removeSprint,
      exportItems, exportList,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction, pct,
      fmtDate, fromNow, statusKind, priorityColor, stageColor,
    }
  },
}
