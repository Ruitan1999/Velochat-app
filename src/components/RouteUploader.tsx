import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../lib/supabase'
import { parseGPX, parseFIT, encodePolyline, simplifyRoute, ParsedRoute } from '../lib/parsers/routeParsers'
import { RouteMap, ElevationProfile } from './RouteMap'
import { colors, spacing, fontSize, fontWeight, radius } from '../lib/theme'
import { Zap, ArrowUp, X as XIcon, Paperclip } from 'lucide-react-native'

type RouteUploadResult = {
  polyline: string
  distanceKm: number
  elevationGainM: number
  routeName: string
  fileUrl: string
}

type RouteUploaderProps = {
  onRouteReady: (result: RouteUploadResult) => void
  onClear: () => void
  existingRoute?: RouteUploadResult | null
}

export function RouteUploader({ onRouteReady, onClear, existingRoute }: RouteUploaderProps) {
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedRoute | null>(null)
  const [preview, setPreview] = useState<string | null>(existingRoute?.polyline ?? null)

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const ext = asset.name.split('.').pop()?.toLowerCase()

      if (!['gpx', 'fit', 'tcx'].includes(ext ?? '')) {
        Alert.alert('Unsupported file', 'Please upload a GPX or FIT file.')
        return
      }

      setLoading(true)

      let route: ParsedRoute

      if (ext === 'gpx') {
        // Read as text (UTF-8)
        const content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'utf8',
        })
        route = parseGPX(content)
      } else if (ext === 'fit') {
        // Read as base64, convert to ArrayBuffer
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64',
        })
        const buffer = base64ToArrayBuffer(base64)
        route = parseFIT(buffer)
      } else {
        Alert.alert('Unsupported', 'Only GPX and FIT files are supported.')
        setLoading(false)
        return
      }

      if (route.points.length < 2) {
        Alert.alert('Invalid file', 'Could not extract route points from this file.')
        setLoading(false)
        return
      }

      // Simplify for efficient storage and rendering
      const simplified = simplifyRoute(route.points, 0.00005)
      const polyline = encodePolyline(simplified)

      // Upload original file to Supabase Storage
      const filePath = `routes/${Date.now()}_${asset.name}`
      const fileContent = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      })

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ride-routes')
        .upload(filePath, decode(fileContent), {
          contentType: ext === 'gpx' ? 'application/gpx+xml' : 'application/octet-stream',
        })

      let fileUrl = ''
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('ride-routes').getPublicUrl(filePath)
        fileUrl = urlData.publicUrl
      }

      const enrichedRoute = { ...route, points: simplified }
      setParsed(enrichedRoute)
      setPreview(polyline)

      onRouteReady({
        polyline,
        distanceKm: route.distanceKm,
        elevationGainM: route.elevationGainM,
        routeName: route.name,
        fileUrl,
      })

    } catch (err) {
      Alert.alert('Error', 'Failed to process route file.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setParsed(null)
    setPreview(null)
    onClear()
  }

  // Has a route (uploaded or from Strava)
  if (preview) {
    return (
      <View style={styles.previewContainer}>
        <RouteMap
          polyline={preview}
          distanceKm={parsed?.distanceKm ?? existingRoute?.distanceKm}
          elevationGainM={parsed?.elevationGainM ?? existingRoute?.elevationGainM}
          routeName={parsed?.name ?? existingRoute?.routeName}
          size="card"
          style={styles.mapPreview}
        />
        {parsed?.points && parsed.points.some(p => p.ele !== undefined) && (
          <ElevationProfile points={parsed.points} style={styles.eleProfile} />
        )}
        <View style={styles.previewFooter}>
          <View style={styles.previewStats}>
            {(parsed?.distanceKm ?? existingRoute?.distanceKm) !== undefined && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Zap size={12} color={colors.slate600} />
                <Text style={styles.previewStat}>{(parsed?.distanceKm ?? existingRoute?.distanceKm)?.toFixed(1)}km</Text>
              </View>
            )}
            {(parsed?.elevationGainM ?? existingRoute?.elevationGainM) !== undefined && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <ArrowUp size={12} color={colors.slate600} />
                <Text style={styles.previewStat}>{parsed?.elevationGainM ?? existingRoute?.elevationGainM}m</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><XIcon size={12} color={colors.slate500} /><Text style={styles.clearBtnText}>Remove</Text></View>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <TouchableOpacity style={styles.uploadBtn} onPress={handlePick} disabled={loading} activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color={colors.blue500} />
      ) : (
        <>
          <Paperclip size={24} color={colors.slate400} />
          <View>
            <Text style={styles.uploadTitle}>Upload Route</Text>
            <Text style={styles.uploadSub}>GPX or FIT file</Text>
          </View>
        </>
      )}
    </TouchableOpacity>
  )
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const styles = StyleSheet.create({
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: colors.slate200, borderStyle: 'dashed',
    borderRadius: radius.lg, padding: spacing.lg,
    backgroundColor: colors.slate50,
  },
  uploadIcon: { fontSize: 24 },
  uploadTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate700 },
  uploadSub: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 1 },

  previewContainer: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.slate200,
  },
  mapPreview: { borderRadius: 0 },
  eleProfile: { borderRadius: 0 },
  previewFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.white,
  },
  previewStats: { flexDirection: 'row', gap: 12 },
  previewStat: { fontSize: fontSize.sm, color: colors.slate600, fontWeight: fontWeight.medium },
  clearBtn: {
    backgroundColor: colors.slate100, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  clearBtnText: { fontSize: fontSize.xs, color: colors.slate500, fontWeight: fontWeight.semibold },
})
