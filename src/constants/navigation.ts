import {
  LayoutDashboard,
  Zap,
  History,
  BarChart3,
  Wallet,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     path: '/',          icon: LayoutDashboard },
  { label: 'Plano Diário',  path: '/plano',     icon: Zap,       badge: 'HOJE' },
  { label: 'Histórico',     path: '/historico', icon: History },
  { label: 'Performance',   path: '/performance', icon: BarChart3 },
  { label: 'Banca',         path: '/banca',     icon: Wallet },
  { label: 'Definições',    path: '/definicoes', icon: Settings },
]
