'use client'

import { Shield, User, AlertTriangle, Star, HelpCircle, Flame, ChevronRight } from 'lucide-react'
import type { Request, TriageDecision } from '@/lib/types'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  angry_double_charge: { label: 'Double Charge', icon: Flame, color: 'text-red-400' },
  urgent_bad_review: { label: 'Bad Review Threat', icon: AlertTriangle, color: 'text-orange-400' },
  vip_booking_cancelled: { label: 'VIP Cancelled', icon: Star, color: 'text-purple-400' },
  new_customer: { label: 'New Customer', icon: User, color: 'text-blue-400' },
  simple_inquiry: { label: 'Simple Inquiry', icon: HelpCircle, color: 'text-green-400' },
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
  4: 'bg-blue-500',
  5: 'bg-green-500',
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'CRITICAL',
  2: 'HIGH',
  3: 'MEDIUM',
  4: 'LOW',
  5: 'AUTO',
}

const ACTION_BADGES: Record<string, { label: string; color: string }> = {
  resolve: { label: 'Resolve', color: 'bg-green-500/20 text-green-300' },
  escalate: { label: 'Escalate', color: 'bg-red-500/20 text-red-300' },
  assign: { label: 'Assign', color: 'bg-blue-500/20 text-blue-300' },
}

export function RequestCard({
  request,
  decision,
  selected,
  onClick,
}: {
  request: Request
  decision: TriageDecision
  selected: boolean
  onClick: () => void
}) {
  const config = TYPE_CONFIG[request.type]

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 animate-slide-up ${
        selected
          ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_12px_rgba(96,165,250,0.15)]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-gray-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {config && <config.icon className={`w-4 h-4 shrink-0 ${config.color}`} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{request.customer_name}</span>
              {request.customer_tier === 'vip' && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{request.summary}</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${selected ? 'text-blue-400' : 'text-gray-600'}`} />
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white ${PRIORITY_COLORS[decision.priority]}`}>
          P{decision.priority} {PRIORITY_LABELS[decision.priority]}
        </div>

        <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ACTION_BADGES[decision.ai_action]?.color || ''}`}>
          {ACTION_BADGES[decision.ai_action]?.label || decision.ai_action}
        </div>

        {decision.automated && (
          <div className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300">
            AUTO
          </div>
        )}

        {decision.requires_human && (
          <div className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-300">
            HUMAN
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <div className="w-14 h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                decision.confidence > 80 ? 'bg-green-500' : decision.confidence > 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${decision.confidence}%` }}
            />
          </div>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{decision.confidence}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        {decision.assign_to && (
          <span className="text-[10px] text-blue-300/70">
            → {decision.assign_to.replace('_', ' ')}
          </span>
        )}
        {decision.automated && (
          <span className="text-[10px] text-green-300/70">→ No staff needed</span>
        )}
      </div>
    </button>
  )
}
