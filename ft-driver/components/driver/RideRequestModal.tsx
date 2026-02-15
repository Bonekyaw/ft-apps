import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import {
  useRideStore,
  type IncomingRideRequest,
  type ActiveRide,
} from "@/lib/ride-store";
import { setActiveRide as setTrackerActiveRide } from "@/lib/location-tracker";
import { acceptRide, skipRide, acknowledgeRide, getErrorMessage } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { Brand, BorderRadius, FontSize, Spacing } from "@/constants/theme";
import { showAlert } from "@/lib/alert-store";
import PhotoViewerModal from "@/components/ui/photo-viewer-modal";

/** Countdown duration in seconds. */
const COUNTDOWN_SECONDS = 15;

interface Props {
  request: IncomingRideRequest;
}

export default function RideRequestModal({ request }: Props) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [isAccepting, setIsAccepting] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const clearIncomingRequest = useRideStore((s) => s.clearIncomingRequest);
  const clearAllRequests = useRideStore((s) => s.clearAllRequests);
  const setActiveRide = useRideStore((s) => s.setActiveRide);

  // ── Sound + vibration alert on mount ─────────────────────
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1. Aggressive vibration pattern: three strong pulses
    //    [wait, vibrate, pause, vibrate, pause, vibrate] (ms)
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);

    // 2. Play notification chime (works even in silent mode on iOS)
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require("@/assets/sounds/ride-request.wav"),
          { shouldPlay: true, volume: 1.0 },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        // Sound playback is non-critical — vibration still works
      }
    })();

    return () => {
      cancelled = true;
      Vibration.cancel();
      if (soundRef.current) {
        void soundRef.current.stopAsync().then(() =>
          soundRef.current?.unloadAsync(),
        );
        soundRef.current = null;
      }
    };
  }, []);

  // ── Acknowledge: tell backend we are NOW viewing this request ──
  // Resets the backend's 15s timer so queued requests get a full window.
  useEffect(() => {
    acknowledgeRide(request.rideId).catch(() => {
      // Non-critical — if the backend already moved on, the timer
      // expiry will naturally clear this request via ride_cancelled.
    });
  }, [request.rideId]);

  // ── Countdown timer ──────────────────────────────────────
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: COUNTDOWN_SECONDS * 1_000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, [progressAnim]);

  // Auto-reject on countdown expiry
  useEffect(() => {
    if (remaining > 0) return;
    void handleReject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // ── Accept ────────────────────────────────────────────────
  const handleAccept = async () => {
    if (isAccepting) return;
    setIsAccepting(true);

    try {
      await acceptRide(request.rideId);

      // Build the ActiveRide from the incoming request data
      const ride: ActiveRide = {
        rideId: request.rideId,
        pickupAddress: request.pickupAddress,
        pickupLat: request.pickupLat,
        pickupLng: request.pickupLng,
        dropoffAddress: request.dropoffAddress,
        dropoffLat: request.dropoffLat,
        dropoffLng: request.dropoffLng,
        totalFare: request.estimatedFare,
        currency: request.currency,
        vehicleType: request.vehicleType,
        passengerNote: request.passengerNote,
        pickupPhotoUrl: request.pickupPhotoUrl,
        extraPassengers: request.extraPassengers ?? false,
      };

      setActiveRide(ride);
      // Driver is now ON_TRIP — clear all pending/queued requests
      clearAllRequests();

      // Start high-frequency ride tracking
      void setTrackerActiveRide(request.rideId);

      // Success haptic
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setIsAccepting(false);
      const msg = getErrorMessage(err);
      if (msg.includes("409")) {
        showAlert({
          variant: "warning",
          title: t("rideRequest.rideTaken"),
          message: t("rideRequest.rideTakenMessage"),
        });
        clearIncomingRequest();
      } else {
        showAlert({ title: t("auth.errors.error"), message: msg });
      }
    }
  };

  // ── Reject / Skip ────────────────────────────────────────
  const handleReject = async () => {
    clearIncomingRequest();
    try {
      await skipRide(request.rideId);
    } catch {
      // Non-critical
    }
  };

  // ── Progress bar ──────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: [Brand.error, Brand.warning, Brand.success, Brand.success],
  });

  const fareText = `${Math.round(request.estimatedFare).toLocaleString()} ${request.currency}`;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* ── Title ── */}
        <Text style={styles.title}>{t("rideRequest.title")}</Text>

        {/* ── Countdown bar ── */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: progressColor },
            ]}
          />
        </View>
        <Text style={styles.countdown}>
          {t("rideRequest.countdown", { count: remaining })}
        </Text>

        {/* ── Fare (hero) ── */}
        <View style={styles.fareHero}>
          <MaterialIcons name="payments" size={24} color={Brand.primary} />
          <Text style={styles.fareAmount}>{fareText}</Text>
        </View>

        {/* ── Route info ── */}
        <View style={styles.routeSection}>
          {/* Pickup */}
          <View style={styles.routeRow}>
            <View style={styles.routeIconCol}>
              <View style={[styles.routeDot, styles.routeDotPickup]} />
              <View style={styles.routeLine} />
            </View>
            <View style={styles.routeTextCol}>
              <Text style={styles.routeLabel}>{t("rideRequest.pickup")}</Text>
              <Text style={styles.routeValue} numberOfLines={2}>
                {request.pickupAddress}
              </Text>
            </View>
          </View>

          {/* Dropoff */}
          <View style={styles.routeRow}>
            <View style={styles.routeIconCol}>
              <View style={[styles.routeDot, styles.routeDotDropoff]} />
            </View>
            <View style={styles.routeTextCol}>
              <Text style={styles.routeLabel}>{t("rideRequest.dropoff")}</Text>
              <Text style={styles.routeValue} numberOfLines={2}>
                {request.dropoffAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Extra info ── */}
        {(request.vehicleType || request.passengerNote || request.pickupPhotoUrl || request.extraPassengers) && (
          <View style={styles.extraSection}>
            {request.vehicleType ? (
              <View style={styles.extraRow}>
                <MaterialIcons
                  name="directions-car"
                  size={16}
                  color="#64748B"
                />
                <Text style={styles.extraText}>{request.vehicleType}</Text>
              </View>
            ) : null}
            {request.extraPassengers ? (
              <View style={styles.extraRow}>
                <MaterialIcons name="group" size={16} color={Brand.warning} />
                <Text style={[styles.extraText, { color: Brand.warning, fontWeight: '600' }]}>
                  {t("rideRequest.extraPassengers")}
                </Text>
              </View>
            ) : null}
            {request.passengerNote ? (
              <View style={styles.extraRow}>
                <MaterialIcons
                  name="sticky-note-2"
                  size={16}
                  color="#64748B"
                />
                <Text style={styles.extraText} numberOfLines={2}>
                  {request.passengerNote}
                </Text>
              </View>
            ) : null}
            {request.pickupPhotoUrl ? (
              <Pressable
                style={styles.extraRow}
                onPress={() => setPhotoModalVisible(true)}
              >
                <MaterialIcons
                  name="photo-camera"
                  size={16}
                  color="#64748B"
                />
                <Image
                  source={{ uri: request.pickupPhotoUrl }}
                  style={styles.pickupPhoto}
                  resizeMode="cover"
                />
                <MaterialIcons name="zoom-in" size={16} color="#94A3B8" />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Photo viewer modal */}
        {request.pickupPhotoUrl ? (
          <PhotoViewerModal
            visible={photoModalVisible}
            uri={request.pickupPhotoUrl}
            onClose={() => setPhotoModalVisible(false)}
          />
        ) : null}

        {/* ── Buttons ── */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.rejectButton]}
            onPress={() => void handleReject()}
            disabled={isAccepting}
          >
            <MaterialIcons name="close" size={22} color="#fff" />
            <Text style={styles.buttonText}>{t("rideRequest.reject")}</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.acceptButton]}
            onPress={() => void handleAccept()}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={22} color="#fff" />
                <Text style={styles.buttonText}>
                  {t("rideRequest.accept")}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: "#1A1A2E",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },

  // Countdown bar
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  countdown: {
    fontSize: FontSize.sm,
    color: "#64748B",
    textAlign: "center",
    marginBottom: Spacing.md,
  },

  // Fare hero
  fareHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFF9E6",
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  fareAmount: {
    fontSize: FontSize.xxxl,
    fontWeight: "800",
    color: Brand.primaryDark,
  },

  // Route section with dashed line
  routeSection: {
    marginBottom: Spacing.md,
  },
  routeRow: {
    flexDirection: "row",
  },
  routeIconCol: {
    width: 24,
    alignItems: "center",
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  routeDotPickup: {
    backgroundColor: Brand.success,
  },
  routeDotDropoff: {
    backgroundColor: Brand.error,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 2,
    alignSelf: "center",
    minHeight: 20,
  },
  routeTextCol: {
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  routeLabel: {
    fontSize: FontSize.xs,
    color: "#94A3B8",
    marginBottom: 1,
  },
  routeValue: {
    fontSize: FontSize.md,
    color: "#1A1A2E",
    fontWeight: "500",
  },

  // Extra info
  extraSection: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  extraText: {
    fontSize: FontSize.sm,
    color: "#64748B",
    flex: 1,
  },
  pickupPhoto: {
    width: 120,
    height: 90,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#F1F5F9",
  },

  // Buttons
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: Brand.error,
  },
  acceptButton: {
    backgroundColor: Brand.success,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSize.md,
  },
});
