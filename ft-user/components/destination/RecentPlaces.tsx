import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, Colors, FontSize, Spacing, BorderRadius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRideHistory } from "@/hooks/use-destination-data";
import type { RideHistoryItem } from "@/lib/api";

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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} size="small" />
      </View>
    );
  }

  if (!rides || rides.length === 0) {
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
      {rides.map((ride) => (
        <Pressable
          key={ride.id}
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() =>
            onSelect({
              address: ride.dropoffAddress,
              latitude: ride.dropoffLat,
              longitude: ride.dropoffLng,
              mainText: ride.dropoffAddress.split(",")[0],
            })
          }
        >
          <MaterialIcons name="history" size={20} color={colors.icon} />
          <View style={styles.rowContent}>
            <Text
              style={[styles.rowTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {ride.dropoffAddress.split(",")[0]}
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
      ))}
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
