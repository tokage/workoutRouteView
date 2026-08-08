#!/usr/bin/env node
/**
 * i18n 键完整性检查（en 保底完整性验收，方案 v1.1 §4.1 / §7 #1）。
 *
 * 规则：
 * 1. zh-Hans（源语言）不得使用复数后缀键（_one/_other/…）。
 * 2. en 的复数后缀键（_one/_other）归一化为基键后，键集合必须与 zh-Hans **完全一致**
 *    （en 覆盖 zh-Hans 全部键，且无多余键）。
 * 3. en 若使用复数键，`_one` 与 `_other` 必须同时存在；同一基键不得与复数变体并存。
 *
 * 接入：`npm run check` 链上最先执行（node scripts/check_i18n_keys.mjs）。
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const zhPath = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'zh-Hans.js')
const enPath = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'en.js')

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

/** 动态 import 一个 export default 对象的 ESM 模块 */
async function importDefault(modulePath) {
  const url = pathToFileURL(modulePath).href
  const module = await import(url)
  return module.default
}

function collectErrors(zh, en) {
  const errors = []

  const zhKeys = Object.keys(zh)
  const enKeys = Object.keys(en)

  // 1. zh-Hans 不应有复数后缀键
  const zhPlural = zhKeys.filter((key) => PLURAL_SUFFIX.test(key))
  if (zhPlural.length) {
    errors.push(`zh-Hans 不应使用复数后缀键（中文无复数范畴）：${zhPlural.join(', ')}`)
  }

  // 2. en 复数变体归一化，并校验变体完整性
  const enBases = new Set()
  const pluralGroups = new Map() // base -> Set(forms)
  for (const key of enKeys) {
    const match = key.match(PLURAL_SUFFIX)
    if (match) {
      const base = key.slice(0, -match[0].length)
      enBases.add(base)
      if (!pluralGroups.has(base)) pluralGroups.set(base, new Set())
      pluralGroups.get(base).add(match[1])
    } else {
      enBases.add(key)
    }
  }
  for (const [base, forms] of pluralGroups.entries()) {
    if (!forms.has('one') || !forms.has('other')) {
      errors.push(`en 复数键 "${base}" 需同时包含 _one 与 _other（当前：${[...forms].join(', ')}）`)
    }
    if (enKeys.includes(base)) {
      errors.push(`en 键 "${base}" 与复数变体并存，应删除基键或变体`)
    }
  }

  // 3. 双向键集合一致性
  const zhSet = new Set(zhKeys)
  const missingInEn = zhKeys.filter((key) => !enBases.has(key))
  const extraInEn = [...enBases].filter((key) => !zhSet.has(key))
  if (missingInEn.length) {
    errors.push(`en 缺少键（en 必须 100% 覆盖 zh-Hans）：${missingInEn.join(', ')}`)
  }
  if (extraInEn.length) {
    errors.push(`en 存在多余键（键集合必须与 zh-Hans 一致）：${extraInEn.join(', ')}`)
  }

  return { errors, zhCount: zhKeys.length, enCount: enKeys.length, pluralCount: pluralGroups.size }
}

const zh = await importDefault(zhPath)
const en = await importDefault(enPath)

const { errors, zhCount, enCount, pluralCount } = collectErrors(zh, en)

if (errors.length) {
  console.error('❌ i18n 键完整性检查失败：')
  for (const message of errors) console.error(`  - ${message}`)
  process.exit(1)
}

console.log(`✅ i18n 键完整性检查通过：zh-Hans ${zhCount} 键 / en ${enCount} 键（含 ${pluralCount} 组复数键），键集合完全一致。`)
