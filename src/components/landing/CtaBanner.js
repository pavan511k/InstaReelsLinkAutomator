import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function CtaBanner() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-8 py-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
            Ready to transform your Instagram engagement?
          </p>
          <h3 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Start your free trial today
          </h3>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#E63946] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#CC2E3B] transition-colors"
          >
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-sm text-neutral-500">No credit card required</p>
        </div>
      </div>
    </section>
  );
}
