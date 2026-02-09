import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button, Input } from "@/components/ui";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useTranslation } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale, setLocale } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = t("auth.errors.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t("auth.errors.emailInvalid");
    }

    if (!password) {
      newErrors.password = t("auth.errors.passwordRequired");
    } else if (password.length < 8) {
      newErrors.password = t("auth.errors.passwordMinLength");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.signInFailed"),
          result.error.message || t("auth.errors.signInFailedMessage"),
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.googleSignInFailed");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      t("auth.errors.comingSoon"),
      t("auth.errors.forgotPasswordSoon"),
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Language switcher */}
          <View style={styles.languageRow}>
            <TouchableOpacity
              style={[
                styles.languageBtn,
                locale === "en" && {
                  borderColor: Brand.primary,
                  backgroundColor: `${Brand.primary}15`,
                },
              ]}
              onPress={() => setLocale("en" as LocaleCode)}
            >
              <Text
                style={[
                  styles.languageBtnText,
                  { color: colors.textSecondary },
                  locale === "en" && [styles.languageBtnTextActive, { color: Brand.primary }],
                ]}
              >
                {t("profile.english")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageBtn,
                locale === "my" && {
                  borderColor: Brand.primary,
                  backgroundColor: `${Brand.primary}15`,
                },
              ]}
              onPress={() => setLocale("my" as LocaleCode)}
            >
              <Text
                style={[
                  styles.languageBtnText,
                  { color: colors.textSecondary },
                  locale === "my" && [styles.languageBtnTextActive, { color: Brand.primary }],
                ]}
              >
                {t("profile.myanmar")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: `${Brand.primary}15` },
              ]}
            >
              <Ionicons name="car-sport" size={48} color={Brand.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("auth.signIn.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("auth.signIn.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t("auth.signIn.email")}
              placeholder={t("auth.signIn.emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              error={errors.email}
            />

            <Input
              label={t("auth.signIn.password")}
              placeholder={t("auth.signIn.passwordPlaceholder")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              leftIcon="lock-closed-outline"
              error={errors.password}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
            >
              <Text
                style={[styles.forgotPasswordText, { color: Brand.primary }]}
              >
                {t("auth.signIn.forgotPassword")}
              </Text>
            </TouchableOpacity>

            <Button
              title={t("auth.signIn.submit")}
              onPress={handleSignIn}
              loading={loading}
              size="lg"
              style={styles.signInButton}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                {t("auth.signIn.orContinueWith")}
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Social Login */}
            <Button
              title={t("auth.signIn.continueWithGoogle")}
              onPress={handleGoogleSignIn}
              variant="social"
              loading={googleLoading}
              size="lg"
              icon={<Ionicons name="logo-google" size={20} color="#DB4437" />}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t("auth.signIn.noAccount")}{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
              <Text style={[styles.linkText, { color: Brand.primary }]}>
                {t("auth.signIn.signUp")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  languageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  languageBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  languageBtnText: {
    fontSize: FontSize.sm,
  },
  languageBtnTextActive: {
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: "center",
  },
  form: {
    flex: 1,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  forgotPasswordText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  signInButton: {
    marginBottom: Spacing.lg,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.md,
  },
  linkText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
