'use client';

import { useScrollReveal } from '@/hooks/useScrollReveal';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureCard from '@/components/landing/FeatureCard';
import Footer from '@/components/landing/Footer';
import { MessageCircle, Film, Reply, AtSign } from 'lucide-react';

const FEATURES = [
  {
    title: 'Auto-Reply to Reel Comments',
    description: 'When someone comments on your reel, AutoDM sends them a DM instantly. Use keyword triggers or reply to all comments automatically.',
    icon: <Film size={48} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Post Comments',
    description: 'Set up automated DMs for your static posts. Choose trigger keywords like "LINK" or "INFO" and let AutoDM handle the rest.',
    icon: <MessageCircle size={48} strokeWidth={1.5} />,
    reverse: true,
  },
  {
    title: 'Auto-Respond to Story Replies',
    description: 'When followers reply to your stories, send them a DM automatically with your link, info, or any custom message.',
    icon: <Reply size={48} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Story Mentions',
    description: 'Get notified and send automatic DMs when someone mentions your account in their story. Great for brand partnerships and collaborations.',
    icon: <AtSign size={48} strokeWidth={1.5} />,
    reverse: true,
  },
];

export default function HomePage() {
  const [featuresRef, featuresVisible] = useScrollReveal({ threshold: 0.2 });

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <section id="features" style={{ background: 'var(--color-white)' }}>
          <div className="container">
            <div
              ref={featuresRef}
              style={{
                textAlign: 'center',
                paddingTop: 'var(--space-20)',
                paddingBottom: 'var(--space-4)',
                opacity: featuresVisible ? 1 : 0,
                transform: featuresVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
              }}
            >
              <span style={{
                display: 'inline-block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-ig-pink)',
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-1) var(--space-4)',
                background: 'var(--color-primary-light)',
                borderRadius: 'var(--radius-full)',
              }}>Features</span>
              <h2 style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--color-gray-900)',
                marginTop: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
                letterSpacing: '-0.02em',
              }}>Everything you need to automate DMs</h2>
              <p style={{
                color: 'var(--color-gray-500)',
                maxWidth: '550px',
                margin: '0 auto',
                lineHeight: '1.7',
              }}>
                AutoDM works across reels, posts, stories, and mentions — giving you full control over your Instagram DM automation.
              </p>
            </div>
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
