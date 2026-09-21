import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { Text } from '@/components/ui/Text';
import { feedbackStyles, type FeedbackSeverity } from '@/theme/feedback';
import { colors, radius, spacing } from '@/theme';

export type AppNotification = {
  id: string;
  severity: FeedbackSeverity;
  title?: string;
  message: string;
  createdAt: number;
  read: boolean;
};

type ShowOptions = {
  severity: FeedbackSeverity;
  message: string;
  title?: string;
  persist?: boolean;
};

type FeedbackContextValue = {
  show: (options: ShowOptions) => void;
  success: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

type ToastItem = ShowOptions & { id: string };

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((items) => items.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((options: ShowOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { ...options, id };
    setNotifications((prev) => [
      { id, severity: options.severity, title: options.title, message: options.message, createdAt: Date.now(), read: false },
      ...prev,
    ].slice(0, 50));
    if (!options.persist) {
      setToasts((prev) => [...prev, item]);
      timers.current[id] = setTimeout(() => dismissToast(id), 4200);
    }
  }, [dismissToast]);

  const value = useMemo<FeedbackContextValue>(() => ({
    show,
    success: (message, title) => show({ severity: 'success', message, title }),
    warning: (message, title) => show({ severity: 'warning', message, title }),
    error: (message, title) => show({ severity: 'error', message, title, persist: false }),
    info: (message, title) => show({ severity: 'info', message, title }),
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAllRead: () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    clearNotifications: () => setNotifications([]),
    panelOpen,
    openPanel: () => { setPanelOpen(true); setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); },
    closePanel: () => setPanelOpen(false),
  }), [show, notifications, panelOpen]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.toastHost, { top: insets.top + 8 }]}>
        {toasts.map((toast) => (
          <FeedbackBanner
            key={toast.id}
            severity={toast.severity}
            title={toast.title}
            message={toast.message}
            onDismiss={() => dismissToast(toast.id)}
            style={styles.toast}
          />
        ))}
      </View>
      <Modal visible={panelOpen} animationType="slide" transparent onRequestClose={value.closePanel}>
        <Pressable style={styles.backdrop} onPress={value.closePanel} />
        <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.panelHeader}>
            <Text variant="h3">Notifications</Text>
            <Pressable onPress={value.closePanel} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.panelContent}>
            {notifications.length === 0 ? (
              <Text variant="bodySmall" style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
                No notifications yet. Updates about deliveries and account actions will appear here.
              </Text>
            ) : (
              notifications.map((n) => (
                <FeedbackBanner
                  key={n.id}
                  severity={n.severity}
                  title={n.title}
                  message={n.message}
                  style={{ marginBottom: spacing.sm }}
                />
              ))
            )}
          </ScrollView>
          {notifications.length > 0 ? (
            <Pressable onPress={value.clearNotifications} style={styles.clearBtn}>
              <Text variant="caption" style={{ color: colors.danger, fontWeight: '700' }}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastHost: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000, gap: spacing.sm },
  toast: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '72%',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  panelContent: { paddingBottom: spacing.md },
  clearBtn: { alignItems: 'center', paddingVertical: spacing.sm },
});
