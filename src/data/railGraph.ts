import type { Line, LineId, RailData, Station, StationId } from './types.ts'

export interface RailGraph {
  data: RailData
  lines: Map<LineId, Line>
  stations: Map<StationId, Station>
  /** 同じ路線で隣り合う駅 */
  neighbors: Map<StationId, StationId[]>
}

export function buildRailGraph(data: RailData): RailGraph {
  const lines = new Map(data.lines.map((l) => [l.id, l]))
  const stations = new Map(data.stations.map((s) => [s.id, s]))
  const neighbors = new Map<StationId, StationId[]>(
    data.stations.map((s) => [s.id, []]),
  )
  for (const e of data.edges) {
    neighbors.get(e.a)?.push(e.b)
    neighbors.get(e.b)?.push(e.a)
  }
  return { data, lines, stations, neighbors }
}

/** データの矛盾を探す。問題がなければ空の配列を返す。 */
export function validateRailData(data: RailData): string[] {
  const errors: string[] = []
  const lineIds = new Set(data.lines.map((l) => l.id))
  const stationIds = new Set<StationId>()
  for (const s of data.stations) {
    if (stationIds.has(s.id)) errors.push(`駅IDが重複している: ${s.id}`)
    stationIds.add(s.id)
    if (!lineIds.has(s.lineId))
      errors.push(`駅 ${s.id} の路線 ${s.lineId} がない`)
    if (!(s.lat > 20 && s.lat < 46 && s.lng > 122 && s.lng < 154))
      errors.push(`駅 ${s.id} の緯度経度が日本の範囲外`)
  }
  const stationLine = new Map(data.stations.map((s) => [s.id, s.lineId]))
  for (const e of data.edges) {
    for (const id of [e.a, e.b]) {
      if (!stationIds.has(id)) errors.push(`つながりの駅 ${id} がない`)
      else if (stationLine.get(id) !== e.lineId)
        errors.push(`駅 ${id} は路線 ${e.lineId} の駅ではない`)
    }
    if (e.a === e.b) errors.push(`駅 ${e.a} が自分自身とつながっている`)
  }
  for (const t of data.transfers) {
    for (const id of [t.a, t.b])
      if (!stationIds.has(id)) errors.push(`乗換の駅 ${id} がない`)
  }
  const degree = new Map<StationId, number>()
  for (const e of data.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1)
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1)
  }
  for (const id of stationIds)
    if (!degree.get(id)) errors.push(`駅 ${id} に隣の駅がない`)
  return errors
}
