import type { Metadata } from "next";
import { Cormorant_Garamond, Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

import { TelegramWebAppProvider } from "@/components/telegram/telegram-webapp-provider";

export const metadata: Metadata = {
  title: {
    default: "uzbook — запись клиентов для малого бизнеса",
    template: "%s · uzbook",
  },
  description:
    "Онлайн-запись, страница вашего салона и таймлайн загрузки мастеров. Клиент записывается без звонков и логина, вы видите весь день.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${onest.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TelegramWebAppProvider>{children}</TelegramWebAppProvider>
      </body>
    </html>
  );
}
