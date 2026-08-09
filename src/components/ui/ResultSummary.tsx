interface ResultSummaryProps {
  summary: string;
  items: Array<{ label: string; value: string; positive?: boolean; negative?: boolean }>;
}

export function ResultSummary({ summary, items }: ResultSummaryProps) {
  return (
    <div
      className="rounded-xl border border-border bg-surface p-5"
      role="region"
      aria-live="polite"
      aria-label="Scout results"
    >
      <p className="text-sm text-muted">{summary}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd
              className={`font-mono-figures text-lg font-medium ${
                item.positive ? 'text-green' : item.negative ? 'text-red' : ''
              }`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
