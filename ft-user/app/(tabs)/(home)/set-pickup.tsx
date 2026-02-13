import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
  Keyboard,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { useTranslation } from "@/lib/i18n";
import {
  reverseGeocode,
  placesAutocomplete,
  fetchPlaceCoordinates,
  type PlacesSuggestion,
} from "@/lib/api";
import {
  Colors,
  Brand,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTabBarVisibility } from "@/context/tab-bar-context";
import { useRideBookingStore } from "@/store/ride-booking";
import { showAlert } from "@/store/alert-store";

// Yangon default
const DEFAULT_LAT = 16.8409;
const DEFAULT_LNG = 96.1735;

/** Height of the iOS native tab bar (points). Card must sit above it. */
const IOS_TAB_BAR_HEIGHT = 50;

/** Thumbnail size for the photo preview. */
const PHOTO_THUMB_SIZE = 72;

export default function SetPickupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { setTabBarHidden } = useTabBarVisibility();
  const { width: screenWidth } = useWindowDimensions();

  // Hide Android tab bar when this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") setTabBarHidden(true);
      return () => {
        if (Platform.OS === "android") setTabBarHidden(false);
      };
    }, [setTabBarHidden]),
  );

  // Zustand store
  const stops = useRideBookingStore((s) => s.stops);
  const setPickup = useRideBookingStore((s) => s.setPickup);
  const setPickupNote = useRideBookingStore((s) => s.setPickupNote);
  const setPickupPhotoUri = useRideBookingStore((s) => s.setPickupPhotoUri);
  const pickupNote = useRideBookingStore((s) => s.pickupNote);
  const pickupPhotoUri = useRideBookingStore((s) => s.pickupPhotoUri);

  // Map & location state
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard tracking — directly move the card above the keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isKeyboardVisible = keyboardHeight > 0;

  // Photo picker modal state
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<
    PlacesSuggestion[]
  >([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current location on mount — resolve BEFORE showing the map
  useEffect(() => {
    (async () => {
      let lat = DEFAULT_LAT;
      let lng = DEFAULT_LNG;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          // Try last known first (instant, no GPS wait)
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            lat = last.coords.latitude;
            lng = last.coords.longitude;
          } else {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        }
      } catch {
        // Fall back to defaults
      }

      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      });
      setLocationReady(true);
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

  // Search autocomplete
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (!text.trim()) {
        setSearchSuggestions([]);
        return;
      }
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const results = await placesAutocomplete(text, undefined, {
            latitude: region?.latitude ?? DEFAULT_LAT,
            longitude: region?.longitude ?? DEFAULT_LNG,
          });
          setSearchSuggestions(results);
        } catch {
          setSearchSuggestions([]);
        }
      }, 400);
    },
    [region?.latitude, region?.longitude],
  );

  // Select a search suggestion — resolve coordinates and move the map
  const handleSelectSuggestion = useCallback(
    async (suggestion: PlacesSuggestion) => {
      setShowSearch(false);
      setSearchQuery("");
      setSearchSuggestions([]);
      setAddress(suggestion.description);

      if (!suggestion.placeId) return;

      try {
        const coords = await fetchPlaceCoordinates(suggestion.placeId);
        if (coords.latitude != null && coords.longitude != null) {
          const newRegion: Region = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          };
          setRegion(newRegion);
          setAddress(coords.address ?? suggestion.description);
          mapRef.current?.animateToRegion(newRegion, 500);
        }
      } catch {
        // Keep the address text; user can adjust the pin manually
      }
    },
    [],
  );

  // ── Photo attachment ──
  const launchCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showAlert({
        variant: "warning",
        title: "Permission needed",
        message: "Camera permission is required to take photos.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPickupPhotoUri(result.assets[0].uri);
    }
  }, [setPickupPhotoUri]);

  const launchGallery = useCallback(async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert({
        variant: "warning",
        title: "Permission needed",
        message: "Gallery permission is required to choose photos.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPickupPhotoUri(result.assets[0].uri);
    }
  }, [setPickupPhotoUri]);

  const handlePhotoPress = useCallback(() => {
    setShowPhotoPicker(true);
  }, []);

  const handlePickerCamera = useCallback(() => {
    setShowPhotoPicker(false);
    // Small delay so modal closes before camera opens
    setTimeout(() => void launchCamera(), 300);
  }, [launchCamera]);

  const handlePickerGallery = useCallback(() => {
    setShowPhotoPicker(false);
    setTimeout(() => void launchGallery(), 300);
  }, [launchGallery]);

  const handleRemovePhoto = useCallback(() => {
    setPickupPhotoUri(null);
  }, [setPickupPhotoUri]);

  // ── Confirm pickup & navigate to book-taxi ──
  const handleConfirmBooking = useCallback(() => {
    if (!region) return;
    // Save pickup details to Zustand store
    setPickup({
      address:
        address ??
        `${region.latitude.toFixed(6)}, ${region.longitude.toFixed(6)}`,
      latitude: region.latitude,
      longitude: region.longitude,
    });
    setPickupNote(pickupNote);

    // Navigate to the booking screen (route preview + fare selection)
    router.push("/(tabs)/(home)/book-taxi");
  }, [address, region, pickupNote, setPickup, setPickupNote, router]);

  // ── Responsive padding ──
  const horizontalPadding = screenWidth >= 768 ? Spacing.xl : Spacing.md;

  const hasDestination = stops.some((s) => s !== null);

  // Don't render map until we have a real starting region
  if (!locationReady || !region) {
    return (
      <View style={[styles.screen, styles.loadingScreen]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* ── Map (flex: 1) ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialCamera={{
          center: {
            latitude: region.latitude,
            longitude: region.longitude,
          },
          pitch: 0,
          heading: 0,
          zoom: 17,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChange}
      />


      {/* Center pin (movable — green) */}
      <View style={styles.pinWrapper} pointerEvents="none">
        <MaterialIcons name="place" size={48} color="#0a9830" />
      </View>

      {/* ── Floating top bar ── */}
      <View style={[styles.topBar, { top: insets.top + Spacing.xs }]}>
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.floatingBtn,
            { backgroundColor: colors.background },
          ]}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        {/* Search toggle */}
        <Pressable
          onPress={() => setShowSearch((v) => !v)}
          style={[
            styles.floatingBtn,
            { backgroundColor: colors.background },
          ]}
        >
          <MaterialIcons name="search" size={22} color={colors.text} />
        </Pressable>

        {/* Confirm booking — top-right */}
        <Pressable
          onPress={handleConfirmBooking}
          disabled={!hasDestination}
          style={[
            styles.confirmChip,
            {
              backgroundColor: !hasDestination
                ? colors.inputBackground
                : Brand.primary,
            },
          ]}
        >
          <MaterialIcons
            name="check"
            size={18}
            color={Brand.secondary}
          />
          <Text
            style={[styles.confirmChipText, { color: Brand.secondary }]}
          >
            {t("pickup.confirmBooking")}
          </Text>
        </Pressable>
      </View>

      {/* ── Search overlay ── */}
      {showSearch && (
        <View
          style={[
            styles.searchOverlay,
            {
              top: insets.top + Spacing.xs + 52,
              backgroundColor: colors.background,
              marginHorizontal: horizontalPadding,
            },
          ]}
        >
          <TextInput
            autoFocus
            placeholder={t("pickup.searchPlaceholder")}
            placeholderTextColor={colors.inputPlaceholder}
            value={searchQuery}
            onChangeText={handleSearchChange}
            style={[
              styles.searchInput,
              {
                color: colors.text,
                backgroundColor: colors.inputBackground,
              },
            ]}
          />
          {searchSuggestions.map((s, idx) => (
            <Pressable
              key={s.placeId ?? idx}
              onPress={() => handleSelectSuggestion(s)}
              style={[
                styles.suggestionRow,
                { borderBottomColor: colors.border },
              ]}
            >
              <MaterialIcons
                name="place"
                size={18}
                color={colors.textSecondary}
              />
              <View style={styles.suggestionTextWrap}>
                <Text
                  style={[styles.suggestionMain, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {s.mainText}
                </Text>
                {s.secondaryText ? (
                  <Text
                    style={[
                      styles.suggestionSub,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {s.secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Bottom card ── */}
      <View
        style={[
          styles.bottomCard,
          {
            backgroundColor: colors.background,
            bottom: isKeyboardVisible
              ? keyboardHeight
              : Platform.OS === "ios"
                ? IOS_TAB_BAR_HEIGHT
                : 0,
            paddingBottom: isKeyboardVisible
              ? Spacing.sm
              : Platform.OS === "ios"
                ? Spacing.md
                : Math.max(insets.bottom, Spacing.md),
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.bottomScrollView}
        >
          {/* Address display */}
          <View
            style={[
              styles.addressRow,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <MaterialIcons name="place" size={20} color={Brand.primary} />
            {isLoading ? (
              <View style={styles.addressLoading}>
                <ActivityIndicator size="small" color={Brand.primary} />
                <Text
                  style={[styles.addressText, { color: colors.textMuted }]}
                >
                  {t("destination.loadingAddress")}
                </Text>
              </View>
            ) : (
              <Text
                style={[styles.addressText, { color: colors.text }]}
                numberOfLines={2}
              >
                {address ?? t("pickup.defaultAddress")}
              </Text>
            )}
          </View>

          {/* Pickup instructions */}
          <TextInput
            placeholder={t("pickup.instructionsPlaceholder")}
            placeholderTextColor={colors.inputPlaceholder}
            value={pickupNote}
            onChangeText={(text) => setPickupNote(text)}
            onFocus={() => {
              // Scroll to make the input visible above the keyboard
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
            }}
            multiline
            maxLength={200}
            style={[
              styles.instructionsInput,
              {
                color: colors.text,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          {/* Photo attachment */}
          <View style={styles.photoSection}>
            {pickupPhotoUri ? (
              <View style={styles.photoPreviewRow}>
                <Image
                  source={{ uri: pickupPhotoUri }}
                  style={styles.photoThumb}
                />
                <Pressable
                  onPress={handleRemovePhoto}
                  style={[
                    styles.removePhotoBtn,
                    { backgroundColor: Brand.error },
                  ]}
                >
                  <MaterialIcons name="close" size={16} color="#fff" />
                  <Text style={styles.removePhotoText}>
                    {t("pickup.removePhoto")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handlePhotoPress}
                style={[
                  styles.addPhotoBtn,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <MaterialIcons
                  name="add-a-photo"
                  size={24}
                  color={Brand.primary}
                />
                <Text
                  style={[
                    styles.addPhotoText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("pickup.photoHint")}
                </Text>
              </Pressable>
            )}
          </View>

        </ScrollView>
      </View>

      {/* ── Photo picker bottom sheet ── */}
      <Modal
        visible={showPhotoPicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowPhotoPicker(false)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setShowPhotoPicker(false)}
        />
        <View
          style={[
            styles.pickerSheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, Spacing.lg),
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.pickerHandle} />

          <Text style={[styles.pickerTitle, { color: colors.text }]}>
            {t("pickup.photoHint")}
          </Text>

          <View style={styles.pickerOptions}>
            {/* Camera option */}
            <Pressable
              style={[
                styles.pickerOption,
                { backgroundColor: colors.inputBackground },
              ]}
              onPress={handlePickerCamera}
            >
              <View
                style={[
                  styles.pickerIconCircle,
                  { backgroundColor: Brand.primary + "18" },
                ]}
              >
                <MaterialIcons
                  name="camera-alt"
                  size={28}
                  color={Brand.primary}
                />
              </View>
              <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                {t("pickup.takePhoto")}
              </Text>
            </Pressable>

            {/* Gallery option */}
            <Pressable
              style={[
                styles.pickerOption,
                { backgroundColor: colors.inputBackground },
              ]}
              onPress={handlePickerGallery}
            >
              <View
                style={[
                  styles.pickerIconCircle,
                  { backgroundColor: "#7C3AED18" },
                ]}
              >
                <MaterialIcons name="photo-library" size={28} color="#7C3AED" />
              </View>
              <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                {t("pickup.choosePhoto")}
              </Text>
            </Pressable>
          </View>

          {/* Cancel */}
          <Pressable
            style={[
              styles.pickerCancel,
              { backgroundColor: colors.inputBackground },
            ]}
            onPress={() => setShowPhotoPicker(false)}
          >
            <Text style={[styles.pickerCancelText, { color: colors.text }]}>
              {t("pickup.cancel")}
            </Text>
          </Pressable>
        </View>
      </Modal>
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
  loadingScreen: {
    justifyContent: "center",
    alignItems: "center",
  },
  map: {
    flex: 1,
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
    alignItems: "center",
    gap: Spacing.sm,
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
    marginLeft: "auto",
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

  // Search overlay
  searchOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: 320,
    overflow: "hidden",
  },
  searchInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    borderRadius: BorderRadius.md,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  suggestionSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },

  // Bottom card
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomScrollView: {
    maxHeight: 260,
  },

  // Address row
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
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

  // Instructions input
  instructionsInput: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    minHeight: 50,
    maxHeight: 100,
    textAlignVertical: "top",
    marginBottom: Spacing.sm,
  },

  // Photo section
  photoSection: {
    marginBottom: Spacing.sm,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
  },
  addPhotoText: {
    fontSize: FontSize.sm,
  },
  photoPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  photoThumb: {
    width: PHOTO_THUMB_SIZE,
    height: PHOTO_THUMB_SIZE,
    borderRadius: BorderRadius.sm,
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  removePhotoText: {
    color: "#fff",
    fontSize: FontSize.xs,
    fontWeight: "600",
  },

  // Submitting indicator
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  submittingText: {
    fontSize: FontSize.sm,
  },

  // ── Photo picker bottom sheet ──
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  pickerTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  pickerOptions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  pickerOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerOptionText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  pickerCancel: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  pickerCancelText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
