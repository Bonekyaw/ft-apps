import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Brand, BorderRadius, Colors, FontSize, Spacing } from "@/constants/theme";
import { useAlertStore, type AlertVariant } from "@/store/alert-store";

// ---------------------------------------------------------------------------
// Icon config per variant
// ---------------------------------------------------------------------------

const VARIANT_CONFIG: Record<
  AlertVariant,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }
> = {
  error: { icon: "close-circle", bg: "#FEE2E2", fg: Brand.error },
  success: { icon: "checkmark-circle", bg: "#D1FAE5", fg: Brand.success },
  warning: { icon: "warning", bg: "#FEF3C7", fg: Brand.warning },
  info: { icon: "information-circle", bg: "#DBEAFE", fg: "#3B82F6" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomAlert() {
  const { visible, variant, title, message, buttons, hide } = useAlertStore();

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const isDark = colorScheme === "dark";

  // Animation values
  const backdrop = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 18,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdrop.setValue(0);
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, backdrop, scale, opacity]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => hide());
  };

  const handleButton = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hide();
      onPress?.();
    });
  };

  if (!visible) return null;

  const cfg = VARIANT_CONFIG[variant];
  const hasMultipleButtons = buttons.length > 1;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      {/* Blurred backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
        <BlurView
          intensity={24}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdropOverlay]}
          onPress={handleDismiss}
        />
      </Animated.View>

      {/* Centered card */}
      <View style={styles.centeredContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              shadowColor: isDark ? "#000" : "#64748B",
              transform: [{ scale }],
              opacity,
            },
          ]}
        >
          {/* Icon badge */}
          <View style={[styles.iconBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={32} color={cfg.fg} />
          </View>

          {/* Title */}
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {title}
          </Text>

          {/* Message */}
          {message ? (
            <Text
              style={[styles.message, { color: colors.textSecondary }]}
              numberOfLines={6}
            >
              {message}
            </Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Buttons */}
          <View
            style={[
              styles.buttonRow,
              !hasMultipleButtons && styles.buttonRowSingle,
            ]}
          >
            {buttons.map((btn, i) => {
              const isCancel = btn.style === "cancel";
              const isPrimary = !isCancel && (buttons.length === 1 || i === buttons.length - 1);

              return (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <View
                      style={[
                        styles.buttonDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleButton(btn.onPress)}
                    style={[
                      styles.button,
                      isPrimary && {
                        backgroundColor: cfg.fg,
                      },
                      isCancel && {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.04)",
                      },
                      !isPrimary && !isCancel && {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.04)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isPrimary && { color: "#FFFFFF", fontWeight: "700" },
                        isCancel && { color: colors.textSecondary },
                        !isPrimary && !isCancel && { color: colors.text, fontWeight: "600" },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdropOverlay: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    paddingTop: Spacing.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: FontSize.sm,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
  },
  buttonRowSingle: {
    justifyContent: "center",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  buttonDivider: {
    width: 0,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
