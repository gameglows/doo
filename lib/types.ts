export type RequestType =
  | 'vip_booking_cancelled'
  | 'new_customer'
  | 'angry_double_charge'
  | 'simple_inquiry'
  | 'urgent_bad_review'

export type CustomerTier = 'vip' | 'regular' | 'new'
export type Sentiment = 'angry' | 'neutral' | 'urgent'
export type AiAction = 'resolve' | 'escalate' | 'assign'
export type RequestStatus = 'pending' | 'in_progress' | 'resolved' | 'escalated' | 'auto_resolved'
export type StaffMember = 'staff_1' | 'staff_2' | 'manager' | 'queue'

export interface Request {
  id: string
  type: RequestType
  customer_name: string
  customer_tier: CustomerTier
  amount?: number | null
  summary: string
  sentiment: Sentiment
  refund_required: boolean
  refund_amount?: number | null
  status: RequestStatus
  created_at: string
  updated_at?: string
}

export interface TriageDecision {
  id: string
  request_id: string
  priority: number
  ai_action: AiAction
  assign_to: StaffMember | null
  suggested_action: string
  suggested_response: string
  automated: boolean
  requires_human: boolean
  confidence: number
  reasoning: string
  created_at: string
}

export interface WorkflowLogEntry {
  id: string
  request_id: string | null
  action: string
  details: string | null
  automated: boolean
  created_at: string
}

export interface StaffState {
  available: number
  total: number
  approved_slots: number
  approved_slots_total: number
}

export interface TriageOutput {
  decisions: TriageDecision[]
  priority_queue: { request: Request; decision: TriageDecision }[]
  workflow_logs: WorkflowLogEntry[]
  staff_state: StaffState
}
