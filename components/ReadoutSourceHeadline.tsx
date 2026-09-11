export default function ReadoutSourceHeadline({ href, source, title, compact = false }: {
  href: string;
  source: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={`er-source-headline ${compact ? "is-compact" : ""}`}>
      <span className="er-source">{source}</span>
      <h3 className="er-source-title">
        <a href={href} target="_blank" rel="noreferrer">{title}</a>
      </h3>
    </div>
  );
}
