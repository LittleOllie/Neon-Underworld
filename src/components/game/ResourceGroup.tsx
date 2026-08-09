import { TERMS } from '@/config/game/terminology';

interface ResourceRowProps {
  label: string;
  value: number | string;
  sublabel?: string;
}

export function ResourceRow({ label, value, sublabel }: ResourceRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
      </div>
      <p className="font-mono-figures text-sm font-medium">{value}</p>
    </div>
  );
}

interface ResourceGroupProps {
  title: string;
  children: React.ReactNode;
}

export function ResourceGroup({ title, children }: ResourceGroupProps) {
  return (
    <div className="panel rounded-xl px-4 py-1">
      <h3 className="text-label py-3">{title}</h3>
      {children}
    </div>
  );
}

export { TERMS };
