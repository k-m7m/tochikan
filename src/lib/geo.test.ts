import { describe, expect, it } from 'vitest'
import { distanceMeters } from './geo'

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
