import {
  type BarcodeScanningResult,
  type BarcodeType,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPlausibleBarcode } from '@/off/product';

/** Retail food packaging only. Excluding QR/data-matrix keeps false positives down. */
const FOOD_BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

/**
 * The camera fires `onBarcodeScanned` on every frame that contains a barcode, so a
 * single scan produces a burst of identical callbacks. We latch on the first one and
 * only unlatch when the user explicitly asks to scan again.
 */
export default function ScanScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<BarcodeScanningResult | null>(null);
  const lockRef = useRef(false);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (lockRef.current) return;
    // Guard before navigating: the camera occasionally decodes a stray pattern into
    // something that is not a retail barcode, and looking that up would waste a slot
    // of the Open Food Facts rate-limit budget.
    if (!isPlausibleBarcode(result.data)) return;

    lockRef.current = true;
    setScanned(result);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        // Haptics are a nicety; a device without a taptic engine must not break the scan.
      });
    }
    router.replace({ pathname: '/food/[barcode]', params: { barcode: result.data } });
  }, []);

  const resetScan = useCallback(() => {
    lockRef.current = false;
    setScanned(null);
  }, []);

  if (!permission) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Checking camera permission…</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Camera access needed</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          Barcode scanning is the whole point of this app, and it needs the camera to work.
        </ThemedText>
        <Pressable
          onPress={requestPermission}
          style={[styles.button, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.buttonLabel}>Grant camera access</ThemedText>
        </Pressable>
        {!permission.canAskAgain && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            Permission was denied permanently. Enable it in your system settings.
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: FOOD_BARCODE_TYPES }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.reticle} />

        <View style={[styles.resultCard, { backgroundColor: theme.background }]}>
          {scanned ? (
            <>
              <ThemedText style={styles.code}>{scanned.data}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Looking it up…
              </ThemedText>
              <Pressable
                onPress={resetScan}
                style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.buttonLabelSecondary}>Scan a different item</ThemedText>
              </Pressable>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">
              Point the camera at a barcode on the packaging.
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  buttonLabelSecondary: {
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  code: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.four,
  },
  reticle: {
    alignSelf: 'center',
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    borderWidth: 3,
    height: 180,
    marginTop: Spacing.six,
    width: '80%',
  },
  resultCard: {
    borderRadius: 20,
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
