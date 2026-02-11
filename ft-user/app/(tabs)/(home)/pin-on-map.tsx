import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";

import { useTranslation } from "@/lib/i18n";
import { reverseGeocode } from "@/lib/api";
import { Colors, Brand, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRideBookingStore } from "@/store/ride-booking";

// Yangon default
const DEFAULT_LAT = 16.8409;
const DEFAULT_LNG = 96.1735;

export default function PinOnMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();

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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("destination.pinOnMapTitle")}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton
          onRegionChangeComplete={handleRegionChange}
        />

        {/* Center pin */}
        <View style={styles.pinWrapper} pointerEvents="none">
          <MaterialIcons name="place" size={48} color={Brand.error} />
        </View>
      </View>

      {/* Bottom card */}
      <View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
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

        {/* Confirm button */}
        <Pressable
          onPress={handleConfirm}
          disabled={isLoading}
          style={[
            styles.confirmBtn,
            {
              backgroundColor: isLoading ? colors.inputBackground : Brand.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.confirmBtnText,
              {
                color: isLoading ? colors.textMuted : Brand.secondary,
              },
            ]}
          >
            {t("destination.confirmLocation")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    zIndex: 10,
  },
  backBtn: {
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

  // Map
  mapContainer: {
    flex: 1,
  },
  pinWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    // Offset pin slightly so its point is at center
    paddingBottom: 48,
  },

  // Bottom card
  bottomCard: {
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
  confirmBtn: {
    height: 50,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
});
