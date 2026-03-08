import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ViewStyle, Dimensions } from 'react-native'
import Svg, { Polyline, Path, Circle } from 'react-native-svg'
import { decodePolyline, RoutePoint } from '../lib/parsers/routeParsers'
import { colors, fontSize, fontWeight } from '../lib/theme'
import { Zap, ArrowUp } from 'lucide-react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type RouteMapProps = {
  polyline: string        // encoded polyline string
  distanceKm?: number
  elevationGainM?: number
  routeName?: string
  size?: 'card' | 'chat' | 'full'
  style?: ViewStyle
}

// ─── RouteMap ─────────────────────────────────────────────────────────────────
// Renders a clean SVG route thumbnail from an encoded polyline.
// No map tiles needed — just a stylised line drawing like Strava/Garmin.

export function RouteMap({
  polyline,
  distanceKm,
  elevationGainM,
  routeName,
  size = 'card',
  style,
}: RouteMapProps) {
  const dims = {
    card: { width: '100%' as const, height: 120 },
    chat: { width: '100%' as const, height: 100 },
    full: { width: SCREEN_WIDTH - 48, height: 220 },
  }[size]

  const points = useMemo(() => {
    try { return decodePolyline(polyline) }
    catch { return [] }
  }, [polyline])

  const svgPath = useMemo(() => {
    if (points.length < 2) return ''
    return projectToSVG(points, dims.height, 280)
  }, [points, dims.height])

  if (!svgPath) return null

  const startPt = getStartEnd(points, dims.height, 280).start
  const endPt = getStartEnd(points, dims.height, 280).end

  return (
    <View style={[styles.container, style]}>
      <Svg width="100%" height={dims.height} viewBox={`0 0 280 ${dims.height}`} preserveAspectRatio="xMidYMid meet">
        {/* Background */}
        <Path d={`M0 0 H280 V${dims.height} H0 Z`} fill={colors.slate900} />

        {/* Glow effect (duplicate path slightly blurred via opacity layers) */}
        <Path d={svgPath} stroke={colors.blue400} strokeWidth="6" fill="none" opacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={svgPath} stroke={colors.blue400} strokeWidth="3" fill="none" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Main route line */}
        <Path d={svgPath} stroke={colors.blue500} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Start dot */}
        <Circle cx={startPt.x} cy={startPt.y} r="5" fill={colors.emerald600} />
        <Circle cx={startPt.x} cy={startPt.y} r="3" fill="white" />

        {/* End dot */}
        <Circle cx={endPt.x} cy={endPt.y} r="5" fill={colors.blue500} />
        <Circle cx={endPt.x} cy={endPt.y} r="3" fill="white" />
      </Svg>

      {/* Stats overlay */}
      <View style={styles.overlay}>
        {routeName && size !== 'card' && (
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
        )}
        <View style={styles.stats}>
          {distanceKm !== undefined && (
            <View style={styles.stat}>
              <Zap size={10} color={colors.blue400} />
              <Text style={styles.statText}>{distanceKm.toFixed(1)}km</Text>
            </View>
          )}
          {elevationGainM !== undefined && elevationGainM > 0 && (
            <View style={styles.stat}>
              <ArrowUp size={10} color={colors.blue400} />
              <Text style={styles.statText}>{elevationGainM}m</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

// ─── ElevationProfile ─────────────────────────────────────────────────────────

export function ElevationProfile({
  points,
  style,
}: {
  points: RoutePoint[]
  style?: ViewStyle
}) {
  const withEle = points.filter(p => p.ele !== undefined)
  if (withEle.length < 2) return null

  const elevations = withEle.map(p => p.ele!)
  const minE = Math.min(...elevations)
  const maxE = Math.max(...elevations)
  const range = maxE - minE || 1

  const W = 280
  const H = 48

  const pts = withEle.map((p, i) => {
    const x = (i / (withEle.length - 1)) * W
    const y = H - ((p.ele! - minE) / range) * (H - 8) - 4
    return `${x},${y}`
  })

  const fillPts = [`0,${H}`, ...pts, `${W},${H}`].join(' ')
  const linePts = pts.join(' ')

  return (
    <View style={[styles.eleContainer, style]}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={fillPts} fill={`${colors.blue500}22`} stroke="none" />
        <Polyline points={linePts} fill="none" stroke={colors.blue500} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.eleStats}>
        <Text style={styles.eleLabel}>{Math.round(maxE - minE)}m gain</Text>
        <Text style={styles.eleLabel}>{Math.round(minE)}m – {Math.round(maxE)}m</Text>
      </View>
    </View>
  )
}

// ─── Projection helpers ───────────────────────────────────────────────────────

function projectToSVG(points: RoutePoint[], height: number, width: number): string {
  if (points.length < 2) return ''

  const lats = points.map(p => p.lat)
  const lons = points.map(p => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)

  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001

  const padding = 20
  const usableW = width - padding * 2
  const usableH = height - padding * 2

  // Preserve aspect ratio
  const scale = Math.min(usableW / lonRange, usableH / latRange)
  const projW = lonRange * scale
  const projH = latRange * scale
  const offsetX = padding + (usableW - projW) / 2
  const offsetY = padding + (usableH - projH) / 2

  const project = (p: RoutePoint) => ({
    x: offsetX + (p.lon - minLon) * scale,
    y: offsetY + projH - (p.lat - minLat) * scale,
  })

  const projected = points.map(project)
  return 'M' + projected.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')
}

function getStartEnd(points: RoutePoint[], height: number, width: number) {
  const lats = points.map(p => p.lat)
  const lons = points.map(p => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const latRange = maxLat - minLat || 0.001
  const lonRange = maxLon - minLon || 0.001
  const padding = 20
  const usableW = width - padding * 2
  const usableH = height - padding * 2
  const scale = Math.min(usableW / lonRange, usableH / latRange)
  const projW = lonRange * scale
  const projH = latRange * scale
  const offsetX = padding + (usableW - projW) / 2
  const offsetY = padding + (usableH - projH) / 2

  const project = (p: RoutePoint) => ({
    x: offsetX + (p.lon - minLon) * scale,
    y: offsetY + projH - (p.lat - minLat) * scale,
  })

  return {
    start: project(points[0]),
    end: project(points[points.length - 1]),
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  routeName: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: fontWeight.medium,
    flex: 1,
    marginRight: 8,
  },
  stats: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  stat: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8,
  },
  statIcon: { fontSize: 10, color: colors.blue400 },
  statText: { fontSize: fontSize.xs, color: colors.white, fontWeight: fontWeight.semibold },

  eleContainer: {
    backgroundColor: colors.slate50,
    borderRadius: 8,
    overflow: 'hidden',
    paddingTop: 4,
  },
  eleStats: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingBottom: 6,
  },
  eleLabel: { fontSize: 10, color: colors.slate400 },
})
