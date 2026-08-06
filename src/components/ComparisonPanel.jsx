import { useMemo, useState, useEffect } from 'react'
import { X } from 'lucide-react'
import {
  build,
  order,
  normalizedPace,
  columnLabel,
  usesPace,
} from '../comparison'
import { buildLineGeometry } from '../metrics'
import { apiRouteRepository } from '../routeRepository'
import ActivityIcon from './ActivityIcon'

const CHART_WIDTH = 1000
const CHART_HEIGHT = 200
// 配色对齐 iOS ComparisonChartView.palette：teal / orange / purple
const PALETTE = ['#2fd4d4', '#ff9f43', '#b18cff']
const DELTA_COLORS = {
  better: '#37d5dc',
  worse: '#ff9f43',
  flat: '#8e9b9f',
  none: '#8e9b9f',
}

const ACTIVITY_TYPE_TO_CATEGORY = {
  running: 'run',
  cycling: 'ride',
  walking: 'walk',
  hiking: 'hike',
  wheelchairRun: 'other',
  wheelchairWalk: 'other',
}
const categoryOf = (summary) => ACTIVITY_TYPE_TO_CATEGORY[summary.activityType] || 'other'

// Web 路由对象 → iOS 字段口径的 summary（comparison.js 只认 iOS 字段名，便于与 iOS 逐项对齐）
function toSummary(route) {
  return {
    id: route.id,
    activityType: route.activityType,
    startDate: route.startDate,
    distance: (route.distanceKm || 0) * 1000,
    duration: (route.durationMin || 0) * 60,
    avgPace: route.avgPace ?? null,
    avgHeartRate: route.avgHeartRate ?? null,
    maxHeartRate: route.maxHeartRate ?? null,
    totalAscent: route.ascentM ?? 0,
  }
}

/**
 * 指标对比面板（F09'/F29/F30 的 Web 侧，架构 §7 T3.4）。
 * 视觉对齐 iOS ComparisonView：指标卡 / 天气卡 / 归因卡（固定小字「仅展示同期差异，不代表因果」）/ 归一化配速曲线卡。
 * 无横向滚动（差值挂在数值下方小字）；**不含地图叠加**（依赖 T3.4 /api/tracks，尚未落地）。
 */
