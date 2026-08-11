import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A list row that reveals a Delete button when swiped left.
 *
 * Swiping is the platform-native way to remove a row on both iOS and Android, and unlike
 * a long press it advertises itself: the action slides into view as soon as the finger
 * moves. There is deliberately no confirmation dialog — the gesture is already
 * deliberate, and callers pair this with an undo affordance instead, which is both
 * faster for the common case and more forgiving for the mistaken one.
 */
export function SwipeableRow({
  onDelete,
  onLongPress,
  children,
}: {
  onDelete: () => void;
  /** Optional secondary route to the same action, for anyone who already knows it. */
  onLongPress?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_progress, _translation, methods) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
            methods.close();
            onDelete();
          }}
          style={[styles.action, { backgroundColor: theme.danger }]}>
          <Ionicons name="trash-outline" size={20} color="#ffffff" />
          <ThemedText type="small" style={styles.actionLabel}>
            Delete
          </ThemedText>
        </Pressable>
      )}>
      <Pressable onLongPress={onLongPress} delayLongPress={400}>
        {children}
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    gap: Spacing.half,
    justifyContent: 'center',
    width: 88,
  },
  actionLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
