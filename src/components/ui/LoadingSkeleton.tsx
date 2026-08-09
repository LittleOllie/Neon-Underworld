export function LoadingSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-elevated ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading">
      <LoadingSkeleton className="h-16 w-full" />
      <LoadingSkeleton className="h-24 w-full" />
      <LoadingSkeleton className="h-40 w-full" />
      <LoadingSkeleton className="h-32 w-full" />
    </div>
  );
}
