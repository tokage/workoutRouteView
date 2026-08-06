// 对比纯逻辑（镜像 iOS ComparisonBuilder.swift，架构方案 §4 / §7 T3.2）。
//
// 与 iOS 端阈值、差值方向语义、跨类型处理、禁因果句式逐项一致（注释互引）。
// 纯函数命名空间，无状态无副作用：不碰 DOM、不发网络，输入相同输出必然相同，便于单测。
//
// 数据形状（与 iOS RouteSummary / WorkoutWeather 对应，字段名保持一致）：
//   summary: { id, activityType, startDate(Date|ISO), distance(m), duration(s),
//              avgPace(sec/km|null), avgHeartRate(bpm|null), maxHeartRate(bpm|null), totalAscent(m) }
//   weather:  { [id]: { temperature(°C|null), humidity(0-100|null), condition(rawString|null),
//                      windSpeed, fetchedAt } | undefined }
// pace 序列（来自 /api/metrics/:id，transformMetrics 透出的 [[timeOffset, distance, value]]）：
//   value 恒为 秒/km，distance 为累计米。

import { formatPaceSeconds, formatSpeedKmh } from './format'

export const MAX_ROUTES = 3

// ⚠️ 阈值常量两端各存一份：本表与 iOS ComparisonBuilder.Thresholds 必须逐项一致。
// 改这里请同步改 iOS，反之亦然（iOS 文件顶部同样注释互引）。
export const THRESHOLDS = {
  paceSeconds: 5, // ≥5 秒/km 触发配速归因
  paceRelative: 0.03, // ≥3% 触发
  heartRateBpm: 5, // ≥5 bpm 触发均心率归因
  temperatureCelsius: 3, // ≥3°C 计入环境线索
  humidityPercent: 10, // ≥10% 计入环境线索
  ascentMeters: 20, // ≥20 m 计入环境线索（iOS 取 20m，约为 GPS 海拔噪声量级）
}

// 差值死区（落在内判 .flat，避免传感器噪声被渲染成「进步/退步」）
const DEADBAND = {
  distanceMeters: 10,
  durationSeconds: 5,
  paceSeconds: 1,
  speedKmh: 0.2,
  heartRateBpm: 1,
  ascentMeters: 1,
  temperatureCelsius: 0.5,
  humidityPercent: 1,
}

// 天气现象 raw value → 中文显示名（镜像 iOS WeatherCondition.displayName）
export const WEATHER_CONDITION_LABELS = {
  clear: '晴',
  partlyCloudy: '多云',
  cloudy: '阴',
  rain: '雨',
  snow: '雪',
  fog: '雾',
  wind: '风',
}

export function conditionLabel(condition) {
  return (condition && WEATHER_CONDITION_LABELS[condition]) || '—'
}

// 运动类型是否用配速（镜像 iOS ActivityType.usesPace：除 cycling 外均用 秒/km）
export function usesPace(summary) {
  return summary.activityType !== 'cycling'
}

// 列头标签：日期 "M月d日"（镜像 iOS ComparisonBuilder.columnLabel，zh_CN）
export function columnLabel(summary) {
  const date = new Date(summary.startDate)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
}

// 统一列序：按开始时间降序（最新在最左），截断到上限 3 条；最后一列 = 基准（最早）
export function order(routes) {
  return [...routes]
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .slice(0, MAX_ROUTES)
}

// ── 格式化（与 Web format.js / iOS ComparisonBuilder 同口径）────────

function signed(text, isPositive) {
  return (isPositive ? '+' : '−') + text
}

