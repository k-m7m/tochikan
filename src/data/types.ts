// 駅・路線データの型。工程2で作る本番データも同じ形にする（要件定義書 7.1、12.2）。

export type LineId = string
export type StationId = string

export interface Line {
  id: LineId
  name: string
  operator: string
  /** 地図に線を引くときの色 */
  color: string
}

/**
 * 駅。同じ駅名でも、路線ごとに別の駅として持つ。
 * 乗換は transfers でつなぐ。
 */
export interface Station {
  id: StationId
  lineId: LineId
  name: string
  kana: string
  lat: number
  lng: number
  /** 所在の区市町村 */
  municipality: string
  /** 都外の駅は「通過するだけのマス」になる（要件定義書 4.3） */
  inTokyo: boolean
}

/**
 * 同じ路線で隣り合う2駅のつながり。向きはない。
 * 路線は一本道とは限らない（環状線、支線）ので、並び順ではなくつながりで持つ。
 */
export interface Edge {
  lineId: LineId
  a: StationId
  b: StationId
}

/** 乗り換えでつながっている2駅 */
export interface Transfer {
  a: StationId
  b: StationId
}

export interface RailData {
  lines: Line[]
  stations: Station[]
  edges: Edge[]
  transfers: Transfer[]
}
