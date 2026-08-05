import { memo } from 'react'
import { formatSplitPace, splitPaceMark } from '../splits'

/**
 * 每公里分段表（F07 Web，架构 §5 SplitsTable.jsx）。
 *
 * 与 iOS SplitsTableView 同口径（架构 §7 T2.6 验收：分段数/配速值与 iOS 完全一致）：
 * - 行：km 数 / 配速 / 心率 + 快慢标记 + isPartial 尾段标注
 * - 快慢基准 = 本次全程均配速 avgPace（±1s/km 死区，splitPaceMark）
 * - 骑行显示 km/h，其余显示 秒/km
 */
function SplitsTable({ splits, avgPace, isCycling }) {
  if (!splits?.length) {
    return (
      <section className="splits-panel">
        <div className="metric-chart-heading">
          <strong>每公里分段</strong>
        </div>
        <p className="splits-empty">暂无分段数据</p>
      </section>
    )
  }
  return (
    <section className="splits-panel">
      <div className="metric-chart-heading">
        <strong>每公里分段</strong>
        <span>快慢基准：本次均配速</span>
      </div>
      <div className="splits-table">
        {splits.map((split) => {
          const mark = split.isPartial ? null : splitPaceMark(split.pace, avgPace)
          return (
            <div className="splits-row" key={split.index}>
              <span className="splits-km">
                {split.isPartial ? '尾段' : `${split.index} km`}
                {split.isPartial && Number.isFinite(split.distance)
                  ? <small>{(split.distance / 1000).toFixed(2)} km</small>
                  : null}
              </span>
              <span className="splits-pace">
                {formatSplitPace(split.pace, isCycling)}
                {Number.isFinite(split.pace) && split.pace > 0
                  ? <small>{isCycling ? ' km/h' : ' /km'}</small>
                  : null}
              </span>
              <span className="splits-hr">
                {Number.isFinite(split.avgHeartRate)
                  ? `${Math.round(split.avgHeartRate)} bpm`
                  : '—'}
              </span>
              <span className={`splits-mark ${mark || 'none'}`}>
                {mark === 'fast' ? '快' : mark === 'slow' ? '慢' : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default memo(SplitsTable)
