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
import type { LineId } from '../data/types'
import { lineChains, type Board, type NodeId, type Route } from '../game/board'
import { darken } from '../lib/color'
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

/** 行き先の候補をタップしたとみなす距離（画面上のピクセル） */
const TAP_RADIUS_PX = 32

export interface MapFocus {
  key: string
  points: LatLng[]
  maxZoom?: number
}

interface Props {
  board: Board
  lineColors: Record<LineId, string>
  /** 地図の線に沿って書く路線名 */
  lineNames: Record<LineId, string>
  /** この路線だけを目立たせる */
  highlightLine?: LineId
  current: NodeId
  /** 名前を出すマス（通ったことのある駅） */
  known: ReadonlySet<NodeId>
  /** 行き先の候補。タップすると onChoose が呼ばれる */
  candidates: NodeId[]
  onChoose: (node: NodeId) => void
  /** 地図に出すときだけ渡す */
  goal?: NodeId
  lastMove?: { from: NodeId; route: Route }
  /** このマスが画面の端に近づいたら、地図を動かして追いかける */
  follow?: NodeId
  focus?: MapFocus
}

type Label = {
  node: NodeId
  kind: 'current' | 'goal' | 'candidate'
}

function boardGeoJSON(
  board: Board,
  lineColors: Record<LineId, string>,
  lineNames: Record<LineId, string>,
) {
  const pos = (id: NodeId) => {
    const n = board.nodes.get(id)!
    return [n.lng, n.lat]
  }
  const colorOf = (lineId: LineId) => lineColors[lineId] ?? '#999999'
  const lines: FeatureCollection = {
    type: 'FeatureCollection',
    features: board.segments.map((s) => ({
      type: 'Feature',
      properties: { lineId: s.lineId, color: colorOf(s.lineId) },
      geometry: { type: 'LineString', coordinates: [pos(s.from), pos(s.to)] },
    })),
  }
  // 路線名は、分岐や終点で区切った長い線に沿って書く
  const lineLabels: FeatureCollection = {
    type: 'FeatureCollection',
    features: board.lines.flatMap((line) =>
      lineChains(board, line.id).map((chain): Feature => ({
        type: 'Feature',
        properties: {
          lineId: line.id,
          name: lineNames[line.id] ?? line.name,
          textColor: darken(colorOf(line.id), 0.45),
        },
        geometry: { type: 'LineString', coordinates: chain.map(pos) },
      })),
    ),
  }
  const stations: FeatureCollection = {
    type: 'FeatureCollection',
    features: [...board.nodes.values()].map((n) => ({
      type: 'Feature',
      properties: { transfer: n.lineIds.length > 1 },
      geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
    })),
  }
  return { lines, lineLabels, stations }
}

function pointsGeoJSON(board: Board, ids: Iterable<NodeId>): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...ids].map((id) => {
      const n = board.nodes.get(id)!
      return {
        type: 'Feature',
        properties: { name: n.name },
        geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
      }
    }),
  }
}

function routeGeoJSON(
  board: Board,
  move?: { from: NodeId; route: Route },
): FeatureCollection {
  if (!move) return { type: 'FeatureCollection', features: [] }
  const coords = [move.from, ...move.route.nodes].map((id) => {
    const n = board.nodes.get(id)!
    return [n.lng, n.lat]
  })
  const feature: Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  }
  return { type: 'FeatureCollection', features: [feature] }
}

