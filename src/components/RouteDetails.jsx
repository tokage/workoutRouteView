import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, LocateFixed } from 'lucide-react'
import { ACTIVITY } from '../constants'
import { formatDate, formatDuration } from '../format'
import { formatSplitPace } from '../splits'
import ActivityIcon from './ActivityIcon'

function RouteDetails({
  route,
  metricsOpen,
  onToggleMetrics,
  onFit,
  onShowAll,
}) {
  const { t, i18n } = useTranslation()
  if (!route) return null
  const lang = i18n.resolvedLanguage || i18n.language || 'en'
  const meta = ACTIVITY[route.category] || ACTIVITY.other
  const isCycling = route.category === 'ride'
  return (
    <section className="route-details" style={{ '--activity-color': meta.color }}>
      <div className="route-detail-title">
        <span className="detail-icon"><ActivityIcon category={route.category} size={26} /></span>
        <div>
          <small>{t(meta.labelKey)}</small>
          <strong>{formatDate(route.date, lang)}</strong>
          <span>{t('common.appleHealth')}</span>
        </div>
      </div>
      <dl>
        <div><dt>{t('routeDetails.distance')}</dt><dd>{route.distanceKm?.toFixed(2) || '—'} <small>km</small></dd></div>
        <div><dt>{t('routeDetails.duration')}</dt><dd>{formatDuration(route.durationMin)}</dd></div>
        <div><dt>{t('routeDetails.ascent')}</dt><dd>{route.ascentM != null ? route.ascentM.toFixed(2) : '—'} <small>m</small></dd></div>
        <div><dt>{t('routeDetails.descent')}</dt><dd>{route.descentM != null ? route.descentM.toFixed(2) : '—'} <small>m</small></dd></div>
        <div><dt>{t('routeDetails.pace')}</dt><dd>{formatSplitPace(route.avgPace, isCycling)} <small>{isCycling ? 'km/h' : '/km'}</small></dd></div>
        <div><dt>{t('routeDetails.avgHeartRate')}</dt><dd>{route.avgHeartRate != null ? `${Math.round(route.avgHeartRate)}` : '—'} <small>bpm</small></dd></div>
      </dl>
      <div className="detail-actions">
        <button
          className={metricsOpen ? 'active' : ''}
          onClick={onToggleMetrics}
        >
          <Activity size={17} />{metricsOpen ? t('routeDetails.collapseMetrics') : t('routeDetails.heartRateElevation')}
        </button>
        <button onClick={onFit}><LocateFixed size={17} />{t('routeDetails.fitRoute')}</button>
        <button className="primary" onClick={onShowAll}>{t('routeDetails.showAll')}</button>
      </div>
    </section>
  )
}

export default memo(RouteDetails)
