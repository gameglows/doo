'use client'

import { ScrollText, Zap, AlertTriangle, CheckCircle2, Mail, MailX } from 'lucide-react'
import type { WorkflowLogEntry } from '@/lib/types'

const ICONS: Record<string, typeof Zap> = {
  auto_resolve: Zap,
  escalate: AlertTriangle,
  resolve: CheckCircle2,
  email_sent: Mail,
  email_failed: MailX,
}

const COLORS: Record<string, string> = {
  auto_resolve: 'text-green-400',
  escalate: 'text-red-400',
  resolve: 'text-blue-400',
  email_sent: 'text-amber-400',
  email_failed: 'text-red-400',
}

export function WorkflowLog({ logs }: { logs: WorkflowLogEntry[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ScrollText className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Workflow Log</h2>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
        {logs.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] px-1">No workflow events yet</p>
        )}

        {logs.map((log, i) => {
          const Icon = ICONS[log.action] || ScrollText
          const color = COLORS[log.action] || 'text-gray-400'

          return (
            <div
              key={log.id || `log-${i}`}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] animate-slide-up"
            >
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium capitalize">
                  {log.action.replace(/_/g, ' ')}
                  {log.automated && <span className="text-green-400 ml-1">⚡ auto</span>}
                </p>
                {log.details && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed mt-0.5">
                    {log.details}
                  </p>
                )}
                {log.created_at && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
