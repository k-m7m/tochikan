// 目的地レース（案A、#52）のルール。画面に依存しない処理だけを置く。

import type { Board, NodeId, Route } from './board'
import { hopDistances, shortestPath } from './board'
import { reachableNodes, type TransferRule } from './movement'

export interface RaceSettings {
  /** 回る目的地の数 */
  goals: number
  rule: TransferRule
  /** 目的地は、今いるマスから最短でこの駅数の範囲にあるものを選ぶ */
  goalHops: { min: number; max: number }
}

export const defaultRaceSettings: RaceSettings = {
  goals: 5,
  rule: 'anywhere',
  goalHops: { min: 6, max: 15 },
}

export type RacePhase =
  | { kind: 'ready' }
  | { kind: 'choosing'; dice: number; options: Map<NodeId, Route> }
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

/** サイコロを振り、行けるマスを出す */
export function roll(
  state: RaceState,
  board: Board,
  settings: RaceSettings,
  dice: number,
): RaceState {
  if (state.phase.kind !== 'ready') return state
  const options = reachableNodes(board, state.position, dice, {
    rule: settings.rule,
    canStopEarly: (node) => node === state.goal,
  })
  return {
    ...state,
    turns: state.turns + 1,
    phase: { kind: 'choosing', dice, options },
  }
}

/** 行き先を選んで進む */
export function choose(
  state: RaceState,
  board: Board,
  node: NodeId,
): RaceState {
  if (state.phase.kind !== 'choosing') return state
  const route = state.phase.options.get(node)
  if (!route) return state
  const lastMove = { from: state.position, route }
  if (node !== state.goal) {
    return { ...state, position: node, lastMove, phase: { kind: 'ready' } }
  }
  return {
    ...state,
    position: node,
    lastMove,
    reachedGoals: [...state.reachedGoals, node],
    phase: {
      kind: 'arrived',
      shortest: shortestPath(board, state.goalStartedAt, node)!,
      turnsForGoal: state.turns - state.goalStartedTurn,
    },
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
