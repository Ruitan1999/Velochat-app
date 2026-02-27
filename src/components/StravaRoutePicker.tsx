import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, Modal,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  fetchStravaRoutes, StravaRoute,
  formatStravaDistance, formatStravaElevation,
  formatStravaTime, getStravaRouteType,
} from '../lib/strava'
import { RouteMap } from './RouteMap'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../lib/theme'
import { X as XIcon, Map, Star, Bike, Zap, ArrowUp, Timer, Frown } from 'lucide-react-native'

type StravaRoutePickerProps = {
  visible: boolean
  onClose: () => void
  onSelect: (route: StravaRoute) => void
}

export function StravaRoutePicker({ visible, onClose, onSelect }: StravaRoutePickerProps) {
  const [routes, setRoutes] = useState<StravaRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (visible) loadRoutes(1)
  }, [visible])

  const loadRoutes = async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStravaRoutes(p)
      if (p === 1) setRoutes(data)
      else setRoutes(prev => [...prev, ...data])
      setHasMore(data.length === 30)
      setPage(p)
    } catch (e) {
      setError('Failed to load Strava routes. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const renderRoute = ({ item }: { item: StravaRoute }) => (
    <TouchableOpacity
      style={styles.routeCard}
      onPress={() => { onSelect(item); onClose() }}
      activeOpacity={0.85}
    >
      {/* Route map thumbnail */}
      {item.map?.summary_polyline ? (
        <RouteMap
          polyline={item.map.summary_polyline}
          distanceKm={item.distance / 1000}
          elevationGainM={item.elevation_gain}
          size="card"
          style={styles.mapThumb}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Map size={14} color={colors.slate400} /><Text style={styles.mapPlaceholderText}>No preview</Text></View>
        </View>
      )}

      {/* Route info */}
      <View style={styles.routeInfo}>
        <View style={styles.routeHeader}>
          <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
          {item.starred && <Star size={14} color="#EAB308" fill="#EAB308" />}
        </View>

        <View style={styles.routeMeta}>
          <MetaBadge
            Icon={Bike}
            label={getStravaRouteType(item.type, item.sub_type)}
            color={colors.blue100}
            textColor={colors.blue700}
          />
          <MetaBadge
            Icon={Zap}
            label={formatStravaDistance(item.distance)}
            color={colors.slate100}
            textColor={colors.slate600}
          />
          {item.elevation_gain > 0 && (
            <MetaBadge
              Icon={ArrowUp}
              label={formatStravaElevation(item.elevation_gain)}
              color={colors.slate100}
              textColor={colors.slate600}
            />
          )}
          {item.estimated_moving_time > 0 && (
            <MetaBadge
              Icon={Timer}
              label={formatStravaTime(item.estimated_moving_time)}
              color={colors.slate100}
              textColor={colors.slate600}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.stravaLogo}>
              <Text style={styles.stravaLogoText}>S</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Strava Routes</Text>
              <Text style={styles.headerSub}>Select a saved route</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <XIcon size={14} color={colors.slate500} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {error ? (
          <View style={styles.errorState}>
            <Frown size={40} color={colors.slate400} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadRoutes(1)}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={routes}
            renderItem={renderRoute}
            keyExtractor={r => r.id.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? null : (
                <View style={styles.emptyState}>
                  <Map size={40} color={colors.slate400} />
                  <Text style={styles.emptyText}>No saved routes found</Text>
                  <Text style={styles.emptySubtext}>Save some routes on Strava first</Text>
                </View>
              )
            }
            ListFooterComponent={
              loading ? (
                <View style={styles.loader}>
                  <ActivityIndicator color={colors.blue500} />
                </View>
              ) : hasMore && routes.length > 0 ? (
                <TouchableOpacity style={styles.loadMore} onPress={() => loadRoutes(page + 1)}>
                  <Text style={styles.loadMoreText}>Load more routes</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

function MetaBadge({ Icon, label, color, textColor }: {
  Icon: React.ComponentType<any>; label: string; color: string; textColor: string
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
      <Icon size={11} color={textColor} />
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stravaLogo: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FC4C02',
    alignItems: 'center', justifyContent: 'center',
  },
  stravaLogoText: { fontSize: 18, fontWeight: fontWeight.black, color: colors.white },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  headerSub: { fontSize: fontSize.xs, color: colors.slate400 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: fontSize.sm, color: colors.slate500 },

  list: { padding: spacing.lg, gap: 12 },

  routeCard: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.slate200,
    overflow: 'hidden', ...shadow.sm,
  },
  mapThumb: { borderRadius: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  mapPlaceholder: {
    height: 100, backgroundColor: colors.slate100,
    alignItems: 'center', justifyContent: 'center',
  },
  mapPlaceholderText: { fontSize: fontSize.sm, color: colors.slate400 },

  routeInfo: { padding: spacing.md, gap: 8 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeName: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate900 },
  star: { fontSize: 14 },
  routeMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  loader: { padding: 24, alignItems: 'center' },
  loadMore: {
    margin: spacing.lg, padding: spacing.md,
    backgroundColor: colors.slate100, borderRadius: radius.lg, alignItems: 'center',
  },
  loadMoreText: { fontSize: fontSize.sm, color: colors.slate600, fontWeight: fontWeight.semibold },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { fontSize: fontSize.base, color: colors.slate600, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: colors.blue500, borderRadius: radius.lg,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryBtnText: { fontSize: fontSize.base, color: colors.white, fontWeight: fontWeight.bold },

  emptyState: { padding: 48, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.slate700 },
  emptySubtext: { fontSize: fontSize.sm, color: colors.slate400, marginTop: 4 },
})
