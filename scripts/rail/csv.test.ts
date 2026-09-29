import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv.ts'

describe('parseCsv', () => {
  it('1行目を見出しにして、行ごとのオブジェクトにする', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('ダブルクォートで囲まれたカンマや改行を扱える', () => {
    expect(parseCsv('a,b\r\n"x,y","1\n2"\r\n"say ""hi""",3')).toEqual([
      { a: 'x,y', b: '1\n2' },
      { a: 'say "hi"', b: '3' },
    ])
  })
})
