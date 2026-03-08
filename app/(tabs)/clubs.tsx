import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useAuth } from '../../src/lib/AuthContext'
import { useClubs } from '../../src/hooks/useData'
import { supabase, Club } from '../../src/lib/supabase'
import { Avatar, Card, Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/lib/theme'
import { getInitials } from '../../src/lib/utils'
import { Shield, Users, ChevronRight, X as XIcon, Camera } from 'lucide-react-native'

const CLUB_COLORS = [
  '#3B82F6', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2',
]

export default function ClubsScreen() {
  const { user } = useAuth()
  const { clubs, loading, refetch, createClub } = useClubs()
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'my' | 'discover'>('my')

  const myClubs = clubs.filter(c => c.is_member)
  const discover = clubs.filter(c => !c.is_member && c.visibility === 'public')

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch]),
  )

  const handleJoin = async (clubId: string) => {
    if (!user) return
    await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'member' })
    refetch()
  }

  if (loading && clubs.length === 0) {
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
          <Shield size={22} color={colors.slate900} />
          <Text style={styles.headerTitle}>Clubs</Text>
        </View>
        {myClubs.length > 0 && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'my' && styles.tabBtnActive]}
          onPress={() => setTab('my')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, tab === 'my' && styles.tabBtnTextActive]}>My Clubs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'discover' && styles.tabBtnActive]}
          onPress={() => setTab('discover')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, tab === 'discover' && styles.tabBtnTextActive]}>Discover</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue500} />}
      >
        {tab === 'my' && (
          <>
            {myClubs.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Shield size={36} color={colors.slate300} />
                <Text style={styles.emptyText}>You haven&apos;t joined any clubs</Text>
                <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
                  <Text style={styles.emptyCreateBtnText}>Create a Club</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myClubs.map(club => (
                <ClubCard key={club.id} club={club} isMember onPress={() => router.push(`/club/${club.id}`)} />
              ))
            )}
          </>
        )}

        {tab === 'discover' && (
          <>
            {discover.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Users size={36} color={colors.slate300} />
                <Text style={styles.emptyText}>No clubs discovered yet</Text>
              </View>
            ) : (
              discover.map(club => (
                <ClubCard
                  key={club.id} club={club} isMember={false}
                  onPress={() => router.push(`/club/${club.id}`)}
                  onJoin={() => handleJoin(club.id)}
                />
              ))
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <CreateClubModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (data) => {
          const result = await createClub(data)
          if (result?.error) {
            Alert.alert('Error', result.error.message ?? 'Failed to create club')
            return
          }
          const club = result?.club
          if (club && data.avatarImageUri) {
            try {
              const uri = data.avatarImageUri
              const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
              const filePath = `clubs/${club.id}/avatar.${ext}`
              const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
              await supabase.storage
                .from('avatars')
                .upload(filePath, decode(base64), {
                  contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                  upsert: true,
                })
              const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath)
              await supabase.from('clubs').update({ avatar_url: `${publicUrl.publicUrl}?t=${Date.now()}` }).eq('id', club.id)
              await refetch()
            } catch (err: any) {
              Alert.alert('Upload failed', err?.message ?? 'Club created but photo could not be uploaded')
            }
          }
          setShowCreate(false)
        }}
      />
    </SafeAreaView>
  )
}

function ClubCard({ club, isMember, onPress, onJoin }: {
  club: Club
  isMember: boolean
  onPress: () => void
  onJoin?: () => void
}) {
  return (
    <Card onPress={onPress} style={styles.clubCard}>
      <Avatar initials={club.avatar_initials} color={club.color} size="lg" uri={club.avatar_url} />
      <View style={styles.clubInfo}>
        <View style={styles.clubNameRow}>
          <Text style={styles.clubName}>{club.name}</Text>
          {isMember && (
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          )}
        </View>
        <View style={styles.clubMetaRow}>
          <Users size={11} color={colors.slate400} />
          <Text style={styles.clubMeta}>
            {(club.members?.length ?? club.member_count)} members
          </Text>
        </View>
      </View>
      {!isMember && onJoin ? (
        <TouchableOpacity style={styles.joinBtn} onPress={(e) => { e.stopPropagation?.(); onJoin() }}>
          <Text style={styles.joinBtnText}>Join</Text>
        </TouchableOpacity>
      ) : (
        <ChevronRight size={18} color={colors.slate300} />
      )}
    </Card>
  )
}

