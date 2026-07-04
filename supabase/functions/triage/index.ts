import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

/* ─── Types ─── */

interface RequestRecord {
  id: string
  type: string
  customer_name: string
  customer_tier: string
  amount: number | null
  summary: string
  sentiment: string
  refund_required: boolean
  refund_amount: number | null
  status: string
  created_at: string
}

interface StaffState {
  available: number
  total: number
  approved_slots: number
  approved_slots_total: number
}

interface TriageDecision {
  id: string
  request_id: string
  priority: number
  ai_action: string
  assign_to: string | null
  suggested_action: string
  suggested_response: string
  automated: boolean
  requires_human: boolean
  confidence: number
  reasoning: string
  created_at: string
}

interface WorkflowLog {
  id?: string
  request_id: string | null
  action: string
  details: string | null
  automated: boolean
  created_at?: string
}

/* ─── Constants ─── */

const REFUND_LIMIT = 500
const DEEPSEEK_MODEL = 'deepseek-v4-flash'

/* ─── Deterministic Generator ─── */

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack']
const LAST_NAMES = ['Smith', 'Jones', 'Lee', 'Garcia', 'Brown', 'Wilson', 'Taylor', 'Thomas', 'White', 'Harris']

const REQUEST_TEMPLATES = [
  {
    type: 'angry_double_charge',
    tier: 'regular' as const,
    sentiment: 'angry' as const,
    refund_required: true,
    genAmount: () => Math.random() > 0.3 ? Math.floor(Math.random() * 150) + 50 : Math.floor(Math.random() * 400) + 600,
    summary: (n: string, a: number) => `I was charged ${a} twice! Fix this NOW!`,
  },
  {
    type: 'urgent_bad_review',
    tier: 'regular' as const,
    sentiment: 'urgent' as const,
    refund_required: false,
    genAmount: () => null,
    summary: (n: string) => `Worst experience ever. I'm posting bad reviews everywhere if you don't fix this.`,
  },
  {
    type: 'vip_booking_cancelled',
    tier: 'vip' as const,
    sentiment: 'urgent' as const,
    refund_required: false,
    genAmount: () => Math.floor(Math.random() * 400) + 200,
    summary: (n: string) => `My VIP booking was cancelled without notice. I'm a loyal customer — fix this immediately.`,
  },
  {
    type: 'new_customer',
    tier: 'new' as const,
    sentiment: 'neutral' as const,
    refund_required: false,
    genAmount: () => null,
    summary: (n: string) => `Hi, I'd like to learn about your services and pricing.`,
  },
  {
    type: 'simple_inquiry',
    tier: 'regular' as const,
    sentiment: 'neutral' as const,
    refund_required: false,
    genAmount: () => null,
    summary: (n: string) => Math.random() > 0.5
      ? 'What are your business hours?'
      : 'What is your return policy and how long do refunds take?',
  },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRequests(): RequestRecord[] {
  const usedNames = new Set<string>()

  return REQUEST_TEMPLATES.map((tpl) => {
    let name: string
    do {
      name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    } while (usedNames.has(name))
    usedNames.add(name)

    const amount = tpl.genAmount()

    return {
      id: crypto.randomUUID(),
      type: tpl.type,
      customer_name: name,
      customer_tier: tpl.tier,
      amount: amount as number | null,
      summary: tpl.summary(name, amount as number),
      sentiment: tpl.sentiment,
      refund_required: tpl.refund_required,
      refund_amount: tpl.refund_required ? (amount as number) : null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
  })
}

/* ─── AI Generator ─── */

async function generateRequestsWithAI(deepseekKey: string): Promise<RequestRecord[]> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a customer support scenario generator. Return ONLY valid JSON. No markdown.',
        },
        {
          role: 'user',
          content: `Generate 5 realistic customer support requests for a busy business. Each must have a different type from this list: angry_double_charge, urgent_bad_review, vip_booking_cancelled, new_customer, simple_inquiry.

Rules:
- angry_double_charge: customer is ANGRY, refund_required=true, refund_amount between 50-400
- urgent_bad_review: customer is URGENT, refund_required=false
- vip_booking_cancelled: customer_tier=vip, sentiment=urgent, refund_required=false
- new_customer: customer_tier=new, sentiment=neutral, refund_required=false
- simple_inquiry: sentiment=neutral, refund_required=false

Return a JSON array of objects with these exact fields:
{
  "customer_name": "First Last",
  "type": "one of the 5 types",
  "customer_tier": "vip"|"regular"|"new",
  "summary": "a realistic 1-sentence complaint or inquiry",
  "sentiment": "angry"|"urgent"|"neutral",
  "refund_required": true|false,
  "refund_amount": number|null,
  "amount": number|null
}

Make each generation unique — use different names, scenarios, and amounts.`,
        },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek generation failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty AI generation response')

  const parsed = JSON.parse(content)
  const list = Array.isArray(parsed) ? parsed : parsed.requests || []

  return list.map((r: any) => ({
    id: crypto.randomUUID(),
    type: r.type,
    customer_name: r.customer_name,
    customer_tier: r.customer_tier || 'regular',
    amount: r.amount ?? null,
    summary: r.summary,
    sentiment: r.sentiment,
    refund_required: r.refund_required ?? false,
    refund_amount: r.refund_amount ?? null,
    status: 'pending' as const,
    created_at: new Date().toISOString(),
  }))
}

