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
import { authClient, emailOtp } from "@/lib/auth-client";
import {
  Brand,
  Colors,
  FontSize,
  Spacing,
  BorderRadius,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

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
      newErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password =
        "Password must contain uppercase, lowercase, and number";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
          "Sign Up Failed",
          result.error.message || "Please check your information and try again."
        );
        return;
      }

      // Send verification OTP to the user's email
      const otpResult = await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      if (otpResult.error) {
        Alert.alert(
          "Account Created",
          "Your account was created but we couldn't send the verification email. Please try again from the sign-in page.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ]
        );
        return;
      }

      // Navigate to OTP verification screen using replace to avoid back navigation issues
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: { email },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      // callbackURL is a path that gets converted to deep link (e.g., familytaxiuser://)
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to sign up with Google");
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
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign up to get started with Family Taxi
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              leftIcon="person-outline"
              error={errors.name}
            />

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
              error={errors.email}
            />

            <Input
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              leftIcon="lock-closed-outline"
              error={errors.password}
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
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
                Password must contain:
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
                  At least 8 characters
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
                  Uppercase, lowercase and special characters
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
                  At least one number
                </Text>
              </View>
            </View>

            <Button
              title="Create Account"
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
                or continue with
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            {/* Social Login */}
            <Button
              title="Continue with Google"
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
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
              <Text style={[styles.linkText, { color: Brand.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={[styles.terms, { color: colors.textMuted }]}>
            By creating an account, you agree to our{" "}
            <Text style={{ color: Brand.primary }}>Terms of Service</Text> and{" "}
            <Text style={{ color: Brand.primary }}>Privacy Policy</Text>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
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
