/* 效能度量：仪表盘 · 报表 */
(function () {
  const { icon, esc, lineChart, barChart, donut, ring, userCell } = UI;
  let tab = 'dash';

  function render() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>效能度量</h2><p>自动采集研发过程数据，以可视化仪表盘呈现效能洞察</p></div>
        <div class="actions">
          <select class="select" style="width:150px"><option>近 30 天</option><option>近 90 天</option><option>本季度</option></select>
          <button class="btn" data-export>${icon('download', 16)} 导出报告</button>
        </div>
      </div>
      <div class="tabs">${[['dash', '效能仪表盘'], ['report', '效能报表']].map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tb"></div>`;
    const tb = el.querySelector('#tb');
    const paint = () => { tb.innerHTML = tab === 'dash' ? dashHtml() : reportHtml(); bind(tb); };
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); paint(); return; }
      if (e.target.closest('[data-export]')) UI.toast('效能报告已导出为 PDF', 'success');
    });
    paint();
    return el;
  }

  function dashHtml() {
    const items = DB.list('workItems');
    const cases = DB.list('testCases');
    const completed = items.filter((w) => w.status === '已完成').length;
    const totalPoints = items.reduce((a, b) => a + b.points, 0);
    const bugCount = items.filter((w) => w.type === '缺陷').length;
    const passRate = Math.round((cases.filter((c) => c.lastResult === '通过').length / (cases.length || 1)) * 100);

    const burndown = [
      { label: 'D1', value: 120 }, { label: 'D2', value: 118 }, { label: 'D3', value: 104 }, { label: 'D4', value: 96 },
      { label: 'D5', value: 96 }, { label: 'D6', value: 78 }, { label: 'D7', value: 70 }, { label: 'D8', value: 52 },
      { label: 'D9', value: 44 }, { label: 'D10', value: 30 },
    ];
    const ideal = burndown.map((p, i) => ({ label: p.label, value: Math.round(120 - i * 12) }));
    const defects = [
      { label: 'W1', value: 12 }, { label: 'W2', value: 9 }, { label: 'W3', value: 14 }, { label: 'W4', value: 7 },
      { label: 'W5', value: 11 }, { label: 'W6', value: 5 },
    ];
    const fixed = [
      { label: 'W1', value: 8 }, { label: 'W2', value: 11 }, { label: 'W3', value: 10 }, { label: 'W4', value: 9 },
      { label: 'W5', value: 12 }, { label: 'W6', value: 6 },
    ];

    return `
      <div class="grid g-4 mb-4">
        ${stat('交付速率', '61', '点/迭代', 'zap', '#e6fbf5', '#0c8a6c', '+18%')}
        ${stat('需求交付周期', '9.4', '天', 'clock', '#e8f7fe', '#0284c7', '-12%')}
        ${stat('缺陷密度', '0.18', '个/点', 'bug', '#ffefec', '#d64534', '-25%')}
        ${stat('用例通过率', passRate + '%', '质量', 'shield', '#f1eefe', '#6d5dd3', '+6%')}
      </div>

      <div class="grid g-2-1 mb-4">
        <div class="card"><div class="card-head"><h3>迭代燃尽图</h3><span class="sub">剩余故事点 vs 理想线</span></div>
          <div class="card-pad">${lineChart(burndown, { series: [burndown, ideal], color: '#23d3a9', color2: '#a3bdb7', width: 560, height: 200 })}
            <div class="chart-legend"><span class="item"><span class="sw" style="background:#23d3a9"></span>实际剩余</span>
              <span class="item"><span class="sw" style="background:#a3bdb7"></span>理想线</span></div></div></div>
        <div class="card"><div class="card-head"><h3>团队产能分布</h3></div>
          <div class="card-pad">${donut([
            { label: '开发', value: 42, color: '#23d3a9' }, { label: '测试', value: 18, color: '#ffb020' },
            { label: '设计', value: 12, color: '#8b7cf6' }, { label: '管理', value: 8, color: '#38bdf8' },
          ], { centerLabel: '故事点', size: 160 })}</div></div>
      </div>

      <div class="grid g-2 mb-4">
        <div class="card"><div class="card-head"><h3>迭代速率</h3><span class="sub">近 6 个迭代</span></div>
          <div class="card-pad">${barChart([{ label: 'S1', value: 32 }, { label: 'S2', value: 41 }, { label: 'S3', value: 38 }, { label: 'S4', value: 52 }, { label: 'S5', value: 47 }, { label: 'S6', value: 61 }])}</div></div>
        <div class="card"><div class="card-head"><h3>缺陷新增 vs 修复</h3><span class="sub">近 6 周</span>
            <div class="right"><span class="badge green">净减少 4</span></div></div>
          <div class="card-pad">${lineChart(defects, { series: [defects, fixed], color: '#ff7a6b', color2: '#23d3a9', width: 560, height: 190 })}
            <div class="chart-legend"><span class="item"><span class="sw" style="background:#ff7a6b"></span>新增缺陷</span>
              <span class="item"><span class="sw" style="background:#23d3a9"></span>修复缺陷</span></div></div></div>
      </div>

      <div class="grid g-3">
        ${kpiRing('迭代目标达成', 82, 'On-time')}
        ${kpiRing('代码评审覆盖', 94, 'Review')}
        ${kpiRing('自动化测试覆盖', 67, 'Auto')}
      </div>`;
  }

  function kpiRing(label, val, tag) {
    return `<div class="card card-pad" style="text-align:center">
      <div class="flex items-center" style="justify-content:space-between"><b class="fs-13">${esc(label)}</b><span class="badge indigo">${esc(tag)}</span></div>
      <div class="mt-3">${ring(val, 112, '#23d3a9')}</div>
    </div>`;
  }

  function reportHtml() {
    const users = DB.list('users');
    const items = DB.list('workItems');
    const rows = users.map((u) => {
      const mine = items.filter((w) => w.assignee === u.id);
      const done = mine.filter((w) => w.status === '已完成');
      const pts = done.reduce((a, b) => a + b.points, 0);
      return { u, total: mine.length, done: done.length, pts };
    }).sort((a, b) => b.pts - a.pts);
    return `<div class="card">
      <div class="card-head"><h3>成员效能报表</h3><span class="sub">按完成故事点排序</span>
        <div class="right"><span class="chip">${icon('clock', 13)} 近 30 天</span></div></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>成员</th><th style="width:110px">部门</th><th style="width:100px">工作项</th><th style="width:100px">已完成</th><th style="width:110px">完成故事点</th><th>交付占比</th></tr></thead>
        <tbody>${rows.map((r) => {
          const max = rows[0].pts || 1;
          return `<tr>
            <td>${userCell(r.u)}</td>
            <td class="muted fs-12">${esc(r.u.dept)}</td>
            <td class="num">${r.total}</td>
            <td class="num">${r.done}</td>
            <td class="num fw-7">${r.pts}</td>
            <td><div class="flex items-center gap-2"><div class="progress" style="width:130px"><i style="width:${(r.pts / max) * 100}%"></i></div><span class="hint">${Math.round((r.pts / max) * 100)}%</span></div></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <div class="grid g-2 mt-4">
      <div class="card"><div class="card-head"><h3>需求交付周期趋势</h3></div>
        <div class="card-pad">${lineChart([{ label: '3月', value: 12.4 }, { label: '4月', value: 11.2 }, { label: '5月', value: 10.8 }, { label: '6月', value: 9.9 }, { label: '7月', value: 9.4 }], { width: 520, height: 180 })}</div></div>
      <div class="card"><div class="card-head"><h3>各类型工作项分布</h3></div>
        <div class="card-pad">${barChart(['任务', '需求', '缺陷', '子任务'].map((t) => ({ label: t, value: items.filter((w) => w.type === t).length })), { height: 180 })}</div></div>
    </div>`;
  }

  function stat(l, v, unit, ic, bg, color, trend) {
    return `<div class="stat"><div class="lbl">${icon(ic, 14)} ${esc(l)}</div>
      <div class="val">${v}<small>${esc(unit)}</small></div>
      <div class="foot"><span class="${trend && trend.startsWith('-') ? 'trend-down' : 'trend-up'}">${esc(trend || '')}</span> 环比上期</div>
      <div class="stat-ico" style="background:${bg};color:${color}">${icon(ic, 19)}</div></div>`;
  }
  function bind() {}

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.metrics = render;
})();
