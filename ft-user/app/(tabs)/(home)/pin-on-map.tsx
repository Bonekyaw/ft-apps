import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";

import { useTranslation } from "@/lib/i18n";
import { reverseGeocode } from "@/lib/api";
import { Colors, Brand, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTabBarVisibility } from "@/context/tab-bar-context";
import { useRideBookingStore } from "@/store/ride-booking";

// Yangon default
const DEFAULT_LAT = 16.8409;
const DEFAULT_LNG = 96.1735;

/** Height of the iOS native tab bar (points). Card must sit above it. */
const IOS_TAB_BAR_HEIGHT = 50;

export default function PinOnMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
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

  const activeStopIndex = useRideBookingStore((s) => s.activeStopIndex);
  const setStop = useRideBookingStore((s) => s.setStop);

  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    latitude: DEFAULT_LAT,
    longitude: DEFAULT_LNG,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const newRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
    })();
  }, []);

  // Reverse geocode when region changes
  const handleRegionChange = useCallback((newRegion: Region) => {
    setRegion(newRegion);
    setIsLoading(true);
    setAddress(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await reverseGeocode(
          newRegion.latitude,
          newRegion.longitude,
        );
        setAddress(result.address);
      } catch {
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    }, 600);
  }, []);

  // Confirm location
  const handleConfirm = useCallback(() => {
    setStop(activeStopIndex, {
      address: address ?? `${region.latitude.toFixed(6)}, ${region.longitude.toFixed(6)}`,
      latitude: region.latitude,
      longitude: region.longitude,
      mainText: address?.split(",")[0] ?? t("destination.pinOnMapTitle"),
    });
    router.back();
  }, [activeStopIndex, address, region, router, setStop, t]);

  return (
    <View style={styles.screen}>
      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChange}
      />

      {/* Center pin */}
      <View style={styles.pinWrapper} pointerEvents="none">
        <MaterialIcons name="place" size={48} color={Brand.error} />
      </View>

      {/* ── Floating top bar — back (left) + confirm (right) ── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.xs }]}>
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.floatingBtn, { backgroundColor: colors.background }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* Confirm Location — top-right (escapes iOS native tab) */}
        <Pressable
          onPress={handleConfirm}
          disabled={isLoading}
          style={[
            styles.confirmChip,
            {
              backgroundColor: isLoading ? colors.inputBackground : Brand.primary,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Brand.primary} />
          ) : (
            <>
              <MaterialIcons name="check" size={18} color={Brand.secondary} />
              <Text style={[styles.confirmChipText, { color: Brand.secondary }]}>
                {t("destination.confirmLocation")}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Bottom address card ── */}
      {/* iOS: positioned above the native tab bar; Android: at screen bottom */}
      <View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.background,
            bottom: Platform.OS === "ios" ? IOS_TAB_BAR_HEIGHT : 0,
            paddingBottom:
              Platform.OS === "ios"
                ? Spacing.md
                : Math.max(insets.bottom, Spacing.md),
          },
        ]}
      >
        {/* Hint */}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t("destination.pinOnMapHint")}
        </Text>

        {/* Address display */}
        <View style={[styles.addressRow, { backgroundColor: colors.inputBackground }]}>
          <MaterialIcons name="place" size={20} color={Brand.primary} />
          {isLoading ? (
            <View style={styles.addressLoading}>
              <ActivityIndicator size="small" color={Brand.primary} />
              <Text style={[styles.addressText, { color: colors.textMuted }]}>
                {t("destination.loadingAddress")}
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.addressText, { color: colors.text }]}
              numberOfLines={2}
            >
              {address ?? "—"}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const FLOAT_BTN_SIZE = 42;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Center pin
  pinWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 48,
  },

  // Floating top bar
  topBar: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  floatingBtn: {
    width: FLOAT_BTN_SIZE,
    height: FLOAT_BTN_SIZE,
    borderRadius: FLOAT_BTN_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    height: FLOAT_BTN_SIZE,
    paddingHorizontal: Spacing.md,
    borderRadius: FLOAT_BTN_SIZE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmChipText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },

  // Bottom address card
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    gap: Spacing.sm,
  },
  hint: {
    fontSize: FontSize.xs,
    textAlign: "center",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  addressLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  addressText: {
    flex: 1,
    fontSize: FontSize.sm,
  },
});
