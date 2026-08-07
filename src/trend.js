/**
 * 趋势视图的纯逻辑层（T4.6）
 *
 * ⚠️ 本文件**不做任何聚合运算**。所有桶数据一律来自 iOS 端 `GET /api/summary`
 *    （架构硬规则：派生数据只在 Swift 算一次）。第 3 期 `comparison.js` 之所以是
 *    `ComparisonBuilder` 的 1:1 镜像，是因为当时没有对应端点；本期有端点就必须走
 *    端点，否则 Web 与 iOS 两端数字会漂。
 *
 * 这里只负责**展示层**的三件事：
 *   1. 环比百分比（含除零保护，绝不产出 NaN / Infinity）
 *   2. 单位换算与文案（骑行按 km/h，其余按 秒/km，与 iOS `ActivityType.usesPace` 同口径）
 *   3. 纯 SVG 图表几何（本仓库无图表库，且构建产物要塞进 iOS Bundle，体积敏感，不新增依赖）
 *
 * 无 DOM / React 依赖，故可被 `tests/trend.test.mjs` 用 `node --test` 直接单测
 * （测试跑不了 .jsx，所以纯逻辑必须留在 .js 里——与 comparison.js 的组织方式一致）。
 */

/** 粒度分段控件选项，顺序与 iOS `TrendView` 一致（周/月/年） */
export const GRANULARITIES = [
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
]

/**
 * 侧栏 category（run/ride/…）→ `/api/summary` 的 `type` 参数（ActivityType.rawValue）。
 * `all` → null 表示不传 type，由后端按四类 GPS 运动合计（裁定 D1）。
 */
export const CATEGORY_TO_ACTIVITY_TYPE = {
  all: null,
  run: 'running',
  ride: 'cycling',
  walk: 'walking',
  hike: 'hiking',
}

/** 图表最多显示的桶数，与 iOS `TrendSnapshot.chartBuckets` 同值（周 12 / 月 12 / 年 8） */
export const CHART_BUCKET_LIMIT = { week: 12, month: 12, year: 8 }

/** SVG 画布尺寸（viewBox 坐标系；实际显示尺寸由 CSS 决定） */
export const CHART = {
  width: 560,
  height: 168,
  padTop: 12,
  padBottom: 26,
  padX: 10,
}

/**
 * 骑行用「速度（km/h）」，其余用「配速（秒/km）」。
 * 与 iOS `ActivityType.usesPace` 口径一致；`all`（混合）沿用配速。
 * @param {string} category
 * @returns {boolean} true = 展示配速
 */
export function usesPace(category) {
  return category !== 'ride'
}

/**
 * 环比百分比。
 *
 * 上一周期为 0（或缺失 / 非有限值）时返回 `null`——调用方渲染「—」。
 * 这是本函数存在的唯一理由：`(cur - 0) / 0` 会得到 Infinity，
 * 直接 toFixed 会在页面上印出「∞%」。
 *
 * @param {number} current
 * @param {number} previous
 * @returns {number|null} 百分比数值（如 12.5 表示 +12.5%），无法计算时为 null
 */
export function percentDelta(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return null
  const value = ((current - previous) / previous) * 100
  return Number.isFinite(value) ? value : null
}

/**
 * 环比文案。`null` → 「—」；小于 0.05% 视为持平（避免「+0.0%」这种噪声）。
 * @param {number|null} percent
 * @returns {string}
 */
