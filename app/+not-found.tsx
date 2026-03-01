import React, { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/AuthContext'
import { colors, fontSize } from '../src/lib/theme'

export default function NotFoundScreen() {
  const { session, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (session) {
      router.replace('/(tabs)/chats')
    } else {
      router.replace('/(auth)/login')
    }
  }, [session, loading])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.blue500} />
      <Text style={styles.text}>Loading the latest screen…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.slate50,
  },
  text: {
    marginTop: 12,
    fontSize: fontSize.sm,
    color: colors.slate500,
  },
})

