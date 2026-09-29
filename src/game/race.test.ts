import { describe, expect, it } from 'vitest'
import {
  choose,
  nextGoal,
  pickGoal,
  roll,
  showHint,
  startRace,
  type RaceSettings,
} from './race'
import { makeTestBoard } from './testBoard'

// 決まった順に値を返す、テスト用の乱数
const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

const t = makeTestBoard({
  L: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
})
const settings: RaceSettings = {
  goals: 2,
  rule: 'anywhere',
  goalHops: { min: 3, max: 10 },
}

describe('pickGoal', () => {
  it('今いるマスから、指定した範囲の駅数だけ離れたマスを選ぶ', () => {
    for (let i = 0; i < 20; i++) {
      const goal = pickGoal(t.board, t.node('A'), { min: 3, max: 4 })
      expect(['D', 'E']).toContain(t.name(goal))
    }
  })

  it('すでに着いた目的地は選ばない', () => {
    const goal = pickGoal(
      t.board,
      t.node('A'),
      { min: 6, max: 10 },
      Math.random,
      [t.node('G')],
    )
    expect(t.name(goal)).toBe('H')
  })
})

describe('目的地レースの流れ', () => {
  it('サイコロ → 行き先を選ぶ → 目的地に着く → 次の目的地 → 終わり', () => {
    // A から始まり、目的地は E になるように乱数を決める
    let state = startRace(t.board, settings, sequence(0, 0.25))
    expect(t.name(state.position)).toBe('A')
    expect(t.name(state.goal)).toBe('E')

    // 3の目：D に進む
    state = roll(state, t.board, settings, 3)
    expect(state.phase.kind).toBe('choosing')
    state = choose(state, t.board, t.node('D'))
    expect(t.name(state.position)).toBe('D')
    expect(state.phase.kind).toBe('ready')

    // 5の目：目的地 E を通り過ぎる目でも、E に止まれる
    state = roll(state, t.board, settings, 5)
    state = choose(state, t.board, t.node('E'))
    expect(state.phase).toMatchObject({ kind: 'arrived', turnsForGoal: 2 })
    if (state.phase.kind === 'arrived') {
      expect(state.phase.shortest.nodes).toHaveLength(4)
    }

    state = nextGoal(state, t.board, settings, sequence(0))
    expect(state.phase.kind).toBe('ready')
    expect(state.goal).not.toBe(t.node('E'))

    // 2つ目の目的地に着いたら終わり
    state = roll(state, t.board, settings, 6)
    const options = state.phase.kind === 'choosing' ? state.phase.options : null
    expect(options?.has(state.goal)).toBe(true)
    state = choose(state, t.board, state.goal)
    state = nextGoal(state, t.board, settings)
    expect(state.phase.kind).toBe('finished')
    expect(state.turns).toBe(3)
  })

  it('ヒントは目的地ごとに1回だけ数える', () => {
    let state = startRace(t.board, settings, sequence(0, 0.25))
    state = showHint(showHint(state))
    expect(state.hintsUsed).toBe(1)
  })
})
