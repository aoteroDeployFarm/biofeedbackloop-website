"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/philosophy", label: "Philosophy" },
  { href: "/journey", label: "The Journey" },
  { href: "/meals", label: "Bridge Meals" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-canvas/95 backdrop-blur-sm border-b border-surface-muted shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container-site">
        <nav className="flex items-center justify-between h-16">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-full bg-accent-azure/20 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-accent-azure block group-hover:scale-110 transition-transform" />
            </span>
            <span className="font-serif text-lg font-semibold text-ink tracking-tight">
              BioFeedbackLoop
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "btn-ghost text-body-sm py-1.5",
                    isActive(l.href) && "text-ink font-medium bg-surface-warm"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/dashboard"
              className={cn(
                "btn-primary text-sm py-2 px-4",
                isActive("/dashboard") && "bg-accent-azure"
              )}
            >
              Log Signals
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-ink-light hover:text-ink"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 space-y-1">
              <span
                className={cn(
                  "block h-0.5 bg-current transition-all duration-200",
                  menuOpen && "translate-y-1.5 rotate-45"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 bg-current transition-all duration-200",
                  menuOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "block h-0.5 bg-current transition-all duration-200",
                  menuOpen && "-translate-y-1.5 -rotate-45"
                )}
              />
            </div>
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 bg-canvas border-b border-surface-muted",
          menuOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="container-site py-4 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "block py-2 px-3 text-body-sm rounded-lg transition-colors",
                isActive(l.href)
                  ? "text-ink font-medium bg-surface-warm"
                  : "text-ink-light hover:text-ink hover:bg-surface-warm"
              )}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3">
            <Link href="/dashboard" className="btn-primary w-full justify-center">
              Log Signals
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
