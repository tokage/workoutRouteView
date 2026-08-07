import { memo } from 'react'
import { Map, TrendingUp } from 'lucide-react'
import { ACTIVITY } from '../constants'

/**
 * 「地图 / 趋势」两态切换（T4.6）。
 *
 * 复用侧栏 `.activity-tabs` 的分段控件样式（同一套边框 / hover / active 下划线），
 * 只用 `.view-switch` 修饰类改两件事：网格列数 5 → 2，以及浮动到 map-panel 左上角。
 * 不自创设计语言。
 */
const VIEWS = [
  { key: 'map', label: '地图', Icon: Map },
  { key: 'trend', label: '趋势', Icon: TrendingUp },
]

function ViewSwitch({ view, onChange }) {
  return (
    <div
      className="activity-tabs view-switch"
      role="tablist"
      aria-label="视图切换"
      style={{ '--activity-color': ACTIVITY.all.color }}
    >
      {VIEWS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          className={view === key ? 'active' : undefined}
          onClick={() => onChange(key)}
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

export default memo(ViewSwitch)
