import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'

import { supabase, ChatRoom } from '../../src/lib/supabase'
import { Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/lib/theme'
import { ChevronLeft } from 'lucide-react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'

export default function EditChatScreen() {
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string | string[] }>()
  const roomId = typeof roomIdParam === 'string' ? roomIdParam : roomIdParam?.[0]

  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  const formatTime = (d: Date) => {
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    return `${hh}:${mm}`
  }

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }
    let isMounted = true

    const load = async () => {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (!isMounted) return
      if (error) {
        Alert.alert('Error', error.message ?? 'Failed to load chat room')
        setLoading(false)
        return
      }

      setRoom(data)

      // Default to chat room title
      let initialTitle = data?.title ?? ''

      // For ride chats, prefer the current ride title so everything stays in sync
      if (data?.ride_id) {
        const { data: ride } = await supabase
          .from('rides')
          .select('title, date, time, location')
          .eq('id', data.ride_id)
          .single()
        if (!isMounted) return
        if (ride) {
          if (ride.title) {
            initialTitle = ride.title
          }
          setDate(ride.date ?? '')
          setTime(ride.time ?? '')
          setLocation(ride.location ?? '')
        }
      }

      setTitle(initialTitle)
      setLoading(false)
    }

    load()
    return () => { isMounted = false }
  }, [roomId])

  const handleSave = async () => {
    if (!roomId) return
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('chat_rooms')
      .update({ title: title.trim() })
      .eq('id', roomId)

    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    if (room?.ride_id) {
      await supabase
        .from('rides')
        .update({
          title: title.trim(),
          date: date.trim() || null,
          time: time.trim() || null,
          location: location.trim() || null,
        })
        .eq('id', room.ride_id)
    }

    router.back()
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.blue500} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  const isRide = room?.type === 'ride'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit {isRide ? 'Ride' : 'Chat Room'}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Chat room title"
            placeholderTextColor={colors.slate400}
          />
          {isRide && (
            <>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.input}
                activeOpacity={0.8}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={date ? styles.inputText : styles.inputPlaceholder}>
                  {date || 'Select date'}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false)
                    }
                    if (selectedDate) {
                      setDate(formatDate(selectedDate))
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Start Time</Text>
              <TouchableOpacity
                style={styles.input}
                activeOpacity={0.8}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={time ? styles.inputText : styles.inputPlaceholder}>
                  {time || 'Select time'}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                    if (Platform.OS === 'android') {
                      setShowTimePicker(false)
                    }
                    if (selectedDate) {
                      setTime(formatTime(selectedDate))
                    }
                  }}
                />
              )}

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Eastside Loop"
                placeholderTextColor={colors.slate400}
              />
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button onPress={handleSave} loading={saving} disabled={!title.trim()}>
            Save Changes
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
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  scroll: { flex: 1 },
  content: { padding: spacing.xl, gap: 6 },
  label: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 13,
    fontSize: fontSize.base, color: colors.slate800,
  },
  inputText: {
    fontSize: fontSize.base,
    color: colors.slate800,
  },
  inputPlaceholder: {
    fontSize: fontSize.base,
    color: colors.slate400,
  },
  footer: {
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
})
