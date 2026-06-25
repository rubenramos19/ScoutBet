import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TopBar } from '@/components/layout/TopBar'
import { KPICard } from '@/components/performance/KPICard'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatCents } from '@/lib/format'
import { useBankrollStore } from '@/store/useBankrollStore'
import { bankrollService } from '@/services/bankrollService'
import { storage, STORAGE_KEYS } from '@/lib/storage'

import type { RiskProfile, StakeMode } from '@/types'

const PROFILES: { key: RiskProfile; label: string; stake: string; pct: number; desc: string }[] = [
  { key: 'CONSERVATIVE', label: 'Conservador', stake: '1.5% / aposta', pct: 1.5, desc: 'Mínimo risco, crescimento lento e estável.' },
  { key: 'BALANCED',     label: 'Equilibrado', stake: '2.5% / aposta', pct: 2.5, desc: 'Equilíbrio entre risco e retorno potencial.' },
  { key: 'AGGRESSIVE',   label: 'Agressivo',   stake: '3.5% / aposta', pct: 3.5, desc: 'Maior exposição, maior potencial de ganho e perda.' },
]

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <div
      className="flex items-center justify-between py-4 cursor-pointer group select-none"
      onClick={onClick}
    >
      <div>
        <p className="text-sm font-bold text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{sub}</p>
      </div>
      <div className={cn(
        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0',
        on ? 'bg-brand' : 'bg-surface-raised border border-surface-border',
      )}>
        <span className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
          on && 'translate-x-5',
        )} />
      </div>
    </div>
  )
}

// ── Setup Modal ───────────────────────────────────────────────────────────────

