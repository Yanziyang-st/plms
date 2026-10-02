/* 通用格式化与展示辅助 */

export const fmtDate = (iso) => (iso ? String(iso).slice(0, 10) : '—')

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16).replace('T', ' ')
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fromNow(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return fmtDate(iso)
}

export const initials = (name) => (name || '?').slice(-2)

/** 状态 -> 徽标颜色（对应 theme.css 中的 .badge.* 类名） */
export function statusKind(s) {
  const map = {
    待处理: 'gray', 待评审: 'orange', 已排期: 'indigo', 进行中: 'blue', 开发中: 'blue',
    待测试: 'purple', 已完成: 'green', 已发布: 'green', 已归档: 'gray', 规划中: 'gray',
    通过: 'green', 失败: 'red', 阻塞: 'orange', 未执行: 'gray', 未开始: 'gray', 已暂停: 'orange',
  }
  return map[s] || 'gray'
}

export const priorityKind = (p) =>
  ({ 紧急: 'red', 高: 'red', 中: 'orange', 低: 'gray' }[p] || 'gray')

export const priorityOrder = (p) =>
  ({ 紧急: 0, 高: 1, 中: 2, 低: 3 }[p] ?? 9)

/** 同一优先级色条（用于内联 style） */
export const priorityColor = (p) =>
  ({ 紧急: '#ff7a6b', 高: '#ff7a6b', 中: '#ffb020', 低: '#a3bdb7' }[p] || '#a3bdb7')

/** 看板列颜色 */
export const stageColor = (s) =>
  ({ 待处理: '#a3bdb7', 进行中: '#38bdf8', 待测试: '#8b7cf6', 已完成: '#23d3a9' }[s] || '#a3bdb7')

/** 简易 Markdown 渲染（与设计系统配套，避免引入额外依赖） */
export function renderMarkdown(src) {
  let s = String(src || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  s = s.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/^\n/, '')}</code></pre>`)
  s = s
    .replace(/^###### (.*)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.*)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  s = s.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  s = s.replace(/^\|(.+)\|\n\|[\s:|-]+\|\n((?:\|.*\|\n?)*)/gm, (m, head, body) => {
    const th = head.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''))
    const rows = body.trim().split('\n').map((r) =>
      r.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === '')),
    )
    return `<table><thead><tr>${th.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`
  })
  s = s.replace(/(?:^|\n)((?:[-*] .*(?:\n|$))+)/g, (m, block) =>
    `<ul>${block.trim().split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('')}</ul>`,
  )
  s = s.replace(/(?:^|\n)((?:\d+\. .*(?:\n|$))+)/g, (m, block) =>
    `<ol>${block.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')}</ol>`,
  )
  s = s
    .split(/\n{2,}/)
    .map((p) => {
      if (/^\s*<(h\d|ul|ol|pre|blockquote|table|div)/.test(p.trim()) || p.trim() === '') return p
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
  return s
}
