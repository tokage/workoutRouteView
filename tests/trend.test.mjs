import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHART,
  CHART_BUCKET_LIMIT,
  buildBars,
  buildDeltas,
  buildLineSegments,
  comparisonLabel,
  deltaDirection,
  formatDeltaText,
  isEmptySummary,
  percentDelta,
  periodTitle,
  pickChartBuckets,
  pickPeriods,
  shortLabel,
  toPath,
  usesPace,
} from '../src/trend.js'
import { i18n } from '../src/i18n/core.js'

/** 构造绑定指定语言的 t（UI 语言语义；纯逻辑默认 t 恒为 zh-Hans 源语言） */
function tFor(lang) {
  return (key, options) => i18n.t(key, { ...(options || {}), lng: lang })
}

/** 造一个 /api/summary 形状的桶（字段名与 iOS PeriodBucket 的 camelCase 一致） */
function bucket(key, overrides = {}) {
  return {
    key,
    start: '2026-08-01T00:00:00Z',
    end: '2026-09-01T00:00:00Z',
    count: 1,
    distance: 10000,
    duration: 3000,
    ascent: 100,
    avgPace: 300,
    avgHeartRate: 150,
    ...overrides,
  }
}

// ── 环比：除零保护是本组的核心 ────────────────────────────

test('percentDelta 上一周期为 0 时返回 null，不产出 Infinity', () => {
  assert.equal(percentDelta(100, 0), null)
  assert.equal(percentDelta(0, 0), null)
})

test('percentDelta 对非有限输入一律返回 null，不产出 NaN', () => {
  assert.equal(percentDelta(Number.NaN, 10), null)
  assert.equal(percentDelta(10, Number.NaN), null)
  assert.equal(percentDelta(10, Number.POSITIVE_INFINITY), null)
  assert.equal(percentDelta(undefined, 10), null)
})

test('percentDelta 正常涨跌', () => {
  assert.equal(percentDelta(120, 100), 20)
  assert.equal(percentDelta(80, 100), -20)
  assert.equal(percentDelta(100, 100), 0)
})

test('formatDeltaText 无法计算时显示「—」，绝不出现 NaN/Infinity/∞', () => {
  const text = formatDeltaText(percentDelta(100, 0))
  assert.equal(text, '—')
  assert.ok(!/NaN|Infinity|∞/.test(text))
})

test('formatDeltaText 带符号、保留一位小数、极小变化归为持平', () => {
  assert.equal(formatDeltaText(20), '+20.0%')
  assert.equal(formatDeltaText(-12.34), '-12.3%')
  assert.equal(formatDeltaText(0), '持平')
  assert.equal(formatDeltaText(0.01), '持平')
})

test('deltaDirection 四态', () => {
  assert.equal(deltaDirection(5), 'up')
  assert.equal(deltaDirection(-5), 'down')
  assert.equal(deltaDirection(0), 'flat')
  assert.equal(deltaDirection(null), 'none')
})

// ── 周期选取与四项环比 ──────────────────────────────────

test('pickPeriods 取末两个桶作为本周期 / 上一周期', () => {
  const buckets = [bucket('2026-06'), bucket('2026-07'), bucket('2026-08')]
  const { current, previous } = pickPeriods(buckets)
  assert.equal(current.key, '2026-08')
  assert.equal(previous.key, '2026-07')
})

test('pickPeriods 只有一个周期时 previous 为 null', () => {
  const { current, previous } = pickPeriods([bucket('2026-08')])
  assert.equal(current.key, '2026-08')
  assert.equal(previous, null)
})

test('pickPeriods 空输入不炸', () => {
  assert.deepEqual(pickPeriods([]), { current: null, previous: null })
  assert.deepEqual(pickPeriods(null), { current: null, previous: null })
})

test('buildDeltas 产出距离/时长/次数/爬升四项，与 iOS PeriodSummaryCard 一致', () => {
  const previous = bucket('2026-07', { distance: 10000, duration: 3000, count: 2, ascent: 100 })
  const current = bucket('2026-08', { distance: 15000, duration: 2400, count: 2, ascent: 0 })
  const deltas = buildDeltas(current, previous)
  assert.deepEqual(deltas.map((d) => d.title), ['距离', '时长', '次数', '爬升'])
  assert.equal(deltas[0].percent, 50)
  assert.equal(deltas[1].percent, -20)
  assert.equal(deltas[2].percent, 0)
  assert.equal(deltas[3].percent, -100)
})

test('buildDeltas 首个周期（previous 为 null）四项全 null → 全部渲染「—」', () => {
  const deltas = buildDeltas(bucket('2026-08'), null)
  assert.equal(deltas.length, 4)
  deltas.forEach((delta) => {
    assert.equal(delta.percent, null)
    assert.equal(formatDeltaText(delta.percent), '—')
  })
})

test('buildDeltas 上期爬升为 0 时该项显示「—」而非 ∞', () => {
  const previous = bucket('2026-07', { ascent: 0 })
  const current = bucket('2026-08', { ascent: 500 })
  const ascentDelta = buildDeltas(current, previous).find((d) => d.title === '爬升')
  assert.equal(ascentDelta.percent, null)
  assert.equal(formatDeltaText(ascentDelta.percent), '—')
})

