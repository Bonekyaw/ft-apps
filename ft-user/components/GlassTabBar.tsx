import { BlurView } from "expo-blur";
import {
  TabList,
  TabSlot,
  Tabs,
  TabTrigger,
  useTabTrigger,
} from "expo-router/ui";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Brand } from "@/constants/theme";
import { useTranslation } from "@/lib/i18n";

// iOS liquid glass constants
const BAR_HEIGHT = 56;
const BAR_MARGIN_H = 80; // horizontal inset so it looks like a floating pill
const BAR_RADIUS = 28; // half of height → full capsule
const ICON_SIZE = 22;
const LABEL_SIZE = 10;

const TABS_CONFIG = [
  {
    name: "(home)" as const,
    href: "/(tabs)/(home)" as const,
    labelKey: "tabs.home" as const,
    icon: "home" as const,
    iconFilled: "home" as const,
  },
  {
    name: "explore" as const,
    href: "/(tabs)/explore" as const,
    labelKey: "tabs.activity" as const,
    icon: "schedule" as const,
    iconFilled: "schedule" as const,
  },
  {
    name: "profile" as const,
    href: "/(tabs)/profile" as const,
    labelKey: "tabs.profile" as const,
    icon: "person" as const,
    iconFilled: "person" as const,
  },
] as const;

// ─── Animated Tab Button ─────────────────────────────────────────────────────

function GlassTabButton({
  name,
  labelKey,
  t,
  icon,
  iconFilled,
}: {
  name: string;
  labelKey: string;
  t: (key: string) => string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  iconFilled: React.ComponentProps<typeof MaterialIcons>["name"];
}) {
  const label = t(labelKey);
  const { trigger } = useTabTrigger({ name });
  const isFocused = Boolean(trigger?.isFocused);

  // Subtle scale spring when selected
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isFocused ? 1.08 : 1, {
          damping: 15,
          stiffness: 180,
        }),
      },
    ],
  }));

  const activeColor = Brand.primary; // iOS system blue
  const inactiveColor = "rgba(60,60,67,0.6)"; // iOS secondary label

  return (
    <Animated.View style={[styles.tabButton, animStyle]}>
      <MaterialIcons
        name={isFocused ? iconFilled : icon}
        size={ICON_SIZE}
        color={isFocused ? activeColor : inactiveColor}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? activeColor : inactiveColor },
          isFocused && styles.tabLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AndroidGlassTabs({ hidden = false }: { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12);
  const { t } = useTranslation();

  return (
    <Tabs>
      {/* Screen content */}
      <TabSlot />

      {/* Hidden TabList – registers routes */}
      <TabList style={styles.hiddenTabList}>
        {TABS_CONFIG.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} />
        ))}
      </TabList>

      {/* Floating glass pill — hidden when a full-screen page is active */}
      {!hidden && (
        <View style={[styles.floatingContainer, { bottom: bottomPad }]}>
          <View style={styles.pill}>
            {/* Blur layer */}
            <BlurView
              intensity={50}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />

            {/* Semi-transparent overlay for the glass tint */}
            <View style={styles.glassOverlay} />

            {/* Subtle top border highlight */}
            <View style={styles.topHighlight} />

            {/* Tab buttons */}
            <View style={styles.tabRow}>
              {TABS_CONFIG.map((tab) => (
                <TabTrigger key={tab.name} name={tab.name} style={styles.trigger}>
                  <GlassTabButton
                    name={tab.name}
                    labelKey={tab.labelKey}
                    t={t}
                    icon={tab.icon}
                    iconFilled={tab.iconFilled}
                  />
                </TabTrigger>
              ))}
            </View>
          </View>
        </View>
      )}
    </Tabs>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hiddenTabList: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: "none",
  },

  // Floating wrapper – centers the pill horizontally
  floatingContainer: {
    position: "absolute",
    left: BAR_MARGIN_H,
    right: BAR_MARGIN_H,
    alignItems: "center",
  },

  // The capsule itself
  pill: {
    width: "100%",
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: "hidden",
    // iOS-style shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },

  // Tinted glass overlay
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  // Thin bright line at the top edge (specular highlight)
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  // Row of buttons inside the pill
  tabRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
  },

  trigger: {
    flex: 1,
  },

  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
  },

  tabLabel: {
    fontSize: LABEL_SIZE,
    fontWeight: "500",
    letterSpacing: 0.1,
  },

  tabLabelActive: {
    fontWeight: "600",
  },
});
