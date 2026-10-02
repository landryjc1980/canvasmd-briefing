import type { ReactNode, Ref } from "react";
import ReadoutSourceHeadline from "./ReadoutSourceHeadline";

export default function ReadoutArticleCard({
  href,
  source,
  title,
  date,
  beforeSource,
  footer,
  compact = false,
  className = "",
  articleRef,
  children,
}: {
  href: string | null;
  /** null or empty: no source line (a registry card with no publication name). */
  source: string | null;
  title: string;
  date?: ReactNode;
  beforeSource?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
  articleRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <article ref={articleRef} className={`er-development ${className}`.trim()}>
      {beforeSource}
      {href
        ? <ReadoutSourceHeadline href={href} source={source} title={title} compact={compact} />
        : <div className="er-source-headline">{source && <span className="er-source">{source}</span>}<h3 className="er-source-title">{title}</h3></div>}
      {date}
      {children}
      {footer}
    </article>
  );
}