export function formatDeltaText(percent) {
  if (percent === null || !Number.isFinite(percent)) return '—'
  const rounded = Math.round(percent * 10) / 10
  if (Math.abs(rounded) < 0.05) return '持平'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`
}

/**
 * 涨跌方向，供着色与箭头使用。
 * @param {number|null} percent
 * @returns {'up'|'down'|'flat'|'none'}
 */
export function deltaDirection(percent) {
  if (percent === null || !Number.isFinite(percent)) return 'none'
  const rounded = Math.round(percent * 10) / 10
  if (Math.abs(rounded) < 0.05) return 'flat'
  return rounded > 0 ? 'up' : 'down'
}

/**
 * 截取图表要画的桶（取最近 N 个）。
 * 后端返回的是从最早记录补零到当前的**全量**桶，全画会挤成一团。
 * @param {Array<object>} buckets 时间升序
 * @param {string} granularity
 * @returns {Array<object>}
 */
export function pickChartBuckets(buckets, granularity) {
  if (!Array.isArray(buckets) || !buckets.length) return []
  const limit = CHART_BUCKET_LIMIT[granularity] || 12
  return buckets.length > limit ? buckets.slice(buckets.length - limit) : buckets.slice()
}

/**
 * 柱状图几何。
 *
 * 空桶（count = 0）产出**高度为 0** 的柱子而不是被丢弃——时间轴要保持连续，
 * 缺月直接跳过会让相邻两根柱子在视觉上误导成连续月份。
 *
 * @param {Array<object>} buckets
 * @param {(bucket: object) => number} valueOf 取值函数
 * @returns {{bars: Array<object>, max: number}}
 */
export function buildBars(buckets, valueOf) {
  const { width, height, padTop, padBottom, padX } = CHART
  if (!Array.isArray(buckets) || !buckets.length) return { bars: [], max: 0 }

  const values = buckets.map((bucket) => {
    const raw = Number(valueOf(bucket))
    return Number.isFinite(raw) && raw > 0 ? raw : 0
  })
  const max = values.reduce((acc, value) => Math.max(acc, value), 0)

  const plotHeight = height - padTop - padBottom
  const baselineY = padTop + plotHeight
  const slot = (width - padX * 2) / buckets.length
  const barWidth = Math.max(4, Math.min(34, slot * 0.62))

  const bars = buckets.map((bucket, index) => {
    const value = values[index]
    // max = 0（全空桶）时不做除零，所有柱高 0，图表退化为一条基线
    const barHeight = max > 0 ? (value / max) * plotHeight : 0
    const centerX = padX + slot * (index + 0.5)
    return {
      key: bucket.key,
      value,
      centerX,
      baselineY,
      x: centerX - barWidth / 2,
      y: baselineY - barHeight,
      width: barWidth,
      height: barHeight,
    }
  })
  return { bars, max }
}

/**
 * 折线图几何——**断点**版本。
 *
 * `avgPace` 为 null（该周期无记录）时必须断线，不能按 0 画：
 * 0 会被映射到画布底部，形成一条掉到底再弹回来的假线，比不画更误导。
 * 故返回的是**若干段**折线，每段内部点连续。
 *
 * @param {Array<object>} buckets
 * @param {(bucket: object) => (number|null)} valueOf
 * @returns {{segments: Array<Array<object>>, points: Array<object>, min: number|null, max: number|null}}
 */
export function buildLineSegments(buckets, valueOf) {
  const { width, height, padTop, padBottom, padX } = CHART
  const empty = { segments: [], points: [], min: null, max: null }
  if (!Array.isArray(buckets) || !buckets.length) return empty

  const plotHeight = height - padTop - padBottom
  const slot = (width - padX * 2) / buckets.length

  const raw = buckets.map((bucket, index) => {
    const value = Number(valueOf(bucket))
    return {
      key: bucket.key,
      centerX: padX + slot * (index + 0.5),
      // null / 0 / NaN / Infinity 一律视为「无数据」→ 断点
      value: Number.isFinite(value) && value > 0 ? value : null,
    }
  })

  const values = raw.filter((point) => point.value !== null).map((point) => point.value)
  if (!values.length) return empty

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  // 只有一个点、或所有点等值时 span = 0，居中画，避免除零
  const yFor = (value) => (span <= 0
    ? padTop + plotHeight / 2
    : padTop + plotHeight - ((value - min) / span) * plotHeight)

  const segments = []
  let current = []
  raw.forEach((point) => {
    if (point.value === null) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push({ key: point.key, x: point.centerX, y: yFor(point.value), value: point.value })
  })
  if (current.length) segments.push(current)

  return { segments, points: segments.flat(), min, max }
}

/**
 * 折线段 → SVG path 的 `d`。
 * @param {Array<{x: number, y: number}>} segment
 * @returns {string}
 */
export function toPath(segment) {
  if (!Array.isArray(segment) || !segment.length) return ''
  return segment
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

/**
 * 桶 key → 坐标轴短标签。"2026-W31" → "W31"；"2026-08" → "8月"；"2026" → "2026"
 * @param {string} key
 * @param {string} granularity
 * @returns {string}
 */
export function shortLabel(key, granularity) {
  if (typeof key !== 'string' || !key) return ''
  if (granularity === 'week') {
    const index = key.indexOf('-W')
    return index >= 0 ? `W${key.slice(index + 2)}` : key
  }
  if (granularity === 'month') {
    const month = key.split('-')[1]
    return month ? `${Number(month)}月` : key
  }
  return key
}

/**
 * 桶 key → 周期标题。与 iOS `SummaryBuilder.displayTitle` 文案一致。
 * @param {string} key
 * @param {string} granularity
 * @returns {string}
 */
export function periodTitle(key, granularity) {
  if (typeof key !== 'string' || !key) return '—'
  if (granularity === 'week') {
    const [year, week] = key.split('-W')
    return week ? `${year}年第${Number(week)}周` : key
  }
  if (granularity === 'month') {
    const [year, month] = key.split('-')
    return month ? `${year}年${Number(month)}月` : key
  }
  return `${key}年`
}

/** 环比行的标题文案，与 iOS `PeriodGranularity.comparisonLabel` 一致 */
export function comparisonLabel(granularity) {
  if (granularity === 'week') return '较上周'
  if (granularity === 'year') return '较上年'
  return '较上月'
}

/**
 * 从全量桶里取出「本周期 / 上一周期」。
 * 后端补零保证 buckets 连续且升序，故直接取末两个即可。
 * @param {Array<object>} buckets
 * @returns {{current: object|null, previous: object|null}}
 */
export function pickPeriods(buckets) {
  if (!Array.isArray(buckets) || !buckets.length) return { current: null, previous: null }
  return {
    current: buckets[buckets.length - 1],
    previous: buckets.length >= 2 ? buckets[buckets.length - 2] : null,
  }
}

/**
 * 汇总卡的四项环比（距离 / 时长 / 次数 / 爬升），与 iOS `PeriodSummaryCard` 一致。
 * `previous` 为 null（首个周期）时四项全部返回 null → 渲染「—」。
 * @param {object|null} current
 * @param {object|null} previous
 * @returns {Array<{title: string, percent: number|null}>}
 */
export function buildDeltas(current, previous) {
  const fields = [
    { title: '距离', pick: (bucket) => bucket.distance },
    { title: '时长', pick: (bucket) => bucket.duration },
    { title: '次数', pick: (bucket) => bucket.count },
    { title: '爬升', pick: (bucket) => bucket.ascent },
  ]
  return fields.map(({ title, pick }) => ({
    title,
    percent: current && previous ? percentDelta(Number(pick(current)), Number(pick(previous))) : null,
  }))
}

/**
 * 判断整段数据是否为空（无桶，或所有桶 count 都是 0）。
 * 后端在「还没同步过数据」时返回 200 + 空桶，这是正常态而非故障，要渲染友好空态。
 * @param {Array<object>} buckets
 * @returns {boolean}
 */
export function isEmptySummary(buckets) {
  if (!Array.isArray(buckets) || !buckets.length) return true
  return buckets.every((bucket) => !Number(bucket.count))
}