export default function MapView({
  board,
  lineColors,
  lineNames,
  highlightLine,
  current,
  known,
  candidates,
  onChoose,
  goal,
  lastMove,
  follow,
  focus,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MaplibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const onChooseRef = useRef(onChoose)
  const candidatesRef = useRef(candidates)
  const focusRef = useRef(focus)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    onChooseRef.current = onChoose
    candidatesRef.current = candidates
    focusRef.current = focus
  }, [onChoose, candidates, focus])

  // 地図を作る
  useEffect(() => {
    const map = new MaplibreMap({
      container: containerRef.current!,
      style: baseStyle,
      center: [139.735, 35.69],
      zoom: 11,
      minZoom: 9,
      maxZoom: 16,
      maxBounds: TOKYO_BOUNDS,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    })
    map.touchZoomRotate.disableRotation()
    // 下のパネルと重ならないよう、出典は左上に出す
    map.addControl(new AttributionControl({ compact: true }), 'top-left')
    mapRef.current = map

    // 下地のタイルの読み込みを待たずに、スタイルができた時点で路線や駅を重ねる
    map.once('style.load', () => {
      const geo = boardGeoJSON(board, lineColors, lineNames)
      map.addSource('rail-lines', { type: 'geojson', data: geo.lines })
      map.addSource('line-labels', { type: 'geojson', data: geo.lineLabels })
      map.addSource('rail-stations', { type: 'geojson', data: geo.stations })
      map.addSource('route', { type: 'geojson', data: routeGeoJSON(board) })
      map.addSource('candidates', {
        type: 'geojson',
        data: pointsGeoJSON(board, []),
      })
      map.addSource('known', {
        type: 'geojson',
        data: pointsGeoJSON(board, []),
      })
      map.addLayer({
        id: 'rail-lines',
        type: 'line',
        source: 'rail-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
          'line-opacity': 0.85,
        },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#e8647f',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 10],
          'line-opacity': 0.55,
        },
      })
      map.addLayer({
        id: 'rail-stations',
        type: 'circle',
        source: 'rail-stations',
        paint: {
          'circle-color': '#ffffff',
          'circle-stroke-color': '#6b5a52',
          'circle-stroke-width': ['case', ['get', 'transfer'], 2.5, 1.5],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['case', ['get', 'transfer'], 3.5, 2.5],
            15,
            ['case', ['get', 'transfer'], 9, 7],
          ],
        },
      })
      map.addLayer({
        id: 'candidates',
        type: 'circle',
        source: 'candidates',
        paint: {
          'circle-color': '#ff8fa3',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 15, 14],
        },
      })
      // 路線名。線に沿って書く。駅の名前と重なるときは駅の名前を優先する
      map.addLayer({
        id: 'line-labels',
        type: 'symbol',
        source: 'line-labels',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 280,
          'text-field': ['get', 'name'],
          'text-font': ['NotoSansJP-Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 13],
          'text-keep-upright': true,
          'text-offset': [0, -0.9],
        },
        paint: {
          'text-color': ['get', 'textColor'],
          'text-halo-color': 'rgba(255, 255, 255, 0.9)',
          'text-halo-width': 1.5,
        },
      })
      // 覚えた駅の名前。重なる名前は地図が自動で隠す
      map.addLayer({
        id: 'known-labels',
        type: 'symbol',
        source: 'known',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['NotoSansJP-Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 15, 14],
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.7,
          'text-justify': 'auto',
        },
        paint: {
          'text-color': '#4a3b35',
          'text-halo-color': 'rgba(255, 255, 255, 0.9)',
          'text-halo-width': 1.5,
        },
      })
      setLoaded(true)
    })

    // 候補の駅の近くをタップしたら、いちばん近い候補を選ぶ
    map.on('click', (e: MapMouseEvent) => {
      let best: { node: NodeId; d: number } | undefined
      for (const id of candidatesRef.current) {
        const n = board.nodes.get(id)!
        const p = map.project([n.lng, n.lat])
        const d = Math.hypot(p.x - e.point.x, p.y - e.point.y)
        if (d <= TAP_RADIUS_PX && (!best || d < best.d)) best = { node: id, d }
      }
      if (best) onChooseRef.current(best.node)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
  }, [board, lineColors, lineNames])

  // 選んだ路線だけを目立たせる
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.setPaintProperty(
      'rail-lines',
      'line-opacity',
      highlightLine
        ? ['case', ['==', ['get', 'lineId'], highlightLine], 1, 0.15]
        : 0.85,
    )
    map.setFilter(
      'line-labels',
      highlightLine ? ['==', ['get', 'lineId'], highlightLine] : null,
    )
  }, [loaded, highlightLine])

  // 候補と、直前に進んだ道順を描く
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    ;(map.getSource('candidates') as GeoJSONSource).setData(
      pointsGeoJSON(board, candidates),
    )
    ;(map.getSource('route') as GeoJSONSource).setData(
      routeGeoJSON(board, lastMove),
    )
  }, [loaded, board, candidates, lastMove])

  // 駅名を出す。今いる駅・目的地・候補は札（押せる）、覚えた駅は地図の文字
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const labels = new Map<NodeId, Label>()
    for (const id of candidates) labels.set(id, { node: id, kind: 'candidate' })
    if (goal) labels.set(goal, { node: goal, kind: 'goal' })
    labels.set(current, { node: current, kind: 'current' })

    ;(map.getSource('known') as GeoJSONSource).setData(
      pointsGeoJSON(
        board,
        [...known].filter((id) => !labels.has(id) && board.nodes.has(id)),
      ),
    )

    for (const m of markersRef.current) m.remove()
    markersRef.current = [...labels.values()].map((label) => {
      const n = board.nodes.get(label.node)!
      const el = document.createElement(
        label.kind === 'candidate' ? 'button' : 'div',
      )
      el.className = `map-label map-label--${label.kind}`
      el.textContent =
        label.kind === 'current'
          ? `いまここ ${n.name}`
          : label.kind === 'goal'
            ? `🎯 ${n.name}`
            : n.name
      if (label.kind === 'candidate') {
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onChooseRef.current(label.node)
        })
      }
      return new Marker({ element: el, anchor: 'bottom', offset: [0, -6] })
        .setLngLat([n.lng, n.lat])
        .addTo(map)
    })
  }, [loaded, board, known, candidates, goal, current])

  // コマが画面の端（下はパネルに隠れる部分）に近づいたら、地図を動かす
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !follow) return
    const n = board.nodes.get(follow)!
    const p = map.project([n.lng, n.lat])
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    const inside =
      p.x > w * 0.15 && p.x < w * 0.85 && p.y > h * 0.15 && p.y < h * 0.6
    if (!inside) {
      map.easeTo({
        center: [n.lng, n.lat],
        offset: [0, -h * 0.12],
        duration: 350,
      })
    }
  }, [loaded, board, follow])

  // 指定された範囲が収まるように動かす。
  // focus の中身ではなく key が変わったときだけ動かす（操作中に勝手に動くと使いにくいため）
  const focusKey = focus?.key
  useEffect(() => {
    const map = mapRef.current
    const target = focusRef.current
    if (!map || !loaded || !target || target.points.length === 0) return
    const bounds = new LngLatBounds()
    for (const p of target.points) bounds.extend([p.lng, p.lat])
    map.fitBounds(bounds, {
      padding: { top: 90, bottom: 220, left: 50, right: 50 },
      maxZoom: target.maxZoom ?? 13.5,
      duration: 600,
    })
  }, [loaded, focusKey])

  return <div ref={containerRef} className="map-view" />
}
