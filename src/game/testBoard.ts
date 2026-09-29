// テスト用の小さな盤面を作る
import type { RailData } from '../data/types'
import { buildBoard } from './board'

/**
 * 路線ごとに駅名を並べて盤面を作る。同じ名前の駅は乗換でつなぐ。
 * - outside に入れた駅名は都外の駅になる
 * - positions で駅の位置（東へ x、北へ y。単位は0.01度）を決められる。
 *   決めない駅は、路線の中の順番を x、0 を y にする
 */
export function makeTestBoard(
  lines: Record<string, string[]>,
  {
    outside = [],
    positions = {},
  }: { outside?: string[]; positions?: Record<string, [number, number]> } = {},
) {
  const data: RailData = { lines: [], stations: [], edges: [], transfers: [] }
  Object.entries(lines).forEach(([lineId, names]) => {
    data.lines.push({
      id: lineId,
      name: lineId,
      operator: 'テスト',
      color: '#000',
    })
    names.forEach((name, i) => {
      const [x, y] = positions[name] ?? [i, 0]
      data.stations.push({
        id: `${lineId}-${name}`,
        lineId,
        name,
        kana: '',
        lat: 35.6 + y * 0.01,
        lng: 139.7 + x * 0.01,
        municipality: '千代田区',
        inTokyo: !outside.includes(name),
      })
      if (i > 0) {
        data.edges.push({
          lineId,
          a: `${lineId}-${names[i - 1]}`,
          b: `${lineId}-${name}`,
        })
      }
    })
  })
  for (const a of data.stations) {
    for (const b of data.stations) {
      if (a.id < b.id && a.name === b.name && a.lineId !== b.lineId) {
        data.transfers.push({ a: a.id, b: b.id })
      }
    }
  }
  const board = buildBoard(
    data,
    data.lines.map((l) => l.id),
  )
  const node = (name: string) =>
    [...board.nodes.values()].find((n) => n.name === name)!.id
  const name = (id: string) => board.nodes.get(id)!.name
  return { board, node, name }
}

/** 1線（P-X-Q、西から東）と2線（R-X-S、南から北）が X で十字に交わる盤面 */
export function makeCrossBoard() {
  return makeTestBoard(
    { L1: ['P', 'X', 'Q'], L2: ['R', 'X', 'S'] },
    { positions: { P: [0, 1], X: [1, 1], Q: [2, 1], R: [1, 0], S: [1, 2] } },
  )
}
