import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { GameDetail } from '@/pages/GameDetail'
import { History } from '@/pages/History'
import { BankrollPage } from '@/pages/BankrollPage'
import { DailyPlan } from '@/pages/DailyPlan'

// Sprint 2+ placeholders — avoids blank pages on nav click
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
      <span className="text-4xl">🚧</span>
      <p className="text-lg font-bold text-text-secondary">{label}</p>
      <p className="text-sm">Em construção — próximos sprints</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/jogo/:id"      element={<GameDetail />} />
        <Route path="/plano"         element={<DailyPlan />} />
        <Route path="/historico"     element={<History />} />
        <Route path="/performance"   element={<ComingSoon label="Dashboard de Performance" />} />
        <Route path="/banca"         element={<BankrollPage />} />
        <Route path="/definicoes"    element={<ComingSoon label="Definições" />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
