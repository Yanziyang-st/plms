/* 自动化：规则配置与运行概览 */
(function () {
  const { icon, esc, fromNow, donut, barChart } = UI;

  function render() {
    const rules = DB.list('automations');
    const enabled = rules.filter((r) => r.enabled).length;
    const totalRuns = rules.reduce((a, b) => a + b.runs, 0);
    const el = document.createElement('div');

    el.innerHTML = `
      <div class="page-head">
        <div><h2>自动化</h2><p>通过触发规则自动完成重复性任务，降低人工成本与错误率</p></div>
        <div class="actions">
          <button class="btn" data-template>${icon('sparkles', 16)} 从模板创建</button>
          <button class="btn btn-primary" data-new>${icon('plus', 16)} 新建规则</button>
        </div>
      </div>

      <div class="grid g-4 mb-4">
        ${stat('规则总数', rules.length, 'automation', '#e6fbf5', '#0c8a6c')}
        ${stat('已启用', enabled, 'zap', '#e8f7fe', '#0284c7')}
        ${stat('累计执行', totalRuns, 'refresh', '#f1eefe', '#6d5dd3')}
        ${stat('节省人工', (totalRuns * 2) + ' 分钟', 'clock', '#fff6e5', '#c2820f')}
      </div>

      <div class="grid g-2-1 mb-4">
        <div class="card"><div class="card-head"><h3>自动化规则</h3><span class="sub">${rules.length} 条</span></div>
          <div class="card-pad" style="padding:10px">
            ${rules.map((r) => `
              <div class="card card-pad mb-3" style="background:rgba(255,255,255,.4)">
                <div class="flex items-center gap-2 mb-3">
                  <span style="width:34px;height:34px;border-radius:11px;background:${r.enabled ? 'var(--mint-grad)' : 'rgba(163,189,183,.4)'};display:grid;place-items:center;color:${r.enabled ? '#04352c' : '#6f908a'};box-shadow:inset 0 1px 0 rgba(255,255,255,.6)">${icon('zap', 17)}</span>
                  <div style="flex:1"><b style="font-size:14px">${esc(r.name)}</b>
                    <div class="fs-12 text-3">${esc(r.scope)} · 已执行 ${r.runs} 次 · ${r.lastRun ? fromNow(r.lastRun) : '未执行'}</div></div>
                  <label class="switch" data-toggle="${r.id}" style="cursor:pointer">
                    <span style="display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-2)">${r.enabled ? '已启用' : '已停用'}
                    <span style="width:40px;height:22px;border-radius:20px;background:${r.enabled ? 'var(--mint-grad)' : 'rgba(163,189,183,.5)'};position:relative;transition:.2s;display:inline-block">
                      <span style="position:absolute;top:3px;left:${r.enabled ? '21px' : '3px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></span>
                    </span></span>
                  </label>
                </div>
                <div class="flex items-center gap-2 wrap fs-12">
                  <span class="chip" style="background:var(--sky-50);color:#0284c7;border-color:rgba(56,189,248,.3)">${icon('play', 12)} 当 ${esc(r.trigger)}</span>
                  ${icon('chevronRight', 14)}
                  <span class="chip" style="background:var(--amber-50);color:#c2820f;border-color:rgba(255,176,32,.3)">${icon('filter', 12)} ${esc(r.condition)}</span>
                  ${icon('chevronRight', 14)}
                  <span class="chip" style="background:var(--mint-50);color:var(--mint-700);border-color:rgba(35,211,169,.3)">${icon('zap', 12)} ${esc(r.actions.join(' + '))}</span>
                </div>
                <div class="row-actions mt-3" style="opacity:1">
                  <button class="btn btn-sm" data-edit="${r.id}">${icon('edit', 13)} 编辑</button>
                  <button class="btn btn-sm btn-ghost" data-run="${r.id}">${icon('play', 13)} 立即执行</button>
                  <button class="btn btn-sm btn-danger" data-del="${r.id}">${icon('trash', 13)} 删除</button>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div>
          <div class="card mb-4"><div class="card-head"><h3>触发类型分布</h3></div>
            <div class="card-pad">${donut([
              { label: '工作项创建时', value: rules.filter((r) => r.trigger.includes('创建')).length || 1, color: '#23d3a9' },
              { label: '状态变更时', value: rules.filter((r) => r.trigger.includes('状态')).length || 1, color: '#38bdf8' },
              { label: '执行失败时', value: rules.filter((r) => r.trigger.includes('失败')).length || 1, color: '#8b7cf6' },
            ], { centerLabel: '规则', size: 150 })}</div></div>
          <div class="card"><div class="card-head"><h3>执行次数 TOP</h3></div>
            <div class="card-pad">${barChart(rules.slice(0, 4).map((r) => ({ label: r.name.slice(0, 5), value: r.runs })), { height: 150 })}</div></div>
        </div>
      </div>`;

    el.querySelector('[data-new]').onclick = () => ruleModal(null);
    el.querySelector('[data-template]').onclick = () => {
      UI.modal({
        title: '从模板创建', body: `<div class="form-grid">
          ${[
            ['新任务默认优先级', '工作项创建时 → 设置优先级为中'],
            ['缺陷自动指派', '工作项创建时 → 通知负责人'],
            ['用例失败建缺陷', '用例执行失败时 → 创建缺陷'],
            ['迭代结束归档', '迭代状态变更时 → 移动未完成项'],
          ].map(([n, d], i) => `<div class="list-row" data-tpl="${i}"><div class="grow"><b>${esc(n)}</b><small>${esc(d)}</small></div>${icon('plus', 16)}</div>`).join('')}
        </div>`,
        onMount(api) {
          api.body.addEventListener('click', (e) => {
            const row = e.target.closest('[data-tpl]');
            if (!row) return;
            const presets = [
              { name: '新任务默认优先级', trigger: '工作项创建时', scope: '全部项目', condition: '工作项类型 = 任务', actions: ['设置优先级为「中」'] },
              { name: '缺陷自动指派', trigger: '工作项创建时', scope: '全部项目', condition: '工作项类型 = 缺陷', actions: ['通知工作项负责人'] },
              { name: '用例失败建缺陷', trigger: '用例执行失败时', scope: '全部测试库', condition: '执行结果 = 失败', actions: ['创建缺陷工作项'] },
              { name: '迭代结束归档', trigger: '迭代状态变更时', scope: '全部项目', condition: '迭代状态 = 已完成', actions: ['移动未完成工作项'] },
            ][+row.dataset.tpl];
            DB.insert('automations', { ...presets, enabled: true, runs: 0, lastRun: null });
            api.close(); UI.toast('已从模板创建规则', 'success'); App.render();
          });
        },
      });
    };
    el.querySelectorAll('[data-toggle]').forEach((n) => n.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = DB.find('automations', n.dataset.toggle);
      DB.update('automations', r.id, { enabled: !r.enabled });
      UI.toast(r.enabled ? '规则已停用' : '规则已启用', 'success');
      App.render();
    }));
    el.querySelectorAll('[data-run]').forEach((n) => n.addEventListener('click', () => {
      const r = DB.find('automations', n.dataset.run);
      DB.update('automations', r.id, { runs: r.runs + 1, lastRun: new Date().toISOString() });
      UI.toast(`规则「${r.name}」已执行一次`, 'success'); App.render();
    }));
    el.querySelectorAll('[data-edit]').forEach((n) => n.addEventListener('click', () => ruleModal(n.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach((n) => n.addEventListener('click', () => {
      const r = DB.find('automations', n.dataset.del);
      UI.modal({
        title: '删除规则', body: `<p>确定删除规则 <b>${esc(r.name)}</b>？</p>`,
        footer: `<button class="btn" data-close>取消</button><button class="btn btn-danger" data-ok>删除</button>`,
        onMount(api) { api.el.querySelector('[data-ok]').onclick = () => { DB.remove('automations', r.id); api.close(); UI.toast('已删除', 'success'); App.render(); }; },
      });
    }));
    return el;
  }

  function stat(l, v, ic, bg, color) {
    return `<div class="stat"><div class="lbl">${esc(l)}</div><div class="val">${v}</div>
      <div class="stat-ico" style="background:${bg};color:${color}">${icon(ic, 19)}</div></div>`;
  }

  function ruleModal(id) {
    const r = id ? DB.find('automations', id) : null;
    UI.modal({
      title: r ? '编辑自动化规则' : '新建自动化规则', wide: true,
      body: `<div class="form-grid">
        <div class="field span-2"><label>规则名称 *</label><input class="input" name="name" value="${esc(r ? r.name : '')}" placeholder="例如：新任务自动设置优先级" /></div>
        <div class="field"><label>触发时机</label><select class="select" name="trigger">
          ${['工作项创建时', '工作项状态变更时', '用例执行失败时', '迭代状态变更时', '每日定时'].map((t) => `<option ${r && r.trigger === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>生效范围</label><input class="input" name="scope" value="${esc(r ? r.scope : '全部项目')}" /></div>
        <div class="field span-2"><label>触发条件</label><input class="input" name="condition" value="${esc(r ? r.condition : '')}" placeholder="例如：工作项类型 = 缺陷" /></div>
        <div class="field span-2"><label>执行动作（多个用 + 分隔）</label><input class="input" name="actions" value="${esc(r ? r.actions.join(' + ') : '')}" placeholder="例如：通知负责人 + 添加标签" /></div>
      </div>`,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>保存</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.name.trim()) { UI.toast('请填写规则名称', 'error'); return; }
          const payload = { name: v.name, trigger: v.trigger, scope: v.scope, condition: v.condition || '无', actions: v.actions.split('+').map((s) => s.trim()).filter(Boolean) };
          if (r) DB.update('automations', r.id, payload);
          else DB.insert('automations', { ...payload, enabled: true, runs: 0, lastRun: null });
          api.close(); UI.toast('规则已保存', 'success'); App.render();
        };
      },
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.automation = render;
})();
