// 実際の元データ（data/ekidata）を変換した結果を確かめる
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildRailGraph, validateRailData } from '../../src/data/railGraph.ts'
import type { RailData, Station } from '../../src/data/types.ts'
import { TOKYO_MUNICIPALITIES } from './config.ts'
import { convertEkidata } from './convert.ts'
import { loadEkidata, OUTPUT_PATH } from './files.ts'

const { data } = convertEkidata(loadEkidata())
const graph = buildRailGraph(data)

const lineByName = (name: string) => {
  const line = data.lines.find((l) => l.name === name)
  if (!line) throw new Error(`路線 ${name} がない`)
  return line
}
const stationsOf = (lineName: string) =>
  data.stations.filter((s) => s.lineId === lineByName(lineName).id)
const stationOn = (lineName: string, name: string): Station | undefined =>
  stationsOf(lineName).find((s) => s.name === name)

describe('変換結果', () => {
  it('リポジトリにある src/data/generated/rail.json と一致する（npm run data:build で作り直す）', () => {
    const committed = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as RailData
    expect(committed).toEqual(data)
  })

  it('矛盾がない', () => {
    expect(validateRailData(data)).toEqual([])
  })

  it('都内の駅には、すべて区市町村が入っている', () => {
    const names: readonly string[] = TOKYO_MUNICIPALITIES
    const missing = data.stations.filter(
      (s) => s.inTokyo && !names.includes(s.municipality),
    )
    expect(missing.map((s) => `${s.name}（${s.id}）`)).toEqual([])
  })
})

describe('山手線', () => {
  it('30駅の環状になっている', () => {
    const stations = stationsOf('JR山手線')
    expect(stations).toHaveLength(30)
    for (const s of stations) {
      expect(graph.neighbors.get(s.id)).toHaveLength(2)
    }
  })
})

describe('都外を通る区間（要件定義書 4.3）', () => {
  it('小田急線：登戸〜柿生は通過するだけの駅として残し、町田より先は除く', () => {
    expect(stationOn('小田急線', '登戸')?.inTokyo).toBe(false)
    expect(stationOn('小田急線', '柿生')?.inTokyo).toBe(false)
    expect(stationOn('小田急線', '鶴川')?.inTokyo).toBe(true)
    expect(stationOn('小田急線', '相模大野')).toBeUndefined()
  })

  it('東急田園都市線：長津田は残し、つきみ野より先は除く', () => {
    expect(stationOn('東急田園都市線', '長津田')?.inTokyo).toBe(false)
    expect(
      stationOn('東急田園都市線', '南町田グランベリーパーク')?.inTokyo,
    ).toBe(true)
    expect(stationOn('東急田園都市線', 'つきみ野')).toBeUndefined()
  })

  it('JR横浜線：橋本〜古淵は残し、長津田より先は除く', () => {
    expect(stationOn('JR横浜線', '橋本')?.inTokyo).toBe(false)
    expect(stationOn('JR横浜線', '長津田')).toBeUndefined()
  })

  it('都県境で打ち切る路線には、都外の駅が残らない', () => {
    expect(stationsOf('JR中央本線(東京～塩尻)').every((s) => s.inTokyo)).toBe(
      true,
    )
    expect(stationsOf('JR京葉線').every((s) => s.inTokyo)).toBe(true)
  })
})

describe('乗換', () => {
  const connected = (a?: Station, b?: Station) =>
    data.transfers.some(
      (t) =>
        (t.a === a?.id && t.b === b?.id) || (t.a === b?.id && t.b === a?.id),
    )

  it('同じ名前の駅をつなぐ', () => {
    expect(
      connected(
        stationOn('JR山手線', '渋谷'),
        stationOn('東京メトロ銀座線', '渋谷'),
      ),
    ).toBe(true)
  })

  it('名前が違っても、同じ駅グループならつなぐ', () => {
    expect(
      connected(
        stationOn('JR山手線', '有楽町'),
        stationOn('東京メトロ日比谷線', '日比谷'),
      ),
    ).toBe(true)
  })
})
