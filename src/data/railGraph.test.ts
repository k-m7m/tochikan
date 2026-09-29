import { describe, expect, it } from 'vitest'
import { validateRailData } from './railGraph'

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

  it('隣の駅がない駅を見つける', () => {
    const errors = validateRailData({
      lines: [{ id: 'x', name: 'X線', operator: 'X', color: '#000' }],
      stations: [
        {
          id: 'x-a',
          lineId: 'x',
          name: 'A',
          kana: '',
          lat: 35.6,
          lng: 139.7,
          municipality: '千代田区',
          inTokyo: true,
        },
      ],
      edges: [],
      transfers: [],
    })
    expect(errors).toContain('駅 x-a に隣の駅がない')
  })
})
