import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useAuth } from '../../src/lib/AuthContext'
import { colors, spacing, radius, fontSize, fontWeight } from '../../src/lib/theme'
import { Button } from '../../src/components/ui'
import { ChevronLeft } from 'lucide-react-native'
import { getSignupAvatarLocalUri, clearSignupDraft } from '../../src/lib/signupDraft'
import { uploadAvatarFromUri } from '../../src/lib/avatarUpload'
import { supabase } from '../../src/lib/supabase'

const CODE_LENGTH = 8
const RESEND_COOLDOWN_SEC = 60

export default function OtpScreen() {
  const params = useLocalSearchParams<{ email: string; flow?: string; name?: string; newEmail?: string }>()
  const email = params.email ?? ''
  const flow = params.flow ?? 'login'
  const name = params.name ?? ''
  const newEmail = params.newEmail ?? ''
  const { verifyOtp, requestLoginOtp, requestSignUpOtp, refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SEC)
  const [resendLoading, setResendLoading] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const attemptedCodeRef = useRef<string | null>(null)

  // If we landed here without an email (e.g. app reload), go straight to login
  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/login')
    }
  }, [email])

  // Countdown for resend cooldown (avoids hitting Supabase email rate limit)
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (digits.length < CODE_LENGTH) attemptedCodeRef.current = null
  }

  const handleVerify = useCallback(async (inputCode?: string) => {
    const codeToVerify = (inputCode ?? code).replace(/\D/g, '').slice(0, CODE_LENGTH)

    if (loading) return

    if (codeToVerify.length !== CODE_LENGTH) {
      Alert.alert('Invalid code', `Please enter the ${CODE_LENGTH}-digit code from your email.`)
      return
    }

    attemptedCodeRef.current = codeToVerify
    setLoading(true)

    try {
      const { error, userId } = await verifyOtp(email, codeToVerify)
      if (error) {
        attemptedCodeRef.current = null
        Alert.alert('Verification failed', error.message)
        return
      }

      if (flow === 'email-change') {
        const targetEmail = (newEmail as string)?.trim().toLowerCase()
        if (!targetEmail) {
          Alert.alert('Error', 'Missing new email to update.')
          return
        }
        const { error: updateError } = await supabase.auth.updateUser({ email: targetEmail })
        if (updateError) {
          Alert.alert('Error', updateError.message ?? 'Failed to update email')
          return
        }
        Alert.alert('Email updated', 'Your email has been updated. If required, check your new inbox to confirm the change.')
        router.replace('/(tabs)/profile')
        return
      }

      // Navigate first so Root Layout is fully in control, then do signup avatar in background.
      const navDelayMs = 150
      setTimeout(() => {
        router.replace('/(tabs)/chats')
      }, navDelayMs)

      if (flow === 'signup' && userId) {
        const localUri = getSignupAvatarLocalUri()
        clearSignupDraft()
        if (localUri) {
          // Run after navigation so we don't trigger "navigate before mount" from this stack.
          setTimeout(async () => {
            try {
              const avatarUrl = await uploadAvatarFromUri({ userId, localUri })
              await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
              await refreshProfile(userId)
            } catch {
              // Optional — user can set avatar later in Profile.
            }
          }, navDelayMs + 50)
        }
      }
    } catch (error) {
      attemptedCodeRef.current = null
      const message = error instanceof Error ? error.message : 'Something went wrong while verifying the code.'
      Alert.alert('Verification failed', message)
    } finally {
      setLoading(false)
    }
  }, [code, email, flow, loading, newEmail, refreshProfile, verifyOtp])

  // Slightly delay auto-verify so iOS paste/autofill can finish updating the native input first.
  useEffect(() => {
    if (code.length !== CODE_LENGTH || code === attemptedCodeRef.current || loading) return
    const t = setTimeout(() => {
      void handleVerify(code)
    }, 150)
    return () => clearTimeout(t)
  }, [code, loading, handleVerify])

  const handleBackToLogin = () => {
    router.replace('/(auth)/login')
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    const { error } = flow === 'signup'
      ? await requestSignUpOtp(email, name || email)
      : await requestLoginOtp(email)
    setResendLoading(false)
    if (error) {
      const isRateLimit = /rate limit|rate_limit|429|too many requests/i.test(error.message)
      Alert.alert(
        'Could not resend code',
        isRateLimit ? 'Too many requests. Please wait about a minute before trying again.' : error.message
      )
      return
    }
    setResendCooldown(RESEND_COOLDOWN_SEC)
  }

  if (!email) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.blue500} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeft size={28} color={colors.slate700} />
        </TouchableOpacity>
        <View style={styles.inner}>
          <Text style={styles.logo}>
            <Text style={{ color: colors.blue500 }}>Velo</Text>
            <Text style={{ color: colors.slate900 }}>Chat</Text>
          </Text>

          <Text style={styles.heading}>
            {flow === 'email-change' ? 'Verify email change' : 'Check your email'}
          </Text>
          <Text style={styles.subheading}>
            {flow === 'email-change'
              ? (
                <>
                  Enter the 8-digit code we sent to your current email{' '}
                  <Text style={styles.email}>{email}</Text>
                  . After this, we&apos;ll update your login email.
                </>
              )
              : (
                <>
                  We sent an 8-digit code to{' '}
                  <Text style={styles.email}>{email}</Text>
                </>
              )
            }
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="00000000"
            placeholderTextColor={colors.slate400}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            selectTextOnFocus
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            textAlign="left"
            selectionColor={colors.blue500}
          />
          <Text style={styles.expiryHint}>Your verification code expires in 10 minutes.</Text>

          <Button onPress={handleVerify} loading={loading} style={styles.submitBtn} disabled={code.length !== CODE_LENGTH}>
            Verify
          </Button>

          {resendCooldown > 0 ? (
            <Text style={styles.resendCooldown}>Resend code in {resendCooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendCode} disabled={resendLoading} style={styles.resendLink}>
              <Text style={styles.resendText}>{resendLoading ? 'Sending…' : 'Resend code'}</Text>
            </TouchableOpacity>
          )}

          {flow !== 'email-change' && (
            <TouchableOpacity onPress={handleBackToLogin} style={styles.resendLink}>
              <Text style={styles.resendText}>Wrong email? Go back and try again</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  keyboard: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 8,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 40,
  },
  logo: { fontSize: 36, fontFamily: 'Inter-ExtraBold', letterSpacing: -1, marginBottom: 32 },
  heading: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.slate900,
    marginBottom: 4,
  },
  subheading: {
    fontSize: fontSize.sm,
    color: colors.slate500,
    marginBottom: 28,
  },
  email: { fontWeight: fontWeight.semibold, color: colors.slate700 },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 2,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    fontSize: 28,
    letterSpacing: 4,
    textAlign: 'left',
    color: colors.slate900,
    marginBottom: 8,
  },
  expiryHint: {
    fontSize: fontSize.sm,
    color: colors.slate500,
    marginBottom: 24,
  },
  submitBtn: { marginBottom: 16 },
  resendCooldown: { fontSize: fontSize.sm, color: colors.slate400, textAlign: 'center', marginBottom: 12 },
  resendLink: { alignSelf: 'center', marginBottom: 8 },
  resendText: { fontSize: fontSize.sm, color: colors.blue500, fontWeight: fontWeight.medium },
  error: { fontSize: fontSize.sm, color: colors.slate600, textAlign: 'center', marginBottom: 16 },
  backLink: { alignSelf: 'center' },
  backLinkText: { fontSize: fontSize.sm, color: colors.blue500, fontWeight: fontWeight.semibold },
})