export default function ComparisonPanel({ routes, onClose }) {
  const [loading, setLoading] = useState(true)
  const [weather, setWeather] = useState({})
  const [pacePoints, setPacePoints] = useState([])

  const orderedRoutes = useMemo(() => order(routes.map(toSummary)), [routes])
  const columnLabels = useMemo(() => orderedRoutes.map(columnLabel), [orderedRoutes])
  const baselineIndex = orderedRoutes.length - 1
  const isCrossType = useMemo(
    () => new Set(orderedRoutes.map((r) => r.activityType)).size > 1,
    [orderedRoutes],
  )
  const table = useMemo(() => build(orderedRoutes, weather), [orderedRoutes, weather])
  const hasWeather = table.weatherRows.length > 0
  const hasAttributions = table.attributions.length > 0
  const displayMode = useMemo(() => {
    if (orderedRoutes.every(usesPace)) return 'pace'
    if (orderedRoutes.every((r) => !usesPace(r))) return 'speed'
    return 'mixed'
  }, [orderedRoutes])

  // 按需拉取：天气（/api/weather）+ 各记录配速序列（/api/metrics/:id）。失败静默降级，不阻塞 UI。
  useEffect(() => {
    let active = true
    setLoading(true)
    const ids = orderedRoutes.map((r) => r.id)
    Promise.all([
      apiRouteRepository.getWeather(ids),
      Promise.all(
        orderedRoutes.map((r) =>
          apiRouteRepository.getRouteMetrics(r).then((m) => (m && m.pace) || []).catch(() => [])),
      ),
    ]).then(([w, paceResults]) => {
      if (!active) return
      const points = orderedRoutes.flatMap((r, i) => normalizedPace(paceResults[i], r))
      setWeather(w || {})
      setPacePoints(points)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setWeather({})
      setPacePoints([])
      setLoading(false)
    })
    return () => { active = false }
  }, [orderedRoutes])

  // 归一化配速曲线：按里程进度分线（X 0–100%，Y 配速/速度），复用 buildLineGeometry。
  const lineGeometries = useMemo(() => {
    const byLabel = {}
    pacePoints.forEach((p) => {
      const value = displayMode === 'speed' ? 3600 / p.value : p.value
      ;(byLabel[p.label] = byLabel[p.label] || []).push([p.progress, value])
    })
    return columnLabels
      .map((label, idx) => ({
        label,
        color: PALETTE[idx % PALETTE.length],
        geom: buildLineGeometry(byLabel[label] || [], 0, 1, 100, CHART_WIDTH, CHART_HEIGHT),
      }))
      .filter((s) => s.geom)
  }, [pacePoints, columnLabels, displayMode])

  const cols = orderedRoutes.length
  const headRowStyle = { '--cols': cols }

  return (
    <section className="comparison-panel" aria-label="指标对比面板">
      <header className="comparison-header">
        <strong>指标对比</strong>
        <button type="button" onClick={onClose} aria-label="关闭对比面板"><X size={18} /></button>
      </header>

      {loading && <p className="comparison-loading">正在载入对比数据…</p>}

      {/* 运动内指标卡 */}
      <div className="comparison-card">
        <div className="comparison-row comparison-head" style={headRowStyle}>
          <span className="comparison-label" />
          {orderedRoutes.map((r, i) => (
            <div className="comparison-col-head" key={r.id}>
              <ActivityIcon category={categoryOf(r)} />
              <span>{columnLabels[i]}</span>
              <span className="comparison-baseline">{i === baselineIndex ? '基准' : ' '}</span>
            </div>
          ))}
        </div>
        {table.rows.map((row) => (
          <div className="comparison-row" style={headRowStyle} key={row.key}>
            <span className="comparison-label">{row.title}</span>
            {row.cells.map((cell, ci) => (
              <div className="comparison-cell" key={ci}>
                <span className="comparison-value">{cell.text}</span>
                {row.showsDelta && cell.deltaText
                  ? (
                    <span
                      className="comparison-delta"
                      style={{ color: DELTA_COLORS[cell.direction] }}
                    >
                      {cell.deltaText}
                    </span>
                  )
                  : <span className="comparison-delta"> </span>}
              </div>
            ))}
          </div>
        ))}
        {isCrossType && (
          <p className="comparison-note">跨运动类型对比：运动内差值已隐藏，天气差异照常展示</p>
        )}
      </div>

      {/* 天气卡（有数据才出现） */}
      {hasWeather && (
        <div className="comparison-card">
          <h3 className="comparison-card-title">天气</h3>
          {table.weatherRows.map((row) => (
            <div className="comparison-row" style={headRowStyle} key={row.key}>
              <span className="comparison-label">{row.title}</span>
              {row.cells.map((cell, ci) => (
                <div className="comparison-cell" key={ci}>
                  <span className="comparison-value">{cell.text}</span>
                  {row.showsDelta && cell.deltaText
                    ? (
                      <span
                        className="comparison-delta"
                        style={{ color: DELTA_COLORS[cell.direction] }}
                      >
                        {cell.deltaText}
                      </span>
                    )
                    : <span className="comparison-delta"> </span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 归因卡（禁因果句式；固定小字） */}
      {hasAttributions && (
        <div className="comparison-card">
          <h3 className="comparison-card-title">效能归因（仅并列差异）</h3>
          {table.attributions.map((item, i) => (
            <div className="comparison-attr" key={i}>
              <p>{item.deltaText}</p>
              {item.envText && <p className="comparison-attr-env">{item.envText}</p>}
            </div>
          ))}
          <p className="comparison-caveat">仅展示同期差异，不代表因果</p>
        </div>
      )}

      {/* 归一化配速曲线卡 */}
      <div className="comparison-card">
        <h3 className="comparison-card-title">配速曲线（按里程 0–100%）</h3>
        <p className="comparison-card-sub">效能变化过程证据：同一段路这次快了还是慢了</p>
        {lineGeometries.length ? (
          <>
            <div className="comparison-chart">
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
                <line className="metric-gridline" x1="8" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH - 8} y2={CHART_HEIGHT / 2} />
                {[0, 25, 50, 75, 100].map((p) => {
                  const x = 8 + (p / 100) * (CHART_WIDTH - 16)
                  return <line key={p} className="metric-gridline" x1={x} y1="8" x2={x} y2={CHART_HEIGHT - 8} />
                })}
                {lineGeometries.map((s) => (
                  <path key={s.label} className="metric-line" d={s.geom.path} style={{ '--metric-color': s.color }} />
                ))}
              </svg>
            </div>
            <div className="comparison-legend">
              {lineGeometries.map((s) => (
                <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
              ))}
            </div>
          </>
        ) : (
          <p className="comparison-empty">所选记录暂无配速序列，无法绘制对比曲线</p>
        )}
        {displayMode === 'mixed' && (
          <p className="comparison-card-sub">混合运动类型：统一按 秒/km 展示</p>
        )}
      </div>
    </section>
  )
}
