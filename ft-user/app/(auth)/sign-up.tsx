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
import { authClient, emailOtp } from "@/lib/auth-client";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale, setLocale } = useTranslation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const newErrors: {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!name.trim()) {
      newErrors.name = t("auth.errors.nameRequired");
    } else if (name.trim().length < 2) {
      newErrors.name = t("auth.errors.nameMinLength");
    }

    if (!email) {
      newErrors.email = t("auth.errors.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t("auth.errors.emailInvalid");
    }

    if (!password) {
      newErrors.password = t("auth.errors.passwordRequired");
    } else if (password.length < 8) {
      newErrors.password = t("auth.errors.passwordMinLength");
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = t("auth.errors.passwordStrength");
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t("auth.errors.confirmPasswordRequired");
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.errors.passwordsDoNotMatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.signUpFailed"),
          result.error.message || t("auth.errors.signUpFailedMessage"),
        );
        return;
      }

      const otpResult = await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      if (otpResult.error) {
        Alert.alert(
          t("auth.errors.accountCreated"),
          t("auth.errors.accountCreatedNoEmail"),
          [
            {
              text: t("auth.ok"),
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ],
        );
        return;
      }

      // Navigate to OTP verification screen using replace to avoid back navigation issues
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: { email },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.googleSignUpFailed");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setGoogleLoading(false);
    }
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
          {/* Top bar: back button + language switcher */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
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
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("auth.signUp.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("auth.signUp.subtitle")}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t("auth.signUp.fullName")}
              placeholder={t("auth.signUp.fullNamePlaceholder")}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              leftIcon="person-outline"
              error={errors.name}
            />

            <Input
              label={t("auth.signUp.email")}
              placeholder={t("auth.signUp.emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              error={errors.email}
            />

            <Input
              label={t("auth.signUp.password")}
              placeholder={t("auth.signUp.passwordPlaceholder")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              leftIcon="lock-closed-outline"
              error={errors.password}
            />

            <Input
              label={t("auth.signUp.confirmPassword")}
              placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
              error={errors.confirmPassword}
            />

            {/* Password Requirements */}
            <View style={styles.requirements}>
              <Text
                style={[styles.requirementsTitle, { color: colors.textMuted }]}
              >
                {t("auth.signUp.passwordRequirements")}
              </Text>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    password.length >= 8
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={
                    password.length >= 8 ? Brand.success : colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.requirementText,
                    {
                      color:
                        password.length >= 8 ? Brand.success : colors.textMuted,
                    },
                  ]}
                >
                  {t("auth.signUp.characters8")}
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    /(?=.*[a-z])(?=.*[A-Z])/.test(password)
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={16}
                  color={
                    /(?=.*[a-z])(?=.*[A-Z])/.test(password)
                      ? Brand.success
                      : colors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.requirementText,
                    {
                      color: /(?=.*[a-z])(?=.*[A-Z])/.test(password)
                        ? Brand.success
                        : colors.textMuted,
                    },
                  ]}
                >
                  {t("auth.signUp.uppercaseLowercaseSpecial")}
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Ionicons
                  name={
                    /\d/.test(password) ? "checkmark-circle" : "ellipse-outline"
                  }
                  size={16}
                  color={/\d/.test(password) ? Brand.success : colors.textMuted}
                />
                <Text
                  style={[
                    styles.requirementText,
                    {
                      color: /\d/.test(password)
                        ? Brand.success
                        : colors.textMuted,
                    },
                  ]}
                >
                  {t("auth.signUp.number")}
                </Text>
              </View>
            </View>

            <Button
              title={t("auth.signUp.submit")}
              onPress={handleSignUp}
              loading={loading}
              size="lg"
              style={styles.signUpButton}
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
              title={t("auth.signUp.continueWithGoogle")}
              onPress={handleGoogleSignUp}
              variant="social"
              loading={googleLoading}
              size="lg"
              icon={<Ionicons name="logo-google" size={20} color="#DB4437" />}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t("auth.signUp.hasAccount")}{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
              <Text style={[styles.linkText, { color: Brand.primary }]}>
                {t("auth.signUp.signIn")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={[styles.terms, { color: colors.textMuted }]}>
            {t("auth.signUp.termsPrefix")}
            <Text style={{ color: Brand.primary }}>
              {t("auth.signUp.termsOfService")}
            </Text>
            {t("auth.signUp.termsAnd")}
            <Text style={{ color: Brand.primary }}>
              {t("auth.signUp.privacyPolicy")}
            </Text>
          </Text>
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
    paddingVertical: Spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  languageRow: {
    flexDirection: "row",
    gap: Spacing.sm,
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
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
  },
  form: {
    flex: 1,
  },
  requirements: {
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  requirementsTitle: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.xs,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  requirementText: {
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs,
  },
  signUpButton: {
    marginBottom: Spacing.lg,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.md,
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
  terms: {
    fontSize: FontSize.xs,
    textAlign: "center",
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
