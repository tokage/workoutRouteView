import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckSquare, ChevronRight, Search, Shuffle, X } from 'lucide-react'
import { ACTIVITY, ACTIVITY_ORDER } from '../constants'
import { formatDate, formatDuration, formatPaceSeconds } from '../format'
import ActivityIcon from './ActivityIcon'

function Sidebar({
  data,
  routes,
  selectedId,
  onSelect,
  category,
  onCategory,
  year,
  onYear,
  search,
  onSearch,
  multiSelect,
  onToggleMulti,
  visibleIds,
  onToggleVisible,
  onSelectAll,
  onDeselectAll,
  onInvert,
  canCompare,
  onCompare,
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language || 'en'
  const years = [...new Set(data.routes.map((route) => route.year))].sort((a, b) => b - a)

  const handleRowClick = (id) => {
    if (multiSelect) {
      onToggleVisible(id)
    } else {
      onSelect(id)
    }
  }

  return (
    <aside className="sidebar">
      <header className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1>{t('sidebar.title')}</h1>
          <p>{t('sidebar.routeCount', { count: data.routeCount })}</p>
        </div>
      </header>

      <label className="search-box">
        <Search size={17} aria-hidden="true" />
        <input
          id="route-search"
          name="route-search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t('sidebar.searchPlaceholder')}
          aria-label={t('sidebar.searchPlaceholder')}
        />
      </label>

      <div className="activity-tabs" aria-label={t('sidebar.activityFilterAria')}>
        {ACTIVITY_ORDER.map((key) => (
          <button
            className={category === key ? 'active' : ''}
            key={key}
            onClick={() => onCategory(key)}
            data-testid={`activity-filter-${key}`}
            aria-pressed={category === key}
            style={{ '--activity-color': ACTIVITY[key].color }}
          >
            {key !== 'all' && <ActivityIcon category={key} size={15} />}
            {t(ACTIVITY[key].labelKey)}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <label>
          <span>{t('sidebar.yearLabel')}</span>
          <select
            id="year-filter"
            name="year"
            data-testid="year-filter"
            value={year}
            onChange={(event) => onYear(event.target.value)}
          >
            <option value="all">{t('sidebar.allYears')}</option>
            {years.map((item) => (
              <option value={item} key={item}>{t('sidebar.yearOption', { year: item })}</option>
            ))}
          </select>
        </label>
        <button
          className={`visibility-button ${multiSelect ? 'active' : ''}`}
          onClick={onToggleMulti}
          aria-pressed={multiSelect}
        >
          <CheckSquare size={16} />
          {multiSelect ? t('sidebar.exitMulti') : t('sidebar.multiSelect')}
        </button>
      </div>

      {multiSelect && (
        <div className="batch-actions">
          <button onClick={onSelectAll}>{t('sidebar.selectAll')}</button>
          <button onClick={onInvert}><Shuffle size={13} />{t('sidebar.invert')}</button>
          <button onClick={onDeselectAll}><X size={13} />{t('sidebar.deselectAll')}</button>
          <button
            className="compare-button"
            onClick={onCompare}
            disabled={!canCompare}
            title={canCompare ? t('sidebar.compareTitle') : t('sidebar.compareDisabledTitle')}
          >
            {t('sidebar.compare', { count: visibleIds.size })}
          </button>
        </div>
      )}

      <div className="list-heading">
        <span>{t('sidebar.totalCount', { count: routes.length })}</span>
        <span>{category === 'all' ? t('sidebar.allActivities') : t(ACTIVITY[category].labelKey)}</span>
      </div>

      <div className="route-list">
        {routes.map((route) => {
          const meta = ACTIVITY[route.category] || ACTIVITY.other
          const isVisible = visibleIds.has(route.id)
          const isSelected = selectedId === route.id
          return (
            <button
              className={`route-row ${isSelected ? 'selected' : ''}`}
              key={route.id}
              onClick={() => handleRowClick(route.id)}
              style={{ '--activity-color': meta.color }}
            >
              {multiSelect ? (
                isVisible
                  ? <span className="route-check checked" style={{ '--activity-color': meta.color }} />
                  : <span className="route-check" />
              ) : (
                <span className="route-icon"><ActivityIcon category={route.category} /></span>
              )}
              <span className="route-copy">
                <time>{formatDate(route.date, lang)}</time>
                <strong>{t(meta.labelKey)}</strong>
                <small>
                  <span>{route.distanceKm ? `${route.distanceKm.toFixed(2)} km` : t('sidebar.distanceUnknown')}</span>
                  <span>{formatDuration(route.durationMin)}</span>
                  <span>{route.ascentM != null ? `${route.ascentM.toFixed(2)} m` : '—'}</span>
                  <span>{formatPaceSeconds(route.avgPace)} /km</span>
                  {route.avgHeartRate != null && <span>♥ {Math.round(route.avgHeartRate)}</span>}
                </small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          )
        })}
        {routes.length === 0 && <p className="empty-list">{t('sidebar.empty')}</p>}
      </div>
    </aside>
  )
}

export default memo(Sidebar)
