"use client";

export default function ReadoutNextError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="er-page">
      <section className="er-section er-worth">
        <div className="er-section-title"><h2>The Readout</h2></div>
        <div className="er-load-error" role="alert">
          <p>The latest saved edition could not be loaded.</p>
          <button type="button" onClick={reset}>Try again</button>
        </div>
      </section>
    </main>
  );
}
