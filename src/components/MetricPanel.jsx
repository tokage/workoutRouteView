import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  buildLineGeometry,
  formatElapsedSeconds,
  nearestSampleByElapsed,
} from '../metrics'
import { formatSplitPace } from '../splits'
import SplitsTable from './SplitsTable'

const CHART_WIDTH = 1000
const CHART_HEIGHT = 128
const EMPTY_SAMPLES = []
const HEART_RATE_COLOR = '#ff6b6b'
const ELEVATION_COLOR = '#d2f05a'
const PACE_COLOR = '#ffb020'

function displayValue(value, digits = 0) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'
}

function CombinedMetricChart({
  heartRate,
  elevation,
  durationSec,
  elapsedSec,
  onElapsedSec,
}) {
  const { t } = useTranslation()
  const heartRateSamples = heartRate?.samples || EMPTY_SAMPLES
  const elevationSamples = elevation?.samples || EMPTY_SAMPLES
  const heartRateGeometry = useMemo(
    () => buildLineGeometry(
      heartRateSamples,
      0,
      1,
      durationSec,
      CHART_WIDTH,
      CHART_HEIGHT,
    ),
    [heartRateSamples, durationSec],
  )
  const elevationGeometry = useMemo(
    () => buildLineGeometry(
      elevationSamples,
      1,
      2,
      durationSec,
      CHART_WIDTH,
      CHART_HEIGHT,
    ),
    [elevationSamples, durationSec],
  )
  const heartRateCurrent = nearestSampleByElapsed(heartRateSamples, 0, elapsedSec)
  const elevationCurrent = nearestSampleByElapsed(elevationSamples, 1, elapsedSec)
  const sharedGeometry = heartRateGeometry || elevationGeometry
  const heartRateSummary = [
    Number.isFinite(heartRate?.averageBpm)
      ? t('metricPanel.avg', { value: displayValue(heartRate.averageBpm) })
      : null,
    Number.isFinite(heartRate?.minimumBpm) && Number.isFinite(heartRate?.maximumBpm)
      ? `${displayValue(heartRate.minimumBpm)}–${displayValue(heartRate.maximumBpm)} bpm`
      : null,
  ].filter(Boolean).join(' · ')
  const elevationSummary = [
    Number.isFinite(elevation?.minimumM) && Number.isFinite(elevation?.maximumM)
      ? `${displayValue(elevation.minimumM)}–${displayValue(elevation.maximumM)} m`
      : null,
    Number.isFinite(elevation?.ascentM)
      ? `↑ ${displayValue(elevation.ascentM, 2)} m`
      : null,
    Number.isFinite(elevation?.descentM)
      ? `↓ ${displayValue(elevation.descentM, 2)} m`
      : null,
  ].filter(Boolean).join(' · ')
  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onElapsedSec(Math.round(ratio * durationSec))
  }
  const moveByKeyboard = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const step = Math.max(1, Math.round(durationSec / 100))
    onElapsedSec(Math.max(0, Math.min(durationSec, elapsedSec + (event.key === 'ArrowRight' ? step : -step))))
  }

  return (
    <section className="metric-chart">
      <div className="metric-chart-heading">
        <strong>{t('metricPanel.title')}</strong>
        <span>{t('metricPanel.sharedTimeline')}</span>
      </div>
      <div className="metric-series-legend" aria-label={t('metricPanel.legendAria')}>
        <div>
          <i className="metric-series-swatch" style={{ '--metric-color': HEART_RATE_COLOR }} />
          <strong>{t('metricPanel.heartRate')}</strong>
          <span>{heartRateGeometry ? heartRateSummary : t('metricPanel.noData')}</span>
        </div>
        <div>
          <i className="metric-series-swatch elevation" style={{ '--metric-color': ELEVATION_COLOR }} />
          <strong>{t('metricPanel.elevation')}</strong>
          <span>{elevationGeometry ? elevationSummary : t('metricPanel.noData')}</span>
        </div>
      </div>
      {sharedGeometry ? (
        <div
          className="metric-chart-interaction"
          role="slider"
          tabIndex="0"
          aria-label={t('metricPanel.timelineAria')}
          aria-valuemin="0"
          aria-valuemax={Math.round(durationSec)}
          aria-valuenow={Math.round(elapsedSec)}
          aria-valuetext={formatElapsedSeconds(elapsedSec)}
          onPointerDown={updateFromPointer}
          onPointerMove={updateFromPointer}
          onKeyDown={moveByKeyboard}
        >
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <line className="metric-gridline" x1="8" y1="64" x2="992" y2="64" />
            {heartRateGeometry && (
              <path
                className="metric-line"
                d={heartRateGeometry.path}
                style={{ '--metric-color': HEART_RATE_COLOR }}
              />
            )}
            {elevationGeometry && (
              <path
                className="metric-line elevation"
                d={elevationGeometry.path}
                style={{ '--metric-color': ELEVATION_COLOR }}
              />
            )}
            <line
              className="metric-cursor"
              x1={sharedGeometry.x(elapsedSec)}
              x2={sharedGeometry.x(elapsedSec)}
              y1="4"
              y2="124"
            />
            {heartRateCurrent && heartRateGeometry && (
              <circle
                className="metric-focus-dot"
                cx={heartRateGeometry.x(heartRateCurrent[0])}
                cy={heartRateGeometry.y(heartRateCurrent[1])}
                r="7"
                style={{ '--metric-color': HEART_RATE_COLOR }}
              />
            )}
            {elevationCurrent && elevationGeometry && (
              <circle
                className="metric-focus-dot"
                cx={elevationGeometry.x(elevationCurrent[1])}
                cy={elevationGeometry.y(elevationCurrent[2])}
                r="7"
                style={{ '--metric-color': ELEVATION_COLOR }}
              />
            )}
          </svg>
        </div>
      ) : (
        <div className="metric-empty">{t('metricPanel.noHrElevationSamples')}</div>
      )}
    </section>
  )
}

