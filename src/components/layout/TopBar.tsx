import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface TopBarProps {
  title: string
  subtitle?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  actions?: React.ReactNode
  className?: string
}

export function TopBar({ title, subtitle, onRefresh, isRefreshing, actions, className }: TopBarProps) {
  return (
    <header className={cn(
      'flex items-center justify-between px-6 py-4',
      'border-b border-surface-border bg-surface-card/50 backdrop-blur-sm',
      'sticky top-0 z-10',
      className,
    )}>
      <div>
        <h1 className="text-lg font-black text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} loading={isRefreshing}>
            <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
            Actualizar
          </Button>
        )}
      </div>
    </header>
  )
}
