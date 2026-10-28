"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import Script from "next/script";

export interface TelegramWebUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebUser;
    start_param?: string;
    auth_date?: number;
    query_id?: string;
  };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  openInvoice: (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramWebAppContextValue {
  isAvailable: boolean;
  user: TelegramWebUser | null;
  initData: string;
  startParam: string | null;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  webApp: TelegramWebApp | null;
  haptic: {
    impact: (style?: "light" | "medium" | "heavy") => void;
    success: () => void;
    error: () => void;
    warning: () => void;
    selection: () => void;
  };
  openInvoice: (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
  close: () => void;
}

const TelegramWebAppContext = createContext<TelegramWebAppContextValue>({
  isAvailable: false,
  user: null,
  initData: "",
  startParam: null,
  colorScheme: "light",
  themeParams: {},
  webApp: null,
  haptic: {
    impact: () => {},
    success: () => {},
    error: () => {},
    warning: () => {},
    selection: () => {},
  },
  openInvoice: () => {},
  close: () => {},
});

export function TelegramWebAppProvider({ children }: { children: React.ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TelegramWebUser | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>({});

  const initTelegram = useCallback(() => {
    if (typeof window === "undefined") return;
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    // Check if real WebApp environment with initData or platform
    const hasInitData = Boolean(tg.initData && tg.initData.length > 0);
    const hasUser = Boolean(tg.initDataUnsafe?.user);

    if (hasInitData || hasUser) {
      setIsAvailable(true);
      setWebApp(tg);
      setInitData(tg.initData || "");
      setUser(tg.initDataUnsafe?.user || null);
      setStartParam(tg.initDataUnsafe?.start_param || null);
      setColorScheme(tg.colorScheme || "light");
      setThemeParams(tg.themeParams || {});

      try {
        tg.ready();
        tg.expand();
      } catch (err) {
        console.warn("Telegram WebApp expand failed", err);
      }

      // Apply CSS class and safe-area adjustments
      document.documentElement.classList.add("tma-app");
    }
  }, []);

  useEffect(() => {
    initTelegram();
  }, [initTelegram]);

  const haptic = useMemo(
    () => ({
      impact: (style: "light" | "medium" | "heavy" = "light") => {
        try {
          webApp?.HapticFeedback?.impactOccurred(style);
        } catch {}
      },
      success: () => {
        try {
          webApp?.HapticFeedback?.notificationOccurred("success");
        } catch {}
      },
      error: () => {
        try {
          webApp?.HapticFeedback?.notificationOccurred("error");
        } catch {}
      },
      warning: () => {
        try {
          webApp?.HapticFeedback?.notificationOccurred("warning");
        } catch {}
      },
      selection: () => {
        try {
          webApp?.HapticFeedback?.selectionChanged();
        } catch {}
      },
    }),
    [webApp],
  );

  const openInvoice = useCallback(
    (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => {
      if (webApp?.openInvoice) {
        webApp.openInvoice(url, callback);
      } else {
        window.open(url, "_blank");
      }
    },
    [webApp],
  );

  const close = useCallback(() => {
    try {
      webApp?.close();
    } catch {}
  }, [webApp]);

  return (
    <TelegramWebAppContext.Provider
      value={{
        isAvailable,
        user,
        initData,
        startParam,
        colorScheme,
        themeParams,
        webApp,
        haptic,
        openInvoice,
        close,
      }}
    >
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={initTelegram}
      />
      {children}
    </TelegramWebAppContext.Provider>
  );
}

export function useTelegramWebApp() {
  return useContext(TelegramWebAppContext);
}
