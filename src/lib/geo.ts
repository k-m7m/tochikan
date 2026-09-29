const EARTH_RADIUS_M = 6_371_000

export interface LatLng {
  lat: number
  lng: number
}

/** 2地点間の距離（メートル）。球面上の大円距離で求める。 */
export function distanceMeters(p: LatLng, q: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(q.lat - p.lat)
  const dLng = toRad(q.lng - p.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

const DIRECTIONS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']

/** p から見た q の方角（8方位） */
export function direction8(p: LatLng, q: LatLng): string {
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(q.lng - p.lng)) * Math.cos(toRad(q.lat))
  const x =
    Math.cos(toRad(p.lat)) * Math.sin(toRad(q.lat)) -
    Math.sin(toRad(p.lat)) *
      Math.cos(toRad(q.lat)) *
      Math.cos(toRad(q.lng - p.lng))
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return DIRECTIONS[Math.round(bearing / 45) % 8]
}