function CreateClubModal({ visible, onClose, onCreate }: {
  visible: boolean
  onClose: () => void
  onCreate: (data: {
    name: string; avatar_initials: string; color: string; description: string; visibility?: 'public' | 'private'; avatarImageUri?: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(CLUB_COLORS[0])
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)
  const [avatarImageUri, setAvatarImageUri] = useState<string | null>(null)

  const initials = getInitials(name) || '?'

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to add a club photo.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarImageUri(result.assets[0].uri)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    await onCreate({
      name: name.trim(),
      avatar_initials: initials,
      color,
      description: '',
      visibility,
      avatarImageUri: avatarImageUri ?? undefined,
    })
    setLoading(false)
    setName('')
    setColor(CLUB_COLORS[0])
    setVisibility('public')
    setAvatarImageUri(null)
  }

  const handleClose = () => {
    setAvatarImageUri(null)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        {/* Handle */}
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create a Club</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <XIcon size={14} color={colors.slate500} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Preview with optional avatar photo */}
          <View style={[styles.preview, { backgroundColor: color }]}>
            <TouchableOpacity onPress={handlePickAvatar} style={styles.previewAvatarWrap}>
              <Avatar initials={initials} color="rgba(255,255,255,0.25)" size="xl" uri={avatarImageUri ?? undefined} />
              <View style={styles.previewAvatarBadge}>
                <Camera size={16} color={colors.white} />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={styles.previewName}>{name || 'Club Name'}</Text>
              <Text style={styles.previewPhotoHint}>Tap to add club photo</Text>
            </View>
          </View>

          {/* Color picker */}
          <Text style={styles.fieldLabel}>Colour</Text>
          <View style={styles.colorRow}>
            {CLUB_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Club Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Eastside Velo"
            placeholderTextColor={colors.slate400}
            value={name}
            onChangeText={setName}
          />

          {/* Visibility */}
          <Text style={styles.fieldLabel}>Privacy</Text>
          <View style={styles.visibilityRow}>
            <TouchableOpacity
              style={[styles.visibilityPill, visibility === 'public' && styles.visibilityPillActive]}
              onPress={() => setVisibility('public')}
              activeOpacity={0.8}
            >
              <Text style={[styles.visibilityLabel, visibility === 'public' && styles.visibilityLabelActive]}>
                Public
              </Text>
              <Text style={styles.visibilitySub}>Anyone can discover and join</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.visibilityPill, visibility === 'private' && styles.visibilityPillActive]}
              onPress={() => setVisibility('private')}
              activeOpacity={0.8}
            >
              <Text style={[styles.visibilityLabel, visibility === 'private' && styles.visibilityLabelActive]}>
                Private
              </Text>
              <Text style={styles.visibilitySub}>Only invited riders can join</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button onPress={handleCreate} disabled={!name.trim()} loading={loading}>
            Create Club
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },
  createBtn: {
    backgroundColor: colors.blue50, borderWidth: 1, borderColor: colors.blue200,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  createBtnText: { fontSize: fontSize.sm, color: colors.blue600, fontWeight: fontWeight.bold },
  tabRow: {
    flexDirection: 'row', gap: 0,
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
  emptyWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 12,
  },
  emptyText: { fontSize: fontSize.base, color: colors.slate400 },
  emptyCreateBtn: {
    marginTop: 8, backgroundColor: colors.blue500,
    borderRadius: radius.full, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyCreateBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.white },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 10 },

  clubCard: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: 12,
  },
  clubInfo: { flex: 1, minWidth: 0 },
  clubNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  clubName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.slate900 },
  memberBadge: {
    backgroundColor: colors.blue100, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  memberBadgeText: { fontSize: 10, color: colors.blue600, fontWeight: fontWeight.medium },
  clubDesc: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 2 },
  clubMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  clubMeta: { fontSize: fontSize.xs, color: colors.slate400 },
  chevron: { fontSize: 22, color: colors.slate300 },
  joinBtn: {
    backgroundColor: colors.blue500, borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  joinBtnText: { fontSize: fontSize.sm, color: colors.white, fontWeight: fontWeight.bold },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.white },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.slate200, alignSelf: 'center', marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.slate900 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: fontSize.sm, color: colors.slate500 },
  modalBody: { flex: 1, padding: spacing.xl },
  modalFooter: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.slate100 },

  previewAvatarWrap: { position: 'relative' },
  previewAvatarBadge: {
    position: 'absolute', right: 0, bottom: 0,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewPhotoHint: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  preview: {
    borderRadius: radius.xl, padding: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: spacing.xl,
  },
  previewAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewInitials: { fontSize: 22, fontWeight: fontWeight.black, color: colors.white },
  previewName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.white },
  previewDesc: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  fieldLabel: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    color: colors.slate500, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: colors.slate400, transform: [{ scale: 1.15 }] },

  input: {
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 13,
    fontSize: fontSize.base, color: colors.slate800,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 12 },

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
})
