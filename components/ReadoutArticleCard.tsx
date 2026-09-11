import type { ReactNode, Ref } from "react";
import ReadoutSourceHeadline from "./ReadoutSourceHeadline";

export default function ReadoutArticleCard({
  href,
  source,
  title,
  date,
  beforeSource,
  compact = false,
  className = "",
  articleRef,
  children,
}: {
  href: string | null;
  source: string;
  title: string;
  date?: ReactNode;
  beforeSource?: ReactNode;
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
        : <div className="er-source-headline"><span className="er-source">{source}</span><h3 className="er-source-title">{title}</h3></div>}
      {date}
      {children}
    </article>
  );
}
