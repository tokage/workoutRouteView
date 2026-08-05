import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { ACTIVITY } from '../constants'
import { nearestRoutePoint } from '../metrics'

const DEFAULT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const DEFAULT_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO'

function marker(color, label) {
  return L.divIcon({
    className: 'route-marker',
    html: `<span style="--marker-color:${color}">${label}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export default function MapCanvas({
  routes,
  selected,
  visibleIds,
  focusElapsedSec,
  onFocusElapsedSec,
}) {
  const mapNode = useRef(null)
  const mapRef = useRef(null)
  const routeLayerRef = useRef(null)
  const focusLayerRef = useRef(null)

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return
    const map = L.map(mapNode.current, { zoomControl: false })
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer(import.meta.env.VITE_TILE_URL || DEFAULT_TILE_URL, {
      attribution: import.meta.env.VITE_TILE_ATTRIBUTION || DEFAULT_TILE_ATTRIBUTION,
      subdomains: import.meta.env.VITE_TILE_SUBDOMAINS || 'abcd',
      maxZoom: Number(import.meta.env.VITE_TILE_MAX_ZOOM || 20),
    }).addTo(map)
    map.setView([31.23, 121.47], 10)
    mapRef.current = map
    routeLayerRef.current = L.layerGroup().addTo(map)
    focusLayerRef.current = L.layerGroup().addTo(map)
    return () => {
      routeLayerRef.current = null
      focusLayerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  // ── route layer ──────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    const layer = routeLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const visibleRoutes = routes.filter((r) => visibleIds.has(r.id))
    const bounds = []

    visibleRoutes.forEach((route) => {
      const isSelected = selected?.id === route.id
      const color = (ACTIVITY[route.category] || ACTIVITY.other).color
      const latLngs = route.points.map((p) => [p[0], p[1]])
      const polyline = L.polyline(latLngs, {
        className: isSelected ? 'route-line selected-route-line' : 'route-line',
        color,
        opacity: isSelected ? 1 : 0.38,
        weight: isSelected ? 5 : 1.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer)
      if (isSelected && onFocusElapsedSec) {
        polyline.on('click', (event) => {
          const timedPoints = route.points.filter((p) => Number.isFinite(p[3]))
          if (!timedPoints.length) return
          const nearest = timedPoints.reduce((best, p) => {
            const d = event.latlng.distanceTo(L.latLng(p[0], p[1]))
            return d < best.distance ? { point: p, distance: d } : best
          }, { point: timedPoints[0], distance: Number.POSITIVE_INFINITY })
          onFocusElapsedSec(nearest.point[3])
        })
      }
      bounds.push(...latLngs)
    })

    // start / end markers (only when selected route is visible)
    if (selected && visibleIds.has(selected.id)) {
      const color = (ACTIVITY[selected.category] || ACTIVITY.other).color
      const first = selected.points[0]
      const last = selected.points[selected.points.length - 1]
      L.marker([first[0], first[1]], { icon: marker(color, '起') }).addTo(layer)
      L.marker([last[0], last[1]], { icon: marker(color, '终') }).addTo(layer)
    }

    if (bounds.length) {
      const single = visibleRoutes.length === 1
      map.fitBounds(bounds, {
        padding: single ? [90, 90] : [60, 60],
      })
    }
  }, [routes, selected, visibleIds, onFocusElapsedSec])

  // ── focus layer (metric playback) ────────────────────────

  useEffect(() => {
    const layer = focusLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!selected || !Number.isFinite(focusElapsedSec)) return
    const point = nearestRoutePoint(selected.points, focusElapsedSec)
    if (!point) return
    const color = (ACTIVITY[selected.category] || ACTIVITY.other).color
    L.circleMarker([point[0], point[1]], {
      className: 'metric-map-focus',
      radius: 7,
      color: '#ffffff',
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(layer)
  }, [selected, focusElapsedSec])

  return <div className="map" ref={mapNode} aria-label="运动轨迹地图" />
}
