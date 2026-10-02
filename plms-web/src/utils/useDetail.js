import { ref, computed } from 'vue'

/**
 * 详情抽屉的组合式封装。
 * 视图只需提供 `build(key)` 返回详情描述对象，其余（可见性、当前 key、配置计算）由此管理。
 *
 * @param {(key: string) => object|null} build 根据 key 构造详情描述
 * @returns {{ detailVisible, detailKey, detailConfig, openDetail, closeDetail }}
 */
export function useDetail(build) {
  const detailVisible = ref(false)
  const detailKey = ref('')

  const detailConfig = computed(() => (detailKey.value ? build(detailKey.value) : null))

  function openDetail(key) {
    detailKey.value = key
    detailVisible.value = true
  }

  function closeDetail() {
    detailVisible.value = false
  }

  return { detailVisible, detailKey, detailConfig, openDetail, closeDetail }
}

/** 百分比 */
export const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0)

/** 计数映射 -> [{label,value,color}] 供环形图使用 */
export function countItems(map, colorMap = {}) {
  return Object.keys(map || {}).map((k) => ({
    label: k,
    value: map[k],
    color: colorMap[k],
  }))
}

/** 数组按字段分组计数 */
export function groupCount(list, field) {
  const out = {}
  ;(list || []).forEach((item) => {
    const k = item[field] || '未设置'
    out[k] = (out[k] || 0) + 1
  })
  return out
}

export default { useDetail, pct, countItems, groupCount }
