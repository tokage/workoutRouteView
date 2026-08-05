const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function formatDate(value) {
  return dateFormatter.format(new Date(value))
}

export function formatDuration(minutes) {
  const totalSeconds = Math.round((minutes || 0) * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${mins}:${String(seconds).padStart(2, '0')}`
}

/** 秒/km → "5:27"（后端 avgPace 为整体口径，前端不再用时长÷距离现算） */
export function formatPaceSeconds(secPerKm) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—'
  const totalSeconds = Math.round(secPerKm)
  const mins = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${mins}:${String(seconds).padStart(2, '0')}`
}
