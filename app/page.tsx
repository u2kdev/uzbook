import { LanguageProvider } from '@/components/language-provider';
import { Navbar } from '@/components/sections/navbar';
import { Hero } from '@/components/sections/hero';
import { Features } from '@/components/sections/features';
import { BookingPreview } from '@/components/sections/booking-preview';
import { DashboardPreview } from '@/components/sections/dashboard-preview';
import { Categories } from '@/components/sections/categories';
import { Stats } from '@/components/sections/stats';
import { Pricing } from '@/components/sections/pricing';
import { Testimonials } from '@/components/sections/testimonials';
import { FAQ } from '@/components/sections/faq';
import { CTA } from '@/components/sections/cta';
import { Footer } from '@/components/sections/footer';

export default function Home() {
  return (
    <LanguageProvider>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <BookingPreview />
        <DashboardPreview />
        <Categories />
        <Stats />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </LanguageProvider>
  );
}
