import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { spacing } from '@/theme';

/** Shared horizontal padding + responsive widths for all screens. */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= 768;
    const horizontalPadding = isTablet ? spacing.xl : spacing.md;
    const contentWidth = width - horizontalPadding * 2;
    const promoCardWidth = Math.min(contentWidth * 0.88, 320);
    const contentMaxWidth = isTablet ? 720 : undefined;

    return {
      width,
      height,
      isTablet,
      horizontalPadding,
      contentWidth,
      promoCardWidth,
      contentMaxWidth,
    };
  }, [width, height]);
}
