import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/AuthContext'
import { useClubs, useRiders } from '../src/hooks/useData'
import { supabase } from '../src/lib/supabase'
import { Avatar, Button } from '../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../src/lib/theme'
import { ChevronLeft, Check } from 'lucide-react-native'

export default function NewChatScreen() {
  const { user } = useAuth()
  const { clubs } = useClubs()
  const { riders } = useRiders()
  const myClubs = clubs.filter(c => c.is_member)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [inviteType, setInviteType] = useState<'club' | 'riders'>('club')
  const [selectedClub, setSelectedClub] = useState(myClubs[0]?.id ?? '')
  const [selectedRiders, setSelectedRiders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedClub && myClubs.length > 0) {
      setSelectedClub(myClubs[0].id)
    }
  }, [myClubs])

  const toggleRider = (id: string) =>
    setSelectedRiders(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const handleCreate = async () => {
    if (!title.trim() || !user) return
    setLoading(true)

    const { data: room, error } = await supabase.from('chat_rooms').insert({
      title: title.trim(),
      description: description.trim() || null,
      type: 'general',
      club_id: inviteType === 'club' ? selectedClub : null,
      created_by: user.id,
      expiry: new Date('2099-12-31').toISOString(),
    }).select().single()

    if (error || !room) {
      Alert.alert('Error', 'Failed to create chat room.')
      setLoading(false)
      return
    }

    // Add all club members as participants
    if (inviteType === 'club' && selectedClub) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .eq('club_id', selectedClub)
      if (members && members.length > 0) {
        await supabase.from('chat_participants').insert(
          members.map((m: { user_id: string }) => ({ room_id: room.id, user_id: m.user_id }))
        )
      }
    } else {
      await supabase.from('chat_participants').insert({ room_id: room.id, user_id: user.id })
      if (inviteType === 'riders' && selectedRiders.length > 0) {
        await supabase.from('chat_participants').insert(
          selectedRiders.map(uid => ({ room_id: room.id, user_id: uid }))
        )
      }
    }

    setLoading(false)
    router.replace(`/chat/${room.id}`)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start a Chat Room</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Room Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. Kit & Gear Talk" placeholderTextColor={colors.slate400} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="What's this room about?" placeholderTextColor={colors.slate400} value={description} onChangeText={setDescription} multiline />

        <Text style={styles.label}>Invite</Text>
        <View style={styles.inviteToggle}>
          {[{ key: 'club', label: 'Whole Club' }, { key: 'riders', label: 'Specific Riders' }].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.inviteBtn, inviteType === opt.key && styles.inviteBtnActive]}
              onPress={() => setInviteType(opt.key as 'club' | 'riders')}
            >
              <Text style={[styles.inviteBtnText, inviteType === opt.key && styles.inviteBtnTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {inviteType === 'club' && myClubs.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.selectable, selectedClub === c.id && styles.selectableActive]}
            onPress={() => setSelectedClub(c.id)}
          >
            <Avatar initials={c.avatar_initials} color={c.color} size="sm" />
            <Text style={[styles.selectableText, selectedClub === c.id && { color: colors.blue700 }]}>{c.name}</Text>
            {selectedClub === c.id && <Check size={16} color={colors.blue500} />}
          </TouchableOpacity>
        ))}

        {inviteType === 'riders' && riders.map(r => (
          <TouchableOpacity
            key={r.id}
            style={[styles.selectable, selectedRiders.includes(r.id) && styles.selectableActive]}
            onPress={() => toggleRider(r.id)}
          >
            <Avatar initials={r.avatar_initials} color={r.avatar_color} size="sm" />
            <Text style={[styles.selectableText, selectedRiders.includes(r.id) && { color: colors.blue700 }]}>{r.name}</Text>
            {selectedRiders.includes(r.id) && <Check size={16} color={colors.blue500} />}
          </TouchableOpacity>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleCreate} disabled={!title.trim()} loading={loading}>
          Start Chat Room
        </Button>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  backArrow: { fontSize: 28, color: colors.slate400, lineHeight: 32 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: 6 },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 13,
    fontSize: fontSize.base, color: colors.slate800,
  },
  inviteToggle: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  inviteBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.slate200, alignItems: 'center' },
  inviteBtnActive: { borderColor: colors.blue500, backgroundColor: colors.blue50 },
  inviteBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.slate600 },
  inviteBtnTextActive: { color: colors.blue700 },
  selectable: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.slate200, backgroundColor: colors.slate50, marginBottom: 6,
  },
  selectableActive: { borderColor: colors.blue500, backgroundColor: colors.blue50 },
  selectableText: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.slate700 },
  checkmark: { fontSize: fontSize.base, color: colors.blue500, fontWeight: fontWeight.bold },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.slate200, backgroundColor: colors.white },
})
