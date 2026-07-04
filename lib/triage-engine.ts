import { BUSINESS_RULES, KB_ARTICLES, PRIORITY_MATRIX } from './business-rules'
import type {
  Request,
  TriageDecision,
  TriageOutput,
  WorkflowLogEntry,
  StaffState,
  StaffMember,
} from './types'

function randomId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function getKbAnswer(summary: string): string {
  const lower = summary.toLowerCase()
  if (lower.includes('hour') || lower.includes('open') || lower.includes('time')) return KB_ARTICLES.hours
  if (lower.includes('status') || lower.includes('track') || lower.includes('order')) return KB_ARTICLES.status
  if (lower.includes('payment') || lower.includes('pay') || lower.includes('card')) return KB_ARTICLES.payment
  if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange')) return KB_ARTICLES.return
  return KB_ARTICLES.default
}

function getRefundAction(request: Request): string {
  if (!request.refund_required) return 'none'
  if (request.refund_amount && request.refund_amount > BUSINESS_RULES.REFUND_APPROVAL_LIMIT) {
    return 'escalate_to_manager'
  }
  return 'process_refund'
}

/**
 * Computes the AI triage decision for a single request.
 * Does NOT assign staff — that happens in batch after priority sorting.
 */
function makeDecision(request: Request): TriageDecision {
  const config = PRIORITY_MATRIX[request.type]
  let priority = config.base_priority

  if (request.customer_tier === 'vip') priority = Math.max(BUSINESS_RULES.MAX_PRIORITY, priority - 1)

  const refundAction = getRefundAction(request)
  const requiresHuman = config.requires_human || refundAction === 'escalate_to_manager'
  const canAuto = config.can_auto_resolve && !requiresHuman

  let aiAction: 'resolve' | 'escalate' | 'assign'
  let assignTo: StaffMember | null
  let confidence: number
  let reasoning: string

  if (refundAction === 'escalate_to_manager') {
    aiAction = 'escalate'
    assignTo = 'manager'
    confidence = 89
    reasoning = `Refund of $${request.refund_amount} exceeds $${BUSINESS_RULES.REFUND_APPROVAL_LIMIT} limit. ` +
      `Mandatory manager approval required. AI cannot process this.`
  } else if (canAuto) {
    aiAction = 'resolve'
    assignTo = null
    confidence = 97
    reasoning = `Simple inquiry detected — matched to knowledge base. Auto-resolution confidence is high.`
  } else if (request.sentiment === 'angry' || request.sentiment === 'urgent') {
    aiAction = 'assign'
    assignTo = null
    confidence = 82
    reasoning =
      request.sentiment === 'angry'
        ? `Customer is angry — requires empathetic human handling. Will be assigned to available staff.`
        : `Urgent issue detected — requires immediate human attention. Will be assigned to available staff.`
  } else {
    aiAction = 'assign'
    assignTo = null
    confidence = 92
    reasoning = `Standard request — will be queued for staff handling.`
  }

  let responseText = config.suggested_response
  if (responseText.includes('{{kb_answer}}')) {
    responseText = responseText.replace('{{kb_answer}}', getKbAnswer(request.summary))
  }

  return {
    id: randomId(),
    request_id: request.id,
    priority,
    ai_action: aiAction,
    assign_to: assignTo,
    suggested_action: config.suggested_action,
    suggested_response: responseText,
    automated: canAuto,
    requires_human: requiresHuman,
    confidence,
    reasoning,
    created_at: new Date().toISOString(),
  }
}

/**
 * Assigns staff to the priority-sorted queue respecting availability.
 * Rules:
 *   - auto-resolved items need no staff
 *   - escalated items go to manager (not staff)
 *   - remaining items get assigned to staff_1, staff_2 in priority order
 *   - if no staff available, items stay unassigned (in queue)
 */
function assignStaff(
  paired: { request: Request; decision: TriageDecision }[],
  staffState: StaffState
): TriageDecision[] {
  const updated: TriageDecision[] = []
  let staffRemaining = staffState.available
  const staffNames: StaffMember[] = ['staff_1', 'staff_2']

  for (const { request, decision } of paired) {
    const d = { ...decision }

    if (d.automated) {
      d.assign_to = null
    } else if (d.ai_action === 'escalate') {
      d.assign_to = 'manager'
    } else if (d.ai_action === 'assign') {
      if (staffRemaining > 0) {
        const idx = staffState.available - staffRemaining
        d.assign_to = staffNames[idx] || 'staff_2'
        staffRemaining--
      } else {
        d.assign_to = 'queue'
        d.reasoning += ' No staff available — placed in queue.'
      }
    }

    updated.push(d)
  }

  return updated
}

export function runRulesEngine(
  requests: Request[],
  staffState: StaffState
): { decisions: TriageDecision[]; workflow_logs: WorkflowLogEntry[] } {
  const rawDecisions = requests.map((req) => makeDecision(req))
  const workflowLogs: WorkflowLogEntry[] = []

  // Sort by priority to assign staff correctly
  const sorted = [...rawDecisions].sort((a, b) => a.priority - b.priority)
  const paired = sorted.map((d) => ({
    request: requests.find((r) => r.id === d.request_id)!,
    decision: d,
  }))

  const decisions = assignStaff(paired, staffState)

  for (const d of decisions) {
    const req = requests.find((r) => r.id === d.request_id)

    if (d.automated) {
      workflowLogs.push({
        id: randomId(),
        request_id: d.request_id,
        action: 'auto_resolve',
        details: `${req?.customer_name}'s ${req?.type.replace(/_/g, ' ')} was auto-resolved via knowledge base.`,
        automated: true,
        created_at: new Date().toISOString(),
      })
    }

    if (d.ai_action === 'escalate') {
      workflowLogs.push({
        id: randomId(),
        request_id: d.request_id,
        action: 'escalate',
        details: d.reasoning,
        automated: false,
        created_at: new Date().toISOString(),
      })
    }
  }

  return { decisions, workflow_logs: workflowLogs }
}

