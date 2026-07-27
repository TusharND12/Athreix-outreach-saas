"use client";

import {
  ArrowUp,
  BadgeCheck,
  Factory,
  MapPin,
  MousePointer2,
  Search,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

const exampleQuery = "manufacturing leads in India";

const resultGroups = [
  {
    name: "Industrial machinery",
    location: "Pune · Maharashtra",
    count: "86 companies",
    score: "94% fit",
  },
  {
    name: "Automotive components",
    location: "Chennai · Tamil Nadu",
    count: "61 companies",
    score: "91% fit",
  },
  {
    name: "Precision engineering",
    location: "Ahmedabad · Gujarat",
    count: "48 companies",
    score: "88% fit",
  },
] as const;

type AnimationPhase =
  "typing" | "waiting" | "moving" | "pressing" | "results" | "resetting";

export function AnimatedSearchPreview() {
  const [cycle, setCycle] = React.useState(0);
  const [typedLength, setTypedLength] = React.useState(0);
  const [phase, setPhase] = React.useState<AnimationPhase>("typing");

  React.useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const schedule = (callback: () => void, delay: number) => {
      timers.push(setTimeout(callback, delay));
    };

    setTypedLength(0);
    setPhase("typing");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedLength(exampleQuery.length);
      setPhase("results");
      return () => timers.forEach(clearTimeout);
    }

    Array.from(exampleQuery).forEach((_, index) => {
      schedule(() => setTypedLength(index + 1), 420 + index * 62);
    });

    const typingComplete = 420 + exampleQuery.length * 62;
    schedule(() => setPhase("waiting"), typingComplete + 120);
    schedule(() => setPhase("moving"), typingComplete + 620);
    schedule(() => setPhase("pressing"), typingComplete + 1_360);
    schedule(() => setPhase("results"), typingComplete + 1_650);
    schedule(() => setPhase("resetting"), typingComplete + 6_100);
    schedule(() => setCycle((value) => value + 1), typingComplete + 6_650);

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  const typedQuery = exampleQuery.slice(0, typedLength);
  const showPointer = phase === "moving" || phase === "pressing";
  const showResults = phase === "results";

  return (
    <div className={`animated-search-preview is-${phase} mx-auto max-w-5xl`}>
      <div
        className="marketing-query-shell animated-search-shell flex items-center gap-3 text-left"
        role="search"
        aria-label="Animated search example"
      >
        <Search
          aria-hidden="true"
          className="animated-search-icon size-5 shrink-0 text-primary"
        />
        <span className="min-w-0 flex-1 truncate text-sm sm:text-lg">
          {typedQuery ? (
            <span className="animated-search-query">{typedQuery}</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-300">
              Search companies, people, technologies, or buying signals
            </span>
          )}
          <span aria-hidden="true" className="animated-search-caret" />
        </span>
        <Link
          href="/signup"
          aria-label="Start a prospect search"
          className="marketing-query-action animated-search-action"
        >
          <ArrowUp aria-hidden="true" className="size-5" />
          <span aria-hidden="true" className="animated-search-action-ring" />
        </Link>

        <MousePointer2
          aria-hidden="true"
          className={`animated-search-pointer ${showPointer ? "is-visible" : ""}`}
          fill="currentColor"
        />
      </div>

      <div
        className={`animated-search-results ${showResults ? "is-visible" : ""}`}
        aria-hidden={!showResults}
      >
        <div className="animated-search-results-clip">
          <div className="animated-search-results-panel">
            <header className="animated-search-results-header">
              <span>
                <BadgeCheck className="size-4" />
                Manufacturing leads in India
              </span>
              <small>195 qualified companies</small>
            </header>

            <div className="animated-search-result-list">
              {resultGroups.map((result) => (
                <article key={result.name} className="animated-search-result">
                  <span className="animated-result-icon">
                    <Factory className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong>{result.name}</strong>
                    <small>
                      <MapPin className="size-3" />
                      {result.location}
                      <i>·</i>
                      {result.count}
                    </small>
                  </span>
                  <em>{result.score}</em>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
