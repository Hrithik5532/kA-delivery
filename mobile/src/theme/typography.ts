import { TextStyle } from 'react-native';
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;
export const typography: Record<string, TextStyle> = {
  display: { fontFamily: fontFamily.extraBold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: '#171923' },
  h1: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: '#171923' },
  h2: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, color: '#171923' },
  h3: { fontFamily: fontFamily.semiBold, fontSize: 18, lineHeight: 24, color: '#171923' },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: '#171923' },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#6B7280' },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, color: '#6B7280' },
  button: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 20, letterSpacing: 0.2 },
  label: { fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18, color: '#6B7280' },
};
