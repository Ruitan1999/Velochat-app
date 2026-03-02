import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'

export async function uploadAvatarFromUri(params: {
  userId: string
  localUri: string
}) {
  const { userId, localUri } = params
  if (!localUri) throw new Error('Missing avatar uri')

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filePath = `${userId}/avatar.${ext}`

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' })

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, decode(base64), {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath)
  if (!publicUrl?.publicUrl) throw new Error('Could not get avatar URL')

  // Cache-bust so existing avatar updates immediately.
  return `${publicUrl.publicUrl}?t=${Date.now()}`
}

