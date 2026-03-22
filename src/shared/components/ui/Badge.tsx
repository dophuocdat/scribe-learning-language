type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-700/60 text-surface-200/70 border-surface-600/30',
  success: 'bg-success/15 text-success border-success/20',
  warning: 'bg-warning/15 text-warning border-warning/20',
  error: 'bg-error/15 text-error border-error/20',
  info: 'bg-accent-500/15 text-accent-400 border-accent-500/20',
  primary: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      }`}
    >
      {children}
    </span>
  )
}
