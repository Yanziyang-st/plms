/* 协作空间：话题 · 讨论 */
(function () {
  const { icon, esc, avatar, fromNow, fmtDateTime } = UI;

  function render() {
    const topics = DB.list('topics');
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="page-head">
        <div><h2>协作空间</h2><p>围绕话题开展讨论，让信息传播更快捷、决策留痕更完整</p></div>
        <div class="actions"><button class="btn btn-primary" data-new-topic>${icon('plus', 16)} 发起话题</button></div>
      </div>

      <div class="grid g-2-1">
        <div>
          ${topics.map((t) => {
            const u = DB.userById(t.author);
            return `<div class="card card-pad mb-3" data-topic="${t.id}" style="cursor:pointer">
              <div class="flex items-center gap-2 mb-3">
                ${avatar(u)}
                <div style="flex:1"><b style="font-size:14.5px">${esc(t.title)}</b>
                  <div class="fs-12 text-3">${esc(u.name)} · ${fromNow(t.createdAt)}</div></div>
                ${t.tags.map((g) => `<span class="badge indigo">${esc(g)}</span>`).join('')}
              </div>
              <p class="fs-13 text-2" style="line-height:1.65">${esc(t.content)}</p>
              <div class="flex items-center gap-3 mt-3">
                <span class="chip">${icon('comment', 13)} ${t.comments.length} 条讨论</span>
                <span class="chip">${icon('users', 13)} ${new Set([t.author].concat(t.comments.map((c) => c.author))).size} 人参与</span>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div>
          <div class="card mb-4"><div class="card-head"><h3>活跃成员</h3></div>
            <div class="card-pad">
              ${DB.list('users').slice(0, 6).map((u) => `<div class="list-row">
                ${avatar(u)}<div class="grow"><b>${esc(u.name)}</b><small>${esc(u.role)}</small></div>
                <span class="badge green">${icon('sparkles', 11)} 活跃</span></div>`).join('')}
            </div></div>
          <div class="card"><div class="card-head"><h3>话题统计</h3></div>
            <div class="card-pad">
              <div class="flex" style="justify-content:space-between;font-size:13px;margin-bottom:10px"><span class="text-3">话题总数</span><b>${topics.length}</b></div>
              <div class="flex" style="justify-content:space-between;font-size:13px;margin-bottom:10px"><span class="text-3">讨论总数</span><b>${topics.reduce((a, b) => a + b.comments.length, 0)}</b></div>
              <div class="flex" style="justify-content:space-between;font-size:13px"><span class="text-3">参与人数</span><b>${new Set(topics.map((t) => t.author)).size}</b></div>
            </div></div>
        </div>
      </div>`;

    el.querySelector('[data-new-topic]').onclick = () => newTopicModal();
    el.querySelectorAll('[data-topic]').forEach((n) => n.addEventListener('click', () => topicDrawer(n.dataset.topic)));
    return el;
  }

  function topicDrawer(id) {
    const t = DB.find('topics', id);
    if (!t) return;
    const api = UI.drawer({
      title: t.title,
      subtitle: `${esc(DB.userById(t.author).name)} 发起于 ${fmtDateTime(t.createdAt)}`,
      body: `
        <div class="flex gap-2 mb-3">${t.tags.map((g) => `<span class="badge indigo">${esc(g)}</span>`).join('')}</div>
        <p class="fs-13" style="line-height:1.75;color:var(--ink-2)">${esc(t.content)}</p>
        <div class="hr"></div>
        <h4 style="font-weight:700;margin-bottom:12px">讨论 (${t.comments.length})</h4>
        <div class="feed" id="cmts">
          ${t.comments.map((c) => { const u = DB.userById(c.author); return `<div class="feed-item">${avatar(u)}
            <div style="flex:1"><div class="txt"><b>${esc(u.name)}</b></div>
            <div class="fs-13 mt-2" style="line-height:1.6">${esc(c.content)}</div>
            <div class="time">${fromNow(c.createdAt)}</div></div></div>`; }).join('') || '<div class="hint">还没有人发言，来抢沙发吧～</div>'}
        </div>`,
      footer: `<div class="search-input" style="flex:1">${icon('comment', 16)}<input class="input" id="cmt" placeholder="写下你的观点…" /></div>
        <button class="btn btn-primary" data-send>${icon('send', 15)} 发送</button>`,
      onMount(api) {
        const send = () => {
          const inp = api.el.querySelector('#cmt');
          const v = inp.value.trim();
          if (!v) return;
          const cur = DB.find('topics', id);
          cur.comments.push({ id: DB.uid('c'), author: 'u1', content: v, createdAt: new Date().toISOString() });
          DB.update('topics', id, { comments: cur.comments });
          DB.logActivity('u1', '评论了话题', t.title);
          UI.toast('已发布讨论', 'success');
          api.close(); topicDrawer(id); App.render();
        };
        api.el.querySelector('[data-send]').onclick = send;
        api.el.querySelector('#cmt').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
      },
    });
  }

  function newTopicModal() {
    UI.modal({
      title: '发起话题',
      body: `<div class="form-grid">
        <div class="field"><label>话题标题 *</label><input class="input" name="title" placeholder="一句话描述讨论主题" /></div>
        <div class="field"><label>标签（逗号分隔）</label><input class="input" name="tags" value="讨论" /></div>
        <div class="field"><label>内容</label><textarea class="input" name="content" rows="5" placeholder="补充背景信息，便于成员快速参与"></textarea></div>
      </div>`,
      footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-save>发布</button>`,
      onMount(api) {
        api.el.querySelector('[data-save]').onclick = () => {
          const v = UI.formValues(api.body);
          if (!v.title.trim()) { UI.toast('请填写标题', 'error'); return; }
          DB.insert('topics', { title: v.title, content: v.content, tags: v.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean), author: 'u1', comments: [], createdAt: new Date().toISOString() });
          DB.logActivity('u1', '发起了话题', v.title);
          api.close(); UI.toast('话题已发布', 'success'); App.render();
        };
      },
    });
  }

  window.VIEWS = window.VIEWS || {};
  window.VIEWS.collab = render;
})();
