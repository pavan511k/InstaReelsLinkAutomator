import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import StatsBar from '@/components/landing/StatsBar';
import FeatureCard from '@/components/landing/FeatureCard';
import Footer from '@/components/landing/Footer';
import { MessageCircle, Film, Reply, AtSign } from 'lucide-react';

const FEATURES = [
  {
    title: 'Auto-Reply to Instagram Reel Comments',
    description: 'Reply to Instagram reel comments automatically with a DM sent straight to the users inbox. Add trigger keywords or respond to all comments.',
    icon: <Film size={64} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Instagram Post Comments',
    description: 'Reply to Instagram post comments automatically with a DM sent straight to the users inbox. Add trigger keywords or respond to all comments.',
    icon: <MessageCircle size={64} strokeWidth={1.5} />,
    reverse: true,
  },
  {
    title: 'Auto-Respond to Instagram Story Replies',
    description: 'Automatically respond to story replies with a DM sent directly to the users inbox. Add trigger keywords or respond to all comments.',
    icon: <Reply size={64} strokeWidth={1.5} />,
    reverse: false,
  },
  {
    title: 'Auto-Reply to Instagram Story Mentions',
    description: 'Automatically respond to story @mentions with a message sent directly to the users inbox.',
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
        <section id="features" className="container">
          <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
            <span style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>Feature Focus</span>
            <h2 style={{
              fontSize: 'var(--font-size-4xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              color: 'var(--color-gray-900)',
              marginTop: 'var(--space-3)',
              marginBottom: 'var(--space-2)',
            }}>Feature Breakdown</h2>
            <p style={{
              color: 'var(--color-gray-500)',
              maxWidth: '600px',
              margin: '0 auto',
            }}>
              Dive into the specifics of each feature, understanding its functionality and how it can elevate your Instagram strategy.
            </p>
          </div>
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