export async function runAiEngine(
  requests: Request[],
  staffState: StaffState
): Promise<{ decisions: TriageDecision[]; workflow_logs: WorkflowLogEntry[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey || apiKey === 'sk-placeholder') {
    return runRulesEngine(requests, staffState)
  }

  try {
    const { default: OpenAI } = await import('openai')

    const openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    })

    const prompt = `You are a customer support triage AI for a busy business. Make fast, high-quality decisions.

STAFF CONSTRAINTS:
- 2 staff available (staff_1, staff_2)
- 3 approved slots remaining today
- Refunds over $${BUSINESS_RULES.REFUND_APPROVAL_LIMIT} REQUIRE manager approval — you MUST escalate

RULES:
- VIP customers get +1 priority boost (lower number = higher priority)
- Simple FAQ inquiries can be auto-resolved from KB
- Angry/urgent sentiment requires human review
- Do not over-assign staff — only 2 available
- If refund > $${BUSINESS_RULES.REFUND_APPROVAL_LIMIT}: action MUST be "escalate", assign_to MUST be "manager", requires_human MUST be true

Return a JSON object with key "decisions" containing an array. For each request, use the EXACT request_id. Keep the same array order.

{
  "decisions": [
    {
      "request_id": "exact id from input",
      "priority": 1-5,
      "ai_action": "resolve"|"escalate"|"assign",
      "assign_to": "staff_1"|"staff_2"|"manager"|"queue"|null,
      "suggested_action": "string",
      "suggested_response": "string",
      "automated": boolean,
      "requires_human": boolean,
      "confidence": 0-100,
      "reasoning": "string"
    }
  ]
}

REQUESTS (respond with decision for each, using the exact "id" field as request_id):
${JSON.stringify(requests, null, 2)}

STAFF: ${JSON.stringify(staffState)}`

    const response = await openai.chat.completions.create({
      model: 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a precise triage AI. Return ONLY valid JSON matching the schema exactly. No markdown, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty AI response')

    const parsed = JSON.parse(content)
    const decisionsList = Array.isArray(parsed) ? parsed : parsed.decisions || []

    const decisions: TriageDecision[] = []
    const workflowLogs: WorkflowLogEntry[] = []

    for (const d of decisionsList) {
      const req = requests.find((r) => r.id === d.request_id)
      if (!req) continue

      const decision: TriageDecision = {
        id: randomId(),
        request_id: req.id,
        priority: d.priority,
        ai_action: d.ai_action,
        assign_to: d.assign_to || null,
        suggested_action: d.suggested_action,
        suggested_response: d.suggested_response,
        automated: d.automated || false,
        requires_human: d.requires_human || false,
        confidence: d.confidence,
        reasoning: d.reasoning,
        created_at: new Date().toISOString(),
      }

      if (req.refund_required && req.refund_amount && req.refund_amount > BUSINESS_RULES.REFUND_APPROVAL_LIMIT) {
        decision.ai_action = 'escalate'
        decision.assign_to = 'manager'
        decision.requires_human = true
        decision.automated = false
        decision.confidence = 89
        decision.reasoning = `[OVERRIDE] Refund of $${req.refund_amount} exceeds $${BUSINESS_RULES.REFUND_APPROVAL_LIMIT} limit. AI cannot process. Mandatory manager escalation.`
      }

      decisions.push(decision)

      if (decision.automated) {
        workflowLogs.push({
          id: randomId(),
          request_id: req.id,
          action: 'auto_resolve',
          details: `${req.customer_name}'s ${req.type.replace(/_/g, ' ')} auto-resolved.`,
          automated: true,
          created_at: new Date().toISOString(),
        })
      }

      if (decision.ai_action === 'escalate') {
        workflowLogs.push({
          id: randomId(),
          request_id: req.id,
          action: 'escalate',
          details: decision.reasoning,
          automated: false,
          created_at: new Date().toISOString(),
        })
      }
    }

    return { decisions, workflow_logs: workflowLogs }
  } catch (err) {
    console.error('AI engine failed, falling back to rules:', err)
    return runRulesEngine(requests, staffState)
  }
}

export async function runTriage(
  requests: Request[],
  staffState: StaffState
): Promise<TriageOutput> {
  const { decisions, workflow_logs } = await runAiEngine(requests, staffState)

  const decisionMap = new Map(decisions.map((d) => [d.request_id, d]))

  const paired: { request: Request; decision: TriageDecision }[] = requests
    .filter((r) => decisionMap.has(r.id))
    .map((r) => ({ request: r, decision: decisionMap.get(r.id)! }))

  paired.sort((a, b) => {
    if (a.decision.priority !== b.decision.priority) return a.decision.priority - b.decision.priority
    return b.decision.confidence - a.decision.confidence
  })

  return {
    decisions,
    priority_queue: paired,
    workflow_logs,
    staff_state: staffState,
  }
}
