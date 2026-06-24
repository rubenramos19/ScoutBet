import { cn } from '@/lib/cn'
import { formatOdd } from '@/lib/format'

interface OddBadgeProps {
  odd: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-xl px-3 py-1.5 font-black',
}

export function OddBadge({ odd, size = 'md', className }: OddBadgeProps) {
  return (
    <span className={cn(
      'inline-block font-bold tabular-nums font-mono',
      'bg-accent-drawBg text-accent-draw border border-accent-draw/30 rounded-lg',
      sizes[size],
      className,
    )}>
      {formatOdd(odd)}
    </span>
  )
}
