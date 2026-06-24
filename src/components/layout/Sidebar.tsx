import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from '@/constants/navigation'
import { formatDate } from '@/lib/format'
import { useApiStatus } from '@/hooks/useApiStatus'

export function Sidebar() {
  const location  = useLocation()
  const today     = formatDate(new Date().toISOString())
  const apiStatus = useApiStatus()

  return (
    <aside className="w-[240px] shrink-0 bg-surface-card border-r border-surface-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-brand/20">
            ⚡
          </div>
          <div>
            <div className="font-black text-text-primary text-base tracking-tight">ScoutBet</div>
            <div className="text-2xs text-text-muted font-medium">{today}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                'transition-all duration-150 group',
                isActive
                  ? 'bg-brand/10 text-brand border-l-2 border-brand pl-[10px]'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised border-l-2 border-transparent pl-[10px]',
              )}
            >
              <Icon size={16} className={cn(isActive ? 'text-brand' : 'text-text-muted group-hover:text-text-secondary')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded bg-brand text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom: API status panel */}
      <div className="px-4 py-4 border-t border-surface-border space-y-2">
        {apiStatus.isMockMode ? (
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2.5">
            <p className="text-2xs font-bold text-amber-400">MODO MOCK</p>
            <p className="text-2xs text-text-muted mt-0.5">
              {!apiStatus.hasApiKey
                ? 'Adiciona VITE_API_FOOTBALL_KEY ao .env'
                : 'VITE_USE_MOCK=true activo'}
            </p>
          </div>
        ) : (
          <div className="bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-2xs font-bold text-accent-win">API LIVE</p>
              <span className="text-2xs text-text-muted">{apiStatus.cacheSize} cache</span>
            </div>

            {/* Quota bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-2xs text-text-muted">Chamadas hoje</span>
                <span className={cn(
                  'text-2xs font-bold font-mono tabular-nums',
                  apiStatus.callsUsed >= 80 ? 'text-accent-loss'
                  : apiStatus.callsUsed >= 60 ? 'text-accent-draw'
                  : 'text-text-secondary'
                )}>
                  {apiStatus.callsUsed}/100
                </span>
              </div>
              <div className="h-1 bg-surface-border rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    apiStatus.callsUsed >= 80 ? 'bg-accent-loss'
                    : apiStatus.callsUsed >= 60 ? 'bg-accent-draw'
                    : 'bg-accent-win'
                  )}
                  style={{ width: `${Math.min((apiStatus.callsUsed / 100) * 100, 100)}%` }}
                />
              </div>
            </div>

            <p className="text-2xs text-text-muted">
              {apiStatus.callsRemaining} restantes hoje
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
