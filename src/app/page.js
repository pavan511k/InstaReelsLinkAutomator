import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import LogoBar from '@/components/landing/LogoBar';
import Stats from '@/components/landing/Stats';
import HowItWorks from '@/components/landing/HowItWorks';
import DemoFlow from '@/components/landing/DemoFlow';
import Features from '@/components/landing/Features';
import Testimonials from '@/components/landing/Testimonials';
import CtaBanner from '@/components/landing/CtaBanner';
import Footer from '@/components/landing/Footer';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.root}>
      <Navbar />
      <main>
        <Hero />
        <LogoBar />
        <Stats />
        <HowItWorks />
        <DemoFlow />
        <Features />
        <Testimonials />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
