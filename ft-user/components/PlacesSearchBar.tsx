import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { PlacesSuggestion } from "@/lib/api";
import {
  getErrorMessage,
  placesAutocomplete,
} from "@/lib/api";
import { Brand, Colors } from "@/constants/theme";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface PlacesSearchBarProps {
  placeholder?: string;
  onSelectPlace?: (suggestion: PlacesSuggestion) => void;
  sessionToken?: string;
  /** User location for nearby/POI bias (e.g. "CB bank" shows nearby branches). */
  location?: { latitude: number; longitude: number };
}

export function PlacesSearchBar({
  placeholder = "Search for a place…",
  onSelectPlace,
  sessionToken,
  location,
}: PlacesSearchBarProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const trimmedDebounced = debouncedQuery.trim();
  const enabled = trimmedDebounced.length >= MIN_QUERY_LENGTH;

  const {
    data: suggestions = [],
    isLoading,
    isError,
    error,
    isFetching,
  }: UseQueryResult<PlacesSuggestion[], Error> = useQuery({
    queryKey: [
      "places-autocomplete",
      trimmedDebounced,
      sessionToken ?? "",
      location?.latitude,
      location?.longitude,
    ],
    queryFn: () =>
      placesAutocomplete(trimmedDebounced, sessionToken, location),
    enabled,
    staleTime: 30_000,
  });

  const loading = enabled && (isLoading || isFetching);
  const errorMessage = isError && error ? getErrorMessage(error) : null;
  const displaySuggestions = enabled ? suggestions : [];

  const handleSelect = useCallback(
    (item: PlacesSuggestion) => {
      Keyboard.dismiss();
      setQuery(item.description);
      setDebouncedQuery("");
      onSelectPlace?.(item);
    },
    [onSelectPlace]
  );

  const formatDistance = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

  const renderItem = useCallback(
    ({ item }: { item: PlacesSuggestion }) => (
      <TouchableOpacity
        style={styles.suggestionRow}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.suggestionContent}>
          <Text style={styles.mainText} numberOfLines={1}>
            {item.mainText}
          </Text>
          {item.secondaryText ? (
            <Text style={styles.secondaryText} numberOfLines={1}>
              {item.secondaryText}
            </Text>
          ) : null}
        </View>
        {item.distanceMeters != null ? (
          <Text style={styles.distanceText}>
            {formatDistance(item.distanceMeters)}
          </Text>
        ) : null}
      </TouchableOpacity>
    ),
    [handleSelect]
  );

  const keyExtractor = useCallback((item: PlacesSuggestion, index: number) => {
    return item.placeId ?? `q-${index}-${item.description}`;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={Colors.light.icon}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={Brand.primary}
            style={styles.loader}
          />
        ) : null}
      </View>
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}
      <FlatList
        data={displaySuggestions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        nestedScrollEnabled
        ListEmptyComponent={
          enabled && !loading && !errorMessage && displaySuggestions.length === 0 ? (
            <Text style={styles.emptyText}>No results</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.background,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 12,
  },
  loader: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: Brand.error,
    marginTop: 4,
    marginLeft: 4,
  },
  list: {
    maxHeight: 520,
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  suggestionContent: {
    flex: 1,
    minWidth: 0,
  },
  distanceText: {
    fontSize: 12,
    color: Colors.light.icon,
    marginLeft: 8,
  },
  mainText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "500",
  },
  secondaryText: {
    fontSize: 14,
    color: Colors.light.icon,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.icon,
    paddingVertical: 16,
    textAlign: "center",
  },
});
