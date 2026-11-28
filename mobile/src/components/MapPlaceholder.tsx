import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from './ui/Text';

/**
 * Neutral empty state shown wherever an interactive Google map isn't available
 * (e.g. Expo Go, or no map credentials). We deliberately render nothing map-like
 * here — no third-party raster tiles — to avoid broken/blocked tile images.
 */
export function MapPlaceholder({
  style,
  caption = 'Live map opens in Google Maps',
}: {
  style?: StyleProp<ViewStyle>;
  caption?: string;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="map-outline" size={34} color={colors.textMuted} />
      <Text variant="caption" style={styles.text}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#EDF1F6',
    padding: spacing.lg,
  },
  text: { color: colors.textMuted, textAlign: 'center', maxWidth: 240 },
});
