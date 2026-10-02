/* 智能协同：智能体管理中心 · AI 助手 */
(function () {
  const { icon, esc, avatar, md } = UI;
  let tab = 'agents';
  let activeAgent = null;
  let chat = [];

  function render() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>智能协同</h2><p>六类精通软件工程方法论的核心智能体，覆盖需求、设计、开发、测试、管理、协作</p></div>
        <div class="actions"><span class="chip">${icon('sparkles', 14)} AI 能力已就绪</span></div>
      </div>
      <div class="tabs">${[['agents', '智能体管理'], ['assistant', 'AI 助手']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tb"></div>`;
    const tb = el.querySelector('#tb');
    const paint = () => { tb.innerHTML = tab === 'agents' ? agentsHtml() : chatHtml(); bind(tb); };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); paint(); return; }
    });
    paint();
    return el;
  }

  function agentsHtml() {
    const agents = DB.list('agents');
    return `
      <div class="grid g-3">
        ${agents.map((a) => `<div class="agent-card" data-agent="${a.id}">
          <div class="agent-ico" style="background:${a.color}1f;color:${a.color}">${a.emoji}</div>
          <div class="flex items-center gap-2 mb-3"><b style="font-size:15px">${esc(a.name)}</b>
            <span class="badge indigo" style="margin-left:auto">${esc(a.role)}</span></div>
          <p class="fs-13 text-2" style="line-height:1.65;min-height:60px">${esc(a.desc)}</p>
          <div class="flex gap-2 wrap mt-2">${a.skills.map((s) => `<span class="tag fs-12">${esc(s)}</span>`).join('')}</div>
          <button class="btn btn-primary btn-block mt-3" data-chat="${a.id}">${icon('comment', 15)} 与 ${esc(a.name)} 对话</button>
        </div>`).join('')}
      </div>
      <div class="card mt-4"><div class="card-head"><h3>能力说明</h3></div>
        <div class="card-pad doc-body" style="font-size:13.5px">
          <p>智能体可调用系统中的<strong>需求、工作项、测试用例、知识文档</strong>等数据，结合大模型完成分析、生成与建议。智能体之间支持协作：由「项目经理」统筹，联动「需求分析师 → 架构设计师 → 开发工程师 → 测试工程师」完成端到端研发流程闭环。</p>
        </div></div>`;
  }

  function chatHtml() {
    const agents = DB.list('agents');
    const a = (activeAgent && DB.find('agents', activeAgent)) || agents[0];
    const msgs = chat.length ? chat : [{ role: 'ai', text: `你好，我是 **${a.name}**（${a.role}）。${a.desc}\n\n你可以让我处理与「${a.skills.join('、')}」相关的工作，例如：` }];
    return `<div class="grid g-1-2">
      <div class="card"><div class="card-head"><h3>选择智能体</h3></div>
        <div class="card-pad" style="padding:8px;max-height:60vh;overflow:auto">
          ${agents.map((x) => `<div class="list-row" data-pick="${x.id}" style="${x.id === a.id ? 'background:var(--mint-50);border-color:var(--mint-200)' : ''}">
            <span style="width:34px;height:34px;border-radius:11px;background:${x.color}1f;display:grid;place-items:center;font-size:17px">${x.emoji}</span>
            <div class="grow"><b>${esc(x.name)}</b><small>${esc(x.role)} · ${x.skills.length} 项能力</small></div>
          </div>`).join('')}
        </div></div>

      <div class="card">
        <div class="card-head">
          <span style="width:32px;height:32px;border-radius:10px;background:${a.color}1f;display:grid;place-items:center;font-size:16px">${a.emoji}</span>
          <div><h3>${esc(a.name)}</h3><span class="sub">${esc(a.role)} 智能体 · 在线</span></div>
          <div class="right"><button class="btn btn-sm btn-ghost" data-clear>${icon('refresh', 14)} 清空</button></div>
        </div>
        <div class="chat">
          <div class="chat-scroll" id="scroll">
            ${msgs.map((m) => `<div class="msg ${m.role === 'me' ? 'me' : 'ai'}">
              ${m.role === 'me' ? avatar({ name: '我', color: '#13a884' }) : `<span style="width:32px;height:32px;border-radius:10px;background:${a.color}1f;display:grid;place-items:center;font-size:16px;flex-shrink:0">${a.emoji}</span>`}
              <div class="bubble">${m.role === 'me' ? esc(m.text) : md(m.text)}</div></div>`).join('')}
          </div>
          <div class="suggest">
            ${suggestsFor(a).map((s) => `<button data-fill="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          <div class="chat-input">
            <textarea id="ci" placeholder="向 ${esc(a.name)} 描述你的任务…（Enter 发送）"></textarea>
            <button class="btn btn-primary" data-send>${icon('send', 16)}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function suggestsFor(a) {
    const map = {
      '需求': ['拆解「多级流程审批」需求并给出验收标准', '为工作台仪表盘需求排优先级'],
      '设计': ['为审批流程引擎给出技术选型建议', '设计需求与工作项的领域模型'],
      '开发': ['为流程节点分支生成实现思路与单测', '分析 OAV2-108 缺陷的可能根因'],
      '测试': ['为多级审批用例补充边界场景', '生成 V2.0 回归测试报告摘要'],
      '管理': ['总结本期迭代进展与风险', '生成今日站会纪要'],
      '协作': ['把这次讨论整理成规范文档', '为产品知识库规划目录结构'],
    };
    return map[a.role] || ['帮我梳理当前项目的进展', '有哪些高优先级待办？'];
  }

  function bind(tb) {
    tb.querySelectorAll('[data-agent],[data-chat]').forEach((n) => n.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = n.dataset.chat || n.dataset.agent;
      activeAgent = id; tab = 'assistant'; chat = [];
      App.render();
    }));
    tb.querySelectorAll('[data-pick]').forEach((n) => n.addEventListener('click', () => { activeAgent = n.dataset.pick; chat = []; renderTab(); }));
    tb.querySelector('[data-clear]')?.addEventListener('click', () => { chat = []; renderTab(); });
    tb.querySelectorAll('[data-fill]').forEach((n) => n.addEventListener('click', () => { const i = tb.querySelector('#ci'); i.value = n.dataset.fill; i.focus(); }));

    const send = () => {
      const ta = tb.querySelector('#ci');
      const v = ta.value.trim();
      if (!v) return;
      const agents = DB.list('agents');
      const a = activeAgent ? DB.find('agents', activeAgent) : agents[0];
      chat.push({ role: 'me', text: v });
      chat.push({ role: 'ai', text: respond(v, a) });
      renderTab();
      requestAnimationFrame(() => { const s = document.querySelector('#scroll'); if (s) s.scrollTop = s.scrollHeight; });
    };
    tb.querySelector('[data-send]')?.addEventListener('click', send);
    tb.querySelector('#ci')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    requestAnimationFrame(() => { const s = tb.querySelector('#scroll'); if (s) s.scrollTop = s.scrollHeight; });
  }

  function renderTab() {
    const tb = document.getElementById('tb');
    if (!tb) return;
    tb.innerHTML = tab === 'agents' ? agentsHtml() : chatHtml();
    bind(tb);
  }

  /* -------- 模拟智能体回复 -------- */
  function respond(text, agent) {
    const t = text.toLowerCase();
    const items = DB.list('workItems');
    const reqs = DB.list('requirements');
    const hi = items.filter((w) => (w.priority === '高' || w.priority === '紧急') && w.status !== '已完成');

    if (/进展|风险|迭代|站会|周报|总结/.test(text)) {
      const done = items.filter((w) => w.status === '已完成').length;
      return `### 迭代进展摘要\n\n- 工作项总数 **${items.length}**，已完成 **${done}**，完成率 **${Math.round((done / items.length) * 100)}%**\n- 高优先级未完成 **${hi.length}** 项，建议重点关注\n- 缺陷类工作项 **${items.filter((w) => w.type === '缺陷').length}** 个\n\n**风险提示**\n\n1. ${hi[0] ? hi[0].title : '存在高优先级阻塞项'} —— 建议今日对齐负责人\n2. 待测试工作项积压，建议增加回归窗口\n\n**建议动作**：将高风险项标注并同步至站会看板。`;
    }
    if (/需求|拆解|验收|优先级|用户故事/.test(text)) {
      const r = reqs[0];
      return `### 需求拆解建议\n\n**原始需求**：${r.title}\n\n**用户故事**\n\n> 作为*企业管理员*，我希望*配置多级审批流程*，以便*规范内部审批、减少人工催办*。\n\n**验收标准（AC）**\n\n- [ ] 支持 3 级及以上串行 / 并行审批节点\n- [ ] 支持条件分支（按金额 / 部门路由）\n- [ ] 审批人可转交、加签、抄送\n- [ ] 全流程留痕，支持追溯\n\n**优先级建议**：高（阻塞核心流程）\n**建议故事点**：8\n\n需要我继续拆分子任务吗？`;
    }
    if (/测试|用例|边界|回归|报告/.test(text)) {
      return `### 测试用例补充（边界场景）\n\n| 编号 | 场景 | 预期 |\n| --- | --- | --- |\n| TC-B1 | 审批人为空 | 提示并阻断提交 |\n| TC-B2 | 节点超时未处理 | 触发自动升级 |\n| TC-B3 | 并发审批同一单 | 幂等，仅生效一次 |\n| TC-B4 | 抄送人离职 | 自动跳过并记录 |\n\n**回归建议**：优先覆盖流程引擎与通知中心，预计新增 4 条用例、回归 12 条既有用例。`;
    }
    if (/设计|架构|选型|模型|接口/.test(text)) {
      return `### 技术方案建议\n\n**架构**：接入层 → 应用层 → 领域层 → 基础设施层\n\n**关键选型**\n\n- 流程引擎：可选 \`Flowable\`（成熟）/ 自研状态机（轻量可控）\n- 事件驱动：领域事件 + 消息队列解耦通知\n- 存储：流程定义 JSON 化，便于版本化\n\n**领域模型**\n\n\`\`\`\nProcess(流程) 1—N Node(节点) 1—N Task(任务)\nTask N—1 User(审批人)\n\`\`\`\n\n**风险**：条件分支的表达能力与可测试性，建议先行 PoC。`;
    }
    if (/开发|代码|实现|缺陷|根因|单测/.test(text)) {
      return `### 实现思路\n\n1. 定义 \`ProcessNode\` 抽象，策略模式处理串行 / 并行 / 条件分支\n2. 使用状态机管理任务生命周期，保证幂等\n3. 领域事件 \`TaskApproved\` 驱动通知与后续节点激活\n\n**单测重点**\n\n- 分支条件求值（含空值 / 越界）\n- 并发审批幂等\n- 超时升级定时任务\n\n**缺陷排查建议**：优先检查节点激活顺序与事件消费幂等性。`;
    }
    if (/文档|规范|沉淀|目录|知识/.test(text)) {
      return `### 文档化建议\n\n已按规范整理，建议归入目录：\n\n\`\`\`\n产品知识库\n├─ 产品概述\n├─ 需求管理规范\n└─ 关键设计决策\n\`\`\`\n\n**文档结构**\n\n1. 背景与目标\n2. 方案概述\n3. 决策记录（ADR）\n4. 影响面与回滚方案\n\n需要我直接生成草稿并写入知识库吗？`;
    }
    return `已收到你的请求。作为 **${agent.name}**，我可以围绕「${agent.skills.join('、')}」展开工作。\n\n- 当前工作项 **${items.length}** 项，高优先级未完成 **${hi.length}** 项\n- 需求 **${reqs.length}** 条，其中待评审 **${reqs.filter((r) => r.status === '待评审').length}** 条\n\n请补充更具体的场景或目标（例如"拆解某需求"、"生成测试用例"），我会给出结构化产出。`;
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.ai = render;
})();
