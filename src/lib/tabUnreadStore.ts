/**
 * Module-level store for the Chats tab unread dot.
 * Chats screen calls refetchAndNotify(userId) when it gains focus so the tab bar
 * updates even if context doesn't reach it (e.g. Expo Router screen tree).
 */

import { supabase } from './supabase'

let hasUnread = false
const listeners: Array<() => void> = []

export function getTabUnread(): boolean {
  return hasUnread
}

export function setTabUnread(value: boolean): void {
  if (hasUnread === value) return
  hasUnread = value
  listeners.forEach((l) => l())
}

export function subscribeTabUnread(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    const i = listeners.indexOf(listener)
    if (i !== -1) listeners.splice(i, 1)
  }
}

export async function refetchAndNotifyTabUnread(userId: string): Promise<void> {
  const { data, error } = await supabase.rpc('get_unread_counts', { p_user_id: userId })
  if (error) return
  const anyUnread = (data ?? []).some((row: { unread_count: number }) => (row.unread_count ?? 0) > 0)
  setTabUnread(anyUnread)
}
