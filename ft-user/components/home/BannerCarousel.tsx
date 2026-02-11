import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";

import { useBanners, type Banner } from "@/hooks/use-home-data";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";

/** Banner aspect ratio (width : height). 2.5:1 looks good on both phone and tablet. */
const BANNER_ASPECT = 2.5;
/** Max carousel height so it doesn't become absurdly tall on iPad landscape. */
const MAX_CAROUSEL_HEIGHT = 280;

function BannerItem({
  item,
  onPress,
}: {
  item: Banner;
  onPress?: (banner: Banner) => void;
}) {
  return (
    <Pressable onPress={() => onPress?.(item)} style={styles.bannerItem}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.bannerImage}
        resizeMode="cover"
      />
    </Pressable>
  );
}

interface BannerCarouselProps {
  onBannerPress?: (banner: Banner) => void;
}

export function BannerCarousel({ onBannerPress }: BannerCarouselProps) {
  const { data: banners, isLoading } = useBanners();
  const carouselRef = useRef<ICarouselInstance>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width: screenWidth } = useWindowDimensions();

  // Responsive dimensions
  const carouselWidth = screenWidth - Spacing.md * 2;
  const carouselHeight = Math.min(
    Math.round(carouselWidth / BANNER_ASPECT),
    MAX_CAROUSEL_HEIGHT,
  );

  const handleProgressChange = useCallback(
    (_offsetProgress: number, absoluteProgress: number) => {
      const rounded = Math.round(absoluteProgress);
      setActiveIndex((prev) => (prev !== rounded ? rounded : prev));
    },
    [],
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { height: carouselHeight }]}>
        <ActivityIndicator size="small" color={Brand.primary} />
      </View>
    );
  }

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Carousel
        ref={carouselRef}
        data={banners}
        width={carouselWidth}
        height={carouselHeight}
        loop={banners.length > 1}
        autoPlay={banners.length > 1}
        autoPlayInterval={4000}
        scrollAnimationDuration={600}
        onProgressChange={handleProgressChange}
        renderItem={({ item }) => (
          <BannerItem item={item} onPress={onBannerPress} />
        )}
      />

      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex % banners.length && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  bannerItem: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginHorizontal: 2,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.md,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  dotActive: {
    backgroundColor: Brand.primary,
    width: 18,
    borderRadius: 4,
  },
});
