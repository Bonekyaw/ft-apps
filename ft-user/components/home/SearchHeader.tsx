import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/lib/i18n";
import { Colors, Brand, BorderRadius, FontSize, Spacing } from "@/constants/theme";

interface SearchHeaderProps {
  userName?: string | null;
  onSearchPress: () => void;
}

export function SearchHeader({ userName, onSearchPress }: SearchHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();

  const greeting = userName
    ? t("home.greeting", { name: userName })
    : t("home.greetingDefault");

  return (
    <View style={styles.container}>
      <Text style={[styles.greeting, { color: colors.text }]}>
        {greeting}
      </Text>

      <Pressable
        onPress={onSearchPress}
        style={({ pressed }) => [
          styles.searchBox,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <MaterialIcons name="search" size={22} color={colors.textMuted} />
        <Text style={[styles.searchPlaceholder, { color: colors.inputPlaceholder }]}>
          {t("home.searchPlaceholder")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchPlaceholder: {
    fontSize: FontSize.md,
    flex: 1,
  },
});
