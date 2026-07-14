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
    title: "Sales Development Representative",
    tag: "E-Commerce Offer",
    location: "Remote",
    type: "Full-Time",
    comp: "Commission Only",
    blurb:
      "You'll be the first line of contact turning inbound and outbound interest into booked calls for a high-growth e-commerce brand. This is a role for someone obsessed with the numbers, relentless in follow-up, and hungry to grow into a closer.",
    responsibilities: [
      "Qualify and book calls with inbound leads daily",
      "Run structured outbound prospecting sequences",
      "Track and hit weekly connection & booking targets",
      "Follow our proven scripts while adding your own edge",
      "Report directly into the growth & sales leadership team",
    ],
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden bg-black text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-drift absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-orange-600/20 blur-[120px]" />
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
            href="#apply"
            className="group flex items-center gap-1.5 rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold transition-all hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-600/30"
          >
            Apply Now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 pb-20 text-center sm:pt-32 sm:pb-28">
        <div
          className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400"
          style={{ animationDelay: "0.05s" }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
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
          We&apos;re building industry leaders — not employees. If you&apos;re
          obsessed with growth, allergic to average, and ready to earn what
          you&apos;re worth, we want to hear from you.
        </p>

        <div
          className="animate-fade-in-up mt-10 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.45s" }}
        >
          <a
            href="#apply"
            className="group flex items-center gap-2 rounded-full bg-orange-600 px-8 py-4 text-base font-bold shadow-lg shadow-orange-600/30 transition-all hover:scale-105 hover:bg-orange-500 hover:shadow-orange-500/40"
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
          <p className="text-xs font-semibold tracking-[0.3em] text-orange-500 uppercase">
            Our Mission
          </p>
          <p className="mt-4 text-2xl leading-snug font-bold sm:text-3xl">
            Become industry leaders. The most credible company thought of when
            mentioning the industry.
          </p>
        </div>
      </section>

      {/* Core values */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-orange-500 uppercase">
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
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:-translate-y-1 hover:border-orange-500/40 hover:bg-white/[0.06]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600/15 text-orange-500 transition-colors group-hover:bg-orange-600 group-hover:text-white">
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
          <p className="text-sm font-semibold tracking-[0.3em] text-orange-500 uppercase">
            Open Positions
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Join the Team
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ROLES.map((role) => (
            <div
              key={role.title}
              className="group relative overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-b from-orange-600/[0.08] to-transparent p-8 transition-all hover:border-orange-500/50 lg:col-span-1"
            >
              <span className="inline-block rounded-full bg-orange-600/15 px-3 py-1 text-xs font-bold tracking-wide text-orange-400 uppercase">
                {role.tag}
              </span>
              <h3 className="mt-4 text-2xl font-bold">{role.title}</h3>

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
                    <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="#apply"
                className="group/btn mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 py-3.5 text-sm font-bold transition-all hover:bg-orange-500 hover:shadow-lg hover:shadow-orange-600/30"
              >
                Apply for this Role
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </a>
            </div>
          ))}

          {/* Placeholder card teasing future growth */}
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 p-8 text-center lg:col-span-2">
            <p className="text-lg font-bold text-white/70">
              More roles opening soon
            </p>
            <p className="mt-2 max-w-sm text-sm text-white/40">
              We&apos;re scaling fast. Apply to the SDR role now and stand out
              early as we grow the team.
            </p>
          </div>
        </div>
      </section>

      {/* Apply section */}
      <section
        id="apply"
        className="relative z-10 border-t border-white/10 bg-gradient-to-b from-orange-600/10 to-transparent py-24"
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            Ready to prove you&apos;re the best?
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Fill out the application below. We review every submission — only
            the obsessed move forward.
          </p>

          <div className="mt-10 flex justify-center">
            <a
              href={GOOGLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-full bg-orange-600 px-10 py-5 text-lg font-bold shadow-xl shadow-orange-600/30 transition-all hover:scale-105 hover:bg-orange-500"
            >
              Apply on Google Form
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
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
    </div>
  );
}
