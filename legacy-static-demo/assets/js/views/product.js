/* 产品管理：产品 · 需求 · 工单 · 需求跟踪矩阵 */
(function () {
  const { icon, esc, avatar, userCell, fmtDate, fromNow } = UI;

  const state = { productId: null, tab: 'req', q: '', status: '', priority: '', type: '' };

  function render() {
    const products = DB.list('products');
    if (!state.productId || !products.some((p) => p.id === state.productId)) state.productId = products[0] ? products[0].id : null;
    const el = document.createElement('div');
    paint(el);
    return el;
  }

  function paint(root) {
    const products = DB.list('products');
    const product = DB.find('products', state.productId) || products[0];
    const all = DB.list('requirements');
    const reqs = all.filter((r) => r.productId === state.productId);

    let rows = reqs.filter((r) => {
      if (state.tab === 'ticket' && r.type !== '工单') return false;
      if (state.tab === 'req' && r.type === '工单') return false;
      if (state.q && !(r.title.includes(state.q) || r.code.includes(state.q))) return false;
      if (state.status && r.status !== state.status) return false;
      if (state.priority && r.priority !== state.priority) return false;
      return true;
    });

    const tabs = [
      { k: 'req', label: '需求', cnt: reqs.filter((r) => r.type !== '工单').length },
      { k: 'ticket', label: '工单', cnt: reqs.filter((r) => r.type === '工单').length },
      { k: 'matrix', label: '需求跟踪矩阵' },
    ];

    root.innerHTML = `
      <div class="page-head">
        <div><h2>产品管理</h2><p>收集多渠道需求，评审排期并跟踪至交付</p></div>
        <div class="actions">
          <button class="btn" data-new-product>${icon('plus', 16)} 新建产品</button>
          <button class="btn btn-primary" data-new-req>${icon('plus', 16)} 新建${state.tab === 'ticket' ? '工单' : '需求'}</button>
        </div>
      </div>

      <!-- 产品切换 -->
      <div class="grid g-3 mb-4">
        ${products.map((p) => {
          const cnt = all.filter((r) => r.productId === p.id).length;
          const doneN = all.filter((r) => r.productId === p.id && r.status === '已完成').length;
          const active = p.id === state.productId;
          return `<div class="card card-pad" data-product="${p.id}" style="cursor:pointer;${active ? 'box-shadow:0 0 0 2px var(--mint), var(--shadow)' : ''}">
            <div class="flex items-center gap-2">
              <span style="width:38px;height:38px;border-radius:12px;background:${p.color};display:grid;place-items:center;color:#fff;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)">${esc(p.identifier.slice(0, 2))}</span>
              <div style="flex:1;min-width:0"><b style="font-size:14px">${esc(p.name)}</b>
                <div class="fs-12 text-3">${esc(p.identifier)} · ${esc(DB.userById(p.owner).name)}</div></div>
              <span class="badge ${DB.statusKind(p.status)}">${esc(p.status)}</span>
            </div>
            <p class="fs-12 text-3 mt-3" style="line-height:1.6;min-height:34px">${esc(p.desc)}</p>
            <div class="flex items-center gap-3 mt-2">
              <span class="chip">${icon('product', 13)} ${cnt} 需求</span>
              <span class="chip">${icon('checkCircle', 13)} ${doneN} 完成</span>
              <span class="chip">${icon('users', 13)} ${p.members.length}</span>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="tabs">
        ${tabs.map((t) => `<button class="tab ${state.tab === t.k ? 'active' : ''}" data-tab="${t.k}">${esc(t.label)}${t.cnt != null ? `<span class="cnt">${t.cnt}</span>` : ''}</button>`).join('')}
      </div>

      ${state.tab === 'matrix' ? matrixHtml(reqs) : `
        <div class="filters">
          <div class="search-input" style="width:260px">${icon('search', 16)}
            <input class="input" id="fq" placeholder="搜索标题或编号" value="${esc(state.q)}" /></div>
          <select class="select" id="fstatus" style="width:130px">
            <option value="">全部状态</option>
            ${['待评审', '已排期', '开发中', '已完成'].map((s) => `<option ${state.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <select class="select" id="fprio" style="width:120px">
            <option value="">全部优先级</option>
            ${['高', '中', '低'].map((s) => `<option ${state.priority === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span class="spacer"></span>
          <span class="hint">共 ${rows.length} 条</span>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr>
                <th style="width:130px">编号</th><th>标题</th><th style="width:80px">类型</th>
                <th style="width:80px">优先级</th><th style="width:100px">状态</th>
                <th style="width:130px">负责人</th><th style="width:70px">点数</th><th style="width:110px">创建时间</th>
                <th style="width:50px"></th>
              </tr></thead>
              <tbody>
                ${rows.length ? rows.map((r) => `
                  <tr>
                    <td class="mono fs-12 muted">${esc(r.code)}</td>
                    <td><span class="c-title" data-req="${r.id}">${esc(r.title)}</span>
                      <div class="fs-12 text-3">来源：${esc(r.source)}</div></td>
                    <td><span class="badge ${r.type === '工单' ? 'orange' : 'indigo'}">${esc(r.type)}</span></td>
                    <td><span class="prio"><span class="pbar" style="background:${prioColor(r.priority)}"></span>${esc(r.priority)}</span></td>
                    <td><span class="badge ${DB.statusKind(r.status)}"><span class="dot"></span>${esc(r.status)}</span></td>
                    <td>${userCell(DB.userById(r.assignee))}</td>
                    <td class="num">${r.points}</td>
                    <td class="muted fs-12">${fmtDate(r.createdAt)}</td>
                    <td><div class="row-actions">
                      <button class="icon-btn" style="width:28px;height:28px" data-edit="${r.id}">${icon('edit', 14)}</button>
                      <button class="icon-btn" style="width:28px;height:28px" data-del="${r.id}">${icon('trash', 14)}</button>
                    </div></td>
                  </tr>`).join('') : `<tr><td colspan="9">${UI.empty('暂无匹配的需求', '调整筛选条件或新建一条需求', 'product')}</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>`}`;

    bind(root, product);
  }

  function matrixHtml(reqs) {
    const items = DB.list('workItems');
    const cases = DB.list('testCases');
    const rel = reqs.slice(0, 10);
    return `<div class="card">
      <div class="card-head"><h3>需求跟踪矩阵 (RTM)</h3><span class="sub">需求 → 工作项 → 测试用例 全链路追溯</span>
        <div class="right"><span class="badge green">覆盖率 ${Math.round((rel.filter((r) => r.status === '已完成').length / (rel.length || 1)) * 100)}%</span></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th style="width:120px">需求编号</th><th>需求</th><th>关联工作项</th><th style="width:120px">工作项状态</th><th>关联测试用例</th><th style="width:90px">测试结果</th></tr></thead>
        <tbody>
          ${rel.map((r, i) => {
            const w = items[i % items.length];
            const tc = cases[i % cases.length];
            return `<tr>
              <td class="mono fs-12 muted">${esc(r.code)}</td>
              <td class="c-title" data-req="${r.id}" style="font-weight:600">${esc(r.title)}</td>
              <td class="fs-13">${w ? esc(w.code) + ' ' + esc(w.title.slice(0, 12)) + '…' : '—'}</td>
              <td>${w ? `<span class="badge ${DB.statusKind(w.status)}">${esc(w.status)}</span>` : '—'}</td>
              <td class="fs-13">${tc ? esc(tc.code) + ' ' + esc(tc.title.slice(0, 12)) + '…' : '—'}</td>
              <td>${tc ? `<span class="badge ${DB.statusKind(tc.lastResult)}">${esc(tc.lastResult)}</span>` : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div></div>`;
  }

  function bind(root, product) {
    root.querySelectorAll('[data-product]').forEach((c) => c.addEventListener('click', () => { state.productId = c.dataset.product; App.render(); }));
    root.querySelectorAll('[data-tab]').forEach((t) => t.addEventListener('click', () => { state.tab = t.dataset.tab; App.render(); }));
    const fq = root.querySelector('#fq');
    if (fq) fq.addEventListener('input', (e) => { state.q = e.target.value; const p = e.target.selectionStart; App.render(); const n = document.querySelector('#fq'); if (n) { n.focus(); n.setSelectionRange(p, p); } });
    const fs = root.querySelector('#fstatus');
    if (fs) fs.addEventListener('change', (e) => { state.status = e.target.value; App.render(); });
    const fp = root.querySelector('#fprio');
    if (fp) fp.addEventListener('change', (e) => { state.priority = e.target.value; App.render(); });

    root.querySelector('[data-new-product]')?.addEventListener('click', () => productModal(null));
    root.querySelector('[data-new-req]')?.addEventListener('click', () => reqModal(null, product));
    root.querySelectorAll('[data-req]').forEach((r) => r.addEventListener('click', () => reqDrawer(r.dataset.req)));
    root.querySelectorAll('[data-edit]').forEach((r) => r.addEventListener('click', (e) => { e.stopPropagation(); reqModal(r.dataset.edit, product); }));
    root.querySelectorAll('[data-del]').forEach((r) => r.addEventListener('click', (e) => {
      e.stopPropagation();
      const rec = DB.find('requirements', r.dataset.del);
      UI.modal({
        title: '删除确认', body: `<p>确定要删除需求 <b>${esc(rec.title)}</b> 吗？此操作不可撤销。</p>`,
        footer: `<button class="btn" data-close>取消</button><button class="btn btn-danger" data-ok>删除</button>`,
        onMount(api) { api.el.querySelector('[data-ok]').onclick = () => { DB.remove('requirements', rec.id); api.close(); UI.toast('已删除', 'success'); App.render(); }; },
      });
    }));
  }

  function prioColor(p) { return { 紧急: '#ff7a6b', 高: '#ff7a6b', 中: '#ffb020', 低: '#a3bdb7' }[p] || '#a3bdb7'; }

  /* -------- 需求新建/编辑 -------- */
  function reqModal(id, product) {
    const rec = id ? DB.find('requirements', id) : null;
    const users = DB.list('users');
    const isTicket = rec ? rec.type === '工单' : state.tab === 'ticket';
    const body = `<div class="form-grid">
      <div class="field span-2"><label>标题 *</label><input class="input" name="title" value="${esc(rec ? rec.title : '')}" placeholder="一句话描述需求" /></div>
      <div class="field"><label>类型</label><select class="select" name="type">
        <option ${isTicket ? '' : 'selected'}>需求</option><option ${isTicket ? 'selected' : ''}>工单</option></select></div>
      <div class="field"><label>优先级</label><select class="select" name="priority">
        ${['高', '中', '低'].map((p) => `<option ${rec && rec.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>状态</label><select class="select" name="status">
        ${['待评审', '已排期', '开发中', '已完成'].map((s) => `<option ${rec && rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>负责人</label><select class="select" name="assignee">
        ${users.map((u) => `<option value="${u.id}" ${rec && rec.assignee === u.id ? 'selected' : ''}>${esc(u.name)}（${esc(u.role)}）</option>`).join('')}</select></div>
      <div class="field"><label>故事点</label><input class="input" name="points" type="number" min="0" value="${rec ? rec.points : 3}" /></div>
      <div class="field"><label>来源</label><select class="select" name="source">
        ${['客户反馈', '产品规划', '内部需求', '数据分析'].map((s) => `<option ${rec && rec.source === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>所属产品</label><select class="select" name="productId">
        ${DB.list('products').map((p) => `<option value="${p.id}" ${((rec && rec.productId) || product.id) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    </div>`;
    const m = UI.modal({
      title: rec ? '编辑需求' : (isTicket ? '新建工单' : '新建需求'),
      body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.title.trim()) { UI.toast('请填写标题', 'error'); return; }
          if (rec) {
            DB.update('requirements', rec.id, { ...v, points: +v.points });
            DB.logActivity('u1', '更新了需求', v.title);
            UI.toast('需求已更新', 'success');
          } else {
            const p = DB.find('products', v.productId);
            const n = DB.list('requirements').length + 1;
            DB.insert('requirements', {
              ...v, points: +v.points, productId: v.productId,
              code: `${p.identifier}-${v.type === '工单' ? 'TKT' : 'REQ'}-${String(n).padStart(3, '0')}`,
            });
            DB.logActivity('u1', '创建了需求', v.title);
            UI.toast('需求已创建', 'success');
          }
          api.close(); App.render();
        };
      },
    });
  }

  /* -------- 产品新建 -------- */
  function productModal() {
    const body = `<div class="form-grid">
      <div class="field span-2"><label>产品名称 *</label><input class="input" name="name" placeholder="例如：智慧协同办公平台" /></div>
      <div class="field"><label>标识符 *</label><input class="input" name="identifier" placeholder="OA" /></div>
      <div class="field"><label>负责人</label><select class="select" name="owner">
        ${DB.list('users').map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field span-2"><label>产品描述</label><textarea class="input" name="desc" rows="3" placeholder="简要描述产品定位"></textarea></div>
    </div>`;
    const m = UI.modal({
      title: '新建产品', body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>创建</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.name.trim() || !v.identifier.trim()) { UI.toast('请填写名称与标识符', 'error'); return; }
          const colors = ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#f472b6'];
          const rec = DB.insert('products', { ...v, status: '规划中', color: colors[Math.floor(Math.random() * colors.length)], members: [v.owner] });
          DB.logActivity('u1', '创建了产品', v.name);
          state.productId = rec.id;
          api.close(); UI.toast('产品已创建', 'success'); App.render();
        };
      },
    });
  }

  /* -------- 需求详情抽屉 -------- */
  function reqDrawer(id) {
    const r = DB.find('requirements', id);
    if (!r) return;
    const u = DB.userById(r.assignee);
    const p = DB.find('products', r.productId) || {};
    const body = `
      <div class="flex items-center gap-2 mb-3">
        <span class="badge ${r.type === '工单' ? 'orange' : 'indigo'}">${esc(r.type)}</span>
        <span class="badge ${DB.statusKind(r.status)}"><span class="dot"></span>${esc(r.status)}</span>
        <span class="prio"><span class="pbar" style="background:${prioColor(r.priority)}"></span>${esc(r.priority)}优先级</span>
        <span class="spacer"></span><span class="mono fs-12 text-3">${esc(r.code)}</span>
      </div>
      <h3 style="font-size:19px;font-weight:800;margin-bottom:14px">${esc(r.title)}</h3>
      <dl class="kv mb-4">
        <dt>所属产品</dt><dd>${esc(p.name || '—')}</dd>
        <dt>负责人</dt><dd>${userCell(u)}</dd>
        <dt>故事点</dt><dd>${r.points} 点</dd>
        <dt>需求来源</dt><dd>${esc(r.source)}</dd>
        <dt>创建时间</dt><dd>${fmtDate(r.createdAt)}（${fromNow(r.createdAt)}）</dd>
      </dl>
      <div class="hr"></div>
      <h4 style="font-weight:700;margin-bottom:10px">验收标准</h4>
      <div class="doc-body" style="font-size:13.5px">
        <ul><li>功能符合需求描述，主流程可正常完成</li><li>异常场景有明确的错误提示与降级处理</li><li>通过对应的测试用例验证，缺陷清零</li></ul>
      </div>
      <div class="hr"></div>
      <h4 style="font-weight:700;margin-bottom:10px">关联追溯</h4>
      <div class="grid g-2">
        <div class="tag">${icon('project', 14)} 工作项 OAV2-10${(id.slice(1) % 9) + 1}</div>
        <div class="tag">${icon('test', 14)} 用例 OA-TC-00${(id.slice(1) % 9) + 1}</div>
      </div>`;
    UI.drawer({
      title: '需求详情', subtitle: esc(r.code), body,
      footer: `<button class="btn" data-close>关闭</button>
        <button class="btn btn-primary" data-edit>${icon('edit', 15)} 编辑</button>`,
      onMount(api) {
        const edit = api.el.querySelector('[data-edit]');
        if (edit) edit.onclick = () => { api.close(); reqModal(r.id, p); };
      },
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.product = render;
})();
