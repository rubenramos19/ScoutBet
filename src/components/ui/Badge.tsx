import { cn } from '@/lib/cn'

type Variant = 'default' | 'win' | 'loss' | 'void' | 'draw' | 'blue' | 'purple'

const variants: Record<Variant, string> = {
  default: 'bg-surface-raised text-text-secondary border-surface-border',
  win:     'bg-accent-winBg  text-accent-win  border-accent-win/30',
  loss:    'bg-accent-lossBg text-accent-loss border-accent-loss/30',
  draw:    'bg-accent-drawBg text-accent-draw border-accent-draw/30',
  void:    'bg-surface-raised text-text-muted border-surface-border',
  blue:    'bg-brand-light/10 text-brand border-brand/30',
  purple:  'bg-purple-900/30  text-purple-400  border-purple-500/30',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
  size?: 'sm' | 'md'
}

export function Badge({ children, variant = 'default', className, size = 'sm' }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-bold tracking-wide border rounded',
      size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs',
      variants[variant],
      className,
    )}>
      {children}
    </span>
  )
}
