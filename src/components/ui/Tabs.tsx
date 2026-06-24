import { cn } from '@/lib/cn'

interface Tab<T extends string> {
  key: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (key: T) => void
  className?: string
}

export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn(
      'flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1',
      className,
    )}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold',
            'transition-all duration-150',
            active === tab.key
              ? 'bg-surface-raised text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'text-2xs px-1 rounded font-bold',
              active === tab.key ? 'bg-brand/20 text-brand' : 'bg-surface-raised text-text-muted',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
