import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Keyboard,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

import { useTranslation } from "@/lib/i18n";
import { placesAutocomplete, type PlacesSuggestion } from "@/lib/api";
import { Colors, Brand, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTabBarVisibility } from "@/context/tab-bar-context";
import { useRideBookingStore, type StopLocation } from "@/store/ride-booking";
import {
  StopListInput,
  FilterChips,
  RecentPlaces,
  SavedPlaces,
} from "@/components/destination";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MAX_CONTENT_WIDTH = 600;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DestinationSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const { setTabBarHidden } = useTabBarVisibility();

  // Hide Android tab bar when this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") setTabBarHidden(true);
      return () => {
        if (Platform.OS === "android") setTabBarHidden(false);
      };
    }, [setTabBarHidden]),
  );

  // Store
  const stops = useRideBookingStore((s) => s.stops);
  const activeStopIndex = useRideBookingStore((s) => s.activeStopIndex);
  const setStop = useRideBookingStore((s) => s.setStop);
  const setActiveStopIndex = useRideBookingStore((s) => s.setActiveStopIndex);

  // Search state (local)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"recent" | "saved">("recent");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // User location — enables backend dual-call (5 km + 50 km radius) for ~10 results
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;
      setUserLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  // Autocomplete query — passes location so backend makes 2 parallel API calls
  const {
    data: suggestions = [],
    isFetching,
  } = useQuery<PlacesSuggestion[], Error>({
    queryKey: [
      "dest-autocomplete",
      debouncedQuery,
      userLocation?.latitude,
      userLocation?.longitude,
    ],
    queryFn: () =>
      placesAutocomplete(debouncedQuery, undefined, userLocation ?? undefined),
    enabled,
    staleTime: 30_000,
  });

  // When user taps a stop row
  const handlePressStop = useCallback(
    (index: number) => {
      setActiveStopIndex(index);
      setIsSearching(true);
      setSearchQuery("");
      setDebouncedQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [setActiveStopIndex],
  );

  // Pin on map
  const handlePinOnMap = useCallback(
    (index: number) => {
      setActiveStopIndex(index);
      router.push("/(tabs)/(home)/pin-on-map");
    },
    [router, setActiveStopIndex],
  );

  // Select a suggestion from autocomplete
  const handleSelectSuggestion = useCallback(
    (item: PlacesSuggestion) => {
      const stop: StopLocation = {
        address: item.description,
        latitude: 0,
        longitude: 0,
        placeId: item.placeId,
        mainText: item.mainText,
      };
      setStop(activeStopIndex, stop);
      setIsSearching(false);
      setSearchQuery("");
      Keyboard.dismiss();
    },
    [activeStopIndex, setStop],
  );

  // Select from recent/saved
  const handleSelectPlace = useCallback(
    (item: {
      address: string;
      latitude: number;
      longitude: number;
      mainText: string;
    }) => {
      const stop: StopLocation = {
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        mainText: item.mainText,
      };
      setStop(activeStopIndex, stop);
      setIsSearching(false);
      setSearchQuery("");
      Keyboard.dismiss();
    },
    [activeStopIndex, setStop],
  );

  // Continue
  const handleContinue = useCallback(() => {
    const hasAtLeastOne = stops.some((s) => s !== null);
    if (!hasAtLeastOne) return;
    // TODO: navigate to pickup/confirm screen
    router.back();
  }, [stops, router]);

  // Responsive
  const horizontalPadding = screenWidth > MAX_CONTENT_WIDTH
    ? (screenWidth - MAX_CONTENT_WIDTH) / 2
    : 0;

  const hasFilledStop = stops.some((s) => s !== null);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header — back | title | Continue button */}
      <View style={[styles.header, { paddingHorizontal: horizontalPadding + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("destination.title")}
        </Text>
        {/* Continue in header (iOS escapes native tab, Android has tab hidden) */}
        <Pressable
          onPress={handleContinue}
          disabled={!hasFilledStop}
          style={styles.headerContinueBtn}
          hitSlop={8}
        >
          <Text
            style={[
              styles.headerContinueText,
              { color: hasFilledStop ? Brand.primary : colors.textMuted },
            ]}
          >
            {t("destination.continue")}
          </Text>
        </Pressable>
      </View>

      {/* Stop list inputs */}
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <StopListInput onPressStop={handlePressStop} onPinOnMap={handlePinOnMap} />
      </View>

      {/* Search overlay — shown when editing a stop */}
      {isSearching ? (
        <View style={[styles.searchOverlay, { paddingHorizontal: horizontalPadding + Spacing.md }]}>
          {/* Search input */}
          <View
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.inputBackground,
                borderColor: Brand.primary,
              },
            ]}
          >
            <MaterialIcons name="search" size={20} color={colors.icon} />
            <TextInput
              ref={inputRef}
              style={[styles.searchTextInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("destination.searchPlaceholder")}
              placeholderTextColor={colors.inputPlaceholder}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
            {(isFetching && enabled) && (
              <ActivityIndicator size="small" color={Brand.primary} />
            )}
            <Pressable
              onPress={() => {
                setIsSearching(false);
                setSearchQuery("");
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={20} color={colors.icon} />
            </Pressable>
          </View>

          {/* Pin on map shortcut */}
          <Pressable
            style={[styles.pinOnMapRow, { borderBottomColor: colors.border }]}
            onPress={() => handlePinOnMap(activeStopIndex)}
          >
            <MaterialIcons name="pin-drop" size={20} color={Brand.primary} />
            <Text style={[styles.pinOnMapText, { color: Brand.primary }]}>
              {t("destination.pinOnMap")}
            </Text>
          </Pressable>

          {/* Suggestions list */}
          {enabled && suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item, i) => item.placeId ?? `s-${i}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <MaterialIcons name="place" size={20} color={colors.icon} />
                  <View style={styles.suggestionContent}>
                    <Text
                      style={[styles.suggestionMain, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.mainText}
                    </Text>
                    {item.secondaryText ? (
                      <Text
                        style={[styles.suggestionSub, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {item.secondaryText}
                      </Text>
                    ) : null}
                  </View>
                  {item.distanceMeters != null && (
                    <Text style={[styles.distanceText, { color: colors.textMuted }]}>
                      {item.distanceMeters >= 1000
                        ? `${(item.distanceMeters / 1000).toFixed(1)} km`
                        : `${Math.round(item.distanceMeters)} m`}
                    </Text>
                  )}
                </Pressable>
              )}
            />
          ) : enabled && !isFetching ? (
            <Text style={[styles.emptyResults, { color: colors.textMuted }]}>
              No results
            </Text>
          ) : null}
        </View>
      ) : (
        /* Main content — filters, recent, saved */
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Filters */}
          <View style={styles.section}>
            <FilterChips />
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Tab bar — Recent | Saved */}
          <View style={[styles.tabBar, { paddingHorizontal: Spacing.md }]}>
            <Pressable
              onPress={() => setActiveTab("recent")}
              style={[
                styles.tab,
                activeTab === "recent" && {
                  borderBottomColor: Brand.primary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "recent" ? Brand.primary : colors.textMuted,
                  },
                ]}
              >
                {t("destination.recentRides")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("saved")}
              style={[
                styles.tab,
                activeTab === "saved" && {
                  borderBottomColor: Brand.primary,
                  borderBottomWidth: 2,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === "saved" ? Brand.primary : colors.textMuted,
                  },
                ]}
              >
                {t("destination.savedPlaces")}
              </Text>
            </Pressable>
          </View>

          {/* Tab content */}
          {activeTab === "recent" ? (
            <RecentPlaces onSelect={handleSelectPlace} />
          ) : (
            <SavedPlaces onSelect={handleSelectPlace} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  headerContinueBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerContinueText: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  // Search overlay
  searchOverlay: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  searchTextInput: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: 0,
  },
  pinOnMapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pinOnMapText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionContent: {
    flex: 1,
    minWidth: 0,
  },
  suggestionMain: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  suggestionSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  distanceText: {
    fontSize: FontSize.xs,
  },
  emptyResults: {
    fontSize: FontSize.sm,
    paddingVertical: Spacing.lg,
    textAlign: "center",
  },

  // Body scroll
  scrollBody: {
    flex: 1,
  },
  section: {
    paddingTop: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.md,
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  tab: {
    paddingBottom: Spacing.sm,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});
