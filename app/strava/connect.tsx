import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { connectStrava, disconnectStrava, isStravaConnected } from '../../src/lib/strava'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { ChevronLeft, Map, MapPin, MessageCircle, Zap, Check } from 'lucide-react-native'

export default function StravaConnectScreen() {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    isStravaConnected().then(c => { setConnected(c); setLoading(false) })
  }, [])

  const handleConnect = async () => {
    setWorking(true)
    const result = await connectStrava()
    setWorking(false)
    if (result.success) {
      setConnected(true)
      Alert.alert('Connected! 🎉', 'Your Strava account is now linked. You can import routes when posting rides.')
    } else {
      Alert.alert('Connection failed', result.error ?? 'Something went wrong.')
    }
  }

  const handleDisconnect = () => {
    Alert.alert('Disconnect Strava', 'This will remove access to your Strava routes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive',
        onPress: async () => {
          await disconnectStrava()
          setConnected(false)
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue500} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Strava Integration</Text>
      </View>

      <View style={styles.content}>
        {/* Strava branding card */}
        <View style={styles.brandCard}>
          <View style={styles.stravaLogo}>
            <Text style={styles.stravaLogoText}>S</Text>
          </View>
          <Text style={styles.brandTitle}>Strava</Text>
          <Text style={styles.brandSub}>Import your saved routes directly into VeloChat ride posts</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {[
            { Icon: Map, text: 'Browse all your saved Strava routes' },
            { Icon: MapPin, text: 'Route map auto-displays on ride cards' },
            { Icon: MessageCircle, text: 'Route visible to everyone in ride chat' },
            { Icon: Zap, text: 'Distance and elevation auto-filled' },
          ].map((f, i) => (
            <View key={i} style={styles.feature}>
              <f.Icon size={20} color={colors.slate600} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Connect / Disconnect button */}
        {connected ? (
          <View style={styles.connectedArea}>
            <View style={styles.connectedBadge}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Check size={16} color="#16A34A" /><Text style={styles.connectedBadgeText}>Connected to Strava</Text></View>
            </View>
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={working}
            activeOpacity={0.85}
          >
            {working ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.connectBtnText}>Connect with Strava</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.privacyNote}>
          VeloChat only reads your saved routes. We never post to Strava or access your activity data.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 28, color: colors.slate400, lineHeight: 32 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },

  content: { flex: 1, padding: spacing.xl, gap: 20 },

  brandCard: {
    backgroundColor: colors.white, borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.slate200,
    padding: spacing.xl, alignItems: 'center', gap: 10,
    ...shadow.md,
  },
  stravaLogo: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FC4C02',
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
  stravaLogoText: { fontSize: 32, fontWeight: fontWeight.black, color: colors.white },
  brandTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },
  brandSub: { fontSize: fontSize.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20 },

  features: {
    backgroundColor: colors.white, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.slate200, padding: spacing.lg, gap: 14,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { fontSize: 20, width: 28 },
  featureText: { fontSize: fontSize.base, color: colors.slate700, flex: 1 },

  connectBtn: {
    backgroundColor: '#FC4C02', borderRadius: radius.xl,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#FC4C02', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  connectBtnText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.white },

  connectedArea: { gap: 12 },
  connectedBadge: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: radius.xl, paddingVertical: 14, alignItems: 'center',
  },
  connectedBadgeText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: '#16A34A' },
  disconnectBtn: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.xl,
    paddingVertical: 12, alignItems: 'center',
  },
  disconnectBtnText: { fontSize: fontSize.sm, color: colors.slate500, fontWeight: fontWeight.medium },

  privacyNote: {
    fontSize: fontSize.xs, color: colors.slate400,
    textAlign: 'center', lineHeight: 18,
  },
})
