// 駅データ.jp の元データを、アプリで使う RailData に変換する（要件定義書 4章、7.1、12.2）。

import type {
  Edge,
  Line,
  RailData,
  Station,
  Transfer,
} from '../../src/data/types.ts'
import {
  EXCLUDED_LINES,
  FALLBACK_COLORS,
  TOKYO_MUNICIPALITIES,
} from './config.ts'

type Row = Record<string, string>

export interface EkidataInput {
  companies: Row[]
  lines: Row[]
  stations: Row[]
  joins: Row[]
}

const TOKYO_PREF_CD = '13'
/** e_status が 0 のものが営業中 */
const ACTIVE = '0'

const PREFECTURES: Record<string, string> = {
  '8': '茨城県',
  '9': '栃木県',
  '10': '群馬県',
  '11': '埼玉県',
  '12': '千葉県',
  '13': '東京都',
  '14': '神奈川県',
  '19': '山梨県',
}

// 長い名前から順に照合する（「東村山市」を「東村」などと取り違えないため）
const municipalitiesLongestFirst = [...TOKYO_MUNICIPALITIES].sort(
  (a, b) => b.length - a.length,
)

/** 東京都内の住所から区市町村を取り出す。見つからなければ undefined */
export function tokyoMunicipality(address: string): string | undefined {
  const rest = address.replace(/^東京都/, '').replace(/^西多摩郡/, '')
  return municipalitiesLongestFirst.find((m) => rest.startsWith(m))
}

/**
 * 1つの路線について、都外の駅のうち「都内の駅と都内の駅の間にある駅」だけを残す（4.1、4.3）。
 * 1. 都外の駅のかたまりのうち、つながる都内の駅が1駅以下のものを取り除く。
 *    都県境の外へ伸びる部分が消える（外で輪になっている区間も消える）
 * 2. 残った都外の駅で、つながりが1本以下のもの（行き止まり）を繰り返し取り除く。
 *    いったん都外に出て戻る区間から、枝分かれして外へ伸びる部分が消える
 */
export function trimOutsideTokyo(
  stationIds: string[],
  edges: [string, string][],
  inTokyo: (id: string) => boolean,
): { stationIds: string[]; edges: [string, string][] } {
  const alive = new Set(stationIds)
  const neighbors = new Map<string, Set<string>>(
    stationIds.map((id) => [id, new Set()]),
  )
  for (const [a, b] of edges) {
    neighbors.get(a)?.add(b)
    neighbors.get(b)?.add(a)
  }

  function removeStation(id: string) {
    alive.delete(id)
    for (const n of neighbors.get(id)!) neighbors.get(n)!.delete(id)
    neighbors.get(id)!.clear()
  }

  // 1. 都外の駅のかたまりごとに、つながる都内の駅を数える
  const visited = new Set<string>()
  for (const start of stationIds) {
    if (inTokyo(start) || visited.has(start)) continue
    const component: string[] = []
    const tokyoNeighbors = new Set<string>()
    const stack = [start]
    visited.add(start)
    while (stack.length > 0) {
      const id = stack.pop()!
      component.push(id)
      for (const n of neighbors.get(id)!) {
        if (inTokyo(n)) {
          tokyoNeighbors.add(n)
        } else if (!visited.has(n)) {
          visited.add(n)
          stack.push(n)
        }
      }
    }
    if (tokyoNeighbors.size < 2) {
      for (const id of component) removeStation(id)
    }
  }

  // 2. 行き止まりになった都外の駅を取り除く
  const queue = stationIds.filter(
    (id) => alive.has(id) && !inTokyo(id) && neighbors.get(id)!.size <= 1,
  )
  while (queue.length > 0) {
    const id = queue.pop()!
    if (!alive.has(id)) continue
    const next = [...neighbors.get(id)!]
    removeStation(id)
    for (const n of next) {
      if (alive.has(n) && !inTokyo(n) && neighbors.get(n)!.size <= 1) {
        queue.push(n)
      }
    }
  }
  return {
    stationIds: stationIds.filter((id) => alive.has(id)),
    edges: edges.filter(([a, b]) => alive.has(a) && alive.has(b)),
  }
}

