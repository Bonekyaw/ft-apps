import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import {
  SearchHeader,
  BannerCarousel,
  BookRideButton,
  AnnouncementCard,
} from "@/components/home";
import { useSession } from "@/lib/auth-client";
import { useAnnouncements } from "@/hooks/use-home-data";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/lib/i18n";
import { Colors, Brand, FontSize, Spacing } from "@/constants/theme";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const {
    data: announcements,
    isLoading: announcementsLoading,
    isRefetching,
  } = useAnnouncements();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["banners"] }),
      queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    ]);
    setRefreshing(false);
  };

  const navigateToSearch = () => {
    router.push("/(tabs)/(home)/destination-search");
  };

  const userName = session?.user?.name?.split(" ")[0] ?? null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Brand.primary}
            colors={[Brand.primary]}
          />
        }
      >
        {/* Search box + greeting */}
        <SearchHeader
          userName={userName}
          onSearchPress={navigateToSearch}
        />

        {/* Banner carousel */}
        <BannerCarousel />

        {/* Spacer */}
        <View style={styles.sectionSpacer} />

        {/* Book a ride CTA */}
        <BookRideButton onPress={navigateToSearch} />

        {/* Spacer */}
        <View style={styles.sectionSpacer} />

        {/* Announcements */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t("home.announcements")}
          </Text>
        </View>

        {announcementsLoading ? (
          <View style={styles.announcementsLoading}>
            <ActivityIndicator size="small" color={Brand.primary} />
          </View>
        ) : announcements && announcements.length > 0 ? (
          announcements.map((item) => (
            <AnnouncementCard key={item.id} announcement={item} />
          ))
        ) : (
          <View style={styles.emptyAnnouncements}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t("home.noAnnouncements")}
            </Text>
          </View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionSpacer: {
    height: Spacing.lg,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  announcementsLoading: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  emptyAnnouncements: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
});
