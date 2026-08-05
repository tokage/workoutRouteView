// 临时验证：用 mock fetch 跑真实 routeRepository.js，验证 v2 契约适配（白屏根因修复）
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
  elevation: [{ timeOffset: 0, distance: 0, value: 12.4 }],
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

let failures = 0
function check(cond, name) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures += 1
}

// ① listRoutes 适配信封，route 不再内嵌 coordinates，bounds 读 bbox
const { routes } = await apiRouteRepository.listRoutes()
check(routes.length === 2, '① 信封 {routes} 解析出 2 条')
check(routes[0].points.length === 0, '① v2 摘要不内嵌 coordinates（points 占位空）')
check(routes[0].bounds[0][0] === 30.1 && routes[0].bounds[1][1] === 120.2, '① bounds 读后端 bbox')
check(routes[0].avgPace === 327.6, '① 接回后端 avgPace=327.6')
check(routes[0].avgHeartRate === 152 && routes[0].maxHeartRate === 171, '① 接回 avg/maxHeartRate')
check(routes[0].endDate === '2026-08-04T07:56:23Z', '① 接回 endDate')
check(routes[0].hasRoute === true, '① hasRoute=true')
check(routes[0].category === 'run', '① activityType running → run')
check(routes[1].hasRoute === false, '① hasRoute=false 兜底')
check(routes[1].bounds[0][0] === 0, '① 无 bbox 时 bounds 退化为 [[0,0],[0,0]]')

// ② getRouteMetrics：coordinates 带累计距离、pace/splits 透出、descentM 修 null
const metrics = await apiRouteRepository.getRouteMetrics(routes[0])
check(metrics.coordinates.length === 3, '② metrics 透出 coordinates')
check(metrics.coordinates[1][0] === 30.12, '② coordinates [lat,lon,elev,time]')
check(metrics.elevation.samples[1][0] === 1000, '② 海拔序列用 Coordinate.distance（不再前端现算）')
check(metrics.elevation.descentM === 81, '② descentM 来自 summary.totalDescent（修 null）')
check(metrics.pace.length === 1 && metrics.pace[0][2] === 326.1, '② pace 序列透出')
check(metrics.splits.length === 1 && metrics.splits[0].isPartial === false, '② splits 透出')

// ③ getRouteTrack：按需拉轨迹供地图
const track = await apiRouteRepository.getRouteTrack('A1')
check(track.length === 3 && track[0][0] === 30.11, '③ getRouteTrack 返回坐标数组')
check(await apiRouteRepository.getRouteTrack(null).then((t) => t.length === 0), '③ getRouteTrack(null) 返回空数组不崩')

console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
