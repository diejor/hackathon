import Link from 'next/link';

const STEPS = [
  { title: 'Play 3 quick games', body: 'Spot red flags, unmask an impostor, and build a scam yourself. About five minutes.' },
  { title: 'See the scam that would get you', body: 'Your results become an 8-trait profile, and we pick the scam it is weakest against.' },
  { title: 'Practise on your phone, with your coach', body: 'Get that scam as a safe drill text on your own verified phone, then talk it through with an AI coach that knows your weak spots.' },
];

export default function Home() {
  return (
    <main className="page">
      <section className="pt-4">
        <p className="eyebrow">Scam training that knows you</p>
        <h1 className="mt-3 text-[34px] font-bold leading-[1.1] tracking-tight text-slate-900">
          Find the scam that would get you.
          <span className="block text-indigo-600">Then beat it.</span>
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-slate-600">
          Practise against it safely on your own phone, and keep an AI coach that knows your weak spots.
        </p>
        <div className="mt-6 space-y-3">
          <Link href="/games" className="btn btn-primary">Start training</Link>
          <Link href="/coach" className="btn btn-secondary">Ask the coach</Link>
        </div>
      </section>

      <section className="card" aria-labelledby="how">
        <h2 id="how" className="text-lg font-semibold text-slate-900">How it works</h2>
        <ol className="mt-4 space-y-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-indigo-50 text-base font-bold text-indigo-600" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
        <h2 className="text-sm font-semibold text-emerald-700">Works alongside T-Mobile Scam Shield</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-emerald-900">
          Scam Shield quietly blocks known scam calls and texts at the network. SafeSense trains you for the ones that still get through.
        </p>
      </section>

      <p className="px-1 text-sm leading-relaxed text-slate-500">
        Every scenario uses invented brands. Drills are only ever sent to a phone you verify as your own, and replying STOP ends them.
      </p>
    </main>
  );
}
