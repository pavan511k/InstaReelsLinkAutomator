import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import LogoBar from '@/components/landing/LogoBar';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import BeforeAfter from '@/components/landing/BeforeAfter';
import Pricing from '@/components/landing/Pricing';
import Testimonials from '@/components/landing/Testimonials';
import CtaBanner from '@/components/landing/CtaBanner';
import Faq from '@/components/landing/Faq';
import Footer from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans antialiased">
      <Navbar />
      <main>
        <Hero />
        <LogoBar />
        <HowItWorks />
        <Features />
        <BeforeAfter />
        <Pricing />
        <Testimonials />
        <CtaBanner />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