export interface ConvertResult {
  data: RailData
  /** 取り除いた路線と、その理由 */
  skippedLines: { lineCd: string; name: string; reason: string }[]
}

export function convertEkidata(input: EkidataInput): ConvertResult {
  const companyName = new Map(
    input.companies.map((c) => [c.company_cd, c.company_name]),
  )
  const stationRows = input.stations.filter((s) => s.e_status === ACTIVE)
  const stationByCd = new Map(stationRows.map((s) => [s.station_cd, s]))
  const isTokyo = (cd: string) => stationByCd.get(cd)?.pref_cd === TOKYO_PREF_CD

  const lineRows = input.lines
    .filter((l) => l.e_status === ACTIVE)
    .sort((a, b) => Number(a.e_sort) - Number(b.e_sort))

  const lines: Line[] = []
  const stations: Station[] = []
  const edges: Edge[] = []
  const skippedLines: ConvertResult['skippedLines'] = []

  for (const l of lineRows) {
    const lineStations = stationRows.filter((s) => s.line_cd === l.line_cd)
    if (!lineStations.some((s) => s.pref_cd === TOKYO_PREF_CD)) continue

    const excludedReason = EXCLUDED_LINES[l.line_cd]
    if (excludedReason) {
      skippedLines.push({
        lineCd: l.line_cd,
        name: l.line_name,
        reason: excludedReason,
      })
      continue
    }

    const lineEdges = input.joins
      .filter((j) => j.line_cd === l.line_cd)
      .filter(
        (j) => stationByCd.has(j.station_cd1) && stationByCd.has(j.station_cd2),
      )
      .map((j) => [j.station_cd1, j.station_cd2] as [string, string])

    const trimmed = trimOutsideTokyo(
      lineStations.map((s) => s.station_cd),
      lineEdges,
      isTokyo,
    )
    const tokyoCount = trimmed.stationIds.filter(isTokyo).length
    if (tokyoCount < 2) {
      skippedLines.push({
        lineCd: l.line_cd,
        name: l.line_name,
        reason: `都内の駅が${tokyoCount}駅しかない`,
      })
      continue
    }

    const color = l.line_color_c
      ? `#${l.line_color_c.replace(/^#/, '')}`
      : FALLBACK_COLORS[lines.length % FALLBACK_COLORS.length]
    lines.push({
      id: l.line_cd,
      name: l.line_name,
      operator: companyName.get(l.company_cd) ?? '',
      color,
    })

    for (const cd of trimmed.stationIds) {
      const s = stationByCd.get(cd)!
      const inTokyo = s.pref_cd === TOKYO_PREF_CD
      stations.push({
        id: cd,
        lineId: l.line_cd,
        name: s.station_name,
        // 無料データには読みが入っていない。入手方法は #20 で決める
        kana: s.station_name_k,
        lat: Number(s.lat),
        lng: Number(s.lon),
        municipality: inTokyo
          ? (tokyoMunicipality(s.address) ?? '')
          : (PREFECTURES[s.pref_cd] ?? ''),
        inTokyo,
      })
    }
    for (const [a, b] of trimmed.edges) {
      edges.push({ lineId: l.line_cd, a, b })
    }
  }

  const groupOf = (id: string) => stationByCd.get(id)!.station_g_cd
  return {
    data: {
      lines,
      stations,
      edges,
      transfers: buildTransfers(stations, groupOf),
    },
    skippedLines,
  }
}

/**
 * 同じ駅グループ（駅データ.jp の station_g_cd）の駅どうしを乗換でつなぐ。
 * グループには「有楽町」と「日比谷」のように名前が違う駅も入っている。
 * 都外の駅は止まらないので、乗換の対象にしない。
 */
function buildTransfers(
  stations: Station[],
  groupOf: (id: string) => string,
): Transfer[] {
  const groups = new Map<string, Station[]>()
  for (const s of stations) {
    if (!s.inTokyo) continue
    const g = groupOf(s.id)
    groups.set(g, [...(groups.get(g) ?? []), s])
  }
  const transfers: Transfer[] = []
  for (const members of groups.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (members[i].lineId !== members[j].lineId) {
          transfers.push({ a: members[i].id, b: members[j].id })
        }
      }
    }
  }
  return transfers
}
