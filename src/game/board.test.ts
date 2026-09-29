import { describe, expect, it } from 'vitest'
import rail from '../data/generated/rail.json'
import type { RailData } from '../data/types'
import {
  buildBoard,
  countTransfers,
  hopDistances,
  lineChains,
  shortestPath,
} from './board'
import { BEGINNER_LINES } from './lines'
import { makeTestBoard } from './testBoard'

describe('buildBoard', () => {
  it('乗換でつながる駅を1つのマスにまとめる', () => {
    const t = makeTestBoard({ L1: ['P', 'X', 'Q'], L2: ['R', 'X', 'S'] })
    expect(t.board.nodes.size).toBe(5)
    expect(t.board.nodes.get(t.node('X'))!.lineIds.sort()).toEqual(['L1', 'L2'])
  })
})

describe('初級の盤面（実データ）', () => {
  const board = buildBoard(rail as RailData, BEGINNER_LINES)
  const node = (name: string) =>
    [...board.nodes.values()].find((n) => n.name === name)!.id

  it('東京駅は、山手線・中央線快速・京浜東北線・京葉線・総武本線が乗り入れる1つのマス', () => {
    const tokyo = board.nodes.get(node('東京'))!
    for (const lineId of ['11302', '11312', '11332', '11326', '11314']) {
      expect(tokyo.lineIds).toContain(lineId)
    }
  })

  it('初級の路線の駅は、すべて都内にある', () => {
    expect([...board.nodes.values()].every((n) => n.inTokyo)).toBe(true)
  })

  it('すべてのマスが、東京駅から線路でつながっている', () => {
    expect(hopDistances(board, node('東京')).size).toBe(board.nodes.size)
  })

  it('東京から吉祥寺への最短ルートは、中央線快速だけで行ける', () => {
    const route = shortestPath(board, node('東京'), node('吉祥寺'))!
    expect(route.nodes.map((id) => board.nodes.get(id)!.name).at(-1)).toBe(
      '吉祥寺',
    )
    expect(countTransfers(route)).toBe(0)
  })
})

describe('lineChains', () => {
  it('一本道の路線は、1本の並びになる', () => {
    const t = makeTestBoard({ L: ['A', 'B', 'C', 'D'] })
    const chains = lineChains(t.board, 'L')
    expect(chains).toHaveLength(1)
    expect(chains[0].map(t.name)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('環状線は、始めと終わりが同じ駅の1本の並びになる', () => {
    const board = buildBoard(rail as RailData, BEGINNER_LINES)
    const chains = lineChains(board, '11302') // 山手線
    expect(chains).toHaveLength(1)
    expect(chains[0]).toHaveLength(31)
    expect(chains[0][0]).toBe(chains[0][30])
  })
})