// ── 图表桶截断 ──────────────────────────────────────────

test('pickChartBuckets 按粒度截断到最近 N 个（周12/月12/年8）', () => {
  const many = Array.from({ length: 40 }, (_, i) => bucket(`k${i}`))
  assert.equal(pickChartBuckets(many, 'week').length, CHART_BUCKET_LIMIT.week)
  assert.equal(pickChartBuckets(many, 'month').length, CHART_BUCKET_LIMIT.month)
  assert.equal(pickChartBuckets(many, 'year').length, CHART_BUCKET_LIMIT.year)
  // 取的是最近的，不是最早的
  assert.equal(pickChartBuckets(many, 'year').at(-1).key, 'k39')
})

test('pickChartBuckets 不足上限时原样返回，空输入返回空数组', () => {
  assert.equal(pickChartBuckets([bucket('a'), bucket('b')], 'month').length, 2)
  assert.deepEqual(pickChartBuckets([], 'month'), [])
  assert.deepEqual(pickChartBuckets(null, 'month'), [])
})

// ── 柱状图几何 ──────────────────────────────────────────

test('buildBars 空桶（count=0）产出高度为 0 的柱子而不是被丢弃', () => {
  const buckets = [
    bucket('2026-06', { count: 2, distance: 20000 }),
    bucket('2026-07', { count: 0, distance: 0 }),
    bucket('2026-08', { count: 1, distance: 10000 }),
  ]
  const { bars, max } = buildBars(buckets, (b) => b.distance)
  assert.equal(bars.length, 3, '时间轴要保持连续，空周期不能跳过')
  assert.equal(max, 20000)
  assert.equal(bars[1].height, 0)
  assert.equal(bars[0].height > bars[2].height, true)
})

test('buildBars 全空桶时不除零，所有柱高为 0', () => {
  const buckets = [bucket('a', { distance: 0 }), bucket('b', { distance: 0 })]
  const { bars, max } = buildBars(buckets, (b) => b.distance)
  assert.equal(max, 0)
  bars.forEach((bar) => {
    assert.equal(bar.height, 0)
    assert.ok(Number.isFinite(bar.y))
  })
})

test('buildBars 所有几何值有限且落在画布内', () => {
  const buckets = Array.from({ length: 12 }, (_, i) => bucket(`k${i}`, { distance: (i + 1) * 1000 }))
  const { bars } = buildBars(buckets, (b) => b.distance)
  bars.forEach((bar) => {
    assert.ok(Number.isFinite(bar.x) && Number.isFinite(bar.y))
    assert.ok(bar.width > 0)
    assert.ok(bar.x >= 0 && bar.x + bar.width <= CHART.width)
    assert.ok(bar.y >= 0 && bar.y + bar.height <= CHART.height)
  })
})

test('buildBars 负值 / 非法值按 0 处理', () => {
  const buckets = [bucket('a', { distance: -5 }), bucket('b', { distance: null }), bucket('c', { distance: 1000 })]
  const { bars } = buildBars(buckets, (b) => b.distance)
  assert.equal(bars[0].value, 0)
  assert.equal(bars[1].value, 0)
  assert.equal(bars[2].value, 1000)
})

test('buildBars 空输入返回空结果', () => {
  assert.deepEqual(buildBars([], (b) => b.distance), { bars: [], max: 0 })
})

// ── 折线图几何：断点是核心 ───────────────────────────────

test('buildLineSegments 遇到 avgPace 为 null 时断线，而不是当 0 画', () => {
  const buckets = [
    bucket('a', { avgPace: 300 }),
    bucket('b', { avgPace: 320 }),
    bucket('c', { avgPace: null }),   // 空周期
    bucket('d', { avgPace: 290 }),
    bucket('e', { avgPace: 310 }),
  ]
  const { segments, points } = buildLineSegments(buckets, (b) => b.avgPace)
  assert.equal(segments.length, 2, 'null 处应断成两段')
  assert.equal(segments[0].length, 2)
  assert.equal(segments[1].length, 2)
  assert.equal(points.length, 4, '断点本身不产生描点')
  // 没有任何点被画到基线（0 值的位置）
  const baselineY = CHART.height - CHART.padBottom
  points.forEach((point) => assert.ok(point.y < baselineY + 0.001))
})

test('buildLineSegments 把 0 与非有限值同样视为断点', () => {
  const buckets = [
    bucket('a', { avgPace: 300 }),
    bucket('b', { avgPace: 0 }),
    bucket('c', { avgPace: Number.NaN }),
    bucket('d', { avgPace: 280 }),
  ]
  const { segments, points } = buildLineSegments(buckets, (b) => b.avgPace)
  assert.equal(segments.length, 2)
  assert.equal(points.length, 2)
})

test('buildLineSegments 全为 null 时返回空，供 UI 走空态分支', () => {
  const buckets = [bucket('a', { avgPace: null }), bucket('b', { avgPace: null })]
  const result = buildLineSegments(buckets, (b) => b.avgPace)
  assert.deepEqual(result.segments, [])
  assert.equal(result.min, null)
})

