/* ==========================================================================
   PLMS 应用外壳：布局 / 侧边导航 / 顶栏 / 路由
   ========================================================================== */
(function (global) {
  'use strict';
  const { icon, esc, avatar } = UI;

  const NAV = [
    { group: '概览' },
    { key: 'dashboard', label: '工作台', icon: 'dashboard' },
    { group: '研发管理' },
    { key: 'product', label: '产品管理', icon: 'product' },
    { key: 'project', label: '项目管理', icon: 'project' },
    { key: 'test', label: '测试管理', icon: 'test' },
    { key: 'knowledge', label: '知识管理', icon: 'knowledge' },
    { key: 'metrics', label: '效能度量', icon: 'metrics' },
    { key: 'collab', label: '协作空间', icon: 'collab' },
    { group: '效率与智能' },
    { key: 'automation', label: '自动化', icon: 'automation' },
    { key: 'ai', label: '智能协同', icon: 'ai' },
    { key: 'settings', label: '后台管理', icon: 'settings' },
  ];

  const META = {
    dashboard: { title: '工作台', desc: '全局概览、个人待办与团队动态', crumb: '概览' },
    product: { title: '产品管理', desc: '产品、需求、工单与需求跟踪矩阵', crumb: '研发管理' },
    project: { title: '项目管理', desc: 'Scrum / Kanban / 瀑布，工作项与迭代', crumb: '研发管理' },
    test: { title: '测试管理', desc: '测试库、用例、测试计划与执行报告', crumb: '研发管理' },
    knowledge: { title: '知识管理', desc: '结构化空间、页面与版本沉淀', crumb: '研发管理' },
    metrics: { title: '效能度量', desc: '研发过程数据可视化与效能洞察', crumb: '研发管理' },
    collab: { title: '协作空间', desc: '话题讨论、信息共享与决策留痕', crumb: '研发管理' },
    automation: { title: '自动化', desc: '配置触发规则，自动化重复性流程', crumb: '效率与智能' },
    ai: { title: '智能协同', desc: '六类软件工程智能体与 AI 助手', crumb: '效率与智能' },
    settings: { title: '后台管理', desc: '成员、权限与系统配置', crumb: '效率与智能' },
  };

  /* ---------------- 骨架 ---------------- */
  function buildShell() {
    const user = DB.userById((DB.getSession() || {}).userId || 'u1');
    const app = document.getElementById('app');
    app.className = 'app';
    app.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <span class="brand-logo">M</span>
          <span class="brand-name">Mint PLM<small>LIFECYCLE</small></span>
        </div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot">
          <div class="side-user" id="sideUser">
            ${avatar(user)}
            <div class="meta"><b>${esc(user.name)}</b><small>${esc(user.role)}</small></div>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn" id="btnCollapse" title="收起/展开">${icon('menu', 19)}</button>
          <div class="crumb"><span id="crumbGroup"></span><span class="sep">/</span><b id="crumbTitle"></b></div>
          <div class="topbar-search">
            ${icon('search', 16)}
            <input id="globalSearch" placeholder="搜索需求、工作项、用例、文档…" />
            <kbd>Enter</kbd>
          </div>
          <button class="icon-btn" id="btnRefresh" title="刷新数据">${icon('refresh', 18)}</button>
          <button class="icon-btn" id="btnBell" title="通知" style="position:relative">
            ${icon('bell', 18)}
            <span style="position:absolute;top:6px;right:7px;width:8px;height:8px;border-radius:50%;background:#ff7a6b;box-shadow:0 0 0 2px #fff"></span>
          </button>
          <button class="icon-btn" id="btnUser" title="账号">${avatar(user, 'sm')}</button>
        </header>
        <main class="content" id="content"></main>
      </div>`;

    renderNav();
    bindShell();
  }

  function renderNav() {
    const cur = currentRoute().view;
    const counts = {
      product: DB.list('requirements').length,
      project: DB.list('projects').length,
      test: DB.list('testCases').length,
      knowledge: DB.list('wikiPages').length,
      collab: DB.list('topics').length,
      automation: DB.list('automations').length,
    };
    document.getElementById('nav').innerHTML = NAV.map((n) => {
      if (n.group) return `<div class="nav-group-title">${esc(n.group)}</div>`;
      return `<a class="nav-item ${n.key === cur ? 'active' : ''}" href="#/${n.key}">
        ${icon(n.icon, 18)}<span>${esc(n.label)}</span>
        ${counts[n.key] ? `<span class="badge-count">${counts[n.key]}</span>` : ''}</a>`;
    }).join('');
    const meta = META[cur] || META.dashboard;
    document.getElementById('crumbGroup').textContent = meta.crumb;
    document.getElementById('crumbTitle').textContent = meta.title;
  }

  /* ---------------- 事件 ---------------- */
  function bindShell() {
    document.getElementById('btnCollapse').onclick = () => document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('btnRefresh').onclick = () => { DB.load(); render(); UI.toast('数据已刷新', 'success'); };
    document.getElementById('btnBell').onclick = (e) => showNotifications(e.currentTarget);
    document.getElementById('btnUser').onclick = (e) => showUserMenu(e.currentTarget);
    document.getElementById('sideUser').onclick = (e) => showUserMenu(e.currentTarget);
    document.getElementById('globalSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') doGlobalSearch(e.target.value.trim()); });
  }

  function showNotifications(anchor) {
    const acts = DB.list('activities').slice(0, 6);
    UI.menu(anchor, [{ label: '通知中心', icon: 'bell', onClick: () => {} }, { divider: true }].concat(
      acts.map((a) => ({
        icon: 'checkCircle',
        label: `${DB.userById(a.userId).name} ${a.action}`.slice(0, 26) + '…',
        onClick: () => UI.toast(a.target, 'info'),
      }))
    ).concat([{ divider: true }, { label: '全部标记为已读', icon: 'check', onClick: () => UI.toast('已全部标记为已读', 'success') }]));
  }

  function showUserMenu(anchor) {
    const u = DB.userById((DB.getSession() || {}).userId || 'u1');
    UI.menu(anchor, [
      { label: `${u.name} · ${u.role}`, icon: 'user', onClick: () => UI.toast(`${u.name}（${u.role}）`, 'info') },
      { divider: true },
      { label: '切换账号', icon: 'users', onClick: switchUser },
      { label: '重置演示数据', icon: 'refresh', onClick: () => { DB.reset(); UI.toast('演示数据已重置', 'success'); render(); renderNav(); } },
      { divider: true },
      { label: '退出登录', icon: 'logout', danger: true, onClick: () => { DB.clearSession(); location.reload(); } },
    ]);
  }

  function switchUser() {
    const users = DB.list('users');
    UI.modal({
      title: '切换账号',
      body: `<div class="form-grid">${users.map((u) => `
        <div class="list-row" data-uid="${u.id}">
          ${avatar(u)}
          <div class="grow"><b>${esc(u.name)}</b><small>${esc(u.role)} · ${esc(u.dept)}</small></div>
          ${icon('chevronRight', 16)}
        </div>`).join('')}</div>`,
      onMount(api) {
        api.body.addEventListener('click', (e) => {
          const row = e.target.closest('[data-uid]');
          if (!row) return;
          DB.setSession(row.dataset.uid);
          api.close();
          buildShell();
          render();
          UI.toast('已切换为 ' + DB.userById(row.dataset.uid).name, 'success');
        });
      },
    });
  }

  /* ---------------- 全局搜索 ---------------- */
  function doGlobalSearch(q) {
    if (!q) return;
    const results = [];
    DB.list('requirements').forEach((r) => { if (r.title.includes(q) || r.code.includes(q)) results.push({ type: '需求', title: r.title, sub: r.code + ' · ' + r.status, go: () => location.hash = '#/product' }); });
    DB.list('workItems').forEach((w) => { if (w.title.includes(q) || w.code.includes(q)) results.push({ type: '工作项', title: w.title, sub: w.code + ' · ' + w.status, go: () => location.hash = '#/project/' + w.projectId }); });
    DB.list('testCases').forEach((c) => { if (c.title.includes(q) || c.code.includes(q)) results.push({ type: '用例', title: c.title, sub: c.code + ' · ' + c.module, go: () => location.hash = '#/test' }); });
    DB.list('wikiPages').forEach((p) => { if (p.title.includes(q)) results.push({ type: '文档', title: p.title, sub: DB.list('wikiSpaces').find((s) => s.id === p.spaceId)?.name || '', go: () => location.hash = '#/knowledge' }); });
    DB.list('projects').forEach((p) => { if (p.name.includes(q)) results.push({ type: '项目', title: p.name, sub: p.identifier, go: () => location.hash = '#/project/' + p.id }); });
    const body = results.length ? `<div class="form-grid">${results.slice(0, 20).map((r, i) => `
      <div class="list-row" data-i="${i}"><div class="grow"><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></div><span class="badge indigo">${esc(r.type)}</span></div>`).join('')}</div>`
      : UI.empty('未找到相关结果', `没有匹配「${q}」的内容，试试其它关键词`,'search');
    const m = UI.modal({
      title: `搜索「${q}」 · ${results.length} 条结果`, wide: true, body,
      onMount(api) { api.body.addEventListener('click', (e) => { const row = e.target.closest('[data-i]'); if (!row) return; m.close(); results[+row.dataset.i].go(); }); },
    });
  }

  /* ---------------- 路由 ---------------- */
  function currentRoute() {
    const h = (location.hash || '#/dashboard').replace(/^#\//, '');
    const parts = h.split('/');
    return { view: parts[0] || 'dashboard', param: parts[1] || null };
  }
  function render() {
    const { view, param } = currentRoute();
    const fn = (global.VIEWS || {})[view] || (global.VIEWS || {}).dashboard;
    const content = document.getElementById('content');
    content.scrollTop = 0;
    content.innerHTML = '';
    try {
      const node = fn ? fn(param) : null;
      if (typeof node === 'string') content.innerHTML = node;
      else if (node instanceof Node) content.appendChild(node);
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="card card-pad">${UI.empty('页面渲染出错', String(err.message || err), 'alert')}</div>`;
    }
    renderNav();
  }

  global.App = { render, renderNav, currentRoute, META, NAV, buildShell };

  document.addEventListener('DOMContentLoaded', () => {
    DB.load();
    if (!DB.getSession()) DB.setSession('u1');
    buildShell();
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/dashboard';
    render();
  });
})(window);
