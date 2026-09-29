// テスト用の小さな盤面を作る
import type { RailData } from '../data/types'
import { buildBoard } from './board'

/**
 * 路線ごとに駅名を並べて盤面を作る。同じ名前の駅は乗換でつなぐ。
 * outside に入れた駅名は都外の駅になる。
 */
export function makeTestBoard(
  lines: Record<string, string[]>,
  outside: string[] = [],
) {
  const data: RailData = { lines: [], stations: [], edges: [], transfers: [] }
  Object.entries(lines).forEach(([lineId, names], li) => {
    data.lines.push({
      id: lineId,
      name: lineId,
      operator: 'テスト',
      color: '#000',
    })
    names.forEach((name, i) => {
      data.stations.push({
        id: `${lineId}-${name}`,
        lineId,
        name,
        kana: '',
        lat: 35.6 + li * 0.01,
        lng: 139.7 + i * 0.01,
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
