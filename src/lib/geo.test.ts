import { describe, expect, it } from 'vitest'
import { direction8, distanceMeters } from './geo'

describe('distanceMeters', () => {
  it('同じ地点なら0', () => {
    const p = { lat: 35.68, lng: 139.76 }
    expect(distanceMeters(p, p)).toBe(0)
  })

  it('緯度0.01度はおよそ1.1km', () => {
    const d = distanceMeters(
      { lat: 35.68, lng: 139.76 },
      { lat: 35.69, lng: 139.76 },
    )
    expect(d).toBeGreaterThan(1100)
    expect(d).toBeLessThan(1125)
  })
})

describe('direction8', () => {
  it('8方位で方角を返す', () => {
    const tokyo = { lat: 35.681, lng: 139.767 }
    expect(direction8(tokyo, { lat: 35.73, lng: 139.767 })).toBe('北')
    expect(direction8(tokyo, { lat: 35.681, lng: 139.6 })).toBe('西')
    // 吉祥寺は東京駅から見て西
    expect(direction8(tokyo, { lat: 35.703, lng: 139.58 })).toBe('西')
    // 池袋は北西
    expect(direction8(tokyo, { lat: 35.73, lng: 139.711 })).toBe('北西')
  })
})
