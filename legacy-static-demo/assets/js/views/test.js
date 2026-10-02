/* 测试管理：测试库 · 用例 · 测试计划 · 执行报告 */
(function () {
  const { icon, esc, userCell, fmtDate, fromNow, donut, barChart, ring } = UI;
  const RESULTS = [['通过', '#23d3a9'], ['失败', '#ff7a6b'], ['阻塞', '#ffb020'], ['未执行', '#a3bdb7']];
  let tab = 'cases';

  function render() {
    const cases = DB.list('testCases');
    const plans = DB.list('testPlans');
    const pass = cases.filter((c) => (planResult(null, c) === '通过')).length;
    const rate = cases.length ? Math.round((pass / cases.length) * 100) : 0;

    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>测试管理</h2><p>用例维护、测试计划编排与执行，自动汇总测试报告</p></div>
        <div class="actions">
          <button class="btn" data-new-plan>${icon('plus', 16)} 新建测试计划</button>
          <button class="btn btn-primary" data-new-case>${icon('plus', 16)} 新建用例</button>
        </div>
      </div>

      <div class="grid g-4 mb-4">
        ${stat('用例总数', cases.length, 'test', 'var(--mint-50)', 'var(--mint-700)')}
        ${stat('通过率', rate + '%', 'checkCircle', '#e8f7fe', '#0284c7')}
        ${stat('待执行', cases.filter((c) => planResult(null, c) === '未执行').length, 'clock', '#fff6e5', '#c2820f')}
        ${stat('失败 / 阻塞', cases.filter((c) => ['失败', '阻塞'].includes(planResult(null, c))).length, 'bug', '#ffefec', '#d64534')}
      </div>

      <div class="tabs">
        ${[['cases', '测试用例'], ['plans', '测试计划'], ['report', '测试报告']].map(([k, l]) =>
          `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <div id="tb"></div>`;

    const tb = el.querySelector('#tb');
    function paint() {
      if (tab === 'cases') tb.innerHTML = casesHtml();
      else if (tab === 'plans') tb.innerHTML = plansHtml();
      else tb.innerHTML = reportHtml();
      bind(tb);
    }
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); paint(); return; }
      if (e.target.closest('[data-new-case]')) newCaseModal();
      if (e.target.closest('[data-new-plan]')) newPlanModal();
    });
    paint();
    return el;
  }

  function planResult(plan, c) { return plan && plan.results && plan.results[c.id] ? plan.results[c.id] : c.lastResult; }
  function resultBadge(r) { const k = { '通过': 'green', '失败': 'red', '阻塞': 'orange', '未执行': 'gray' }[r] || 'gray'; return `<span class="badge ${k}"><span class="dot"></span>${esc(r)}</span>`; }

  function stat(l, v, ic, bg, color) {
    return `<div class="stat"><div class="lbl">${esc(l)}</div><div class="val">${v}</div>
      <div class="stat-ico" style="background:${bg};color:${color}">${icon(ic, 19)}</div></div>`;
  }

  function casesHtml() {
    const libs = DB.list('testLibraries');
    const cases = DB.list('testCases');
    return `<div class="grid g-2-1">
      <div>
        <div class="filters">
          <div class="search-input" style="width:230px">${icon('search', 16)}<input class="input" id="cq" placeholder="搜索用例" /></div>
          <select class="select" id="clib" style="width:200px"><option value="">全部测试库</option>${libs.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select>
        </div>
        <div class="card"><div class="table-wrap"><table class="tbl">
          <thead><tr><th style="width:120px">编号</th><th>用例标题</th><th style="width:110px">模块</th><th style="width:70px">优先级</th><th style="width:110px">最近结果</th><th style="width:110px">维护人</th></tr></thead>
          <tbody id="casesBody">${caseRows(cases)}</tbody>
        </table></div></div>
      </div>
      <div class="card"><div class="card-head"><h3>执行结果分布</h3></div>
        <div class="card-pad">${donut(RESULTS.map(([r, c]) => ({ label: r, value: cases.filter((x) => x.lastResult === r).length, color: c })), { centerLabel: '用例' })}</div>
      </div>
    </div>`;
  }
  function caseRows(cases) {
    if (!cases.length) return `<tr><td colspan="6">${UI.empty('暂无用例', '', 'test')}</td></tr>`;
    return cases.map((c) => `<tr>
      <td class="mono fs-12 muted">${esc(c.code)}</td>
      <td><span class="c-title" data-case="${c.id}">${esc(c.title)}</span>
        <div class="fs-12 text-3">${esc(c.type)} · ${esc(c.libraryId === 'tl1' ? '协同办公平台测试库' : '数据中台测试库')}</div></td>
      <td><span class="tag fs-12">${esc(c.module)}</span></td>
      <td><span class="prio"><span class="pbar" style="background:${prioColor(c.priority)}"></span>${esc(c.priority)}</span></td>
      <td>${resultBadge(c.lastResult)}</td>
      <td>${userCell(DB.userById(c.maintainer))}</td>
    </tr>`).join('');
  }

  function plansHtml() {
    const plans = DB.list('testPlans');
    if (!plans.length) return UI.empty('暂无测试计划', '', 'calendar');
    return `<div class="grid g-2">${plans.map((p) => {
      const cases = p.caseIds.map((id) => DB.find('testCases', id)).filter(Boolean);
      const ex = cases.filter((c) => planResult(p, c) !== '未执行').length;
      const pass = cases.filter((c) => planResult(p, c) === '通过').length;
      const prog = cases.length ? Math.round((ex / cases.length) * 100) : 0;
      return `<div class="card card-pad">
        <div class="flex items-center gap-2 mb-3">
          <span class="badge ${DB.statusKind(p.status)}">${esc(p.status)}</span>
          <b style="font-size:15px">${esc(p.name)}</b>
        </div>
        <dl class="kv" style="grid-template-columns:88px 1fr;font-size:13px">
          <dt>所属项目</dt><dd>${esc((DB.find('projects', p.projectId) || {}).name || '—')}</dd>
          <dt>周期</dt><dd>${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)}</dd>
          <dt>负责人</dt><dd>${userCell(DB.userById(p.owner))}</dd>
        </dl>
        <div class="mt-3"><div class="progress"><i style="width:${prog}%"></i></div>
          <div class="flex items-center" style="justify-content:space-between;margin-top:7px">
            <span class="hint">已执行 ${ex}/${cases.length}</span><span class="hint">通过 ${pass} · 失败 ${ex - pass}</span></div></div>
        <button class="btn btn-primary btn-block mt-3" data-exec="${p.id}">${icon('play', 15)} 执行测试计划</button>
      </div>`;
    }).join('')}</div>`;
  }

  function reportHtml() {
    const cases = DB.list('testCases');
    const byModule = {};
    cases.forEach((c) => { byModule[c.module] = (byModule[c.module] || 0) + 1; });
    const items = Object.keys(byModule).slice(0, 8).map((m) => ({ label: m, value: byModule[m] }));
    const pass = cases.filter((c) => c.lastResult === '通过').length;
    return `<div class="grid g-2-1">
      <div class="card"><div class="card-head"><h3>各模块用例数量</h3></div><div class="card-pad">${barChart(items, { height: 200 })}</div></div>
      <div class="card"><div class="card-head"><h3>本次回归概览</h3></div>
        <div class="card-pad" style="text-align:center">
          ${ring(cases.length ? Math.round((pass / cases.length) * 100) : 0, 128, '#23d3a9', '用例通过率')}
          <div class="hr"></div>
          ${RESULTS.map(([r, c]) => `<div class="flex items-center mt-2" style="justify-content:space-between;font-size:13px">
            <span class="flex items-center gap-2"><span style="width:9px;height:9px;border-radius:3px;background:${c}"></span>${r}</span>
            <b>${cases.filter((x) => x.lastResult === r).length}</b></div>`).join('')}
        </div></div>
    </div>`;
  }

  function bind(root) {
    root.querySelectorAll('[data-case]').forEach((n) => n.addEventListener('click', () => caseDrawer(n.dataset.case)));
    root.querySelectorAll('[data-exec]').forEach((n) => n.addEventListener('click', () => execDrawer(n.dataset.exec)));
    const cq = root.querySelector('#cq');
    if (cq) cq.addEventListener('input', (e) => {
      const v = e.target.value;
      const rows = DB.list('testCases').filter((c) => c.title.includes(v) || c.code.includes(v));
      root.querySelector('#casesBody').innerHTML = caseRows(rows);
      root.querySelectorAll('[data-case]').forEach((n) => n.addEventListener('click', () => caseDrawer(n.dataset.case)));
    });
    const clib = root.querySelector('#clib');
    if (clib) clib.addEventListener('change', (e) => {
      const v = e.target.value;
      const rows = DB.list('testCases').filter((c) => !v || c.libraryId === v);
      root.querySelector('#casesBody').innerHTML = caseRows(rows);
      root.querySelectorAll('[data-case]').forEach((n) => n.addEventListener('click', () => caseDrawer(n.dataset.case)));
    });
  }

  function prioColor(p) { return { 紧急: '#ff7a6b', 高: '#ff7a6b', 中: '#ffb020', 低: '#a3bdb7' }[p] || '#a3bdb7'; }

  /* -------- 用例详情 -------- */
  function caseDrawer(id) {
    const c = DB.find('testCases', id);
    if (!c) return;
    UI.drawer({
      title: c.title, subtitle: `${esc(c.code)} · ${esc(c.module)} · ${esc(c.type)}`,
      body: `
        <div class="flex items-center gap-2 mb-4">
          ${resultBadge(c.lastResult)}
          <span class="prio"><span class="pbar" style="background:${prioColor(c.priority)}"></span>${esc(c.priority)}优先级</span>
          <span class="spacer"></span><span class="hint">更新于 ${fromNow(c.updatedAt)}</span>
        </div>
        <h4 style="font-weight:700;margin-bottom:8px">前置条件</h4>
        <p class="text-2 fs-13" style="margin-bottom:14px">${esc(c.precondition)}</p>
        <h4 style="font-weight:700;margin-bottom:8px">测试步骤</h4>
        <ol class="doc-body" style="font-size:13.5px;padding-left:20px;margin-bottom:14px">
          ${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}
        </ol>
        <h4 style="font-weight:700;margin-bottom:8px">预期结果</h4>
        <p class="text-2 fs-13">${esc(c.expected)}</p>
        <div class="hr"></div>
        <h4 style="font-weight:700;margin-bottom:10px">执行结果</h4>
        <div class="flex gap-2 wrap">
          ${RESULTS.map(([r, col]) => `<button class="btn btn-sm" data-set="${r}" style="${c.lastResult === r ? `border-color:${col};color:${col};background:${col}18` : ''}">${esc(r)}</button>`).join('')}
        </div>`,
      onMount(api) {
        api.el.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
          DB.update('testCases', c.id, { lastResult: b.dataset.set, updatedAt: new Date().toISOString() });
          DB.logActivity('u1', '提交了测试结果', `${c.code} ${c.title} · ${b.dataset.set}`);
          UI.toast(`已标记为「${b.dataset.set}」`, b.dataset.set === '失败' ? 'error' : 'success');
          api.close(); App.render();
        });
      },
    });
  }

  /* -------- 执行测试计划 -------- */
  function execDrawer(planId) {
    const p = DB.find('testPlans', planId);
    if (!p) return;
    const render = (api) => {
      const cases = p.caseIds.map((id) => DB.find('testCases', id)).filter(Boolean);
      const ex = cases.filter((c) => planResult(p, c) !== '未执行').length;
      api.body.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <div style="flex:1"><div class="progress"><i style="width:${cases.length ? (ex / cases.length) * 100 : 0}%"></i></div>
            <div class="hint mt-2">已执行 ${ex} / ${cases.length}</div></div>
          ${ring(Math.round((cases.filter((c) => planResult(p, c) === '通过').length / (cases.length || 1)) * 100), 76, '#23d3a9')}
        </div>
        <div class="form-grid">
          ${cases.map((c) => `<div class="list-row" style="border:1px solid var(--glass-border);background:rgba(255,255,255,.45)">
            <div class="grow"><b>${esc(c.title)}</b><small>${esc(c.code)} · ${esc(c.module)}</small></div>
            ${resultBadge(planResult(p, c))}
            <div class="row-actions" style="opacity:1">
              ${RESULTS.slice(0, 3).map(([r, col]) => `<button class="btn btn-sm" data-r="${r}" data-c="${c.id}" style="color:${col}">${esc(r[0])}</button>`).join('')}
            </div>
          </div>`).join('')}
        </div>`;
      api.body.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
        const cur = DB.find('testPlans', planId);
        const results = Object.assign({}, cur.results || {});
        results[b.dataset.c] = b.dataset.r;
        DB.update('testPlans', planId, { results });
        const tc = DB.find('testCases', b.dataset.c);
        DB.update('testCases', b.dataset.c, { lastResult: b.dataset.r, updatedAt: new Date().toISOString() });
        Object.assign(p, DB.find('testPlans', planId));
        if (b.dataset.r === '失败') {
          const automation = DB.list('automations').find((a) => a.id === 'a3');
          if (automation && automation.enabled) {
            DB.insert('workItems', { title: `【缺陷】${tc.title} 执行失败`, type: '缺陷', priority: '高', status: '待处理', assignee: tc.maintainer, points: 2, projectId: 'proj1', endDate: DB.dateOnly(DB.daysAhead(3)), code: 'OAV2-' + (200 + DB.list('workItems').length) });
            UI.toast('已自动创建缺陷并指派', 'info');
          }
        }
        render(api);
        App.renderNav && App.renderNav();
      });
    };
    UI.drawer({
      title: `执行：${p.name}`,
      subtitle: `${fmtDate(p.startDate)} ~ ${fmtDate(p.endDate)} · 负责人 ${DB.userById(p.owner).name}`,
      body: '', footer: `<button class="btn btn-primary" data-close>完成执行</button>`,
      onMount: render,
    });
  }

  /* -------- 新建用例 / 计划 -------- */
  function newCaseModal() {
    const body = `<div class="form-grid">
      <div class="field span-2"><label>用例标题 *</label><input class="input" name="title" /></div>
      <div class="field"><label>测试库</label><select class="select" name="libraryId">${DB.list('testLibraries').map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
      <div class="field"><label>所属模块</label><input class="input" name="module" value="通用" /></div>
      <div class="field"><label>类型</label><select class="select" name="type"><option>功能</option><option>接口</option><option>性能</option><option>兼容</option></select></div>
      <div class="field"><label>优先级</label><select class="select" name="priority"><option>高</option><option selected>中</option><option>低</option></select></div>
      <div class="field span-2"><label>前置条件</label><input class="input" name="precondition" value="用户已登录且拥有对应权限" /></div>
      <div class="field span-2"><label>测试步骤（每行一步）</label><textarea class="input" name="steps" rows="3">进入目标页面\n执行操作\n观察结果</textarea></div>
      <div class="field span-2"><label>预期结果</label><input class="input" name="expected" value="系统按预期返回结果，数据一致且无异常。" /></div>
    </div>`;
    UI.modal({
      title: '新建测试用例', wide: true, body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.title.trim()) { UI.toast('请填写用例标题', 'error'); return; }
          const lib = DB.find('testLibraries', v.libraryId);
          DB.insert('testCases', { ...v, code: `${lib.name.includes('数据') ? 'DATA' : 'OA'}-TC-${String(DB.list('testCases').length + 1).padStart(3, '0')}`, steps: v.steps.split('\n').filter(Boolean), maintainer: 'u4', lastResult: '未执行' });
          api.close(); UI.toast('用例已创建', 'success'); App.render();
        };
      },
    });
  }
  function newPlanModal() {
    const body = `<div class="form-grid">
      <div class="field span-2"><label>计划名称 *</label><input class="input" name="name" /></div>
      <div class="field"><label>关联项目</label><select class="select" name="projectId">${DB.list('projects').map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="field"><label>负责人</label><select class="select" name="owner">${DB.list('users').map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
      <div class="field"><label>开始日期</label><input class="input" name="startDate" type="date" value="${DB.dateOnly(new Date().toISOString())}" /></div>
      <div class="field"><label>结束日期</label><input class="input" name="endDate" type="date" value="${DB.dateOnly(DB.daysAhead(7))}" /></div>
      <div class="field span-2"><label>选择用例</label>
        <div style="max-height:180px;overflow:auto;border:1px solid var(--glass-border);border-radius:12px;padding:8px;background:rgba(255,255,255,.4)">
        ${DB.list('testCases').map((c) => `<label class="flex items-center gap-2" style="padding:5px 6px;font-size:13px"><input type="checkbox" class="plan-case" value="${c.id}" /> ${esc(c.code)} ${esc(c.title)}</label>`).join('')}
        </div></div>
    </div>`;
    UI.modal({
      title: '新建测试计划', wide: true, body,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>创建</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          const ids = [...api.body.querySelectorAll('.plan-case:checked')].map((x) => x.value);
          if (!v.name.trim()) { UI.toast('请填写计划名称', 'error'); return; }
          if (!ids.length) { UI.toast('请至少选择一条用例', 'error'); return; }
          DB.insert('testPlans', { ...v, status: '进行中', libraryId: DB.find('testCases', ids[0]).libraryId, caseIds: ids, results: {} });
          api.close(); UI.toast('测试计划已创建', 'success'); tab = 'plans'; App.render();
        };
      },
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.test = render;
})();
