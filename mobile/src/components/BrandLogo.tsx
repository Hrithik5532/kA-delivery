import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND_NAME } from '@/constants/brand';
import { colors, spacing } from '@/theme';
import { Text } from './ui/Text';

const logoSource = require('@/assets/images/logo.png');

export function BrandLogo({
  size = 80,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={logoSource}
      style={[styles.logo, { width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel={BRAND_NAME}
    />
  );
}

export function BrandMark({
  size = 56,
  showName = true,
  nameSize = 'h2',
  style,
  dark = false,
}: {
  size?: number;
  showName?: boolean;
  nameSize?: 'h1' | 'h2' | 'h3';
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}) {
  return (
    <View style={[styles.mark, style]}>
      <BrandLogo size={size} />
      {showName ? (
        <Text
          variant={nameSize}
          style={[styles.name, { color: dark ? colors.riderText : colors.text }]}
        >
          {BRAND_NAME}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {},
  mark: { alignItems: 'center', gap: spacing.sm },
  name: { textAlign: 'center' },
});
