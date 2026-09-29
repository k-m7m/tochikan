import { describe, expect, it } from 'vitest'
import { darken } from './color'

describe('darken', () => {
  it('色を暗くする', () => {
    expect(darken('#ffffff', 0.5)).toBe('#808080')
    expect(darken('#8bd17c', 0)).toBe('#8bd17c')
    expect(darken('#8bd17c', 1)).toBe('#000000')
  })

  it('形式が違う色はそのまま返す', () => {
    expect(darken('red', 0.5)).toBe('red')
  })
})
