// 有氧适能（VO₂max）前端纯函数 + 契约测试。
// 覆盖 design §11.8.3 JS 必测用例：时间轴折线几何（tSpan=0 居中 / 脏值断段）、
// cardioDomain 三分支、axis ticks 退化、formatCardio* 展示、i18n key 映射，
// 以及用 mock fetch 跑真实 getCardioFitness（空态不抛错、400 抛错、脏字段归一、丢弃 windowTitle）。
// 命名 .test.mjs 以便 `npm run test:js`（node --test）自动拾取。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CHART,
  buildDateAxisTicks,
  buildDateLineSegments,
  cardioComparisonKey,
  cardioDirectionClass,
  cardioDomain,
  cardioWindowTitleKey,
  formatCardioDate,
  formatCardioDelta,
  formatCardioValue,
} from '../src/trend.js'

const { padX, width, padTop, padBottom, height } = CHART
const plotWidth = width - padX * 2
const plotHeight = height - padTop - padBottom

// ── 时间轴折线几何：核心（R14 / R15）────────────────────

test('① 正常多样本 → 单段、x 严格递增、首尾贴边', () => {
  const samples = [
    { date: '2026-01-01T00:00:00Z', value: 40 },
    { date: '2026-03-01T00:00:00Z', value: 45 },
    { date: '2026-06-01T00:00:00Z', value: 50 },
  ]
  const { segments, points } = buildDateLineSegments(samples)
  assert.equal(segments.length, 1, '全是有限正值 → 单段')
  assert.equal(points.length, 3)
  // 首点 x == padX；末点 x == width - padX
  assert.equal(points[0].x, padX)
  assert.equal(points.at(-1).x, width - padX)
  // x 严格递增
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].x > points[i - 1].x, 'x 必须严格递增')
  }
})

test('② 单样本 → x 居中、y 居中、domain 撑开 ±1（R14）', () => {
  const { segments, points, domain } = buildDateLineSegments([
    { date: '2026-01-01T00:00:00Z', value: 42 },
  ])
  assert.equal(points.length, 1)
  assert.equal(points[0].x, padX + plotWidth / 2, 'tSpan=0 居中')
  assert.ok(Number.isFinite(points[0].y))
  // 单点 y 落在画布中部
  assert.ok(Math.abs(points[0].y - (padTop + plotHeight / 2)) < 0.001)
  assert.deepEqual(domain, { lo: 41, hi: 43 }, 'hi-lo<1 → 撑开 ±1')
})

test('③ 全等值多样本 → y 全居中、domain 撑开 ±1', () => {
  const { points, domain } = buildDateLineSegments([
    { date: '2026-01-01T00:00:00Z', value: 50 },
    { date: '2026-02-01T00:00:00Z', value: 50 },
  ])
  assert.equal(points.length, 2)
  assert.equal(points[0].y, points[1].y, '全等值 y 全居中')
  assert.deepEqual(domain, { lo: 49, hi: 51 })
})

test('④ 含 0 / null / NaN / 负值 → 断成多段', () => {
  const { segments, points } = buildDateLineSegments([
    { date: '2026-01-01T00:00:00Z', value: 40 },
    { date: '2026-02-01T00:00:00Z', value: 0 },       // 0 → 断点
    { date: '2026-03-01T00:00:00Z', value: 42 },
    { date: '2026-04-01T00:00:00Z', value: -5 },      // 负值 → 断点
    { date: '2026-05-01T00:00:00Z', value: null },     // null → 断点
  ])
  assert.equal(segments.length, 2, '0 / 负值 / null 各断一次 → 两段')
  assert.equal(points.length, 2)
})

