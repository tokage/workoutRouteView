/**
 * i18n 本地化格式化助手（node 可测，无 React 依赖）。
 *
 * - langToIntl：TraceLens 语言键 → Intl locale（zh-Hans → zh-CN，其余 → en-US）。
 * - monthName：月份数字 → 本地化月份名（供 trend.js periodTitle 组装周期标题）。
 */
import { langToIntl } from './core.js'

export { langToIntl } from './core.js'

const formatterCache = new Map()

function cachedFormatter(locale, options) {
  const key = `${locale}:${JSON.stringify(options)}`
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.DateTimeFormat(locale, options))
  }
  return formatterCache.get(key)
}

/**
 * 月份数字（1–12）→ 本地化月份名。
 * @param {number|string} month 1–12
 * @param {string} [lang='zh-CN'] TraceLens 语言键或 Intl locale
 * @returns {string} 如 zh → "8月"，en → "August"
 */
export function monthName(month, lang = 'zh-CN') {
  const value = Number(month)
  if (!Number.isInteger(value) || value < 1 || value > 12) return String(month ?? '')
  const date = new Date(2000, value - 1, 1)
  return cachedFormatter(langToIntl(lang), { month: 'long' }).format(date)
}
