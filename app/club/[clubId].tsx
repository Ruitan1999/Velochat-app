import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { useRides } from '../../src/hooks/useData'
import { supabase, Club, Profile } from '../../src/lib/supabase'
import { RideCard } from '../(tabs)/chats'
import { Avatar, Pill, Card, Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { ChevronLeft, Shield, Users, X as XIcon, Bike, UserPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react-native'

export default function ClubScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>()
  const { user } = useAuth()
  const { rides } = useRides()
  const [club, setClub] = useState<Club & { members?: { user_id: string; role: string; profile: Profile }[] } | null>(null)
  const [tab, setTab] = useState<'members' | 'rides'>('members')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showEditClub, setShowEditClub] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [allRiders, setAllRiders] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [editName, setEditName] = useState('')
  const [editHandle, setEditHandle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchClub = async () => {
    const { data } = await supabase
      .from('clubs')
      .select('*, members:club_members(user_id, role, profile:profiles(*))')
      .eq('id', clubId)
      .single()
    setClub(data)
  }

  const fetchRiders = async () => {
    const { data } = await supabase.from('profiles').select('*').neq('id', user?.id)
    setAllRiders(data ?? [])
  }

  useEffect(() => { fetchClub(); fetchRiders() }, [clubId])

  if (!club) return null

  const isAdmin = club.admin_id === user?.id
  const clubRides = rides.filter(r => r.club_id === club.id)
  const memberIds = (club.members ?? []).map(m => m.user_id)
  const nonMembers = allRiders.filter(r => !memberIds.includes(r.id))
  const filteredNonMembers = nonMembers.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleRemoveMember = async (userId: string) => {
    Alert.alert('Remove Member', 'Remove this rider from the club?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId)
          fetchClub()
        },
      },
    ])
  }

  const handleAddMember = async (userId: string) => {
    await supabase.from('club_members').insert({ club_id: clubId, user_id: userId, role: 'member' })
    fetchClub()
    setShowAddMember(false)
  }

  const openEditClub = () => {
    setMenuOpen(false)
    setEditName(club.name)
    setEditHandle(club.handle)
    setEditDescription(club.description ?? '')
    setShowEditClub(true)
  }

  const handleSaveClub = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Club name is required')
      return
    }
    setEditSaving(true)
    const initials = editName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    await supabase.from('clubs').update({
      name: editName.trim(),
      handle: editHandle.trim(),
      description: editDescription.trim() || null,
      avatar_initials: initials,
    }).eq('id', clubId)
    setEditSaving(false)
    setShowEditClub(false)
    fetchClub()
  }

  const handleDeleteClub = () => {
    setMenuOpen(false)
    Alert.alert('Delete Club', `Delete "${club.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('club_members').delete().eq('club_id', clubId)
          await supabase.from('clubs').delete().eq('id', clubId)
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
          <Text style={styles.headerHandle}>{club.handle}</Text>
        </View>
        {isAdmin && (
          <View style={styles.menuWrap}>
            <TouchableOpacity onPress={() => setMenuOpen(o => !o)} style={styles.menuBtn}>
              <MoreVertical size={20} color={colors.slate400} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={styles.dropdown}>
                <TouchableOpacity style={styles.dropdownItem} onPress={openEditClub}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pencil size={14} color={colors.slate700} /><Text style={styles.dropdownText}>Edit Club</Text></View>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={handleDeleteClub}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Trash2 size={14} color={colors.red600} /><Text style={[styles.dropdownText, { color: colors.red600 }]}>Delete Club</Text></View>
                </TouchableOpacity>
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
        <Avatar initials={club.avatar_initials} color="rgba(255,255,255,0.25)" size="xl" />
        <View>
          <Text style={styles.bannerName}>{club.name}</Text>
          {!!club.description && (
            <Text style={styles.bannerDesc}>{club.description}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: club.description ? 4 : 2 }}>
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
              size="md"
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {m.profile?.name ?? 'Unknown rider'}
                {m.user_id === user?.id ? <Text style={styles.youTag}> (you)</Text> : ''}
              </Text>
              <Text style={styles.memberHandle}>{m.profile?.handle ?? ''}</Text>
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
              <RideCard key={ride.id} ride={ride} />
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
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.editLabel}>Club Name</Text>
            <TextInput
              style={styles.searchInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Club name"
              placeholderTextColor={colors.slate400}
            />
            <Text style={styles.editLabel}>Handle</Text>
            <TextInput
              style={styles.searchInput}
              value={editHandle}
              onChangeText={setEditHandle}
              placeholder="@handle"
              placeholderTextColor={colors.slate400}
              autoCapitalize="none"
            />
            <Text style={styles.editLabel}>Description</Text>
            <TextInput
              style={[styles.searchInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 11 }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="What's this club about?"
              placeholderTextColor={colors.slate400}
              multiline
            />
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
            />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 8 }}>
            {filteredNonMembers.map(rider => (
              <Card key={rider.id} style={styles.riderRow}>
                <Avatar initials={rider.avatar_initials} color={rider.avatar_color} size="md" />
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>{rider.name}</Text>
                  <Text style={styles.riderHandle}>{rider.handle}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => handleAddMember(rider.id)}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </Card>
            ))}
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
  memberHandle: { fontSize: fontSize.xs, color: colors.slate400 },
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
  riderHandle: { fontSize: fontSize.xs, color: colors.slate400 },
  addBtn: { backgroundColor: colors.blue500, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 7 },
  addBtnText: { fontSize: fontSize.sm, color: colors.white, fontWeight: fontWeight.bold },

  editLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 4,
  },
})
