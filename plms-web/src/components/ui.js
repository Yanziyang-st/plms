import { h } from 'vue'
import AppIcon from './AppIcon.js'
import { renderMarkdown, initials } from '../utils/format.js'

/* ==========================================================================
   基础展示组件
   ========================================================================== */

export const Avatar = {
  name: 'Avatar',
  props: {
    user: { type: Object, default: () => ({ name: '?', color: '#8b93a7' }) },
    size: { type: String, default: '' }, // '' | 'sm' | 'lg'
  },
  render() {
    const u = this.user || {}
    return h(
      'span',
      {
        class: ['avatar', this.size],
        style: { background: u.color || '#23d3a9' },
        title: u.name || '',
      },
      initials(u.name),
    )
  },
}

export const UserChip = {
  name: 'UserChip',
  props: { user: { type: Object, default: null }, showName: { type: Boolean, default: true } },
  render() {
    if (!this.user) return h('span', { class: 'text-3' }, '未指派')
    return h('span', { class: 'user-cell' }, [
      h(Avatar, { user: this.user, size: 'sm' }),
      this.showName ? h('span', null, this.user.name) : null,
    ])
  },
}

export const AvatarStack = {
  name: 'AvatarStack',
  props: { users: { type: Array, default: () => [] }, max: { type: Number, default: 4 } },
  render() {
    const list = (this.users || []).slice(0, this.max)
    const more = (this.users || []).length - list.length
    return h('span', { class: 'avatar-stack' }, [
      ...list.map((u) => h(Avatar, { user: u, size: 'sm', key: u.id })),
      more > 0 ? h('span', { class: 'avatar sm', style: 'background:#8b93a7' }, `+${more}`) : null,
    ])
  },
}

export const StatusBadge = {
  name: 'StatusBadge',
  props: { text: { type: String, default: '' }, kind: { type: String, default: 'gray' }, dot: { type: Boolean, default: false } },
  render() {
    if (!this.text) return h('span', { class: 'text-3' }, '—')
    return h('span', { class: ['badge', this.kind] }, [
      this.dot ? h('span', { class: 'dot' }) : null,
      this.text,
    ])
  },
}

export const StatCard = {
  name: 'StatCard',
  props: {
    label: String,
    value: [String, Number],
    unit: String,
    icon: { type: String, default: 'inbox' },
    bg: { type: String, default: 'var(--mint-50)' },
    color: { type: String, default: 'var(--mint-700)' },
    foot: String,
    loading: Boolean,
    /** 开启后可点击进入详情 */
    clickable: { type: Boolean, default: false },
  },
  emits: ['detail'],
  template: `
    <div class="stat" :class="{ clickable }" @click="clickable && $emit('detail')">
      <div class="lbl">{{ label }}</div>
      <div class="val">
        <span v-if="loading" class="skeleton-text" />
        <template v-else>{{ value ?? '—' }}</template>
        <small v-if="unit">{{ unit }}</small>
      </div>
      <div v-if="foot" class="foot">{{ foot }}</div>
      <div class="stat-ico" :style="{ background: bg, color }">
        <AppIcon :name="icon" :size="19" />
      </div>
      <span v-if="clickable" class="stat-click-hint">
        <AppIcon name="expand" :size="11" /> 详情
      </span>
    </div>
  `,
}

export const PageHeader = {
  name: 'PageHeader',
  props: { title: String, description: String },
  render() {
    return h('div', { class: 'page-head' }, [
      h('div', null, [
        h('h2', null, this.title),
        this.description ? h('p', null, this.description) : null,
      ]),
      h('div', { class: 'actions' }, this.$slots.actions ? this.$slots.actions() : []),
    ])
  },
}

export const EmptyState = {
  name: 'EmptyState',
  props: { title: { type: String, default: '暂无数据' }, description: String, icon: { type: String, default: 'inbox' } },
  render() {
    return h('div', { class: 'empty' }, [
      h(AppIcon, { name: this.icon, size: 44 }),
      h('h4', null, this.title),
      this.description ? h('div', { class: 'fs-13' }, this.description) : null,
      this.$slots.default ? h('div', { class: 'mt-3' }, this.$slots.default()) : null,
    ])
  },
}

export const Markdown = {
  name: 'Markdown',
  props: { content: { type: String, default: '' } },
  render() {
    return h('div', { class: 'doc-body', innerHTML: renderMarkdown(this.content) })
  },
}

export const ErrorState = {
  name: 'ErrorState',
  props: { title: { type: String, default: '加载失败' }, message: String },
  render() {
    return h('div', { class: 'card card-pad' }, [
      h(EmptyState, { title: this.title, description: this.message, icon: 'wifiOff' }, {
        default: () => [
          h(
            'button',
            { class: 'btn btn-primary', onClick: () => this.$emit('retry') },
            [h(AppIcon, { name: 'refresh', size: 15 }), ' 重新加载'],
          ),
        ],
      }),
    ])
  },
}

export default { Avatar, UserChip, AvatarStack, StatusBadge, StatCard, PageHeader, EmptyState, Markdown, ErrorState }
