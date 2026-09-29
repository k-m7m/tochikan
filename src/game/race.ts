// 目的地レース（案A、#52）のルール。画面に依存しない処理だけを置く。

import type { Board, NodeId, Route } from './board'
import { hopDistances, shortestPath } from './board'
import { lineForStep, nextSteps, type StepOption } from './movement'

export interface RaceSettings {
  /** 回る目的地の数 */
  goals: number
  /** 目的地は、今いるマスから最短でこの駅数の範囲にあるものを選ぶ */
  goalHops: { min: number; max: number }
}

export const defaultRaceSettings: RaceSettings = {
  goals: 5,
  goalHops: { min: 6, max: 15 },
}

export type RacePhase =
  | { kind: 'ready' }
  | {
      /** サイコロの目の数だけ、1駅ずつ進んでいる途中 */
      kind: 'moving'
      dice: number
      /** 残りの駅数 */
      remaining: number
      /** このターンに出発したマス */
      from: NodeId
      /** このターンに進んだ道順 */
      route: Route
      /** 直前にいたマス（すぐ戻らないため） */
      cameFrom?: NodeId
    }
  | { kind: 'arrived'; shortest: Route; turnsForGoal: number }
  | { kind: 'finished' }

export interface RaceState {
  position: NodeId
  goal: NodeId
  /** 今の目的地が決まったときにいたマス（最短ルートの表示に使う） */
  goalStartedAt: NodeId
  goalStartedTurn: number
  reachedGoals: NodeId[]
  turns: number
  hintsUsed: number
  /** 今の目的地でヒントを見たか */
  hintShown: boolean
  /** 直前に進んだ道順（地図に描くため） */
  lastMove?: { from: NodeId; route: Route }
  phase: RacePhase
}

type Random = () => number

/** 目的地を選ぶ。都内のマスのうち、今いるマスから最短で hops の範囲の駅数にあるものを選ぶ */
export function pickGoal(
  board: Board,
  from: NodeId,
  hops: { min: number; max: number },
  random: Random = Math.random,
  exclude: NodeId[] = [],
): NodeId {
  const dist = hopDistances(board, from)
  const candidates = [...board.nodes.values()].filter((n) => {
    const d = dist.get(n.id)
    return (
      n.inTokyo &&
      !exclude.includes(n.id) &&
      d !== undefined &&
      d >= hops.min &&
      d <= hops.max
    )
  })
  if (candidates.length === 0) throw new Error('目的地の候補がない')
  return candidates[Math.floor(random() * candidates.length)].id
}

export function startRace(
  board: Board,
  settings: RaceSettings,
  random: Random = Math.random,
): RaceState {
  const tokyoNodes = [...board.nodes.values()].filter((n) => n.inTokyo)
  const start = tokyoNodes[Math.floor(random() * tokyoNodes.length)].id
  return {
    position: start,
    goal: pickGoal(board, start, settings.goalHops, random),
    goalStartedAt: start,
    goalStartedTurn: 0,
    reachedGoals: [],
    turns: 0,
    hintsUsed: 0,
    hintShown: false,
    phase: { kind: 'ready' },
  }
}

/** サイコロを振る。このあと step で1駅ずつ進む */
export function roll(state: RaceState, dice: number): RaceState {
  if (state.phase.kind !== 'ready') return state
  return {
    ...state,
    turns: state.turns + 1,
    phase: {
      kind: 'moving',
      dice,
      remaining: dice,
      from: state.position,
      route: { nodes: [], lineIds: [] },
    },
  }
}

/** 次に進める1駅。進んでいる途中でなければ空 */
export function stepOptions(state: RaceState, board: Board): StepOption[] {
  if (state.phase.kind !== 'moving') return []
  return nextSteps(board, state.position, state.phase.cameFrom)
}

/**
 * 1駅進む。
 * - 目的地を通るときは、目の数が残っていても目的地で止まる
 * - 目の数を使い切ったら止まる。ただし都外の駅では止まれないので、次の駅まで進む
 * - 終点などで先へ進めなくなったら、目の数が残っていてもそこで止まる
 */
export function step(state: RaceState, board: Board, to: NodeId): RaceState {
  const { phase } = state
  if (phase.kind !== 'moving') return state
  const option = stepOptions(state, board).find((o) => o.to === to)
  if (!option) return state

  const route: Route = {
    nodes: [...phase.route.nodes, to],
    lineIds: [
      ...phase.route.lineIds,
      lineForStep(option, phase.route.lineIds.at(-1)),
    ],
  }
  const lastMove = { from: phase.from, route }

  if (to === state.goal) {
    return {
      ...state,
      position: to,
      lastMove,
      reachedGoals: [...state.reachedGoals, to],
      phase: {
        kind: 'arrived',
        shortest: shortestPath(board, state.goalStartedAt, to)!,
        turnsForGoal: state.turns - state.goalStartedTurn,
      },
    }
  }

  let remaining = phase.remaining - 1
  if (remaining === 0 && !board.nodes.get(to)!.inTokyo) remaining = 1
  const deadEnd = nextSteps(board, to, state.position).length === 0
  if (remaining === 0 || deadEnd) {
    return { ...state, position: to, lastMove, phase: { kind: 'ready' } }
  }
  return {
    ...state,
    position: to,
    lastMove,
    phase: { ...phase, remaining, route, cameFrom: state.position },
  }
}

/** 目的地に着いたあと、次の目的地へ。規定の数を回ったら終わり */
export function nextGoal(
  state: RaceState,
  board: Board,
  settings: RaceSettings,
  random: Random = Math.random,
): RaceState {
  if (state.phase.kind !== 'arrived') return state
  if (state.reachedGoals.length >= settings.goals) {
    return { ...state, phase: { kind: 'finished' } }
  }
  return {
    ...state,
    goal: pickGoal(
      board,
      state.position,
      settings.goalHops,
      random,
      state.reachedGoals,
    ),
    goalStartedAt: state.position,
    goalStartedTurn: state.turns,
    hintShown: false,
    phase: { kind: 'ready' },
  }
}

/** ヒント（目的地の方角と距離）を見る */
export function showHint(state: RaceState): RaceState {
  if (state.hintShown) return state
  return { ...state, hintShown: true, hintsUsed: state.hintsUsed + 1 }
}
