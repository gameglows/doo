'use client'

import { Users, Clock, AlertTriangle } from 'lucide-react'
import type { StaffState } from '@/lib/types'

export function StaffPanel({ staff }: { staff: StaffState }) {
  return (
    <div className="flex items-center gap-6 px-4 py-3 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium">
          Staff:{' '}
          <span className={staff.available > 0 ? 'text-green-400' : 'text-red-400'}>
            {staff.available}/{staff.total}
          </span>
        </span>
        <div className="flex gap-1">
          {Array.from({ length: staff.total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < staff.available ? 'bg-green-400 animate-pulse-dot' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium">
          Slots:{' '}
          <span className={staff.approved_slots > 0 ? 'text-amber-300' : 'text-red-400'}>
            {staff.approved_slots}/{staff.approved_slots_total}
          </span>
        </span>
        <div className="flex gap-1">
          {Array.from({ length: staff.approved_slots_total }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < staff.approved_slots ? 'bg-amber-400' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {staff.available === 0 && (
        <div className="flex items-center gap-1 text-red-400 text-xs">
          <AlertTriangle className="w-3 h-3" />
          All staff busy
        </div>
      )}
    </div>
  )
}
