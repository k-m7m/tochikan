// 駅データ.jp の元データ（data/ekidata）から、アプリで使う駅・路線データを作る。
// 実行：npm run data:build

import { readFileSync, writeFileSync } from 'node:fs'
import { validateRailData } from '../src/data/railGraph.ts'
import { loadEkidata, OUTPUT_PATH } from './rail/files.ts'
import { convertEkidata } from './rail/convert.ts'

const { data, skippedLines } = convertEkidata(loadEkidata())

const errors = validateRailData(data)
if (errors.length > 0) {
  console.error('データに矛盾がある：')
  for (const e of errors) console.error(`- ${e}`)
  process.exit(1)
}

const json = `${JSON.stringify(data, null, 2)}\n`
const previous = (() => {
  try {
    return readFileSync(OUTPUT_PATH, 'utf8')
  } catch {
    return ''
  }
})()
writeFileSync(OUTPUT_PATH, json)

const tokyoStations = data.stations.filter((s) => s.inTokyo)
console.log(`路線：${data.lines.length}`)
console.log(
  `駅：${data.stations.length}（都内 ${tokyoStations.length}、通過するだけの都外の駅 ${data.stations.length - tokyoStations.length}）`,
)
console.log(`つながり：${data.edges.length}、乗換：${data.transfers.length}`)
console.log('除いた路線：')
for (const l of skippedLines) console.log(`- ${l.name}：${l.reason}`)
console.log(previous === json ? '変更なし' : `${OUTPUT_PATH} を更新した`)
