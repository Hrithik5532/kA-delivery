import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

const LENGTH = 4;

export function OtpInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  const refs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  const setDigit = (index: number, char: string) => {
    const clean = char.replace(/\D/g, '').slice(-1);
    const arr = digits.map((d) => (d === ' ' ? '' : d));
    arr[index] = clean;
    const next = arr.join('').slice(0, LENGTH);
    onChange(next);
    if (clean && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKey = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View>
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(r) => { refs.current[i] = r; }}
          style={[styles.box, error && { borderColor: colors.error, backgroundColor: colors.errorContainer }]}
          value={d === ' ' ? '' : d}
          onChangeText={(t) => setDigit(i, t)}
          onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
        />
      ))}
    </View>
    {error ? <Text variant='caption' style={{ color: colors.error, marginTop: spacing.sm, textAlign: 'center' }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    maxWidth: 56,
    height: 64,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
