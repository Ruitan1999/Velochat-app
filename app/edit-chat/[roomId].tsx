import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { supabase, ChatRoom } from '../../src/lib/supabase'
import { Button } from '../../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../../src/lib/theme'
import { ChevronLeft } from 'lucide-react-native'

export default function EditChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const { user } = useAuth()
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!roomId) return
    supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single()
      .then(({ data }) => {
        if (data) {
          setRoom(data)
          setTitle(data.title ?? '')
          setDescription(data.description ?? '')
        }
        setLoading(false)
      })
  }, [roomId])

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required')
      return
    }
    setSaving(true)

    const { error } = await supabase
      .from('chat_rooms')
      .update({ title: title.trim(), description: description.trim() || null })
      .eq('id', roomId)

    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    if (room?.ride_id) {
      await supabase
        .from('rides')
        .update({ title: title.trim() })
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

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this chat about?"
            placeholderTextColor={colors.slate400}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
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
  textArea: {
    minHeight: 100, paddingTop: 13,
  },
  footer: {
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
})
