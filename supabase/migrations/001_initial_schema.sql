-- Busy Business Triage System
-- Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Request types enum
CREATE TYPE request_type AS ENUM (
  'vip_booking_cancelled',
  'new_customer',
  'angry_double_charge',
  'simple_inquiry',
  'urgent_bad_review'
);

-- Customer tiers
CREATE TYPE customer_tier AS ENUM ('vip', 'regular', 'new');

-- Sentiment labels
CREATE TYPE sentiment_label AS ENUM ('angry', 'neutral', 'urgent');

-- AI action types
CREATE TYPE ai_action_type AS ENUM ('resolve', 'escalate', 'assign');

-- Request status
CREATE TYPE request_status AS ENUM ('pending', 'in_progress', 'resolved', 'escalated', 'auto_resolved');

-- Staff assignment
CREATE TYPE staff_member AS ENUM ('staff_1', 'staff_2', 'manager', 'queue');

--- TABLES ---

-- Incoming customer requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type request_type NOT NULL,
  customer_name TEXT NOT NULL,
  customer_tier customer_tier NOT NULL DEFAULT 'regular',
  amount DECIMAL(10, 2),
  summary TEXT NOT NULL,
  sentiment sentiment_label NOT NULL DEFAULT 'neutral',
  refund_required BOOLEAN NOT NULL DEFAULT false,
  refund_amount DECIMAL(10, 2),
  status request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI triage decisions per request
CREATE TABLE IF NOT EXISTS triage_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),
  ai_action ai_action_type NOT NULL,
  assign_to staff_member,
  suggested_action TEXT NOT NULL,
  suggested_response TEXT NOT NULL,
  automated BOOLEAN NOT NULL DEFAULT false,
  requires_human BOOLEAN NOT NULL DEFAULT false,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automated workflow log
CREATE TABLE IF NOT EXISTS workflow_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  automated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_type ON requests(type);
CREATE INDEX idx_triage_decisions_request ON triage_decisions(request_id);
CREATE INDEX idx_triage_decisions_priority ON triage_decisions(priority);
CREATE INDEX idx_workflow_log_created ON workflow_log(created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
