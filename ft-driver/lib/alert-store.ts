import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertVariant = "error" | "success" | "warning" | "info";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  /** Renders the button with a muted/cancel style. */
  style?: "default" | "cancel";
}

export interface AlertState {
  visible: boolean;
  variant: AlertVariant;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertStore extends AlertState {
  show: (opts: {
    variant?: AlertVariant;
    title: string;
    message?: string;
    buttons?: AlertButton[];
  }) => void;
  hide: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL: AlertState = {
  visible: false,
  variant: "info",
  title: "",
  message: undefined,
  buttons: [],
};

export const useAlertStore = create<AlertStore>()((set) => ({
  ...INITIAL,

  show: ({ variant = "error", title, message, buttons }) =>
    set({
      visible: true,
      variant,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "OK" }],
    }),

  hide: () => set(INITIAL),
}));

// ---------------------------------------------------------------------------
// Convenience helper — call from anywhere (no hook needed)
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for `Alert.alert()`.
 *
 * ```ts
 * showAlert({ title: "Oops", message: "Something went wrong" });
 * showAlert({ variant: "success", title: "Done!", message: "Ride created" });
 * ```
 */
export function showAlert(opts: {
  variant?: AlertVariant;
  title: string;
  message?: string;
  buttons?: AlertButton[];
}): void {
  useAlertStore.getState().show(opts);
}
