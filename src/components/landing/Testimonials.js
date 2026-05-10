// Avatars: deterministic SVGs from DiceBear (free, MIT-licensed). No real-person
// photos so no licensing risk; each seed produces a unique illustrated portrait.
const avatar = (seed) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=fef1f1,ffe4e6,fafaf9`;

const TESTIMONIALS = [
  {
    name: 'BB Edits',
    handle: '@bb_edits01',
    quote: 'I used to spend 3+ hours daily replying to DMs. Now AutoDM handles it all automatically. Game changer.',
  },
  {
    name: 'Designer Rajesh',
    handle: '@designer_raj',
    quote: 'My Instagram revenue increased after setting up automated flows. Every comment gets an instant reply with my resources link.',
  },
  {
    name: 'Sandhya Techy',
    handle: '@sandhya_techy',
    quote: 'AutoDM helped me increase sales by 72% in just 3 weeks! Auto-replies capture every lead while I sleep.',
  },
  {
    name: 'Faizah',
    handle: '@faizahcontent',
    quote: 'Automatically when people comment, my engagement went through the roof.',
  },
  {
    name: 'Tejash',
    handle: '@tejashreels',
    quote: 'Best investment for my handle. Auto-replies + link sharing — more conversions with zero manual work.',
  },
  {
    name: 'Madhura UX Designer',
    handle: '@madhuraux',
    quote: 'Finally! A tool that sends links automatically when people comment. My engagement went through the roof.',
  },
  {
    name: 'Venkey tech',
    handle: '@vk_techbites',
    quote: 'I went from manually DMing 50+ people daily to fully automated conversations. More time for creating content.',
  },
  {
    name: 'Diptimal Sahoo',
    handle: '@diptimal',
    quote: 'Every Instagram post now drives traffic to my funnel automatically. AutoDM handles all the heavy lifting.',
  },
  {
    name: 'Ajay Kumar',
    handle: '@ajay_creates',
    quote: 'AutoDM’s automation captured 200+ qualified leads in my first week. The ROI is incredible!',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Join <span className="text-[#E63946]">thousands of</span> creators and businesses
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.handle}
              className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200/60 transition-shadow hover:shadow-md hover:ring-neutral-300"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar(t.name)}
                  alt={t.name}
                  className="h-10 w-10 rounded-full bg-neutral-100"
                  loading="lazy"
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{t.name}</p>
                  <p className="text-xs text-neutral-500">{t.handle}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-neutral-700">&ldquo;{t.quote}&rdquo;</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
