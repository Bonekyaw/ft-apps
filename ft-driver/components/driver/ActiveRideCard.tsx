import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRideStore, type ActiveRide } from "@/lib/ride-store";
import { setActiveRide as setTrackerActiveRide } from "@/lib/location-tracker";
import { cancelRide, getErrorMessage } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import {
  Brand,
  BorderRadius,
  FontSize,
  Spacing,
} from "@/constants/theme";

interface Props {
  ride: ActiveRide;
}

export default memo(function ActiveRideCard({ ride }: Props) {
  const { t } = useTranslation();
  const clearActiveRide = useRideStore((s) => s.clearActiveRide);
  const [isCancelling, setIsCancelling] = useState(false);

  const fareText = `${Math.round(ride.totalFare).toLocaleString()} ${ride.currency}`;

  const handleNavigate = useCallback(() => {
    const url = Platform.select({
      ios: `maps://app?daddr=${ride.pickupLat},${ride.pickupLng}`,
      default: `google.navigation:q=${ride.pickupLat},${ride.pickupLng}`,
    });
    if (url) {
      void Linking.openURL(url);
    }
  }, [ride.pickupLat, ride.pickupLng]);

  const handleCancel = useCallback(() => {
    Alert.alert(t("activeRide.cancelTitle"), t("activeRide.cancelMessage"), [
      { text: t("auth.ok"), style: "cancel" },
      {
        text: t("activeRide.cancel"),
        style: "destructive",
        onPress: async () => {
          setIsCancelling(true);
          try {
            await cancelRide(ride.rideId);
            clearActiveRide();
            void setTrackerActiveRide(null);
          } catch (err) {
            Alert.alert("Error", getErrorMessage(err));
          } finally {
            setIsCancelling(false);
          }
        },
      },
    ]);
  }, [t, clearActiveRide, ride.rideId]);

  return (
    <View style={styles.container}>
      {/* ── Fare hero ── */}
      <View style={styles.fareRow}>
        <MaterialIcons name="payments" size={20} color={Brand.primary} />
        <Text style={styles.fareText}>{fareText}</Text>
        <View style={styles.vehicleBadge}>
          <Text style={styles.vehicleBadgeText}>{ride.vehicleType}</Text>
        </View>
      </View>

      {/* ── Route ── */}
      <View style={styles.routeSection}>
        {/* Pickup */}
        <View style={styles.routeRow}>
          <View style={styles.routeIconCol}>
            <View style={[styles.dot, styles.dotPickup]} />
            <View style={styles.routeLine} />
          </View>
          <View style={styles.routeTextCol}>
            <Text style={styles.routeLabel}>
              {t("activeRide.pickupLabel")}
            </Text>
            <Text style={styles.routeValue} numberOfLines={2}>
              {ride.pickupAddress}
            </Text>
          </View>
        </View>

        {/* Dropoff */}
        <View style={styles.routeRow}>
          <View style={styles.routeIconCol}>
            <View style={[styles.dot, styles.dotDropoff]} />
          </View>
          <View style={styles.routeTextCol}>
            <Text style={styles.routeLabel}>
              {t("activeRide.dropoffLabel")}
            </Text>
            <Text style={styles.routeValue} numberOfLines={2}>
              {ride.dropoffAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Passenger note ── */}
      {ride.passengerNote ? (
        <View style={styles.noteRow}>
          <MaterialIcons name="sticky-note-2" size={16} color="#64748B" />
          <Text style={styles.noteText} numberOfLines={2}>
            {ride.passengerNote}
          </Text>
        </View>
      ) : null}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <Pressable
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color={Brand.error} />
          ) : (
            <MaterialIcons name="close" size={18} color={Brand.error} />
          )}
          <Text style={styles.cancelText}>{t("activeRide.cancel")}</Text>
        </Pressable>

        <Pressable style={styles.navigateButton} onPress={handleNavigate}>
          <MaterialIcons name="navigation" size={18} color="#fff" />
          <Text style={styles.navigateText}>
            {t("activeRide.navigateToPickup")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  // Fare
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fareText: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Brand.primaryDark,
    flex: 1,
  },
  vehicleBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  vehicleBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: "#64748B",
  },

  // Route
  routeSection: {
    marginBottom: Spacing.sm,
  },
  routeRow: {
    flexDirection: "row",
  },
  routeIconCol: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotPickup: {
    backgroundColor: Brand.success,
  },
  dotDropoff: {
    backgroundColor: Brand.error,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 2,
    alignSelf: "center",
    minHeight: 14,
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
    fontSize: FontSize.sm,
    color: "#1A1A2E",
    fontWeight: "500",
  },

  // Note
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    marginBottom: Spacing.sm,
  },
  noteText: {
    fontSize: FontSize.sm,
    color: "#64748B",
    flex: 1,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Brand.error,
  },
  cancelText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Brand.error,
  },
  navigateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Brand.success,
  },
  navigateText: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: "#fff",
  },
});
