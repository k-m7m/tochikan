import { describe, expect, it } from 'vitest'
import yamanote from './prototype/yamanote.json'
import { buildRailGraph, validateRailData } from './railGraph'
import type { RailData } from './types'

describe('山手線の仮データ', () => {
  const data = yamanote as RailData

  it('矛盾がない', () => {
    expect(validateRailData(data)).toEqual([])
  })

  it('30駅の環状になっている', () => {
    const graph = buildRailGraph(data)
    expect(data.stations).toHaveLength(30)
    for (const s of data.stations) {
      expect(graph.neighbors.get(s.id)).toHaveLength(2)
    }
    // 東京から片方向にたどると、30駅目で東京に戻る
    let prev = 'jy-tokyo'
    let cur = 'jy-yurakucho'
    for (let i = 1; i < 30; i++) {
      const next = graph.neighbors.get(cur)!.find((n) => n !== prev)!
      prev = cur
      cur = next
    }
    expect(cur).toBe('jy-tokyo')
  })
})

describe('validateRailData', () => {
  it('存在しない駅へのつながりを見つける', () => {
    const errors = validateRailData({
      lines: [{ id: 'x', name: 'X線', operator: 'X', color: '#000' }],
      stations: [
        {
          id: 'x-a',
          lineId: 'x',
          name: 'A',
          kana: 'えー',
          lat: 35.6,
          lng: 139.7,
          municipality: '千代田区',
          inTokyo: true,
        },
      ],
      edges: [{ lineId: 'x', a: 'x-a', b: 'x-z' }],
      transfers: [],
    })
    expect(errors).toContain('つながりの駅 x-z がない')
  })
})
