import React from "react";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import "react-native-reanimated";

import { useSession } from "@/lib/auth-client";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/context/onboarding-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Brand, Colors } from "@/constants/theme";

function RootStack() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { data: session, isPending } = useSession();
  const { onboardingComplete, isLoading: isOnboardingLoading } = useOnboarding();

  const isFullyAuthenticated =
    !!session && session.user?.emailVerified === true;
  const hasCompletedOnboarding = onboardingComplete === true;
  const isLoading = isPending || isOnboardingLoading;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Protected guard={!hasCompletedOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected
        guard={hasCompletedOnboarding && !isFullyAuthenticated}
      >
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isFullyAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            headerShown: true,
            title: "Modal",
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
