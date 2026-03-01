import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ChevronLeft, AlertTriangle } from 'lucide-react-native'
import { useAuth } from '../src/lib/AuthContext'
import { supabase } from '../src/lib/supabase'
import { colors, spacing, fontSize, fontWeight } from '../src/lib/theme'

export default function DeleteAccountScreen() {
  const { user, signOut } = useAuth()
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login')
    }
  }, [user])

  const handleDelete = () => {
    if (!user) return
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, rides, chats, clubs, and all related data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              const { error } = await supabase.rpc('delete_current_user')
              if (error) {
                Alert.alert('Error', error.message ?? 'Failed to delete account')
                setDeleting(false)
                return
              }
              await signOut()
              router.replace('/(auth)/login')
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to delete account')
              setDeleting(false)
            }
          },
        },
      ]
    )
  }

  if (!user) {
    return null
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={28} color={colors.slate400} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={48} color={colors.red500} />
        </View>
        <Text style={styles.title}>Permanently delete your account?</Text>
        <Text style={styles.description}>
          Your profile, rides, chat rooms, club memberships, and all associated data will be removed. This action cannot be undone.
        </Text>

        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={deleting}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.slate900 },

  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.red50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.slate900,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.slate600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl * 2,
  },
  deleteBtn: {
    backgroundColor: colors.red600,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteBtnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.base,
    color: colors.slate600,
  },
})
