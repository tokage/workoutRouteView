// v2 契约回归测试：用 mock fetch 跑真实 routeRepository.js。
// 覆盖白屏根因（v2 摘要不内嵌 coordinates）、后端字段接回、海拔取自独立 elevation 序列（架构 §2.4）。
// 命名 .test.mjs 以便 `npm run test:js`（node --test）自动拾取。
import test from 'node:test'
import assert from 'node:assert/strict'

const routesEnvelope = {
  schemaVersion: 2,
  total: 2,
  routes: [
    {
      id: 'A1', schemaVersion: 2, activityType: 'running',
      startDate: '2026-08-04T07:12:03Z', endDate: '2026-08-04T07:56:23Z',
      duration: 2660, distance: 8120, totalAscent: 86, totalDescent: 81,
      avgHeartRate: 152, maxHeartRate: 171, avgPace: 327.6,
      hasRoute: true, hasHeartRate: true,
      bbox: { minLat: 30.1, minLon: 120.1, maxLat: 30.2, maxLon: 120.2 },
      thumbnail: [{ lat: 30.11, lon: 120.11 }],
    },
    {
      id: 'B2', schemaVersion: 2, activityType: 'walking',
      startDate: '2026-08-01T01:00:00Z', endDate: '2026-08-01T01:30:00Z',
      duration: 1800, distance: 2500, totalAscent: 5, totalDescent: 4,
      avgHeartRate: null, maxHeartRate: null, avgPace: 720,
      hasRoute: false, hasHeartRate: false,
      bbox: null, thumbnail: [],
    },
  ],
}

// 关键：coordinates 是 RDP 简化点（海拔 12.4/14.0/13.0），elevation 是独立原始序列（100/102/99）
// ——两者必须区分开，验证 Web 消费 elevation 而非 RDP 点（架构 §2.4）
const metricsV2 = {
  id: 'A1', schemaVersion: 2,
  summary: {
    id: 'A1', schemaVersion: 2, activityType: 'running',
    startDate: '2026-08-04T07:12:03Z', endDate: '2026-08-04T07:56:23Z',
    duration: 2660, distance: 8120, totalAscent: 86, totalDescent: 81,
    avgHeartRate: 152, maxHeartRate: 171, avgPace: 327.6,
    hasRoute: true, hasHeartRate: true,
    bbox: { minLat: 30.1, minLon: 120.1, maxLat: 30.2, maxLon: 120.2 },
    thumbnail: [],
  },
  coordinates: [
    { lat: 30.11, lon: 120.11, elevation: 12.4, timeOffset: 0, distance: 0 },
    { lat: 30.12, lon: 120.12, elevation: 14.0, timeOffset: 340, distance: 1000 },
    { lat: 30.13, lon: 120.13, elevation: 13.0, timeOffset: 680, distance: 2000 },
  ],
  heartRate: [{ timeOffset: 0, distance: 0, value: 118 }],
  elevation: [
    { timeOffset: 0, distance: 0, value: 100 },
    { timeOffset: 340, distance: 1000, value: 102 },
    { timeOffset: 680, distance: 2000, value: 99 },
  ],
  pace: [{ timeOffset: 30, distance: 92, value: 326.1 }],
  splits: [{ index: 1, distance: 1000, duration: 340, pace: 340, avgHeartRate: 148, ascent: 12, descent: 8, startTimeOffset: 0, endTimeOffset: 340, isPartial: false }],
  weather: null,
}

const urlToBody = {
  '/api/routes': routesEnvelope,
  '/api/metrics/A1': metricsV2,
}
globalThis.fetch = async (url) => {
  const key = typeof url === 'string' ? url : url.url
  const body = urlToBody[key]
  if (!body) return { ok: false, json: async () => { throw new Error('not found') } }
  return { ok: true, json: async () => body }
}

const { apiRouteRepository } = await import('../src/routeRepository.js')

test('① listRoutes 适配信封：不内嵌 coordinates、bounds 读 bbox、后端字段接回', async () => {
  const { routes } = await apiRouteRepository.listRoutes()
  assert.equal(routes.length, 2)
  assert.equal(routes[0].points.length, 0, 'v2 摘要不内嵌 coordinates（points 占位空）')
  assert.deepEqual(routes[0].bounds, [[30.1, 120.1], [30.2, 120.2]], 'bounds 读后端 bbox')
  assert.equal(routes[0].avgPace, 327.6)
  assert.equal(routes[0].avgHeartRate, 152)
  assert.equal(routes[0].maxHeartRate, 171)
  assert.equal(routes[0].endDate, '2026-08-04T07:56:23Z')
  assert.equal(routes[0].hasRoute, true)
  assert.equal(routes[0].category, 'run')
  assert.equal(routes[1].hasRoute, false, 'hasRoute=false 兜底')
  assert.deepEqual(routes[1].bounds, [[0, 0], [0, 0]], '无 bbox 退化为 [[0,0],[0,0]]')
})

test('② transformMetrics：海拔取自独立 elevation 序列，而非 RDP coordinates', async () => {
  const { routes } = await apiRouteRepository.listRoutes()
  const metrics = await apiRouteRepository.getRouteMetrics(routes[0])
  assert.equal(metrics.coordinates.length, 3, '地图轨迹仍来自 coordinates')
  assert.deepEqual(metrics.coordinates[1], [30.12, 120.12, 14.0, 340])
  // 海拔必须消费 raw.elevation（SeriesPoint{timeOffset,distance,value}），min/max 非 RDP 点的 12.4~14
  assert.equal(metrics.elevation.samples.length, 3)
  assert.deepEqual(metrics.elevation.samples[1], [1000, 340, 102], 'SeriesPoint → [distance, timeOffset, value]')
  assert.equal(metrics.elevation.minimumM, 99, 'min 来自 elevation 序列')
  assert.equal(metrics.elevation.maximumM, 102, 'max 来自 elevation 序列（非 RDP coords 的 14）')
  assert.equal(metrics.elevation.ascentM, 86, '爬升来自 summary.totalAscent')
  assert.equal(metrics.elevation.descentM, 81, '下降来自 summary.totalDescent（修 null）')
  assert.equal(metrics.pace.length, 1)
  assert.deepEqual(metrics.pace[0], [30, 92, 326.1])
  assert.equal(metrics.splits.length, 1)
  assert.equal(metrics.splits[0].isPartial, false)
  assert.equal(metrics.splits[0].pace, 340, '分段配速字段透出（供 SplitsTable 消费）')
  assert.equal(metrics.splits[0].avgHeartRate, 148, '分段心率字段透出（供 SplitsTable 消费）')
})

test('③ getRouteTrack：按需拉轨迹供地图渲染，空 id 不崩', async () => {
  const track = await apiRouteRepository.getRouteTrack('A1')
  assert.equal(track.length, 3)
  assert.equal(track[0][0], 30.11)
  const empty = await apiRouteRepository.getRouteTrack(null)
  assert.equal(empty.length, 0)
})
