import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Modal, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { useClubs } from '../../src/hooks/useData'
import { supabase, Club } from '../../src/lib/supabase'
import { Avatar, Card, EmptyState, SectionLabel, Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../../src/lib/theme'
import { getInitials } from '../../src/lib/utils'
import { Shield, Users, ChevronRight, X as XIcon } from 'lucide-react-native'

const CLUB_COLORS = [
  '#3B82F6', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2',
]

export default function ClubsScreen() {
  const { user } = useAuth()
  const { clubs, loading, refetch, createClub } = useClubs()
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const myClubs = clubs.filter(c => c.is_member)
  const discover = clubs.filter(c => !c.is_member)

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleJoin = async (clubId: string) => {
    if (!user) return
    await supabase.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'member' })
    refetch()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clubs</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue500} />}
      >
        <SectionLabel>My Clubs</SectionLabel>
        {myClubs.length === 0
          ? <EmptyState icon={<Shield size={32} color={colors.slate400} />} text="You haven't joined any clubs" />
          : myClubs.map(club => (
            <ClubCard key={club.id} club={club} isMember onPress={() => router.push(`/club/${club.id}`)} />
          ))
        }

        {discover.length > 0 && (
          <>
            <SectionLabel style={{ marginTop: 20 }}>Discover</SectionLabel>
            {discover.map(club => (
              <ClubCard
                key={club.id} club={club} isMember={false}
                onPress={() => router.push(`/club/${club.id}`)}
                onJoin={() => handleJoin(club.id)}
              />
            ))}
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
          } else {
            setShowCreate(false)
          }
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
      <Avatar initials={club.avatar_initials} color={club.color} size="lg" />
      <View style={styles.clubInfo}>
        <View style={styles.clubNameRow}>
          <Text style={styles.clubName}>{club.name}</Text>
          {isMember && (
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          )}
        </View>
        {!!club.description && (
          <Text style={styles.clubDesc} numberOfLines={1}>{club.description}</Text>
        )}
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
  onCreate: (data: { name: string; handle: string; avatar_initials: string; color: string; description: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(CLUB_COLORS[0])
  const [loading, setLoading] = useState(false)

  const initials = getInitials(name) || '?'

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    await onCreate({
      name: name.trim(),
      handle: `@${name.toLowerCase().replace(/\s+/g, '')}`,
      avatar_initials: initials,
      color,
      description: description.trim(),
    })
    setLoading(false)
    setName('')
    setDescription('')
    setColor(CLUB_COLORS[0])
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>
        {/* Handle */}
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create a Club</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <XIcon size={14} color={colors.slate500} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {/* Preview */}
          <View style={[styles.preview, { backgroundColor: color }]}>
            <View style={styles.previewAvatar}>
              <Text style={styles.previewInitials}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.previewName}>{name || 'Club Name'}</Text>
              <Text style={styles.previewDesc}>{description || 'Club description...'}</Text>
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

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="What's your club about?"
            placeholderTextColor={colors.slate400}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.slate900 },
  createBtn: {
    backgroundColor: colors.blue50, borderWidth: 1, borderColor: colors.blue200,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  createBtnText: { fontSize: fontSize.sm, color: colors.blue600, fontWeight: fontWeight.bold },
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
})
