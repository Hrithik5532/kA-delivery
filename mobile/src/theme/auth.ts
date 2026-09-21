import { colors } from './colors';

export type AuthTheme = 'customer' | 'delivery' | 'mess';

export const authThemes: Record<AuthTheme, {
  primary: string;
  primaryDark: string;
  soft: string;
  gradient: [string, string];
  label: string;
}> = {
  customer: {
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    soft: colors.primarySoft,
    gradient: ['#5B3DF5', '#7C5CFF'],
    label: 'Customer',
  },
  delivery: {
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    soft: colors.primaryFixed,
    gradient: ['#4212de', '#5b3df5'],
    label: 'Delivery Partner',
  },
  mess: {
    primary: colors.accent,
    primaryDark: colors.accentDark,
    soft: colors.accentSoft,
    gradient: ['#FFC857', '#FFB020'],
    label: 'Mess Kitchen',
  },
};