/**
 * 配速曲线（F06 Web）：X 轴统一为里程 distance（与 iOS SeriesChartView 同口径）。
 * - pace 样本来自 transformMetrics 透出的 [timeOffset, distance, value]，value 恒为 秒/km
 * - 骑行显示 km/h（formatSplitPace 转换），其余显示 秒/km
 * - 复用 buildLineGeometry（elapsedIndex=1 即 distance，域=总里程），虚线为本次均配速参考
 * - 游标按里程 hover，仅本地读数，不联动地图（Web 四维联动已由时间轴曲线承担）
 */
function PaceChart({ paceSamples, avgPace, isCycling, totalDistanceM }) {
  const { t } = useTranslation()
  const [hoverDistance, setHoverDistance] = useState(null)
  const geometry = useMemo(
    () => buildLineGeometry(paceSamples, 1, 2, totalDistanceM, CHART_WIDTH, CHART_HEIGHT),
    [paceSamples, totalDistanceM],
  )
  const current = hoverDistance != null && geometry
    ? nearestSampleByElapsed(paceSamples, 1, hoverDistance)
    : null
  const hasReference = Number.isFinite(avgPace) && avgPace > 0
  const updateFromPointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    setHoverDistance(ratio * totalDistanceM)
  }

  return (
    <section className="metric-chart">
      <div className="metric-chart-heading">
        <strong>{t('metricPanel.pace')}</strong>
        <span>
          {isCycling ? t('metricPanel.kmh') : t('metricPanel.secPerKm')}
          {hasReference ? ` · ${t('metricPanel.avg', { value: formatSplitPace(avgPace, isCycling) })}` : ''}
        </span>
      </div>
      {geometry ? (
        <div
          className="metric-chart-interaction"
          role="slider"
          tabIndex="0"
          aria-label={t('metricPanel.paceAria')}
          aria-valuemin="0"
          aria-valuemax={Math.round(totalDistanceM)}
          aria-valuenow={hoverDistance != null ? Math.round(hoverDistance) : 0}
          aria-valuetext={current ? formatElapsedSeconds(current[0]) : ''}
          onPointerDown={updateFromPointer}
          onPointerMove={updateFromPointer}
        >
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <line className="metric-gridline" x1="8" y1="64" x2="992" y2="64" />
            {hasReference && (
              <line
                className="metric-gridline"
                x1="8"
                x2="992"
                y1={geometry.y(avgPace)}
                y2={geometry.y(avgPace)}
              />
            )}
            <path
              className="metric-line"
              d={geometry.path}
              style={{ '--metric-color': PACE_COLOR }}
            />
            {current && (
              <>
                <line
                  className="metric-cursor"
                  x1={geometry.x(current[1])}
                  x2={geometry.x(current[1])}
                  y1="4"
                  y2="124"
                />
                <circle
                  className="metric-focus-dot"
                  cx={geometry.x(current[1])}
                  cy={geometry.y(current[2])}
                  r="7"
                  style={{ '--metric-color': PACE_COLOR }}
                />
              </>
            )}
          </svg>
        </div>
      ) : (
        <div className="metric-empty">{t('metricPanel.noPaceData')}</div>
      )}
      <div className="pace-readout" aria-live="polite">
        {current ? (
          <>
            <span>{formatElapsedSeconds(current[0])}</span>
            <span>{displayValue(current[1] / 1000, 2)} km</span>
            <strong>
              {formatSplitPace(current[2], isCycling)}
              <small>{isCycling ? ' km/h' : ' /km'}</small>
            </strong>
          </>
        ) : (
          <span>{t('metricPanel.dragHint')}</span>
        )}
      </div>
    </section>
  )
}

