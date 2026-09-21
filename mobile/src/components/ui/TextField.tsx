import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export function TextField({ label, error, ...props }: { label?: string; error?: string | null } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label" style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textLight}
        style={[styles.input, focused && !hasError && styles.focused, hasError && styles.errorInput]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        {...props}
      />
      {hasError ? <Text variant="caption" style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, color: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16 },
  focused: { borderColor: colors.primary },
  errorInput: { borderColor: colors.error, backgroundColor: colors.errorContainer },
  errorText: { color: colors.error, marginTop: spacing.xs },
});
