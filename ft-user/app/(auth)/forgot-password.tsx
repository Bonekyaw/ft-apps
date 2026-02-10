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
  createForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/validations";
import { emailOtp } from "@/lib/auth-client";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t, locale, setLocale } = useTranslation();
  const [loading, setLoading] = useState(false);

  const schema = useMemo(() => createForgotPasswordSchema(t), [t]);
  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    try {
      const result = await emailOtp.requestPasswordReset({
        email: data.email.trim(),
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.error"),
          result.error.message || t("auth.errors.unexpectedError"),
        );
        return;
      }

      router.replace({
        pathname: "/(auth)/reset-password",
        params: { email: data.email.trim() },
      });
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

          <View style={styles.header}>
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: `${Brand.primary}15` },
              ]}
            >
              <Ionicons name="key-outline" size={36} color={Brand.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("auth.forgotPassword.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("auth.forgotPassword.subtitle")}
            </Text>
          </View>

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
              title={t("auth.forgotPassword.submit")}
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              size="lg"
              style={styles.submitButton}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.backText, { color: Brand.primary }]}>
                {t("auth.forgotPassword.backToSignIn")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
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
  languageBtnText: { fontSize: FontSize.sm },
  languageBtnTextActive: { fontWeight: "600" },
  header: { alignItems: "center", marginBottom: Spacing.md },
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
  subtitle: { fontSize: FontSize.sm, textAlign: "center" },
  form: { flex: 1 },
  inputCompact: { marginBottom: Spacing.sm },
  submitButton: { marginTop: Spacing.sm },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  backText: { fontSize: FontSize.sm, fontWeight: "600" },
});
