import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { EkidataInput } from './convert.ts'
import { parseCsv } from './csv.ts'

const root = new URL('../../', import.meta.url)

/** 元データのファイル。駅データ.jp のデータを更新したら、ここのファイル名も変える */
const EKIDATA_FILES = {
  companies: 'data/ekidata/company20260409.csv',
  lines: 'data/ekidata/line20260618free.csv',
  stations: 'data/ekidata/station20260731free.csv',
  joins: 'data/ekidata/join20260914.csv',
}

export const OUTPUT_PATH = fileURLToPath(
  new URL('src/data/generated/rail.json', root),
)

export function loadEkidata(): EkidataInput {
  const read = (path: string) =>
    parseCsv(readFileSync(new URL(path, root), 'utf8'))
  return {
    companies: read(EKIDATA_FILES.companies),
    lines: read(EKIDATA_FILES.lines),
    stations: read(EKIDATA_FILES.stations),
    joins: read(EKIDATA_FILES.joins),
  }
}
