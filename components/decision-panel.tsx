'use client'

import { useState } from 'react'
import {
  Shield,
  AlertTriangle,
  BrainCircuit,
  MessageSquare,
  ArrowRight,
  Ban,
  CheckCircle2,
  Zap,
  Mail,
  Send,
  Loader2,
} from 'lucide-react'
import type { Request, TriageDecision } from '@/lib/types'

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical — Act Now', color: 'text-red-400' },
  2: { label: 'High — Handle Promptly', color: 'text-orange-400' },
  3: { label: 'Medium — Queue', color: 'text-amber-400' },
  4: { label: 'Low — Routine', color: 'text-blue-400' },
  5: { label: 'Auto — No Human Needed', color: 'text-green-400' },
}

const ACTION_DETAILS: Record<string, { icon: typeof Shield; label: string; color: string; description: string }> = {
  resolve: { icon: CheckCircle2, label: 'AI Can Resolve', color: 'text-green-400', description: 'This request can be fully handled by AI with no staff involvement.' },
  escalate: { icon: AlertTriangle, label: 'Escalate Required', color: 'text-red-400', description: 'This request exceeds AI authority. Must be handled by a human (manager).' },
  assign: { icon: ArrowRight, label: 'Assign to Staff', color: 'text-blue-400', description: 'AI recommends routing to a specific team member for handling.' },
}

export function DecisionPanel({
  request,
  decision,
  managerEmail,
  onSendEmail,
  sendingEmail,
}: {
  request: Request | null
  decision: TriageDecision | null
  managerEmail?: string
  onSendEmail?: (customerName: string, refundAmount: number | null, suggestedResponse: string) => Promise<void>
  sendingEmail?: boolean
}) {
  const [emailSent, setEmailSent] = useState(false)
  if (!request || !decision) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <BrainCircuit className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a request from the queue to see the AI decision</p>
      </div>
    )
  }

  const priorityInfo = PRIORITY_LABELS[decision.priority]
  const actionInfo = ACTION_DETAILS[decision.ai_action]

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">AI Decision Engine</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Triage result for {request.customer_name}</p>
      </div>

      {/* Priority Badge */}
      <div className={`px-3 py-2 rounded-lg border ${
        decision.priority <= 2 ? 'border-red-500/30 bg-red-500/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Priority Level</span>
          <span className={`text-sm font-bold ${priorityInfo?.color}`}>
            P{decision.priority}
          </span>
        </div>
        <p className={`text-xs font-medium mt-0.5 ${priorityInfo?.color}`}>{priorityInfo?.label}</p>
      </div>

      {/* Action */}
      <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2">
          {actionInfo && <actionInfo.icon className={`w-4 h-4 ${actionInfo.color}`} />}
          <div>
            <p className="text-sm font-medium">{actionInfo?.label}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{actionInfo?.description}</p>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">AI Confidence</span>
          <span className="text-sm font-bold">{decision.confidence}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              decision.confidence > 80 ? 'bg-green-500' : decision.confidence > 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${decision.confidence}%` }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2 mb-1">
          <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Why This Decision?</span>
        </div>
        <p className="text-xs leading-relaxed text-gray-300">{decision.reasoning}</p>
      </div>

      {/* Suggested Response */}
      <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Suggested Response</span>
        </div>
        <p className="text-xs leading-relaxed text-gray-300">{decision.suggested_response}</p>
      </div>

      {/* Suggested Action */}
      <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Next Action</span>
        </div>
        <p className="text-xs leading-relaxed text-gray-300">{decision.suggested_action}</p>
      </div>

      {/* Assignment */}
      {decision.assign_to && (
        <div className="px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Assigned to</span>
          <p className="text-sm font-medium mt-0.5 capitalize">{decision.assign_to.replace('_', ' ')}</p>
        </div>
      )}

      {/* Email Sent Status + Send Button (for refund escalations) */}
      {decision.ai_action === 'escalate' && decision.assign_to === 'manager' && (
        <div className="px-3 py-3 rounded-lg border-2 border-amber-500/50 bg-amber-500/15 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            {emailSent ? (
              <Send className="w-4 h-4 text-green-400" />
            ) : (
              <Mail className="w-4 h-4 text-amber-400" />
            )}
            <span className={`text-xs font-bold uppercase tracking-wider ${emailSent ? 'text-green-300' : 'text-amber-300'}`}>
              {emailSent ? 'Email Sent to Manager' : '⚠️ AI Cannot Act — Manager Required'}
            </span>
          </div>
          <p className="text-xs text-amber-200/80">
            Refund ${request?.refund_amount} exceeds the ${decision.priority === 1 ? '500' : '500'} auto-approval limit.
            {emailSent
              ? ` Notification sent to ${managerEmail}.`
              : ' Send an email to the manager for approval.'}
          </p>
          <button
            onClick={async () => {
              if (onSendEmail && request) {
                await onSendEmail(request.customer_name, request.refund_amount ?? null, decision.suggested_response)
                setEmailSent(true)
              }
            }}
            disabled={sendingEmail || emailSent}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              emailSent
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
            } disabled:opacity-50`}
          >
            {sendingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : emailSent ? (
              <Send className="w-3.5 h-3.5" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            {sendingEmail ? 'Sending...' : emailSent ? 'Sent to Manager' : 'Send Refund Email to Manager'}
          </button>
        </div>
      )}

      {/* Edge Case Banner */}
      {decision.requires_human && decision.ai_action !== 'escalate' && (
        <div className="px-3 py-3 rounded-lg border-2 border-red-500/50 bg-red-500/15">
          <div className="flex items-center gap-2 mb-1">
            <Ban className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider">⚠️ AI Cannot Act</span>
          </div>
          <p className="text-xs text-red-200/80">
            This request requires a human decision. The AI has prepared the analysis above,
            but the final action must be taken by staff or manager. Do not rely on AI for this.
          </p>
        </div>
      )}

      {/* Auto badge */}
      {decision.automated && (
        <div className="px-3 py-3 rounded-lg border-2 border-green-500/50 bg-green-500/15">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-green-300 uppercase tracking-wider">Automated Workflow</span>
          </div>
          <p className="text-xs text-green-200/80">
            This request has been fully resolved by AI. No staff action needed. Check the workflow log for details.
          </p>
        </div>
      )}
    </div>
  )
}
