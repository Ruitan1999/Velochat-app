import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
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
  const [sub, setSub] = useState<'discover' | 'friends'>('friends')

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Refresh riders/friends whenever this tab/screen gains focus
  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch]),
  )

  const friends = riders.filter(r => isFriend(r.id))
  const baseDiscover = riders.filter(r => !isFriend(r.id) && r.id !== user?.id)

  const matchesSearch = (r: Profile) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      r.name.toLowerCase().includes(q) ||
      (r as any).email?.toLowerCase().includes(q)
    )
  }

  const filteredFriends = friends.filter(matchesSearch)

  // Discover: by default only public profiles; when searching, allow private profiles that match
  const filteredDiscover = baseDiscover.filter(r => {
    const q = search.toLowerCase()
    if (!q) {
      return (r.visibility ?? 'public') === 'public'
    }
    return matchesSearch(r)
  })

  if (loading && riders.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={colors.blue500} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Users size={22} color={colors.slate900} />
          <Text style={styles.headerTitle}>Riders</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, sub === 'friends' && styles.tabBtnActive]}
          onPress={() => setSub('friends')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, sub === 'friends' && styles.tabBtnTextActive]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, sub === 'discover' && styles.tabBtnActive]}
          onPress={() => setSub('discover')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, sub === 'discover' && styles.tabBtnTextActive]}>Discover</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
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
        {sub === 'friends' ? (
          <>
            {filteredFriends.length === 0 && (
              <EmptyState
                icon={<Users size={32} color={colors.slate400} />}
                text="No friends yet"
              />
            )}
            {filteredFriends.map(rider => (
              <RiderCard
                key={rider.id}
                rider={rider}
                isFriend
                onAdd={() => addFriend(rider.id)}
                onRemove={() => {
                  const fid = getFriendshipId(rider.id)
                  if (fid) removeFriend(fid)
                }}
              />
            ))}
          </>
        ) : (
          <>
            {filteredDiscover.length === 0 && (
              <EmptyState
                icon={<Users size={32} color={colors.slate400} />}
                text="No riders to discover"
              />
            )}
            {filteredDiscover.map(rider => (
              <RiderCard
                key={rider.id}
                rider={rider}
                isFriend={false}
                onAdd={() => addFriend(rider.id)}
                onRemove={() => {
                  const fid = getFriendshipId(rider.id)
                  if (fid) removeFriend(fid)
                }}
              />
            ))}
          </>
        )}
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
  const { user } = useAuth()
  return (
    <Card style={styles.riderCard}>
      <Avatar
        initials={rider.avatar_initials}
        color={rider.avatar_color}
        uri={rider.avatar_url}
        size="md"
      />
      <View style={styles.riderInfo}>
        <Text style={styles.riderName}>{rider.id === user?.id ? 'You' : rider.name}</Text>
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
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  tabBtn: {
    flex: 1, alignItems: 'center',
    paddingTop: 12, paddingBottom: 10,
    marginBottom: -1,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.blue500 },
  tabBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.slate400 },
  tabBtnTextActive: { color: colors.blue600 },
  searchWrap: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.slate100, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 42,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.slate800 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 8 },

  riderCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: 12,
  },
  riderInfo: { flex: 1 },
  riderName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate900 },
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
