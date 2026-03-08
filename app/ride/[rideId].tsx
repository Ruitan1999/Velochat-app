import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { supabase, Ride } from '../../src/lib/supabase'
import { Avatar, AvatarStack, CountdownBadge, Card } from '../../src/components/ui'
import { RouteMap, ElevationProfile } from '../../src/components/RouteMap'
import { decodePolyline } from '../../src/lib/parsers/routeParsers'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { fmtTime } from '../../src/lib/utils'
import { ChevronLeft, MoreVertical, Pencil, Trash2, Calendar, Clock, Zap, MapPin, Map, Check, X, MessageCircle, ChevronRight } from 'lucide-react-native'

export default function RideScreen() {
  const { rideId: rideIdParam } = useLocalSearchParams<{ rideId: string | string[] }>()
  const rideId = typeof rideIdParam === 'string' ? rideIdParam : rideIdParam?.[0]
  const { user } = useAuth()
  const [ride, setRide] = useState<Ride | null>(null)
  const [headerRefreshing, setHeaderRefreshing] = useState(false)
  const [myRsvp, setMyRsvp] = useState<'in' | 'out' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const fetchRide = async () => {
    if (!rideId) return
    const { data } = await supabase
      .from('rides')
      .select(`
        *,
        organizer:profiles!organizer_id(id,name,avatar_initials,avatar_color,avatar_url),
        rsvps:ride_rsvps(*, profile:profiles!user_id(id,name,avatar_initials,avatar_color,avatar_url)),
        chat_room:chat_rooms(*)
      `)
      .eq('id', rideId)
      .single()
    setRide(data)
    setHeaderRefreshing(false)
    const myR = data?.rsvps?.find((r: { user_id: string }) => r.user_id === user?.id)
    setMyRsvp(myR?.status ?? null)
  }

  useEffect(() => { fetchRide() }, [rideId])

  useFocusEffect(
    useCallback(() => {
      setHeaderRefreshing(true)
      fetchRide()
    }, [rideId]),
  )

  const handleRsvp = async (status: 'in' | 'out') => {
    if (!user) return
    const newStatus = myRsvp === status ? null : status
    setMyRsvp(newStatus) // optimistic
    if (newStatus === null) {
      await supabase.from('ride_rsvps').delete().eq('ride_id', rideId).eq('user_id', user.id)
    } else {
      await supabase.from('ride_rsvps').upsert(
        { ride_id: rideId, user_id: user.id, status: newStatus },
        { onConflict: 'ride_id,user_id' }
      )
    }
    fetchRide()
  }

  const handleDelete = () => {
    setMenuOpen(false)
    Alert.alert('Delete Ride', `Delete "${ride?.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.rpc('delete_ride', { p_ride_id: rideId })
          router.back()
        },
      },
    ])
  }

  if (!rideId || !ride) return null

  const isOwner = ride.organizer_id === user?.id
  const inRiders = ride.rsvps?.filter(r => r.status === 'in') ?? []
  const outRiders = ride.rsvps?.filter(r => r.status === 'out') ?? []

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerRefreshing ? '...' : (ride?.title ?? '...')}</Text>
        {isOwner && (
          <View style={styles.menuWrap}>
            <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={styles.menuBtn}>
              <MoreVertical size={20} color={colors.slate400} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={styles.dropdown}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setMenuOpen(false)
                    // Edit screen not typed in router config yet, navigate by string
                    router.push(`/ride/${rideId}` as any)
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pencil size={14} color={colors.slate700} /><Text style={styles.dropdownText}>Edit Ride</Text></View>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={handleDelete}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Trash2 size={14} color={colors.red600} /><Text style={[styles.dropdownText, styles.dropdownDanger]}>Delete</Text></View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Ride details card */}
        <Card style={styles.detailCard}>
          <View style={styles.typeBadgeRow}>
            <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>Group Ride</Text></View>
            <CountdownBadge expiry={ride.chat_expiry} />
          </View>
          <Text style={styles.rideTitle}>{ride.title}</Text>
          <View style={styles.metaGrid}>
            {ride.date && <MetaItem icon={Calendar} value={ride.date} />}
            <MetaItem icon={Clock} value={fmtTime(ride.time)} />
            {ride.distance && <MetaItem icon={Zap} value={ride.distance} />}
            {ride.location && <MetaItem icon={MapPin} value={ride.location} />}
          </View>
          {/* Route map */}
          {ride.route_polyline && (
            <View style={styles.routeSection}>
              {ride.route_name && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Map size={14} color={colors.slate600} /><Text style={styles.routeLabel}>{ride.route_name}</Text></View>
              )}
              <RouteMap
                polyline={ride.route_polyline}
                distanceKm={ride.route_distance_km ?? undefined}
                elevationGainM={ride.route_elevation_m ?? undefined}
                size="full"
                style={{ marginTop: 6 }}
              />
            </View>
          )}

          {ride.organizer && (
            <View style={styles.organizer}>
              <Avatar
                initials={ride.organizer.avatar_initials}
                color={ride.organizer.avatar_color}
                uri={ride.organizer.avatar_url}
                size="sm"
              />
              <Text style={styles.organizerLabel}>Organised by <Text style={{ fontWeight: fontWeight.semibold }}>{ride.organizer_id === user?.id ? 'You' : ride.organizer?.name}</Text></Text>
            </View>
          )}
        </Card>

        {/* RSVP */}
        <View style={styles.rsvpRow}>
          <TouchableOpacity
            style={[styles.rsvpBtn, styles.rsvpOutline, myRsvp === 'in' && styles.rsvpInActive]}
            onPress={() => handleRsvp('in')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
              <Check size={16} color={myRsvp === 'in' ? colors.white : colors.slate400} />
              <Text style={[styles.rsvpText, myRsvp === 'in' ? styles.rsvpTextActive : styles.rsvpTextInactive]}>
                I&apos;m In · {inRiders.length}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rsvpBtn, styles.rsvpOutline, myRsvp === 'out' && styles.rsvpOutActive]}
            onPress={() => handleRsvp('out')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
              <X size={16} color={myRsvp === 'out' ? colors.white : colors.slate400} />
              <Text style={[styles.rsvpText, myRsvp === 'out' ? styles.rsvpTextActive : styles.rsvpTextInactive]}>
                I&apos;m Out · {outRiders.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Riders in */}
        {inRiders.length > 0 && (
          <Card style={styles.ridersCard}>
            <Text style={styles.ridersLabel}>Riding ({inRiders.length})</Text>
            {inRiders.map(r => (
              <View key={r.user_id} style={styles.riderRow}>
                <Avatar
                  initials={r.profile?.avatar_initials ?? '?'}
                  color={r.profile?.avatar_color}
                  uri={r.profile?.avatar_url}
                  size="sm"
                />
                <Text style={styles.riderName}>{r.user_id === user?.id ? 'You' : r.profile?.name}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Open Ride Chat */}
        <TouchableOpacity
          style={styles.chatEntry}
          onPress={() => ride.chat_room && router.push(`/chat/${ride.chat_room.id}`)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><MessageCircle size={18} color={colors.white} /><Text style={styles.chatEntryText}>Open Ride Chat</Text></View>
          <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function MetaItem({ icon: Icon, value }: { icon: React.ComponentType<any>; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Icon size={14} color={colors.slate400} />
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  menuWrap: { position: 'relative' },
  menuBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dropdown: {
    position: 'absolute', right: 0, top: 36,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
    ...shadow.lg, zIndex: 99, minWidth: 160,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13 },
  dropdownText: { fontSize: fontSize.base, color: colors.slate700 },
  dropdownDanger: { color: colors.red600 },
  dropdownDivider: { height: 1, backgroundColor: colors.slate100 },

  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 12 },

  detailCard: { padding: spacing.lg, gap: 10 },
  typeBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeBadge: {
    backgroundColor: colors.blue100, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  typeBadgeText: { fontSize: fontSize.xs, color: colors.blue700, fontWeight: fontWeight.medium },
  rideTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaValue: { fontSize: fontSize.sm, color: colors.slate500 },
  organizer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, marginTop: 4,
  },
  organizerLabel: { fontSize: fontSize.sm, color: colors.slate400 },
  routeSection: { marginTop: 4 },
  routeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.slate600 },

  rsvpRow: { flexDirection: 'row', gap: 10 },
  rsvpBtn: {
    flex: 1, paddingVertical: 13, borderRadius: radius.lg,
    alignItems: 'center', borderWidth: 2,
  },
  rsvpOutline: { backgroundColor: colors.white, borderColor: colors.slate200 },
  rsvpInActive: { backgroundColor: colors.blue500, borderColor: colors.blue500 },
  rsvpOutActive: { backgroundColor: colors.red500, borderColor: colors.red500 },
  rsvpText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  rsvpTextActive: { color: colors.white },
  rsvpTextInactive: { color: colors.slate400 },

  ridersCard: { padding: spacing.lg, gap: 10 },
  ridersLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.slate700 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riderName: { fontSize: fontSize.base, color: colors.slate800 },

  chatEntry: {
    backgroundColor: colors.blue500, borderRadius: radius.xl,
    paddingVertical: 15, paddingHorizontal: spacing.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...shadow.blue,
  },
  chatEntryText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.white },
})
