interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-800/60 rounded-lg animate-pulse ${className}`}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3" style={{ pointerEvents: 'none' }}>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="h-5 w-1/5" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
