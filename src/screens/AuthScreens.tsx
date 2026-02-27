import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../lib/AuthContext'
import { colors, spacing, radius, fontSize, fontWeight } from '../lib/theme'
import { Button } from '../components/ui'

// ─── Login Screen ─────────────────────────────────────────────

export function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) Alert.alert('Login failed', error.message)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          <Text style={{ color: colors.blue500 }}>Velo</Text>
          <Text style={{ color: colors.slate900 }}>Chat</Text>
        </Text>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Sign in to your account</Text>

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={colors.slate400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />
        </View>

        <Button onPress={handleLogin} loading={loading} style={styles.submitBtn}>
          Sign In
        </Button>

        <TouchableOpacity onPress={() => router.push('/signup')} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Don't have an account?{' '}
            <Text style={styles.switchHighlight}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Sign Up Screen ───────────────────────────────────────────

export function SignUpScreen() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    if (!name || !handle || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error } = await signUp(email, password, name, handle)
    setLoading(false)
    if (error) {
      Alert.alert('Sign up failed', error.message)
    } else {
      Alert.alert('Check your email', 'We sent you a confirmation link.')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          <Text style={{ color: colors.blue500 }}>Velo</Text>
          <Text style={{ color: colors.slate900 }}>Chat</Text>
        </Text>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Get started with VeloChat</Text>

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
          <Text style={styles.label}>Handle</Text>
          <View style={styles.handleWrap}>
            <Text style={styles.handleAt}>@</Text>
            <TextInput
              style={styles.handleInput}
              placeholder="yourhandle"
              placeholderTextColor={colors.slate400}
              value={handle}
              onChangeText={(t) => setHandle(t.replace('@', ''))}
              autoCapitalize="none"
            />
          </View>
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="8+ characters"
            placeholderTextColor={colors.slate400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        <Button onPress={handleSignUp} loading={loading} style={styles.submitBtn}>
          Create Account
        </Button>

        <TouchableOpacity onPress={() => router.back()} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.switchHighlight}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  inner: {
    flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40,
    paddingTop: 100,
  },

  logo: { fontSize: 36, fontFamily: 'Inter-ExtraBold', letterSpacing: -1, marginBottom: 32 },

  heading: {
    fontSize: 24, fontWeight: fontWeight.bold,
    color: colors.slate900, marginBottom: 4,
  },
  subheading: {
    fontSize: fontSize.sm, color: colors.slate400,
    marginBottom: 28,
  },

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

  handleWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.slate50,
    borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, paddingLeft: spacing.lg,
  },
  handleAt: {
    fontSize: fontSize.base, color: colors.slate400,
    fontWeight: fontWeight.semibold,
  },
  handleInput: {
    flex: 1, paddingHorizontal: 4, paddingVertical: 13,
    fontSize: fontSize.base, color: colors.slate800,
  },

  submitBtn: { marginTop: 8 },

  switchLink: { marginTop: 24 },
  switchText: { fontSize: fontSize.sm, color: colors.slate500 },
  switchHighlight: { color: colors.blue500, fontWeight: fontWeight.bold },
})
