import React, { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native'
import { Timer } from 'lucide-react-native'
import { colors, radius, fontSize, fontWeight, spacing, shadow, getAvatarColor } from '../lib/theme'

// ─── Avatar ───────────────────────────────────────────────────

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const avatarDims: Record<AvatarSize, { size: number; font: number }> = {
  xs: { size: 24, font: 9 },
  sm: { size: 28, font: 11 },
  md: { size: 36, font: 13 },
  lg: { size: 48, font: 16 },
  xl: { size: 64, font: 22 },
}

export function Avatar({
  initials,
  size = 'md',
  color,
  style,
}: {
  initials: string
  size?: AvatarSize
  color?: string
  style?: ViewStyle
}) {
  const { size: dim, font } = avatarDims[size]
  const bg = color ?? getAvatarColor(initials)

  return (
    <View style={[{
      width: dim, height: dim, borderRadius: dim / 2,
      backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }, style]}>
      <Text style={{ color: colors.white, fontSize: font, fontWeight: fontWeight.bold }}>
        {initials}
      </Text>
    </View>
  )
}

// ─── AvatarStack ──────────────────────────────────────────────

export function AvatarStack({ initials, max = 4 }: { initials: string[]; max?: number }) {
  const shown = initials.slice(0, max)
  const extra = initials.length - max
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((av, i) => (
        <Avatar
          key={av + i}
          initials={av}
          size="sm"
          style={{ marginLeft: i === 0 ? 0 : -6, borderWidth: 2, borderColor: colors.white }}
        />
      ))}
      {extra > 0 && (
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: colors.slate200,
          alignItems: 'center', justifyContent: 'center',
          marginLeft: -6, borderWidth: 2, borderColor: colors.white,
        }}>
          <Text style={{ fontSize: 10, color: colors.slate500, fontWeight: fontWeight.bold }}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  )
}

// ─── CountdownBadge ───────────────────────────────────────────

export function CountdownBadge({ expiry }: { expiry: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiry).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expired'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(`${h}h ${m}m`)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [expiry])

  const urgent = new Date(expiry).getTime() - Date.now() < 6 * 3600000
  return (
    <View style={[styles.badge, urgent ? styles.badgeUrgent : styles.badgeNormal]}>
      <Timer size={12} color={urgent ? colors.red500 : colors.slate400} strokeWidth={2.5} />
      <Text style={[styles.badgeText, urgent ? styles.badgeTextUrgent : styles.badgeTextNormal]}>
        {remaining}
      </Text>
    </View>
  )
}

// ─── Button ───────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  children: React.ReactNode
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}) {
  const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: { backgroundColor: disabled ? colors.slate200 : colors.blue500, ...shadow.blue },
      text: { color: disabled ? colors.slate400 : colors.white },
    },
    secondary: {
      container: { backgroundColor: colors.slate100 },
      text: { color: colors.slate700 },
    },
    outline: {
      container: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.slate200 },
      text: { color: colors.slate600 },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.blue500 },
    },
    danger: {
      container: { backgroundColor: disabled ? colors.slate200 : colors.red500 },
      text: { color: disabled ? colors.slate400 : colors.white },
    },
  }

  const vs = variantStyles[variant]

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.btnBase, vs.container, style]}
    >
      {loading
        ? <ActivityIndicator color={vs.text.color as string} size="small" />
        : <Text style={[styles.btnText, vs.text]}>{children}</Text>
      }
    </TouchableOpacity>
  )
}

// ─── Pill ─────────────────────────────────────────────────────

export function Pill({
  label,
  active,
  onPress,
  activeColor = colors.blue500,
}: {
  label: string
  active: boolean
  onPress: () => void
  activeColor?: string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.pill, active
        ? { backgroundColor: activeColor, ...shadow.blue }
        : { backgroundColor: colors.slate100 }
      ]}
    >
      <Text style={[styles.pillText, { color: active ? colors.white : colors.slate500 }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ─── EmptyState ───────────────────────────────────────────────

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={{ opacity: 0.25, marginBottom: 12 }}>{icon}</View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

// ─── Card ─────────────────────────────────────────────────────

export function Card({ children, style, onPress }: {
  children: React.ReactNode
  style?: ViewStyle
  onPress?: () => void
}) {
  const inner = (
    <View style={[styles.card, style]}>
      {children}
    </View>
  )
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
        {inner}
      </TouchableOpacity>
    )
  }
  return inner
}

// ─── Divider ──────────────────────────────────────────────────

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.slate100, marginVertical: 2 }} />
}

// ─── SectionLabel ─────────────────────────────────────────────

export function SectionLabel({ children, style }: { children: string; style?: TextStyle }) {
  return (
    <Text style={[styles.sectionLabel, style]}>{children.toUpperCase()}</Text>
  )
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  badgeNormal: { backgroundColor: colors.slate100, borderColor: colors.slate200 },
  badgeUrgent: { backgroundColor: colors.red50, borderColor: colors.red200 },
  badgeText: { fontSize: fontSize.xs, fontFamily: 'Inter', fontWeight: fontWeight.medium },
  badgeTextNormal: { color: colors.slate400 },
  badgeTextUrgent: { color: colors.red500 },

  btnBase: {
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  btnText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },

  pill: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: radius.xl,
  },
  pillText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  emptyState: { alignItems: 'center', paddingVertical: 56 },
  emptyText: { fontSize: fontSize.base, color: colors.slate400 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
    ...shadow.sm,
  },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.slate400,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
})
