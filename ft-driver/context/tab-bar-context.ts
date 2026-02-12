import { createContext, useContext } from "react";

interface TabBarVisibility {
  setTabBarHidden: (hidden: boolean) => void;
}

export const TabBarContext = createContext<TabBarVisibility>({
  setTabBarHidden: () => {},
});

/** Hook screens can call to hide/show the Android glass tab bar. */
export function useTabBarVisibility() {
  return useContext(TabBarContext);
}
