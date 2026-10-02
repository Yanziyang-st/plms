import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, Avatar, EmptyState } from '../components/ui.js'
import { Donut, BarChart } from '../components/charts.js'
import PanelCard from '../components/PanelCard.js'
import DetailDrawer from '../components/DetailDrawer.js'
import { useDataStore } from '../stores/data.js'
import { useAuthStore } from '../stores/auth.js'
import { errorMessage } from '../api/request.js'
import { fromNow, fmtDateTime } from '../utils/format.js'
import { donutOption, barOption } from '../utils/chartOptions.js'
import { useDetail } from '../utils/useDetail.js'

export default {
  name: 'CollabView',
  components: { AppIcon, PageHeader, Avatar, EmptyState, Donut, BarChart, PanelCard, DetailDrawer },
  template: `
    <div>
      <PageHeader title="协作空间" description="围绕话题开展讨论，让信息传播更快捷、决策留痕更完整">
        <template #actions>
          <button class="btn btn-primary" @click="openTopicDialog"><AppIcon name="plus" :size="16" /> 发起话题</button>
        </template>
      </PageHeader>

      <div class="grid g-2-1">
        <div>
          <div v-for="t in data.topics" :key="t.id" class="card card-pad mb-3" style="cursor:pointer" @click="openTopic(t)">
            <div class="flex items-center gap-2 mb-3">
              <Avatar :user="data.userById(t.author)" />
              <div style="flex:1">
                <b style="font-size:14.5px">{{ t.title }}</b>
                <div class="fs-12 text-3">{{ data.userById(t.author).name }} · {{ fromNow(t.createdAt) }}</div>
              </div>
              <span v-for="tag in (t.tags || [])" :key="tag" class="badge indigo">{{ tag }}</span>
            </div>
            <p class="fs-13 text-2" style="line-height:1.65">{{ t.content }}</p>
            <div class="flex items-center gap-3 mt-3">
              <span class="chip"><AppIcon name="comment" :size="13" /> {{ (t.comments || []).length }} 条讨论</span>
              <span class="chip"><AppIcon name="users" :size="13" /> {{ participantCount(t) }} 人参与</span>
            </div>
          </div>
          <EmptyState v-if="!data.topics.length" title="暂无话题" description="点击右上角发起第一个话题" icon="collab" />
        </div>

        <div style="display:flex;flex-direction:column;gap:18px">
          <PanelCard title="话题统计" :subtitle="data.topics.length + ' 个话题'" clickable footer-hint
                     @detail="openDetail('topicStats')">
            <div class="flex mb-3" style="justify-content:space-between;font-size:13px">
              <span class="text-3">话题总数</span><b>{{ data.topics.length }}</b>
            </div>
            <div class="flex mb-3" style="justify-content:space-between;font-size:13px">
              <span class="text-3">讨论总数</span><b>{{ totalComments }}</b>
            </div>
            <div class="flex mb-3" style="justify-content:space-between;font-size:13px">
              <span class="text-3">参与人数</span><b>{{ authors.length }}</b>
            </div>
            <Donut :items="topicDist" center-label="讨论" :size="210" interactive
                   @chart-click="(p) => openDetail('topic:' + p.name)" />
          </PanelCard>

          <PanelCard title="活跃成员" subtitle="按参与话题数排序" clickable footer-hint
                     @detail="openDetail('activeMembers')">
            <div v-for="u in activeMembers.slice(0, 6)" :key="u.id" class="list-row">
              <Avatar :user="u" />
              <div class="grow"><b>{{ u.name }}</b><small>{{ u.role }} · 参与 {{ u.count }} 个话题</small></div>
              <span class="badge green"><AppIcon name="sparkles" :size="11" /> 活跃</span>
            </div>
          </PanelCard>

          <PanelCard title="热度排行" subtitle="按讨论条数排序" clickable footer-hint
                     @detail="openDetail('hotTopics')">
            <BarChart :items="hotTopics" :height="190" horizontal unit=" 条" />
          </PanelCard>
        </div>
      </div>

      <!-- 话题详情 -->
      <el-drawer v-model="topicDrawer" size="640px" :title="current?.title || ''">
        <div v-if="current">
          <div class="flex items-center gap-2 mb-3">
            <span v-for="tag in (current.tags || [])" :key="tag" class="badge indigo">{{ tag }}</span>
            <span class="hint">{{ data.userById(current.author).name }} 发起于 {{ fmtDateTime(current.createdAt) }}</span>
          </div>
          <p class="fs-13" style="line-height:1.75;color:var(--ink-2)">{{ current.content }}</p>
          <div class="hr"></div>
          <h4 style="font-weight:700;margin-bottom:12px">讨论 ({{ (current.comments || []).length }})</h4>
          <div class="feed">
            <div v-for="c in current.comments || []" :key="c.id" class="feed-item">
              <Avatar :user="data.userById(c.author)" />
              <div style="flex:1">
                <div class="txt"><b>{{ data.userById(c.author).name }}</b></div>
                <div class="fs-13 mt-2" style="line-height:1.6">{{ c.content }}</div>
                <div class="time">{{ fromNow(c.createdAt) }}</div>
              </div>
              <button v-if="canDelete(c)" class="btn btn-sm btn-ghost" title="删除"
                      @click="removeComment(c)"><AppIcon name="trash" :size="13" /></button>
            </div>
            <div v-if="!(current.comments || []).length" class="hint">还没有人发言，来抢沙发吧～</div>
          </div>
        </div>
        <template #footer>
          <div class="search-input" style="flex:1">
            <AppIcon name="comment" :size="16" />
            <input class="input" v-model="commentText" placeholder="写下你的观点…" @keyup.enter="sendComment" />
          </div>
          <button class="btn btn-primary" :disabled="sending" @click="sendComment">
            <AppIcon name="send" :size="15" /> {{ sending ? '发送中…' : '发送' }}
          </button>
        </template>
      </el-drawer>

      <!-- 发起话题 -->
      <el-dialog v-model="topicDialog" title="发起话题" width="560px">
        <el-form label-position="top">
          <el-form-item label="话题标题" :error="formErrors.title" required>
            <el-input v-model="topicForm.title" placeholder="一句话描述讨论主题" />
          </el-form-item>
          <el-form-item label="标签（逗号分隔）">
            <el-input v-model="topicForm.tags" placeholder="讨论, 决策" />
          </el-form-item>
          <el-form-item label="内容">
            <el-input v-model="topicForm.content" type="textarea" :rows="5" placeholder="补充背景信息，便于成员快速参与" />
          </el-form-item>
        </el-form>
        <template #footer>
          <button class="btn" @click="topicDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveTopic">{{ saving ? '发布中…' : '发布' }}</button>
        </template>
      </el-dialog>

      <DetailDrawer v-model="detailVisible" :detail="detailConfig" @action="onDetailAction" />
    </div>
  `,
  setup() {
    const data = useDataStore()
    const auth = useAuthStore()

    const topicDrawer = ref(false)
    const topicDialog = ref(false)
    const current = ref(null)
    const commentText = ref('')
    const sending = ref(false)
    const saving = ref(false)
    const formErrors = ref({})
    const topicForm = ref({ title: '', tags: '讨论', content: '' })

    const totalComments = computed(() => data.topics.reduce((a, t) => a + (t.comments || []).length, 0))
    const authors = computed(() => {
      const set = new Set()
      data.topics.forEach((t) => {
        set.add(t.author)
        ;(t.comments || []).forEach((c) => set.add(c.author))
      })
      return [...set]
    })

    const participantCount = (t) => new Set([t.author, ...(t.comments || []).map((c) => c.author)]).size

    const canDelete = (c) => auth.isAdmin || c.author === auth.userId

    /* ==================== 详情派生 ==================== */
    const topicDist = computed(() =>
      data.topics.map((t, i) => ({
        label: t.title.length > 6 ? t.title.slice(0, 6) + '…' : t.title,
        value: (t.comments || []).length,
        color: ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#ff7a6b'][i % 5],
      })),
    )

    const hotTopics = computed(() =>
      [...data.topics]
        .map((t) => ({ label: t.title.length > 8 ? t.title.slice(0, 8) + '…' : t.title, value: (t.comments || []).length }))
        .sort((a, b) => b.value - a.value),
    )

    const activeMembers = computed(() =>
      data.users
        .map((u) => ({
          ...u,
          count: data.topics.filter(
            (t) => t.author === u.id || (t.comments || []).some((c) => c.author === u.id),
          ).length,
        }))
        .sort((a, b) => b.count - a.count),
    )

    function buildDetail(key) {
      const k = key.includes(':') ? key.split(':')[0] : key
      const arg = key.includes(':') ? key.split(':').slice(1).join(':') : null

      switch (k) {
        case 'topicStats':
          return {
            title: '话题统计',
            subtitle: `${data.topics.length} 个话题 · ${totalComments.value} 条讨论 · ${authors.value.length} 人参与`,
            metrics: [
              { label: '话题总数', value: data.topics.length, unit: '个' },
              { label: '讨论总数', value: totalComments.value, unit: '条' },
              { label: '参与人数', value: authors.value.length, unit: '人' },
              { label: '人均讨论', value: authors.value.length ? (totalComments.value / authors.value.length).toFixed(1) : 0, unit: '条' },
              { label: '零讨论话题', value: data.topics.filter((t) => !(t.comments || []).length).length, unit: '个' },
              { label: '讨论最热', value: Math.max(0, ...data.topics.map((t) => (t.comments || []).length)), unit: '条' },
            ],
            series: [
              { name: '各话题讨论数', height: '250px', option: donutOption({ items: topicDist.value, centerLabel: '讨论' }) },
              { name: '热度排行', height: '230px', option: barOption({ items: hotTopics.value, horizontal: true, unit: ' 条' }) },
            ],
            desc:
              '协作空间用于沉淀决策过程与知识。\n\n' +
              '**零讨论话题**值得关注 —— 通常意味着发起后没人跟进，或议题未被有效传达。',
            table: {
              columns: [
                { key: 'title', label: '话题', minWidth: 200 },
                { key: 'author', label: '发起人', width: 100 },
                { key: 'comments', label: '讨论数', width: 90, align: 'right' },
                { key: 'participants', label: '参与人数', width: 100, align: 'right' },
                { key: 'created', label: '发起时间', width: 120 },
              ],
              rows: data.topics.map((t) => ({
                title: t.title,
                author: data.userById(t.author).name,
                comments: (t.comments || []).length,
                participants: participantCount(t),
                created: fromNow(t.createdAt),
              })),
            },
            notes: ['点击环形图扇区可查看该话题的讨论明细。'],
          }

        case 'topic': {
          const t = data.topics.find(
            (x) => x.title.startsWith(arg.replace('…', '')) || x.id === arg,
          )
          if (!t) return null
          const cs = t.comments || []
          return {
            title: `${t.title} · 讨论明细`,
            subtitle: `${data.userById(t.author).name} 发起于 ${fmtDateTime(t.createdAt)}`,
            metrics: [
              { label: '讨论数', value: cs.length, unit: '条' },
              { label: '参与人数', value: participantCount(t), unit: '人' },
              { label: '标签', value: (t.tags || []).join(' / ') || '无', unit: '' },
            ],
            desc: `${t.content || ''}\n\n---\n\n**讨论记录**（共 ${cs.length} 条）`,
            table: {
              columns: [
                { key: 'author', label: '发言人', width: 110 },
                { key: 'content', label: '内容', minWidth: 300 },
                { key: 'time', label: '时间', width: 110 },
              ],
              rows: cs.map((c) => ({
                author: data.userById(c.author).name,
                content: c.content,
                time: fromNow(c.createdAt),
              })),
              empty: '该话题暂无讨论',
            },
            notes: ['评论遵循「仅作者本人或管理员可删除」的规则。'],
            actions: [{ key: 'openTopic', label: '打开话题', icon: 'comment', primary: true }],
          }
        }

        case 'activeMembers':
          return {
            title: '活跃成员',
            subtitle: '按参与话题数排序',
            metrics: activeMembers.value.slice(0, 6).map((u) => ({
              label: u.name, value: u.count, unit: ' 个话题', hint: u.role,
            })),
            chart: {
              height: '280px',
              option: barOption({
                items: activeMembers.value.slice(0, 8).map((u) => ({ label: u.name, value: u.count })),
                horizontal: true, unit: ' 个',
              }),
            },
            desc: '参与度 = 作为话题发起人或发表过讨论的话题数量。',
            table: {
              columns: [
                { key: 'name', label: '成员', width: 110 },
                { key: 'role', label: '角色', width: 130 },
                { key: 'dept', label: '部门', width: 120 },
                { key: 'count', label: '参与话题', width: 100, align: 'right' },
              ],
              rows: activeMembers.value.map((u) => ({
                name: u.name, role: u.role, dept: u.dept, count: u.count,
              })),
            },
            notes: ['仅统计协作空间内的话题与讨论，不含工作项评论。'],
          }

        case 'hotTopics':
          return {
            title: '话题热度排行',
            subtitle: '按讨论条数排序',
            chart: { height: '300px', option: barOption({ items: hotTopics.value, horizontal: true, unit: ' 条' }) },
            desc: '讨论数多的话题通常涉及跨团队决策或存在争议，建议关注其结论是否已落地。',
            table: {
              columns: [
                { key: 'title', label: '话题', minWidth: 220 },
                { key: 'comments', label: '讨论数', width: 100, align: 'right' },
                { key: 'participants', label: '参与人数', width: 110, align: 'right' },
              ],
              rows: data.topics.map((t) => ({
                title: t.title,
                comments: (t.comments || []).length,
                participants: participantCount(t),
              })),
            },
            notes: [],
          }

        default:
          return null
      }
    }

    function onDetailAction(key) {
      if (key === 'openTopic') {
        const t = data.topics.find((x) => x.title.startsWith(String(detailKey.value).split(':').slice(1).join(':').replace('…', '')))
        detailVisible.value = false
        if (t) openTopic(t)
      }
    }

    const { detailVisible, detailKey, detailConfig, openDetail } = useDetail(buildDetail)

    async function removeComment(c) {
      try {
        await data.deleteComment(c.id)
        current.value = data.topics.find((x) => x.id === current.value.id) || current.value
        ElMessage.success('评论已删除')
      } catch (e) {
        ElMessage.error(errorMessage(e, '删除失败'))
      }
    }

    function openTopic(t) {
      current.value = data.topics.find((x) => x.id === t.id) || t
      commentText.value = ''
      topicDrawer.value = true
    }

    async function sendComment() {
      const v = commentText.value.trim()
      if (!v) {
        ElMessage.warning('请输入讨论内容')
        return
      }
      sending.value = true
      try {
        await data.postComment('topic', current.value.id, v)
        current.value = data.topics.find((x) => x.id === current.value.id) || current.value
        commentText.value = ''
        ElMessage.success('已发布讨论')
      } catch (e) {
        ElMessage.error(errorMessage(e, '发布失败'))
      } finally {
        sending.value = false
      }
    }

    function openTopicDialog() {
      formErrors.value = {}
      topicForm.value = { title: '', tags: '讨论', content: '' }
      topicDialog.value = true
    }

    async function saveTopic() {
      formErrors.value = {}
      saving.value = true
      try {
        await data.save('topics', {
          title: topicForm.value.title.trim(),
          content: topicForm.value.content,
          tags: topicForm.value.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          author: data.users[0]?.id,
        })
        ElMessage.success('话题已发布')
        topicDialog.value = false
      } catch (e) {
        formErrors.value = e.errors ? Object.fromEntries(e.errors.map((x) => [x.field, x.message])) : {}
        ElMessage.error(errorMessage(e, '发布失败'))
      } finally {
        saving.value = false
      }
    }

    return {
      data, auth, topicDrawer, topicDialog, current, commentText, sending, saving, formErrors, topicForm,
      totalComments, authors, participantCount, canDelete,
      topicDist, hotTopics, activeMembers,
      openTopic, sendComment, removeComment, openTopicDialog, saveTopic,
      detailVisible, detailKey, detailConfig, openDetail, onDetailAction,
      fromNow, fmtDateTime,
    }
  },
}
