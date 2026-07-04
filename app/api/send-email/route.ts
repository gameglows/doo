import { NextRequest, NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json()

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 })
    }

    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Busy Business <onboarding@resend.dev>',
          to,
          subject,
          html,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ sent: true, method: 'resend', id: data.id, detail: `Email sent to ${to} via Resend.` })
      }

      const body = await res.text()
      return NextResponse.json({ sent: false, method: 'resend', detail: `Resend error ${res.status}: ${body}` }, { status: 500 })
    }

    // Simulation fallback
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return NextResponse.json({
      sent: true,
      method: 'simulated',
      detail: `[SIMULATED] Email sent to ${to}. Add RESEND_API_KEY to .env.local for real delivery.`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
