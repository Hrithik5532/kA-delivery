import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { typography } from '@/theme';

type Variant = keyof typeof typography;

export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <RNText style={[typography[variant], style]} {...props} />;
}
