const STEPS = [
  {
    n: 1,
    title: 'Choose Keywords',
    body: 'Pick comments or keywords that should instantly trigger a message.',
    chip: 'Trigger',
  },
  {
    n: 2,
    title: 'Create your reply',
    body: 'Add messages, links, or offers you want to send automatically.',
    chip: 'share-link.com',
  },
  {
    n: 3,
    title: 'Let it run on autopilot',
    body: 'Every comment gets a reply while you focus on content.',
    chip: 'Live',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Set up <span className="text-[#E63946]">automation</span> in minutes
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Automatically reply to comments and DMs on Instagram while you focus on content, not chats.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-3xl bg-[#EEF4ED] px-8 pt-12 pb-10"
            >
              {/* Floating black pill — sits half-out of the card's top-left
                  corner like a sticker, mirroring ChatAutoDM's "Trigger"
                  / "share-link.com" treatment. */}
              <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white shadow-sm">
                {s.chip}
              </span>

              {/* Big display number — the eye-anchor */}
              <p className="text-6xl font-bold leading-none tracking-tight text-neutral-900">
                {s.n}
              </p>

              <h3 className="mt-8 text-xl font-bold text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
