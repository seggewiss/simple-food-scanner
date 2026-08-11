import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChartPoint = { date: string; value: number };

const HEIGHT = 160;
const PADDING = 12;

/**
 * Minimal line chart for the weight trend. Hand-rolled SVG rather than a charting
 * library: one series, no axes, no interaction — a dependency would cost more than it
 * saves here.
 */
export function WeightChart({ points }: { points: ChartPoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length < 2 || width === 0) {
    return <View style={styles.container} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} />;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it an arbitrary band so the line centres.
  const range = max - min || 1;

  const innerWidth = width - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;

  const coords = points.map((point, index) => ({
    x: PADDING + (index / (points.length - 1)) * innerWidth,
    y: PADDING + (1 - (point.value - min) / range) * innerHeight,
  }));

  const path = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ');

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={HEIGHT}>
        <Path d={path} stroke={theme.accent} strokeWidth={2} fill="none" />
        {coords.map((coord, index) => (
          <Circle
            key={points[index].date}
            cx={coord.x}
            cy={coord.y}
            r={3}
            fill={theme.accent}
          />
        ))}
      </Svg>
      <View style={styles.legend}>
        <ThemedText type="small" themeColor="textSecondary">
          {min.toFixed(1)} kg
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {max.toFixed(1)} kg
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: HEIGHT,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
});
