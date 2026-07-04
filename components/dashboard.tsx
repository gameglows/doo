'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, RefreshCw, Mail } from 'lucide-react'
import type { TriageOutput, StaffState } from '@/lib/types'
import { StaffPanel } from './staff-panel'
import { RequestQueue } from './request-queue'
import { DecisionPanel } from './decision-panel'
import { WorkflowLog } from './workflow-log'

const INITIAL_STAFF: StaffState = {
  available: 2,
  total: 2,
  approved_slots: 3,
  approved_slots_total: 3,
}

export function Dashboard() {
  const [output, setOutput] = useState<TriageOutput | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [managerEmail, setManagerEmail] = useState('daredevilipc@gmail.com')
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const handleSendEmail = useCallback(async (customerName: string, refundAmount: number | null, suggestedResponse: string) => {
    setSendingEmail(true)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: managerEmail,
          subject: `[URGENT] Manager Approval Needed: ${customerName} — Refund $${refundAmount}`,
          html: `
            <h2>Manager Approval Required</h2>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Refund Amount:</strong> $${refundAmount}</p>
            <hr>
            <p><strong>AI Suggested Response:</strong></p>
            <blockquote>${suggestedResponse}</blockquote>
            <p><strong>Action Needed:</strong> Approve or deny this refund from the dashboard.</p>
          `,
        }),
      })
      const result = await res.json()
      alert(result.detail)
      return result
    } catch (err) {
      alert('Failed to send email: ' + String(err))
    } finally {
      setSendingEmail(false)
    }
  }, [managerEmail])

  const runTriage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate: true,
          manager_email: managerEmail,
          staff_state: INITIAL_STAFF,
        }),
      })
      const data: TriageOutput = await res.json()
      setOutput(data)
      if (data.priority_queue.length > 0) {
        setSelectedId(data.priority_queue[0].request.id)
      }
    } catch (err) {
      console.error('Triage error:', err)
    } finally {
      setLoading(false)
    }
  }, [managerEmail])

  useEffect(() => {
    runTriage()
  }, [runTriage])

  const selectedPair = output?.priority_queue.find((p) => p.request.id === selectedId)

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">Busy Business</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">AI Triage Decision Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Email Settings */}
          <div className="relative">
            <button
              onClick={() => setShowEmailInput(!showEmailInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-300 border border-[hsl(var(--border))] hover:bg-gray-700 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {managerEmail}
            </button>
            {showEmailInput && (
              <div className="absolute right-0 top-full mt-2 z-10 w-72 p-3 rounded-lg border border-[hsl(var(--border))] bg-gray-900 shadow-xl">
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Manager email for refund approvals:</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={managerEmail}
                    onChange={(e) => setManagerEmail(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded-md bg-gray-800 border border-[hsl(var(--border))] text-white placeholder-gray-500 focus:outline-none focus:border-blue-400"
                    placeholder="manager@example.com"
                  />
                  <button
                    onClick={() => {
                      setShowEmailInput(false)
                      runTriage()
                    }}
                    className="px-2 py-1.5 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Re-run */}
          <button
            onClick={runTriage}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Re-run Triage
          </button>
        </div>
      </div>

      {/* Staff Panel */}
      {output && <StaffPanel staff={output.staff_state} />}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Generating + triaging requests...</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      {!loading && output && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Queue */}
          <div className="lg:col-span-5 space-y-4">
            <RequestQueue
              pairs={output.priority_queue}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <WorkflowLog logs={output.workflow_logs} />
          </div>

          {/* Right: Decision Panel */}
          <div className="lg:col-span-7">
            <div className="sticky top-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 min-h-[400px]">
              {selectedPair ? (
                <DecisionPanel
                  request={selectedPair.request}
                  decision={selectedPair.decision}
                  managerEmail={managerEmail}
                  onSendEmail={handleSendEmail}
                  sendingEmail={sendingEmail}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-[hsl(var(--muted-foreground))]">
                  Select a request to view decision
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
