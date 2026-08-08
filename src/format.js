import { langToIntl } from './i18n/format.js'

const dateFormatters = new Map()

function dateFormatter(locale) {
  if (!dateFormatters.has(locale)) {
    dateFormatters.set(
      locale,
      new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    )
  }
  return dateFormatters.get(locale)
}

/**
 * 日期展示（本地化）：默认 zh-CN（与现网一致，tests/format.test.mjs 不破坏）。
 * @param {string|number|Date} value
 * @param {string} [lang='zh-CN'] TraceLens 语言键或 Intl locale
 */
export function formatDate(value, lang = 'zh-CN') {
  return dateFormatter(langToIntl(lang)).format(new Date(value))
}

export function formatDuration(minutes) {
  const totalSeconds = Math.round((minutes || 0) * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${mins}:${String(seconds).padStart(2, '0')}`
}

/** 秒/km → "5:27"（后端 avgPace 为整体口径，前端不再用时长÷距离现算） */
export function formatPaceSeconds(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  const totalSeconds = Math.round(secPerKm)
  const mins = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${mins}:${String(seconds).padStart(2, '0')}`
}

/**
 * 骑行：秒/km → km/h（与 iOS RouteRowView.formatSpeed 口径一致：3600 / 秒每公里）。
 * 仅返回数值（如 "25.0"），单位由调用方以 <small>km/h</small> 展示。
 */
export function formatSpeedKmh(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  return (3600 / secPerKm).toFixed(1)
}
