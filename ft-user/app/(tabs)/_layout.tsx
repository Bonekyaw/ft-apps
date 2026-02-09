import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import {
  NativeTabs,
  Icon,
  Label,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";

import { AndroidGlassTabs } from "@/components/GlassTabBar";
import { Brand, Colors } from "@/constants/theme";

export default function TabLayout() {
  if (Platform.OS === "android") {
    return (
      <ThemeProvider value={DefaultTheme}>
        <AndroidGlassTabs />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <NativeTabs
        tintColor={Brand.primary}
        backgroundColor="#ffffff"
        blurEffect="systemChromeMaterial"
        iconColor={{
          default: Colors.light.tabIconDefault,
          selected: Brand.primary,
        }}
        labelStyle={{
          default: { color: Colors.light.text },
          selected: { color: Brand.primary },
        }}
        labelVisibilityMode="labeled"
        disableIndicator
      >
        <NativeTabs.Trigger name="(home)">
          <Icon
            sf={{ default: "house", selected: "house.fill" }}
            androidSrc={
              <VectorIcon family={MaterialIcons} name="home" />
            }
          />
          <Label>Home</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore">
          <Icon
            sf={{ default: "clock", selected: "clock.fill" }}
            androidSrc={
              <VectorIcon family={MaterialIcons} name="schedule" />
            }
          />
          <Label>Activity</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Icon
            sf={{ default: "person", selected: "person.fill" }}
            androidSrc={
              <VectorIcon family={MaterialIcons} name="person" />
            }
          />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
