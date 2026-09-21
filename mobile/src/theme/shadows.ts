import { colors } from './colors';
export const shadow = {
  shadowColor: colors.text, shadowOpacity: 0.06, shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 }, elevation: 2,
} as const;
export const shadowMd = {
  shadowColor: colors.text, shadowOpacity: 0.1, shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 }, elevation: 4,
} as const;
export const shadowLg = {
  shadowColor: colors.text, shadowOpacity: 0.14, shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 }, elevation: 8,
} as const;
