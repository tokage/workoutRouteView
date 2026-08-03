import { memo } from 'react'
import { ChevronRight, Eye, EyeOff, Search } from 'lucide-react'
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
  showAll,
  onShowAll,
}) {
  const years = [...new Set(data.routes.map((route) => route.year))].sort((a, b) => b - a)

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
        <button data-testid="visibility-mode" className="visibility-button" onClick={() => onShowAll(!showAll)}>
          {showAll ? <Eye size={16} /> : <EyeOff size={16} />}
          {showAll ? '显示全部' : '仅看选中'}
        </button>
      </div>

      <div className="list-heading">
        <span>共 {routes.length} 条</span>
        <span>{category === 'all' ? '全部运动' : ACTIVITY[category].label}</span>
      </div>

      <div className="route-list">
        {routes.map((route) => {
          const meta = ACTIVITY[route.category] || ACTIVITY.other
          return (
            <button
              className={`route-row ${selectedId === route.id ? 'selected' : ''}`}
              key={route.id}
              onClick={() => onSelect(route.id)}
              style={{ '--activity-color': meta.color }}
            >
              <span className="route-icon"><ActivityIcon category={route.category} /></span>
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
