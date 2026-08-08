// i18n 核心单测（方案 v1.1 §5.4）：语言判定回退 en、Intl locale 映射、词典完整性。
import test from 'node:test'
import assert from 'node:assert/strict'

import { detectLanguage, langToIntl, i18n, t } from '../src/i18n/core.js'
import zhHans from '../src/i18n/locales/zh-Hans.js'
import en from '../src/i18n/locales/en.js'
import { conditionLabel, columnLabel } from '../src/comparison.js'

/** 构造绑定指定语言的 t（UI 语言语义；core 导出的 t 恒为 zh-Hans 源语言） */
function tFor(lang) {
  return (key, options) => i18n.t(key, { ...(options || {}), lng: lang })
}

// ── 语言判定（§3.3 优先级链）────────────────────────────

test('detectLanguage: zh 优先', () => {
  assert.equal(detectLanguage(['zh-CN']), 'zh-Hans')
  assert.equal(detectLanguage(['zh-Hans']), 'zh-Hans')
  assert.equal(detectLanguage(['zh-TW']), 'zh-Hans')
  assert.equal(detectLanguage(['zh-CN', 'en-US']), 'zh-Hans')
})

test('detectLanguage: en', () => {
  assert.equal(detectLanguage(['en-US']), 'en')
  assert.equal(detectLanguage(['en-GB']), 'en')
  assert.equal(detectLanguage(['fr-FR', 'en-US']), 'en', '跳过无法识别的首项，取后续 en')
})

test('detectLanguage: 无法识别一律回退 en（v1.1 拍板口径）', () => {
  assert.equal(detectLanguage(['fr-FR']), 'en')
  assert.equal(detectLanguage(['ja-JP']), 'en')
  assert.equal(detectLanguage([]), 'en')
  assert.equal(detectLanguage(), 'en')
})

// ── Intl locale 映射 ────────────────────────────────────

test('langToIntl: zh-Hans → zh-CN，其余 → en-US', () => {
  assert.equal(langToIntl('zh-Hans'), 'zh-CN')
  assert.equal(langToIntl('en'), 'en-US')
  assert.equal(langToIntl('en-US'), 'en-US')
  assert.equal(langToIntl('fr'), 'en-US')
})

// ── 词典完整性（en 100% 覆盖 zh-Hans）───────────────────

test('词典：en 键集合与 zh-Hans 完全一致（复数键归一化）', () => {
  const plural = (key) => key.replace(/_(zero|one|two|few|many|other)$/, '')
  const zhSet = new Set(Object.keys(zhHans))
  const enSet = new Set(Object.keys(en).map(plural))
  const missing = [...zhSet].filter((key) => !enSet.has(key))
  const extra = [...enSet].filter((key) => !zhSet.has(key))
  assert.deepEqual(missing, [], `en 缺少键：${missing.join(', ')}`)
  assert.deepEqual(extra, [], `en 多余键：${extra.join(', ')}`)
})

// ── 纯逻辑默认 t 保持 zh-Hans（与 UI 回退 en 语义分离）───

test('core 导出的默认 t 恒为 zh-Hans（源语言）', () => {
  assert.equal(t('common.appleHealth'), 'Apple 健康')
})

// ── 纯逻辑 en 文案抽查（显式传 en t）─────────────────────

test('comparison.conditionLabel 天气 en 映射（拍板口径）', () => {
  const enT = tFor('en')
  assert.equal(conditionLabel('clear', enT), 'Clear')
  assert.equal(conditionLabel('partlyCloudy', enT), 'Partly Cloudy')
  assert.equal(conditionLabel('cloudy', enT), 'Cloudy')
  assert.equal(conditionLabel('rain', enT), 'Rain')
  assert.equal(conditionLabel('snow', enT), 'Snow')
  assert.equal(conditionLabel('fog', enT), 'Fog')
  assert.equal(conditionLabel('wind', enT), 'Windy')
  assert.equal(conditionLabel(null, enT), '—')
})

test('comparison.columnLabel en 日期（M/d）', () => {
  const enT = tFor('en')
  assert.equal(columnLabel({ startDate: '2026-08-07T07:12:03Z' }, enT, 'en'), '8/7')
})

test('归因文案 en 禁因果句式（不出现 because/caused/due to 等）', () => {
  const enText = Object.values(en)
    .filter((value) => typeof value === 'string')
    .join('\n')
    .toLowerCase()
  for (const banned of ['because', 'caused', 'therefore', 'due to', 'lead to', 'so that', 'makes ']) {
    assert.ok(!enText.includes(banned), `en 词典不应出现因果句式词：${banned}`)
  }
})