test('⑤ 非法 date → 该样本整条丢弃，所有 x/y 有限', () => {
  const { segments, points } = buildDateLineSegments([
    { date: 'abc', value: 40 },                       // 无法解析 → 丢弃
    { date: undefined, value: 41 },                   // 缺 date 字段 → 丢弃
    { date: '2026-03-01T00:00:00Z', value: 42 },
  ])
  // 仅剩 1 个有效样本
  assert.equal(segments.length, 1)
  assert.equal(points.length, 1)
  for (const point of points) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), '丢弃非法样本后不得残留 NaN 坐标')
  }
})

test('⑥ 8 年跨度稀疏样本 → x 单调、全部落在 [padX, width-padX]（R15）', () => {
  const samples = [
    { date: '2018-06-01T00:00:00Z', value: 38 },
    { date: '2021-01-01T00:00:00Z', value: 44 },
    { date: '2024-09-01T00:00:00Z', value: 49 },
    { date: '2026-03-01T00:00:00Z', value: 52 },
  ]
  const { points } = buildDateLineSegments(samples)
  assert.equal(points.length, 4)
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].x > points[i - 1].x, 'x 必须单调')
  }
  for (const point of points) {
    assert.ok(point.x >= padX - 1e-9 && point.x <= width - padX + 1e-9, 'x 不越界')
  }
})

// ── Y 域与轴刻度 ────────────────────────────────────────

test('⑦ cardioDomain 三分支；buildDateAxisTicks tMin==tMax 退化', () => {
  // 跨度 ≥ 1 → 上下各留 15%
  const wide = cardioDomain(40, 42)
  assert.ok(wide.lo < 40 && wide.hi > 42)
  // hi-lo < 1 → 撑开 ±1
  assert.deepEqual(cardioDomain(50, 50), { lo: 49, hi: 51 })
  // 非有限 → 兜底 0..1
  assert.deepEqual(cardioDomain(NaN, 5), { lo: 0, hi: 1 })

  // tMin == tMax → 退化为单刻度居中
  const degenerate = buildDateAxisTicks(1000, 1000)
  assert.equal(degenerate.length, 1)
  assert.equal(degenerate[0].x, padX + plotWidth / 2)

  // 正常区间 → 按时间等分 4 格
  const ticks = buildDateAxisTicks(0, 4000)
  assert.equal(ticks.length, 4)
  for (const tick of ticks) assert.ok(Number.isFinite(tick.x))
})

// ── 展示辅助 ────────────────────────────────────────────

test('⑧ formatCardioDelta 四方向 + delta 缺失 → 方向兜底', () => {
  assert.equal(formatCardioDelta(1.2, 'up', (k) => k), '↑1.2')
  assert.equal(formatCardioDelta(-0.8, 'down', (k) => k), '↓0.8')
  // direction=flat → 持平（取 i18n）
  assert.equal(formatCardioDelta(null, 'flat', (k) => '持平'), '持平')
  // direction 非 up/down/flat → '—'
  assert.equal(formatCardioDelta(1.0, 'unavailable', (k) => k), '—')
  // delta 缺失（null/undefined）即便 direction=up 也兜底 '—'，与 iOS deltaText 同口径
  assert.equal(formatCardioDelta(null, 'up', (k) => k), '—')
  assert.equal(formatCardioDelta(undefined, 'down', (k) => k), '—')
})

test('⑨ formatCardioValue / cardioDirectionClass / 两个 key 映射', () => {
  assert.equal(formatCardioValue(52.34), '52.3')
  assert.equal(formatCardioValue(null), '—')
  assert.equal(formatCardioValue(NaN), '—')

  assert.equal(cardioDirectionClass('up'), 'up')
  assert.equal(cardioDirectionClass('down'), 'down')
  assert.equal(cardioDirectionClass('flat'), 'flat')
  assert.equal(cardioDirectionClass('unavailable'), 'none')
  assert.equal(cardioDirectionClass('weird'), 'none')

  assert.equal(cardioWindowTitleKey('week'), 'trend.cardioWindowWeek')
  assert.equal(cardioWindowTitleKey('month'), 'trend.cardioWindowMonth')
  assert.equal(cardioWindowTitleKey('year'), 'trend.cardioWindowYear')
  assert.equal(cardioWindowTitleKey('unknown'), 'trend.cardioWindowMonth')

  assert.equal(cardioComparisonKey('week'), 'trend.cardioVsWeek')
  assert.equal(cardioComparisonKey('month'), 'trend.cardioVsMonth')
  assert.equal(cardioComparisonKey('year'), 'trend.cardioVsYear')
})

