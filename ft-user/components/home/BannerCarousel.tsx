import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Carousel, {
  type ICarouselInstance,
} from "react-native-reanimated-carousel";
import { useSharedValue } from "react-native-reanimated";

import { useBanners, type Banner } from "@/hooks/use-home-data";
import { Brand, BorderRadius, Spacing } from "@/constants/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const CAROUSEL_HEIGHT = 160;

function BannerItem({
  item,
  onPress,
}: {
  item: Banner;
  onPress?: (banner: Banner) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={styles.bannerItem}
    >
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
  const progress = useSharedValue(0);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
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
        width={CAROUSEL_WIDTH}
        height={CAROUSEL_HEIGHT}
        loop={banners.length > 1}
        autoPlay={banners.length > 1}
        autoPlayInterval={4000}
        scrollAnimationDuration={600}
        onProgressChange={progress}
        renderItem={({ item }) => (
          <BannerItem item={item} onPress={onBannerPress} />
        )}
      />

      {/* Pagination dots */}
      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === Math.round(progress.value) && styles.dotActive,
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
    height: CAROUSEL_HEIGHT,
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
