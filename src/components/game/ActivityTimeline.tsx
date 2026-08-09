import type { LucideIcon } from 'lucide-react';

export interface ActivityEvent {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  time: string;
  sortAt: number;
  variant?: 'default' | 'scout' | 'payout';
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
  emptyMessage?: string;
}

export function ActivityTimeline({ events, emptyMessage = 'No recent activity' }: ActivityTimelineProps) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && (
            <span
              className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border-subtle"
              aria-hidden
            />
          )}
          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-border-subtle">
            <event.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">{event.title}</p>
              <time className="shrink-0 text-[10px] text-muted">{event.time}</time>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{event.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
