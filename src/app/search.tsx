import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchFoods } from '@/off/search';

/** Open Food Facts allows 10 searches/min/IP, so keystrokes must not each fire one. */
const DEBOUNCE_MS = 400;

export default function SearchScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const { data, isFetching, error } = useQuery({
    queryKey: ['off', 'search', debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: ({ signal }) => searchFoods(debounced, { pageSize: 30, signal }),
  });

  const results = data?.results ?? [];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Search foods' }} />

      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        placeholder="Search Open Food Facts…"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
        ]}
      />

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error.message}
        </ThemedText>
      ) : null}

      {isFetching ? <ActivityIndicator style={styles.spinner} /> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.barcode}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        ListEmptyComponent={
          !isFetching && debounced.trim().length >= 2 ? (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Nothing found. You can still add it as a custom food.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            // Selecting a hit routes through the barcode screen, which does the full
            // product fetch and caches it locally. Search results carry only enough
            // data to render this list.
            onPress={() =>
              router.push({ pathname: '/food/[barcode]', params: { barcode: item.barcode } })
            }
            style={styles.row}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="contain" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
            )}
            <View style={styles.rowText}>
              <ThemedText numberOfLines={1}>{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {[item.brand, item.kcalPer100g ? `${Math.round(item.kcalPer100g)} kcal/100 g` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </View>
          </Pressable>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  empty: {
    paddingVertical: Spacing.four,
    textAlign: 'center',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  spinner: {
    alignSelf: 'center',
  },
  thumb: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
});
