import { describe, expect, it } from 'vitest'
import { countTransfers } from './board'
import { reachableNodes, type TransferRule } from './movement'
import { makeTestBoard } from './testBoard'

const names = (
  t: ReturnType<typeof makeTestBoard>,
  from: string,
  steps: number,
  rule: TransferRule = 'anywhere',
  stopEarly: string[] = [],
) =>
  [
    ...reachableNodes(t.board, t.node(from), steps, {
      rule,
      canStopEarly: (n) => stopEarly.includes(t.name(n)),
    }).keys(),
  ]
    .map(t.name)
    .sort()

describe('reachableNodes', () => {
  const line = makeTestBoard({ L: ['A', 'B', 'C', 'D', 'E'] })

  it('ちょうど目の数だけ進んだマスに止まれる', () => {
    expect(names(line, 'A', 2)).toEqual(['C'])
  })

  it('来たマスへすぐ戻らない', () => {
    expect(names(line, 'C', 2)).toEqual(['A', 'E'])
  })

  it('1回の移動で輪を回って同じマスを2度通らない', () => {
    // A-B-C-D-A が輪になっていて、D から E が出ている
    const ring = makeTestBoard({
      L1: ['A', 'B', 'C', 'D'],
      L2: ['D', 'A'],
      L3: ['D', 'E'],
    })
    // A から4駅：A に戻って輪を回ることはしない。
    // A→B→C→D→E、A→D→E（行き止まり）、A→D→C→B（この先は通ったマスだけなので止まる）
    expect(names(ring, 'A', 4)).toEqual(['B', 'E'])
  })

  it('終点で目が余ったら、終点で止まる', () => {
    expect(names(line, 'D', 3)).toEqual(['A', 'E'])
  })

  it('目的地などは、目の数に満たなくても止まれる', () => {
    expect(names(line, 'D', 3, 'anywhere', ['B'])).toEqual(['A', 'B', 'E'])
  })

  it('都外のマスは通過できるが、止まれない', () => {
    const t = makeTestBoard({ L: ['A', 'B', 'C', 'D'] }, ['B'])
    expect(names(t, 'A', 1)).toEqual([])
    expect(names(t, 'A', 2)).toEqual(['C'])
  })

  describe('乗換のルール', () => {
    // 1線（P-X-Q）と2線（R-X-S）が X で交わる
    const cross = makeTestBoard({ L1: ['P', 'X', 'Q'], L2: ['R', 'X', 'S'] })

    it('通過中も乗り換えられるルールでは、X で別の路線に移れる', () => {
      expect(names(cross, 'P', 2, 'anywhere')).toEqual(['Q', 'R', 'S'])
    })

    it('止まった駅でだけ乗り換えられるルールでは、同じ路線を進む', () => {
      expect(names(cross, 'P', 2, 'onlyWhenStopped')).toEqual(['Q'])
    })

    it('乗換駅に止まっているときは、どの路線にも乗れる', () => {
      expect(names(cross, 'X', 1, 'onlyWhenStopped')).toEqual([
        'P',
        'Q',
        'R',
        'S',
      ])
    })
  })

  it('同じマスへの道順が複数あるときは、乗換が少ないものを選ぶ', () => {
    // 同じ区間を2つの路線が並んで走る
    const t = makeTestBoard({
      L1: ['A', 'B', 'C', 'D'],
      L2: ['A', 'B', 'C', 'D'],
    })
    const route = reachableNodes(t.board, t.node('A'), 3, {
      rule: 'anywhere',
    }).get(t.node('D'))!
    expect(countTransfers(route)).toBe(0)
  })
})
