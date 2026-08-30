type HighlightTextProps = Readonly<{
  text: string;
  query: string;
}>;

export function HighlightText({ text, query }: HighlightTextProps) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;

  // Escape special regex characters safely
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={index}
            className="rounded bg-cyan-500/20 px-0.5 font-semibold text-cyan-300"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
