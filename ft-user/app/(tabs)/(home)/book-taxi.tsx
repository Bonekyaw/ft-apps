import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { useTranslation } from "@/lib/i18n";
import {
  fetchRouteQuote,
  uploadPickupPhoto,
  createRide,
  fetchNearbyDrivers,
  getErrorMessage,
  type SpeedReadingInterval,
  type NearbyDriver,
} from "@/lib/api";
import { decodePolyline } from "@/lib/polyline";
import { startListening, startPolling, stopListening } from "@/lib/ride-status-listener";
import { useSession } from "@/lib/auth-client";
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
import BookingStatusOverlay from "@/components/booking/BookingStatusOverlay";
import { CarMarker } from "@/components/map/CarMarker";
import { showAlert } from "@/store/alert-store";

/** Height of the iOS native tab bar (points). Bottom card must sit above it. */
const IOS_TAB_BAR_HEIGHT = 50;

type SelectedVehicle = "STANDARD" | "PLUS";

export default function BookTaxiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const { setTabBarHidden } = useTabBarVisibility();
  const { data: session } = useSession();
  const mapRef = useRef<MapView>(null);

  // Hide Android tab bar when this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") setTabBarHidden(true);
      return () => {
        if (Platform.OS === "android") setTabBarHidden(false);
      };
    }, [setTabBarHidden]),
  );

  // ── Zustand store ──
  const pickup = useRideBookingStore((s) => s.pickup);
  const stops = useRideBookingStore((s) => s.stops);
  const pickupNote = useRideBookingStore((s) => s.pickupNote);
  const pickupPhotoUri = useRideBookingStore((s) => s.pickupPhotoUri);
  const setRouteQuote = useRideBookingStore((s) => s.setRouteQuote);
  const routeQuoteId = useRideBookingStore((s) => s.routeQuoteId);
  const encodedPolyline = useRideBookingStore((s) => s.encodedPolyline);
  const speedReadingIntervals = useRideBookingStore((s) => s.speedReadingIntervals);
  const standardFare = useRideBookingStore((s) => s.standardFare);
  const plusFare = useRideBookingStore((s) => s.plusFare);
  const distanceKm = useRideBookingStore((s) => s.distanceKm);
  const durationMinutes = useRideBookingStore((s) => s.durationMinutes);
  const currency = useRideBookingStore((s) => s.currency);
  const clearRouteQuote = useRideBookingStore((s) => s.clearRouteQuote);
  const reset = useRideBookingStore((s) => s.reset);
  const bookingStatus = useRideBookingStore((s) => s.bookingStatus);
  const setBookingSearching = useRideBookingStore((s) => s.setBookingSearching);
  const resetBookingStatus = useRideBookingStore((s) => s.resetBookingStatus);
  const skippedDriverUserIds = useRideBookingStore((s) => s.skippedDriverUserIds);
  const fuelPreference = useRideBookingStore((s) => s.fuelPreference);
  const petFriendly = useRideBookingStore((s) => s.petFriendly);
  const extraPassengers = useRideBookingStore((s) => s.extraPassengers);

  // ── Local state ──
  const [selectedVehicle, setSelectedVehicle] =
    useState<SelectedVehicle>("STANDARD");
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const driverPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // All filled destination stops (in order)
  const filledStops = useMemo(
    () => stops.filter((s) => s !== null),
    [stops],
  );

  // Final destination = last stop; intermediate waypoints = everything in between
  const finalDestination = filledStops.length > 0 ? filledStops[filledStops.length - 1] : null;
  const waypoints = useMemo(
    () =>
      filledStops.length > 1
        ? filledStops.slice(0, -1).map((s) => ({
            lat: s.latitude,
            lng: s.longitude,
          }))
        : undefined,
    [filledStops],
  );

  // Decoded polyline coordinates
  const routeCoords = useMemo(
    () => (encodedPolyline ? decodePolyline(encodedPolyline) : []),
    [encodedPolyline],
  );

  // Build traffic-colored polyline segments
  const trafficSegments = useMemo(() => {
    if (routeCoords.length < 2) return [];
    if (!speedReadingIntervals?.length) {
      // Fallback: single green polyline
      return [{ key: "fallback", coords: routeCoords, color: "#4CAF50" }];
    }

    const SPEED_COLORS: Record<string, string> = {
      NORMAL: "#4CAF50",
      SLOW: "#FFC107",
      TRAFFIC_JAM: "#F44336",
    };

    return speedReadingIntervals.map(
      (interval: SpeedReadingInterval, idx: number) => ({
        key: `traffic-${idx}`,
        coords: routeCoords.slice(
          interval.startPolylinePointIndex,
          interval.endPolylinePointIndex + 1,
        ),
        color: SPEED_COLORS[interval.speed] ?? "#4CAF50",
      }),
    );
  }, [routeCoords, speedReadingIntervals]);

  // ── Load route quote (reusable — called on mount + retry) ──
  const loadRouteQuote = useCallback(async () => {
    if (!pickup || !finalDestination) return;
    setIsLoadingRoute(true);
    setRouteError(null);
    try {
      const result = await fetchRouteQuote({
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        dropoffLat: finalDestination.latitude,
        dropoffLng: finalDestination.longitude,
        waypoints,
      });
      setRouteQuote({
        routeQuoteId: result.routeQuoteId,
        encodedPolyline: result.encodedPolyline,
        speedReadingIntervals: result.speedReadingIntervals,
        standardFare: result.standardFareMmkt,
        plusFare: result.plusFareMmkt,
        distanceKm: result.distanceKm,
        durationMinutes: result.durationMinutes,
        currency: result.currency,
      });
    } catch (err) {
      setRouteError(getErrorMessage(err));
    } finally {
      setIsLoadingRoute(false);
    }
  }, [pickup, finalDestination, waypoints, setRouteQuote]);

  // ── Fetch on mount ──
  useEffect(() => {
    void loadRouteQuote();
    // Only run on mount — stops won't change on this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fit map to route once coordinates are available ──
  useEffect(() => {
    if (routeCoords.length < 2) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeCoords, {
        edgePadding: { top: 80, right: 60, bottom: 300, left: 60 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [routeCoords]);

  // ── Zoom to pickup when searching begins ──
  useEffect(() => {
    if (bookingStatus === "searching" && pickup) {
      mapRef.current?.animateToRegion(
        {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus]);

  // ── Auto-return when no_driver or driver_cancelled ──
  useEffect(() => {
    if (bookingStatus === "no_driver") {
      void stopListening();
      showAlert({
        variant: "warning",
        title: t("bookTaxi.noDriverFound"),
        message: t("bookTaxi.noDriverMessage"),
        buttons: [{ text: t("auth.ok"), onPress: () => resetBookingStatus() }],
      });
    } else if (bookingStatus === "driver_cancelled") {
      void stopListening();
      showAlert({
        variant: "warning",
        title: t("bookTaxi.driverCancelledTitle"),
        message: t("bookTaxi.driverCancelledMessage"),
        buttons: [{ text: t("auth.ok"), onPress: () => resetBookingStatus() }],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus]);

  // ── Restore map to route when returning to idle from a non-idle state ──
  const prevBookingStatusRef = useRef(bookingStatus);
  useEffect(() => {
    if (
      prevBookingStatusRef.current !== "idle" &&
      bookingStatus === "idle" &&
      routeCoords.length >= 2
    ) {
      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 80, right: 60, bottom: 300, left: 60 },
          animated: true,
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    prevBookingStatusRef.current = bookingStatus;
  }, [bookingStatus, routeCoords]);

  // ── Poll nearby drivers while searching ──
  useEffect(() => {
    if (bookingStatus !== "searching" || !pickup) {
      // Clear drivers when not searching
      if (nearbyDrivers.length > 0) setNearbyDrivers([]);
      if (driverPollRef.current) {
        clearInterval(driverPollRef.current);
        driverPollRef.current = null;
      }
      return;
    }

    const poll = () => {
      void fetchNearbyDrivers(pickup.latitude, pickup.longitude).then(
        (drivers) => setNearbyDrivers(drivers),
        () => {}, // silently ignore errors
      );
    };

    // Fetch immediately, then every 10s
    poll();
    driverPollRef.current = setInterval(poll, 10_000);

    return () => {
      if (driverPollRef.current) {
        clearInterval(driverPollRef.current);
        driverPollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus, pickup?.latitude, pickup?.longitude]);

  // ── Book ride ──
  const handleBook = useCallback(async () => {
    if (!pickup || !finalDestination || !routeQuoteId) return;
    setIsBooking(true);
    try {
      // 1. Subscribe to Ably FIRST so we don't miss immediate responses
      //    (e.g., no_driver_found fires instantly when 0 drivers exist)
      const userId = session?.user?.id;
      if (userId) {
        await startListening(userId);
      }

      // 2. Upload photo if needed
      let photoUrl: string | undefined;
      if (pickupPhotoUri) {
        photoUrl = await uploadPickupPhoto(pickupPhotoUri);
      }

      // 3. Create ride — backend dispatches immediately after
      const ride = await createRide({
        pickupAddress: pickup.address,
        pickupMainText: pickup.mainText || undefined,
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        dropoffAddress: finalDestination.address,
        dropoffMainText: finalDestination.mainText || undefined,
        dropoffLat: finalDestination.latitude,
        dropoffLng: finalDestination.longitude,
        vehicleType: selectedVehicle,
        passengerNote: pickupNote || undefined,
        pickupPhotoUrl: photoUrl,
        routeQuoteId,
        fuelPreference: fuelPreference !== "ANY" ? fuelPreference : undefined,
        petFriendly: petFriendly || undefined,
        extraPassengers: extraPassengers || undefined,
      });

      // 4. Enter "searching for driver" state
      setBookingSearching(ride.id);

      // 5. Start REST polling fallback (catches missed Ably messages)
      startPolling(ride.id);
    } catch (err) {
      // If ride creation fails, clean up Ably listener
      void stopListening();
      showAlert({ title: "Error", message: getErrorMessage(err) });
    } finally {
      setIsBooking(false);
    }
  }, [
    pickup,
    finalDestination,
    routeQuoteId,
    pickupPhotoUri,
    selectedVehicle,
    pickupNote,
    fuelPreference,
    petFriendly,
    extraPassengers,
    session,
    setBookingSearching,
  ]);

  // ── Go back: clear stale route quote so re-entry fetches fresh data ──
  const handleBack = useCallback(() => {
    clearRouteQuote();
    router.back();
  }, [clearRouteQuote, router]);

  // ── Booking overlay handlers ──
  const handleBookingContinue = useCallback(() => {
    void stopListening();
    reset();
    router.dismissAll();
  }, [reset, router]);

  // ── Fare formatting (stable reference) ──
  const formatFare = useCallback(
    (amount: number | null): string => {
      if (amount == null) return "—";
      return `${amount.toLocaleString()} ${currency}`;
    },
    [currency],
  );

  // ── No data guard ──
  if (!pickup || !finalDestination) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Missing pickup or destination</Text>
      </View>
    );
  }

  // ── Card width (responsive) ──
  const fareCardWidth = (screenWidth - Spacing.md * 2 - Spacing.sm) / 2;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: (pickup.latitude + finalDestination.latitude) / 2,
          longitude: (pickup.longitude + finalDestination.longitude) / 2,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
      >
        {/* Origin marker (always visible) */}
        <Marker
          coordinate={{
            latitude: pickup.latitude,
            longitude: pickup.longitude,
          }}
          title="Pickup"
          pinColor="#FFB800"
          tracksViewChanges={false}
        />

        {/* Route markers + polyline — only shown when idle */}
        {bookingStatus === "idle" && (
          <>
            {/* Intermediate stop markers */}
            {filledStops.slice(0, -1).map((stop, idx) => (
              <Marker
                key={`waypoint-${idx}`}
                coordinate={{
                  latitude: stop.latitude,
                  longitude: stop.longitude,
                }}
                title={`Stop ${idx + 1}`}
                pinColor="#FFB800"
                tracksViewChanges={false}
              />
            ))}

            {/* Final destination marker */}
            <Marker
              coordinate={{
                latitude: finalDestination.latitude,
                longitude: finalDestination.longitude,
              }}
              title="Destination"
              pinColor="red"
              tracksViewChanges={false}
            />

            {/* Route polyline – traffic-colored segments */}
            {trafficSegments.map((seg) => (
              <Polyline
                key={seg.key}
                coordinates={seg.coords}
                strokeColor={seg.color}
                strokeWidth={5}
              />
            ))}
          </>
        )}

        {/* Nearby driver car icons (shown while searching, filtered) */}
        {nearbyDrivers
          .filter((d) => !skippedDriverUserIds.includes(d.userId))
          .map((driver) => (
            <CarMarker
              key={driver.driverId}
              id={driver.driverId}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              title={driver.driverName}
              rotation={driver.heading ?? undefined}
            />
          ))}
      </MapView>

      {/* ── Back button ── */}
      <Pressable
        onPress={handleBack}
        style={[
          styles.backButton,
          {
            backgroundColor: colors.background,
            top: insets.top + Spacing.sm,
          },
        ]}
      >
        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      {/* ── Bottom card (hidden when booking is active) ── */}
      {bookingStatus === "idle" && (
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
        {/* Loading state */}
        {isLoadingRoute && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: colors.textSecondary },
              ]}
            >
              {t("bookTaxi.loadingRoute")}
            </Text>
          </View>
        )}

        {/* Error state */}
        {routeError && !isLoadingRoute && (
          <View style={styles.loadingContainer}>
            <MaterialIcons name="error-outline" size={32} color={Brand.error} />
            <Text style={[styles.loadingText, { color: Brand.error }]}>
              {t("bookTaxi.routeError")}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                onPress={() => void loadRouteQuote()}
                style={[styles.errorBtn, { backgroundColor: Brand.primary }]}
              >
                <MaterialIcons name="refresh" size={18} color={Brand.secondary} />
                <Text style={[styles.errorBtnText, { color: Brand.secondary }]}>
                  {t("bookTaxi.tryAgain")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleBack}
                style={[styles.errorBtn, { backgroundColor: colors.inputBackground }]}
              >
                <MaterialIcons name="arrow-back" size={18} color={colors.text} />
                <Text style={[styles.errorBtnText, { color: colors.text }]}>
                  {t("bookTaxi.goBack")}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Route data loaded */}
        {!isLoadingRoute && !routeError && (
          <>
            {/* Trip summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <MaterialIcons
                  name="straighten"
                  size={20}
                  color={Brand.primary}
                />
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {distanceKm?.toFixed(1)} {t("bookTaxi.km")}
                </Text>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("bookTaxi.distance")}
                </Text>
              </View>
              <View
                style={[styles.summaryDivider, { backgroundColor: colors.border }]}
              />
              <View style={styles.summaryItem}>
                <MaterialIcons
                  name="schedule"
                  size={20}
                  color={Brand.primary}
                />
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {Math.round(durationMinutes ?? 0)} {t("bookTaxi.min")}
                </Text>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("bookTaxi.duration")}
                </Text>
              </View>
            </View>

            {/* Select fare label */}
            <Text
              style={[styles.selectFareLabel, { color: colors.textSecondary }]}
            >
              {t("bookTaxi.selectFare")}
            </Text>

            {/* Fare cards */}
            <View style={styles.fareRow}>
              {/* Standard */}
              <Pressable
                onPress={() => setSelectedVehicle("STANDARD")}
                style={[
                  styles.fareCard,
                  {
                    width: fareCardWidth,
                    backgroundColor: colors.card,
                    borderColor:
                      selectedVehicle === "STANDARD"
                        ? Brand.primary
                        : colors.border,
                    borderWidth: selectedVehicle === "STANDARD" ? 2 : 1,
                  },
                ]}
              >
                <MaterialIcons
                  name="local-taxi"
                  size={28}
                  color={
                    selectedVehicle === "STANDARD"
                      ? Brand.primary
                      : colors.textMuted
                  }
                />
                <Text style={[styles.fareCardTitle, { color: colors.text }]}>
                  {t("bookTaxi.standardTaxi")}
                </Text>
                <Text style={[styles.fareCardPrice, { color: colors.text }]}>
                  {formatFare(standardFare)}
                </Text>
              </Pressable>

              {/* Plus */}
              <Pressable
                onPress={() => setSelectedVehicle("PLUS")}
                style={[
                  styles.fareCard,
                  {
                    width: fareCardWidth,
                    backgroundColor: colors.card,
                    borderColor:
                      selectedVehicle === "PLUS"
                        ? Brand.primary
                        : colors.border,
                    borderWidth: selectedVehicle === "PLUS" ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.fareCardHeader}>
                  <MaterialIcons
                    name="star"
                    size={28}
                    color={
                      selectedVehicle === "PLUS"
                        ? Brand.primary
                        : colors.textMuted
                    }
                  />
                  <View style={styles.plusBadge}>
                    <Text style={styles.plusBadgeText}>
                      {t("bookTaxi.plusBadge")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.fareCardTitle, { color: colors.text }]}>
                  {t("bookTaxi.taxiPlus")}
                </Text>
                <Text style={[styles.fareCardPrice, { color: colors.text }]}>
                  {formatFare(plusFare)}
                </Text>
              </Pressable>
            </View>

            {/* Pickup note & photo preview */}
            {(pickupNote || pickupPhotoUri) && (
              <View
                style={[
                  styles.noteRow,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                {pickupPhotoUri && (
                  <Image
                    source={{ uri: pickupPhotoUri }}
                    style={styles.photoThumb}
                  />
                )}
                {pickupNote ? (
                  <View style={styles.noteTextContainer}>
                    <Text
                      style={[
                        styles.noteLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("bookTaxi.pickupNote")}
                    </Text>
                    <Text
                      style={[styles.noteText, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {pickupNote}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Book button */}
            <Pressable
              onPress={handleBook}
              disabled={isBooking}
              style={[
                styles.bookButton,
                {
                  backgroundColor: isBooking
                    ? colors.inputBackground
                    : Brand.primary,
                },
              ]}
            >
              {isBooking ? (
                <View style={styles.bookingRow}>
                  <ActivityIndicator size="small" color={Brand.secondary} />
                  <Text
                    style={[
                      styles.bookButtonText,
                      { color: Brand.secondary },
                    ]}
                  >
                    {t("bookTaxi.booking")}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.bookButtonText, { color: Brand.secondary }]}
                >
                  {t("bookTaxi.book")}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
      )}

      {/* ── Booking status bottom sheet (searching + accepted only) ── */}
      {(bookingStatus === "searching" || bookingStatus === "accepted") && (
        <BookingStatusOverlay onContinue={handleBookingContinue} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Back button — zIndex ensures it sits above the full-screen MapView
  backButton: {
    position: "absolute",
    left: Spacing.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // Bottom card — zIndex ensures it sits above the full-screen MapView
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 5,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },

  // Loading / error
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  errorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  // Trip summary
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: Spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: FontSize.xs,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.sm,
  },

  // "Select your ride"
  selectFareLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },

  // Fare cards
  fareRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fareCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    gap: Spacing.xs,
  },
  fareCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  fareCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  fareCardPrice: {
    fontSize: FontSize.lg,
    fontWeight: "800",
  },
  plusBadge: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  plusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Brand.secondary,
  },

  // Note / photo
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  noteTextContainer: {
    flex: 1,
    gap: 2,
  },
  noteLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
  noteText: {
    fontSize: FontSize.sm,
  },

  // Book button
  bookButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  bookButtonText: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
