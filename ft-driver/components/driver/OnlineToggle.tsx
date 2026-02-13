import React, { useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/auth-client";
import { useDriverStatusStore } from "@/lib/driver-status-store";
import { useTranslation } from "@/lib/i18n";
import { Brand, BorderRadius, FontSize, Spacing } from "@/constants/theme";

export default function OnlineToggle() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const insets = useSafeAreaInsets();

  const isOnline = useDriverStatusStore((s) => s.isOnline);
  const isTransitioning = useDriverStatusStore((s) => s.isTransitioning);
  const goOnline = useDriverStatusStore((s) => s.goOnline);
  const goOffline = useDriverStatusStore((s) => s.goOffline);

  const handleToggle = useCallback(
    (value: boolean) => {
      const userId = session?.user?.id;
      if (!userId) return;
      if (value) {
        void goOnline(userId);
      } else {
        void goOffline();
      }
    },
    [session?.user?.id, goOnline, goOffline],
  );

  return (
    <View style={[styles.container, { top: insets.top + Spacing.sm }]}>
      <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
        {/* Status dot */}
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />

        {/* Label */}
        <Text style={[styles.label, isOnline ? styles.labelOnline : styles.labelOffline]}>
          {isOnline ? t("status.online") : t("status.offline")}
        </Text>

        {/* Switch or spinner */}
        {isTransitioning ? (
          <ActivityIndicator
            size="small"
            color={isOnline ? "#FFFFFF" : Brand.primary}
            style={styles.spinner}
          />
        ) : (
          <Switch
            value={isOnline}
            onValueChange={handleToggle}
            trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
            thumbColor={isOnline ? "#FFFFFF" : "#F3F4F6"}
            ios_backgroundColor="#D1D5DB"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.md,
    zIndex: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  pillOnline: {
    backgroundColor: "#065F46", // deep green
  },
  pillOffline: {
    backgroundColor: "#FFFFFF",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  dotOnline: {
    backgroundColor: "#34D399", // bright green
  },
  dotOffline: {
    backgroundColor: "#9CA3AF", // gray
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: "600",
    marginRight: Spacing.sm,
  },
  labelOnline: {
    color: "#FFFFFF",
  },
  labelOffline: {
    color: "#374151",
  },
  spinner: {
    marginLeft: Spacing.xs,
  },
});