export default function MetricPanel({
  route,
  metrics,
  status,
  elapsedSec,
  onElapsedSec,
  onClose,
}) {
  const { t } = useTranslation()
  const heartRateSamples = metrics?.heartRate?.samples || EMPTY_SAMPLES
  const elevationSamples = metrics?.elevation?.samples || EMPTY_SAMPLES
  const paceSamples = metrics?.pace || EMPTY_SAMPLES
  const isCycling = route?.category === 'ride'
  const durationSec = Math.max(
    1,
    Math.round((route?.durationMin || 0) * 60),
    heartRateSamples[heartRateSamples.length - 1]?.[0] || 0,
    elevationSamples[elevationSamples.length - 1]?.[1] || 0,
  )
  // 配速曲线 X 域：总里程（米），取 route.distanceKm 与 pace 序列末点较大者，兜底 ≥1
  const totalDistanceM = Math.max(
    1,
    (route?.distanceKm || 0) * 1000,
    paceSamples[paceSamples.length - 1]?.[1] || 0,
  )
  const heartRateSample = nearestSampleByElapsed(metrics?.heartRate?.samples, 0, elapsedSec)
  const elevationSample = nearestSampleByElapsed(metrics?.elevation?.samples, 1, elapsedSec)

  return (
    <section className="metric-panel" aria-label={t('metricPanel.panelAria')}>
      <header className="metric-panel-header">
        <div>
          <strong>{t('metricPanel.header')}</strong>
        </div>
        <button onClick={onClose} aria-label={t('metricPanel.closeAria')}><X size={18} /></button>
      </header>

      {status === 'loading' && <p className="metric-status">{t('metricPanel.loading')}</p>}
      {status === 'error' && <p className="metric-status error">{t('metricPanel.loadFailed')}</p>}
      {status === 'ready' && metrics && (
        <>
          <div className="metric-current" aria-live="polite">
            <div><span>{t('metricPanel.elapsed')}</span><strong>{formatElapsedSeconds(elapsedSec)}</strong></div>
            <div><span>{t('metricPanel.distance')}</span><strong>{displayValue(elevationSample?.[0] / 1000, 2)} <small>km</small></strong></div>
            <div className="metric-current-colored" style={{ '--metric-color': HEART_RATE_COLOR }}>
              <span>{t('metricPanel.heartRate')}</span><strong>{displayValue(heartRateSample?.[1])} <small>bpm</small></strong>
            </div>
            <div className="metric-current-colored" style={{ '--metric-color': ELEVATION_COLOR }}>
              <span>{t('metricPanel.elevation')}</span><strong>{displayValue(elevationSample?.[2], 1)} <small>m</small></strong>
            </div>
          </div>
          <CombinedMetricChart
            heartRate={metrics.heartRate}
            elevation={metrics.elevation}
            durationSec={durationSec}
            elapsedSec={elapsedSec}
            onElapsedSec={onElapsedSec}
          />
          <PaceChart
            paceSamples={paceSamples}
            avgPace={route?.avgPace}
            isCycling={isCycling}
            totalDistanceM={totalDistanceM}
          />
          <SplitsTable
            splits={metrics.splits}
            avgPace={route?.avgPace}
            isCycling={isCycling}
          />
        </>
      )}
      {status === 'ready' && !metrics && <p className="metric-status">{t('metricPanel.noMetrics')}</p>}
    </section>
  )
}
