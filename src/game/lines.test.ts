import { describe, expect, it } from 'vitest'
import { shortLineName } from './lines'

describe('shortLineName', () => {
  it('「JR」と区間の書き添えを省く', () => {
    expect(shortLineName('JR山手線')).toBe('山手線')
    expect(shortLineName('JR常磐線(上野～取手)')).toBe('常磐線')
  })

  it('「(快速)」は「快速」として残す', () => {
    expect(shortLineName('JR中央線(快速)')).toBe('中央線快速')
  })
})
