import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { ACTIVITY, ACTIVITY_ORDER } from '../constants'
import { formatDuration, formatPaceSeconds, formatSpeedKmh } from '../format'
import { apiRouteRepository } from '../routeRepository'
import {
  CATEGORY_TO_ACTIVITY_TYPE,
  CHART,
  GRANULARITIES,
  buildBars,
  buildDeltas,
  buildLineSegments,
  comparisonLabel,
  formatDeltaText,
  deltaDirection,
  isEmptySummary,
  periodTitle,
  pickChartBuckets,
  pickPeriods,
  shortLabel,
  toPath,
  usesPace,
} from '../trend'

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
  none: Minus,
}

/** 柱状图 / 折线图共用的坐标轴标签（每隔 step 个画一个，避免挤成一团） */
function AxisLabels({ buckets, granularity }) {
  const { t } = useTranslation()
  const { width, padX, height } = CHART
  if (!buckets.length) return null
  const slot = (width - padX * 2) / buckets.length
  const step = buckets.length > 8 ? 2 : 1
  return (
    <>
      {buckets.map((bucket, index) => {
        if (index % step !== 0 && index !== buckets.length - 1) return null
        return (
          <text
            key={bucket.key}
            className="trend-axis-label"
            x={padX + slot * (index + 0.5)}
            y={height - 8}
            textAnchor="middle"
          >
            {shortLabel(bucket.key, granularity, t)}
          </text>
        )
      })}
    </>
  )
}

/**
 * 趋势视图（T4.6）——信息结构对齐 iOS `TrendView.swift`。
 *
 * 数据全部来自 `/api/summary`，本组件**不做聚合**（见 `src/trend.js` 顶部说明）。
 */
