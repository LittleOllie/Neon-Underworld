interface ActivityRowProps {
  title: string;
  detail?: string;
  time?: string;
}

export function ActivityRow({ title, detail, time }: ActivityRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm">{title}</p>
        {detail && <p className="text-xs text-muted">{detail}</p>}
      </div>
      {time && <time className="shrink-0 text-xs text-muted">{time}</time>}
    </div>
  );
}
