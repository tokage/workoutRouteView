/**
 * i18n core 实例（纯逻辑友好层）。
 *
 * - 只 import i18next core（无 react-i18next），node --test 可直接 import。
 * - 导出：i18n（实例）/ ensureInit（幂等 init）/ t（**绑定 zh-Hans 的默认 t**）/
 *   changeLanguage / detectLanguage / langToIntl / CONFIG。
 *
 * ⚠️ 语义分离（方案 v1.1 §4.4）：
 * - 本模块导出的 `t` **始终绑定 zh-Hans（源语言）**，只作为纯逻辑函数（trend.js /
 *   comparison.js）可选 `t` 参数的默认值——保证 node 测试中文断言零破坏。
 * - UI 组件语言一律走 react-i18next 的 `useTranslation()`（见 ./index.js），
 *   与这里导出的默认 `t` 解耦：UI 显式传 `useTranslation()` 的 t 即可覆盖默认值。
 */
import i18next from 'i18next'
import zhHans from './locales/zh-Hans.js'
import en from './locales/en.js'

/** 初始化配置：core.js 与 index.js（React 绑定层）共用同一份 */
export const CONFIG = {
  resources: {
    'zh-Hans': { translation: zhHans },
    en: { translation: en },
  },
  lng: 'zh-Hans', // 初始/默认 = 源语言：node 测试与现网行为一致（方案 §4.4）
  fallbackLng: 'en', // 键缺失回退 en（v1.1：en 为完整性保底，不裸奔显示 key）
  supportedLngs: ['zh-Hans', 'en'],
  interpolation: { escapeValue: false }, // React 默认转义，无需 HTML 转义
  initImmediate: false, // 同步初始化，render 前语言已定（无 Suspense）
  returnNull: false,
}

export const i18n = i18next.createInstance()

let initialized = false

/** 幂等初始化：index.js 注册 initReactI18next 之后再调用；纯逻辑默认 t 也会懒触发 */
export function ensureInit() {
  if (!initialized) {
    initialized = true
    i18n.init(CONFIG)
  }
  return i18n
}

/**
 * 切换 UI 运行时语言（main.jsx 在 render 前调用）。
 * @param {'zh-Hans'|'en'} lang
 */
export function changeLanguage(lang) {
  return ensureInit().changeLanguage(lang)
}

/**
 * 语言判定（仅跟随浏览器语言，方案 §3.3 优先级链）：
 *   1. navigator.languages 中第一个以 'zh' 开头 → 'zh-Hans'
 *   2. 第一个以 'en' 开头 → 'en'
 *   3. navigator.language 兜底同上规则
 *   4. 均无法识别 → 'en'（v1.1 拍板：默认回退 en，与 iOS sourceLanguage=en 对齐）
 * @param {Array<string>|undefined} languages 浏览器语言列表（node 测试显式传入）
 * @returns {'zh-Hans'|'en'}
 */
export function detectLanguage(languages) {
  const list = Array.isArray(languages) && languages.length
    ? languages
    : (typeof navigator !== 'undefined' && navigator.language ? [navigator.language] : [])
  for (const item of list) {
    const code = String(item || '').toLowerCase()
    if (code.startsWith('zh')) return 'zh-Hans'
    if (code.startsWith('en')) return 'en'
  }
  return 'en'
}

/**
 * TraceLens 语言键 → Intl locale（仅用于 Intl.DateTimeFormat / NumberFormat）。
 * 'zh-Hans' → 'zh-CN'；其余（含 'en' / 'en-US' / 未知）→ 'en-US'。
 * @param {string} lang
 * @returns {string}
 */
export function langToIntl(lang) {
  if (lang === 'zh-Hans' || (typeof lang === 'string' && lang.toLowerCase().startsWith('zh'))) {
    return 'zh-CN'
  }
  return 'en-US'
}

/**
 * 默认 t：始终绑定 zh-Hans（源语言），与 UI 运行时语言解耦。
 * 纯逻辑函数默认参数使用（trend.js / comparison.js 的 `t = coreT`）。
 */
export const t = (key, options) => ensureInit().t(key, { ...(options || {}), lng: 'zh-Hans' })
