import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "./(dashboard)/_components/logo";
import {
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />

          <Link href="/sign-in">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center md:py-32">
          <span className="mb-4 rounded-full border px-3 py-1 text-sm text-slate-600">
            AI-powered learning platform
          </span>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Learn faster with structured courses and lesson-based AI guidance
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            MentorsED helps students stay focused with guided lessons, progress
            tracking, and contextual AI support built around each chapter.
          </p>

          <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Start Learning
              </Button>
            </Link>

            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Create Account
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-6 text-left shadow-sm">
              <h3 className="text-lg font-semibold">Structured Courses</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Organize lessons into clear chapters so students always know
                what to study next.
              </p>
            </div>

            <div className="rounded-2xl border p-6 text-left shadow-sm">
              <h3 className="text-lg font-semibold">Chapter-Based AI Help</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Give learners instant support tied to the lesson they are
                currently watching.
              </p>
            </div>

            <div className="rounded-2xl border p-6 text-left shadow-sm">
              <h3 className="text-lg font-semibold">Track Progress</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Help students stay consistent with a dashboard that shows what
                is in progress and what is complete.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white/95">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* LEFT */}
          <p className="text-sm text-slate-500 text-center md:text-left">
            © {new Date().getFullYear()} MentorsED. All rights reserved.
          </p>

          {/* CENTER (SOCIAL ICONS) */}
          <div className="flex items-center gap-5 text-slate-400">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="transition transform hover:scale-110 hover:text-black"
            >
              <Twitter className="h-5 w-5" />
            </a>

            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="transition transform hover:scale-110 hover:text-black"
            >
              <Facebook className="h-5 w-5" />
            </a>

            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="transition transform hover:scale-110 hover:text-black"
            >
              <Instagram className="h-5 w-5" />
            </a>

            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="transition transform hover:scale-110 hover:text-black"
            >
              <Linkedin className="h-5 w-5" />
            </a>

            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="transition transform hover:scale-110 hover:text-black"
            >
              <Youtube className="h-5 w-5" />
            </a>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-black transition">
              Privacy
            </a>
            <a href="#" className="hover:text-black transition">
              Terms
            </a>
            <a href="#" className="hover:text-black transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