/* ─── AI Triage ─── */

async function triageWithAI(
  requests: RequestRecord[],
  deepseekKey: string,
  staffAvailable: number
): Promise<TriageDecision[]> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a customer support triage AI. Analyze each request and return decisions.

HARD RULES (you MUST follow these, they OVERRIDE your judgment):
1. If refund_amount > ${REFUND_LIMIT}: ai_action MUST be "escalate", assign_to MUST be "manager", requires_human MUST be true, automated MUST be false
2. VIP customers (customer_tier="vip"): priority gets boosted by 1 (lower number = higher priority, so subtract 1, min 1)
3. Simple FAQ inquiries (type="simple_inquiry"): can be auto-resolved (automated=true, ai_action="resolve")
4. Only ${staffAvailable} staff available (staff_1, staff_2). When assigning, assign the highest priority items first to available staff, then queue the rest.
5. If sentiment is "angry" or "urgent", it likely requires human handling

Return ONLY valid JSON. No markdown.`,
        },
        {
          role: 'user',
          content: `Triage these ${requests.length} customer requests. For each one, decide:
- priority (1-5, 1=highest)
- ai_action: "resolve" | "escalate" | "assign"
- assign_to: "staff_1" | "staff_2" | "manager" | "queue" | null
- suggested_action: a brief specific action description (1 sentence, unique to this request)
- suggested_response: a unique empathetic response to send to the customer (2-3 sentences, DO NOT copy this message, write fresh)
- automated: true or false
- requires_human: true or false 
- confidence: 0-100
- reasoning: detailed explanation of why you made this decision (2-3 sentences, be specific about this customer and their issue)

Return JSON with key "decisions" containing an array matching each request by request_id:

{
  "decisions": [
    {
      "request_id": "the exact id from below",
      "priority": 1-5,
      "ai_action": "resolve" | "escalate" | "assign",
      "assign_to": "staff_1" | "staff_2" | "manager" | "queue" | null,
      "suggested_action": "unique action string",
      "suggested_response": "unique response string",
      "automated": true/false,
      "requires_human": true/false,
      "confidence": 0-100,
      "reasoning": "unique detailed reasoning"
    }
  ]
}

