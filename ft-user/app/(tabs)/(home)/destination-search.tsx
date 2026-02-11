import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { PlacesSearchBar } from "@/components/PlacesSearchBar";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/lib/i18n";
import { Colors, Brand, FontSize, Spacing } from "@/constants/theme";

export default function DestinationSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();

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
      {/* Header with back button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("home.searchPlaceholder")}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <PlacesSearchBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
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
  searchContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
});
