import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { LanguageProvider } from '@/components/language-provider';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UzBook — Smart Booking Platform для бизнеса в Узбекистане',
  description:
    'Онлайн-запись, CRM, расписание сотрудников и аналитика в одной платформе. UzBook помогает салонам, клиникам, барбершопам и автосервисам автоматизировать бронирование.',
  keywords: [
    'онлайн запись',
    'бронирование',
    'CRM',
    'управление бизнесом',
    'UzBook',
    'Узбекистан',
    'салон красоты',
    'клиника',
    'барбершоп',
  ],
  openGraph: {
    title: 'UzBook — Smart Booking Platform',
    description: 'Управляйте записями, персоналом и клиентами в одном месте.',
    type: 'website',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UzBook — Smart Booking Platform',
    description: 'Управляйте записями, персоналом и клиентами в одном месте.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
