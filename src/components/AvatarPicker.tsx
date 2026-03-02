import React from 'react'
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Camera } from 'lucide-react-native'
import { Avatar } from './ui'
import { colors } from '../lib/theme'

export function AvatarPicker({
  initials,
  color,
  uri,
  size = 'xl',
  uploading = false,
  disabled = false,
  allowCamera = true,
  allowLibrary = true,
  onPickedUri,
}: {
  initials: string
  color?: string
  uri?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  uploading?: boolean
  disabled?: boolean
  allowCamera?: boolean
  allowLibrary?: boolean
  onPickedUri: (localUri: string) => void | Promise<void>
}) {
  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to pick an avatar.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    await onPickedUri(result.assets[0].uri)
  }

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take an avatar photo.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.[0]?.uri) return
    await onPickedUri(result.assets[0].uri)
  }

  const handlePress = () => {
    if (disabled || uploading) return

    if (allowCamera && allowLibrary) {
      Alert.alert('Set avatar', 'Choose a source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take photo', onPress: () => void takePhoto() },
        { text: 'Choose from library', onPress: () => void pickFromLibrary() },
      ])
      return
    }

    if (allowCamera) {
      void takePhoto()
      return
    }

    if (allowLibrary) {
      void pickFromLibrary()
    }
  }

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={handlePress}
      activeOpacity={0.85}
      disabled={disabled || uploading}
    >
      <Avatar initials={initials} color={color} size={size} uri={uri} />
      <View style={styles.badge}>
        {uploading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Camera size={14} color={colors.white} />
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', alignSelf: 'center' },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.blue500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
})

