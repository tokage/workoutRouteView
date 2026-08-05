import test from 'node:test'
import assert from 'node:assert/strict'

import { formatDuration, formatPaceSeconds, formatSpeedKmh } from '../src/format.js'

test('formatDuration formats durations below and above one hour', () => {
  assert.equal(formatDuration(45.7), '45:42')
  assert.equal(formatDuration(148), '2:28:00')
})

test('formatPaceSeconds formats backend avgPace (秒/km) and guards invalid values', () => {
  // 4:05.3 → 四舍五入 4:05
  assert.equal(formatPaceSeconds(4 * 60 + 5.3), '4:05')
  // 5:00 整
  assert.equal(formatPaceSeconds(300), '5:00')
  // 非法值一律返回占位
  assert.equal(formatPaceSeconds(0), '—')
  assert.equal(formatPaceSeconds(null), '—')
  assert.equal(formatPaceSeconds(Number.NaN), '—')
})

test('formatSpeedKmh converts 秒/km to km/h (骑行口径, 与 iOS formatSpeed 一致)', () => {
  assert.equal(formatSpeedKmh(300), '12.0', '3600/300 = 12.0 km/h')
  assert.equal(formatSpeedKmh(200), '18.0')
  assert.equal(formatSpeedKmh(360), '10.0')
  // 非法值一律返回占位
  assert.equal(formatSpeedKmh(0), '—')
  assert.equal(formatSpeedKmh(null), '—')
  assert.equal(formatSpeedKmh(Number.NaN), '—')
})
