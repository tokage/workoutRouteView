import { memo } from 'react'
import { CheckSquare, ChevronRight, Search, Shuffle, X } from 'lucide-react'
import { ACTIVITY, ACTIVITY_ORDER } from '../constants'
import { formatDate, formatDuration } from '../format'
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
}) {
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
          <h1>我的运动路线</h1>
          <p>Apple 健康 · {data.routeCount} 条轨迹</p>
        </div>
      </header>

      <label className="search-box">
        <Search size={17} aria-hidden="true" />
        <input
          id="route-search"
          name="route-search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="搜索日期或来源"
          aria-label="搜索日期或来源"
        />
      </label>

      <div className="activity-tabs" aria-label="运动类型筛选">
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
            {ACTIVITY[key].label}
          </button>
        ))}
      </div>

      <div className="filter-row">
        <label>
          <span>年份</span>
          <select
            id="year-filter"
            name="year"
            data-testid="year-filter"
            value={year}
            onChange={(event) => onYear(event.target.value)}
          >
            <option value="all">全部年份</option>
            {years.map((item) => (
              <option value={item} key={item}>{item}年</option>
            ))}
          </select>
        </label>
        <button
          className={`visibility-button ${multiSelect ? 'active' : ''}`}
          onClick={onToggleMulti}
          aria-pressed={multiSelect}
        >
          <CheckSquare size={16} />
          {multiSelect ? '退出' : '多选'}
        </button>
      </div>

      {multiSelect && (
        <div className="batch-actions">
          <button onClick={onSelectAll}>全选</button>
          <button onClick={onInvert}><Shuffle size={13} />反选</button>
          <button onClick={onDeselectAll}><X size={13} />不选</button>
        </div>
      )}

      <div className="list-heading">
        <span>共 {routes.length} 条</span>
        <span>{category === 'all' ? '全部运动' : ACTIVITY[category].label}</span>
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
                <time>{formatDate(route.date)}</time>
                <strong>{meta.label}</strong>
                <small>
                  <span>{route.distanceKm ? `${route.distanceKm.toFixed(2)} km` : '距离未知'}</span>
                  <span>{formatDuration(route.durationMin)}</span>
                  <span>{route.ascentM.toFixed(2)} m</span>
                </small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          )
        })}
        {routes.length === 0 && <p className="empty-list">没有符合条件的轨迹。</p>}
      </div>
    </aside>
  )
}

export default memo(Sidebar)
