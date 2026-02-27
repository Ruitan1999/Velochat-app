import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRiders } from '../../src/hooks/useData'
import { useAuth } from '../../src/lib/AuthContext'
import { Avatar, Card, EmptyState } from '../../src/components/ui'
import { Profile } from '../../src/lib/supabase'
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/lib/theme'
import { Search, Users, Check, UserPlus } from 'lucide-react-native'

export default function RidersScreen() {
  const { user } = useAuth()
  const { riders, loading, refetch, addFriend, removeFriend, isFriend, getFriendshipId } = useRiders()
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const friends = riders.filter(r => isFriend(r.id))
  // Search across all riders by name / handle / email
  const filtered = riders.filter(r => {
    const q = search.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.handle.toLowerCase().includes(q) ||
      (r as any).email?.toLowerCase().includes(q)
    )
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Riders</Text>
      </View>

      <View style={styles.controls}>
        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={14} color={colors.slate400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search riders..."
            placeholderTextColor={colors.slate400}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue500} />}
      >
        {filtered.length === 0 && (
          <EmptyState
            icon={<Users size={32} color={colors.slate400} />}
            text="No riders found"
          />
        )}
        {filtered.map(rider => (
          <RiderCard
            key={rider.id}
            rider={rider}
            isFriend={isFriend(rider.id)}
            onAdd={() => addFriend(rider.id)}
            onRemove={() => {
              const fid = getFriendshipId(rider.id)
              if (fid) removeFriend(fid)
            }}
          />
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function RiderCard({ rider, isFriend, onAdd, onRemove }: {
  rider: Profile
  isFriend: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  return (
    <Card style={styles.riderCard}>
      <Avatar initials={rider.avatar_initials} color={rider.avatar_color} size="md" />
      <View style={styles.riderInfo}>
        <Text style={styles.riderName}>{rider.name}</Text>
        <Text style={styles.riderHandle}>{rider.handle}</Text>
      </View>
      <TouchableOpacity
        style={[styles.friendBtn, isFriend ? styles.friendBtnActive : styles.friendBtnDefault]}
        onPress={isFriend ? onRemove : onAdd}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {isFriend ? <Check size={14} color={colors.slate500} /> : <UserPlus size={14} color={colors.white} />}
          <Text style={[styles.friendBtnText, isFriend ? styles.friendBtnTextActive : styles.friendBtnTextDefault]}>
            {isFriend ? 'Friends' : 'Add'}
          </Text>
        </View>
      </TouchableOpacity>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },

  controls: {
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.slate100, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.md,
    marginTop: spacing.md, height: 42,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.slate800 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 8 },

  riderCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: 12,
  },
  riderInfo: { flex: 1 },
  riderName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate900 },
  riderHandle: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 1 },

  friendBtn: {
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 8,
  },
  friendBtnDefault: { backgroundColor: colors.blue500 },
  friendBtnActive: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
  },
  friendBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  friendBtnTextDefault: { color: colors.white },
  friendBtnTextActive: { color: colors.slate500 },
})
