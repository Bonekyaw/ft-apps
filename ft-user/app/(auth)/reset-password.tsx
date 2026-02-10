import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";

import { Button, Input } from "@/components/ui";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
} from "@/constants/theme";
import { useTranslation } from "@/lib/i18n";
import {
  createResetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/lib/validations";
import { emailOtp } from "@/lib/auth-client";
import { useColorScheme } from "@/hooks/use-color-scheme";

const OTP_LENGTH = 6;

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email?.trim() ?? "";

  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const schema = useMemo(() => createResetPasswordSchema(t), [t]);
  const { control, handleSubmit } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...otp];
    if (value.length > 1) {
      const pastedOtp = value.slice(0, OTP_LENGTH).split("");
      pastedOtp.forEach((digit, i) => {
        if (i < OTP_LENGTH) newOtp[i] = digit;
      });
      setOtp(newOtp);
      const lastIndex = Math.min(pastedOtp.length - 1, OTP_LENGTH - 1);
      inputRefs.current[lastIndex]?.focus();
      return;
    }
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!email) {
      Alert.alert(t("auth.errors.error"), t("auth.resetPassword.noEmail"));
      return;
    }

    const otpString = otp.join("");
    if (otpString.length !== OTP_LENGTH) {
      Alert.alert(
        t("auth.errors.invalidOtp"),
        t("auth.errors.invalidOtpMessage"),
      );
      return;
    }

    setLoading(true);
    try {
      const result = await emailOtp.resetPassword({
        email,
        otp: otpString,
        password: data.newPassword,
      });

      if (result.error) {
        Alert.alert(
          t("auth.errors.error"),
          result.error.message || t("auth.errors.unexpectedError"),
        );
        return;
      }

      Alert.alert(
        t("auth.resetPassword.success"),
        t("auth.resetPassword.successMessage"),
        [
          {
            text: t("auth.ok"),
            onPress: () => router.replace("/(auth)/sign-in"),
          },
        ],
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !email) return;
    setResendLoading(true);
    try {
      const result = await emailOtp.requestPasswordReset({ email });
      if (result.error) {
        Alert.alert(
          t("auth.errors.failedToResend"),
          result.error.message || t("auth.errors.failedToResendMessage"),
        );
      } else {
        Alert.alert(
          t("auth.errors.otpSent"),
          t("auth.errors.otpSentMessage"),
        );
        setCountdown(60);
        setCanResend(false);
        setOtp(new Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t("auth.errors.unexpectedError");
      Alert.alert(t("auth.errors.error"), message);
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t("auth.resetPassword.noEmail")}
          </Text>
          <Button
            title={t("auth.forgotPassword.backToSignIn")}
            onPress={() => router.replace("/(auth)/sign-in")}
            size="lg"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { marginTop: Spacing.md }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <View
              style={[
                styles.logoContainer,
                { backgroundColor: `${Brand.primary}15` },
              ]}
            >
              <Ionicons name="lock-open-outline" size={36} color={Brand.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("auth.resetPassword.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t("auth.resetPassword.subtitle")}
            </Text>
            <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
          </View>

          <View style={styles.otpSection}>
            <Text style={[styles.otpLabel, { color: colors.text }]}>
              {t("auth.resetPassword.enterCode")}
            </Text>
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    {
                      backgroundColor: colors.inputBackground ?? colors.background,
                      borderColor: digit ? Brand.primary : colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  selectTextOnFocus
                />
              ))}
            </View>
            <View style={styles.resendRow}>
              <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                {t("auth.verifyOtp.resendPrompt")}{" "}
              </Text>
              {canResend ? (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendLoading}
                >
                  <Text style={[styles.resendLink, { color: Brand.primary }]}>
                    {resendLoading
                      ? t("auth.verifyOtp.sending")
                      : t("auth.verifyOtp.resend")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.countdown, { color: colors.textMuted }]}>
                  {t("auth.verifyOtp.resendIn", { count: countdown })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="newPassword"
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  label={t("auth.resetPassword.newPassword")}
                  placeholder={t("auth.signUp.passwordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  leftIcon="lock-closed-outline"
                  error={error?.message}
                  containerStyle={styles.inputCompact}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <Input
                  label={t("auth.resetPassword.confirmPassword")}
                  placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  leftIcon="lock-closed-outline"
                  error={error?.message}
                  containerStyle={styles.inputCompact}
                />
              )}
            />

            <View style={styles.requirements}>
              <Text style={[styles.requirementsTitle, { color: colors.textMuted }]}>
                {t("auth.signUp.passwordRequirements")}
              </Text>
              <Text style={[styles.requirement, { color: colors.textMuted }]}>
                • {t("auth.signUp.characters8")}
              </Text>
              <Text style={[styles.requirement, { color: colors.textMuted }]}>
                • {t("auth.signUp.uppercaseLowercaseSpecial")}
              </Text>
              <Text style={[styles.requirement, { color: colors.textMuted }]}>
                • {t("auth.signUp.number")}
              </Text>
            </View>

            <Button
              title={t("auth.resetPassword.submit")}
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              size="lg"
              style={styles.submitButton}
            />
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
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: Spacing.lg },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  email: { fontSize: FontSize.md, fontWeight: "600", marginBottom: Spacing.md },
  otpSection: { marginBottom: Spacing.lg },
  otpLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    textAlign: "center",
    fontSize: FontSize.xl,
    fontWeight: "600",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  resendText: { fontSize: FontSize.sm },
  resendLink: { fontSize: FontSize.sm, fontWeight: "600" },
  countdown: { fontSize: FontSize.sm },
  form: { flex: 1 },
  inputCompact: { marginBottom: Spacing.sm },
  requirements: { marginBottom: Spacing.md },
  requirementsTitle: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  requirement: { fontSize: FontSize.sm },
  submitButton: { marginTop: Spacing.sm },
});
