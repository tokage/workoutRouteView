const activityTypeToCategory = {
  running: 'run',
  cycling: 'ride',
  walking: 'walk',
  hiking: 'hike',
}

function toCategory(type) {
  return activityTypeToCategory[type?.toLowerCase()] || 'other'
}

function dateParts(iso) {
  const d = new Date(iso)
  return { year: d.getFullYear(), date: iso.slice(0, 10) }
}

/**
 * v2 摘要适配（架构方案 §2.3）：
 * - 列表不再内嵌 coordinates（已移入 metrics），轨迹按需经 getRouteTrack 拉取
 * - bounds 直接读后端 bbox，不再前端 computeBounds
 * - 接回后端 avgPace/avgHeartRate/maxHeartRate/endDate/hasRoute/totalDescent
 */
function transformRoute(raw) {
  const { year, date } = dateParts(raw.startDate)
  const bbox = raw.bbox
  const bounds = bbox
    ? [[bbox.minLat, bbox.minLon], [bbox.maxLat, bbox.maxLon]]
    : [[0, 0], [0, 0]]
  return {
    id: raw.id,
    category: toCategory(raw.activityType),
    year,
    date,
    distanceKm: raw.distance / 1000,
    durationMin: raw.duration / 60,
    ascentM: raw.totalAscent,
    descentM: raw.totalDescent ?? null,
    avgPace: raw.avgPace ?? null,             // 秒/km（后端整体口径，前端不再现算）
    avgHeartRate: raw.avgHeartRate ?? null,
    maxHeartRate: raw.maxHeartRate ?? null,
    endDate: raw.endDate ?? null,
    hasRoute: raw.hasRoute !== false,         // hasRoute=false 不画轨迹（D1）
    source: 'Apple 健康',
    points: [],                               // 占位；地图渲染时由 App 按需注入 getRouteTrack 结果
    bounds,
  }
}

function computeStats(values) {
  if (!values.length) return { min: null, max: null }
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * v2 metrics 适配：Coordinate 自带累计距离（distance），前端不再 computeCumulativeDistances。
 * 心率序列 [timeOffset, value]；海拔序列 [distance, timeOffset, elevation]（口径与旧版一致）。
 */
function transformMetrics(raw) {
  const coords = raw.coordinates || []
  const hrSamples = (raw.heartRate || []).map((p) => [p.timeOffset, p.value])
  const hrValues = (raw.heartRate || []).map((p) => p.value)
  const hrStats = computeStats(hrValues)
  const hrAvg = hrValues.length ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null

  const elevSamples = coords.map((c) => [c.distance, c.timeOffset, c.elevation])
  const elevValues = coords.map((c) => c.elevation)
  const elevStats = computeStats(elevValues)

  return {
    coordinates: coords.map((c) => [c.lat, c.lon, c.elevation, c.timeOffset]),
    heartRate: {
      samples: hrSamples,
      averageBpm: hrAvg,
      minimumBpm: hrStats.min,
      maximumBpm: hrStats.max,
    },
    elevation: {
      samples: elevSamples,
      minimumM: elevStats.min,
      maximumM: elevStats.max,
      ascentM: raw.summary?.totalAscent ?? null,
      descentM: raw.summary?.totalDescent ?? null,
    },
    pace: (raw.pace || []).map((p) => [p.timeOffset, p.distance, p.value]),
    splits: raw.splits || [],
  }
}

export const apiRouteRepository = {
  async listRoutes() {
    const resp = await fetch('/api/routes')
    if (!resp.ok) throw new Error('未找到路线数据')
    const raw = await resp.json()
    // v2 信封：{schemaVersion, total, routes}（v1 裸数组兜底兼容）
    const routes = (Array.isArray(raw) ? raw : raw.routes || []).map(transformRoute)
    return { routes, routeCount: routes.length }
  },

  async getRouteMetrics(route) {
    if (!route?.id) return null
    const resp = await fetch(`/api/metrics/${route.id}`)
    if (!resp.ok) throw new Error('未找到路线指标数据')
    return transformMetrics(await resp.json())
  },

  /** 按需拉取单条轨迹（v2 摘要不再内嵌 coordinates；供地图渲染） */
  async getRouteTrack(routeId) {
    if (!routeId) return []
    const resp = await fetch(`/api/metrics/${routeId}`)
    if (!resp.ok) throw new Error('未找到轨迹数据')
    const raw = await resp.json()
    return (raw.coordinates || []).map((c) => [c.lat, c.lon, c.elevation, c.timeOffset])
  },
}
