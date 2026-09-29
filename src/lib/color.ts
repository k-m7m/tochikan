/** #rrggbb の色を、黒に近づけて暗くする（amount は 0〜1） */
export function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  const channel = (h: string) =>
    Math.round(parseInt(h, 16) * (1 - amount))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(m[1])}${channel(m[2])}${channel(m[3])}`
}
