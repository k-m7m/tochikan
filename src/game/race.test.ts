import { describe, expect, it } from 'vitest'
import {
  nextGoal,
  pickGoal,
  roll,
  showHint,
  startRace,
  step,
  stepOptions,
  type RaceSettings,
  type RaceState,
} from './race'
import { makeCrossBoard, makeTestBoard } from './testBoard'

// 決まった順に値を返す、テスト用の乱数
const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

const t = makeTestBoard({
  L: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
})
const settings: RaceSettings = { goals: 2, goalHops: { min: 3, max: 10 } }

/** 決まった位置と目的地から始める */
const stateAt = (
  tb: ReturnType<typeof makeTestBoard>,
  position: string,
  goal: string,
): RaceState => ({
  position: tb.node(position),
  goal: tb.node(goal),
  goalStartedAt: tb.node(position),
  goalStartedTurn: 0,
  reachedGoals: [],
  turns: 0,
  hintsUsed: 0,
  hintShown: false,
  phase: { kind: 'ready' },
})

/** 選べる方向のうち、名前の決まったマスへ進む */
const stepTo = (
  tb: ReturnType<typeof makeTestBoard>,
  state: RaceState,
  name: string,
) => step(state, tb.board, tb.node(name))

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

describe('1駅ずつ進む', () => {
  it('サイコロの目の数だけ進んで止まる', () => {
    let state = roll(stateAt(t, 'A', 'H'), 3)
    expect(state.phase).toMatchObject({ kind: 'moving', remaining: 3 })
    state = stepTo(t, state, 'B')
    state = stepTo(t, state, 'C')
    expect(state.phase).toMatchObject({ kind: 'moving', remaining: 1 })
    state = stepTo(t, state, 'D')
    expect(t.name(state.position)).toBe('D')
    expect(state.phase.kind).toBe('ready')
    expect(state.lastMove?.route.nodes.map(t.name)).toEqual(['B', 'C', 'D'])
    expect(state.turns).toBe(1)
  })

  it('進んでいる途中は、来た駅へ戻れない', () => {
    let state = roll(stateAt(t, 'C', 'H'), 3)
    expect(
      stepOptions(state, t.board)
        .map((o) => t.name(o.to))
        .sort(),
    ).toEqual(['B', 'D'])
    state = stepTo(t, state, 'D')
    expect(stepOptions(state, t.board).map((o) => t.name(o.to))).toEqual(['E'])
    // 来た駅（C）へは進めない
    expect(stepTo(t, state, 'C')).toBe(state)
  })

  it('分岐では、進む方向を選べる', () => {
    const cross = makeCrossBoard()
    let state = roll(stateAt(cross, 'P', 'S'), 2)
    state = stepTo(cross, state, 'X')
    expect(
      stepOptions(state, cross.board)
        .map((o) => cross.name(o.to))
        .sort(),
    ).toEqual(['Q', 'R', 'S'])
    state = stepTo(cross, state, 'R')
    expect(cross.name(state.position)).toBe('R')
    expect(state.lastMove?.route.lineIds).toEqual(['L1', 'L2'])
  })

  it('目的地を通るときは、目の数が残っていても目的地で止まる', () => {
    let state = roll(stateAt(t, 'A', 'C'), 6)
    state = stepTo(t, state, 'B')
    state = stepTo(t, state, 'C')
    expect(state.phase).toMatchObject({ kind: 'arrived', turnsForGoal: 1 })
    expect(state.reachedGoals).toEqual([t.node('C')])
  })

  it('終点で目が余ったら、終点で止まる', () => {
    let state = roll(stateAt(t, 'F', 'A'), 5)
    state = stepTo(t, state, 'G')
    state = stepTo(t, state, 'H')
    expect(t.name(state.position)).toBe('H')
    expect(state.phase.kind).toBe('ready')
  })

  it('都外の駅では止まらず、次の駅まで進む', () => {
    const tb = makeTestBoard({ L: ['A', 'B', 'C', 'D'] }, { outside: ['B'] })
    let state = roll(stateAt(tb, 'A', 'D'), 1)
    state = stepTo(tb, state, 'B')
    expect(state.phase).toMatchObject({ kind: 'moving', remaining: 1 })
    state = stepTo(tb, state, 'C')
    expect(tb.name(state.position)).toBe('C')
    expect(state.phase.kind).toBe('ready')
  })
})

describe('目的地レースの流れ', () => {
  it('目的地に着く → 次の目的地 → 規定の数を回ったら終わり', () => {
    // A から始まり、目的地は E になるように乱数を決める
    let state = startRace(t.board, settings, sequence(0, 0.25))
    expect(t.name(state.position)).toBe('A')
    expect(t.name(state.goal)).toBe('E')

    state = roll(state, 6)
    for (const name of ['B', 'C', 'D', 'E']) state = stepTo(t, state, name)
    expect(state.phase.kind).toBe('arrived')
    if (state.phase.kind === 'arrived') {
      expect(state.phase.shortest.nodes).toHaveLength(4)
    }

    state = nextGoal(state, t.board, settings, sequence(0))
    expect(state.phase.kind).toBe('ready')
    expect(state.goal).not.toBe(t.node('E'))

    // 2つ目の目的地まで進む
    const goal = state.goal
    while (state.phase.kind !== 'arrived') {
      if (state.phase.kind === 'ready') state = roll(state, 6)
      const options = stepOptions(state, t.board)
      const toward =
        t.name(goal) < t.name(state.position) ? options[0] : options.at(-1)!
      state = step(state, t.board, toward.to)
    }
    state = nextGoal(state, t.board, settings)
    expect(state.phase.kind).toBe('finished')
  })

  it('ヒントは目的地ごとに1回だけ数える', () => {
    let state = startRace(t.board, settings, sequence(0, 0.25))
    state = showHint(showHint(state))
    expect(state.hintsUsed).toBe(1)
  })
})
