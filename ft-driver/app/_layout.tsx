import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import "react-native-reanimated";

import { useSession, signOut } from "@/lib/auth-client";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/context/onboarding-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTranslation } from "@/lib/i18n";
import { Brand, Colors } from "@/constants/theme";
import { closeAblyClient, enterPresence, leavePresence } from "@/lib/ably";
import { useDriverStatusStore } from "@/lib/driver-status-store";
import { startTracking, stopTracking } from "@/lib/location-tracker";

function RootStack() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const { data: session, isPending, refetch } = useSession();
  const { onboardingComplete, isLoading: isOnboardingLoading } =
    useOnboarding();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Revalidate session when app comes to foreground (e.g. after admin revokes sessions)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        void refetch?.();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [refetch]);

  // Auto-sign-out users who are not DRIVER role (e.g. a USER who somehow got a session)
  const userRole = (
    (session?.user as Record<string, unknown> | undefined)?.role as
      | string
      | undefined
  )?.toUpperCase();
  useEffect(() => {
    if (session && !isPending && userRole && userRole !== "DRIVER") {
      closeAblyClient();
      useDriverStatusStore.getState().reset();
      void signOut();
    }
  }, [session, isPending, userRole]);

  // ── Ably presence + GPS tracking on AppState changes ──
  const userId = session?.user?.id;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const { isOnline } = useDriverStatusStore.getState();
      if (!userId || !isOnline) return;

      if (nextState === "background" || nextState === "inactive") {
        // Stop GPS tracking and leave presence when backgrounded
        void stopTracking();
        void leavePresence();
      } else if (nextState === "active") {
        // Resume presence and GPS tracking when foregrounded
        void enterPresence(userId);
        void startTracking();
      }
    });
    return () => sub.remove();
  }, [userId]);

  // ── Clean up Ably on sign-out (session becomes null) ──
  const prevSessionRef = useRef(session);
  useEffect(() => {
    if (prevSessionRef.current && !session) {
      // Session was just cleared — user signed out
      closeAblyClient();
      useDriverStatusStore.getState().reset();
    }
    prevSessionRef.current = session;
  }, [session]);

  const isFullyAuthenticated =
    !!session &&
    session.user?.emailVerified === true &&
    userRole === "DRIVER";
  const hasCompletedOnboarding = onboardingComplete === true;
  const isLoading = isPending || isOnboardingLoading;

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Protected guard={!hasCompletedOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={hasCompletedOnboarding && !isFullyAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isFullyAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            headerShown: true,
            title: t("modal.title"),
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={DefaultTheme}>
        <OnboardingProvider>
          <RootStack />
        </OnboardingProvider>
      </ThemeProvider>
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
