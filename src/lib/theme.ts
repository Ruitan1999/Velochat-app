// VeloChat Design Tokens
// Mirrors the web Tailwind palette in RN-compatible values

export const colors = {
  // Primary blue
  blue50:  '#EFF6FF',
  blue100: '#DBEAFE',
  blue200: '#BFDBFE',
  blue400: '#60A5FA',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  blue700: '#1D4ED8',

  // Slate grays
  slate50:  '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Status
  red50:    '#FEF2F2',
  red200:   '#FECACA',
  red500:   '#EF4444',
  red600:   '#DC2626',

  amber50:  '#FFFBEB',
  amber200: '#FDE68A',
  amber600: '#D97706',

  // Accent colors for avatars / clubs
  cyan500:   '#06B6D4',
  violet500: '#8B5CF6',
  violet600: '#7C3AED',
  orange500: '#F97316',
  rose500:   '#F43F5E',
  teal500:   '#14B8A6',
  emerald600:'#059669',

  white: '#FFFFFF',
  black: '#000000',
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
}

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 9999,
}

export const fontSize = {
  xs:   11,
  sm:   12,
  base: 14,
  md:   15,
  lg:   16,
  xl:   18,
  xxl:  20,
  xxxl: 24,
}

export const fontWeight = {
  normal:    '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
  black:     '900' as const,
}

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  blue: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
}

// Avatar color lookup by initials
export const avatarColors: Record<string, string> = {
  AR: colors.blue500,
  ST: colors.cyan500,
  ML: colors.violet500,
  JK: colors.orange500,
  CP: colors.rose500,
  DW: colors.teal500,
  EV: colors.blue600,
  HT: colors.violet600,
}

export function getAvatarColor(initials: string): string {
  return avatarColors[initials] ?? colors.slate400
}
