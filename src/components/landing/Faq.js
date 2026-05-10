'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'Will using AutoDM get my social account locked?',
    a: 'No. AutoDM uses Instagram’s official Messaging API as a Meta Business Partner. There’s no scraping, no password sharing, and no risk of bans.',
  },
  {
    q: 'What are the main uses of AutoDM?',
    a: 'Comment-trigger DMs, story-mention replies, follow-gated rewards, broadcasts, link click tracking, and lead capture — all on autopilot.',
  },
  {
    q: 'Do I need to know how to code to set up the automations?',
    a: 'No. The flow builder is fully visual. Pick a post, set your keywords, write your reply, and go live in under five minutes.',
  },
  {
    q: 'How quickly will DMs be sent after a comment?',
    a: 'Typically within 2–5 seconds. Delivery depends on Instagram’s API but is near-instant for the vast majority of replies.',
  },
  {
    q: 'Can I use this for multiple Instagram accounts?',
    a: 'Yes. Connect multiple Instagram and Facebook Page accounts and manage automations independently for each.',
  },
  {
    q: 'What happens if I reach my monthly DM limit?',
    a: 'Free plans pause at 3,000 DMs / month. Pro and Elite plans include unlimited DMs — upgrade anytime.',
  },
  {
    q: 'Is there a free trial available?',
    a: 'Yes. The Free plan is permanently free, and Pro includes a no-card 7-day trial of all features.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-neutral-50">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <div className="text-center">
          <p className="text-3xl">🤔</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Frequently asked questions
          </h2>
        </div>

        <div className="mt-12 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-neutral-50"
                >
                  <span className="text-sm font-semibold text-neutral-900">{item.q}</span>
                  <ChevronDown
                    className={[
                      'h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform duration-200',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm leading-relaxed text-neutral-600">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
