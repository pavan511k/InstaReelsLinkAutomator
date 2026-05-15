import Link from 'next/link';
import { Check, Clock } from 'lucide-react';

const PLANS = [
  {
    name: 'Free plan',
    tagline: 'For individuals & new creators',
    price: '₹0',
    cadence: '/forever',
    cta: 'Get Started',
    href: '/signup',
    highlight: false,
    features: [
      '1 Workspace',
      '5 Automation Flows',
      'Comment-trigger automations',
      'Story-reply automations',
      'Basic Analytics',
      'Email support',
    ],
  },
  {
    name: 'Pro plan',
    tagline: 'Best for creators',
    price: '₹299',
    cadence: '/month',
    cta: 'Get Started',
    href: '/signup',
    highlight: true,
    features: [
      '5 Workspaces — manage multiple accounts',
      'Unlimited Automation Flows',
      'Email Collector — capture leads via DM',
      'Story Mention Auto-DM',
      'Ask to Follow before DM',
      'Multi-step Flow Automation',
      'Priority support',
    ],
  },
  {
    name: 'Elite plan',
    tagline: 'For agencies & businesses',
    price: '₹799',
    cadence: '/month',
    cta: 'Coming Soon',
    href: null,
    highlight: false,
    comingSoon: true,
    features: [
      'Everything in Pro',
      '10 Workspaces — for agencies & teams',
      'Dedicated Account Manager',
      'Custom Branding',
      'Advanced Lead Capture',
      'Story-mention auto replies',
      'White-glove onboarding',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Flexible <span className="text-[#E63946]">pricing</span> plans
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Choose a plan that grows with you. Start for free and upgrade anytime for more features and support.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isPro       = plan.highlight;
            const comingSoon  = plan.comingSoon;
            return (
              <div
                key={plan.name}
                className={[
                  'relative rounded-2xl border bg-white p-6 transition-shadow sm:p-8',
                  isPro
                    ? 'border-[#E63946] shadow-lg'
                    : 'border-neutral-200 hover:shadow-md',
                ].join(' ')}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E63946] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                {comingSoon && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    <Clock className="h-2.5 w-2.5" strokeWidth={3} />
                    Coming Soon
                  </span>
                )}

                <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-neutral-600">{plan.tagline}</p>

                <div className="mt-5 flex items-baseline gap-2">
                  {plan.strikePrice && (
                    <span className="text-base text-neutral-400 line-through">{plan.strikePrice}</span>
                  )}
                  {plan.discount && (
                    <span className="rounded bg-[#FFF1F2] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E63946]">
                      {plan.discount}
                    </span>
                  )}
                </div>
                <div className={[
                  'mt-1 flex items-baseline gap-1 select-none',
                  comingSoon ? 'blur-sm' : '',
                ].join(' ')}>
                  <span className="text-4xl font-bold tracking-tight text-neutral-900">{plan.price}</span>
                  <span className="text-sm text-neutral-500">{plan.cadence}</span>
                </div>

                {comingSoon ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-500 cursor-not-allowed"
                  >
                    <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Coming Soon
                  </button>
                ) : (
                  <Link
                    href={plan.href}
                    className={[
                      'mt-6 flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold transition-colors',
                      isPro
                        ? 'bg-[#E63946] text-white hover:bg-[#CC2E3B]'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800',
                    ].join(' ')}
                  >
                    {plan.cta}
                  </Link>
                )}

                <p className="mt-7 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Included features
                </p>
                <ul className={[
                  'mt-3 space-y-2.5',
                  comingSoon ? 'blur-sm select-none pointer-events-none' : '',
                ].join(' ')}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E63946]" strokeWidth={3} />
                      <span className="text-sm text-neutral-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
