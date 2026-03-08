// ─── GPX Parser ──────────────────────────────────────────────────────────────
// Parses a GPX XML string into an array of [lat, lon] coordinate pairs
// plus metadata (name, distance, elevation)

export type RoutePoint = { lat: number; lon: number; ele?: number }

export type ParsedRoute = {
  name: string
  points: RoutePoint[]
  distanceKm: number
  elevationGainM: number
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
}

export function parseGPX(xmlString: string): ParsedRoute {
  // Extract track name
  const nameMatch = xmlString.match(/<name>\s*(.*?)\s*<\/name>/)
  const name = nameMatch?.[1] ?? 'Route'

  // Extract all trkpt or wpt elements
  const pointRegex = /<(?:trkpt|wpt)\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>(?:[\s\S]*?<ele>([^<]+)<\/ele>)?/g
  const points: RoutePoint[] = []
  let match: RegExpExecArray | null

  while ((match = pointRegex.exec(xmlString)) !== null) {
    points.push({
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
      ele: match[3] ? parseFloat(match[3]) : undefined,
    })
  }

  return buildRouteMetadata(name, points)
}

// ─── FIT Parser ───────────────────────────────────────────────────────────────
// FIT files are binary. We decode the key fields we need.
// Based on the Garmin FIT protocol spec (simplified).

export function parseFIT(buffer: ArrayBuffer): ParsedRoute {
  const view = new DataView(buffer)
  const points: RoutePoint[] = []

  // FIT file header is 14 bytes
  // Each record has a 1-byte header + variable length data messages
  // We scan for record message type 20 (GPS coordinates)
  // Coordinates are stored as semicircles: degrees = semicircles * (180 / 2^31)

  const SEMICIRCLE_TO_DEG = 180 / Math.pow(2, 31)

  let offset = 14 // skip FIT file header
  const length = view.byteLength - 2 // skip CRC at end

  while (offset < length) {
    try {
      const recordHeader = view.getUint8(offset)

      // Compressed timestamp record (bit 7 = 1)
      if (recordHeader & 0x80) {
        offset += 1
        continue
      }

      const isDefinition = (recordHeader & 0x40) !== 0

      if (isDefinition) {
        // Skip definition message: 1 reserved + 1 arch + 2 global msg num + 1 field count + n*3 fields
        offset += 1 // reserved
        offset += 1 // architecture
        offset += 2 // global message number
        const fieldCount = view.getUint8(offset)
        offset += 1
        offset += fieldCount * 3
        // Dev fields
        if (recordHeader & 0x20) {
          const devFieldCount = view.getUint8(offset)
          offset += 1
          offset += devFieldCount * 3
        }
        continue
      }

      // Data message — we look for records where we can find valid lat/lon
      // Try to read 12 bytes as potential lat/lon (fields 0 and 1 of record type 20)
      if (offset + 12 <= length) {
        const potentialLat = view.getInt32(offset + 1, true)
        const potentialLon = view.getInt32(offset + 5, true)

        const lat = potentialLat * SEMICIRCLE_TO_DEG
        const lon = potentialLon * SEMICIRCLE_TO_DEG

        // Valid coordinate range check
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
          potentialLat !== 0x7fffffff && potentialLon !== 0x7fffffff) {
          // Try to read altitude (field 2, stored as uint16 * 5 - 500 = metres)
          let ele: number | undefined
          if (offset + 14 <= length) {
            const rawAlt = view.getUint16(offset + 9, true)
            if (rawAlt !== 0xffff) {
              ele = rawAlt / 5 - 500
            }
          }
          points.push({ lat, lon, ele })
        }
      }
      offset += 1
    } catch {
      break
    }
  }

  // FIT files don't embed a route name — use generic
  const name = 'FIT Route'
  return buildRouteMetadata(name, points)
}

// ─── Shared metadata builder ──────────────────────────────────────────────────

function buildRouteMetadata(name: string, points: RoutePoint[]): ParsedRoute {
  if (points.length === 0) {
    return { name, points: [], distanceKm: 0, elevationGainM: 0, bounds: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 } }
  }

  // Distance (Haversine)
  let distanceM = 0
  for (let i = 1; i < points.length; i++) {
    distanceM += haversine(points[i - 1], points[i])
  }

  // Elevation gain
  let elevationGainM = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].ele
    const curr = points[i].ele
    if (prev !== undefined && curr !== undefined && curr > prev) {
      elevationGainM += curr - prev
    }
  }

  // Bounds
  const lats = points.map(p => p.lat)
  const lons = points.map(p => p.lon)

  return {
    name,
    points,
    distanceKm: Math.round(distanceM / 100) / 10,
    elevationGainM: Math.round(elevationGainM),
    bounds: {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    },
  }
}

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const c = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

// ─── Route → Polyline encoder ─────────────────────────────────────────────────
// Encodes route points to Google Encoded Polyline format for compact storage
// and efficient rendering in maps

export function encodePolyline(points: RoutePoint[]): string {
  let encoded = ''
  let prevLat = 0
  let prevLon = 0

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lon = Math.round(point.lon * 1e5)
    encoded += encodeValue(lat - prevLat)
    encoded += encodeValue(lon - prevLon)
    prevLat = lat
    prevLon = lon
  }

  return encoded
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1
  let result = ''
  while (v >= 0x20) {
    result += String.fromCharCode(((v & 0x1f) | 0x20) + 63)
    v >>= 5
  }
  result += String.fromCharCode(v + 63)
  return result
}

export function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push({ lat: lat / 1e5, lon: lng / 1e5 })
  }

  return points
}

// ─── Simplify route for display ───────────────────────────────────────────────
// Ramer–Douglas–Peucker algorithm to reduce point count for card thumbnails

export function simplifyRoute(points: RoutePoint[], tolerance = 0.0001): RoutePoint[] {
  if (points.length <= 2) return points

  const maxDist = { dist: 0, index: 0 }
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (d > maxDist.dist) { maxDist.dist = d; maxDist.index = i }
  }

  if (maxDist.dist > tolerance) {
    const left = simplifyRoute(points.slice(0, maxDist.index + 1), tolerance)
    const right = simplifyRoute(points.slice(maxDist.index), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[points.length - 1]]
}

function perpendicularDistance(point: RoutePoint, lineStart: RoutePoint, lineEnd: RoutePoint): number {
  const dx = lineEnd.lon - lineStart.lon
  const dy = lineEnd.lat - lineStart.lat
  const mag = Math.sqrt(dx * dx + dy * dy)
  if (mag === 0) return Math.sqrt((point.lon - lineStart.lon) ** 2 + (point.lat - lineStart.lat) ** 2)
  return Math.abs(dx * (lineStart.lat - point.lat) - dy * (lineStart.lon - point.lon)) / mag
}
