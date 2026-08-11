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
 *   3. 纯 SVG 图表几何（本仓库无图表库）
 *
 * i18n（方案 v1.1 §4.4）：i18n 由 i18next 提供，体积增量已在方案 v1.1 评估
 * （≤ ~20KB gzip，相对 iOS Bundle 可忽略）。本文件只 import i18next core（无 React），
 * 文案函数追加可选 `t` 参数，默认值为 core 实例绑定 zh-Hans（源语言）的 t——
 * 与 UI 运行时语言（回退 en）语义分离，保证现有约 12 处中文断言零破坏。
 *
 * 无 DOM / React 依赖，故可被 `tests/trend.test.mjs` 用 `node --test` 直接单测
 * （测试跑不了 .jsx，所以纯逻辑必须留在 .js 里——与 comparison.js 的组织方式一致）。
 */
import { t as coreT } from './i18n/core.js'
import { langToIntl, monthName as localizedMonthName } from './i18n/format.js'

/** 粒度分段控件选项，顺序与 iOS `TrendView` 一致（周/月/年）；label 为 i18n 键 */
export const GRANULARITIES = [
  { key: 'week', labelKey: 'trend.granularityWeek' },
  { key: 'month', labelKey: 'trend.granularityMonth' },
  { key: 'year', labelKey: 'trend.granularityYear' },
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
 * @param {(key: string, options?: object) => string} [t=coreT] i18n 翻译函数
 * @returns {string}
 */
export function formatDeltaText(percent, t = coreT) {
  if (percent === null || !Number.isFinite(percent)) return '—'
  const rounded = Math.round(percent * 10) / 10
  if (Math.abs(rounded) < 0.05) return t('trend.flat')
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
 * 桶 key → 坐标轴短标签。"2026-W31" → "W31"；"2026-08" → "8月"/"8"；"2026" → "2026"
 * @param {string} key
 * @param {string} granularity
 * @param {(key: string, options?: object) => string} [t=coreT] i18n 翻译函数
 * @returns {string}
 */
export function shortLabel(key, granularity, t = coreT) {
  if (typeof key !== 'string' || !key) return ''
  if (granularity === 'week') {
    const index = key.indexOf('-W')
    return index >= 0 ? `W${key.slice(index + 2)}` : key
  }
  if (granularity === 'month') {
    const month = key.split('-')[1]
    return month ? t('trend.monthShort', { month: Number(month) }) : key
  }
  return key
}

/**
 * 桶 key → 周期标题。与 iOS `SummaryBuilder.displayTitle` 文案一致。
 * @param {string} key
 * @param {string} granularity
 * @param {(key: string, options?: object) => string} [t=coreT] i18n 翻译函数
 * @param {string} [lang='zh-CN'] Intl locale（用于月份名）
 * @returns {string}
 */
export function periodTitle(key, granularity, t = coreT, lang = 'zh-CN') {
  if (typeof key !== 'string' || !key) return '—'
  if (granularity === 'week') {
    const [year, week] = key.split('-W')
    return week ? t('trend.periodWeek', { year, week: Number(week) }) : key
  }
  if (granularity === 'month') {
    const [year, month] = key.split('-')
    // 两种语言插值字段不同：zh 用数字月（2026年8月），en 用本地化月份名（August 2026）
    return month
      ? t('trend.periodMonth', { year, month: Number(month), monthName: localizedMonthName(month, lang) })
      : key
  }
  return t('trend.periodYear', { year: key })
}

/** 环比行的标题文案，与 iOS `PeriodGranularity.comparisonLabel` 一致 */
export function comparisonLabel(granularity, t = coreT) {
  if (granularity === 'week') return t('trend.compareWeek')
  if (granularity === 'year') return t('trend.compareYear')
  return t('trend.compareMonth')
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
 * @param {(key: string, options?: object) => string} [t=coreT] i18n 翻译函数
 * @returns {Array<{title: string, percent: number|null}>}
 */
export function buildDeltas(current, previous, t = coreT) {
  const fields = [
    { title: t('trend.deltaDistance'), pick: (bucket) => bucket.distance },
    { title: t('trend.deltaDuration'), pick: (bucket) => bucket.duration },
    { title: t('trend.deltaCount'), pick: (bucket) => bucket.count },
    { title: t('trend.deltaAscent'), pick: (bucket) => bucket.ascent },
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

// ── 有氧适能（VO₂max）折线几何与展示辅助（T07）────────────
//
// ⚠️ 只做**渲染几何**，**不做任何聚合**：窗口截取 / windowAvg / delta / 死区 / direction
//    全部由原生 `CardioFitnessSummary.build` 算完经 `/api/cardio` 下发（架构硬规则）。
//    但 Y 轴留白口径（`cardioDomain`）属于渲染几何，逐行复刻 iOS `yDomain`，不违反该规则。

/**
 * 折线图几何——**连续时间轴**版本（VO₂max 专用）。
 *
 * 与 `buildLineSegments` 的分工（别合并这两个函数）：
 * - `buildLineSegments` 的 X 是**桶序号**（等距分类轴）。周期桶天然等距、后端已补零，等距是对的。
 * - VO₂max 由 Apple Watch 按自身节奏写入，**间隔从几天到几周不等**。按序号等距画，会把
 *   「三年前的 2 个点」和「上周的 2 个点」拉成同样疏密，完全失真。故 X 按**真实时间比例**映射，
 *   与 iOS `CardioFitnessCard` 的 `x: .value("Date", sample.date)` 连续 Date 轴同口径。
 *
 * @param {Array<{date: string, value: number}>} samples ISO 8601，后端保证升序（此处仍防御排序）
 * @param {(sample: object) => (number|null)} [valueOf]
 */
export function buildDateLineSegments(samples, valueOf = (sample) => sample.value) {
  const { width, height, padTop, padBottom, padX } = CHART
  const empty = { segments: [], points: [], min: null, max: null, domain: null, tMin: null, tMax: null }
  if (!Array.isArray(samples) || !samples.length) return empty

  // 时间戳不可解析的样本**整条丢弃**，而不是当断点。
  // 断点的语义是「这个时刻没有值」——它在 X 轴上仍有确定位置；
  // 而时间本身无效的样本在时间轴上**根本没有位置**，留着只会算出 NaN 坐标污染整张图。
  const parsed = samples
    .map((sample) => ({
      key: sample && typeof sample.date === 'string' ? sample.date : '',
      t: Date.parse(sample && sample.date),
      raw: sample,
    }))
    .filter((item) => Number.isFinite(item.t))
    .sort((a, b) => a.t - b.t)
  if (!parsed.length) return empty

  const tMin = parsed[0].t
  const tMax = parsed[parsed.length - 1].t
  const tSpan = tMax - tMin
  const plotWidth = width - padX * 2
  // 单样本 / 所有样本同一时刻 → tSpan = 0，居中画，避免除零产出 NaN（R14）
  const xFor = (t) => (tSpan <= 0 ? padX + plotWidth / 2 : padX + ((t - tMin) / tSpan) * plotWidth)

  const rows = parsed.map((item) => {
    const value = Number(valueOf(item.raw))
    // 与 buildLineSegments 同口径：null / 0 / NaN / Infinity → 断点
    return {
      key: item.key,
      t: item.t,
      x: xFor(item.t),
      value: Number.isFinite(value) && value > 0 ? value : null,
    }
  })

  const values = rows.filter((row) => row.value !== null).map((row) => row.value)
  if (!values.length) return empty

  const min = Math.min(...values)
  const max = Math.max(...values)
  const domain = cardioDomain(min, max)
  const plotHeight = height - padTop - padBottom
  const span = domain.hi - domain.lo
  const yFor = (value) => (span <= 0
    ? padTop + plotHeight / 2
    : padTop + plotHeight - ((value - domain.lo) / span) * plotHeight)

  const segments = []
  let current = []
  rows.forEach((row) => {
    if (row.value === null) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push({ key: row.key, t: row.t, x: row.x, y: yFor(row.value), value: row.value })
  })
  if (current.length) segments.push(current)

  return { segments, points: segments.flat(), min, max, domain, tMin, tMax }
}

/**
 * Y 域——**逐行复刻** iOS `CardioFitnessCard.yDomain`。
 *
 * 为什么不像 `buildLineSegments` 那样直接用 min..max 贴满：VO₂max 实际区间仅 30–60，
 * 贴满会把 ±0.5 的噪声画成满屏起伏，同一份数据两端观感差一个量级。
 * 规则：`hi − lo < 1` → `lo−1 .. hi+1`（单点 / 全等值防退化）；否则上下各留 15%。
 */
export function cardioDomain(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 }
  if (hi - lo < 1) return { lo: lo - 1, hi: hi + 1 }
  const pad = (hi - lo) * 0.15
  return { lo: lo - pad, hi: hi + pad }
}

/**
 * 时间轴刻度：按**时间**等分，不按样本序号。
 * 与 iOS `AxisMarks(values: .automatic(desiredCount: 4))` 同口径。
 * 样本序号等分会在稀疏区堆标签、密集区没标签（R15）。
 */
export function buildDateAxisTicks(tMin, tMax, count = 4) {
  const { width, padX } = CHART
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return []
  const plotWidth = width - padX * 2
  if (tMax - tMin <= 0) return [{ t: tMin, x: padX + plotWidth / 2 }]
  const steps = Math.max(2, Math.min(6, Math.floor(count)))
  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1)
    return { t: tMin + (tMax - tMin) * ratio, x: padX + plotWidth * ratio }
  })
}

/** 「52.3」；无数据「—」。与 iOS `latestValueText` 同口径（1 位小数） */
export function formatCardioValue(value) {
  if (value == null) return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(1) : '—'
}

/**
 * 「↑1.2」/「↓0.8」/「持平」/「—」。与 iOS `CardioFitnessSummary.deltaText` 同口径。
 *
 * ★ **方向一律取原生下发的 `direction`，本函数绝不自己判正负**——
 *   死区 0.5 的判定在 Swift 里，Web 复判一遍两端迟早漂开。
 *   delta 缺失（null / undefined）即便 direction=up/down 也兜底「—」，与 iOS `deltaText` 一致。
 */
export function formatCardioDelta(delta, direction, t = coreT) {
  if (direction === 'flat') return t('trend.flat')
  if (direction !== 'up' && direction !== 'down') return '—'
  if (delta == null) return '—'
  const number = Number(delta)
  if (!Number.isFinite(number)) return '—'
  return `${number > 0 ? '↑' : '↓'}${Math.abs(number).toFixed(1)}`
}

/** direction → 既有 `.trend-delta-*` 配色类后缀（up=青 / down=橙 / flat·none=灰，同 iOS tint） */
export function cardioDirectionClass(direction) {
  return direction === 'up' || direction === 'down' || direction === 'flat' ? direction : 'none'
}

/** 窗口标题 / 环比前缀的 i18n 键（**不用后端 windowTitle**，它是设备语言） */
export function cardioWindowTitleKey(granularity) {
  if (granularity === 'week') return 'trend.cardioWindowWeek'
  if (granularity === 'year') return 'trend.cardioWindowYear'
  return 'trend.cardioWindowMonth'
}

export function cardioComparisonKey(granularity) {
  if (granularity === 'week') return 'trend.cardioVsWeek'
  if (granularity === 'year') return 'trend.cardioVsYear'
  return 'trend.cardioVsMonth'
}

/** 大号值下方的日期。对齐 iOS `.dateTime.year().month().day()` */
export function formatCardioDate(input, lang = 'zh-CN') {
  const t = typeof input === 'number' ? input : Date.parse(input)
  if (!Number.isFinite(t)) return '—'
  return new Intl.DateTimeFormat(langToIntl(lang),
    { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(t))
}

/** X 轴标签。周/月 →「8/4」；年 →「2026」。对齐 iOS `xAxisFormat` */
export function formatCardioAxisDate(t, granularity, lang = 'zh-CN') {
  if (!Number.isFinite(t)) return ''
  const options = granularity === 'year'
    ? { year: 'numeric' }
    : { month: 'numeric', day: 'numeric' }
  return new Intl.DateTimeFormat(langToIntl(lang), options).format(new Date(t))
}
