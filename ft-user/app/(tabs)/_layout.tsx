import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

import { Brand } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <NativeTabs tintColor={Brand.primary}>
        <NativeTabs.Trigger name="(home)">
          <Icon sf={{ default: "house", selected: "house.fill" }} />
          <Label>Home</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="explore">
          <Icon sf={{ default: "clock", selected: "clock.fill" }} />
          <Label>Activity</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