test('buildLineSegments 单点 / 全等值时居中，不除零', () => {
  const single = buildLineSegments([bucket('a', { avgPace: 300 })], (b) => b.avgPace)
  assert.equal(single.points.length, 1)
  assert.ok(Number.isFinite(single.points[0].y))

  const flat = buildLineSegments(
    [bucket('a', { avgPace: 300 }), bucket('b', { avgPace: 300 })],
    (b) => b.avgPace,
  )
  flat.points.forEach((point) => assert.ok(Number.isFinite(point.y)))
  assert.equal(flat.points[0].y, flat.points[1].y)
})

test('buildLineSegments 支持骑行的 km/h 换算取值（越大越靠上）', () => {
  const buckets = [bucket('a', { avgPace: 240 }), bucket('b', { avgPace: 120 })]
  // 240 秒/km = 15 km/h；120 秒/km = 30 km/h
  const { points } = buildLineSegments(buckets, (b) => 3600 / b.avgPace)
  assert.equal(points[0].value, 15)
  assert.equal(points[1].value, 30)
  assert.ok(points[1].y < points[0].y, '速度更快的点应更靠上')
})

test('toPath 生成合法 SVG path，空段返回空串', () => {
  const path = toPath([{ x: 1, y: 2 }, { x: 3, y: 4 }])
  assert.equal(path, 'M1.00 2.00 L3.00 4.00')
  assert.equal(toPath([]), '')
  assert.equal(toPath(null), '')
})

// ── 文案 ────────────────────────────────────────────────

test('shortLabel 按粒度产出轴标签', () => {
  assert.equal(shortLabel('2026-W31', 'week'), 'W31')
  assert.equal(shortLabel('2026-08', 'month'), '8月')
  assert.equal(shortLabel('2026', 'year'), '2026')
})

test('periodTitle 与 iOS displayTitle 文案一致', () => {
  assert.equal(periodTitle('2026-W31', 'week'), '2026年第31周')
  assert.equal(periodTitle('2026-08', 'month'), '2026年8月')
  assert.equal(periodTitle('2026', 'year'), '2026年')
  assert.equal(periodTitle('2025-W01', 'week'), '2025年第1周')
})

test('periodTitle / shortLabel 对空 key 不炸', () => {
  assert.equal(periodTitle('', 'month'), '—')
  assert.equal(shortLabel(null, 'month'), '')
})

test('comparisonLabel 按粒度切换', () => {
  assert.equal(comparisonLabel('week'), '较上周')
  assert.equal(comparisonLabel('month'), '较上月')
  assert.equal(comparisonLabel('year'), '较上年')
})

test('usesPace 仅骑行走速度口径，与 iOS ActivityType.usesPace 一致', () => {
  assert.equal(usesPace('ride'), false)
  assert.equal(usesPace('run'), true)
  assert.equal(usesPace('walk'), true)
  assert.equal(usesPace('hike'), true)
  assert.equal(usesPace('all'), true)
})

// ── 空态 ────────────────────────────────────────────────

test('isEmptySummary：无桶、或全部 count=0（补零桶）都算空', () => {
  assert.equal(isEmptySummary([]), true)
  assert.equal(isEmptySummary(null), true)
  assert.equal(isEmptySummary([bucket('a', { count: 0 }), bucket('b', { count: 0 })]), true)
  assert.equal(isEmptySummary([bucket('a', { count: 0 }), bucket('b', { count: 1 })]), false)
})

// ── en 文案抽查（显式传 en t；默认 t 恒为 zh-Hans，见上）──

test('en 文案：formatDeltaText / periodTitle / comparisonLabel / shortLabel', () => {
  const enT = tFor('en')
  assert.equal(formatDeltaText(0, enT), 'Flat')
  assert.equal(formatDeltaText(20, enT), '+20.0%')
  assert.equal(periodTitle('2026-W31', 'week', enT, 'en-US'), 'Week 31, 2026')
  assert.equal(periodTitle('2026-08', 'month', enT, 'en-US'), 'August 2026')
  assert.equal(periodTitle('2026', 'year', enT, 'en-US'), '2026')
  assert.equal(comparisonLabel('week', enT), 'vs last week')
  assert.equal(comparisonLabel('month', enT), 'vs last month')
  assert.equal(comparisonLabel('year', enT), 'vs last year')
  assert.equal(shortLabel('2026-08', 'month', enT), '8')
  assert.equal(shortLabel('2026-W31', 'week', enT), 'W31')
})

test('en 文案：buildDeltas 四项标题', () => {
  const enT = tFor('en')
  const previous = bucket('2026-07', { distance: 10000, duration: 3000, count: 2, ascent: 100 })
  const current = bucket('2026-08', { distance: 15000, duration: 2400, count: 2, ascent: 0 })
  const deltas = buildDeltas(current, previous, enT)
  assert.deepEqual(deltas.map((d) => d.title), ['Distance', 'Duration', 'Count', 'Ascent'])
  assert.equal(deltas[0].percent, 50)
})
