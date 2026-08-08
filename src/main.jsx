import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import { i18n, detectLanguage, changeLanguage } from './i18n/index.js'

// 语言判定（仅跟随浏览器语言，方案 v1.1 §3.3）：render 前定语言，并覆盖 index.html 静态 lang。
const detected = detectLanguage(navigator.languages)
changeLanguage(detected)
document.documentElement.lang = detected

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>,
)
