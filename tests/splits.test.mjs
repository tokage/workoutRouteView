// 分段表纯函数测试（T2.6）：快慢标记与配速展示口径（与 iOS SplitsTableView 一致）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { formatSplitPace, splitPaceMark } from '../src/splits.js'

test('splitPaceMark: 配速低=快，±1s/km 死区', () => {
  // 快：低于均配速 ≥1s
  assert.equal(splitPaceMark(320, 330), 'fast')
  assert.equal(splitPaceMark(329, 330), 'even', '差 1s 落在死区 → even')
  assert.equal(splitPaceMark(330, 330), 'even', '持平 → even')
  assert.equal(splitPaceMark(331, 330), 'even', '差 1s 落在死区 → even')
  // 慢：高于均配速 ≥1s
  assert.equal(splitPaceMark(340, 330), 'slow')
  assert.equal(splitPaceMark(360, 300), 'slow')
})

test('splitPaceMark: 非法值一律 null（组件对尾段不调用）', () => {
  assert.equal(splitPaceMark(0, 330), null)
  assert.equal(splitPaceMark(-5, 330), null)
  assert.equal(splitPaceMark(Number.NaN, 330), null)
  assert.equal(splitPaceMark(330, 0), null)
  assert.equal(splitPaceMark(330, null), null)
  assert.equal(splitPaceMark(330, Number.NaN), null)
  assert.equal(splitPaceMark(null, null), null)
})

test('formatSplitPace: 骑行 km/h、其余 秒/km、非法值占位', () => {
  assert.equal(formatSplitPace(300, false), '5:00')
  assert.equal(formatSplitPace(327.6, false), '5:28', '秒/km 四舍五入')
  assert.equal(formatSplitPace(300, true), '12.0', '3600/300 = 12.0 km/h')
  assert.equal(formatSplitPace(200, true), '18.0', '3600/200 = 18.0 km/h')
  assert.equal(formatSplitPace(0, false), '—')
  assert.equal(formatSplitPace(null, true), '—')
  assert.equal(formatSplitPace(Number.NaN, false), '—')
})
