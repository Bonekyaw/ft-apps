import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
  ViewToken,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useOnboarding } from "@/context/onboarding-context";
import { Button } from "@/components/ui";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";

const { width, height } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  accent?: string;
}

const slides: OnboardingSlide[] = [
  {
    id: "1",
    icon: "car-sport",
    title: "Book Your Ride",
    description:
      "Request a ride in seconds. Enter your destination and we'll connect you with nearby drivers.",
    accent: Brand.primary,
  },
  {
    id: "2",
    icon: "location",
    title: "Track in Real-Time",
    description:
      "Watch your driver arrive on the map. Know exactly when your ride will reach you.",
    accent: "#10B981",
  },
  {
    id: "3",
    icon: "shield-checkmark",
    title: "Safe & Verified",
    description:
      "All drivers are verified and trained. Your safety is our top priority.",
    accent: "#6366F1",
  },
  {
    id: "4",
    icon: "card",
    title: "Easy Payments",
    description:
      "Pay with cash or card. Transparent pricing with no hidden fees.",
    accent: "#F59E0B",
  },
];

const LIGHT = Colors.light;

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const { completeOnboarding } = useOnboarding();

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = async () => {
    await completeOnboarding();
    router.replace("/(auth)/sign-in");
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={[styles.slide, { width }]}>
      {/* Decorative background circles */}
      <View style={styles.decorContainer}>
        <View
          style={[
            styles.decorCircle,
            styles.decorCircleLarge,
            { backgroundColor: `${item.accent ?? Brand.primary}12` },
          ]}
        />
        <View
          style={[
            styles.decorCircle,
            styles.decorCircleSmall,
            { backgroundColor: `${item.accent ?? Brand.primary}18` },
          ]}
        />
      </View>

      <View style={styles.slideContent}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: `${item.accent ?? Brand.primary}18`,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 24,
                },
                android: { elevation: 8 },
              }),
            },
          ]}
        >
          <Ionicons
            name={item.icon}
            size={72}
            color={item.accent ?? Brand.primary}
          />
        </View>

        <Text style={styles.stepLabel}>
          {index + 1} of {slides.length}
        </Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {slides.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 28, 8],
          extrapolate: "clamp",
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.35, 1, 0.35],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity,
                backgroundColor: Brand.primary,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          {currentIndex < slides.length - 1 ? (
            <Pressable
              onPress={handleSkip}
              hitSlop={12}
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && styles.skipBtnPressed,
              ]}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : (
            <View style={styles.skipBtn} />
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
        />

        {renderPagination()}

        <View style={styles.footer}>
          <Button
            title={currentIndex === slides.length - 1 ? "Get Started" : "Next"}
            onPress={handleNext}
            size="lg"
            style={styles.primaryButton}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT.background,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    minHeight: 48,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  skipBtnPressed: {
    backgroundColor: LIGHT.backgroundSecondary,
  },
  skipText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: LIGHT.textSecondary,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  decorCircle: {
    position: "absolute",
    borderRadius: 9999,
  },
  decorCircleLarge: {
    width: width * 0.9,
    height: width * 0.9,
    top: height * 0.08,
  },
  decorCircleSmall: {
    width: width * 0.5,
    height: width * 0.5,
    top: height * 0.2,
  },
  slideContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  iconWrapper: {
    width: 140,
    height: 140,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  stepLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Brand.primary,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: "800",
    color: LIGHT.text,
    textAlign: "center",
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: FontSize.lg,
    lineHeight: 26,
    color: LIGHT.textSecondary,
    textAlign: "center",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  primaryButton: {
    width: "100%",
    borderRadius: BorderRadius.lg,
  },
});
