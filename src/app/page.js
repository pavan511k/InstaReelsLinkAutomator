import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import StatsBar from '@/components/landing/StatsBar';
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureCard from '@/components/landing/FeatureCard';
import ScrollReveal from '@/components/landing/ScrollReveal';
import Footer from '@/components/landing/Footer';
import { MessageCircle, Film, Reply, AtSign } from 'lucide-react';

const FEATURES = [
  {
    title: 'Auto-Reply to Reel Comments',
    description: 'Automatically send a DM when someone comments on your reel. Use trigger keywords or respond to every comment — your choice.',
    icon: <Film size={64} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Post Comments',
    description: 'Turn post engagement into conversations. Every comment can trigger an instant DM with your link, offer, or message.',
    icon: <MessageCircle size={64} strokeWidth={1.5} />,
    reverse: true,
  },
  {
    title: 'Auto-Respond to Story Replies',
    description: 'When followers reply to your story, automatically send them a message with your link, resource, or a thank-you note.',
    icon: <Reply size={64} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Story Mentions',
    description: 'When someone mentions you in their story, automatically reach out with a DM to build the relationship.',
    icon: <AtSign size={64} strokeWidth={1.5} />,
    reverse: true,
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />

        <StatsBar />

        <div id="how-it-works">
          <HowItWorks />
        </div>

        <section id="features" className="container">
          <ScrollReveal animation="fadeUp">
            <div style={{
              textAlign: 'center',
              paddingTop: '5rem',
              paddingBottom: '1rem',
            }}>
              <span style={{
                display: 'inline-block',
                color: 'var(--color-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 'var(--space-3)',
              }}>Features</span>
              <h2 style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--color-gray-900)',
                marginBottom: 'var(--space-3)',
                letterSpacing: '-0.02em',
              }}>Every Comment, An Opportunity</h2>
              <p style={{
                color: 'var(--color-gray-500)',
                maxWidth: '540px',
                margin: '0 auto',
                lineHeight: '1.7',
              }}>
                AutoDM turns your Instagram engagement into direct conversations — automatically.
              </p>
            </div>
          </ScrollReveal>

          {FEATURES.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              animation={feature.reverse ? 'fadeLeft' : 'fadeRight'}
              delay={index * 50}
            >
              <FeatureCard {...feature} />
            </ScrollReveal>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
