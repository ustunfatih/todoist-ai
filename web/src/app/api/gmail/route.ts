import { NextResponse } from 'next/server'
import { getRecentEmails, hasGoogleAuth } from '@/lib/google'
import { generateJSON } from '@/lib/ai'
import { format } from 'date-fns'

export interface EmailSuggestion {
  emailId: string
  subject: string
  from: string
  snippet: string
  isActionable: boolean
  suggestedTask: string       // proposed Todoist task text
  reason: string              // why this email needs action
  urgency: 'high' | 'medium' | 'low'
}

export interface GmailScanResult {
  scanned: number
  actionable: number
  suggestions: EmailSuggestion[]
  summary: string
}

export async function GET() {
  if (!hasGoogleAuth()) {
    return NextResponse.json({ error: 'Google not connected' }, { status: 403 })
  }

  try {
    const emails = await getRecentEmails(15)

    if (emails.length === 0) {
      return NextResponse.json({
        scanned: 0,
        actionable: 0,
        suggestions: [],
        summary: 'No recent emails found in your inbox.',
      } satisfies GmailScanResult)
    }

    const prompt = `You are an expert inbox manager. Scan these recent emails and identify which ones require action.

Today: ${format(new Date(), 'yyyy-MM-dd EEEE')}

Recent emails (last 48 hours):
${JSON.stringify(emails.map((e) => ({
  id: e.id,
  subject: e.subject,
  from: e.from,
  snippet: e.snippet,
})), null, 2)}

For each email, decide:
- Is it actionable? (Does it require a response, decision, follow-up, or task completion?)
- If yes, what is the specific Todoist task to create? (Start with a verb: Reply to, Review, Schedule, Follow up on, etc.)
- How urgent is it? (high = today, medium = this week, low = someday)

NOT actionable: newsletters, receipts, automated notifications, order confirmations, marketing emails.
ACTIONABLE: requests from humans, deadlines, invitations needing response, decisions required.

Return JSON:
{
  "scanned": ${emails.length},
  "actionable": <count of actionable emails>,
  "summary": "1-2 sentence summary of inbox health",
  "suggestions": [
    {
      "emailId": "...",
      "subject": "...",
      "from": "...",
      "snippet": "...",
      "isActionable": true,
      "suggestedTask": "Reply to John about Q2 budget approval",
      "reason": "John is asking for budget sign-off by Friday",
      "urgency": "high"
    }
  ]
}

Only include emails where isActionable is true in the suggestions array.`

    const result = await generateJSON<GmailScanResult>(prompt)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Gmail scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan Gmail' },
      { status: 500 },
    )
  }
}
