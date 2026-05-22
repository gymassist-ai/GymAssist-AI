import Link from 'next/link';
import { ArrowRight, BadgeIndianRupee, CalendarClock, Dumbbell, MessageCircle, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';

const stats = [
  { label: 'Members tracked', value: '248' },
  { label: 'Collection rate', value: '92%' },
  { label: 'Renewals due', value: '14' },
];

const workflows = [
  { icon: UsersRound, label: 'Members', text: 'Profiles, plans, payments, and renewal status stay together.' },
  { icon: CalendarClock, label: 'Renewals', text: 'Monthly, quarterly, half yearly, and yearly renewals extend cleanly.' },
  { icon: BadgeIndianRupee, label: 'Billing', text: 'Dues, receipts, GST details, and payment history remain visible.' },
  { icon: MessageCircle, label: 'Reminders', text: 'WhatsApp-ready follow-ups use the gym name and payment context.' },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050806] text-white">
      <section className="relative min-h-screen border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_15%,rgba(110,231,183,0.16),transparent_32%),linear-gradient(135deg,#050806_0%,#132017_52%,#060806_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3" aria-label="GymAssist AI home">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-500/20">
                <Dumbbell className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base font-semibold tracking-tight">GymAssist AI</span>
                <span className="block text-xs text-white/45">Gym operations center</span>
              </span>
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-white/72 transition hover:border-white/25 hover:bg-white/8 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/login?authMode=signup"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-200"
              >
                Start
                <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>
          </header>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Built for Indian gym owners
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
                GymAssist AI
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/62 sm:text-lg">
                Manage memberships, recurring renewals, dues, receipts, GST details, reminders, diet plans, and workout plans from one focused workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login?authMode=signup"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-200"
                >
                  Create Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/[0.055] px-5 py-3 text-sm font-semibold text-white/78 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  Login to Dashboard
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-lg border border-white/10 bg-[#0b120d]/92 p-4 shadow-2xl shadow-black/45 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Live Preview</p>
                    <h2 className="mt-2 text-xl font-semibold">Today&apos;s gym desk</h2>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-emerald-200" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {stats.map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                      <p className="text-2xl font-semibold">{item.value}</p>
                      <p className="mt-1 text-xs text-white/45">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <p className="text-xs text-emerald-100/70">AI command</p>
                    <p className="mt-2 text-sm font-medium text-emerald-50">Renew Rahul for 1 month, paid INR 1800 by UPI</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <p className="text-xs text-white/42">Expiry logic</p>
                      <p className="mt-2 text-sm text-white/78">Active, expiring soon, and expired members are separated automatically.</p>
                    </div>
                    <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
                      <p className="text-xs text-amber-100/70">Pending dues</p>
                      <p className="mt-2 text-sm text-white/82">Recovery reminders include amount, date, and gym branding.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07100a] px-5 py-14 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {workflows.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                  <Icon className="h-5 w-5 text-emerald-200" />
                  <h3 className="mt-4 text-base font-semibold">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/52">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
