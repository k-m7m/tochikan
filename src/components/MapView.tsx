import type { Feature, FeatureCollection } from 'geojson'
import {
  AttributionControl,
  LngLatBounds,
  Map as MaplibreMap,
  Marker,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
  setWorkerUrl,
} from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { RailGraph } from '../data/railGraph'
import type { LatLng } from '../lib/geo'
import { baseStyle } from '../map/style'
import './MapView.css'

// MapLibre の worker は、Vite にまとめてもらったものを使う。
// 指定しないと、ビルド後に worker のファイルが見つからず地図が表示されない
setWorkerUrl(maplibreWorkerUrl)

/** 東京都のだいたいの範囲。これより外には動かせないようにする */
const TOKYO_BOUNDS: LngLatBoundsLike = [
  [138.85, 35.35],
  [140.1, 35.95],
]

export interface MapPin {
  id: string
  position: LatLng
  label: string
  kind: 'current' | 'goal' | 'guess' | 'answer'
}

interface Props {
  graph: RailGraph
  showLines: boolean
  showStations: boolean
  pins: MapPin[]
  /** 地図のタップを受け付けるとき、タップされた位置を受け取る */
  onTap?: (position: LatLng) => void
  /** この範囲が収まるように地図を動かす。値が変わったときだけ動く */
  focus?: { key: string; points: LatLng[]; maxZoom?: number }
}

function railGeoJSON(graph: RailGraph) {
  const lines: Feature[] = graph.data.edges.map((e) => {
    const a = graph.stations.get(e.a)!
    const b = graph.stations.get(e.b)!
    return {
      type: 'Feature',
      properties: { color: graph.lines.get(e.lineId)?.color ?? '#999' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [a.lng, a.lat],
          [b.lng, b.lat],
        ],
      },
    }
  })
  const stations: Feature[] = graph.data.stations.map((s) => ({
    type: 'Feature',
    properties: { inTokyo: s.inTokyo },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  }))
  return {
    lines: { type: 'FeatureCollection', features: lines } as const,
    stations: { type: 'FeatureCollection', features: stations } as const,
  }
}

function pinsGeoJSON(pins: MapPin[]): FeatureCollection {
  const features: Feature[] = pins.map((p) => ({
    type: 'Feature',
    properties: { kind: p.kind },
    geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
  }))
  // 予想の位置と正解の位置を線で結ぶ
  const guess = pins.find((p) => p.kind === 'guess')
  const answer = pins.find((p) => p.kind === 'answer')
  if (guess && answer) {
    features.push({
      type: 'Feature',
      properties: { kind: 'link' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [guess.position.lng, guess.position.lat],
          [answer.position.lng, answer.position.lat],
        ],
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

export default function MapView({
  graph,
  showLines,
  showStations,
  pins,
  onTap,
  focus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const onTapRef = useRef(onTap)
  const focusRef = useRef(focus)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    onTapRef.current = onTap
    focusRef.current = focus
  }, [onTap, focus])

  // 地図を作る
  useEffect(() => {
    const map = new MaplibreMap({
      container: containerRef.current!,
      style: baseStyle,
      center: [139.735, 35.685],
      zoom: 11.3,
      minZoom: 9,
      maxZoom: 16,
      maxBounds: TOKYO_BOUNDS,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    })
    // 下のパネルと重ならないよう、出典は左上に出す
    map.addControl(new AttributionControl({ compact: true }), 'top-left')
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    // 下地のタイルの読み込みを待たずに、スタイルができた時点で路線やピンを重ねる
    map.once('style.load', () => {
      const rail = railGeoJSON(graph)
      map.addSource('rail-lines', { type: 'geojson', data: rail.lines })
      map.addSource('rail-stations', { type: 'geojson', data: rail.stations })
      map.addSource('pins', { type: 'geojson', data: pinsGeoJSON([]) })
      map.addLayer({
        id: 'rail-lines',
        type: 'line',
        source: 'rail-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
          'line-opacity': 0.8,
        },
      })
      map.addLayer({
        id: 'rail-stations',
        type: 'circle',
        source: 'rail-stations',
        paint: {
          'circle-color': '#ffffff',
          'circle-stroke-color': '#6b5a52',
          'circle-stroke-width': 1.5,
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            2.5,
            15,
            7,
          ],
        },
      })
      map.addLayer({
        id: 'pin-link',
        type: 'line',
        source: 'pins',
        filter: ['==', ['get', 'kind'], 'link'],
        paint: {
          'line-color': '#e8647f',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      })
      map.addLayer({
        id: 'pin-dots',
        type: 'circle',
        source: 'pins',
        filter: ['!=', ['get', 'kind'], 'link'],
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match',
            ['get', 'kind'],
            'goal',
            '#f5a623',
            'guess',
            '#7a8cff',
            'answer',
            '#e8647f',
            '#4a3b35',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
      setLoaded(true)
    })

    map.on('click', (e: MapMouseEvent) => {
      onTapRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    return () => {
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [graph])

  // 路線の線と駅の点の表示を切り替える（難易度ごとの表示。要件定義書 FR-03）
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.setLayoutProperty(
      'rail-lines',
      'visibility',
      showLines ? 'visible' : 'none',
    )
    map.setLayoutProperty(
      'rail-stations',
      'visibility',
      showStations ? 'visible' : 'none',
    )
  }, [loaded, showLines, showStations])

  // ピン（現在地、ゴール、予想、正解）を描く
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    ;(map.getSource('pins') as GeoJSONSource).setData(pinsGeoJSON(pins))
    for (const m of markersRef.current) m.remove()
    markersRef.current = pins.map((p) => {
      const el = document.createElement('div')
      el.className = `map-pin map-pin--${p.kind}`
      el.textContent = p.label
      return new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([p.position.lng, p.position.lat])
        .addTo(map)
    })
  }, [loaded, pins])

  // 指定された範囲が収まるように動かす。
  // focus の中身ではなく key が変わったときだけ動かす（ピンが変わるたびに動くと操作しにくいため）
  const focusKey = focus?.key
  useEffect(() => {
    const map = mapRef.current
    const target = focusRef.current
    if (!map || !loaded || !target || target.points.length === 0) return
    const bounds = new LngLatBounds()
    for (const p of target.points) bounds.extend([p.lng, p.lat])
    map.fitBounds(bounds, {
      padding: { top: 90, bottom: 200, left: 70, right: 70 },
      maxZoom: target.maxZoom ?? 14,
      duration: 600,
    })
  }, [loaded, focusKey])

  return <div ref={containerRef} className="map-view" />
}
