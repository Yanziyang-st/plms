/* 后台管理：成员 · 角色权限 · 系统配置 */
(function () {
  const { icon, esc, avatar, fmtDate } = UI;
  let tab = 'members';

  const ROLES = [
    { name: '管理员', desc: '系统全部权限', perms: ['产品', '项目', '测试', '知识', '度量', '协作', '自动化', '智能协同', '后台'] },
    { name: '项目经理', desc: '项目与团队管理', perms: ['产品', '项目', '度量', '协作', '自动化'] },
    { name: '产品经理', desc: '产品与需求管理', perms: ['产品', '知识', '协作', '智能协同'] },
    { name: '开发工程师', desc: '工作项与代码交付', perms: ['项目', '知识', '协作', '自动化'] },
    { name: '测试工程师', desc: '用例与测试执行', perms: ['项目', '测试', '知识'] },
  ];
  const MODULES = ['产品', '项目', '测试', '知识', '度量', '协作', '自动化', '智能协同', '后台'];

  function render() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>后台管理</h2><p>成员与角色权限、系统参数配置</p></div>
        <div class="actions"><button class="btn btn-danger" data-reset>${icon('refresh', 16)} 重置演示数据</button></div>
      </div>
      <div class="tabs">${[['members', '成员管理'], ['roles', '角色权限'], ['config', '系统配置']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tb"></div>`;
    const tb = el.querySelector('#tb');
    const paint = () => { tb.innerHTML = tab === 'members' ? membersHtml() : tab === 'roles' ? rolesHtml() : configHtml(); bind(tb, el); };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); paint(); }
    });
    paint();
    return el;
  }

  function membersHtml() {
    const users = DB.list('users');
    const items = DB.list('workItems');
    return `<div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>成员</th><th style="width:130px">角色</th><th style="width:130px">部门</th><th style="width:210px">邮箱</th><th style="width:110px">参与工作项</th><th style="width:60px"></th></tr></thead>
      <tbody>${users.map((u) => `<tr>
        <td><span class="user-cell">${avatar(u)}<span><b>${esc(u.name)}</b><div class="fs-12 text-3">@${esc(u.username)}</div></span></span></td>
        <td><span class="badge indigo">${esc(u.role)}</span></td>
        <td class="muted">${esc(u.dept)}</td>
        <td class="muted fs-13">${esc(u.email)}</td>
        <td class="num">${items.filter((w) => w.assignee === u.id).length}</td>
        <td><button class="icon-btn" style="width:28px;height:28px" data-user="${u.id}">${icon('more', 16)}</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
  }

  function rolesHtml() {
    return `<div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th style="width:140px">角色</th><th style="width:170px">说明</th>${MODULES.map((m) => `<th style="text-align:center">${esc(m)}</th>`).join('')}</tr></thead>
      <tbody>${ROLES.map((r) => `<tr>
        <td><b>${esc(r.name)}</b></td>
        <td class="muted fs-12">${esc(r.desc)}</td>
        ${MODULES.map((m) => `<td style="text-align:center">${r.perms.includes(m)
          ? `<span style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;background:var(--mint-50);color:var(--mint-700)">${icon('check', 13)}</span>`
          : '<span class="text-3">—</span>'}</td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="card-pad hint">提示：角色权限为演示数据，实际系统可对接企业统一权限中心（RBAC）。</div></div>`;
  }

  function configHtml() {
    return `<div class="grid g-2">
      <div class="card"><div class="card-head"><h3>外观主题</h3></div>
        <div class="card-pad">
          <div class="field mb-3"><label>主题色</label>
            <div class="flex gap-2 wrap">
              ${['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020', '#f472b6'].map((c, i) => `<span style="width:38px;height:38px;border-radius:12px;background:${c};cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.6);${i === 0 ? 'outline:2px solid #fff;outline-offset:2px' : ''}"></span>`).join('')}
            </div></div>
          <div class="field mb-3"><label>界面风格</label>
            <select class="select"><option>Liquid Glass 液态玻璃（当前）</option><option>经典扁平</option></select></div>
          <div class="field"><label>强调效果</label>
            <select class="select"><option>磨砂模糊 + 高光边缘</option><option>极简无模糊</option></select></div>
        </div></div>
      <div class="card"><div class="card-head"><h3>系统参数</h3></div>
        <div class="card-pad">
          <div class="field mb-3"><label>系统名称</label><input class="input" value="Mint PLM · 软件生命周期管理" /></div>
          <div class="field mb-3"><label>默认语言</label><select class="select"><option>简体中文</option><option>English</option></select></div>
          <div class="field mb-3"><label>工作日</label><select class="select"><option>周一 ~ 周五</option><option>周一 ~ 周六</option></select></div>
          <div class="flex items-center" style="justify-content:space-between"><span class="fs-13 text-2">启用 AI 智能协同</span>
            <span style="width:40px;height:22px;border-radius:20px;background:var(--mint-grad);position:relative"><span style="position:absolute;top:3px;left:21px;width:16px;height:16px;border-radius:50%;background:#fff"></span></span></div>
        </div></div>
      <div class="card" style="grid-column:1/-1"><div class="card-head"><h3>数据概览</h3></div>
        <div class="card-pad"><div class="grid g-4">
          ${[['产品', 'products'], ['需求', 'requirements'], ['项目', 'projects'], ['工作项', 'workItems'], ['用例', 'testCases'], ['测试计划', 'testPlans'], ['知识页面', 'wikiPages'], ['自动化规则', 'automations']].map(([l, k]) => `
            <div class="list-row" style="background:rgba(255,255,255,.45);border:1px solid var(--glass-border)">
              <div class="grow"><small>${esc(l)}</small><b style="font-size:20px">${DB.list(k).length}</b></div></div>`).join('')}
        </div></div></div>
    </div>`;
  }

  function bind(tb, root) {
    root.querySelector('[data-reset]').onclick = () => {
      UI.modal({
        title: '重置演示数据',
        body: '<p>将清空当前所有改动并恢复到初始演示数据，此操作不可撤销。确定继续？</p>',
        footer: `<button class="btn" data-close>取消</button><button class="btn btn-danger" data-ok>确定重置</button>`,
        onMount(api) { api.el.querySelector('[data-ok]').onclick = () => { DB.reset(); api.close(); UI.toast('已恢复演示数据', 'success'); App.render(); }; },
      });
    };
    tb.querySelectorAll('[data-user]').forEach((n) => n.addEventListener('click', () => {
      const u = DB.find('users', n.dataset.user);
      UI.menu(n, [
        { label: '查看资料', icon: 'user', onClick: () => UI.toast(`${u.name} · ${u.role} · ${u.dept}`, 'info') },
        { label: '调整角色', icon: 'shield', onClick: () => {
          UI.modal({
            title: `调整 ${u.name} 的角色`,
            body: `<div class="field"><label>角色</label><select class="select" name="role">${ROLES.map((r) => `<option ${u.role === r.name ? 'selected' : ''}>${r.name}</option>`).join('')}</select></div>`,
            footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>`,
            onMount(api) { api.el.querySelector('[data-save]').onclick = () => { DB.update('users', u.id, { role: UI.formValues(api.body).role }); api.close(); UI.toast('角色已更新', 'success'); App.render(); }; },
          });
        } },
        { label: '设为当前账号', icon: 'check', onClick: () => { DB.setSession(u.id); App.buildShell(); App.render(); UI.toast('已切换账号', 'success'); } },
      ]);
    }));
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.settings = render;
})();