test('⑨b formatCardioDate 解析 ISO / 时间戳，非法返回 —', () => {
  assert.equal(formatCardioDate('2026-08-04T07:12:03Z', 'en-US'), '8/4/2026')
  assert.equal(formatCardioDate(Date.parse('2026-08-04T07:12:03Z'), 'en-US'), '8/4/2026')
  assert.equal(formatCardioDate('not-a-date', 'en-US'), '—')
})

// ── 契约：getCardioFitness（mock fetch）─────────────────

const cardioEnvelope = (overrides = {}) => ({
  hasData: true,
  latest: { date: '2026-08-04T07:12:03Z', value: 52.3 },
  windowedSeries: [{ date: '2026-08-04T07:12:03Z', value: 52.3 }],
  windowAvg: 51,
  previousAvg: 49.9,
  delta: 1.1,
  direction: 'up',
  windowTitle: 'Last 12 Months',
  ...overrides,
})

test('⑩ 200 空态不抛错、脏字段归一、返回值丢弃 windowTitle', async () => {
  const original = globalThis.fetch
  const originalWarn = console.warn
  const warns = []
  console.warn = (...args) => warns.push(args.join(' '))

  // 空态：hasData:false 是正常态，不是故障
  globalThis.fetch = async () => ({ ok: true, json: async () => cardioEnvelope({ hasData: false, latest: null, windowedSeries: [] }) })
  const { apiRouteRepository } = await import('../src/routeRepository.js')
  const empty = await apiRouteRepository.getCardioFitness({ granularity: 'month' })
  assert.equal(empty.hasData, false)
  assert.equal(empty.windowTitle, undefined, 'routeRepository 层丢弃设备语言的 windowTitle（C10）')

  // 脏字段归一：非字符串 date / 非有限 value 被丢弃；latest 透出
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => cardioEnvelope({
      windowedSeries: [
        { date: '2026-08-04T07:12:03Z', value: 52.3 },
        { date: 1700000000, value: 49.9 },            // 非字符串 date → 丢弃
        { date: '2026-07-01T00:00:00Z', value: 'oops' }, // 非有限 value → 丢弃
      ],
    }),
  })
  const dirty = await apiRouteRepository.getCardioFitness({ granularity: 'month' })
  assert.equal(dirty.windowedSeries.length, 1, '脏样本被归一丢弃')
  assert.equal(dirty.windowedSeries[0].value, 52.3)
  assert.equal(dirty.windowTitle, undefined, '返回值里不应有 windowTitle')
  assert.equal(dirty.latest.value, 52.3)

  globalThis.fetch = original
  console.warn = originalWarn
  assert.equal(warns.length, 0, '正常 200 不应触发 console.warn')
})

test('⑩b 400 抛 CARDIO_LOAD_FAILED，后端 message 仅 console.warn', async () => {
  const original = globalThis.fetch
  const originalWarn = console.warn
  const warns = []
  console.warn = (...args) => warns.push(args.join(' '))

  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({ error: 'invalid_granularity', message: 'granularity 必须是 week / month / year 之一，收到：daily' }),
  })
  const { apiRouteRepository } = await import('../src/routeRepository.js')
  await assert.rejects(apiRouteRepository.getCardioFitness({ granularity: 'daily' }), /CARDIO_LOAD_FAILED/)
  assert.ok(warns.some((w) => w.includes('granularity')), '后端中文 message 只进 console.warn')

  globalThis.fetch = original
  console.warn = originalWarn
})
