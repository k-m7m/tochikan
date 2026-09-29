import { describe, expect, it } from 'vitest'
import rail from '../data/generated/rail.json'
import type { RailData } from '../data/types'
import { buildBoard } from './board'
import { BEGINNER_LINES } from './lines'
import { lineForStep, nextSteps } from './movement'
import { makeCrossBoard, makeTestBoard } from './testBoard'

describe('nextSteps', () => {
  const line = makeTestBoard({ L: ['A', 'B', 'C'] })

  it('隣のマスへ進める', () => {
    expect(
      nextSteps(line.board, line.node('B')).map((o) => line.name(o.to)),
    ).toEqual(['A', 'C'])
  })

  it('来たマスへすぐ戻らない', () => {
    expect(
      nextSteps(line.board, line.node('B'), line.node('A')).map((o) =>
        line.name(o.to),
      ),
    ).toEqual(['C'])
  })

  it('終点では、来た方向以外に進めない', () => {
    expect(nextSteps(line.board, line.node('C'), line.node('B'))).toEqual([])
  })

  it('乗換駅では、別の路線の方向にも進める', () => {
    const cross = makeCrossBoard()
    expect(
      nextSteps(cross.board, cross.node('X'), cross.node('P'))
        .map((o) => cross.name(o.to))
        .sort(),
    ).toEqual(['Q', 'R', 'S'])
  })

  it('並んで走る別の路線に乗り換えて、来た方向へ戻ることはできない', () => {
    // 1線は A→B→C と東へ進み、2線は C から A の近くの D へ戻る
    const t = makeTestBoard(
      { L1: ['A', 'B', 'C'], L2: ['C', 'D'] },
      { positions: { A: [0, 0], B: [1, 0], C: [2, 0], D: [0.5, 0.3] } },
    )
    expect(nextSteps(t.board, t.node('C'), t.node('B'))).toEqual([])
    // 出発するときは、どちらへも進める
    expect(
      nextSteps(t.board, t.node('C'))
        .map((o) => t.name(o.to))
        .sort(),
    ).toEqual(['B', 'D'])
  })

  it('同じ隣のマスへ複数の路線で行けるときは、1つの選択肢にまとめる', () => {
    const parallel = makeTestBoard({ L1: ['A', 'B'], L2: ['A', 'B'] })
    expect(nextSteps(parallel.board, parallel.node('A'))).toEqual([
      { to: parallel.node('B'), lineIds: ['L1', 'L2'] },
    ])
  })
})

describe('lineForStep', () => {
  it('今乗っている路線で行けるなら、乗り換えない', () => {
    expect(lineForStep({ to: 'x', lineIds: ['L1', 'L2'] }, 'L2')).toBe('L2')
  })

  it('今の路線で行けないときは、行ける路線に乗り換える', () => {
    expect(lineForStep({ to: 'x', lineIds: ['L1'] }, 'L2')).toBe('L1')
  })
})

describe('初級の盤面（実データ）での後戻り', () => {
  const board = buildBoard(rail as RailData, BEGINNER_LINES)
  const id = (name: string) =>
    [...board.nodes.values()].find((n) => n.name === name)!.id
  const nexts = (at: string, from: string) =>
    nextSteps(board, id(at), id(from)).map((o) => board.nodes.get(o.to)!.name)

  it('新大久保から新宿に来たら、埼京線で池袋へは戻らない', () => {
    expect(nexts('新宿', '新大久保')).not.toContain('池袋')
    expect(nexts('新宿', '新大久保')).toContain('代々木')
  })

  it('原宿から渋谷に来たら、埼京線で新宿へは戻らない', () => {
    expect(nexts('渋谷', '原宿')).not.toContain('新宿')
    expect(nexts('渋谷', '原宿')).toContain('恵比寿')
  })

  it('鶯谷から日暮里に来たら、常磐線で上野へは戻らない', () => {
    expect(nexts('日暮里', '鶯谷')).not.toContain('上野')
    expect(nexts('日暮里', '鶯谷')).toContain('三河島')
  })
})
