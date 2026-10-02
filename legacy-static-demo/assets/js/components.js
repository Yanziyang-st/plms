/* ==========================================================================
   PLMS 通用 UI 组件：图标 / Toast / 弹窗 / 抽屉 / 菜单 / 图表 / Markdown
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------- 图标 ---------------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    product: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    project: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    test: '<path d="M9 3h6"/><path d="M10 3v6.5L5.5 17A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M8 14h8"/>',
    knowledge: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    metrics: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
    collab: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.8-.7L3 21l1.9-4.4A8.3 8.3 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z"/>',
    automation: '<path d="M13 2 4.1 12.3a1 1 0 0 0 .8 1.7H11l-1 8 8.9-10.3a1 1 0 0 0-.8-1.7H12z"/>',
    ai: '<path d="M12 2v3"/><path d="M12 19v3"/><path d="M4.9 4.9 7 7"/><path d="m17 17 2.1 2.1"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="M4.9 19.1 7 17"/><path d="m17 7 2.1-2.1"/><circle cx="12" cy="12" r="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
    more: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8L11 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
    comment: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.8-.7L3 21l1.9-4.4A8.3 8.3 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z"/>',
    play: '<path d="M6 3.5v17l14-8.5z"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    zap: '<path d="M13 2 4.1 12.3a1 1 0 0 0 .8 1.7H11l-1 8 8.9-10.3a1 1 0 0 0-.8-1.7H12z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    git: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M6 8.5v7"/><path d="M8.5 6H14a4 4 0 0 1 4 4v0"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M8 10H3M8 14H3M8 18l-3 2M16 10h5M16 14h5M16 18l3 2M12 6V3M9 6 7 4M15 6l2-2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sort: '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  };

  function icon(name, size) {
    const d = P[name] || P.dashboard;
    const s = size || 18;
    return `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  }

  /* ---------------- 工具 ---------------- */
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(iso) { return iso ? String(iso).slice(0, 10) : '—'; }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function fromNow(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} 天前`;
    return fmtDate(iso);
  }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }

  /* ---------------- 头像 / 用户 ---------------- */
  function avatar(user, cls) {
    if (!user) user = { name: '?', color: '#8b93a7' };
    return `<span class="avatar ${cls || ''}" style="background:${esc(user.color || '#23d3a9')}" title="${esc(user.name)}">${esc((user.name || '?').slice(-2))}</span>`;
  }
  function userCell(user, withName) {
    if (!user) return '<span class="text-3">未指派</span>';
    return `<span class="user-cell">${avatar(user, 'sm')}${withName === false ? '' : `<span>${esc(user.name)}</span>`}</span>`;
  }
  function avatarStack(users) {
    const arr = (users || []).slice(0, 4);
    const more = (users || []).length - arr.length;
    return `<span class="avatar-stack">${arr.map((u) => avatar(u, 'sm')).join('')}${more > 0 ? `<span class="avatar sm" style="background:#8b93a7">+${more}</span>` : ''}</span>`;
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, type) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    const ic = type === 'success' ? 'checkCircle' : type === 'error' ? 'alert' : 'sparkles';
    el.innerHTML = `${icon(ic, 17)}<span>${esc(msg)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(() => el.remove(), 300); }, 2400);
  }

  /* ---------------- 弹窗 ---------------- */
  function modal(opts) {
    const o = Object.assign({ title: '', body: '', footer: '', wide: false }, opts);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="modal ${o.wide ? 'wide' : ''}">
        <div class="modal-head">
          <h3>${esc(o.title)}</h3>
          <button class="icon-btn close" data-close>${icon('close', 18)}</button>
        </div>
        <div class="modal-body">${o.body}</div>
        ${o.footer ? `<div class="modal-foot">${o.footer}</div>` : ''}
      </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.style.animation = 'fade .18s reverse'; setTimeout(() => ov.remove(), 160); };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    const api = { el: ov.querySelector('.modal'), body: ov.querySelector('.modal-body'), close };
    if (o.onMount) o.onMount(api);
    return api;
  }

  /* ---------------- 抽屉 ---------------- */
  function drawer(opts) {
    const o = Object.assign({ title: '', body: '', footer: '', subtitle: '' }, opts);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.display = 'block';
    const dr = document.createElement('div');
    dr.className = 'drawer';
    dr.innerHTML = `
      <div class="drawer-head">
        <div style="flex:1;min-width:0">
          <h3 style="font-size:17px;font-weight:700">${esc(o.title)}</h3>
          ${o.subtitle ? `<p class="text-3 fs-12" style="margin-top:4px">${o.subtitle}</p>` : ''}
        </div>
        <button class="icon-btn close" data-close>${icon('close', 18)}</button>
      </div>
      <div class="drawer-body">${o.body}</div>
      ${o.footer ? `<div class="drawer-foot">${o.footer}</div>` : ''}`;
    ov.appendChild(dr);
    document.body.appendChild(ov);
    const close = () => { dr.style.animation = 'slide-in .24s reverse'; ov.style.animation = 'fade .18s reverse'; setTimeout(() => ov.remove(), 220); };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    const api = { el: dr, body: dr.querySelector('.drawer-body'), close };
    if (o.onMount) o.onMount(api);
    return api;
  }

  /* ---------------- 下拉菜单 ---------------- */
  function menu(anchor, items) {
    closeMenus();
    const r = anchor.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = items.map((it, i) => it.divider
      ? '<div class="divider"></div>'
      : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon, 15) : ''}<span>${esc(it.label)}</span></button>`).join('');
    document.body.appendChild(m);
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = Math.min(r.right - mw, window.innerWidth - mw - 10);
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 10) top = Math.max(10, r.top - mh - 6);
    m.style.left = Math.max(10, left) + 'px';
    m.style.top = top + 'px';
    m.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const it = items[+b.dataset.i];
      closeMenus();
      if (it.onClick) it.onClick();
    });
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (!m.contains(e.target)) closeMenus(); }
    function closeMenus() { m.remove(); document.removeEventListener('mousedown', outside); }
    return m;
  }
  function closeMenus() { document.querySelectorAll('.menu').forEach((m) => m.remove()); }

  /* ---------------- 表单取值 ---------------- */
  function formValues(scope) {
    const out = {};
    scope.querySelectorAll('[name]').forEach((el) => { out[el.name] = el.value; });
    return out;
  }

  /* ---------------- 图表 ---------------- */
  // 柱状图
  function barChart(items, opts) {
    const o = Object.assign({ height: 190, alt: false }, opts);
    const max = Math.max.apply(null, items.map((i) => i.value).concat([1]));
    return `<div class="bars" style="height:${o.height}px">${items.map((i) => `
      <div class="bar-item">
        <div class="bar ${i.alt ? 'alt' : ''}" style="height:${Math.max(4, (i.value / max) * 100)}%"><span>${i.value}</span></div>
        <div class="lbl">${esc(i.label)}</div>
      </div>`).join('')}</div>`;
  }

  // 折线 / 面积图
  function lineChart(items, opts) {
    const o = Object.assign({ width: 520, height: 180, color: '#23d3a9', color2: '#38bdf8', showDots: true }, opts);
    const pad = { l: 34, r: 12, t: 14, b: 26 };
    const w = o.width, h = o.height;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const series = o.series || [items];
    const allVals = series.reduce((a, s) => a.concat(s.map((p) => p.value)), []);
    const max = Math.max.apply(null, allVals.concat([1]));
    const min = 0;
    const n = items.length;
    const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
    const colors = [o.color, o.color2, '#8b7cf6'];
    let g = '';
    // grid
    for (let k = 0; k <= 4; k++) {
      const gy = pad.t + (k / 4) * ih;
      g += `<line x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}" stroke="rgba(19,168,132,.14)" stroke-width="1" stroke-dasharray="4 5"/>`;
      const val = Math.round(max - (k / 4) * (max - min));
      g += `<text x="${pad.l - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="#6f908a">${val}</text>`;
    }
    let paths = '';
    series.forEach((s, si) => {
      const col = colors[si % colors.length];
      const dLine = s.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
      const dArea = `${dLine} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
      const gid = `g${Math.random().toString(36).slice(2, 7)}`;
      paths += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${col}" stop-opacity=".30"/>
          <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
        </linearGradient></defs>
        <path d="${dArea}" fill="url(#${gid})"/>
        <path d="${dLine}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (o.showDots) s.forEach((p, i) => { paths += `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.4" fill="#fff" stroke="${col}" stroke-width="2.2"/>`; });
    });
    let labels = items.map((p, i) => `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10.5" fill="#6f908a">${esc(p.label)}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block;overflow:visible">${g}${paths}${labels}</svg>`;
  }

  // 环形图
  function donut(items, opts) {
    const o = Object.assign({ size: 168, thickness: 22 }, opts);
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const r = o.size / 2 - o.thickness / 2 - 2;
    const cx = o.size / 2, cy = o.size / 2;
    const circ = 2 * Math.PI * r;
    let acc = 0;
    const segs = items.map((it) => {
      const frac = it.value / total;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${o.thickness}"
        stroke-dasharray="${(frac * circ).toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${(-acc * circ).toFixed(2)}" stroke-linecap="butt"
        transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += frac;
      return seg;
    }).join('');
    const center = `<text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="24" font-weight="800" fill="#0f2f29">${total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="#6f908a">${esc(o.centerLabel || '总计')}</text>`;
    return `<div class="flex items-center gap-3" style="flex-wrap:wrap">
      <svg width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(19,168,132,.12)" stroke-width="${o.thickness}"/>
        ${segs}${center}
      </svg>
      <div class="chart-legend" style="flex-direction:column;gap:9px">
        ${items.map((it) => `<div class="item"><span class="sw" style="background:${it.color}"></span>${esc(it.label)} <b style="color:#0f2f29;margin-left:auto">${it.value}</b></div>`).join('')}
      </div></div>`;
  }

  // 进度环
  function ring(value, size, color, label) {
    const s = size || 96, sw = 9, r = s / 2 - sw / 2 - 1, c = 2 * Math.PI * r;
    const col = color || '#23d3a9';
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <defs><linearGradient id="rg${value}${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${col}"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs>
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="rgba(19,168,132,.14)" stroke-width="${sw}"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="url(#rg${value}${s})" stroke-width="${sw}" stroke-linecap="round"
        stroke-dasharray="${(c * value / 100).toFixed(1)} ${c}" transform="rotate(-90 ${s / 2} ${s / 2})"/>
      <text x="${s / 2}" y="${s / 2 + 5}" text-anchor="middle" font-size="${s / 4.4}" font-weight="800" fill="#0f2f29">${value}%</text>
    </svg>${label ? `<div class="hint" style="text-align:center">${esc(label)}</div>` : ''}`;
  }

  // 迷你柱状（sparkline bars）
  function sparkbars(values, color) {
    const max = Math.max.apply(null, values.concat([1]));
    return `<div style="display:flex;align-items:flex-end;gap:3px;height:34px">${values.map((v) => `<span style="flex:1;height:${Math.max(3, (v / max) * 100)}%;background:${color || 'linear-gradient(180deg,#3fe3bd,#13a884)'};border-radius:3px 3px 1px 1px"></span>`).join('')}</div>`;
  }

  /* ---------------- 轻量 Markdown ---------------- */
  function md(src) {
    let s = esc(src || '');
    s = s.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/^\n/, '')}</code></pre>`);
    s = s.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
      .replace(/^#### (.*)$/gm, '<h4>$1</h4>').replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>');
    s = s.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // 表格
    s = s.replace(/^\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.*\|\n?)*)/gm, (m, head, bodyRows) => {
      const th = head.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
      const rows = bodyRows.trim().split('\n').map((r) => r.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === '')));
      return `<table><thead><tr>${th.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    });
    // 列表
    s = s.replace(/(?:^|\n)((?:[-*] .*(?:\n|$))+)/g, (m, block) => `<ul>${block.trim().split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('')}</ul>`);
    s = s.replace(/(?:^|\n)((?:\d+\. .*(?:\n|$))+)/g, (m, block) => `<ol>${block.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')}</ol>`);
    // 段落
    s = s.split(/\n{2,}/).map((p) => {
      if (/^\s*<(h\d|ul|ol|pre|blockquote|table|div)/.test(p.trim()) || p.trim() === '') return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return s;
  }

  /* ---------------- 空状态 ---------------- */
  function empty(title, desc, iconName) {
    return `<div class="empty">${icon(iconName || 'inbox', 44)}<h4>${esc(title || '暂无数据')}</h4><div class="fs-13">${esc(desc || '')}</div></div>`;
  }

  global.UI = { icon, esc, fmtDate, fmtDateTime, fromNow, daysBetween, avatar, userCell, avatarStack, toast, modal, drawer, menu, closeMenus, formValues, barChart, lineChart, donut, ring, sparkbars, md, empty, ICON_PATHS: P };
})(window);
