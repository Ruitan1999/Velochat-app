import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
const { decode } = require('base64-arraybuffer')
import * as FileSystem from 'expo-file-system/legacy'
import { useAuth } from '../src/lib/AuthContext'
import { supabase } from '../src/lib/supabase'
import { Avatar, Button } from '../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../src/lib/theme'
import {
  ChevronLeft, User, Mail, Shield,
  LogOut, ChevronRight, Camera,
} from 'lucide-react-native'

export default function ProfileScreen() {
  const { user, profile, updateProfile, signOut } = useAuth()

  const [name, setName] = useState(profile?.name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [saving, setSaving] = useState(false)

  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [avatarUploading, setAvatarUploading] = useState(false)

  const [accountVisibility, setAccountVisibility] = useState<'public' | 'private'>(
    (profile as any)?.visibility ?? 'public'
  )

  const handlePickAvatar = async () => {
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
      const filePath = `${user!.id}/avatar.${ext}`

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
      await updateProfile({ avatar_url: avatarUrl })
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required')
      return
    }
    setSaving(true)
    try {
      const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      await updateProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
        avatar_initials: initials,
        visibility: accountVisibility,
      })
      Alert.alert('Saved', 'Profile updated')
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return
    setEmailLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
      if (error) {
        Alert.alert('Error', error.message)
      } else {
        Alert.alert('Check your email', 'A confirmation link has been sent to your new email address.')
        setShowEmailChange(false)
        setNewEmail('')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update email')
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={28} color={colors.slate400} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={colors.blue500} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              <Avatar
                initials={profile?.avatar_initials ?? '?'}
                color={profile?.avatar_color}
                size="xl"
                uri={profile?.avatar_url}
              />
              <View style={styles.avatarCameraBadge}>
                {avatarUploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Camera size={14} color={colors.white} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarName}>{profile?.name}</Text>
          </View>

          {/* Profile Info */}
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <User size={16} color={colors.slate400} />
              <Text style={styles.fieldLabel}>Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.slate400}
            />

            <View style={[styles.fieldRow, { marginTop: 16 }]}>
              <User size={16} color={colors.slate400} />
              <Text style={styles.fieldLabel}>Bio</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Button onPress={handleSaveProfile} loading={saving} style={{ marginTop: 16 }}>
              Save Profile
            </Button>
          </View>

          {/* Account */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {/* Privacy */}
            <View style={styles.switchRow}>
              <View style={styles.menuItemLeft}>
                <Shield size={16} color={colors.slate400} />
                <View>
                  <Text style={styles.menuItemLabel}>Private account</Text>
                 
                </View>
              </View>
              <Switch
                value={accountVisibility === 'private'}
                onValueChange={async val => {
                  const next = val ? 'private' : 'public'
                  setAccountVisibility(next)
                  // persist immediately so toggle actually saves
                  try {
                    await updateProfile({ visibility: next as any })
                  } catch {
                    // ignore – AuthContext already surfaces most errors; UI stays in last state
                  }
                }}
                trackColor={{ false: colors.slate200, true: colors.blue200 }}
                thumbColor={accountVisibility === 'private' ? colors.blue500 : colors.slate400}
              />
            </View>

            <View style={styles.divider} />

            {/* Email */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowEmailChange(!showEmailChange)}
            >
              <View style={styles.menuItemLeft}>
                <Mail size={16} color={colors.slate400} />
                <View>
                  <Text style={styles.menuItemLabel}>Email</Text>
                  <Text style={styles.menuItemSub}>{user?.email}</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>

            {showEmailChange && (
              <View style={styles.expandedSection}>
                <TextInput
                  style={styles.input}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="New email address"
                  placeholderTextColor={colors.slate400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Button onPress={handleChangeEmail} loading={emailLoading} style={{ marginTop: 8 }}>
                  Update Email
                </Button>
              </View>
            )}
          </View>

          {/* Danger zone */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={16} color={colors.red600} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => router.push('/delete-account')}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.slate900 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: 8 },

  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatarCameraBadge: {
    position: 'absolute', bottom: 0, right: -4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.blue500,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  avatarName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.slate900, marginTop: 12 },
  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate200, padding: spacing.lg,
  },

  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.slate500 },
  input: {
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 11,
    fontSize: fontSize.base, color: colors.slate800,
  },
  textArea: { minHeight: 70, paddingTop: 11 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuItemLabel: { fontSize: fontSize.base, color: colors.slate800 },
  menuItemSub: { fontSize: fontSize.xs, color: colors.slate400, marginTop: 1 },

  expandedSection: { paddingTop: 4, paddingBottom: 8 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },

  divider: { height: 1, backgroundColor: colors.slate100, marginVertical: 2 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, marginTop: 16,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.red200,
  },
  signOutText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.red600 },
  deleteBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteText: {
    fontSize: fontSize.sm,
    color: colors.slate400,
    textDecorationLine: 'underline',
  },
})
