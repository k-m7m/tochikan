// サイコロの目の数で行けるマスを求める。

import type { LineId } from '../data/types'
import type { Board, NodeId, Route } from './board'
import { countTransfers } from './board'

/**
 * 乗換のルール（試作で比べるため切り替えられる）
 * - anywhere：通過中の乗換駅でも乗り換えられる
 * - onlyWhenStopped：止まった駅でだけ乗り換えられる（進み始めたら同じ路線を進む）
 */
export type TransferRule = 'anywhere' | 'onlyWhenStopped'

export interface MoveOptions {
  rule: TransferRule
  /** 目の数に満たなくても止まれるマス（目的地など） */
  canStopEarly?: (node: NodeId) => boolean
}

/**
 * 出発マスから、ちょうど steps 駅進んで止まれるマスと、そこまでの道順を返す。
 * - 1回の移動で同じマスを2度通らない（来たマスへ戻ったり、輪を回ったりしない）
 * - 終点などで進めなくなったら、そこで止まる
 * - 都外のマスは通過できるが、止まれない
 * - canStopEarly のマスは、途中でも止まれる
 * 同じマスへの道順が複数あるときは、乗換が少ないものを選ぶ。
 */
export function reachableNodes(
  board: Board,
  from: NodeId,
  steps: number,
  options: MoveOptions,
): Map<NodeId, Route> {
  const result = new Map<NodeId, Route>()
  const onPath = new Set<NodeId>([from])
  const route: Route = { nodes: [], lineIds: [] }

  const record = () => {
    const dest = route.nodes[route.nodes.length - 1]
    if (dest === undefined || !board.nodes.get(dest)!.inTokyo) return
    const current = result.get(dest)
    if (!current || countTransfers(route) < countTransfers(current)) {
      result.set(dest, { nodes: [...route.nodes], lineIds: [...route.lineIds] })
    }
  }

  /** 次に進めるマスと、使える路線。同じ路線で進めるなら、乗り換えない */
  const nextMoves = (node: NodeId, lineId: LineId | undefined) => {
    const byNode = new Map<NodeId, LineId[]>()
    for (const link of board.links.get(node) ?? []) {
      if (onPath.has(link.to)) continue
      if (
        options.rule === 'onlyWhenStopped' &&
        lineId !== undefined &&
        link.lineId !== lineId
      ) {
        continue
      }
      byNode.set(link.to, [...(byNode.get(link.to) ?? []), link.lineId])
    }
    return [...byNode].map(([to, lineIds]) => ({
      to,
      lineIds:
        lineId !== undefined && lineIds.includes(lineId) ? [lineId] : lineIds,
    }))
  }

  const visit = (node: NodeId, lineId: LineId | undefined) => {
    if (route.nodes.length > 0 && options.canStopEarly?.(node)) record()
    if (route.nodes.length === steps) {
      record()
      return
    }
    const moves = nextMoves(node, lineId)
    if (moves.length === 0) {
      // 終点などで目が余ったら、そこで止まる
      record()
      return
    }
    for (const move of moves) {
      onPath.add(move.to)
      for (const next of move.lineIds) {
        route.nodes.push(move.to)
        route.lineIds.push(next)
        visit(move.to, next)
        route.nodes.pop()
        route.lineIds.pop()
      }
      onPath.delete(move.to)
    }
  }

  visit(from, undefined)
  return result
}
