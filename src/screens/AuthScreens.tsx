import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, fontSize, fontWeight, getAvatarColor } from '../lib/theme'
import { Button } from '../components/ui'
import { ChevronLeft } from 'lucide-react-native'
import { AvatarPicker } from '../components/AvatarPicker'
import { getSignupAvatarLocalUri, setSignupAvatarLocalUri } from '../lib/signupDraft'

// ─── Login Screen ─────────────────────────────────────────────

export function LoginScreen() {
  const { requestLoginOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.')
      return
    }
    setLoading(true)
    const { error } = await requestLoginOtp(email.trim())
    setLoading(false)
    if (error) {
      const msg = (error.message ?? (error as any)?.error_description ?? String(error)).toLowerCase()
      const isRateLimit = /rate limit|rate_limit|429|too many requests/.test(msg)
      const shouldRedirectToSignup = /not allowed|signup disabled|signup_disabled|user not found|user_not_found|does not exist|sign up/.test(msg)
      if (!isRateLimit && shouldRedirectToSignup) {
        router.replace({
          pathname: '/(auth)/signup',
          params: { email: email.trim().toLowerCase() },
        })
        return
      }
      Alert.alert(
        'Could not send code',
        isRateLimit ? 'Too many requests. Please wait about a minute before requesting another code.' : (error.message ?? String(error))
      )
      return
    }
    router.replace({ pathname: '/(auth)/otp', params: { email: email.trim().toLowerCase(), flow: 'login' } })
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={[styles.logo, Platform.OS === 'ios' && { paddingTop: 30 }]}>
          <Text style={{ color: colors.blue500 }}>Velo</Text>
          <Text style={{ color: colors.slate900 }}>Chat</Text>
        </Text>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Sign in with a code sent to your email</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.slate400}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <Button onPress={handleSendCode} loading={loading} style={styles.submitBtn}>
          Send code
        </Button>

        <TouchableOpacity onPress={() => router.push('/signup')} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Don&apos;t have an account?{' '}
            <Text style={styles.switchHighlight}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Sign Up Screen ───────────────────────────────────────────

export function SignUpScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const { requestSignUpOtp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.email ?? '')
  const [loading, setLoading] = useState(false)
  const [avatarLocalUri, setAvatarLocalUriState] = useState<string | null>(() => getSignupAvatarLocalUri())

  // Pre-fill email when coming from login (user tried to sign in but doesn't have an account)
  useEffect(() => {
    if (params.email) setEmail(params.email)
  }, [params.email])

  const avatarInitials = name.trim()
    ? name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'
  const avatarColor = getAvatarColor(avatarInitials)

  const setAvatarLocalUri = (uri: string | null) => {
    setAvatarLocalUriState(uri)
    setSignupAvatarLocalUri(uri)
  }

  const handleSendCode = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Missing fields', 'Please enter your name and email.')
      return
    }
    setLoading(true)
    const { error } = await requestSignUpOtp(email.trim(), name.trim())
    setLoading(false)
    if (error) {
      const msg = (error.message ?? String(error)).toLowerCase()
      const isRateLimit = /rate limit|rate_limit|429|too many requests/.test(msg)
      const isSignupDisabled = /not allowed|sign up disabled/.test(msg)
      let body = error.message ?? String(error)
      if (isRateLimit) body = 'Too many requests. Please wait about a minute before requesting another code.'
      else if (isSignupDisabled) body = "Sign ups are disabled for this app. In Supabase Dashboard go to: Authentication → Providers → Email and ensure signups are enabled, or Project Settings → Auth and turn on 'Allow new users to sign up'."
      Alert.alert('Could not send code', body)
      return
    }
    router.replace({
      pathname: '/(auth)/otp',
      params: { email: email.trim().toLowerCase(), flow: 'signup', name: name.trim() },
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ChevronLeft size={28} color={colors.slate700} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={[styles.logo, Platform.OS === 'ios' && { paddingTop: 30 }]}>
            <Text style={{ color: colors.blue500 }}>Velo</Text>
            <Text style={{ color: colors.slate900 }}>Chat</Text>
          </Text>

          <Text style={styles.heading}>Create account</Text>
          <Text style={styles.subheading}>Name and email, then we’ll send you a code</Text>

          <View style={styles.avatarSection}>
            <AvatarPicker
              initials={avatarInitials}
              color={avatarColor}
              uri={avatarLocalUri}
              size="xl"
              onPickedUri={async (uri) => setAvatarLocalUri(uri)}
            />
            <Text style={styles.avatarHint}>Avatar (optional)</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor={colors.slate400}
              value={name}
              onChangeText={setName}
              textContentType="name"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.slate400}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <Button onPress={handleSendCode} loading={loading} style={styles.submitBtn}>
            Send code
          </Button>

          <TouchableOpacity onPress={() => router.back()} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchHighlight}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────

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
    flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40,
    paddingTop: 56,
  },

  logo: { fontSize: 36, fontFamily: 'Inter-ExtraBold', letterSpacing: -1, marginBottom: 16 },

  heading: {
    fontSize: 24, fontWeight: fontWeight.bold,
    color: colors.slate900, marginBottom: 4,
  },
  subheading: {
    fontSize: fontSize.sm, color: colors.slate400,
    marginBottom: 28,
  },

  avatarSection: { alignItems: 'center', marginBottom: 18 },
  avatarHint: { marginTop: 10, fontSize: fontSize.sm, color: colors.slate400 },

  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    color: colors.slate500, marginBottom: 6, marginLeft: 2,
  },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: 13,
    fontSize: fontSize.base, color: colors.slate800,
  },

  submitBtn: { marginTop: 8 },

  switchLink: { marginTop: 24 },
  switchText: { fontSize: fontSize.sm, color: colors.slate500 },
  switchHighlight: { color: colors.blue500, fontWeight: fontWeight.bold },
})
