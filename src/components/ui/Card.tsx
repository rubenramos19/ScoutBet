import { cn } from '@/lib/cn'

interface CardProps {
  children: React.ReactNode
  className?: string
  /** Interactive: adds hover effect */
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-card border border-surface-border rounded-xl',
        hover && 'cursor-pointer hover:-translate-y-0.5 hover:border-brand/30 transition-all duration-150',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pt-5 pb-3', className)}>{children}</div>
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 py-3 border-t border-surface-border', className)}>
      {children}
    </div>
  )
}
