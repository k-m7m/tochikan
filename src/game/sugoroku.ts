// すごろくのルール（試作版）。
// 未決事項（要件定義書 FR-01）は仮の扱いにしていて、#25 で本決めする。

import type { RailGraph } from '../data/railGraph'
import type { StationId } from '../data/types'
import { distanceMeters, type LatLng } from '../lib/geo'

export interface WalkResult {
  /** 出発駅を含まない、通った駅の順 */
  path: StationId[]
  /** 止まる駅 */
  stop: StationId
  /** ゴール駅に着いたか */
  reachedGoal: boolean
}

/**
 * 出発駅から、最初の1歩を firstStep に進め、そのまま同じ向きに steps 駅進む。
 * 仮の扱い：
 * - ゴール駅を通り過ぎる場合は、ゴール駅で止まる
 * - 終点や分岐で進めなくなったら、そこで止まる（分岐と終点は #27 で扱う）
 */
export function walk(
  graph: RailGraph,
  from: StationId,
  firstStep: StationId,
  steps: number,
  goal?: StationId,
): WalkResult {
  if (!graph.neighbors.get(from)?.includes(firstStep)) {
    throw new Error(`${firstStep} は ${from} の隣の駅ではない`)
  }
  const path: StationId[] = []
  let prev = from
  let cur = firstStep
  for (let i = 0; i < steps; i++) {
    path.push(cur)
    if (cur === goal) break
    if (i === steps - 1) break
    const nexts = graph.neighbors.get(cur)!.filter((n) => n !== prev)
    if (nexts.length !== 1) break
    prev = cur
    cur = nexts[0]
  }
  const stop = path[path.length - 1]
  return { path, stop, reachedGoal: stop === goal }
}

/** 出発駅から進める向き（最初の1歩の駅）の一覧 */
export function directions(graph: RailGraph, from: StationId): StationId[] {
  return graph.neighbors.get(from) ?? []
}

export function rollDice(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 6)
}

/** 2駅の間の、線路上の駅数（最短） */
export function hopDistance(
  graph: RailGraph,
  from: StationId,
  to: StationId,
): number {
  const dist = new Map<StationId, number>([[from, 0]])
  const queue = [from]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === to) return dist.get(cur)!
    for (const n of graph.neighbors.get(cur) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(cur)! + 1)
        queue.push(n)
      }
    }
  }
  return Infinity
}

/**
 * お題（ゴール駅）とスタート駅をランダムに決める。
 * 仮の扱い：近すぎると遊びにならないので、minHops 駅以上離す。
 */
export function pickStartAndGoal(
  graph: RailGraph,
  random: () => number = Math.random,
  minHops = 5,
): { start: StationId; goal: StationId } {
  const ids = graph.data.stations.filter((s) => s.inTokyo).map((s) => s.id)
  for (let tries = 0; tries < 100; tries++) {
    const start = ids[Math.floor(random() * ids.length)]
    const goal = ids[Math.floor(random() * ids.length)]
    if (start !== goal && hopDistance(graph, start, goal) >= minHops) {
      return { start, goal }
    }
  }
  throw new Error('スタートとゴールを決められなかった')
}

export interface Judgement {
  distance: number
  correct: boolean
}

/** タップした位置と正解の駅の距離で判定する（要件定義書 FR-02） */
export function judgeGuess(
  guess: LatLng,
  answer: LatLng,
  thresholdMeters: number,
): Judgement {
  const distance = distanceMeters(guess, answer)
  return { distance, correct: distance <= thresholdMeters }
}
