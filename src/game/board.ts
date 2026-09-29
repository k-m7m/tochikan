// すごろくの盤面。駅データから、使う路線だけを取り出して作る。
// 乗換でつながっている駅（同じ駅グループ）は、1つのマスとして扱う。

import type { Line, LineId, RailData, StationId } from '../data/types'

export type NodeId = string

export interface BoardNode {
  id: NodeId
  name: string
  lat: number
  lng: number
  /** 都外の駅は「通過するだけのマス」で、止まれない（要件定義書 4.3） */
  inTokyo: boolean
  stationIds: StationId[]
  lineIds: LineId[]
}

export interface BoardLink {
  to: NodeId
  lineId: LineId
}

export interface Board {
  lines: Line[]
  nodes: Map<NodeId, BoardNode>
  /** マスから、線路でつながる隣のマス */
  links: Map<NodeId, BoardLink[]>
  /** 線路でつながる2マスの組（地図に線を引くため） */
  segments: { lineId: LineId; from: NodeId; to: NodeId }[]
  nodeOfStation: Map<StationId, NodeId>
}

export function buildBoard(data: RailData, lineIds: LineId[]): Board {
  const lineOrder = new Map(lineIds.map((id, i) => [id, i]))
  const lines = data.lines
    .filter((l) => lineOrder.has(l.id))
    .sort((a, b) => lineOrder.get(a.id)! - lineOrder.get(b.id)!)
  const stations = data.stations
    .filter((s) => lineOrder.has(s.lineId))
    .sort((a, b) => lineOrder.get(a.lineId)! - lineOrder.get(b.lineId)!)
  const stationIds = new Set(stations.map((s) => s.id))

  // 乗換でつながる駅をまとめる（union-find）
  const parent = new Map(stations.map((s) => [s.id, s.id]))
  const find = (id: string): string => {
    const p = parent.get(id)!
    if (p === id) return id
    const root = find(p)
    parent.set(id, root)
    return root
  }
  for (const t of data.transfers) {
    if (!stationIds.has(t.a) || !stationIds.has(t.b)) continue
    const ra = find(t.a)
    const rb = find(t.b)
    if (ra !== rb) parent.set(rb, ra)
  }

  const members = new Map<string, typeof stations>()
  for (const s of stations) {
    const root = find(s.id)
    members.set(root, [...(members.get(root) ?? []), s])
  }

  const nodes = new Map<NodeId, BoardNode>()
  const nodeOfStation = new Map<StationId, NodeId>()
  for (const [root, group] of members) {
    // 名前は、先に指定した路線の駅のものを使う
    const node: BoardNode = {
      id: root,
      name: group[0].name,
      lat: group.reduce((sum, s) => sum + s.lat, 0) / group.length,
      lng: group.reduce((sum, s) => sum + s.lng, 0) / group.length,
      inTokyo: group.every((s) => s.inTokyo),
      stationIds: group.map((s) => s.id),
      lineIds: [...new Set(group.map((s) => s.lineId))],
    }
    nodes.set(root, node)
    for (const s of group) nodeOfStation.set(s.id, root)
  }

  const links = new Map<NodeId, BoardLink[]>(
    [...nodes.keys()].map((id) => [id, []]),
  )
  const segments: Board['segments'] = []
  for (const e of data.edges) {
    if (!lineOrder.has(e.lineId)) continue
    const from = nodeOfStation.get(e.a)
    const to = nodeOfStation.get(e.b)
    if (!from || !to || from === to) continue
    links.get(from)!.push({ to, lineId: e.lineId })
    links.get(to)!.push({ to: from, lineId: e.lineId })
    segments.push({ lineId: e.lineId, from, to })
  }

  return { lines, nodes, links, segments, nodeOfStation }
}

export interface Route {
  /** 出発したマスを含まない、通ったマスの順 */
  nodes: NodeId[]
  /** それぞれの1駅に使った路線 */
  lineIds: LineId[]
}

