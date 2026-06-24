import { cn } from '@/lib/cn'
import type { FormResult } from '@/types'

const config: Record<FormResult, { label: string; classes: string }> = {
  W: { label: 'V', classes: 'bg-accent-winBg  text-accent-win  border-accent-win/30' },
  D: { label: 'E', classes: 'bg-accent-drawBg text-accent-draw border-accent-draw/30' },
  L: { label: 'D', classes: 'bg-accent-lossBg text-accent-loss border-accent-loss/30' },
}

interface FormBadgeProps {
  result: FormResult
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'w-5 h-5 text-[9px]', md: 'w-6 h-6 text-[10px]', lg: 'w-7 h-7 text-xs' }

export function FormBadge({ result, size = 'md' }: FormBadgeProps) {
  const { label, classes } = config[result]
  return (
    <div className={cn(
      'flex items-center justify-center font-black border rounded',
      classes,
      sizes[size],
    )}>
      {label}
    </div>
  )
}

export function FormStrip({ form, size }: { form: FormResult[]; size?: FormBadgeProps['size'] }) {
  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => <FormBadge key={i} result={r} size={size} />)}
    </div>
  )
}
