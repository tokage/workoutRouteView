import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapCanvas from './components/MapCanvas'
import MetricPanel from './components/MetricPanel'
import RouteDetails from './components/RouteDetails'
import Sidebar from './components/Sidebar'
import { apiRouteRepository } from './routeRepository'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [year, setYear] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [multiSelect, setMultiSelect] = useState(false)
  const [visibleIds, setVisibleIds] = useState(null)
  const [fitKey, setFitKey] = useState(0)
  const [metricsOpen, setMetricsOpen] = useState(false)
  const [metricElapsedSec, setMetricElapsedSec] = useState(0)
  const [metricState, setMetricState] = useState({ routeId: null, status: 'idle', data: null })
  const metricsCache = useRef(new Map())

  useEffect(() => {
    apiRouteRepository.listRoutes()
      .then((payload) => {
        setData(payload)
        const firstId = payload.routes[0]?.id
        setVisibleIds(firstId ? new Set([firstId]) : new Set())
        setSelectedId(firstId || null)
      })
      .catch((reason) => setError(reason.message))
  }, [])

  const routes = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    return data.routes.filter((route) => {
      const categoryMatch = category === 'all' || route.category === category
      const yearMatch = year === 'all' || String(route.year) === String(year)
      const searchMatch = !query || `${route.date} ${route.source}`.toLowerCase().includes(query)
      return categoryMatch && yearMatch && searchMatch
    })
  }, [data, category, year, search])

  useEffect(() => {
    if (routes.length && !routes.some((route) => route.id === selectedId)) {
      setSelectedId(routes[0].id)
    }
  }, [routes, selectedId])

  const selected = routes.find((route) => route.id === selectedId) || routes[0] || null

  // ── selection / visibility ──────────────────────────────

  const handleSelect = useCallback((id) => {
    setSelectedId(id)
    setVisibleIds(new Set([id]))
  }, [])

  const handleToggleVisible = useCallback((id) => {
    setVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectedId(id)
  }, [])

  const handleToggleMulti = useCallback(() => {
    setMultiSelect((prev) => !prev)
  }, [])

  // exiting multi → single: reduce to selectedId only
  useEffect(() => {
    if (!multiSelect && visibleIds && visibleIds.size > 1 && selectedId) {
      setVisibleIds(new Set([selectedId]))
    }
  }, [multiSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectAll = useCallback(() => {
    setVisibleIds(new Set(routes.map((r) => r.id)))
  }, [routes])

  const handleDeselectAll = useCallback(() => {
    setVisibleIds(new Set())
  }, [])

  const handleInvert = useCallback(() => {
    setVisibleIds((prev) => {
      const routeIds = new Set(routes.map((r) => r.id))
      const next = new Set()
      routeIds.forEach((id) => {
        if (!prev.has(id)) next.add(id)
      })
      return next
    })
  }, [routes])

  const handleShowAll = useCallback(() => {
    setCategory('all')
    setYear('all')
    setSearch('')
    setVisibleIds(data ? new Set(data.routes.map((r) => r.id)) : null)
  }, [data])

  // ── metrics / fit ───────────────────────────────────────

  const handleToggleMetrics = useCallback(() => {
    setMetricsOpen((open) => !open)
  }, [])
  const handleFit = useCallback(() => {
    setFitKey((key) => key + 1)
  }, [])

  useEffect(() => {
    setMetricElapsedSec(0)
  }, [selected?.id])

  useEffect(() => {
    if (!metricsOpen || !selected) return undefined
    const cached = metricsCache.current.get(selected.id)
    if (cached !== undefined) {
      setMetricState({ routeId: selected.id, status: 'ready', data: cached })
      return undefined
    }
    let active = true
    setMetricState({ routeId: selected.id, status: 'loading', data: null })
    apiRouteRepository.getRouteMetrics(selected)
      .then((metrics) => {
        if (!active) return
        metricsCache.current.set(selected.id, metrics)
        setMetricState({ routeId: selected.id, status: 'ready', data: metrics })
      })
      .catch(() => {
        if (active) setMetricState({ routeId: selected.id, status: 'error', data: null })
      })
    return () => {
      active = false
    }
  }, [metricsOpen, selected?.id])

  // ── render ──────────────────────────────────────────────

  if (error) {
    return (
      <main className="state-screen">
        <h1>路线数据还没准备好</h1>
        <p>{error}。请确认 iPhone 上的 RouteLens 服务已启动。</p>
      </main>
    )
  }
  if (!data || !visibleIds) return <main className="state-screen"><p>正在载入运动路线…</p></main>

  return (
    <main className="app-shell">
      <Sidebar
        data={data}
        routes={routes}
        selectedId={selected?.id}
        onSelect={handleSelect}
        category={category}
        onCategory={setCategory}
        year={year}
        onYear={setYear}
        search={search}
        onSearch={setSearch}
        multiSelect={multiSelect}
        onToggleMulti={handleToggleMulti}
        visibleIds={visibleIds}
        onToggleVisible={handleToggleVisible}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onInvert={handleInvert}
      />
      <section className="map-panel">
        <MapCanvas
          key={fitKey}
          routes={routes}
          selected={selected}
          visibleIds={visibleIds}
          focusElapsedSec={metricsOpen ? metricElapsedSec : null}
          onFocusElapsedSec={setMetricElapsedSec}
        />
        {metricsOpen && (
          <MetricPanel
            route={selected}
            metrics={metricState.routeId === selected?.id ? metricState.data : null}
            status={metricState.routeId === selected?.id ? metricState.status : 'loading'}
            elapsedSec={metricElapsedSec}
            onElapsedSec={setMetricElapsedSec}
            onClose={() => setMetricsOpen(false)}
          />
        )}
        <RouteDetails
          route={selected}
          metricsOpen={metricsOpen}
          onToggleMetrics={handleToggleMetrics}
          onFit={handleFit}
          onShowAll={handleShowAll}
        />
      </section>
    </main>
  )
}
