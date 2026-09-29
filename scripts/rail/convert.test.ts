import { describe, expect, it } from 'vitest'
import {
  convertEkidata,
  tokyoMunicipality,
  trimOutsideTokyo,
} from './convert.ts'

// T で始まる駅は都内、K で始まる駅は都外
const inTokyo = (id: string) => id.startsWith('T')
const path = (...ids: string[]) =>
  ids.slice(1).map((id, i) => [ids[i], id] as [string, string])

describe('trimOutsideTokyo', () => {
  it('都県境の外へ伸びる部分を取り除く', () => {
    const r = trimOutsideTokyo(
      ['T1', 'T2', 'K1', 'K2'],
      path('T1', 'T2', 'K1', 'K2'),
      inTokyo,
    )
    expect(r.stationIds).toEqual(['T1', 'T2'])
    expect(r.edges).toEqual([['T1', 'T2']])
  })

  it('いったん都外に出て都内に戻る区間は残す', () => {
    const r = trimOutsideTokyo(
      ['T1', 'K1', 'K2', 'T2', 'K3'],
      path('T1', 'K1', 'K2', 'T2', 'K3'),
      inTokyo,
    )
    expect(r.stationIds).toEqual(['T1', 'K1', 'K2', 'T2'])
  })

  it('都外で輪になっている区間も取り除く', () => {
    const r = trimOutsideTokyo(
      ['T1', 'T2', 'K1', 'K2', 'K3'],
      [...path('T1', 'T2', 'K1', 'K2', 'K3'), ['K3', 'K1']],
      inTokyo,
    )
    expect(r.stationIds).toEqual(['T1', 'T2'])
  })

  it('都外の区間から枝分かれして外へ伸びる部分は取り除く', () => {
    const r = trimOutsideTokyo(
      ['T1', 'K1', 'K2', 'T2', 'K9'],
      [...path('T1', 'K1', 'K2', 'T2'), ['K1', 'K9']],
      inTokyo,
    )
    expect(r.stationIds).toEqual(['T1', 'K1', 'K2', 'T2'])
  })
})

describe('tokyoMunicipality', () => {
  it('「東京都」がない住所からも区市町村を取り出す', () => {
    expect(tokyoMunicipality('東京都千代田区丸の内一丁目')).toBe('千代田区')
    expect(tokyoMunicipality('府中市本町１丁目')).toBe('府中市')
  })

  it('名前の一部に「村」などを含む市を取り違えない', () => {
    expect(tokyoMunicipality('東村山市本町2丁目')).toBe('東村山市')
    expect(tokyoMunicipality('武蔵村山市学園')).toBe('武蔵村山市')
  })

  it('郡のついた町の住所も扱える', () => {
    expect(tokyoMunicipality('西多摩郡奥多摩町氷川')).toBe('奥多摩町')
  })

  it('都外の住所では undefined', () => {
    expect(tokyoMunicipality('川崎市多摩区登戸')).toBeUndefined()
  })
})

describe('convertEkidata', () => {
  const station = (
    cd: string,
    name: string,
    lineCd: string,
    prefCd: string,
    groupCd = cd,
  ) => ({
    station_cd: cd,
    station_g_cd: groupCd,
    station_name: name,
    station_name_k: '',
    line_cd: lineCd,
    pref_cd: prefCd,
    address: prefCd === '13' ? '千代田区' : '',
    lon: '139.7',
    lat: '35.6',
    e_status: '0',
  })
  const line = (cd: string, name: string, color = '') => ({
    line_cd: cd,
    company_cd: '1',
    line_name: name,
    line_color_c: color,
    e_status: '0',
    e_sort: cd,
  })

  const input = {
    companies: [{ company_cd: '1', company_name: 'テスト鉄道' }],
    lines: [
      line('100', 'A線', '80C241'),
      line('200', 'B線'),
      line('300', 'C線'),
      line('11333', 'JR湘南新宿ライン'),
    ],
    stations: [
      station('101', '甲', '100', '13', 'G1'),
      station('102', '乙', '100', '13'),
      station('201', '丙', '200', '13', 'G1'),
      station('202', '丁', '200', '13'),
      station('301', '戊', '300', '13'),
      station('302', '己', '300', '14'),
      station('9901', '庚', '11333', '13'),
      station('9902', '辛', '11333', '13'),
    ],
    joins: [
      { line_cd: '100', station_cd1: '101', station_cd2: '102' },
      { line_cd: '200', station_cd1: '201', station_cd2: '202' },
      { line_cd: '300', station_cd1: '301', station_cd2: '302' },
      { line_cd: '11333', station_cd1: '9901', station_cd2: '9902' },
    ],
  }

  it('都内の駅が2駅以上ある路線だけを残し、運転系統の路線は除く', () => {
    const { data, skippedLines } = convertEkidata(input)
    expect(data.lines.map((l) => l.id)).toEqual(['100', '200'])
    expect(skippedLines.map((l) => l.lineCd).sort()).toEqual(['11333', '300'])
  })

  it('路線カラーがあれば使い、なければ仮の色をつける', () => {
    const { data } = convertEkidata(input)
    expect(data.lines[0].color).toBe('#80C241')
    expect(data.lines[1].color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('同じ駅グループの、別の路線の駅を乗換でつなぐ', () => {
    const { data } = convertEkidata(input)
    expect(data.transfers).toEqual([{ a: '101', b: '201' }])
  })
})
