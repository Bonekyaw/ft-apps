import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useTranslation } from "@/lib/i18n";
import { Brand, BorderRadius, FontSize, Spacing } from "@/constants/theme";

interface BookRideButtonProps {
  onPress: () => void;
}

export function BookRideButton({ onPress }: BookRideButtonProps) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();

  // Scale icon container slightly on wider screens
  const iconSize = Math.min(Math.round(screenWidth * 0.13), 60);
  const taxiIconSize = Math.min(Math.round(iconSize * 0.6), 36);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { width: iconSize, height: iconSize },
        ]}
      >
        <MaterialIcons
          name="local-taxi"
          size={taxiIconSize}
          color={Brand.secondary}
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{t("home.bookRide")}</Text>
        <Text style={styles.subtitle}>{t("home.bookRideSubtitle")}</Text>
      </View>

      <MaterialIcons
        name="arrow-forward-ios"
        size={16}
        color={Brand.secondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Brand.primary,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    shadowColor: Brand.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Brand.secondary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Brand.secondary,
    opacity: 0.7,
    marginTop: 2,
  },
});
