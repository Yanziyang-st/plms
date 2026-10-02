/* 工作台 */
(function () {
  const { icon, esc, avatar, fmtDate, fromNow, barChart, lineChart, donut, ring } = UI;

  function render() {
    const me = DB.userById((DB.getSession() || {}).userId || 'u1');
    const items = DB.list('workItems');
    const reqs = DB.list('requirements');
    const projects = DB.list('projects');
    const todos = items.filter((w) => w.assignee === me.id && w.status !== '已完成');
    const active = projects.filter((p) => p.status === '进行中');
    const done = items.filter((w) => w.status === '已完成');
    const myDone = done.filter((w) => w.assignee === me.id).length;

    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h2>你好，${esc(me.name)} 👋</h2>
          <p>${esc(me.dept)} · ${esc(me.role)}　今天是 ${fmtDate(new Date().toISOString())}，你有 <b style="color:var(--mint-700)">${todos.length}</b> 项待办需要处理。</p>
        </div>
        <div class="actions">
          <button class="btn" data-go="#/project">${icon('project', 16)} 查看项目</button>
          <button class="btn btn-primary" data-new-item>${icon('plus', 16)} 新建工作项</button>
        </div>
      </div>

      <div class="grid g-4 mb-4">
        ${stat('待我处理', todos.length, 'inbox', 'mint', '其中 ' + todos.filter((t) => t.priority === '高' || t.priority === '紧急').length + ' 项为高优先级', '#e6fbf5', 'var(--mint-700)')}
        ${stat('进行中项目', active.length, 'project', 'sky', '共 ' + projects.length + ' 个项目', '#e8f7fe', '#0284c7')}
        ${stat('需求总数', reqs.length, 'product', 'violet', '覆盖 ' + DB.list('products').length + ' 个产品', '#f1eefe', '#6d5dd3')}
        ${stat('我已完成', myDone, 'checkCircle', 'amber', '团队本周完成 ' + done.length + ' 项', '#fff6e5', '#c2820f')}
      </div>

      <div class="grid g-2-1 mb-4">
        <div class="card">
          <div class="card-head"><h3>迭代交付趋势</h3><span class="sub">近 6 个迭代 · 故事点</span>
            <div class="right"><span class="badge green">${icon('arrowUp', 12)} 环比 +18%</span></div></div>
          <div class="card-pad">
            ${barChart([
              { label: 'S1', value: 32 }, { label: 'S2', value: 41 }, { label: 'S3', value: 38 },
              { label: 'S4', value: 52 }, { label: 'S5', value: 47 }, { label: 'S6', value: 61 },
            ])}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>需求状态分布</h3></div>
          <div class="card-pad">${donut([
            { label: '已完成', value: reqs.filter((r) => r.status === '已完成').length, color: '#23d3a9' },
            { label: '开发中', value: reqs.filter((r) => r.status === '开发中').length, color: '#38bdf8' },
            { label: '已排期', value: reqs.filter((r) => r.status === '已排期').length, color: '#8b7cf6' },
            { label: '待评审', value: reqs.filter((r) => r.status === '待评审').length, color: '#ffb020' },
          ], { centerLabel: '需求' })}</div>
        </div>
      </div>

      <div class="grid g-2-1 mb-4">
        <div class="card">
          <div class="card-head"><h3>我的待办</h3><span class="sub">${todos.length} 项</span>
            <div class="right"><button class="btn btn-sm btn-ghost" data-go="#/project">全部 ${icon('chevronRight', 14)}</button></div></div>
          <div class="card-pad" style="padding-top:8px">
            ${todos.length ? todos.slice(0, 6).map((t) => `
              <div class="list-row" data-item="${t.id}">
                <span class="prio"><span class="pbar" style="background:${prioColor(t.priority)}"></span></span>
                <div class="grow"><b>${esc(t.title)}</b>
                  <small>${esc(t.code)} · 截止 ${fmtDate(t.endDate)}</small></div>
                <span class="badge ${DB.statusKind(t.status)}">${esc(t.status)}</span>
              </div>`).join('') : UI.empty('太棒了，暂无待办', '所有工作项都已完成', 'checkCircle')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>团队动态</h3></div>
          <div class="card-pad">
            <div class="feed">
              ${DB.list('activities').slice(0, 7).map((a) => {
                const u = DB.userById(a.userId);
                return `<div class="feed-item">${avatar(u, 'sm')}
                  <div><div class="txt"><b>${esc(u.name)}</b> ${esc(a.action)} <span class="text-2">${esc(a.target)}</span></div>
                  <div class="time">${fromNow(a.time)}</div></div></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>项目进度</h3><span class="sub">共 ${projects.length} 个项目</span></div>
        <div class="card-pad">
          <div class="grid g-3">
            ${projects.map((p) => {
              const owner = DB.userById(p.owner);
              return `<div class="list-row" data-go="#/project/${p.id}" style="align-items:flex-start;flex-direction:column;gap:12px;background:rgba(255,255,255,.4);border:1px solid var(--glass-border)">
                <div class="flex items-center gap-2" style="width:100%">
                  <span style="width:10px;height:10px;border-radius:3px;background:${p.color}"></span>
                  <b style="font-size:14px">${esc(p.name)}</b>
                  <span class="badge ${DB.statusKind(p.status)}" style="margin-left:auto">${esc(p.status)}</span>
                </div>
                <div class="fs-12 text-3">${esc(p.identifier)} · ${esc(p.type)} · ${esc(owner.name)}</div>
                <div style="width:100%"><div class="progress"><i style="width:${p.progress}%"></i></div>
                  <div class="flex items-center" style="justify-content:space-between;margin-top:8px">
                    <span class="hint">进度 ${p.progress}%</span><span class="hint">${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}</span></div></div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { location.hash = go.dataset.go; return; }
      if (e.target.closest('[data-new-item]')) { location.hash = '#/project'; return; }
      const row = e.target.closest('[data-item]');
      if (row) location.hash = '#/project';
    });
    return el;
  }

  function prioColor(p) { return { 紧急: '#ff7a6b', 高: '#ff7a6b', 中: '#ffb020', 低: '#a3bdb7' }[p] || '#a3bdb7'; }

  function stat(label, value, ic, tone, foot, bg, color) {
    return `<div class="stat">
      <div class="lbl">${esc(label)}</div>
      <div class="val">${value}<small>${esc('')}</small></div>
      <div class="foot">${esc(foot)}</div>
      <div class="stat-ico" style="background:${bg};color:${color}">${icon(ic, 20)}</div>
    </div>`;
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.dashboard = render;
})();
