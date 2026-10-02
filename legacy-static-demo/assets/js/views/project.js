/* 项目管理：项目集 · 工作项看板 · 迭代 · 发布 */
(function () {
  const { icon, esc, userCell, avatarStack, avatar, fmtDate, fromNow } = UI;

  const STATUSES = ['待处理', '进行中', '待测试', '已完成'];
  const STATUS_COLOR = { '待处理': '#a3bdb7', '进行中': '#38bdf8', '待测试': '#8b7cf6', '已完成': '#23d3a9' };

  let tab = 'kanban';

  function render(param) {
    const projects = DB.list('projects');
    if (param && projects.some((p) => p.id === param)) return detail(param);
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>项目管理</h2><p>支持 Scrum / Kanban / 瀑布开发模型，按团队节奏推进交付</p></div>
        <div class="actions"><button class="btn btn-primary" data-new-proj>${icon('plus', 16)} 新建项目</button></div>
      </div>
      <div class="grid g-3">
        ${projects.map((p) => {
          const items = DB.list('workItems').filter((w) => w.projectId === p.id);
          const done = items.filter((w) => w.status === '已完成').length;
          const owner = DB.userById(p.owner);
          const members = p.members.map((m) => DB.userById(m));
          return `<div class="card card-pad" data-proj="${p.id}" style="cursor:pointer">
            <div class="flex items-center gap-2 mb-3">
              <span style="width:40px;height:40px;border-radius:12px;background:${p.color};display:grid;place-items:center;color:#fff;font-weight:800;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)">${esc(p.identifier.slice(0, 2))}</span>
              <div style="flex:1;min-width:0"><b style="font-size:14.5px">${esc(p.name)}</b>
                <div class="fs-12 text-3">${esc(p.identifier)} · ${esc(p.type)} 模型</div></div>
              <span class="badge ${DB.statusKind(p.status)}">${esc(p.status)}</span>
            </div>
            <p class="fs-12 text-3" style="line-height:1.6;min-height:34px">${esc(p.desc)}</p>
            <div class="mt-3"><div class="progress"><i style="width:${p.progress}%"></i></div>
              <div class="flex items-center" style="justify-content:space-between;margin-top:7px">
                <span class="hint">${done}/${items.length} 工作项完成</span><span class="hint fw-7" style="color:var(--mint-700)">${p.progress}%</span></div></div>
            <div class="flex items-center mt-3" style="justify-content:space-between">
              ${avatarStack(members)}
              <span class="hint">${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    el.addEventListener('click', (e) => { const c = e.target.closest('[data-proj]'); if (c) location.hash = '#/project/' + c.dataset.proj; });
    el.querySelector('[data-new-proj]').onclick = newProjectModal;
    return el;
  }

  /* -------------------- 项目详情 -------------------- */
  function detail(id) {
    const p = DB.find('projects', id);
    if (!p) { location.hash = '#/project'; return document.createElement('div'); }
    const items = DB.list('workItems').filter((w) => w.projectId === id);
    const sprints = DB.list('sprints').filter((s) => s.projectId === id);
    const done = items.filter((w) => w.status === '已完成').length;
    const el = document.createElement('div');

    el.innerHTML = `
      <div class="page-head">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <button class="btn btn-sm btn-ghost" data-back>${icon('chevronLeft', 15)} 项目列表</button>
            <span class="badge ${DB.statusKind(p.status)}">${esc(p.status)}</span>
            <span class="chip">${esc(p.type)}</span>
          </div>
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.identifier)} · 负责人 ${esc(DB.userById(p.owner).name)} · ${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}</p>
        </div>
        <div class="actions">
          <button class="btn" data-sprint>${icon('layers', 16)} 迭代管理</button>
          <button class="btn btn-primary" data-newitem>${icon('plus', 16)} 新建工作项</button>
        </div>
      </div>

      <div class="grid g-4 mb-4">
        ${mini('工作项', items.length, 'list')}
        ${mini('已完成', done, 'checkCircle')}
        ${mini('进行中', items.filter((w) => w.status === '进行中').length, 'play')}
        ${mini('故事点', items.reduce((a, b) => a + b.points, 0), 'target')}
      </div>

      <div class="tabs">
        ${[['kanban', '工作项看板'], ['list', '工作项列表'], ['sprint', '迭代'], ['release', '发布']].map(([k, l]) =>
          `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <div id="tabbody"></div>`;

    const body = el.querySelector('#tabbody');
    function paintTab() {
      if (tab === 'kanban') body.innerHTML = kanbanHtml(items);
      else if (tab === 'list') body.innerHTML = listHtml(items);
      else if (tab === 'sprint') body.innerHTML = sprintHtml(sprints, items);
      else body.innerHTML = releaseHtml(p, sprints);
      bindTab(body, p, items);
    }

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) { location.hash = '#/project'; return; }
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); paintTab(); return; }
      if (e.target.closest('[data-newitem]')) { itemModal(null, p); return; }
      if (e.target.closest('[data-sprint]')) { tab = 'sprint'; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'sprint')); paintTab(); return; }
    });
    paintTab();
    return el;
  }

  function mini(label, val, ic) {
    return `<div class="stat"><div class="lbl">${esc(label)}</div><div class="val">${val}</div>
      <div class="stat-ico" style="background:var(--mint-50);color:var(--mint-700)">${icon(ic, 19)}</div></div>`;
  }

  /* -------- 看板 -------- */
  function kanbanHtml(items) {
    return `<div class="kanban">
      ${STATUSES.map((st) => {
        const col = items.filter((w) => w.status === st);
        return `<div class="kcol" data-col="${st}">
          <div class="kcol-head"><span class="kdot" style="background:${STATUS_COLOR[st]};color:${STATUS_COLOR[st]}"></span>${esc(st)}
            <span class="cnt">${col.length}</span></div>
          <div class="kcol-body" data-drop="${st}">
            ${col.map(cardHtml).join('') || `<div class="hint" style="text-align:center;padding:14px">拖拽工作项到此</div>`}
          </div></div>`;
      }).join('')}
    </div>`;
  }
  function cardHtml(w) {
    const u = DB.userById(w.assignee);
    return `<div class="kcard" draggable="true" data-card="${w.id}">
      <div class="kt">${esc(w.title)}</div>
      <div class="flex items-center gap-2">
        <span class="prio fs-12"><span class="pbar" style="background:${prioColor(w.priority)}"></span>${esc(w.priority)}</span>
        <span class="tag fs-12" style="padding:1px 7px">${esc(w.type)}</span>
      </div>
      <div class="kmeta">
        ${avatar(u, 'sm')}
        <span class="kfoot">${icon('clock', 12)} ${fmtDate(w.endDate)}</span>
        <span class="sp">${w.points}</span>
      </div>
    </div>`;
  }
  function prioColor(p) { return { 紧急: '#ff7a6b', 高: '#ff7a6b', 中: '#ffb020', 低: '#a3bdb7' }[p] || '#a3bdb7'; }

  /* -------- 列表 -------- */
  function listHtml(items) {
    return `<div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th style="width:110px">编号</th><th>标题</th><th style="width:80px">类型</th><th style="width:80px">优先级</th>
        <th style="width:100px">状态</th><th style="width:130px">负责人</th><th style="width:60px">点数</th><th style="width:110px">截止</th></tr></thead>
      <tbody>${items.map((w) => `<tr>
        <td class="mono fs-12 muted">${esc(w.code)}</td>
        <td><span class="c-title" data-item="${w.id}">${esc(w.title)}</span></td>
        <td><span class="tag fs-12">${esc(w.type)}</span></td>
        <td><span class="prio"><span class="pbar" style="background:${prioColor(w.priority)}"></span>${esc(w.priority)}</span></td>
        <td><span class="badge ${DB.statusKind(w.status)}"><span class="dot"></span>${esc(w.status)}</span></td>
        <td>${userCell(DB.userById(w.assignee))}</td>
        <td class="num">${w.points}</td>
        <td class="muted fs-12">${fmtDate(w.endDate)}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
  }

  /* -------- 迭代 -------- */
  function sprintHtml(sprints, items) {
    if (!sprints.length) return UI.empty('暂无迭代', '点击右上角创建迭代', 'layers');
    return `<div class="grid g-2">${sprints.map((s) => {
      const si = items.filter((w) => w.sprintId === s.id);
      const sd = si.filter((w) => w.status === '已完成').length;
      const prog = si.length ? Math.round((sd / si.length) * 100) : 0;
      return `<div class="card card-pad">
        <div class="flex items-center gap-2 mb-3">
          <span style="width:10px;height:10px;border-radius:3px;background:${s.status === '已完成' ? '#23d3a9' : '#38bdf8'}"></span>
          <b style="font-size:14.5px">${esc(s.name)}</b>
          <span class="badge ${DB.statusKind(s.status)}" style="margin-left:auto">${esc(s.status)}</span>
        </div>
        <p class="fs-13 text-2 mb-3">目标：${esc(s.goal)}</p>
        <div class="progress mb-3"><i style="width:${prog}%"></i></div>
        <div class="flex items-center" style="justify-content:space-between">
          <span class="hint">${sd}/${si.length} 完成 · ${si.reduce((a, b) => a + b.points, 0)} 点</span>
          <span class="hint">${fmtDate(s.startDate)} ~ ${fmtDate(s.endDate)}</span>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  /* -------- 发布 -------- */
  function releaseHtml(p, sprints) {
    const rel = [
      { v: 'V2.0.0', date: p.endDate, status: '规划中', desc: '流程引擎重构 + 新工作台' },
      { v: 'V1.9.0', date: DB.dateOnly(DB.daysAgo(20)), status: '已发布', desc: '仪表盘部件与移动端优化' },
      { v: 'V1.8.0', date: DB.dateOnly(DB.daysAgo(60)), status: '已发布', desc: '组织架构同步与 SSO' },
    ];
    return `<div class="grid g-2-1">
      <div class="card"><div class="card-head"><h3>发布路线图</h3></div><div class="card-pad">
        <div class="timeline">
          ${rel.map((r, i) => `<div class="tl-item ${r.status === '已发布' ? 'done' : ''}">
            <b>${esc(r.v)} · ${esc(r.desc)}</b>
            <small>${fmtDate(r.date)} · <span class="badge ${DB.statusKind(r.status)}" style="padding:1px 8px">${esc(r.status)}</span></small>
          </div>`).join('')}
        </div></div></div>
      <div class="card"><div class="card-head"><h3>发布就绪度</h3></div><div class="card-pad" style="text-align:center">
        ${UI.ring(68, 130, '#23d3a9', '版本就绪度')}
        <div class="hr"></div>
        <div class="flex" style="justify-content:space-between;font-size:13px"><span class="text-3">阻塞缺陷</span><b>2</b></div>
        <div class="flex mt-2" style="justify-content:space-between;font-size:13px"><span class="text-3">待回归用例</span><b>4</b></div>
        <div class="flex mt-2" style="justify-content:space-between;font-size:13px"><span class="text-3">关联迭代</span><b>${sprints.length}</b></div>
      </div></div>
    </div>`;
  }

  /* -------- 绑定 -------- */
  function bindTab(body, p, items) {
    body.querySelectorAll('[data-item]').forEach((n) => n.addEventListener('click', () => itemDrawer(n.dataset.item)));
    // 拖拽
    body.querySelectorAll('.kcard').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.card);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('click', () => itemDrawer(card.dataset.card));
    });
    body.querySelectorAll('[data-drop]').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.closest('.kcol').classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.closest('.kcol').classList.remove('drag-over'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.closest('.kcol').classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const st = col.dataset.drop;
        const w = DB.find('workItems', id);
        if (!w || w.status === st) return;
        DB.update('workItems', id, { status: st });
        DB.logActivity('u1', '更新了工作项状态', `${w.code} ${w.title} → ${st}`);
        if (st === '已完成' && p) {
          const all = DB.list('workItems').filter((x) => x.projectId === p.id);
          const prog = Math.round((all.filter((x) => x.status === '已完成').length / all.length) * 100);
          DB.update('projects', p.id, { progress: prog });
        }
        UI.toast(`已移动到「${st}」`, 'success');
        App.render();
      });
    });
  }

  /* -------- 工作项弹窗 / 抽屉 -------- */
  function itemModal(id, project) {
    const rec = id ? DB.find('workItems', id) : null;
    const sprints = DB.list('sprints').filter((s) => s.projectId === project.id);
    const body = `<div class="form-grid">
      <div class="field span-2"><label>标题 *</label><input class="input" name="title" value="${esc(rec ? rec.title : '')}" /></div>
      <div class="field"><label>类型</label><select class="select" name="type">${['任务', '需求', '缺陷', '子任务'].map((t) => `<option ${rec && rec.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>优先级</label><select class="select" name="priority">${['紧急', '高', '中', '低'].map((t) => `<option ${rec && rec.priority === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>状态</label><select class="select" name="status">${STATUSES.map((s) => `<option ${rec && rec.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>负责人</label><select class="select" name="assignee">${DB.list('users').map((u) => `<option value="${u.id}" ${rec && rec.assignee === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label>所属迭代</label><select class="select" name="sprintId">${sprints.map((s) => `<option value="${s.id}" ${rec && rec.sprintId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label>故事点</label><input class="input" name="points" type="number" value="${rec ? rec.points : 3}" /></div>
      <div class="field"><label>截止日期</label><input class="input" name="endDate" type="date" value="${rec ? rec.endDate : DB.dateOnly(DB.daysAhead(7))}" /></div>
    </div>`;
    UI.modal({
      title: rec ? '编辑工作项' : '新建工作项', body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.title.trim()) { UI.toast('请填写标题', 'error'); return; }
          if (rec) { DB.update('workItems', rec.id, { ...v, points: +v.points }); UI.toast('已更新', 'success'); }
          else {
            DB.insert('workItems', { ...v, points: +v.points, projectId: project.id, code: `${project.identifier}-${100 + DB.list('workItems').length}` });
            DB.logActivity('u1', '创建了工作项', v.title);
            UI.toast('工作项已创建', 'success');
          }
          api.close(); App.render();
        };
      },
    });
  }

  function itemDrawer(id) {
    const w = DB.find('workItems', id);
    if (!w) return;
    const u = DB.userById(w.assignee);
    UI.drawer({
      title: w.title, subtitle: `${esc(w.code)} · ${esc(w.type)}`,
      body: `
        <div class="flex items-center gap-2 mb-4 flex wrap">
          <span class="badge ${DB.statusKind(w.status)}"><span class="dot"></span>${esc(w.status)}</span>
          <span class="prio"><span class="pbar" style="background:${prioColor(w.priority)}"></span>${esc(w.priority)}</span>
          <span class="tag">${w.points} 故事点</span>
        </div>
        <dl class="kv mb-4">
          <dt>负责人</dt><dd>${userCell(u)}</dd>
          <dt>所属迭代</dt><dd>${esc((DB.find('sprints', w.sprintId) || {}).name || '—')}</dd>
          <dt>开始日期</dt><dd>${fmtDate(w.startDate)}</dd>
          <dt>截止日期</dt><dd>${fmtDate(w.endDate)}</dd>
          <dt>创建时间</dt><dd>${fromNow(w.createdAt)}</dd>
        </dl>
        <div class="hr"></div>
        <h4 style="font-weight:700;margin-bottom:10px">描述</h4>
        <div class="doc-body" style="font-size:13.5px"><p>${esc(w.title)}。请按照验收标准完成开发与自测，并补充必要的单元测试。</p></div>
        <div class="hr"></div>
        <h4 style="font-weight:700;margin-bottom:10px">活动记录</h4>
        <div class="feed">
          ${DB.list('activities').slice(0, 3).map((a) => { const au = DB.userById(a.userId); return `<div class="feed-item">${avatar(au, 'sm')}<div><div class="txt"><b>${esc(au.name)}</b> ${esc(a.action)}</div><div class="time">${fromNow(a.time)}</div></div></div>`; }).join('')}
        </div>`,
      footer: `<button class="btn" data-close>关闭</button>
        <button class="btn" data-edit>${icon('edit', 15)} 编辑</button>
        <button class="btn btn-primary" data-done>${icon('check', 15)} 标记完成</button>`,
      onMount(api) {
        api.el.querySelector('[data-edit]').onclick = () => { const p = DB.find('projects', w.projectId); api.close(); itemModal(w.id, p); };
        api.el.querySelector('[data-done]').onclick = () => { DB.update('workItems', w.id, { status: '已完成' }); api.close(); UI.toast('已标记完成', 'success'); App.render(); };
      },
    });
  }

  /* -------- 新建项目 -------- */
  function newProjectModal() {
    const body = `<div class="form-grid">
      <div class="field span-2"><label>项目名称 *</label><input class="input" name="name" placeholder="例如：协同办公平台 V3.0" /></div>
      <div class="field"><label>标识符 *</label><input class="input" name="identifier" placeholder="OAV3" /></div>
      <div class="field"><label>开发模型</label><select class="select" name="type"><option>Scrum</option><option>Kanban</option><option>瀑布</option></select></div>
      <div class="field"><label>负责人</label><select class="select" name="owner">${DB.list('users').map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label>开始日期</label><input class="input" name="startDate" type="date" value="${DB.dateOnly(new Date().toISOString())}" /></div>
      <div class="field"><label>结束日期</label><input class="input" name="endDate" type="date" value="${DB.dateOnly(DB.daysAhead(60))}" /></div>
      <div class="field"><label>关联产品</label><select class="select" name="productId">${DB.list('products').map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field span-2"><label>项目描述</label><textarea class="input" name="desc" rows="2"></textarea></div>
    </div>`;
    UI.modal({
      title: '新建项目', body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>创建</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.name.trim()) { UI.toast('请填写项目名称', 'error'); return; }
          DB.insert('projects', { ...v, status: '进行中', progress: 0, color: '#23d3a9', members: [v.owner] });
          DB.logActivity('u1', '创建了项目', v.name);
          api.close(); UI.toast('项目已创建', 'success'); App.render();
        };
      },
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.project = render;
})();