export function formatDuration(seconds) {
  const total = Math.round(seconds || 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

// 由差值与极性推出方向语义（死区内一律 flat，中性指标永不出 better/worse）
function directionOf(delta, polarity, deadband) {
  if (Math.abs(delta) <= deadband) return 'flat'
  switch (polarity) {
    case 'neutral':
      return 'flat'
    case 'lowerIsBetter':
      return delta < 0 ? 'better' : 'worse'
    case 'higherIsBetter':
      return delta > 0 ? 'better' : 'worse'
    default:
      return 'flat'
  }
}

// ── 通用行构建（值格式化 + 相对基准列的差值 + 方向语义）────────

function numericRow({ key, title, values, polarity, showsDelta, deadband, format, formatDelta }) {
  const baselineIndex = values.length - 1
  const baseline = values[baselineIndex]
  const cells = values.map((value, index) => {
    const text = value == null ? '—' : format(value)
    if (!showsDelta || index === baselineIndex || value == null || baseline == null) {
      return { text, deltaText: null, direction: 'none' }
    }
    const delta = value - baseline
    return { text, deltaText: formatDelta(delta), direction: directionOf(delta, polarity, deadband) }
  })
  return { key, title, cells, showsDelta }
}

// ── 6 项运动内指标 ────────────────────────────────

function metricRows(routes, isCrossType) {
  const showsDelta = !isCrossType
  const pick = (selector) => routes.map(selector)
  const rows = []

  rows.push(numericRow({
    key: 'distance', title: '距离',
    values: pick((r) => r.distance),
    polarity: 'neutral', showsDelta, deadband: DEADBAND.distanceMeters,
    format: (v) => `${(v / 1000).toFixed(2)} km`,
    formatDelta: (d) => signed(`${(Math.abs(d) / 1000).toFixed(2)} km`, d > 0),
  }))

  rows.push(numericRow({
    key: 'duration', title: '时长',
    values: pick((r) => r.duration),
    polarity: 'neutral', showsDelta, deadband: DEADBAND.durationSeconds,
    format: formatDuration,
    formatDelta: (d) => signed(formatDuration(Math.abs(d)), d > 0),
  }))

  rows.push(paceRow(routes, isCrossType))

  rows.push(numericRow({
    key: 'avgHeartRate', title: '均心率',
    values: pick((r) => r.avgHeartRate),
    polarity: 'lowerIsBetter', showsDelta, deadband: DEADBAND.heartRateBpm,
    format: (v) => `${Math.round(v)} bpm`,
    formatDelta: (d) => signed(`${Math.round(Math.abs(d))} bpm`, d > 0),
  }))

  rows.push(numericRow({
    key: 'ascent', title: '爬升',
    values: pick((r) => r.totalAscent),
    polarity: 'neutral', showsDelta, deadband: DEADBAND.ascentMeters,
    format: (v) => `${Math.round(v)} m`,
    formatDelta: (d) => signed(`${Math.round(Math.abs(d))} m`, d > 0),
  }))

  rows.push(numericRow({
    key: 'maxHeartRate', title: '最高心率',
    values: pick((r) => r.maxHeartRate),
    polarity: 'lowerIsBetter', showsDelta, deadband: DEADBAND.heartRateBpm,
    format: (v) => `${Math.round(v)} bpm`,
    formatDelta: (d) => signed(`${Math.round(Math.abs(d))} bpm`, d > 0),
  }))

  return rows
}

// 配速行：骑行显示 km/h、其余显示 配速（架构方案 §9 裁定 #2）。
// 混合类型时该行列值按各自单位显示、差值显示 —（单位不同的两个数相减无意义）。
function paceRow(routes, isCrossType) {
  const allUsePace = routes.every(usesPace)
  const allUseSpeed = routes.every((r) => !usesPace(r))

  let title
  if (allUsePace) title = '配速'
  else if (allUseSpeed) title = '速度'
  else title = '配速/速度'

  const texts = routes.map((route) => {
    const pace = route.avgPace
    if (!(pace > 0) || !Number.isFinite(pace)) return '—'
    return usesPace(route) ? formatPaceSeconds(pace) : formatSpeedKmh(pace)
  })

  const baseline = routes[routes.length - 1]
  const baselinePace = baseline ? baseline.avgPace : null
  if (!(isCrossType === false && baselinePace > 0 && Number.isFinite(baselinePace))) {
    const cells = texts.map((t) => ({ text: t, deltaText: null, direction: 'none' }))
    return { key: 'pace', title, cells, showsDelta: false }
  }

  const cells = routes.map((route, index) => {
    if (index === routes.length - 1) {
      return { text: texts[index], deltaText: null, direction: 'none' }
    }
    const pace = route.avgPace
    if (!(pace > 0) || !Number.isFinite(pace)) {
      return { text: texts[index], deltaText: null, direction: 'none' }
    }
    if (allUsePace) {
      const delta = pace - baselinePace
      return {
        text: texts[index],
        deltaText: signed(`${Math.round(Math.abs(delta))} 秒`, delta > 0),
        direction: directionOf(delta, 'lowerIsBetter', DEADBAND.paceSeconds),
      }
    }
    const speed = 3600 / pace
    const baselineSpeed = 3600 / baselinePace
    const speedDelta = speed - baselineSpeed
    return {
      text: texts[index],
      deltaText: signed(`${Math.abs(speedDelta).toFixed(1)} km/h`, speedDelta > 0),
      direction: directionOf(speedDelta, 'higherIsBetter', DEADBAND.speedKmh),
    }
  })
  return { key: 'pace', title, cells, showsDelta: true }
}

// ── 天气行（有数据才出现；跨类型照常显示）──────────────

function weatherRows(routes, weather) {
  const rows = []

  const temperatures = routes.map((r) => (weather[r.id] ? weather[r.id].temperature : null))
  if (temperatures.some((t) => t != null)) {
    rows.push(numericRow({
      key: 'temperature', title: '温度',
      values: temperatures, polarity: 'neutral', showsDelta: true, deadband: DEADBAND.temperatureCelsius,
      format: (v) => `${Math.round(v)}°C`,
      formatDelta: (d) => signed(`${Math.round(Math.abs(d))}°C`, d > 0),
    }))
  }

  const humidities = routes.map((r) => (weather[r.id] ? weather[r.id].humidity : null))
  if (humidities.some((h) => h != null)) {
    rows.push(numericRow({
      key: 'humidity', title: '湿度',
      values: humidities, polarity: 'neutral', showsDelta: true, deadband: DEADBAND.humidityPercent,
      format: (v) => `${Math.round(v)}%`,
      formatDelta: (d) => signed(`${Math.round(Math.abs(d))}%`, d > 0),
    }))
  }

  const conditions = routes.map((r) => (weather[r.id] ? weather[r.id].condition : null))
  if (conditions.some((c) => c != null)) {
    const baseline = conditions[conditions.length - 1]
    const cells = conditions.map((condition, index) => {
      const text = conditionLabel(condition)
      if (index === conditions.length - 1 || condition == null || baseline == null) {
        return { text, deltaText: null, direction: 'none' }
      }
      const same = condition === baseline
      return { text, deltaText: same ? '相同' : '不同', direction: 'flat' }
    })
    rows.push({ key: 'condition', title: '天气', cells, showsDelta: true })
  }

  return rows
}

// ── 归因（F30，禁因果句式）─────────────────────────

// 同期环境差异线索：温度 / 湿度 / 天气现象 / 爬升（均为并列陈述，无因果连接词）。
function envText(subject, baseline, weather) {
  const parts = []
  const sw = weather[subject.id]
  const bw = weather[baseline.id]

  if (sw && bw && sw.temperature != null && bw.temperature != null) {
    const d = sw.temperature - bw.temperature
    if (Math.abs(d) >= THRESHOLDS.temperatureCelsius) {
      parts.push(`当日温度${d > 0 ? '高' : '低'} ${Math.round(Math.abs(d))}°C`)
    }
  }
  if (sw && bw && sw.humidity != null && bw.humidity != null) {
    const d = sw.humidity - bw.humidity
    if (Math.abs(d) >= THRESHOLDS.humidityPercent) {
      parts.push(`湿度${d > 0 ? '高' : '低'} ${Math.round(Math.abs(d))}%`)
    }
  }
  if (sw && bw && sw.condition != null && bw.condition != null && sw.condition !== bw.condition) {
    parts.push(`天气 ${conditionLabel(sw.condition)} / ${conditionLabel(bw.condition)}`)
  }
  const ascentDelta = (subject.totalAscent || 0) - (baseline.totalAscent || 0)
  if (Math.abs(ascentDelta) >= THRESHOLDS.ascentMeters) {
    parts.push(`爬升${ascentDelta > 0 ? '多' : '少'} ${Math.round(Math.abs(ascentDelta))} m`)
  }

  return parts.length ? parts.join(' · ') : null
}

// 归因条目生成：阈值触发（配速/均心率运动内；温度/湿度/天气/爬升作环境线索）。
// 文案约束（硬性）：只并列差异，禁止因果句式（不出现「因为/导致/因此/所以/使得/造成/由于」）。
// 跨运动类型时不产出运动内指标归因，只保留环境差异并列。
export function buildAttributions(routes, weather) {
  if (routes.length < 2) return []
  const baseline = routes[routes.length - 1]
  const isCrossType = new Set(routes.map((r) => r.activityType)).size > 1
  const needsLabel = routes.length > 2
  const result = []

  for (const subject of routes.slice(0, -1)) {
    const prefix = needsLabel ? `${columnLabel(subject)} ` : ''
    const env = envText(subject, baseline, weather)
    let produced = false

    if (!isCrossType) {
      const pace = subject.avgPace
      const basePace = baseline.avgPace
      if (pace > 0 && basePace > 0 && Number.isFinite(pace) && Number.isFinite(basePace)) {
        const delta = pace - basePace
        const relative = Math.abs(delta) / basePace
        if (Math.abs(delta) >= THRESHOLDS.paceSeconds || relative >= THRESHOLDS.paceRelative) {
          const text = usesPace(subject)
            ? `${prefix}配速${delta > 0 ? '慢' : '快'} ${Math.round(Math.abs(delta))} 秒/km`
            : `${prefix}速度${delta > 0 ? '高' : '低'} ${Math.abs(3600 / pace - 3600 / basePace).toFixed(1)} km/h`
          result.push({ indicatorKey: 'pace', deltaText: text, envText: env })
          produced = true
        }
      }
      const hr = subject.avgHeartRate
      const baseHR = baseline.avgHeartRate
      if (hr != null && baseHR != null) {
        const delta = hr - baseHR
        if (Math.abs(delta) >= THRESHOLDS.heartRateBpm) {
          const text = `${prefix}均心率${delta > 0 ? '高' : '低'} ${Math.round(Math.abs(delta))} bpm`
          result.push({ indicatorKey: 'avgHeartRate', deltaText: text, envText: env })
          produced = true
        }
      }
    }

    // 运动内指标未触发但环境有差异时，仍并列一条环境差异（跨类型场景的主要出口）
    if (!produced && env) {
      result.push({ indicatorKey: 'weather', deltaText: prefix ? prefix + env : env, envText: null })
    }
  }

  return result
}

// ── 归一化配速序列（T3.3）─────────────────────────

// 把一条记录的配速序列压成里程 0–100% 的归一化点集。
// X 用 SeriesPoint.distance（已算好的累计距离），总里程取序列末点与 summary.distance 较大者。
function downsample(points, maxPoints) {
  if (maxPoints <= 1 || points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  const result = []
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.min(Math.round(i * step), points.length - 1)
    result.push(points[index])
  }
  return result
}

export function normalizedPace(paceSamples, summary, maxPoints = 200) {
  if (!paceSamples || paceSamples.length < 2) return []
  const distances = paceSamples.map((p) => p[1])
  const seriesEnd = Math.max(...distances)
  const total = Math.max(seriesEnd, summary.distance || 0)
  if (total <= 0) return []

  const label = columnLabel(summary)
  const sampled = downsample(paceSamples, maxPoints)
  return sampled
    .filter((p) => Number.isFinite(p[2]) && p[2] > 0)
    .map((p) => {
      const progress = Math.max(0, Math.min(1, p[1] / total)) * 100
      return { routeId: summary.id, label, progress, value: p[2] }
    })
}

// ── 主入口 ────────────────────────────────────────

// 组装对比表：routes 应按 order() 排好序（≤3 条，最新在最左，末列为基准）；
// weather 为 workoutId → WorkoutWeather（缺失即视为无天气，整行/整区隐藏）。
export function build(routes, weather) {
  if (!routes || routes.length < 2) {
    return { rows: [], weatherRows: [], attributions: [] }
  }
  const isCrossType = new Set(routes.map((r) => r.activityType)).size > 1
  return {
    rows: metricRows(routes, isCrossType),
    weatherRows: weatherRows(routes, weather),
    attributions: buildAttributions(routes, weather),
  }
}
