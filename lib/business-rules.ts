export const BUSINESS_RULES = {
  REFUND_APPROVAL_LIMIT: 500,
  STAFF_TOTAL: 2,
  APPROVED_SLOTS_TOTAL: 3,
  MAX_PRIORITY: 1,
  MIN_PRIORITY: 5,
}

export const KB_ARTICLES: Record<string, string> = {
  default:
    "Thank you for reaching out! Based on our knowledge base, here is the information you requested. If you need further assistance, we're here to help.",
  hours:
    "Our business hours are Monday–Friday 9 AM to 6 PM, and Saturday 10 AM to 4 PM. We are closed on Sundays and public holidays.",
  status:
    "You can check your order status anytime by visiting our website and logging into your account. Orders typically take 3-5 business days to process.",
  payment:
    "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. All payments are processed securely.",
  return:
    "Our return policy allows returns within 30 days of purchase. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.",
}

export const PRIORITY_MATRIX: Record<string, {
  base_priority: number
  requires_human: boolean
  can_auto_resolve: boolean
  suggested_action: string
  suggested_response: string
  refund_action: string
}> = {
  angry_double_charge: {
    base_priority: 1,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Verify duplicate charges, prepare refund, escalate if over limit',
    suggested_response:
      "I'm so sorry about this. I can see you were charged twice — that's our mistake. I'll process the refund for the duplicate charge right away. If the amount exceeds our standard limit, I'll need to loop in my manager for immediate approval, but I'll make sure this gets resolved for you today.",
    refund_action: 'escalate_to_manager',
  },
  urgent_bad_review: {
    base_priority: 2,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Acknowledge urgency, identify root issue, offer concrete solution',
    suggested_response:
      "I hear you, and I completely understand your frustration. Let me personally look into what happened and find a solution right now. I appreciate you bringing this to our attention so we can make it right. Give me just a few minutes to investigate.",
    refund_action: 'none',
  },
  vip_booking_cancelled: {
    base_priority: 3,
    requires_human: true,
    can_auto_resolve: false,
    suggested_action: 'Check VIP status in KB, offer priority rebooking with compensation',
    suggested_response:
      "I sincerely apologize for the cancellation, especially as a valued VIP customer. I've checked and we do have priority slots available. Let me rebook you immediately and add a complimentary upgrade for the inconvenience.",
    refund_action: 'none',
  },
  new_customer: {
    base_priority: 4,
    requires_human: false,
    can_auto_resolve: false,
    suggested_action: 'Welcome, gather requirements, queue for sales onboarding',
    suggested_response:
      "Welcome! We're excited to have you. I've noted your interest and our team will reach out shortly to help get you started. In the meantime, feel free to browse our resources. Is there anything specific you'd like to know right now?",
    refund_action: 'none',
  },
  simple_inquiry: {
    base_priority: 5,
    requires_human: false,
    can_auto_resolve: true,
    suggested_action: 'Auto-resolve: match from KB, send response, close ticket',
    suggested_response:
      "Thanks for reaching out! Based on your inquiry, here's what you need to know:\n\n{{kb_answer}}\n\nIf you have any other questions, we're just a message away!",
    refund_action: 'none',
  },
}
