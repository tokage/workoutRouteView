// 每公里分段纯函数（与 iOS SplitsTableView 同口径，架构 §7 T2.5/T2.6）。
// 快慢基准 = 本次全程均配速 avgPace；配速低=快；±1s/km 死区避免抖动；尾段不标记。
import { formatPaceSeconds, formatSpeedKmh } from './format.js'

/**
 * 分段快慢标记。
 * @param {number} splitPace 分段配速（秒/km）
 * @param {number|null|undefined} avgPace 本次全程均配速（秒/km）
 * @returns {'fast'|'slow'|'even'|null} 快 / 慢 / 持平 / 无法判断
 */
export function splitPaceMark(splitPace, avgPace) {
  if (!Number.isFinite(splitPace) || splitPace <= 0) return null
  if (!Number.isFinite(avgPace) || avgPace <= 0) return null
  if (splitPace < avgPace - 1) return 'fast'
  if (splitPace > avgPace + 1) return 'slow'
  return 'even'
}

/**
 * 分段配速展示：骑行显示 km/h，其余显示 秒/km（ActivityType.usesPace 口径）。
 * @param {number|null|undefined} paceSecPerKm 秒/km
 * @param {boolean} isCycling 骑行
 * @returns {string} 如 "5:27" / "25.0" / "—"
 */
export function formatSplitPace(paceSecPerKm, isCycling) {
  return isCycling ? formatSpeedKmh(paceSecPerKm) : formatPaceSeconds(paceSecPerKm)
}
