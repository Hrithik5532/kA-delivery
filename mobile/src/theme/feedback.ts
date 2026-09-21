import type { Ionicons } from '@expo/vector-icons';
import { colors } from './colors';

export type FeedbackSeverity = 'success' | 'warning' | 'error' | 'info';

export type FeedbackStyle = {
  background: string;
  border: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

export const feedbackStyles: Record<FeedbackSeverity, FeedbackStyle> = {
  success: {
    background: colors.successContainer,
    border: colors.success,
    text: colors.onSuccessContainer,
    icon: 'checkmark-circle',
    iconColor: colors.success,
  },
  warning: {
    background: colors.warningSoft,
    border: colors.warning,
    text: colors.onTertiaryFixed,
    icon: 'warning',
    iconColor: colors.warning,
  },
  error: {
    background: colors.errorContainer,
    border: colors.error,
    text: colors.onErrorContainer,
    icon: 'close-circle',
    iconColor: colors.error,
  },
  info: {
    background: colors.infoSoft,
    border: colors.info,
    text: colors.onInfoContainer,
    icon: 'information-circle',
    iconColor: colors.info,
  },
};

export const feedbackTitles: Record<FeedbackSeverity, string> = {
  success: 'Success',
  warning: 'Heads up',
  error: 'Something went wrong',
  info: 'Note',
};
