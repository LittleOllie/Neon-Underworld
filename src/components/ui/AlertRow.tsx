interface AlertRowProps {
  message: string;
  severity?: 'warning' | 'info' | 'success';
}

const SEVERITY_STYLES = {
  warning: 'border-gold/30 bg-gold/5 text-gold',
  info: 'border-cyan/30 bg-cyan/5 text-cyan',
  success: 'border-green/30 bg-green/5 text-green',
};

export function AlertRow({ message, severity = 'info' }: AlertRowProps) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-sm ${SEVERITY_STYLES[severity]}`}
      role="status"
    >
      {message}
    </div>
  );
}
