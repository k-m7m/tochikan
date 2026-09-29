import { describe, expect, it } from 'vitest'
import yamanote from '../data/prototype/yamanote.json'
import { buildRailGraph } from '../data/railGraph'
import type { RailData } from '../data/types'
import {
  directions,
  hopDistance,
  judgeGuess,
  pickStartAndGoal,
  rollDice,
  walk,
} from './sugoroku'

const graph = buildRailGraph(yamanote as RailData)

describe('walk', () => {
  it('選んだ向きに、出た目の数だけ進む', () => {
    const r = walk(graph, 'jy-tokyo', 'jy-yurakucho', 3)
    expect(r.path).toEqual(['jy-yurakucho', 'jy-shimbashi', 'jy-hamamatsucho'])
    expect(r.stop).toBe('jy-hamamatsucho')
    expect(r.reachedGoal).toBe(false)
  })

  it('逆向きにも進める', () => {
    const r = walk(graph, 'jy-tokyo', 'jy-kanda', 2)
    expect(r.stop).toBe('jy-akihabara')
  })

  it('環状線は一周できる', () => {
    const r = walk(graph, 'jy-tokyo', 'jy-yurakucho', 30)
    expect(r.stop).toBe('jy-tokyo')
  })

  it('ゴールを通り過ぎる場合は、ゴールで止まる', () => {
    const r = walk(graph, 'jy-tokyo', 'jy-yurakucho', 6, 'jy-shimbashi')
    expect(r.stop).toBe('jy-shimbashi')
    expect(r.reachedGoal).toBe(true)
  })

  it('隣でない駅を最初の1歩にするとエラー', () => {
    expect(() => walk(graph, 'jy-tokyo', 'jy-shibuya', 1)).toThrow()
  })
})

describe('directions', () => {
  it('山手線の駅からは2つの向きに進める', () => {
    expect(directions(graph, 'jy-tokyo').sort()).toEqual(
      ['jy-kanda', 'jy-yurakucho'].sort(),
    )
  })
})

describe('hopDistance', () => {
  it('環状線では近い方の向きで数える', () => {
    expect(hopDistance(graph, 'jy-tokyo', 'jy-kanda')).toBe(1)
    expect(hopDistance(graph, 'jy-tokyo', 'jy-shibuya')).toBe(11)
    expect(hopDistance(graph, 'jy-tokyo', 'jy-ikebukuro')).toBe(12)
  })
})

describe('pickStartAndGoal', () => {
  it('5駅以上離れた2駅を選ぶ', () => {
    for (let i = 0; i < 20; i++) {
      const { start, goal } = pickStartAndGoal(graph)
      expect(start).not.toBe(goal)
      expect(hopDistance(graph, start, goal)).toBeGreaterThanOrEqual(5)
    }
  })
})

describe('rollDice', () => {
  it('1〜6の目が出る', () => {
    expect(rollDice(() => 0)).toBe(1)
    expect(rollDice(() => 0.999)).toBe(6)
  })
})

describe('judgeGuess', () => {
  it('しきい値以内なら正解', () => {
    const answer = { lat: 35.6812, lng: 139.7671 }
    expect(
      judgeGuess({ lat: 35.6822, lng: 139.7671 }, answer, 500).correct,
    ).toBe(true)
    expect(
      judgeGuess({ lat: 35.6912, lng: 139.7671 }, answer, 500).correct,
    ).toBe(false)
  })
})
