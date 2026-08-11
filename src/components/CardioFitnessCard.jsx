import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CHART,
  buildDateAxisTicks,
  buildDateLineSegments,
  cardioComparisonKey,
  cardioDirectionClass,
  cardioWindowTitleKey,
  formatCardioAxisDate,
  formatCardioDate,
  formatCardioDelta,
  formatCardioValue,
  toPath,
} from '../trend'

/**
 * 趋势页有氧适能卡（Web 轨，T07）。
 * 严格镜像 iOS `Views/Trend/CardioFitnessCard.swift`，结构与文案 1:1 对位。
 *
 * ⚠️ 本卡**独立于类型筛选**（VO₂max 是用户级周期指标），且**只渲染**——
 * 所有派生值（windowAvg / previousAvg / delta / 死区 0.5 / direction）已由原生
 * `/api/cardio` 算完下发，这里绝不重算一个数（架构硬规则「派生数据只在 Swift 算一次」）。
 *
 * @param {{status: 'loading'|'ready'|'error', data: object|null, granularity: string}} props
 */
export default function CardioFitnessCard({ status, data, granularity }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'

  const line = useMemo(
    () => buildDateLineSegments((data && data.windowedSeries) || []),
    [data],
  )
  const ticks = useMemo(
    () => buildDateAxisTicks(line.tMin, line.tMax),
    [line],
  )

  return (
    <section className="comparison-card trend-card trend-cardio-card">
      <p className="comparison-card-title">{t('trend.cardioTitle')}</p>
      <p className="trend-cardio-subtitle">{`VO₂max · ${t('trend.cardioSubtitle')}`}</p>

      {status === 'loading' && <p className="comparison-empty">{t('trend.cardioLoading')}</p>}
      {status === 'error' && <p className="comparison-empty">{t('errors.cardioLoadFailed')}</p>}

      {status === 'ready' && data && !data.hasData && (
        <div className="trend-cardio-placeholder">
          <p className="trend-cardio-placeholder-title">{t('trend.cardioNoData')}</p>
          <p>{t('trend.cardioNoDataHint')}</p>
        </div>
      )}

      {status === 'ready' && data && data.hasData && (
        <>
          <div className="trend-cardio-hero">
            <strong className="trend-cardio-value">
              {formatCardioValue(data.latest && data.latest.value)}
            </strong>
            <span className="trend-cardio-unit">
              ml/kg/min
              <em className="trend-cardio-date">
                {formatCardioDate(data.latest && data.latest.date, lang)}
              </em>
            </span>
            <span className="trend-cardio-badge">
              <em>{t(cardioComparisonKey(granularity))}</em>
              <b className={`trend-delta-${cardioDirectionClass(data.direction)}`}>
                {formatCardioDelta(data.delta, data.direction, t)}
              </b>
            </span>
          </div>

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
                      className="trend-cardio-line"
                      d={toPath(segment)}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {line.points.map((point) => (
                    <circle key={point.key} className="trend-cardio-point" cx={point.x} cy={point.y} r="3">
                      <title>
                        {`${formatCardioDate(point.t, lang)} · ${formatCardioValue(point.value)} ml/kg/min`}
                      </title>
                    </circle>
                  ))}
                  {ticks.map((tick) => (
                    <text key={tick.x} className="trend-axis-label" x={tick.x} y={CHART.height - 8} textAnchor="middle">
                      {formatCardioAxisDate(tick.t, granularity, lang)}
                    </text>
                  ))}
                </svg>
              </div>
              <p className="comparison-card-sub">{t(cardioWindowTitleKey(granularity))}</p>
            </>
          ) : (
            <p className="comparison-empty">{t('trend.cardioNoRangeData')}</p>
          )}
        </>
      )}
    </section>
  )
}
