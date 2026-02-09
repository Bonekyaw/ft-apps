import { Platform } from "react-native";
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

/**
 * Get the base URL for the API server.
 * - Uses EXPO_PUBLIC_BETTER_AUTH_URL env variable if set
 * - Falls back to platform-specific defaults for development
 */
function getBaseURL(): string {
  // Use environment variable if available
  const envUrl = process.env.EXPO_PUBLIC_BETTER_AUTH_URL;
  if (envUrl && envUrl !== "http://localhost:3000") {
    return envUrl;
  }

  // Platform-specific defaults for development
  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000";
    }
    // iOS simulator can use localhost directly
    return "http://localhost:3000";
  }

  // Production - should be set via environment variable
  return envUrl || "http://localhost:3000";
}

const client = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [
    expoClient({
      scheme: "familytaxiuser",
      storagePrefix: "familytaxiuser",
      storage: SecureStore,
    }),
    emailOTPClient(),
  ],
});

// Export individual methods and hooks to avoid issues with React Compiler
export const authClient = client;
export const useSession = client.useSession;
export const signIn = client.signIn;
export const signUp = client.signUp;
export const signOut = client.signOut;
export const emailOtp = client.emailOtp;
