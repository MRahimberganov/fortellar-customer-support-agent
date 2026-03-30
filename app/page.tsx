import Image from "next/image";
import Link from "next/link";
import ChatArea from "@/components/ChatArea";

export default function Home() {
  const services = [
    {
      title: "CloudOps",
      description:
        "Design, build, and operate scalable cloud environments with automation, reliability, and operational efficiency built in.",
    },
    {
      title: "Security & Compliance",
      description:
        "Embed security controls, governance, and continuous monitoring into every layer of your cloud platform.",
    },
    {
      title: "Disaster Recovery",
      description:
        "Strengthen resilience with tested recovery strategies, backup planning, and cloud-native continuity capabilities.",
    },
    {
      title: "AI Readiness",
      description:
        "Prepare your organization for secure, responsible, and scalable AI adoption with strong data and governance foundations.",
    },
  ];

  const quickTopics = [
    "CloudOps services and capabilities",
    "Security and compliance support",
    "Disaster recovery and incident management",
    "AI readiness and governance",
  ];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center">
            <Image
              src="/fortellar-logo.png"
              alt="Fortellar logo"
              width={240}
              height={64}
              priority
              className="h-auto w-auto"
            />
          </div>

          <nav className="hidden gap-8 text-sm font-medium text-slate-700 md:flex">
            <Link href="#services" className="transition hover:text-sky-600">
              Services
            </Link>
            <Link href="#support" className="transition hover:text-sky-600">
              Support
            </Link>
            <Link href="#contact" className="transition hover:text-sky-600">
              Contact
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Fortellar Support Experience
            </p>

            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Support for CloudOps, Security, Resilience, and AI — all in one
              place.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              This support experience helps users learn more about Fortellar
              services, ask questions, and quickly find guidance across
              CloudOps, Security & Compliance, Disaster Recovery, and AI
              Readiness.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="#support"
                className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
              >
                Open Support
              </Link>
              <Link
                href="#services"
                className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Explore Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="grid gap-6 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">Cloud</p>
              <p className="mt-1">
                Modern infrastructure and operations support
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">Security</p>
              <p className="mt-1">
                Built-in controls and compliance alignment
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">Resilience</p>
              <p className="mt-1">
                Recovery planning and operational readiness
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">AI</p>
              <p className="mt-1">
                Responsible adoption and governance support
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            Services
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            What Fortellar helps organizations do
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Fortellar supports organizations with secure cloud transformation,
            operational maturity, resilience planning, and modern digital
            enablement.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-xl font-semibold text-slate-900">
                {service.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
              Support Portal
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              A branded customer support experience built for Fortellar
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              This page combines a website-style experience with an intelligent
              support interface, giving users a simple way to explore services
              and ask questions in one place.
            </p>
          </div>

          <div className="grid gap-4">
            {quickTopics.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="font-medium text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
            Support Assistant
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Ask Fortellar questions in one place
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Use the support assistant to answer common questions, guide users to
            relevant services, and create a smoother client experience.
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 px-3 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Fortellar Support Assistant
              </h3>
              <p className="text-sm text-slate-500">
                Ask about services, support, and solutions
              </p>
            </div>
          </div>

          <div className="h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg md:h-[650px]">
            <ChatArea />
          </div>
        </div>
      </section>

      <section id="contact" className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 md:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
                Contact Fortellar
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Turn support into a stronger client experience
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                Fortellar helps organizations modernize cloud operations,
                improve resilience, strengthen security, and prepare for the
                next wave of AI-enabled transformation.
              </p>

              <div className="mt-8">
                <Link
                  href="#support"
                  className="inline-flex rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
                >
                  Start a Conversation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500 lg:px-8">
          © 2026 Fortellar. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
