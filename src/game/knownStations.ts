// 覚えた駅（通ったことのある駅）をブラウザに保存する。
// 保存できない環境（プライベートブラウズなど）でも、遊ぶのは止めない。

import type { NodeId } from './board'

const STORAGE_KEY = 'tochikan.prototype2.known'

export function loadKnown(): Set<NodeId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const ids: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.map(String) : [])
  } catch {
    return new Set()
  }
}

export function saveKnown(known: ReadonlySet<NodeId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...known]))
  } catch {
    // 保存できなくても遊べるので、何もしない
  }
}

export function clearKnown() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 同上
  }
}
