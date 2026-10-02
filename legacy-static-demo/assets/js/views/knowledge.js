/* 知识管理：空间 · 页面树 · 文档编辑器 */
(function () {
  const { icon, esc, fmtDate, fromNow, avatar } = UI;
  const state = { spaceId: null, pageId: null, editing: false };

  function render() {
    const spaces = DB.list('wikiSpaces');
    if (!state.spaceId) state.spaceId = spaces[0] && spaces[0].id;
    const el = document.createElement('div');
    paint(el);
    return el;
  }

  function paint(root) {
    const spaces = DB.list('wikiSpaces');
    const space = DB.find('wikiSpaces', state.spaceId) || spaces[0];
    const pages = DB.list('wikiPages').filter((p) => p.spaceId === state.spaceId);
    if (!state.pageId || !pages.some((p) => p.id === state.pageId)) state.pageId = pages[0] && pages[0].id;
    const page = DB.find('wikiPages', state.pageId);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>知识管理</h2><p>结构化沉淀团队经验与资源，支持版本回溯与多人协作</p></div>
        <div class="actions">
          <button class="btn" data-new-space>${icon('plus', 16)} 新建空间</button>
          <button class="btn btn-primary" data-new-page ${space ? '' : 'disabled'}>${icon('plus', 16)} 新建页面</button>
        </div>
      </div>

      <div class="grid g-1-2">
        <div>
          <div class="card mb-4"><div class="card-head"><h3>知识空间</h3></div>
            <div class="card-pad" style="padding:8px">
              ${spaces.map((s) => `<div class="list-row" data-space="${s.id}" style="${s.id === state.spaceId ? 'background:var(--mint-50);border-color:var(--mint-200)' : ''}">
                <span style="font-size:20px">${s.icon}</span>
                <div class="grow"><b>${esc(s.name)}</b><small>${DB.list('wikiPages').filter((p) => p.spaceId === s.id).length} 个页面 · ${esc(DB.userById(s.owner).name)}</small></div>
              </div>`).join('')}
            </div>
          </div>
          <div class="card" style="position:sticky;top:0"><div class="card-head"><h3>${esc(space ? space.name : '')}</h3><span class="sub">${pages.length} 页</span></div>
            <div class="card-pad" style="padding:8px">
              ${treeHtml(pages, null, 0)}
            </div>
          </div>
        </div>

        <div class="card">
          ${page ? `
            <div class="card-head">
              <h3>${esc(page.title)}</h3>
              <div class="right">
                <span class="hint">${esc(DB.userById(page.author).name)} · 更新于 ${fromNow(page.updatedAt)}</span>
                <button class="btn btn-sm" data-edit-page>${icon('edit', 14)} 编辑</button>
              </div>
            </div>
            <div class="card-pad">
              ${state.editing ? editHtml(page) : `<div class="doc-body">${UI.md(page.content)}</div>`}
            </div>` : UI.empty('该空间暂无页面', '点击右上角新建页面', 'file')}
        </div>
      </div>`;

    bind(root, space, page);
  }

  function treeHtml(pages, parentId, depth) {
    const children = pages.filter((p) => (p.parentId || null) === parentId);
    if (!children.length) return depth === 0 ? `<div class="hint" style="padding:10px">暂无页面</div>` : '';
    return children.map((p) => `
      <div class="list-row" data-page="${p.id}" style="padding-left:${8 + depth * 16}px;${p.id === state.pageId ? 'background:var(--mint-50);border-color:var(--mint-200)' : ''}">
        ${icon(children.some((x) => x.parentId === p.id) || depth > 0 ? 'file' : 'folder', 16)}
        <div class="grow"><b style="font-size:13px">${esc(p.title)}</b></div>
      </div>
      ${treeHtml(pages, p.id, depth + 1)}`).join('');
  }

  function editHtml(page) {
    return `<div class="form-grid">
      <div class="field"><label>标题</label><input class="input" id="ptitle" value="${esc(page.title)}" /></div>
      <div class="field"><label>正文（支持 Markdown）</label><textarea class="input" id="pcontent" rows="16" style="font-family:'SFMono-Regular',Consolas,monospace;font-size:13px">${esc(page.content)}</textarea></div>
      <div class="flex gap-2"><button class="btn btn-primary" data-save-page>${icon('check', 15)} 保存</button>
        <button class="btn" data-cancel-page>取消</button>
        <span class="spacer"></span><span class="hint" style="align-self:center">支持 # 标题、**加粗**、- 列表、\`代码\`、表格</span></div>
    </div>`;
  }

  function bind(root, space, page) {
    root.querySelectorAll('[data-space]').forEach((n) => n.addEventListener('click', () => { state.spaceId = n.dataset.space; state.pageId = null; state.editing = false; App.render(); }));
    root.querySelectorAll('[data-page]').forEach((n) => n.addEventListener('click', () => { state.pageId = n.dataset.page; state.editing = false; App.render(); }));
    root.querySelector('[data-new-space]')?.addEventListener('click', () => {
      UI.modal({
        title: '新建知识空间',
        body: `<div class="form-grid">
          <div class="field"><label>空间名称 *</label><input class="input" name="name" /></div>
          <div class="field"><label>图标</label><select class="select" name="icon"><option>📘</option><option>🛠️</option><option>🧪</option><option>🚀</option><option>📊</option></select></div>
          <div class="field"><label>描述</label><textarea class="input" name="desc" rows="2"></textarea></div>
        </div>`,
        footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>创建</button>`,
        onMount(api) {
          api.el.querySelector('[data-save]').onclick = () => {
            const v = UI.formValues(api.body);
            if (!v.name.trim()) { UI.toast('请填写名称', 'error'); return; }
            const colors = ['#23d3a9', '#38bdf8', '#8b7cf6', '#ffb020'];
            const rec = DB.insert('wikiSpaces', { ...v, color: colors[Math.floor(Math.random() * colors.length)], owner: 'u1', members: ['u1'] });
            state.spaceId = rec.id; state.pageId = null;
            api.close(); UI.toast('空间已创建', 'success'); App.render();
          };
        },
      });
    });
    root.querySelector('[data-new-page]')?.addEventListener('click', () => {
      const rec = DB.insert('wikiPages', { spaceId: space.id, title: '未命名页面', parentId: null, author: 'u1', content: '# 未命名页面\n\n开始撰写内容…', updatedAt: new Date().toISOString() });
      state.pageId = rec.id; state.editing = true;
      App.render();
    });
    root.querySelector('[data-edit-page]')?.addEventListener('click', () => { state.editing = true; App.render(); });
    root.querySelector('[data-cancel-page]')?.addEventListener('click', () => { state.editing = false; App.render(); });
    root.querySelector('[data-save-page]')?.addEventListener('click', () => {
      const title = root.querySelector('#ptitle').value.trim() || '未命名页面';
      const content = root.querySelector('#pcontent').value;
      DB.update('wikiPages', page.id, { title, content, updatedAt: new Date().toISOString() });
      DB.logActivity('u1', '更新了知识页面', title);
      state.editing = false; UI.toast('已保存', 'success'); App.render();
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.knowledge = render;
})();
