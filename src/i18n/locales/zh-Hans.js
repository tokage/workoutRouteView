/**
 * 中文词典（源语言）。
 *
 * - 键集合必须与 en.js 完全一致（scripts/check_i18n_keys.mjs 强制校验）。
 * - 中文无复数范畴：一律使用无后缀基键，`{{count}}` 插值。
 * - 键按 `<域>.<名称>` 分组：app / activity / sidebar / routeDetails /
 *   metricPanel / splitsTable / viewSwitch / map / trend / comparison /
 *   weather / errors / common / units。
 */
export default {
  // ── 全局状态屏（App.jsx）──────────────────────────────
  'app.loading': '正在载入运动路线…',
  'app.errorTitle': '路线数据还没准备好',
  'app.errorBody': '{{error}}。请确认 iPhone 上的 TraceLens 服务已启动。',

  // ── 运动类型（constants.js ACTIVITY）──────────────────
  'activity.all': '全部',
  'activity.run': '跑步',
  'activity.ride': '骑车',
  'activity.walk': '步行',
  'activity.hike': '徒步',
  'activity.other': '其他',

  // ── 侧栏（Sidebar.jsx）───────────────────────────────
  'sidebar.title': '我的运动路线',
  'sidebar.routeCount': 'Apple 健康 · {{count}} 条轨迹',
  'sidebar.searchPlaceholder': '搜索日期或来源',
  'sidebar.activityFilterAria': '运动类型筛选',
  'sidebar.yearLabel': '年份',
  'sidebar.allYears': '全部年份',
  'sidebar.yearOption': '{{year}}年',
  'sidebar.multiSelect': '多选',
  'sidebar.exitMulti': '退出',
  'sidebar.selectAll': '全选',
  'sidebar.invert': '反选',
  'sidebar.deselectAll': '不选',
  'sidebar.compare': '对比 ({{count}})',
  'sidebar.compareTitle': '对比选中的路线',
  'sidebar.compareDisabledTitle': '至少选择 2 条路线',
  'sidebar.totalCount': '共 {{count}} 条',
  'sidebar.allActivities': '全部运动',
  'sidebar.distanceUnknown': '距离未知',
  'sidebar.empty': '没有符合条件的轨迹。',

  // ── 详情卡（RouteDetails.jsx）─────────────────────────
  'routeDetails.distance': '距离',
  'routeDetails.duration': '时长',
  'routeDetails.ascent': '爬升',
  'routeDetails.descent': '下降',
  'routeDetails.pace': '配速',
  'routeDetails.avgHeartRate': '均心率',
  'routeDetails.collapseMetrics': '收起指标',
  'routeDetails.heartRateElevation': '心率与海拔',
  'routeDetails.fitRoute': '适应路线',
  'routeDetails.showAll': '查看全部',

  // ── 指标面板（MetricPanel.jsx）────────────────────────
  'metricPanel.panelAria': '心率、海拔、配速与分段面板',
  'metricPanel.header': '查看心率、海拔、配速与分段',
  'metricPanel.closeAria': '关闭指标面板',
  'metricPanel.loading': '正在载入本机指标数据…',
  'metricPanel.loadFailed': '指标数据载入失败。',
  'metricPanel.noMetrics': '这条路线没有可用的指标数据。',
  'metricPanel.elapsed': '经过时间',
  'metricPanel.distance': '距离',
  'metricPanel.heartRate': '心率',
  'metricPanel.elevation': '海拔',
  'metricPanel.title': '心率与海拔',
  'metricPanel.sharedTimeline': '共享运动时间轴',
  'metricPanel.legendAria': '曲线说明',
  'metricPanel.avg': '平均 {{value}}',
  'metricPanel.noData': '无数据',
  'metricPanel.timelineAria': '心率与海拔时间位置',
  'metricPanel.noHrElevationSamples': '这次运动没有可用的心率或海拔采样。',
  'metricPanel.pace': '配速',
  'metricPanel.kmh': '公里/小时',
  'metricPanel.secPerKm': '秒/公里',
  'metricPanel.paceAria': '配速里程位置',
  'metricPanel.noPaceData': '这次运动没有可用的配速数据。',
  'metricPanel.dragHint': '拖动查看任意里程的配速',

  // ── 分段表（SplitsTable.jsx）──────────────────────────
  'splitsTable.title': '每公里分段',
  'splitsTable.empty': '暂无分段数据',
  'splitsTable.baseline': '快慢基准：本次均配速',
  'splitsTable.partial': '尾段',
  'splitsTable.fast': '快',
  'splitsTable.slow': '慢',

  // ── 视图切换（ViewSwitch.jsx）─────────────────────────
  'viewSwitch.map': '地图',
  'viewSwitch.trend': '趋势',
  'viewSwitch.aria': '视图切换',

  // ── 地图（MapCanvas.jsx）──────────────────────────────
  'map.start': '起',
  'map.end': '终',
  'map.ariaLabel': '运动轨迹地图',

  // ── 趋势（TrendView.jsx + trend.js）───────────────────
  'trend.granularityWeek': '周',
  'trend.granularityMonth': '月',
  'trend.granularityYear': '年',
  'trend.granularityAria': '统计粒度',
  'trend.loading': '正在统计…',
  'trend.noDataTitle': '还没有可统计的运动记录。',
  'trend.noDataHint': '在 iPhone 上完成一次同步后，这里会显示周期趋势。',
  'trend.totalDistance': '总距离',
  'trend.totalDuration': '总时长',
  'trend.totalCount': '次数',
  'trend.totalAscent': '总爬升',
  'trend.distanceTrend': '距离趋势',
  'trend.peakDistance': '峰值 {{value}} km',
  'trend.avgPaceTrend': '平均配速趋势',
  'trend.avgSpeedTrend': '平均速度趋势',
  'trend.periodAvgPace': '本{{period}}平均 {{value}}/km',
  'trend.periodAvgSpeed': '本{{period}}平均 {{value}} km/h',
  'trend.lineBreakNote': '；无记录周期已断开，不按 0 计',
  'trend.noPaceData': '所选周期暂无配速数据',
  'trend.flat': '持平',
  'trend.periodWeek': '{{year}}年第{{week}}周',
  'trend.periodMonth': '{{year}}年{{month}}月',
  'trend.periodYear': '{{year}}年',
  'trend.monthShort': '{{month}}月',
  'trend.compareWeek': '较上周',
  'trend.compareMonth': '较上月',
  'trend.compareYear': '较上年',
  'trend.deltaDistance': '距离',
  'trend.deltaDuration': '时长',
  'trend.deltaCount': '次数',
  'trend.deltaAscent': '爬升',

  // ── 对比（ComparisonPanel.jsx + comparison.js）─────────
  'comparison.panelAria': '指标对比面板',
  'comparison.title': '指标对比',
  'comparison.closeAria': '关闭对比面板',
  'comparison.loading': '正在载入对比数据…',
  'comparison.baseline': '基准',
  'comparison.crossTypeNote': '跨运动类型对比：运动内差值已隐藏，天气差异照常展示',
  'comparison.weatherTitle': '天气',
  'comparison.attributionTitle': '效能归因（仅并列差异）',
  'comparison.caveat': '仅展示同期差异，不代表因果',
  'comparison.paceCurveTitle': '配速曲线（按里程 0–100%）',
  'comparison.paceCurveSub': '效能变化过程证据：同一段路这次快了还是慢了',
  'comparison.noPaceSamples': '所选记录暂无配速序列，无法绘制对比曲线',
  'comparison.mixedNote': '混合运动类型：统一按 秒/km 展示',
  'comparison.rowDistance': '距离',
  'comparison.rowDuration': '时长',
  'comparison.rowPace': '配速',
  'comparison.rowSpeed': '速度',
  'comparison.rowPaceSpeed': '配速/速度',
  'comparison.rowAvgHeartRate': '均心率',
  'comparison.rowAscent': '爬升',
  'comparison.rowMaxHeartRate': '最高心率',
  'comparison.temperature': '温度',
  'comparison.humidity': '湿度',
  'comparison.same': '相同',
  'comparison.different': '不同',
  'comparison.dirHigher': '高',
  'comparison.dirLower': '低',
  'comparison.dirMore': '多',
  'comparison.dirLess': '少',
  'comparison.dirSlower': '慢',
  'comparison.dirFaster': '快',
  'comparison.envTemperature': '当日温度{{dir}} {{value}}°C',
  'comparison.envHumidity': '湿度{{dir}} {{value}}%',
  'comparison.envWeather': '天气 {{subject}} / {{baseline}}',
  'comparison.envAscent': '爬升{{dir}} {{value}} m',
  'comparison.attrPace': '配速{{dir}} {{value}} 秒/km',
  'comparison.attrSpeed': '速度{{dir}} {{value}} km/h',
  'comparison.attrHeartRate': '均心率{{dir}} {{value}} bpm',

  // ── 天气现象（comparison.js WEATHER_CONDITION_KEYS）───
  'weather.clear': '晴',
  'weather.partlyCloudy': '多云',
  'weather.cloudy': '阴',
  'weather.rain': '雨',
  'weather.snow': '雪',
  'weather.fog': '雾',
  'weather.wind': '风',

  // ── API 错误映射（routeRepository.js 错误码 → 文案）───
  'errors.routesNotFound': '未找到路线数据',
  'errors.metricsNotFound': '未找到路线指标数据',
  'errors.trackNotFound': '未找到轨迹数据',
  'errors.summaryLoadFailed': '趋势数据加载失败',

  // ── 通用 ─────────────────────────────────────────────
  'common.appleHealth': 'Apple 健康',

  // ── 需要翻译的量词（km / m / bpm / /km / km/h 保持符号）─
  'units.count': '次',
  'units.sec': '秒',
}
