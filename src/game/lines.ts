// 試作2で使う路線と色。本決めは #23。

import type { LineId } from '../data/types'

/** 初級の路線（仮）：山手線と、そこから伸びるJRの主要路線 */
export const BEGINNER_LINES: LineId[] = [
  '11302', // JR山手線
  '11312', // JR中央線(快速)
  '11313', // JR中央・総武線
  '11332', // JR京浜東北線
  '11321', // JR埼京線
  '11320', // JR常磐線(上野～取手)
  '11326', // JR京葉線
  '11314', // JR総武本線
]

/** 試作用の路線の色（仮）。鉄道会社の色をそのまま使わず、やわらかい色にしている */
export const PROTOTYPE_LINE_COLORS: Record<LineId, string> = {
  '11302': '#8bd17c',
  '11312': '#f7a15c',
  '11313': '#f2d14f',
  '11332': '#6ec3ee',
  '11321': '#3fae8c',
  '11320': '#b08cd8',
  '11326': '#e8768a',
  '11314': '#5b7fd6',
}

/** 画面に出す路線名。「JR」や区間の書き添えを省いて短くする */
export function shortLineName(name: string): string {
  return name.replace(/^JR/, '').replace(/\(.*?\)$/, '')
}
