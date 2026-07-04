import { NextRequest, NextResponse } from 'next/server'
import { runTriage } from '@/lib/triage-engine'
import type { Request } from '@/lib/types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/triage`

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack']
const LAST_NAMES = ['Smith', 'Jones', 'Lee', 'Garcia', 'Brown', 'Wilson', 'Taylor', 'Thomas', 'White', 'Harris']
const TIERS = ['regular', 'regular', 'regular', 'vip', 'new'] as const

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateLocalRequests(): Request[] {
  const usedNames = new Set<string>()
  const templates: Array<{
    type: Request['type']
    tier: Request['customer_tier']
    sentiment: Request['sentiment']
    refund_required: boolean
    genAmount: () => number | null
    summary: (n: string, a: number) => string
  }> = [
    {
      type: 'angry_double_charge', tier: 'regular', sentiment: 'angry', refund_required: true,
      genAmount: () => Math.random() > 0.3 ? Math.floor(Math.random() * 150) + 50 : Math.floor(Math.random() * 400) + 600,
      summary: (n, a) => `I was charged $${a} twice! Refund me NOW.`,
    },
    {
      type: 'urgent_bad_review', tier: 'regular', sentiment: 'urgent', refund_required: false,
      genAmount: () => null,
      summary: () => `Terrible service. I'll post bad reviews everywhere if this isn't fixed today.`,
    },
    {
      type: 'vip_booking_cancelled', tier: 'vip', sentiment: 'urgent', refund_required: false,
      genAmount: () => Math.floor(Math.random() * 400) + 200,
      summary: () => `My VIP booking was cancelled. I need this fixed immediately.`,
    },
    {
      type: 'new_customer', tier: 'new', sentiment: 'neutral', refund_required: false,
      genAmount: () => null,
      summary: () => `Hi, I'd like to learn about your premium services.`,
    },
    {
      type: 'simple_inquiry', tier: 'regular', sentiment: 'neutral', refund_required: false,
      genAmount: () => null,
      summary: () => Math.random() > 0.5 ? 'What are your business hours?' : 'What is your return policy?',
    },
  ]

  return templates.map((tpl) => {
    let name: string
    do { name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` } while (usedNames.has(name))
    usedNames.add(name)
    const amount = tpl.genAmount()

    return {
      id: `local-${Math.random().toString(36).slice(2)}`,
      type: tpl.type,
      customer_name: name,
      customer_tier: tpl.tier,
      amount,
      summary: tpl.summary(name, amount ?? 0),
      sentiment: tpl.sentiment,
      refund_required: tpl.refund_required,
      refund_amount: tpl.refund_required ? amount : null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { generate, manager_email, staff_state, requests } = body

    const state = staff_state || {
      available: 2,
      total: 2,
      approved_slots: 3,
      approved_slots_total: 3,
    }

    // Try the deployed Edge Function first
    try {
      const payload: Record<string, unknown> = {
        staff_state: state,
        manager_email: manager_email || 'daredevilipc@gmail.com',
      }

      if (generate) {
        payload.generate = true
      } else if (requests && Array.isArray(requests)) {
        payload.requests = requests
      } else {
        payload.generate = true
      }

      const edgeRes = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      })

      if (edgeRes.ok) {
        const data = await edgeRes.json()
        if (data.workflow_logs) {
          data.workflow_logs = data.workflow_logs.map((log: any, i: number) => ({
            id: log.id || `edge-${i}`,
            request_id: log.request_id || null,
            action: log.action,
            details: log.details || null,
            automated: log.automated ?? false,
            created_at: log.created_at || new Date().toISOString(),
          }))
        }
        return NextResponse.json(data)
      }

      console.warn(`Edge Function returned ${edgeRes.status}, falling back to local engine`)
    } catch (edgeErr) {
      console.warn('Edge Function unreachable, falling back to local engine:', edgeErr)
    }

    // Fallback: generate locally + run rules engine
    const localRequests = generate
      ? generateLocalRequests()
      : (requests && Array.isArray(requests) ? requests : generateLocalRequests())

    const result = await runTriage(localRequests, state)

    // If we have a manager email, add simulated email log entries for escalations
    if (manager_email) {
      for (const pair of result.priority_queue) {
        if (pair.decision.ai_action === 'escalate' && pair.decision.assign_to === 'manager') {
          result.workflow_logs.push({
            id: `email-${Math.random().toString(36).slice(2)}`,
            request_id: pair.request.id,
            action: 'email_sent',
            details: `[SIMULATED] Notification sent to ${manager_email} requesting refund approval for ${pair.request.customer_name} ($${pair.request.refund_amount}).`,
            automated: true,
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Triage API error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
