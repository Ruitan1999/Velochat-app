import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/AuthContext'
import { supabase } from '../src/lib/supabase'
import { Avatar, Button } from '../src/components/ui'
import { colors, spacing, fontSize, fontWeight, radius } from '../src/lib/theme'
import {
  ChevronLeft, Camera, User, Mail, Lock, Bell,
  BellOff, MessageCircle, Bike, Users, LogOut, ChevronRight,
} from 'lucide-react-native'

export default function ProfileScreen() {
  const { user, profile, updateProfile, signOut } = useAuth()

  const [name, setName] = useState(profile?.name ?? '')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [saving, setSaving] = useState(false)

  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [notifRides, setNotifRides] = useState(true)
  const [notifMessages, setNotifMessages] = useState(true)
  const [notifFriends, setNotifFriends] = useState(true)

  const [avatarUploading, setAvatarUploading] = useState(false)

  const handlePickAvatar = async () => {
    if (!user) return

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to update your profile image.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    })

    if (result.canceled || !result.assets?.length) return

    try {
      setAvatarUploading(true)
      const asset = result.assets[0]
      const fileExt = asset.uri.split('.').pop() || 'jpg'
      const filePath = `${user.id}/${Date.now()}.${fileExt}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true })

      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message)
        setAvatarUploading(false)
        return
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      await updateProfile({ avatar_url: publicUrl })
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Something went wrong while uploading your image.')
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
    const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    await updateProfile({
      name: name.trim(),
      handle: handle.trim(),
      bio: bio.trim() || undefined,
      avatar_initials: initials,
    })
    setSaving(false)
    Alert.alert('Saved', 'Profile updated')
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Check your email', 'A confirmation link has been sent to your new email address.')
      setShowEmailChange(false)
      setNewEmail('')
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }
    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Done', 'Password updated successfully')
      setShowPasswordChange(false)
      setNewPassword('')
      setConfirmPassword('')
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
            <View style={styles.avatarWrap}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Avatar initials={profile?.avatar_initials ?? '?'} color={profile?.avatar_color} size="xl" />
              )}
              <TouchableOpacity
                style={styles.cameraBtn}
                activeOpacity={0.8}
                onPress={handlePickAvatar}
                disabled={avatarUploading}
              >
                {avatarUploading
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <Camera size={16} color={colors.white} />}
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarName}>{profile?.name}</Text>
            <Text style={styles.avatarHandle}>{profile?.handle}</Text>
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
              <Text style={[styles.fieldLabel, { marginLeft: 0 }]}>@</Text>
              <Text style={styles.fieldLabel}>Handle</Text>
            </View>
            <TextInput
              style={styles.input}
              value={handle}
              onChangeText={setHandle}
              placeholder="@yourhandle"
              placeholderTextColor={colors.slate400}
              autoCapitalize="none"
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

            <View style={styles.divider} />

            {/* Password */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowPasswordChange(!showPasswordChange)}
            >
              <View style={styles.menuItemLeft}>
                <Lock size={16} color={colors.slate400} />
                <Text style={styles.menuItemLabel}>Password</Text>
              </View>
              <ChevronRight size={16} color={colors.slate300} />
            </TouchableOpacity>

            {showPasswordChange && (
              <View style={styles.expandedSection}>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  placeholderTextColor={colors.slate400}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor={colors.slate400}
                  secureTextEntry
                />
                <Button onPress={handleChangePassword} loading={passwordLoading} style={{ marginTop: 8 }}>
                  Update Password
                </Button>
              </View>
            )}
          </View>

          {/* Notifications */}
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.menuItemLeft}>
                <Bike size={16} color={colors.blue500} />
                <Text style={styles.menuItemLabel}>Ride invites</Text>
              </View>
              <Switch
                value={notifRides}
                onValueChange={setNotifRides}
                trackColor={{ false: colors.slate200, true: colors.blue200 }}
                thumbColor={notifRides ? colors.blue500 : colors.slate400}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.menuItemLeft}>
                <MessageCircle size={16} color={colors.cyan500} />
                <Text style={styles.menuItemLabel}>Chat messages</Text>
              </View>
              <Switch
                value={notifMessages}
                onValueChange={setNotifMessages}
                trackColor={{ false: colors.slate200, true: colors.blue200 }}
                thumbColor={notifMessages ? colors.blue500 : colors.slate400}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.menuItemLeft}>
                <Users size={16} color={colors.violet500} />
                <Text style={styles.menuItemLabel}>Friend requests</Text>
              </View>
              <Switch
                value={notifFriends}
                onValueChange={setNotifFriends}
                trackColor={{ false: colors.slate200, true: colors.blue200 }}
                thumbColor={notifFriends ? colors.blue500 : colors.slate400}
              />
            </View>
          </View>

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <LogOut size={16} color={colors.red600} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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
  content: { padding: spacing.lg, gap: 8 },

  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: -4,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.blue500, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  avatarName: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.slate900, marginTop: 12 },
  avatarHandle: { fontSize: fontSize.sm, color: colors.slate400, marginTop: 2 },

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
})
