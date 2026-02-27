import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/AuthContext'
import { useClubs, useRiders } from '../src/hooks/useData'
import { supabase } from '../src/lib/supabase'
import { Avatar, Button } from '../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius, shadow } from '../src/lib/theme'
import { ChevronLeft, Check } from 'lucide-react-native'

const TIME_PRESETS = [
  { label: '5:45am', value: '05:45' },
  { label: '6:00am', value: '06:00' },
  { label: '6:30am', value: '06:30' },
  { label: 'Custom', value: 'custom' },
]

export default function NewRideScreen() {
  const { user, profile } = useAuth()
  const { clubs } = useClubs()
  const { riders } = useRiders()
  const myClubs = clubs.filter(c => c.is_member)

  const [title, setTitle] = useState('')
  const [dateChoice, setDateChoice] = useState<'tomorrow' | 'dayafter' | 'custom'>('tomorrow')
  const [customDate, setCustomDate] = useState('')
  const [timeChoice, setTimeChoice] = useState('06:00')
  const [customTime, setCustomTime] = useState('')
  const [location, setLocation] = useState('')
  const [inviteType, setInviteType] = useState<'club' | 'riders'>('club')
  const [selectedClub, setSelectedClub] = useState(myClubs[0]?.id ?? '')
  const [selectedRiders, setSelectedRiders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedClub && myClubs.length > 0) {
      setSelectedClub(myClubs[0].id)
    }
  }, [myClubs])

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2)
  const fmt = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  const dateOptions = [
    { key: 'tomorrow', label: 'Tomorrow', sub: fmt(tomorrow) },
    { key: 'dayafter', label: dayAfter.toLocaleDateString('en-AU', { weekday: 'long' }), sub: fmt(dayAfter) },
    { key: 'custom', label: 'Custom', sub: 'Pick date' },
  ]

  const resolvedDate = dateChoice === 'tomorrow' ? fmt(tomorrow) : dateChoice === 'dayafter' ? fmt(dayAfter) : customDate
  const resolvedTime = timeChoice === 'custom' ? customTime : timeChoice
  const canPost = title && resolvedDate && resolvedTime

  const toggleRider = (id: string) =>
    setSelectedRiders(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const handlePost = async () => {
    if (!canPost || !user) return
    setLoading(true)

    // Create ride
    const { data: ride, error } = await supabase.from('rides').insert({
      title,
      date: resolvedDate,
      time: resolvedTime,
      location: location || null,
      organizer_id: user.id,
      club_id: inviteType === 'club' ? selectedClub : null,
      invite_type: inviteType,
      chat_expiry: new Date(Date.now() + 24 * 3600000).toISOString(),
    }).select().single()

    if (error || !ride) {
      Alert.alert('Error', 'Failed to create ride.')
      setLoading(false)
      return
    }

    // Create associated chat room
    const { data: chatRoom } = await supabase.from('chat_rooms').insert({
      title,
      type: 'ride',
      ride_id: ride.id,
      club_id: inviteType === 'club' ? selectedClub : null,
      created_by: user.id,
      expiry: ride.chat_expiry,
    }).select().single()

    // Add participants
    if (chatRoom) {
      if (inviteType === 'club' && selectedClub) {
        // All club members
        const { data: members } = await supabase
          .from('club_members')
          .select('user_id')
          .eq('club_id', selectedClub)
        if (members && members.length > 0) {
          await supabase.from('chat_participants').insert(
            members.map((m: { user_id: string }) => ({ room_id: chatRoom.id, user_id: m.user_id }))
          )
        }
      } else {
        // Organiser + specific riders
        const participants: { room_id: string; user_id: string }[] = [
          { room_id: chatRoom.id, user_id: user.id },
          ...selectedRiders.map(id => ({ room_id: chatRoom.id, user_id: id })),
        ]
        await supabase.from('chat_participants').insert(participants)
      }
    }

    // Auto-RSVP organiser as "in"
    await supabase.from('ride_rsvps').insert({ ride_id: ride.id, user_id: user.id, status: 'in' })

    setLoading(false)
    router.back()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Group Ride</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {/* Title */}
        <Text style={styles.label}>Ride Name *</Text>
        <TextInput style={styles.input} placeholder="e.g. Dawn Patrol" placeholderTextColor={colors.slate400} value={title} onChangeText={setTitle} />

        {/* Date */}
        <Text style={styles.label}>Date *</Text>
        <View style={styles.optionGrid}>
          {dateOptions.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionBtn, dateChoice === opt.key && styles.optionBtnActive]}
              onPress={() => setDateChoice(opt.key as typeof dateChoice)}
            >
              <Text style={[styles.optionLabel, dateChoice === opt.key && styles.optionLabelActive]}>{opt.label}</Text>
              <Text style={[styles.optionSub, dateChoice === opt.key && styles.optionSubActive]}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {dateChoice === 'custom' && (
          <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={colors.slate400} value={customDate} onChangeText={setCustomDate} />
        )}

        {/* Time */}
        <Text style={styles.label}>Start Time *</Text>
        <View style={styles.timeGrid}>
          {TIME_PRESETS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.timeBtn, timeChoice === opt.value && styles.optionBtnActive]}
              onPress={() => setTimeChoice(opt.value)}
            >
              <Text style={[styles.timeBtnText, timeChoice === opt.value && styles.optionLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {timeChoice === 'custom' && (
          <TextInput style={styles.input} placeholder="HH:MM (24h)" placeholderTextColor={colors.slate400} value={customTime} onChangeText={setCustomTime} />
        )}

        {/* Location */}
        <Text style={styles.label}>Location (optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. Eastside Loop" placeholderTextColor={colors.slate400} value={location} onChangeText={setLocation} />

        {/* Invite */}
        <Text style={[styles.label, { marginTop: 20 }]}>Invite</Text>
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
        <Button onPress={handlePost} disabled={!canPost} loading={loading}>
          Post Ride
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

  optionGrid: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.slate200, backgroundColor: colors.slate50, alignItems: 'center',
  },
  optionBtnActive: { borderColor: colors.blue500, backgroundColor: colors.blue50 },
  optionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.slate700 },
  optionLabelActive: { color: colors.blue700 },
  optionSub: { fontSize: 10, color: colors.slate400, marginTop: 2 },
  optionSubActive: { color: colors.blue500 },

  timeGrid: { flexDirection: 'row', gap: 8 },
  timeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.slate200, backgroundColor: colors.slate50, alignItems: 'center',
  },
  timeBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.slate700 },

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
