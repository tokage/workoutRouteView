/**
 * i18n React 绑定层。
 *
 * - 在 core 实例上注册 initReactI18next 并（幂等）init。
 * - 再导出 useTranslation（react-i18next）及 core 全部内容。
 * - 纯逻辑层（trend.js / comparison.js）**只 import core.js**，import 图不含 React；
 *   组件层 import 本文件，用 `useTranslation()` 取 UI 语言 t。
 */
import { initReactI18next } from 'react-i18next'
import { i18n, ensureInit } from './core.js'

i18n.use(initReactI18next)
ensureInit()

export { useTranslation } from 'react-i18next'
export * from './core.js'