function SetupModal({ onSetup }: { onSetup: () => void }) {
  const [amount,    setAmount]    = useState('')
  const [profile,   setProfile]   = useState<RiskProfile>('BALANCED')
  const [mode,      setMode]      = useState<StakeMode>('PCT')
  const [budget,    setBudget]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function handleSetup() {
    const val = parseFloat(amount.replace(',', '.'))
    if (isNaN(val) || val < 10) { setError('Insere um valor válido (mínimo €10).'); return }

    let budgetCents: number | null = null
    if (mode === 'FIXED') {
      const bv = parseFloat(budget.replace(',', '.'))
      if (isNaN(bv) || bv < 1) { setError('Orçamento de sessão inválido (mínimo €1).'); return }
      budgetCents = Math.round(bv * 100)
    }

    setSaving(true)
    await bankrollService.setupBankroll(Math.round(val * 100), profile, mode, budgetCents)
    onSetup()
  }

  const bankVal = parseFloat(amount.replace(',', '.'))
  const preview = !isNaN(bankVal) && bankVal > 0
    ? PROFILES.find(p => p.key === profile)!.pct / 100 * bankVal
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-in overflow-y-auto max-h-[90vh]">
        <div className="text-center mb-6">
          <span className="text-4xl mb-3 block">💰</span>
          <h2 className="text-xl font-black text-text-primary">Configurar Banca</h2>
          <p className="text-sm text-text-muted mt-1">Define o teu capital inicial para gestão de apostas.</p>
        </div>

        <div className="space-y-5">
          {/* Capital inicial */}
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">
              Capital Inicial (€)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">€</span>
              <input
                type="number" min="10" step="10" value={amount}
                onChange={e => { setAmount(e.target.value); setError('') }}
                placeholder="100"
                className="w-full bg-surface-raised border border-surface-border rounded-xl pl-8 pr-4 py-3 text-text-primary font-mono text-lg focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          {/* Staking mode */}
          <div>
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">
              Modo de Staking
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'PCT'   as StakeMode, icon: '%', label: 'Percentagem', sub: 'Ex: 2.5% da banca' },
                { key: 'FIXED' as StakeMode, icon: '€', label: 'Valor Fixo',  sub: 'Ex: €10 por sessão' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-colors',
                    mode === m.key
                      ? 'bg-brand/10 border-brand text-text-primary'
                      : 'bg-surface-raised border-surface-border text-text-muted hover:border-surface-border/60',
                  )}
                >
                  <p className="text-lg font-black">{m.icon}</p>
                  <p className="text-xs font-bold mt-1">{m.label}</p>
                  <p className="text-2xs text-text-muted">{m.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Fixed budget input (only when FIXED mode) */}
          {mode === 'FIXED' && (
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">
                Orçamento por Sessão (€)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">€</span>
                <input
                  type="number" min="1" step="1" value={budget}
                  onChange={e => { setBudget(e.target.value); setError('') }}
                  placeholder="10"
                  className="w-full bg-surface-raised border border-surface-border rounded-xl pl-8 pr-4 py-3 text-text-primary font-mono text-lg focus:outline-none focus:border-brand transition-colors"
                />
              </div>
              {budget && !isNaN(parseFloat(budget)) && (
                <div className="mt-2 p-3 bg-surface-raised rounded-xl space-y-1 text-xs text-text-muted">
                  <p>🎯 Apostas principais: <span className="text-text-primary font-bold">~€{(parseFloat(budget) * 0.9).toFixed(2)}</span></p>
                  <p>🎲 Raspadinha (10%): <span className="text-brand font-bold">~€{(parseFloat(budget) * 0.1).toFixed(2)}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Profile selector */}
          {mode === 'PCT' && (
            <div>
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 block">
                Perfil de Risco
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PROFILES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setProfile(p.key)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-colors',
                      profile === p.key
                        ? 'bg-brand/10 border-brand text-text-primary'
                        : 'bg-surface-raised border-surface-border text-text-muted hover:border-surface-border/60',
                    )}
                  >
                    <p className="text-xs font-bold">{p.label}</p>
                    <p className="text-2xs text-text-muted mt-0.5">{p.stake}</p>
                  </button>
                ))}
              </div>
              {preview != null && (
                <p className="text-xs text-text-muted mt-2">
                  Stake típico: <span className="text-accent-win font-bold">~€{preview.toFixed(2)}/aposta</span>
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-accent-loss">{error}</p>}

          <Button variant="primary" className="w-full" onClick={handleSetup} disabled={saving}>
            {saving ? 'A guardar...' : 'Começar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BankrollPage() {
  const { config, snapshots, isLoading, fetchAll } = useBankrollStore()
  const [showSetup,   setShowSetup]   = useState(false)
  const [editBudget,    setEditBudget]    = useState(false)
  const [budgetInput,   setBudgetInput]   = useState('')
  const [editBalance,   setEditBalance]   = useState(false)
  const [balanceInput,  setBalanceInput]  = useState('')
  const [saving,        setSaving]        = useState(false)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => {
    if (!isLoading && !config) setShowSetup(true)
    else setShowSetup(false)
  }, [isLoading, config])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    await bankrollService.updateBankroll({
      riskProfile:  config.riskProfile,
      stakeMode:    config.stakeMode,
      sessionBudgetCents: config.sessionBudgetCents,
    })
    await fetchAll()
    setSaving(false)
  }

  async function handleToggleMode() {
    if (!config) return
    const newMode = config.stakeMode === 'PCT' ? 'FIXED' : 'PCT'
    await bankrollService.updateBankroll({ stakeMode: newMode })
    await fetchAll()
  }

  async function handleBudgetSave() {
    const v = parseFloat(budgetInput.replace(',', '.'))
    if (isNaN(v) || v < 1) return
    // Cap: session budget cannot exceed current bankroll
    const maxCents = config?.currentAmountCents ?? Infinity
    const cents = Math.min(Math.round(v * 100), maxCents)
    await bankrollService.updateBankroll({ sessionBudgetCents: cents })
    await fetchAll()
    setEditBudget(false)
  }

  async function handleBalanceSave() {
    const v = parseFloat(balanceInput.replace(',', '.'))
    if (isNaN(v) || v < 0) return
    await bankrollService.updateBankroll({ currentAmountCents: Math.round(v * 100) })
    await fetchAll()
    setEditBalance(false)
    setBalanceInput('')
  }

  async function handleProfileChange(p: RiskProfile) {
    if (!config) return
    await bankrollService.updateBankroll({ riskProfile: p })
    await fetchAll()
  }

  async function toggleStopLoss() {
    if (!config) return
    await bankrollService.updateBankroll({ stopLossEnabled: !config.stopLossEnabled })
    await fetchAll()
  }

  async function toggleRaspadinha() {
    if (!config) return
    await bankrollService.updateBankroll({ raspadinhaEnabled: !config.raspadinhaEnabled })
    await fetchAll()
  }

  async function handleReset() {
    if (!confirm('Tens a certeza? Isto vai apagar toda a configuração da banca.')) return
    storage.remove(STORAGE_KEYS.BANKROLL)
    storage.remove(STORAGE_KEYS.SNAPSHOTS)
    await fetchAll()
    setShowSetup(true)
  }

  const chartData = snapshots.map(s => ({
    date:    s.date.slice(5),
    banca:   s.amountCents / 100,
    initial: config ? config.initialAmountCents / 100 : 0,
  }))

  const pctChange = config
    ? ((config.currentAmountCents - config.initialAmountCents) / config.initialAmountCents) * 100
    : 0

  const stakePerBet = config
    ? config.stakeMode === 'FIXED' && config.sessionBudgetCents != null
      ? Math.round(config.sessionBudgetCents * 0.9 / 3) // rough avg across 3 main bets
      : bankrollService.calculateFlatStake(config.currentAmountCents, config.riskProfile, 65).stakeCents
    : 0

  const stakeNote = config?.stakeMode === 'FIXED'
    ? `${config.sessionBudgetCents != null ? formatCents(config.sessionBudgetCents) : '—'} sessão`
    : `${PROFILES.find(p => p.key === config?.riskProfile)?.pct ?? 2.5}% banca`

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {showSetup && (
        <SetupModal onSetup={async () => { await fetchAll(); setShowSetup(false) }} />
      )}

      <TopBar
        title="Gestão de Banca"
        subtitle={config ? `Banca activa · ${config.stakeMode === 'FIXED' ? 'Valor fixo' : 'Flat staking'}` : 'Sem banca configurada'}
        actions={
          <div className="flex gap-2">
            <button onClick={handleReset} className="text-xs text-text-muted hover:text-accent-loss transition-colors">
              Redefinir banca
            </button>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving || !config}>
              {saving ? '...' : '↺ Actualizar'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && config && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Banca Actual + inline adjust */}
              <div className="relative">
                <KPICard
                  label="Banca Actual"
                  value={formatCents(config.currentAmountCents)}
                  delta={`${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% desde início`}
                  accent={pctChange >= 0 ? 'green' : 'red'}
                />
                {!editBalance ? (
                  <button
                    onClick={() => { setBalanceInput((config.currentAmountCents / 100).toFixed(2)); setEditBalance(true) }}
                    className="absolute top-2 right-2 text-2xs text-text-muted hover:text-brand transition-colors px-1.5 py-0.5 rounded border border-surface-border hover:border-brand"
                  >
                    Ajustar
                  </button>
                ) : (
                  <div className="absolute inset-0 bg-surface-card border border-brand rounded-xl flex flex-col items-center justify-center gap-2 p-3 z-10">
                    <p className="text-xs font-bold text-text-primary">Corrigir saldo (€)</p>
                    <input
                      autoFocus
                      type="number" step="0.01" min="0"
                      value={balanceInput}
                      onChange={e => setBalanceInput(e.target.value)}
                      className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary text-center focus:outline-none focus:border-brand"
                    />
                    <div className="flex gap-2 w-full">
                      <button onClick={() => setEditBalance(false)} className="flex-1 py-1 text-xs rounded-lg border border-surface-border text-text-muted hover:text-text-primary">Cancelar</button>
                      <button onClick={handleBalanceSave} className="flex-1 py-1 text-xs rounded-lg bg-brand text-white font-bold hover:bg-brand/90">Guardar</button>
                    </div>
                  </div>
                )}
              </div>
              <KPICard
                label="Lucro / Prejuízo"
                value={formatCents(config.currentAmountCents - config.initialAmountCents)}
                delta={`Banca inicial: ${formatCents(config.initialAmountCents)}`}
                accent={config.currentAmountCents >= config.initialAmountCents ? 'green' : 'red'}
              />
              <KPICard
                label="Stake por Aposta"
                value={formatCents(stakePerBet)}
                note={stakeNote}
                accent="default"
              />
              <KPICard
                label="Taxa de Acerto"
                value="—"
                note="Sem apostas guardadas ainda"
                accent="amber"
              />
            </div>

            {/* Chart */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
                  Evolução da Banca
                </h3>
              </CardHeader>
              <CardBody>
                {chartData.length < 2 ? (
                  <p className="text-center text-text-muted text-sm py-8">
                    Sem dados suficientes ainda — o gráfico aparece após o primeiro dia de apostas.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="banca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `€${v}`} />
                      <Tooltip formatter={(v: number) => [`€${v.toFixed(2)}`, 'Banca']} />
                      <Area type="monotone" dataKey="banca" stroke="#4f8ef7" fill="url(#banca)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>

            {/* Staking mode + budget */}
            <Card>
              <CardBody>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">
                  Modo de Staking
                </h3>

                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { key: 'PCT'   as StakeMode, icon: '%', label: 'Percentagem', sub: 'Calcula por % da banca' },
                    { key: 'FIXED' as StakeMode, icon: '€', label: 'Valor Fixo',  sub: 'Define €€ por sessão' },
                  ].map(m => (
                    <button
                      key={m.key}
                      onClick={handleToggleMode}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-colors',
                        config.stakeMode === m.key
                          ? 'bg-brand/10 border-brand text-text-primary'
                          : 'bg-surface-raised border-surface-border text-text-muted hover:border-surface-border/60',
                      )}
                    >
                      <p className="text-xl font-black">{m.icon}</p>
                      <p className="text-xs font-bold mt-1">{m.label}</p>
                      <p className="text-2xs text-text-muted">{m.sub}</p>
                    </button>
                  ))}
                </div>

                {/* Fixed budget editor */}
                {config.stakeMode === 'FIXED' && (
                  <div className="p-4 bg-surface-raised rounded-xl border border-surface-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-text-primary">Orçamento de Sessão</p>
                        <p className="text-xs text-text-muted">Quanto queres arriscar hoje</p>
                      </div>
                      {editBudget ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold">€</span>
                              <input
                                type="number" min="1" step="1" autoFocus
                                value={budgetInput}
                                onChange={e => setBudgetInput(e.target.value)}
                                placeholder={config.sessionBudgetCents ? String(config.sessionBudgetCents / 100) : '10'}
                                className="w-24 bg-surface-card border border-brand rounded-lg pl-6 pr-2 py-1.5 text-sm font-mono text-text-primary focus:outline-none"
                              />
                            </div>
                            <button onClick={handleBudgetSave} className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-lg">OK</button>
                            <button onClick={() => setEditBudget(false)} className="text-xs text-text-muted hover:text-text-primary">✕</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xs text-text-muted">máx: {formatCents(config.currentAmountCents)}</span>
                            <button
                              onClick={() => setBudgetInput(String(config.currentAmountCents / 100))}
                              className="text-2xs text-brand hover:underline"
                            >
                              usar banca total
                            </button>
                          </div>
                          {parseFloat(budgetInput) * 100 > config.currentAmountCents && (
                            <p className="text-2xs text-accent-loss">⚠ Valor acima da banca — será limitado a {formatCents(config.currentAmountCents)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-lg font-black font-mono',
                            config.sessionBudgetCents != null && config.sessionBudgetCents > config.currentAmountCents
                              ? 'text-accent-loss'
                              : 'text-text-primary',
                          )}>
                            {config.sessionBudgetCents != null ? formatCents(config.sessionBudgetCents) : '—'}
                          </span>
                          {config.sessionBudgetCents != null && config.sessionBudgetCents > config.currentAmountCents && (
                            <span className="text-2xs text-accent-loss">⚠ acima da banca</span>
                          )}
                          <button
                            onClick={() => { setEditBudget(true); setBudgetInput(config.sessionBudgetCents ? String(config.sessionBudgetCents / 100) : '') }}
                            className="text-xs text-brand hover:underline"
                          >
                            Alterar
                          </button>
                        </div>
                      )}
                    </div>

                    {config.sessionBudgetCents != null && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-surface-card rounded-lg">
                          <p className="text-2xs text-text-muted">Apostas</p>
                          <p className="text-sm font-bold text-text-primary">
                            {formatCents(Math.round(config.sessionBudgetCents * 0.9))}
                          </p>
                          <p className="text-2xs text-text-muted">90% sessão</p>
                        </div>
                        <div className="p-2 bg-surface-card rounded-lg">
                          <p className="text-2xs text-text-muted">Raspadinha</p>
                          <p className="text-sm font-bold text-brand">
                            {formatCents(Math.round(config.sessionBudgetCents * 0.1))}
                          </p>
                          <p className="text-2xs text-text-muted">10% sessão</p>
                        </div>
                        <div className="p-2 bg-surface-card rounded-lg">
                          <p className="text-2xs text-text-muted">Por aposta</p>
                          <p className="text-sm font-bold text-accent-win">
                            ~{formatCents(Math.round(config.sessionBudgetCents * 0.9 / 3))}
                          </p>
                          <p className="text-2xs text-text-muted">média 3 picks</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Risk profiles (PCT mode only) */}
            {config.stakeMode === 'PCT' && (
              <Card>
                <CardBody>
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">
                    Perfil de Risco
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {PROFILES.map(p => {
                      const stakeCents = bankrollService.calculateFlatStake(config.currentAmountCents, p.key, 65).stakeCents
                      const isActive   = config.riskProfile === p.key
                      return (
                        <button
                          key={p.key}
                          onClick={() => handleProfileChange(p.key)}
                          className={cn(
                            'p-4 rounded-xl border text-left transition-all',
                            isActive
                              ? 'bg-brand/10 border-brand shadow-sm'
                              : 'bg-surface-raised border-surface-border hover:border-brand/40',
                          )}
                        >
                          <p className={cn('text-sm font-bold', isActive ? 'text-brand' : 'text-text-primary')}>{p.label}</p>
                          <p className="text-xs text-text-muted mt-0.5">{p.stake}</p>
                          <p className="text-xs text-text-muted text-sm mt-1 leading-relaxed">{p.desc}</p>
                          <p className={cn('text-sm font-black mt-2', isActive ? 'text-brand' : 'text-text-muted')}>
                            ~{formatCents(stakeCents)} / aposta
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Protection limits */}
            <Card>
              <CardBody>
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="text-base">🛡</span> Limites de Protecção
                </h3>
                <div className="divide-y divide-surface-border/50">
                  <Toggle
                    on={config.stopLossEnabled}
                    onClick={toggleStopLoss}
                    label="Stop-Loss Diário"
                    sub="Pausa sugestões se perdas excederem 10% da banca num dia"
                  />
                  <Toggle
                    on={config.raspadinhaEnabled}
                    onClick={toggleRaspadinha}
                    label="Raspadinha"
                    sub={config.stakeMode === 'FIXED'
                      ? `10% do orçamento de sessão (${config.sessionBudgetCents ? formatCents(Math.round(config.sessionBudgetCents * 0.1)) : '—'})`
                      : 'Habilita múltiplas de alto risco (máx 1% banca / mês)'}
                  />
                </div>
              </CardBody>
            </Card>

            <p className="text-xs text-text-muted text-center pb-2">
              Aposta com responsabilidade. Stakes são sugestões — decide sempre tu.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
