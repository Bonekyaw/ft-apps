import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRideHistory } from "@/hooks/use-destination-data";

interface RecentPlacesProps {
  /** Called when user taps a recent ride destination. */
  onSelect: (item: {
    address: string;
    latitude: number;
    longitude: number;
    mainText: string;
  }) => void;
}

export function RecentPlaces({ onSelect }: RecentPlacesProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const { data: rides, isLoading } = useRideHistory();

  // Deduplicate: keep only the most recent ride per unique dropoff address
  const uniqueRides = useMemo(() => {
    if (!rides) return [];
    const seen = new Set<string>();
    return rides.filter((r) => {
      const key = r.dropoffAddress;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rides]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} size="small" />
      </View>
    );
  }

  if (uniqueRides.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t("destination.noRecent")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {uniqueRides.map((ride) => {
        const displayName =
          ride.dropoffMainText ?? ride.dropoffAddress.split(",")[0];

        return (
          <Pressable
            key={ride.id}
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() =>
              onSelect({
                address: ride.dropoffAddress,
                latitude: ride.dropoffLat,
                longitude: ride.dropoffLng,
                mainText: displayName,
              })
            }
          >
            <MaterialIcons name="history" size={20} color={colors.icon} />
            <View style={styles.rowContent}>
              <Text
                style={[styles.rowTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <Text
                style={[styles.rowSub, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {ride.dropoffAddress}
              </Text>
            </View>
            <Text style={[styles.fare, { color: colors.textSecondary }]}>
              {ride.totalFare.toLocaleString()} {ride.currency}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
  list: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  fare: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