export default function TrendView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'
  const [granularity, setGranularity] = useState('month')
  const [category, setCategory] = useState('all')
  const [state, setState] = useState({ status: 'loading', summary: null, error: '' })

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))
    apiRouteRepository
      .getSummary({ granularity, activityType: CATEGORY_TO_ACTIVITY_TYPE[category] })
      .then((summary) => {
        if (active) setState({ status: 'ready', summary, error: '' })
      })
      .catch((reason) => {
        if (active) setState({ status: 'error', summary: null, error: reason.message })
      })
    return () => {
      active = false
    }
  }, [granularity, category])

  const buckets = state.summary?.buckets || []
  const { current, previous } = useMemo(() => pickPeriods(buckets), [buckets])
  const deltas = useMemo(() => buildDeltas(current, previous, t), [current, previous, t])
  const chartBuckets = useMemo(() => pickChartBuckets(buckets, granularity), [buckets, granularity])

  const showPace = usesPace(category)
  const { bars, max: maxDistance } = useMemo(
    () => buildBars(chartBuckets, (bucket) => bucket.distance),
    [chartBuckets],
  )
  // 骑行按 km/h 画（数值越大越好），其余按 秒/km。换算放在取值函数里，
  // 折线的断点逻辑由 buildLineSegments 统一处理——null 配速不会被当 0。
  const line = useMemo(
    () => buildLineSegments(chartBuckets, (bucket) => {
      const pace = Number(bucket.avgPace)
      if (!Number.isFinite(pace) || pace <= 0) return null
      return showPace ? pace : 3600 / pace
    }),
    [chartBuckets, showPace],
  )

  const activityColor = ACTIVITY[category].color
  const empty = isEmptySummary(buckets)
  const granularityLabelKey = GRANULARITIES.find((item) => item.key === granularity)?.labelKey || 'trend.granularityMonth'

  return (
    <section className="trend-view" style={{ '--activity-color': activityColor }}>
      <header className="trend-toolbar">
        <div className="activity-tabs trend-granularity" aria-label={t('trend.granularityAria')}>
          {GRANULARITIES.map(({ key, labelKey }) => (
            <button
              key={key}
              type="button"
              className={granularity === key ? 'active' : ''}
              aria-pressed={granularity === key}
              onClick={() => setGranularity(key)}
              style={{ '--activity-color': activityColor }}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <div className="activity-tabs" aria-label={t('sidebar.activityFilterAria')}>
          {ACTIVITY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={category === key ? 'active' : ''}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
              style={{ '--activity-color': ACTIVITY[key].color }}
            >
              {t(ACTIVITY[key].labelKey)}
            </button>
          ))}
        </div>
      </header>

      {state.status === 'loading' && <p className="trend-empty">{t('trend.loading')}</p>}
      {state.status === 'error' && (
        <p className="trend-empty">
          {state.error === 'SUMMARY_LOAD_FAILED' ? t('errors.summaryLoadFailed') : state.error}
        </p>
      )}

      {state.status === 'ready' && empty && (
        <p className="trend-empty">
          {t('trend.noDataTitle')}
          <br />
          {t('trend.noDataHint')}
        </p>
      )}

      {state.status === 'ready' && !empty && current && (
        <>
          <div className="comparison-card trend-card">
            <p className="comparison-card-title">{periodTitle(current.key, granularity, t, lang)}</p>
            <div className="trend-grid">
              <div className="trend-metric">
                <span className="trend-metric-label">{t('trend.totalDistance')}</span>
                <strong>{(current.distance / 1000).toFixed(1)}<small>km</small></strong>
              </div>
              <div className="trend-metric">
                <span className="trend-metric-label">{t('trend.totalDuration')}</span>
                <strong>{formatDuration(current.duration / 60)}</strong>
              </div>
              <div className="trend-metric">
                <span className="trend-metric-label">{t('trend.totalCount')}</span>
                <strong>{current.count}<small>{t('units.count')}</small></strong>
              </div>
              <div className="trend-metric">
                <span className="trend-metric-label">{t('trend.totalAscent')}</span>
                <strong>{Math.round(current.ascent)}<small>m</small></strong>
              </div>
            </div>
            <div className="trend-delta-row">
              <span className="comparison-label">{comparisonLabel(granularity, t)}</span>
              {deltas.map(({ title, percent }) => {
                const direction = deltaDirection(percent)
                const Icon = DIRECTION_ICON[direction]
                return (
                  <span key={title} className={`trend-delta trend-delta-${direction}`}>
                    <Icon size={12} aria-hidden="true" />
                    {title} {formatDeltaText(percent, t)}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="comparison-card trend-card">
            <p className="comparison-card-title">{t('trend.distanceTrend')}</p>
            <div className="trend-chart">
              <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
                <line
                  className="metric-gridline"
                  x1={CHART.padX}
                  y1={CHART.height - CHART.padBottom}
                  x2={CHART.width - CHART.padX}
                  y2={CHART.height - CHART.padBottom}
                />
                {bars.map((bar, index) => (
                  <rect
                    key={bar.key}
                    className={index === bars.length - 1 ? 'trend-bar trend-bar-current' : 'trend-bar'}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                  >
                    <title>{`${periodTitle(bar.key, granularity, t, lang)} · ${(bar.value / 1000).toFixed(1)} km`}</title>
                  </rect>
                ))}
                <AxisLabels buckets={chartBuckets} granularity={granularity} />
              </svg>
            </div>
            <p className="comparison-card-sub">{t('trend.peakDistance', { value: (maxDistance / 1000).toFixed(1) })}</p>
          </div>

          <div className="comparison-card trend-card">
            <p className="comparison-card-title">{showPace ? t('trend.avgPaceTrend') : t('trend.avgSpeedTrend')}</p>
            {line.segments.length ? (
              <>
                <div className="trend-chart">
                  <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
                    <line
                      className="metric-gridline"
                      x1={CHART.padX}
                      y1={CHART.height - CHART.padBottom}
                      x2={CHART.width - CHART.padX}
                      y2={CHART.height - CHART.padBottom}
                    />
                    {line.segments.map((segment) => (
                      <path
                        key={segment[0].key}
                        className="trend-line"
                        d={toPath(segment)}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {line.points.map((point) => (
                      <circle key={point.key} className="trend-point" cx={point.x} cy={point.y} r="3">
                        <title>
                          {`${periodTitle(point.key, granularity, t, lang)} · ${
                            showPace ? `${formatPaceSeconds(point.value)}/km` : `${point.value.toFixed(1)} km/h`
                          }`}
                        </title>
                      </circle>
                    ))}
                    <AxisLabels buckets={chartBuckets} granularity={granularity} />
                  </svg>
                </div>
                <p className="comparison-card-sub">
                  {showPace
                    ? t('trend.periodAvgPace', {
                      period: t(granularityLabelKey),
                      value: formatPaceSeconds(current.avgPace),
                    })
                    : t('trend.periodAvgSpeed', {
                      period: t(granularityLabelKey),
                      value: formatSpeedKmh(current.avgPace),
                    })}
                  {t('trend.lineBreakNote')}
                </p>
              </>
            ) : (
              <p className="comparison-empty">{t('trend.noPaceData')}</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
