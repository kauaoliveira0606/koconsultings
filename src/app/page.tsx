import Image from "next/image";
import {
  Zap,
  TrendingUp,
  Flame,
  Compass,
  Rocket,
  Target,
  ArrowRight,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  Phone,
  Check,
  X,
} from "lucide-react";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSct9oGZZgENUXiPi-9V1aybXITWz9WPTE7pRw7Y-wpwbaARvQ/viewform?usp=dialog";

const VALUES = [
  {
    icon: Zap,
    title: "Speed",
    description:
      "We move fast and act with urgency. Every day is a chance to serve people and change their lives.",
  },
  {
    icon: TrendingUp,
    title: "Growth",
    description:
      "Push yourself to grow every single day. Go above and beyond in every area of your life.",
  },
  {
    icon: Flame,
    title: "Obsession",
    description:
      "Be obsessed with becoming a better version of yourself daily. We love competition.",
  },
  {
    icon: Compass,
    title: "Live in Congruence",
    description:
      "You're only as good as your standards. Do not accept anything other than the best.",
  },
  {
    icon: Rocket,
    title: "Above & Beyond",
    description:
      "Energy of excellence. Pressure makes diamonds — put yourself in positions for exponential growth.",
  },
];

const ROLES = [
  {
    slug: "sdr-ecommerce",
    title: "Sales Development Representative",
    tag: "E-Commerce Offer",
    formUrl: GOOGLE_FORM_URL,
    location: "Remote",
    type: "Full-Time",
    comp: "Commission Only",
    blurb:
      "You'll be the first line of contact turning inbound and outbound interest into booked calls for a high-growth e-commerce brand. This is a role for someone obsessed with the numbers, relentless in follow-up, and hungry to grow into a closer.",
    responsibilities: [
      "Run structured outbound prospecting sequences",
      "Track and hit weekly connection & booking targets",
      "Follow our proven scripts while adding your own edge",
      "Report directly into the growth & sales leadership team",
    ],
    fullDescription: [
      "Dialer position - Full time",
      "OTE 2k-5.4k/m, people have earned 10k+/m with this model",
      "Abundant amount of leads coming through",
      "Lots of bonuses set up for performance",
      "We value and compensate hard work heavily. This is a full-time position. Some of our reps CHOOSE to work 8+ hours. Ask yourself before you apply: is this the type of culture and standard you can commit to at the moment?",
      "This isn't a typical offer that you'll see. You're going to be doing an affiliate play that huge names in the e-commerce space, like Nathan Nazareth and Ramin Popal, are doing. They're bringing in 50k to 100k a day using the exact same funnel.",
      "There is going to be a massive lead though. You can get a lot of repetition and make up to $100 per lead.",
      "KPI's are closing at least 5 leads a day on the affiliate which is $50 a month, we've seen people do around ten a day.",
      "You will get a lot better in your skill set just because of the amount of reps that you will have that you will not see in any other offer.",
      "You close people on $50/m you get paid $25, stack multiple of those a day, and they stack up. If you close people on up-sells, it can add an extra $75 per lead. Which is closing them on a $20/month software.",
      "The stuff is really easy. The marketing is they get access to a free course that we used to charge thousands of dollars for if they sign up for a platform software that they would have to sign up for already.",
      "You will be getting sales training from me who has collected millions in cash and made multiple 20-30k months.",
      "Culture is hunger, obsession, and going above and beyond. You're going to be in an environment that can make you a way better version of yourself.",
      "Expectations: seven days a week. Speed to lead. Being active and responsive very quickly.",
    ],
    contact: "@kauaoliveirallc",
  },
];

const JOB_DO = [
  "Dial a minimum of 200 leads per day",
  "Respond to leads within 5-10 minutes",
  "Close 5 people on our low-ticket funnel per day or book financially qualified leads for closers",
  "Attend 5 team meetings per week",
  "Attend training sessions daily",
  "Work 8 to 10 hours a day, 6 days a week",
  "Work in EST timezone",
];

