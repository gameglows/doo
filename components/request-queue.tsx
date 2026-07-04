'use client'

import { ListOrdered } from 'lucide-react'
import type { Request, TriageDecision } from '@/lib/types'
import { RequestCard } from './request-card'

export function RequestQueue({
  pairs,
  selectedId,
  onSelect,
}: {
  pairs: { request: Request; decision: TriageDecision }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ListOrdered className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Priority Queue</h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {pairs.length} requests
        </span>
      </div>

      <div className="space-y-2">
        {pairs.map(({ request, decision }) => (
          <RequestCard
            key={request.id}
            request={request}
            decision={decision}
            selected={selectedId === request.id}
            onClick={() => onSelect(request.id)}
          />
        ))}
      </div>

      {pairs.length === 0 && (
        <div className="flex items-center justify-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
          No requests in queue
        </div>
      )}
    </div>
  )
}
