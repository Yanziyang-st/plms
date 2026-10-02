import { ref, computed, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'

import AppIcon from '../components/AppIcon.js'
import { PageHeader, Avatar, Markdown, EmptyState } from '../components/ui.js'
import { useDataStore } from '../stores/data.js'
import { renderMarkdown } from '../utils/format.js'

export default {
  name: 'AiView',
  components: { AppIcon, PageHeader, Avatar, Markdown, EmptyState },
  template: `
    <div>
      <PageHeader title="智能协同" description="六类精通软件工程方法论的核心智能体，覆盖需求、设计、开发、测试、管理、协作">
        <template #actions>
          <span class="chip"><AppIcon name="sparkles" :size="14" /> AI 能力已就绪</span>
        </template>
      </PageHeader>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'agents' }" @click="tab = 'agents'">智能体管理</button>
        <button class="tab" :class="{ active: tab === 'chat' }" @click="tab = 'chat'">AI 助手</button>
      </div>

      <!-- 智能体 -->
      <template v-if="tab === 'agents'">
        <div class="grid g-3">
          <div v-for="a in data.agents" :key="a.id" class="agent-card" @click="startChat(a)">
            <div class="agent-ico" :style="{ background: a.color + '1f', color: a.color }">{{ a.emoji }}</div>
            <div class="flex items-center gap-2 mb-3">
              <b style="font-size:15px">{{ a.name }}</b>
              <span class="badge indigo" style="margin-left:auto">{{ a.role }}</span>
            </div>
            <p class="fs-13 text-2" style="line-height:1.65;min-height:60px">{{ a.description }}</p>
            <div class="flex gap-2 wrap mt-2">
              <span v-for="s in a.skills || []" :key="s" class="tag fs-12">{{ s }}</span>
            </div>
            <button class="btn btn-primary btn-block mt-3"><AppIcon name="comment" :size="15" /> 与 {{ a.name }} 对话</button>
          </div>
          <EmptyState v-if="!data.agents.length" title="暂无智能体" icon="ai" />
        </div>

        <div class="card mt-4">
          <div class="card-head"><h3>能力说明</h3></div>
          <div class="card-pad">
            <Markdown :content="capabilityText" />
          </div>
        </div>
      </template>

      <!-- 对话 -->
      <div v-else class="grid g-1-2">
        <div class="card">
          <div class="card-head"><h3>选择智能体</h3></div>
          <div class="card-pad" style="padding:8px;max-height:60vh;overflow:auto">
            <div v-for="a in data.agents" :key="a.id" class="list-row"
                 :style="a.id === activeId ? 'background:var(--mint-50);border-color:var(--mint-200)' : ''"
                 @click="startChat(a)">
              <span :style="{ width:'34px', height:'34px', borderRadius:'11px', display:'grid', placeItems:'center', fontSize:'17px', background: a.color + '1f' }">
                {{ a.emoji }}
              </span>
              <div class="grow"><b>{{ a.name }}</b><small>{{ a.role }} · {{ (a.skills||[]).length }} 项能力</small></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <span :style="{ width:'32px', height:'32px', borderRadius:'10px', display:'grid', placeItems:'center', fontSize:'16px', background: (active?.color||'#23d3a9') + '1f' }">
              {{ active?.emoji }}
            </span>
            <div><h3>{{ active?.name }}</h3><span class="sub">{{ active?.role }} 智能体 · 在线</span></div>
            <div class="right">
              <button class="btn btn-sm btn-ghost" @click="clearChat"><AppIcon name="refresh" :size="14" /> 清空</button>
            </div>
          </div>

          <div class="chat">
            <div class="chat-scroll" ref="scrollEl">
              <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role === 'me' ? 'me' : 'ai'">
                <Avatar v-if="m.role === 'me'" :user="{ name: '我', color: '#13a884' }" />
                <span v-else :style="{ width:'32px', height:'32px', borderRadius:'10px', display:'grid', placeItems:'center', fontSize:'16px', background: (active?.color||'#23d3a9') + '1f', flexShrink:0 }">
                  {{ active?.emoji }}
                </span>
                <div class="bubble">
                  <span v-if="m.role === 'me'">{{ m.text }}</span>
                  <span v-else v-html="renderMarkdown(m.text)"></span>
                </div>
              </div>
            </div>

            <div class="suggest">
              <button v-for="s in suggests" :key="s" @click="input = s; $refs.ta?.focus()">{{ s }}</button>
            </div>

            <div class="chat-input">
              <textarea ref="ta" v-model="input" :placeholder="'向 ' + (active?.name || '') + ' 描述你的任务…（Enter 发送，Shift+Enter 换行）'"
                        @keydown.enter.exact.prevent="send"></textarea>
              <button class="btn btn-primary" @click="send"><AppIcon name="send" :size="16" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  setup() {
    const data = useDataStore()

    const tab = ref('agents')
    const activeId = ref('')
    const input = ref('')
    const messages = ref([])
    const scrollEl = ref(null)
    const ta = ref(null)

    const active = computed(() => data.agents.find((a) => a.id === activeId.value) || data.agents[0] || null)

    const suggests = computed(() => {
      const map = {
        需求: ['拆解「多级流程审批」需求并给出验收标准', '为工作台仪表盘需求排优先级'],
        设计: ['为审批流程引擎给出技术选型建议', '设计需求与工作项的领域模型'],
        开发: ['为流程节点分支生成实现思路与单测', '分析缺陷的可能根因'],
        测试: ['为多级审批用例补充边界场景', '生成 V2.0 回归测试报告摘要'],
        管理: ['总结本期迭代进展与风险', '生成今日站会纪要'],
        协作: ['把这次讨论整理成规范文档', '为产品知识库规划目录结构'],
      }
      return map[active.value?.role] || ['帮我梳理当前项目的进展', '有哪些高优先级待办？']
    })

    const capabilityText = `智能体可调用系统中的**需求、工作项、测试用例、知识文档**等数据，结合大模型完成分析、生成与建议。

智能体之间支持协作：由「项目经理」统筹，联动「需求分析师 → 架构设计师 → 开发工程师 → 测试工程师」完成端到端研发流程闭环。

> 当前版本为演示实现，对话回复由本地规则引擎生成；接入真实大模型时，只需替换 \`respond()\` 中的数据来源即可，前端交互无需改动。`

    function startChat(agent) {
      if (activeId.value !== agent.id) {
        activeId.value = agent.id
        messages.value = []
      }
      tab.value = 'chat'
      if (!messages.value.length) {
        messages.value.push({ role: 'ai', text: greeting(agent) })
      }
      scrollToBottom()
    }

    function greeting(a) {
      return `你好，我是 **${a.name}**（${a.role}）。${a.description}\n\n你可以让我处理与「${(a.skills || []).join('、')}」相关的工作，例如：`
    }

    function clearChat() {
      messages.value = active.value ? [{ role: 'ai', text: greeting(active.value) }] : []
    }

    function scrollToBottom() {
      nextTick(() => {
        if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
      })
    }

    function send() {
      const v = input.value.trim()
      if (!v || !active.value) return
      messages.value.push({ role: 'me', text: v })
      messages.value.push({ role: 'ai', text: respond(v, active.value) })
      input.value = ''
      scrollToBottom()
    }

    /** 本地规则引擎生成回复（对接真实模型时替换此函数即可） */
    function respond(text, agent) {
      const items = data.workItems
      const reqs = data.requirements
      const hi = items.filter((w) => (w.priority === '高' || w.priority === '紧急') && w.status !== '已完成')

      if (/进展|风险|迭代|站会|周报|总结/.test(text)) {
        const done = items.filter((w) => w.status === '已完成').length
        return `### 迭代进展摘要\n\n- 工作项总数 **${items.length}**，已完成 **${done}**，完成率 **${Math.round((done / (items.length || 1)) * 100)}%**\n- 高优先级未完成 **${hi.length}** 项，建议重点关注\n- 缺陷类工作项 **${items.filter((w) => w.type === '缺陷').length}** 个\n\n**风险提示**\n\n1. ${hi[0] ? hi[0].title : '存在高优先级阻塞项'} —— 建议今日对齐负责人\n2. 待测试工作项积压，建议增加回归窗口\n\n**建议动作**：将高风险项标注并同步至站会看板。`
      }
      if (/需求|拆解|验收|优先级|用户故事/.test(text)) {
        const r = reqs[0]
        return `### 需求拆解建议\n\n**原始需求**：${r?.title || '—'}\n\n**用户故事**\n\n> 作为*企业管理员*，我希望*配置多级审批流程*，以便*规范内部审批、减少人工催办*。\n\n**验收标准（AC）**\n\n- [ ] 支持 3 级及以上串行 / 并行审批节点\n- [ ] 支持条件分支（按金额 / 部门路由）\n- [ ] 审批人可转交、加签、抄送\n- [ ] 全流程留痕，支持追溯\n\n**优先级建议**：高（阻塞核心流程）　**建议故事点**：8`
      }
      if (/测试|用例|边界|回归|报告/.test(text)) {
        return `### 测试用例补充（边界场景）\n\n| 编号 | 场景 | 预期 |\n| --- | --- | --- |\n| TC-B1 | 审批人为空 | 提示并阻断提交 |\n| TC-B2 | 节点超时未处理 | 触发自动升级 |\n| TC-B3 | 并发审批同一单 | 幂等，仅生效一次 |\n| TC-B4 | 抄送人离职 | 自动跳过并记录 |\n\n**回归建议**：优先覆盖流程引擎与通知中心，预计新增 4 条用例、回归 12 条既有用例。`
      }
      if (/设计|架构|选型|模型|接口/.test(text)) {
        return `### 技术方案建议\n\n**架构**：接入层 → 应用层 → 领域层 → 基础设施层\n\n**关键选型**\n\n- 流程引擎：可选 \`Flowable\`（成熟）/ 自研状态机（轻量可控）\n- 事件驱动：领域事件 + 消息队列解耦通知\n- 存储：流程定义 JSON 化，便于版本化\n\n**风险**：条件分支的表达能力与可测试性，建议先行 PoC。`
      }
      if (/开发|代码|实现|缺陷|根因|单测/.test(text)) {
        return `### 实现思路\n\n1. 定义 \`ProcessNode\` 抽象，策略模式处理串行 / 并行 / 条件分支\n2. 使用状态机管理任务生命周期，保证幂等\n3. 领域事件 \`TaskApproved\` 驱动通知与后续节点激活\n\n**单测重点**：分支条件求值（含空值 / 越界）、并发审批幂等、超时升级定时任务。`
      }
      if (/文档|规范|沉淀|目录|知识/.test(text)) {
        return `### 文档化建议\n\n建议目录结构：\n\n\`\`\`\n产品知识库\n├─ 产品概述\n├─ 需求管理规范\n└─ 关键设计决策\n\`\`\`\n\n**文档结构**：1. 背景与目标　2. 方案概述　3. 决策记录（ADR）　4. 影响面与回滚方案`
      }
      return `已收到你的请求。作为 **${agent.name}**，我可以围绕「${(agent.skills || []).join('、')}」展开工作。\n\n- 当前工作项 **${items.length}** 项，高优先级未完成 **${hi.length}** 项\n- 需求 **${reqs.length}** 条，其中待评审 **${reqs.filter((r) => r.status === '待评审').length}** 条\n\n请补充更具体的场景或目标，我会给出结构化产出。`
    }

    watch(() => data.agents.length, (n) => {
      if (n && !activeId.value) {
        activeId.value = data.agents[0].id
        messages.value = [{ role: 'ai', text: greeting(data.agents[0]) }]
      }
    }, { immediate: true })

    return { data, tab, activeId, active, input, messages, scrollEl, ta, suggests, capabilityText,
      startChat, clearChat, send, renderMarkdown }
  },
}
