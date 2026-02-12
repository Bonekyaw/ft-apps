import { useMemo, useState } from "react";
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
import { emailOtp } from "@/lib/auth-client";
import { validateDriverLogin, getErrorMessage } from "@/lib/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SignInScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale, setLocale } = useTranslation();
  const [loading, setLoading] = useState(false);

  const signInSchema = useMemo(() => createSignInSchema(t), [t]);
  const { control, handleSubmit } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "" },
  });

  const onSendCode = async (data: SignInFormValues) => {
    setLoading(true);
    const trimmedEmail = data.email.trim().toLowerCase();

    try {
      // 1) Validate the email is an approved driver BEFORE sending OTP
      await validateDriverLogin(trimmedEmail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      Alert.alert(t("auth.errors.signInFailed"), message);
      setLoading(false);
      return;
    }

    try {
      // 2) Email is valid – send the OTP
      const result = await emailOtp.sendVerificationOtp({
        email: trimmedEmail,
        type: "sign-in",
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.signInFailed"),
          result.error.message || t("auth.errors.signInFailedMessage"),
        );
      } else {
        // Navigate to OTP verification with the email
        router.push({
          pathname: "/(auth)/verify-otp",
          params: { email: trimmedEmail },
        });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setLoading(false);
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

            <Button
              title={t("auth.signIn.sendCode")}
              onPress={handleSubmit(onSendCode)}
              loading={loading}
              size="lg"
              style={styles.sendCodeButton}
            />
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
    marginBottom: Spacing.xl,
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
    paddingHorizontal: Spacing.lg,
  },
  form: {
    flex: 1,
  },
  inputCompact: {
    marginBottom: Spacing.md,
  },
  sendCodeButton: {
    marginBottom: Spacing.sm,
  },
});
