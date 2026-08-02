const activityTypeToCategory = {
  running: 'run',
  cycling: 'ride',
  walking: 'walk',
  hiking: 'hike',
}

function toCategory(type) {
  return activityTypeToCategory[type] || 'other'
}

function dateParts(iso) {
  const d = new Date(iso)
  return { year: d.getFullYear(), date: iso.slice(0, 10) }
}

function computeBounds(points) {
  if (!points.length) return [[0, 0], [0, 0]]
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const [lat, lon] of points) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
  }
  return [[minLat, minLon], [maxLat, maxLon]]
}

function transformRoute(raw) {
  const points = (raw.coordinates || []).map((c) => [c.lat, c.lon, c.elevation, c.timeOffset])
  const { year, date } = dateParts(raw.startDate)
  return {
    id: raw.id,
    category: toCategory(raw.activityType),
    year,
    date,
    distanceKm: raw.distance / 1000,
    durationMin: raw.duration / 60,
    ascentM: raw.totalAscent,
    source: 'Apple 健康',
    points,
    bounds: computeBounds(points),
  }
}

function computeCumulativeDistances(coordinates) {
  const out = [0]
  for (let i = 1; i < coordinates.length; i++) {
    const [lat1, lon1] = [coordinates[i - 1].lat, coordinates[i - 1].lon]
    const [lat2, lon2] = [coordinates[i].lat, coordinates[i].lon]
    // 球面余弦近似（对小段足够精确）
    const dlat = (lat2 - lat1) * (Math.PI / 180)
    const dlon = (lon2 - lon1) * (Math.PI / 180)
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2
    const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    out.push(out[i - 1] + Math.abs(dist))
  }
  return out
}

function computeStats(values) {
  if (!values.length) return { min: null, max: null }
  return { min: Math.min(...values), max: Math.max(...values) }
}

function transformMetrics(raw) {
  const coords = raw.coordinates || []
  const distances = computeCumulativeDistances(coords)
  const hrSamples = (raw.heartRate || []).map((p) => [p.timeOffset, p.value])
  const hrValues = (raw.heartRate || []).map((p) => p.value)
  const hrStats = computeStats(hrValues)
  const hrAvg = hrValues.length ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null

  // 海拔采样：对齐坐标数组，附带累积距离
  const elevSamples = coords.map((c, i) => [distances[i], c.timeOffset, c.elevation])
  const elevValues = coords.map((c) => c.elevation)
  const elevStats = computeStats(elevValues)

  return {
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
      descentM: null,
    },
  }
}

export const apiRouteRepository = {
  async listRoutes() {
    const resp = await fetch('/api/routes')
    if (!resp.ok) throw new Error('未找到路线数据')
    const raw = await resp.json()
    const routes = (Array.isArray(raw) ? raw : raw.routes || []).map(transformRoute)
    return { routes, routeCount: routes.length }
  },

  async getRouteMetrics(route) {
    if (!route?.id) return null
    const resp = await fetch(`/api/metrics/${route.id}`)
    if (!resp.ok) throw new Error('未找到路线指标数据')
    return transformMetrics(await resp.json())
  },
}