/** 乗換の回数（路線が変わった回数） */
export function countTransfers(route: Route): number {
  let count = 0
  for (let i = 1; i < route.lineIds.length; i++) {
    if (route.lineIds[i] !== route.lineIds[i - 1]) count++
  }
  return count
}

/**
 * 2マスの間の最短の道順。駅数が最少のものの中から、乗換が最少のものを選ぶ。
 * 着けないときは undefined
 */
export function shortestPath(
  board: Board,
  from: NodeId,
  to: NodeId,
): Route | undefined {
  // 状態は「いるマス」と「乗っている路線」。費用は 駅数 × 1000 + 乗換の回数
  type State = { node: NodeId; lineId: LineId | null }
  const key = (st: State) => `${st.node}|${st.lineId}`
  const cost = new Map<string, number>([[key({ node: from, lineId: null }), 0]])
  const prev = new Map<string, State>()
  const queue: { st: State; cost: number }[] = [
    { st: { node: from, lineId: null }, cost: 0 },
  ]
  let best: State | undefined
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const { st, cost: c } = queue.shift()!
    if (c > (cost.get(key(st)) ?? Infinity)) continue
    if (st.node === to) {
      best = st
      break
    }
    for (const link of board.links.get(st.node) ?? []) {
      const next: State = { node: link.to, lineId: link.lineId }
      const transfer = st.lineId !== null && st.lineId !== link.lineId ? 1 : 0
      const nc = c + 1000 + transfer
      if (nc < (cost.get(key(next)) ?? Infinity)) {
        cost.set(key(next), nc)
        prev.set(key(next), st)
        queue.push({ st: next, cost: nc })
      }
    }
  }
  if (!best) return undefined
  const nodes: NodeId[] = []
  const lineIds: LineId[] = []
  for (let st: State = best; st.lineId !== null; st = prev.get(key(st))!) {
    nodes.unshift(st.node)
    lineIds.unshift(st.lineId)
  }
  return { nodes, lineIds }
}

/** from から各マスまでの最少の駅数 */
export function hopDistances(board: Board, from: NodeId): Map<NodeId, number> {
  const dist = new Map<NodeId, number>([[from, 0]])
  const queue = [from]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const link of board.links.get(cur) ?? []) {
      if (!dist.has(link.to)) {
        dist.set(link.to, dist.get(cur)! + 1)
        queue.push(link.to)
      }
    }
  }
  return dist
}

/**
 * 1つの路線を、分岐や終点で区切った駅の並びに分ける。
 * 地図の線に沿って路線名を書くため、短い区間ではなく長い線にまとめる。
 * 環状線は、始めと終わりが同じ駅の並びになる。
 */
export function lineChains(board: Board, lineId: LineId): NodeId[][] {
  const adjacent = new Map<NodeId, Set<NodeId>>()
  for (const s of board.segments) {
    if (s.lineId !== lineId) continue
    for (const [a, b] of [
      [s.from, s.to],
      [s.to, s.from],
    ]) {
      if (!adjacent.has(a)) adjacent.set(a, new Set())
      adjacent.get(a)!.add(b)
    }
  }
  const used = new Set<string>()
  const key = (a: NodeId, b: NodeId) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const walk = (start: NodeId, next: NodeId): NodeId[] => {
    const chain = [start]
    let prev = start
    let cur = next
    used.add(key(prev, cur))
    for (;;) {
      chain.push(cur)
      const around = adjacent.get(cur)!
      if (around.size !== 2) break
      const following = [...around].find(
        (n) => n !== prev && !used.has(key(cur, n)),
      )
      if (!following) break
      used.add(key(cur, following))
      prev = cur
      cur = following
    }
    return chain
  }

  const chains: NodeId[][] = []
  // 終点や分岐（つながりが2本でない駅）から歩き始める
  for (const [n, around] of adjacent) {
    if (around.size === 2) continue
    for (const m of around) if (!used.has(key(n, m))) chains.push(walk(n, m))
  }
  // 残りは環状線
  for (const [n, around] of adjacent) {
    for (const m of around) if (!used.has(key(n, m))) chains.push(walk(n, m))
  }
  return chains
}