const JOB_NOT_FOR_YOU = [
  "You just want to hit KPIs and be done for the day",
  "You're not willing to work Sundays",
  "You want to \"just hit dials and be done\"",
  "You're not willing to go all-in every day",
  "You're looking for a laid-back, low-effort gig",
  "You're not coachable and open to feedback",
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden bg-black text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-drift absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-red-600/20 blur-[120px]" />
        <div
          className="animate-drift absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-red-600/20 blur-[120px]"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="animate-drift absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-amber-500/10 blur-[120px]"
          style={{ animationDelay: "6s" }}
        />
      </div>

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="rounded-lg bg-white px-3 py-1.5">
            <Image
              src="/brand/logo-banner.jpg"
              alt="KO Consultings"
              width={4001}
              height={1251}
              priority
              className="h-6 w-auto sm:h-7"
            />
          </div>
          <a
            href="#roles"
            className="group flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold transition-all hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/30"
          >
            Apply Now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div
          className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-400"
          style={{ animationDelay: "0.05s" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          Now hiring — E-commerce SDR
        </div>

        <h1
          className="animate-fade-in-up bg-gradient-to-b from-white to-white/60 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-8xl"
          style={{ animationDelay: "0.15s" }}
        >
          We&apos;re Hiring.
        </h1>

        <p
          className="animate-fade-in-up mt-6 max-w-2xl text-lg text-white/60 sm:text-xl"
          style={{ animationDelay: "0.3s" }}
        >
          If you&apos;re obsessed with growth, allergic to average, and ready
          to earn what you&apos;re worth, we want to hear from you. A lot of
          room for growth with great leaders bringing you closer to your
          goals. Join the family.
        </p>

        <div
          className="animate-fade-in-up mt-10 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.45s" }}
        >
          <a
            href="#roles"
            className="group flex items-center gap-2 rounded-full bg-red-600 px-8 py-4 text-base font-bold shadow-lg shadow-red-600/30 transition-all hover:scale-105 hover:bg-red-500 hover:shadow-red-500/40"
          >
            Apply for the Role
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#roles"
            className="rounded-full border border-white/20 px-8 py-4 text-base font-semibold text-white/80 transition-all hover:border-white/40 hover:bg-white/5 hover:text-white"
          >
            View the Role
          </a>
        </div>
      </section>

      {/* Mission statement banner */}
      <section className="relative z-10 border-y border-white/10 bg-white/[0.03] py-14">
        <div className="mx-auto max-w-4xl overflow-hidden px-6 text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-red-500 uppercase">
            Our Mission
          </p>
          <p className="mt-4 text-2xl leading-snug font-bold sm:text-3xl">
            Become industry leaders.
          </p>
        </div>
      </section>

      {/* Core values */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-red-500 uppercase">
            What We Stand For
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Our Core Values
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {VALUES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:-translate-y-1 hover:border-red-500/40 hover:bg-white/[0.06]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-500 transition-colors group-hover:bg-red-600 group-hover:text-white">
                <Icon className="h-5.5 w-5.5" />
              </div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Open roles */}
      <section id="roles" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-red-500 uppercase">
            Open Positions
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Join the Team
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="group relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-600/[0.08] to-transparent p-8 transition-all hover:border-red-500/50 sm:p-10"
            >
              <span className="inline-block rounded-full bg-red-600/15 px-3 py-1 text-xs font-bold tracking-wide text-red-400 uppercase">
                {role.tag}
              </span>
              <h3 className="mt-4 text-2xl font-bold sm:text-3xl">
                {role.title}
              </h3>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/50">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {role.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {role.type}
                </span>
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" /> {role.comp}
                </span>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-white/60">
                {role.blurb}
              </p>

              <ul className="mt-5 space-y-2">
                {role.responsibilities.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-white/70"
                  >
                    <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-8 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2">
                {role.fullDescription.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-relaxed text-white/60 sm:col-span-2"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <p className="mt-6 text-sm text-white/50">
                Questions? DM{" "}
                <span className="font-semibold text-red-400">
                  {role.contact}
                </span>
              </p>

              <div
                id={`apply-${role.slug}`}
                className="mt-8 border-t border-white/10 pt-8"
              >
                <h4 className="flex items-center gap-2 text-lg font-bold">
                  Apply for this Role
                  <ArrowRight className="h-4 w-4 text-red-500" />
                </h4>
                <p className="mt-2 text-sm text-white/50">
                  Fill out the application below. We review every submission —
                  only the obsessed move forward.
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-red-600/10">
                  <iframe
                    src={`${role.formUrl}${role.formUrl.includes("?") ? "&" : "?"}embedded=true`}
                    width="100%"
                    height="900"
                    className="block"
                  >
                    Loading application form…
                  </iframe>
                </div>

                <p className="mt-4 text-sm text-white/40">
                  Form not loading?{" "}
                  <a
                    href={role.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-red-500 hover:text-red-400"
                  >
                    Open it in a new tab
                  </a>
                  .
                </p>
              </div>
            </div>
          ))}

          {/* Placeholder teasing future growth */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 p-6 text-center">
            <p className="text-base font-bold text-white/70">
              More roles opening soon
            </p>
            <p className="mt-1 max-w-sm text-sm text-white/40">
              We&apos;re scaling fast. Apply to the SDR role now and stand out
              early as we grow the team.
            </p>
          </div>
        </div>
      </section>

      {/* What the job actually looks like */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-1.5 text-xs font-bold tracking-wide text-white/60 uppercase">
          <Phone className="h-3.5 w-3.5" />
          The Role
        </div>
        <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
          What the Job Actually Looks Like
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h3 className="text-xl font-bold">What You&apos;ll Do</h3>
            <ul className="mt-5 space-y-3">
              {JOB_DO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold text-emerald-400 italic">
              If this is too much, this is not the position for you
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h3 className="text-xl font-bold">This is NOT for You If...</h3>
            <ul className="mt-5 space-y-3">
              {JOB_NOT_FOR_YOU.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-400">
                    <X className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Interested in working with us */}
      <section className="relative z-10 border-t border-white/10 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            If You&apos;re Interested in{" "}
            <span className="text-red-500">Working With Us</span>
          </h2>
          <p className="mt-6 text-lg text-white/70">
            We review every single application. If you make it past the first
            round, you will be invited to an interview where you will answer
            questions and also role play.
          </p>
          <p className="mt-8 text-sm text-white/40">
            Full-time · EST timezone · 8+ hrs/day, 6-7 days/week
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-white/40 sm:flex-row">
          <span>
            © {new Date().getFullYear()} KO Consultings. All rights reserved.
          </span>
          <span>Speed. Growth. Obsession. Excellence.</span>
        </div>
      </footer>

      {/* Disclaimer */}
      <div className="relative z-10 border-t-2 border-red-500 bg-amber-50 px-6 py-6">
        <p className="mx-auto flex max-w-4xl items-center justify-center gap-2 text-center text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-900" />
          Individual results vary. OTE figures represent potential earnings
          based on hitting performance targets. Income is not guaranteed and
          depends on effort, coachability, and market conditions.
        </p>
      </div>
    </div>
  );
}
