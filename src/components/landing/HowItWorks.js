'use client';

import { Instagram, Check, Plus, Send, Heart, MessageCircle, MoreHorizontal, ArrowRight } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import { useStyles } from '@/lib/useStyles';
import darkStyles from './HowItWorks.module.css';
import lightStyles from './HowItWorks.light.module.css';

const STEPS = [
  {
    num: '01',
    title: 'Connect your account',
    desc: 'Link your Instagram Business or Creator account in one click via the official Meta API. No passwords shared.',
    color: '#7C3AED',
    tag: 'Takes 30s',
    mockup: 'connect',
  },
  {
    num: '02',
    title: 'Pick your trigger',
    desc: 'Choose which posts, reels, or stories should fire a DM. Set keyword filters or reply to every comment.',
    color: '#3B82F6',
    tag: 'Full control',
    mockup: 'trigger',
  },
  {
    num: '03',
    title: 'Write your message',
    desc: "Craft your DM with links, offers, or personalised copy. Use dynamic fields and call-to-action buttons.",
    color: '#10B981',
    tag: 'Personalised',
    mockup: 'message',
  },
  {
    num: '04',
    title: 'Go live & scale',
    desc: 'Activate your automation. Every qualifying comment triggers an instant DM. Monitor in your dashboard.',
    color: '#F59E0B',
    tag: 'Automated',
    mockup: 'live',
  },
];

// ─── Phone-frame mockup wrapper ──────────────────────────────────────
// `styles` is forwarded from the parent so the mockups pick the right
// theme module (dark vs light). Module-scoped style imports were
// dropped when this component switched to useStyles().
function PhoneFrame({ children, color, styles }) {
    return (
        <div className={styles.phone} style={{ '--accent': color }}>
            <div className={styles.phoneNotch} />
            <div className={styles.phoneScreen}>
                {children}
            </div>
        </div>
    );
}

// ─── Per-step inline UI mockups (look like real screens) ─────────────
function StepMockup({ kind, color, styles }) {
    if (kind === 'connect') {
        return (
            <PhoneFrame color={color} styles={styles}>
                <div className={styles.connectScreen}>
                    <div className={styles.connectLogo} style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626 50%, #7C3AED)' }}>
                        <Instagram size={20} color="#fff" strokeWidth={2.2} />
                    </div>
                    <div className={styles.connectTitle}>Instagram</div>
                    <div className={styles.connectHandle}>@bloomstudio</div>
                    <div className={styles.connectStatus}>
                        <span className={styles.connectCheck} style={{ background: color }}>
                            <Check size={9} color="#fff" strokeWidth={3.5} />
                        </span>
                        Connected
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === 'trigger') {
        return (
            <PhoneFrame color={color} styles={styles}>
                <div className={styles.triggerScreen}>
                    <div className={styles.triggerLabel}>WHEN COMMENT CONTAINS</div>
                    <div className={styles.triggerField}>
                        <span className={styles.triggerKw} style={{ background: `${color}24`, borderColor: `${color}55`, color }}>
                            LINK <span className={styles.triggerX}>×</span>
                        </span>
                        <span className={styles.triggerKw} style={{ background: `${color}24`, borderColor: `${color}55`, color }}>
                            INFO <span className={styles.triggerX}>×</span>
                        </span>
                        <span className={styles.triggerAdd}>
                            <Plus size={9} /> add
                        </span>
                    </div>
                    <div className={styles.triggerHint}>
                        <span className={styles.triggerHintDot} style={{ background: color }} />
                        Reply to all comments
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === 'message') {
        return (
            <PhoneFrame color={color} styles={styles}>
                <div className={styles.messageScreen}>
                    <div className={styles.messageHeader}>
                        <div className={styles.messageAvatar} style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>YB</div>
                        <div className={styles.messageInfo}>
                            <span className={styles.messageName}>@bloomstudio</span>
                            <span className={styles.messageStatus} style={{ color }}>Active now</span>
                        </div>
                    </div>
                    <div className={styles.messageBubble}>
                        Hey! Here&apos;s your link 🔗
                    </div>
                    <div className={styles.messageBtn} style={{ background: `${color}1A`, borderColor: `${color}55`, color }}>
                        Get the drop
                        <ArrowRight size={9} />
                    </div>
                    <div className={styles.messageDelivered}>Delivered</div>
                </div>
            </PhoneFrame>
        );
    }

    if (kind === 'live') {
        return (
            <PhoneFrame color={color} styles={styles}>
                <div className={styles.liveScreen}>
                    <div className={styles.liveHeader}>
                        <span className={styles.liveDot} style={{ background: color, boxShadow: `0 0 0 4px ${color}30` }} />
                        <span className={styles.liveLabel}>Live · today</span>
                    </div>
                    <div className={styles.liveValue}>1,247</div>
                    <div className={styles.liveSubLabel}>DMs sent</div>
                    <div className={styles.liveBars}>
                        {[35, 60, 48, 80, 62, 95, 78].map((h, i) => (
                            <span
                                key={i}
                                className={styles.liveBar}
                                style={{ height: `${h}%`, background: i === 5 ? color : `${color}66` }}
                            />
                        ))}
                    </div>
                    <div className={styles.liveDelta} style={{ color }}>
                        ↑ 23% vs yesterday
                    </div>
                </div>
            </PhoneFrame>
        );
    }

    return null;
}

export default function HowItWorks() {
  const styles = useStyles(darkStyles, lightStyles);
  return (
    <section className={styles.section} id="how-it-works">
      <div className={styles.inner}>

        <ScrollReveal animation="fadeUp">
          <div className={styles.header}>
            <span className={styles.eyebrow}>How it works</span>
            <h2 className={styles.title}>Up and running in minutes</h2>
            <p className={styles.subtitle}>
              Four steps is all it takes to turn Instagram comments into automated, personalised DM conversations.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.num} animation="fadeUp" delay={i * 90}>
              <div className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.num} style={{ color: step.color }}>
                    {step.num}
                  </span>
                  <span
                    className={styles.tag}
                    style={{
                      color: step.color,
                      background: `${step.color}15`,
                      borderColor: `${step.color}30`,
                    }}
                  >
                    {step.tag}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardDesc}>{step.desc}</p>

                <StepMockup kind={step.mockup} color={step.color} styles={styles} />

                {i < STEPS.length - 1 && (
                  <div
                    className={styles.connector}
                    style={{
                      background: `linear-gradient(90deg, ${step.color}40, ${STEPS[i + 1].color}40)`,
                    }}
                  />
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}
