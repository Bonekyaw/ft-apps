import { useEffect, useMemo, useState } from "react";
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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as WebBrowser from "expo-web-browser";

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
import {
  createSignInSchema,
  type SignInFormValues,
} from "@/lib/validations";
import { authClient } from "@/lib/auth-client";
import { validateUserLogin, getErrorMessage } from "@/lib/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SignInScreen() {
  // Warm up Android Chrome Custom Tabs so the OAuth browser opens in-app
  useEffect(() => {
    if (Platform.OS === "android") {
      WebBrowser.warmUpAsync();
      return () => {
        WebBrowser.coolDownAsync();
      };
    }
  }, []);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale, setLocale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const signInSchema = useMemo(() => createSignInSchema(t), [t]);
  const { control, handleSubmit } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSignIn = async (data: SignInFormValues) => {
    setLoading(true);

    // 1) Validate the email is a rider account before sending credentials
    try {
      await validateUserLogin(data.email);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      Alert.alert(t("auth.errors.signInFailed"), message);
      setLoading(false);
      return;
    }

    // 2) Email is valid — proceed with sign-in
    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
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
    router.push("/(auth)/forgot-password");
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
          bounces={false}
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
              <Ionicons name="car-sport" size={36} color={Brand.primary} />
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
            {/* Social Login */}
            <Button
              title={t("auth.signIn.continueWithGoogle")}
              onPress={handleGoogleSignIn}
              variant="social"
              loading={googleLoading}
              size="lg"
              icon={<Ionicons name="logo-google" size={20} color="#DB4437" />}
              style={styles.googleButton}
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

            <Controller
              control={control}
              name="email"
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  label={t("auth.signIn.email")}
                  placeholder={t("auth.signIn.emailPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  leftIcon="mail-outline"
                  error={error?.message}
                  containerStyle={styles.inputCompact}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  label={t("auth.signIn.password")}
                  placeholder={t("auth.signIn.passwordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  leftIcon="lock-closed-outline"
                  error={error?.message}
                  containerStyle={styles.inputCompact}
                />
              )}
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
              onPress={handleSubmit(onSignIn)}
              loading={loading}
              size="lg"
              style={styles.signInButton}
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  languageRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  languageBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
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
    marginBottom: Spacing.md,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  form: {
    flex: 1,
  },
  inputCompact: {
    marginBottom: Spacing.sm,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  forgotPasswordText: {
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  signInButton: {
    marginBottom: Spacing.sm,
  },
  googleButton: {
    marginBottom: Spacing.sm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing.sm,
  },
  footerText: {
    fontSize: FontSize.sm,
  },
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});
