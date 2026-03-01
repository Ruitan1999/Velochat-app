import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
const { decode } = require('base64-arraybuffer')
import * as FileSystem from 'expo-file-system/legacy'
import { useAuth } from '../../src/lib/AuthContext'
import { useRides, useClubs, useRiders } from '../../src/hooks/useData'
import { supabase, Club, Profile } from '../../src/lib/supabase'
import { RideCard } from '../(tabs)/chats'
import { Avatar, Pill, Card, Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { ChevronLeft, Shield, Users, X as XIcon, Bike, UserPlus, MoreVertical, Pencil, Trash2, Camera } from 'lucide-react-native'

export default function ClubScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string | string[] }>()
  const { user } = useAuth()
  const { rides, refetch: refetchRides } = useRides()
  const { refetch: refetchClubs } = useClubs()
  const { riders, isFriend } = useRiders()
  const [club, setClub] = useState<Club & { members?: { user_id: string; role: string; profile: Profile }[] } | null>(null)
  const [tab, setTab] = useState<'members' | 'rides'>('members')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showEditClub, setShowEditClub] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editName, setEditName] = useState('')
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private')
  const [editSaving, setEditSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const normalizedClubId = Array.isArray(clubId) ? clubId[0] : clubId

  const fetchClub = async () => {
    if (!normalizedClubId) return
    const { data } = await supabase
      .from('clubs')
      .select('*, members:club_members(user_id, role, profile:profiles(*))')
      .eq('id', normalizedClubId)
      .single()
    setClub(data)
  }

  useEffect(() => { fetchClub() }, [clubId])

  if (!club) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.slate400} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Club</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.emptyText}>Loading club...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isAdmin = club.admin_id === user?.id
  const isMember = (club.members ?? []).some(m => m.user_id === user?.id)
  const clubRides = rides.filter(r => r.club_id === club.id)
  const memberIds = (club.members ?? []).map(m => m.user_id)

  const matchesSearch = (r: Profile) => {
    const q = search.toLowerCase()
    if (!q) return true
    return r.name.toLowerCase().includes(q)
  }

  // Friends list for this user
  const friendProfiles = riders.filter(r => isFriend(r.id))

  // Friends, annotated with membership
  const friendCandidates = friendProfiles.map(r => ({
    profile: r,
    isMember: memberIds.includes(r.id),
  })).filter(fc => matchesSearch(fc.profile))

  // Discoverable riders (not already members, not current user, not already in friends section)
  const discoverBase = riders.filter(r =>
    !memberIds.includes(r.id) &&
    r.id !== user?.id &&
    !isFriend(r.id),
  )

  // For discover: by default, only public profiles; when searching, allow private matches
  const discoverCandidates = discoverBase.filter(r => {
    const q = search.toLowerCase()
    if (!q) {
      return ((r as any).visibility ?? 'public') === 'public'
    }
    return matchesSearch(r)
  })

  const handleRemoveMember = async (userId: string) => {
    Alert.alert('Remove Member', 'Remove this rider from the club?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          if (!normalizedClubId) return
          await supabase.from('club_members').delete().eq('club_id', normalizedClubId).eq('user_id', userId)
          fetchClub()
        },
      },
    ])
  }

  const handleAddMember = async (userId: string) => {
    if (!normalizedClubId) return
    await supabase.from('club_members').insert({ club_id: normalizedClubId, user_id: userId, role: 'member' })
    fetchClub()
    setShowAddMember(false)
  }

  const openEditClub = () => {
    setMenuOpen(false)
    setEditName(club.name)
    setEditVisibility((club.visibility as 'public' | 'private') ?? 'private')
    setShowEditClub(true)
  }

  const handleSaveClub = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Club name is required')
      return
    }
    if (!normalizedClubId) return
    setEditSaving(true)
    try {
      const initials = editName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      const { error } = await supabase.from('clubs').update({
        name: editName.trim(),
        avatar_initials: initials,
        visibility: editVisibility,
      }).eq('id', normalizedClubId)
      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to update club')
        return
      }
      setShowEditClub(false)
      fetchClub()
      refetchClubs()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update club')
    } finally {
      setEditSaving(false)
    }
  }

  const handlePickClubAvatar = async () => {
    if (!normalizedClubId || !isAdmin) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    setAvatarUploading(true)
    try {
      const uri = result.assets[0].uri
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filePath = `clubs/${normalizedClubId}/avatar.${ext}`
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        })
      if (uploadError) throw uploadError
      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const avatarUrl = `${publicUrl.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase.from('clubs').update({ avatar_url: avatarUrl }).eq('id', normalizedClubId)
      if (updateError) throw updateError
      setClub(prev => prev ? { ...prev, avatar_url: avatarUrl } : null)
      refetchClubs()
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleDeleteClub = () => {
    setMenuOpen(false)
    Alert.alert('Delete Club', `Delete "${club.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!normalizedClubId) return
          await supabase.from('club_members').delete().eq('club_id', normalizedClubId)
          await supabase.from('clubs').delete().eq('id', normalizedClubId)
          router.replace('/(tabs)/clubs')
        },
      },
    ])
  }

  const handleLeaveClub = () => {
    if (!normalizedClubId || !user?.id) return
    setMenuOpen(false)
    Alert.alert('Leave Club', 'Are you sure you want to leave this club?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('club_members')
            .delete()
            .eq('club_id', normalizedClubId)
            .eq('user_id', user.id)
          router.replace('/(tabs)/clubs')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{club.name}</Text>
        </View>
        {(isAdmin || isMember) && (
          <View style={styles.menuWrap}>
            <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={styles.menuBtn}>
              <MoreVertical size={20} color={colors.slate400} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={styles.dropdown}>
                {isAdmin && (
                  <>
                    <TouchableOpacity style={styles.dropdownItem} onPress={openEditClub}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Pencil size={14} color={colors.slate700} />
                        <Text style={styles.dropdownText}>Edit Club</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.dropdownDivider} />
                    <TouchableOpacity style={styles.dropdownItem} onPress={handleDeleteClub}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Trash2 size={14} color={colors.red600} />
                        <Text style={[styles.dropdownText, { color: colors.red600 }]}>Delete Club</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {!isAdmin && isMember && (
                  <TouchableOpacity style={styles.dropdownItem} onPress={handleLeaveClub}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <XIcon size={14} color={colors.red600} />
                      <Text style={[styles.dropdownText, { color: colors.red600 }]}>Leave Club</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {menuOpen && (
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        />
      )}

      {/* Club banner */}
      <View style={[styles.banner, { backgroundColor: club.color }]}>
        <Avatar initials={club.avatar_initials} color="rgba(255,255,255,0.25)" size="xl" uri={club.avatar_url} />
        <View>
          <Text style={styles.bannerName}>{club.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Users size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.bannerMeta}>
              {(club.members?.length ?? club.member_count)} members
            </Text>
          </View>
        </View>
      </View>

      {/* Sub tabs */}
      <View style={styles.tabBar}>
        <Pill label="Members" active={tab === 'members'} onPress={() => setTab('members')} />
        <Pill label="Rides" active={tab === 'rides'} onPress={() => setTab('rides')} />
        {isAdmin && (
          <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowAddMember(true)}>
            <Text style={styles.addMemberText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {tab === 'members' && (club.members ?? []).map(m => (
          <Card key={m.user_id} style={styles.memberCard}>
            <Avatar
              initials={m.profile?.avatar_initials ?? '?'}
              color={m.profile?.avatar_color}
              uri={m.profile?.avatar_url}
              size="md"
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.user_id === user?.id ? 'You' : (m.profile?.name ?? 'Unknown rider')}
              </Text>
            </View>
            {m.role === 'admin' && (
              <View style={styles.roleBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Shield size={9} color={colors.amber600} /><Text style={styles.roleBadgeText}>Admin</Text></View>
              </View>
            )}
            {isAdmin && m.user_id !== user?.id && (
              <TouchableOpacity onPress={() => handleRemoveMember(m.user_id)} style={styles.removeBtn}>
                <XIcon size={14} color={colors.slate400} />
              </TouchableOpacity>
            )}
          </Card>
        ))}

        {tab === 'rides' && (
          clubRides.length === 0 ? (
            <View style={styles.emptyRides}>
              <Bike size={32} color={colors.slate400} />
              <Text style={styles.emptyText}>No rides for this club yet</Text>
            </View>
          ) : (
            clubRides.map(ride => (
              <RideCard key={ride.id} ride={ride} onRideDeleted={refetchRides} />
            ))
          )
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Club Modal */}
      <Modal visible={showEditClub} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditClub(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Club</Text>
            <TouchableOpacity onPress={() => setShowEditClub(false)} style={styles.closeBtn}>
              <XIcon size={14} color={colors.slate500} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={styles.editAvatarRow}>
              <TouchableOpacity
                onPress={handlePickClubAvatar}
                disabled={avatarUploading}
                style={styles.editAvatarWrap}
              >
                <Avatar initials={club.avatar_initials} color={club.color} size="xl" uri={club.avatar_url} />
                {avatarUploading ? (
                  <View style={styles.editAvatarOverlay}>
                    <ActivityIndicator size="small" color={colors.white} />
                  </View>
                ) : (
                  <View style={styles.editAvatarBadge}>
                    <Camera size={16} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.editAvatarHint}>Club photo</Text>
            </View>

            <Text style={styles.editLabel}>Club Name</Text>
            <TextInput
              style={styles.searchInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Club name"
              placeholderTextColor={colors.slate400}
            />

            <Text style={styles.editLabel}>Privacy</Text>
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityPill, editVisibility === 'public' && styles.visibilityPillActive]}
                onPress={() => setEditVisibility('public')}
                activeOpacity={0.8}
              >
                <Text style={[styles.visibilityLabel, editVisibility === 'public' && styles.visibilityLabelActive]}>
                  Public
                </Text>
                <Text style={styles.visibilitySub}>Anyone can discover and join</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityPill, editVisibility === 'private' && styles.visibilityPillActive]}
                onPress={() => setEditVisibility('private')}
                activeOpacity={0.8}
              >
                <Text style={[styles.visibilityLabel, editVisibility === 'private' && styles.visibilityLabelActive]}>
                  Private
                </Text>
                <Text style={styles.visibilitySub}>Only invited riders can join</Text>
              </TouchableOpacity>
            </View>

            <Button onPress={handleSaveClub} loading={editSaving} style={{ marginTop: 8 }}>
              Save Changes
            </Button>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMember(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Members</Text>
            <TouchableOpacity onPress={() => setShowAddMember(false)} style={styles.closeBtn}>
              <XIcon size={14} color={colors.slate500} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search riders..."
              placeholderTextColor={colors.slate400}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }}>
            {/* Friends section */}
            {friendCandidates.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={styles.sectionHeading}>Friends</Text>
                {friendCandidates.map(({ profile: rider, isMember }) => (
                  <Card key={rider.id} style={styles.riderRow}>
                    <Avatar initials={rider.avatar_initials} color={rider.avatar_color} uri={rider.avatar_url} size="md" />
                    <View style={styles.riderInfo}>
                      <Text style={styles.riderName}>{rider.id === user?.id ? 'You' : rider.name}</Text>
                    </View>
                    {isMember ? (
                      <View style={styles.inClubPill}>
                        <Text style={styles.inClubPillText}>In club</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => handleAddMember(rider.id)}>
                        <Text style={styles.addBtnText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </Card>
                ))}
              </View>
            )}

            {/* Discover section */}
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionHeading}>Discover riders</Text>
              {discoverCandidates.length === 0 && (
                <Text style={styles.emptyText}>No riders to add.</Text>
              )}
              {discoverCandidates.map(rider => (
                <Card key={rider.id} style={styles.riderRow}>
                  <Avatar
                    initials={rider.avatar_initials}
                    color={rider.avatar_color}
                    uri={rider.avatar_url}
                    size="md"
                  />
                  <View style={styles.riderInfo}>
                    <Text style={styles.riderName}>{rider.id === user?.id ? 'You' : rider.name}</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn} onPress={() => handleAddMember(rider.id)}>
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
    zIndex: 100,
  },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 28, color: colors.slate400, lineHeight: 32 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate900 },
  headerHandle: { fontSize: fontSize.xs, color: colors.slate400 },
  menuWrap: { position: 'relative' },
  menuBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dropdown: {
    position: 'absolute', right: 0, top: 36,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200,
    zIndex: 100, minWidth: 170, elevation: 6,
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 13 },
  dropdownText: { fontSize: fontSize.base, color: colors.slate700 },
  dropdownDivider: { height: 1, backgroundColor: colors.slate100 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl,
  },
  bannerName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.white },
  bannerDesc: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  bannerMeta: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)' },

  tabBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.slate100, backgroundColor: colors.white,
  },
  addMemberBtn: {
    marginLeft: 'auto', backgroundColor: colors.blue50, borderWidth: 1, borderColor: colors.blue200,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  addMemberText: { fontSize: fontSize.xs, color: colors.blue600, fontWeight: fontWeight.bold },

  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 12 },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 12 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate900 },
  youTag: { fontWeight: fontWeight.normal, color: colors.slate400 },
  roleBadge: { backgroundColor: colors.amber50, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 10, color: colors.amber600, fontWeight: fontWeight.semibold },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: fontSize.sm, color: colors.slate400 },

  emptyRides: { alignItems: 'center', paddingVertical: 56 },
  emptyText: { fontSize: fontSize.base, color: colors.slate400, marginTop: 8 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.white },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate200, alignSelf: 'center', marginTop: 12 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.slate900 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: fontSize.sm, color: colors.slate500 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  searchInput: { backgroundColor: colors.slate100, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 11, fontSize: fontSize.base, color: colors.slate800 },

  riderRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 12 },
  riderInfo: { flex: 1 },
  riderName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate900 },
  addBtn: { backgroundColor: colors.blue500, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7 },
  addBtnText: { fontSize: fontSize.sm, color: colors.white, fontWeight: fontWeight.bold },

  editAvatarRow: { alignItems: 'center', marginBottom: 8 },
  editAvatarWrap: { position: 'relative' },
  editAvatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  editAvatarBadge: {
    position: 'absolute', right: 0, bottom: 0,
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blue500,
    alignItems: 'center', justifyContent: 'center',
  },
  editAvatarHint: { fontSize: fontSize.xs, color: colors.slate500, marginTop: 6 },
  editLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 4,
  },
  visibilityRow: { marginTop: spacing.md, gap: 10 },
  visibilityPill: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate200,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.slate50,
  },
  visibilityPillActive: {
    backgroundColor: colors.blue50,
    borderColor: colors.blue200,
  },
  visibilityLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.slate700,
  },
  visibilityLabelActive: {
    color: colors.blue700,
  },
  visibilitySub: {
    fontSize: fontSize.xs,
    color: colors.slate500,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inClubPill: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.slate100,
  },
  inClubPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.slate500,
  },
})
