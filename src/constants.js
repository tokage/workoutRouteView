/**
 * 运动类型常量（i18n 改造后：label → labelKey，展示文案由词典翻译）。
 *
 * - `labelKey` 为 i18n 键（activity.*），组件层用 `t(ACTIVITY[key].labelKey)` 取文案。
 * - `color` 保留（地图/列表着色）。
 */
export const ACTIVITY = {
  all: { labelKey: 'activity.all', color: '#2f8cff' },
  run: { labelKey: 'activity.run', color: '#ff6756' },
  ride: { labelKey: 'activity.ride', color: '#37d5dc' },
  walk: { labelKey: 'activity.walk', color: '#c9ee58' },
  hike: { labelKey: 'activity.hike', color: '#f5a23b' },
  other: { labelKey: 'activity.other', color: '#b18cff' },
}

export const ACTIVITY_ORDER = ['all', 'run', 'ride', 'walk', 'hike']
