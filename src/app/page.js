import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import LogoBar from '@/components/landing/LogoBar';
import Stats from '@/components/landing/Stats';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import Testimonials from '@/components/landing/Testimonials';
import CtaBanner from '@/components/landing/CtaBanner';
import Footer from '@/components/landing/Footer';

export default function HomePage() {
  return (
    <div style={{ background: '#0A0915', minHeight: '100vh' }}>
      <Navbar />
      <main>
        <Hero />
        <LogoBar />
        <Stats />
        <HowItWorks />
        <Features />
        <Testimonials />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
