import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TopBar } from '@/components/layout/TopBar'
import { KPICard } from '@/components/performance/KPICard'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatCents, formatPctNum } from '@/lib/format'
import { useBankrollStore } from '@/store/useBankrollStore'
import type { RiskProfile } from '@/types'

const PROFILES: { key: RiskProfile; label: string; stake: string; desc: string }[] = [
  { key: 'CONSERVATIVE', label: 'Conservador', stake: '1.5% / aposta', desc: 'Mínimo risco, crescimento lento e estável.' },
  { key: 'BALANCED',     label: 'Equilibrado', stake: '2.5% / aposta', desc: 'Equilíbrio entre risco e retorno potencial.' },
  { key: 'AGGRESSIVE',   label: 'Agressivo',   stake: '3.5% / aposta', desc: 'Maior exposição, maior potencial de ganho e perda.' },
]

export function BankrollPage() {
  const { config, snapshots, stats, isLoading, fetchAll } = useBankrollStore()
  const [selectedProfile, setSelectedProfile] = useState<RiskProfile>('BALANCED')

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    if (config) setSelectedProfile(config.riskProfile)
  }, [config])

  const chartData = snapshots.map(s => ({
    date: s.date.slice(5),   // MM-DD
    banca: s.amountCents / 100,
    pl: s.dailyPLCents / 100,
  }))

  const growth = config
    ? config.currentAmountCents - config.initialAmountCents
    : 0
  const growthPct = config
    ? ((config.currentAmountCents - config.initialAmountCents) / config.initialAmountCents) * 100
    : 0

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      <TopBar
        title="Gestão de Banca"
        subtitle="Flat staking — Kelly disponível após calibração (Sprint 7)"
        onRefresh={fetchAll}
        isRefreshing={isLoading}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="Banca Actual"
            value={config ? formatCents(config.currentAmountCents) : '—'}
            delta={config ? `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}% desde início` : ''}
            trend={growthPct >= 0 ? 'up' : 'down'}
            accent={growthPct >= 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Lucro / Prejuízo Total"
            value={formatCents(growth)}
            delta={`Banca inicial: ${config ? formatCents(config.initialAmountCents) : '—'}`}
            accent={growth >= 0 ? 'green' : 'red'}
          />
          <KPICard
            label="Stake por Aposta"
            value={config ? formatPctNum(config.flatStakePct * 100, 1) : '—'}
            note="Flat (Kelly Sprint 7)"
            accent="default"
          />
          <KPICard
            label="Taxa de Acerto (30d)"
            value={stats ? formatPctNum(stats.accuracyRate * 100, 1) : '—'}
            delta={stats ? `${stats.wins}V · ${stats.losses}L` : ''}
            accent={stats && stats.accuracyRate >= 0.6 ? 'green' : 'amber'}
          />
        </div>

        {/* Bankroll evolution chart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">📈 Evolução da Banca (30 dias)</h3>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="bancaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0D1220', border: '1px solid #1E2A3A', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(v: number) => [`€${v.toFixed(2)}`, 'Banca']}
                />
                <Area type="monotone" dataKey="banca" stroke="#3B82F6" strokeWidth={2} fill="url(#bancaGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Risk profile selector */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">⚙️ Perfil de Risco</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              {PROFILES.map(p => (
                <button
                  key={p.key}
                  onClick={() => setSelectedProfile(p.key)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all duration-150',
                    selectedProfile === p.key
                      ? 'border-brand bg-brand/10'
                      : 'border-surface-border bg-surface-raised hover:border-brand/40',
                  )}
                >
                  <p className={cn('text-sm font-bold mb-1', selectedProfile === p.key ? 'text-brand' : 'text-text-primary')}>
                    {p.label}
                  </p>
                  <p className="text-xs font-mono text-accent-draw mb-1.5">{p.stake}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{p.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl">
              <p className="text-xs font-bold text-amber-400 mb-1">⚠ Kelly Criterion — Disponível no Sprint 7</p>
              <p className="text-xs text-text-muted leading-relaxed">
                O Kelly Criterion requer calibração do motor de probabilidade sobre dados históricos reais (Sprint 6).
                Por agora, usamos <strong className="text-text-secondary">staking plano</strong> para proteger a banca.
                Nunca use Kelly com probabilidades não-calibradas — ver auditoria K-01.
              </p>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="primary" onClick={() => {}}>
                Guardar Configuração
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Stop-loss & limits */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">🛡 Limites de Protecção</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-surface-border">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Stop-Loss Diário</p>
                  <p className="text-xs text-text-muted">Pausa sugestões se perdas excederem X% da banca no dia</p>
                </div>
                <div className={cn('w-10 h-5 rounded-full transition-colors', config?.stopLossEnabled ? 'bg-brand' : 'bg-surface-raised border border-surface-border')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white m-0.5 transition-transform', config?.stopLossEnabled ? 'translate-x-5' : '')} />
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-surface-border">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Raspadinha</p>
                  <p className="text-xs text-text-muted">Habilita sugestões de múltiplas de alto risco (máx 1%/mês)</p>
                </div>
                <div className={cn('w-10 h-5 rounded-full transition-colors cursor-pointer', config?.raspadinhaEnabled ? 'bg-brand' : 'bg-surface-raised border border-surface-border')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white m-0.5 transition-transform', config?.raspadinhaEnabled ? 'translate-x-5' : '')} />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
