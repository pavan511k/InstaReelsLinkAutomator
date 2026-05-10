import { X, Check } from 'lucide-react';

const BEFORE = [
  'Manually responding to every comment and DM',
  'Missing potential leads while you sleep',
  'No way to track engagement or conversions',
  'Hours spent on repetitive messaging tasks',
  'Inconsistent response times and messaging',
];

const AFTER = [
  'Automated responses to comments and DMs 24/7',
  'Capture leads while you sleep with instant replies',
  'Detailed analytics on engagement and conversions',
  'Save 20+ hours per week with automation',
  'Consistent, on-brand messaging at all times',
];

export default function BeforeAfter() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Your inbox: <span className="text-[#E63946]">a before & after</span>
          </h2>
          <p className="mt-4 text-lg text-neutral-600">More messages, less mess.</p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Before */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-7">
            <h3 className="text-base font-semibold text-neutral-900">Before AutoDM</h3>
            <ul className="mt-5 space-y-3">
              {BEFORE.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
                    <X className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-neutral-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-2xl border border-[#E63946]/20 bg-[#FFF1F2] p-7">
            <h3 className="text-base font-semibold text-neutral-900">After AutoDM</h3>
            <ul className="mt-5 space-y-3">
              {AFTER.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#E63946] text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm text-neutral-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
