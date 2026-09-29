// すごろくの移動。サイコロの目の数だけ、1駅ずつ進む。
// 分岐や乗換駅では、プレイヤーが進む方向を選ぶ（途中でも乗り換えられる）。

import type { LineId } from '../data/types'
import type { Board, NodeId } from './board'

/** 次に進める1駅と、そこへ行ける路線 */
export interface StepOption {
  to: NodeId
  lineIds: LineId[]
}

/**
 * これより大きく曲がる動きはできない（度）。
 * 並んで走る別の路線に乗り換えて、来た方向へ戻るのを防ぐため
 * （例：新大久保から新宿に来て、埼京線で池袋へ戻る）
 */
const MAX_TURN_DEGREES = 120

/** a → b → c と進むときに、b で曲がる角度（度） */
function turnDegrees(board: Board, a: NodeId, b: NodeId, c: NodeId): number {
  const pa = board.nodes.get(a)!
  const pb = board.nodes.get(b)!
  const pc = board.nodes.get(c)!
  // 経度1度の長さは緯度によって縮むので、そのぶんを直す
  const k = Math.cos((pb.lat * Math.PI) / 180)
  const ux = (pb.lng - pa.lng) * k
  const uy = pb.lat - pa.lat
  const vx = (pc.lng - pb.lng) * k
  const vy = pc.lat - pb.lat
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy)
  if (lengths === 0) return 0
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / lengths))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * 今いるマスから、次に進める隣のマスを返す。
 * - 来たマス（cameFrom）へすぐ戻る動きや、大きく曲がって来た方向へ戻る動きはしない
 * - 同じ隣のマスへ複数の路線で行けるときは、1つの選択肢にまとめる
 */
export function nextSteps(
  board: Board,
  at: NodeId,
  cameFrom?: NodeId,
): StepOption[] {
  const byNode = new Map<NodeId, LineId[]>()
  for (const link of board.links.get(at) ?? []) {
    if (link.to === cameFrom) continue
    if (
      cameFrom !== undefined &&
      turnDegrees(board, cameFrom, at, link.to) > MAX_TURN_DEGREES
    ) {
      continue
    }
    byNode.set(link.to, [...(byNode.get(link.to) ?? []), link.lineId])
  }
  return [...byNode].map(([to, lineIds]) => ({ to, lineIds }))
}

/** 進むときに使う路線。今乗っている路線で行けるなら乗り換えない */
export function lineForStep(
  option: StepOption,
  currentLine: LineId | undefined,
): LineId {
  return currentLine !== undefined && option.lineIds.includes(currentLine)
    ? currentLine
    : option.lineIds[0]
}
