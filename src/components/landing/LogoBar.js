export default function LogoBar() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Trusted by 7,000+ creators worldwide
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-white">M</span>
            Meta Tech Provider
          </div>
          <div className="text-sm font-medium text-neutral-600">99.9% delivery rate</div>
          <div className="text-sm font-medium text-neutral-600">3.2M+ DMs sent / month</div>
          <div className="text-sm font-medium text-neutral-600">GDPR-ready · Privacy-first</div>
        </div>
      </div>
    </section>
  );
}
