import React, { memo, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { useTranslation } from "@/lib/i18n";
import { useRideBookingStore } from "@/store/ride-booking";
import { Brand, BorderRadius, FontSize, Spacing } from "@/constants/theme";

/** Height of the iOS native tab bar (points). */
const IOS_TAB_BAR_HEIGHT = 50;

interface Props {
  onContinue: () => void;
}

export default function BookingStatusOverlay({ onContinue }: Props) {
  const { t } = useTranslation();
  const bookingStatus = useRideBookingStore((s) => s.bookingStatus);
  const acceptedDriver = useRideBookingStore((s) => s.acceptedDriver);

  // Slide-up entrance animation
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (bookingStatus !== "searching" && bookingStatus !== "accepted") return;
    slideAnim.setValue(300);
    Animated.spring(slideAnim, {
      toValue: 0,
      friction: 9,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [bookingStatus, slideAnim]);

  if (bookingStatus !== "searching" && bookingStatus !== "accepted")
    return null;

  const bottomOffset = Platform.OS === "ios" ? IOS_TAB_BAR_HEIGHT : 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          bottom: bottomOffset,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Drag handle indicator */}
      <View style={styles.handleBar} />

      {bookingStatus === "searching" && <SearchingContent t={t} />}

      {bookingStatus === "accepted" && (
        <AcceptedContent
          driverName={acceptedDriver?.driverName ?? "Driver"}
          t={t}
          onContinue={onContinue}
        />
      )}
    </Animated.View>
  );
}

// ── Radar Ring (single expanding + fading circle) ─────────────
const RadarRing = memo(function RadarRing({
  delay,
  duration,
  size,
}: {
  delay: number;
  duration: number;
  size: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, scale, opacity]);

  const animatedScale = scale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 2.2],
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          borderWidth: 2,
          borderColor: Brand.primary,
          opacity,
          transform: [{ scale: animatedScale }],
        },
      ]}
    />
  );
});

// ── Searching (compact — no cancel button) ──────────────────
const SearchingContent = memo(function SearchingContent({
  t,
}: {
  t: (key: string) => string;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(dotAnim, {
        toValue: 3,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [dotAnim]);

  return (
    <View style={styles.searchingRow}>
      {/* Compact radar + icon */}
      <View style={styles.radarContainer}>
        <RadarRing delay={0} duration={1800} size={RADAR_SIZE} />
        <RadarRing delay={600} duration={1800} size={RADAR_SIZE} />
        <Animated.View
          style={[
            styles.iconCircle,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <MaterialIcons name="local-taxi" size={24} color="#fff" />
        </Animated.View>
      </View>

      {/* Text + dots */}
      <View style={styles.searchingTextCol}>
        <Text style={styles.title}>{t("bookTaxi.findingDriver")}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t("bookTaxi.findingDriverMessage")}
        </Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <DotIndicator key={i} index={i} anim={dotAnim} />
          ))}
        </View>
      </View>
    </View>
  );
});

// ── Animated dot indicator ──────────────────────────────────
const DotIndicator = memo(function DotIndicator({
  index,
  anim,
}: {
  index: number;
  anim: Animated.Value;
}) {
  const opacity = anim.interpolate({
    inputRange: [index, index + 0.5, index + 1],
    outputRange: [0.3, 1, 0.3],
    extrapolate: "clamp",
  });

  return <Animated.View style={[styles.dot, { opacity }]} />;
});

// ── Accepted ───────────────────────────────────────────────
const AcceptedContent = memo(function AcceptedContent({
  driverName,
  t,
  onContinue,
}: {
  driverName: string;
  t: (key: string, opts?: Record<string, string>) => string;
  onContinue: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <View style={styles.contentCenter}>
      <Animated.View
        style={[
          styles.successCircle,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <MaterialIcons name="check" size={36} color="#fff" />
      </Animated.View>
      <Text style={styles.title}>{t("bookTaxi.driverAccepted")}</Text>
      <Text style={styles.subtitle}>
        {t("bookTaxi.driverName", { name: driverName })}
      </Text>
      <Pressable
        onPress={onContinue}
        style={[styles.button, styles.primaryButton]}
      >
        <Text style={styles.primaryButtonText}>
          {t("bookTaxi.continue")}
        </Text>
      </Pressable>
    </View>
  );
});

// ── Styles ─────────────────────────────────────────────────

const RADAR_SIZE = 70;

const styles = StyleSheet.create({
  // Bottom sheet container
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: "#fff",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },

  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },

  // Searching: horizontal row layout (compact)
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  searchingTextCol: {
    flex: 1,
    gap: 4,
  },

  // Centered layout for accepted
  contentCenter: {
    alignItems: "center",
    gap: Spacing.sm,
  },

  // Loading dots
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.primary,
  },

  // Text
  title: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: "#64748B",
    lineHeight: 20,
  },

  // Success
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.success,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: Brand.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  // Buttons
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: Brand.primary,
  },
  primaryButtonText: {
    color: Brand.secondary,
    fontWeight: "700",
    fontSize: FontSize.md,
  },
});