REQUESTS:
${JSON.stringify(requests.map((r) => ({
  request_id: r.id,
  customer_name: r.customer_name,
  type: r.type,
  customer_tier: r.customer_tier,
  summary: r.summary,
  sentiment: r.sentiment,
  refund_required: r.refund_required,
  refund_amount: r.refund_amount,
})), null, 2)}`,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek triage failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty AI triage response')

  const parsed = JSON.parse(content)
  const decisionsList = Array.isArray(parsed) ? parsed : parsed.decisions || []
  const now = new Date().toISOString()

  return decisionsList.map((d: any) => {
    const req = requests.find((r) => r.id === d.request_id)
    const refundExceedsLimit = req?.refund_required && req?.refund_amount !== null && req?.refund_amount > REFUND_LIMIT

    // Hard override: refund > limit MUST escalate
    if (refundExceedsLimit) {
      return {
        id: crypto.randomUUID(),
        request_id: d.request_id,
        priority: d.priority || 1,
        ai_action: 'escalate',
        assign_to: 'manager',
        suggested_action: d.suggested_action || 'Process refund escalation',
        suggested_response: d.suggested_response || 'Your refund requires manager approval.',
        automated: false,
        requires_human: true,
        confidence: 89,
        reasoning: `[OVERRIDE] Refund of $${req?.refund_amount} exceeds $${REFUND_LIMIT} limit. AI blocked — mandatory manager escalation. Email sent.`,
        created_at: now,
      }
    }

    return {
      id: crypto.randomUUID(),
      request_id: d.request_id,
      priority: d.priority || 5,
      ai_action: d.ai_action || 'assign',
      assign_to: d.assign_to || null,
      suggested_action: d.suggested_action || 'Handle request',
      suggested_response: d.suggested_response || 'We are looking into this.',
      automated: d.automated ?? false,
      requires_human: d.requires_human ?? true,
      confidence: d.confidence ?? 50,
      reasoning: d.reasoning || 'AI triage decision.',
      created_at: now,
    }
  })
}

/* ─── Rules Fallback ─── */

const PRIORITY_MATRIX: Record<string, {
  base_priority: number
  requires_human: boolean
  can_auto_resolve: boolean
  suggested_action: string
  suggested_response: string
}> = {
  angry_double_charge: {
    base_priority: 1,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Verify duplicate charges, prepare refund, escalate if over limit',
    suggested_response: "I'm so sorry about this — being charged twice is our mistake. I'll process the refund immediately. If it exceeds our limit, I'll escalate to my manager for instant approval.",
  },
  urgent_bad_review: {
    base_priority: 2,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Acknowledge urgency, identify root issue, offer solution',
    suggested_response: "I hear you and understand your frustration. Let me personally investigate and find a solution right now.",
  },
  vip_booking_cancelled: {
    base_priority: 3,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Check VIP status, offer priority rebooking with compensation',
    suggested_response: "I sincerely apologize as a valued VIP customer. I see we have priority slots — let me rebook you immediately with a complimentary upgrade.",
  },
  new_customer: {
    base_priority: 4,
    requires_human: false,
    can_auto_resolve: false,
    suggested_action: 'Welcome, gather requirements, queue for sales',
    suggested_response: "Welcome! We're excited to have you. Our team will reach out shortly. Anything specific you'd like to know?",
  },
  simple_inquiry: {
    base_priority: 5,
    requires_human: false,
    can_auto_resolve: true,
    suggested_action: 'Auto-resolve from KB, send response, close',
    suggested_response: "Thanks for reaching out! Here's what you need to know. If you have other questions, we're here to help!",
  },
}

function makeDecision(req: RequestRecord): TriageDecision {
  const config = PRIORITY_MATRIX[req.type] || PRIORITY_MATRIX.simple_inquiry
  let priority = config.base_priority
  if (req.customer_tier === 'vip') priority = Math.max(1, priority - 1)

  const refundExceedsLimit = req.refund_required && req.refund_amount !== null && req.refund_amount > REFUND_LIMIT
  const requiresHuman = config.requires_human || !!refundExceedsLimit
  const canAuto = config.can_auto_resolve && !requiresHuman

  let aiAction: string
  let assignTo: string | null
  let confidence: number
  let reasoning: string

  if (refundExceedsLimit) {
    aiAction = 'escalate'
    assignTo = 'manager'
    confidence = 89
    reasoning = `Refund of $${req.refund_amount} exceeds $${REFUND_LIMIT} limit. Manager approval required. AI cannot process. Email notification sent to manager.`
  } else if (canAuto) {
    aiAction = 'resolve'
    assignTo = null
    confidence = 97
    reasoning = 'Simple inquiry — matched to KB. Auto-resolution.'
  } else if (req.sentiment === 'angry' || req.sentiment === 'urgent') {
    aiAction = 'assign'
    assignTo = null
    confidence = 82
    reasoning = req.sentiment === 'angry' ? 'Angry customer — needs empathetic handling.' : 'Urgent issue — immediate attention.'
  } else {
    aiAction = 'assign'
    assignTo = null
    confidence = 92
    reasoning = 'Standard request — assigned to queue.'
  }

  return {
    id: crypto.randomUUID(),
    request_id: req.id,
    priority,
    ai_action: aiAction,
    assign_to: assignTo,
    suggested_action: config.suggested_action,
    suggested_response: config.suggested_response,
    automated: canAuto,
    requires_human: requiresHuman,
    confidence,
    reasoning,
    created_at: new Date().toISOString(),
  }
}

function assignStaff(
  pairs: { request: RequestRecord; decision: TriageDecision }[],
  available: number
): TriageDecision[] {
  const staffNames = ['staff_1', 'staff_2']
  let remaining = available

  return pairs.map(({ decision }) => {
    const d = { ...decision }
    if (d.automated) d.assign_to = null
    else if (d.ai_action === 'escalate') d.assign_to = 'manager'
    else if (d.ai_action === 'assign') {
      if (remaining > 0) {
        d.assign_to = staffNames[staffNames.length - remaining]
        remaining--
      } else {
        d.assign_to = 'queue'
        d.reasoning += ' No staff available — placed in queue.'
      }
    }
    return d
  })
}

/* ─── Email Sending ─── */

async function sendEmail(options: {
  to: string
  subject: string
  html: string
}): Promise<{ sent: boolean; method: string; detail: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY')

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Busy Business <onboarding@resend.dev>',
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      })

      if (res.ok) {
        return { sent: true, method: 'resend', detail: `Email sent to ${options.to} via Resend.` }
      }
      const body = await res.text()
      return { sent: false, method: 'resend', detail: `Resend error ${res.status}: ${body}` }
    } catch (err) {
      return { sent: false, method: 'resend', detail: `Resend error: ${String(err)}` }
    }
  }

  // Simulation fallback
  return {
    sent: true,
    method: 'simulated',
    detail: `[SIMULATED] Email to ${options.to}: ${options.subject}`,
  }
}

/* ─── Main Handler ─── */

serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    const { generate, manager_email, staff_state } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const managerEmail = manager_email || 'daredevilipc@gmail.com'
    const state = staff_state || { available: 2, total: 2, approved_slots: 3, approved_slots_total: 3 }

    /* ─── Step 1: Generate requests ─── */

    let incoming: RequestRecord[]
    if (generate) {
      if (deepseekKey) {
        try {
          incoming = await generateRequestsWithAI(deepseekKey)
        } catch (err) {
          console.warn('AI generation failed, using deterministic:', err)
          incoming = generateRequests()
        }
      } else {
        incoming = generateRequests()
      }
    } else if (body.requests && Array.isArray(body.requests)) {
      incoming = body.requests.map((r: any) => ({
        ...r,
        id: r.id || crypto.randomUUID(),
        created_at: r.created_at || new Date().toISOString(),
      }))
    } else {
      incoming = generateRequests()
    }

    /* ─── Step 2: INSERT requests into Supabase ─── */

    const insertedIds: string[] = []
    for (const req of incoming) {
      const { data, error } = await supabase
        .from('requests')
        .insert({
          id: req.id,
          type: req.type,
          customer_name: req.customer_name,
          customer_tier: req.customer_tier,
          amount: req.amount,
          summary: req.summary,
          sentiment: req.sentiment,
          refund_required: req.refund_required,
          refund_amount: req.refund_amount,
          status: 'pending',
        })
        .select('id')
        .single()

      if (error) {
        console.error('Insert request error:', error)
      } else if (data) {
        insertedIds.push(data.id)
      }
    }

    // Re-insert: use the generated IDs from DB if we got them, else fallback
    const validRequests = incoming.filter((r) => insertedIds.includes(r.id) || 1) // always true since we use generated IDs
    const requestIdSet = new Set(insertedIds)

    /* ─── Step 3: Run triage (AI first, rules fallback) ─── */

    let rawDecisions: TriageDecision[]
    if (deepseekKey) {
      try {
        rawDecisions = await triageWithAI(incoming, deepseekKey, state.available)
      } catch (err) {
        console.warn('AI triage failed, using rules fallback:', err)
        rawDecisions = incoming.map((req) => makeDecision(req))
      }
    } else {
      rawDecisions = incoming.map((req) => makeDecision(req))
    }

    // Sort by priority for staff assignment
    const sorted = [...rawDecisions].sort((a, b) => a.priority - b.priority)
    const paired = sorted.map((d) => ({
      request: incoming.find((r) => r.id === d.request_id)!,
      decision: d,
    }))

    const decisions = assignStaff(paired, state.available)
    const workflowLogs: WorkflowLog[] = []

    /* ─── Step 4: Store decisions + send emails + log workflows ─── */

    for (let i = 0; i < decisions.length; i++) {
      const d = decisions[i]
      const req = incoming.find((r) => r.id === d.request_id)

      // INSERT decision
      const { error: decErr } = await supabase.from('triage_decisions').insert({
        request_id: d.request_id,
        priority: d.priority,
        ai_action: d.ai_action,
        assign_to: d.assign_to,
        suggested_action: d.suggested_action,
        suggested_response: d.suggested_response,
        automated: d.automated,
        requires_human: d.requires_human,
        confidence: d.confidence,
        reasoning: d.reasoning,
      })
      if (decErr) console.error('Insert decision error:', decErr)

      // UPDATE request status
      const newStatus = d.automated ? 'auto_resolved' : d.ai_action === 'escalate' ? 'escalated' : 'in_progress'
      const { error: statusErr } = await supabase.from('requests').update({ status: newStatus }).eq('id', d.request_id)
      if (statusErr) console.error('Update status error:', statusErr)

      // Auto-resolve workflow log
      if (d.automated) {
        workflowLogs.push({
          request_id: d.request_id,
          action: 'auto_resolve',
          details: `${req?.customer_name}'s ${req?.type?.replace(/_/g, ' ')} was auto-resolved via knowledge base.`,
          automated: true,
        })
      }

      // Escalate workflow log + email
      if (d.ai_action === 'escalate') {
        workflowLogs.push({
          request_id: d.request_id,
          action: 'escalate',
          details: d.reasoning,
          automated: false,
        })

        // Send email to manager for each escalated refund
        const emailResult = await sendEmail({
          to: managerEmail,
          subject: `[URGENT] Manager Approval Needed: ${req?.customer_name} — Refund $${req?.refund_amount}`,
          html: `
            <h2>Manager Approval Required</h2>
            <p><strong>Customer:</strong> ${req?.customer_name}</p>
            <p><strong>Issue:</strong> ${req?.type?.replace(/_/g, ' ')}</p>
            <p><strong>Refund Amount:</strong> $${req?.refund_amount}</p>
            <p><strong>Reason:</strong> Exceeds $${REFUND_LIMIT} auto-approval limit.</p>
            <hr>
            <p><strong>AI Suggested Response:</strong></p>
            <blockquote>${d.suggested_response}</blockquote>
            <p><strong>Action Needed:</strong> Approve or deny this refund from the dashboard.</p>
          `,
        })

        workflowLogs.push({
          request_id: d.request_id,
          action: emailResult.sent ? 'email_sent' : 'email_failed',
          details: emailResult.detail,
          automated: true,
        })
      }
    }

    /* ─── Step 5: Store workflow logs in Supabase ─── */

    for (const log of workflowLogs) {
      const { error: logErr } = await supabase.from('workflow_log').insert({
        request_id: log.request_id,
        action: log.action,
        details: log.details,
        automated: log.automated,
      })
      if (logErr) console.error('Insert log error:', logErr)
    }

    /* ─── Step 6: Build response ─── */

    const decisionMap = new Map(decisions.map((d) => [d.request_id, d]))
    const priorityQueue = incoming
      .filter((r) => requestIdSet.size === 0 || requestIdSet.has(r.id))
      .map((r) => ({ request: r, decision: decisionMap.get(r.id)! }))
      .sort((a, b) => a.decision.priority - b.decision.priority)

    return new Response(
      JSON.stringify({
        decisions,
        priority_queue: priorityQueue,
        workflow_logs: workflowLogs,
        staff_state: state,
      }),
      { status: 200, headers }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers })
  }
})
