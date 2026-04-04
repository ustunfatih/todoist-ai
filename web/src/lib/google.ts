/**
 * Google OAuth2 helper — personal-use, single-user.
 *
 * Flow:
 *  1. User visits /api/auth/google  → redirected to Google consent screen
 *  2. Google redirects to /api/auth/callback  → page displays the refresh token
 *  3. User copies refresh token → adds as GOOGLE_REFRESH_TOKEN in Vercel env vars
 *  4. All subsequent calls use getAccessToken() to get a fresh access token
 */

export interface CalendarEvent {
  id: string
  title: string
  startTime: string   // "09:00"
  endTime: string     // "10:00"
  isAllDay: boolean
  location?: string
}

export interface GmailMessage {
  id: string
  subject: string
  from: string
  snippet: string
  date: string
}

export function hasGoogleAuth(): boolean {
  return !!process.env.GOOGLE_REFRESH_TOKEN
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getCalendarEvents(date: Date): Promise<CalendarEvent[]> {
  const token = await getAccessToken()

  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', start.toISOString())
  url.searchParams.set('timeMax', end.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '20')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Calendar fetch failed: ${await res.text()}`)

  const data = await res.json() as { items?: Record<string, unknown>[] }

  return (data.items ?? [])
    .map((e) => {
      const start = e.start as { date?: string; dateTime?: string }
      const end = e.end as { date?: string; dateTime?: string }
      const isAllDay = !!start.date

      const fmt = (dt: string) => {
        const d = new Date(dt)
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      }

      return {
        id: e.id as string,
        title: (e.summary as string) ?? '(No title)',
        startTime: isAllDay ? '' : fmt(start.dateTime!),
        endTime: isAllDay ? '' : fmt(end.dateTime!),
        isAllDay,
        location: e.location as string | undefined,
      }
    })
    .filter((e) => !e.isAllDay)
}

export async function getRecentEmails(maxResults = 15): Promise<GmailMessage[]> {
  const token = await getAccessToken()

  // Fetch message IDs from inbox, last 2 days, unread
  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  listUrl.searchParams.set('q', 'in:inbox newer_than:2d')
  listUrl.searchParams.set('maxResults', String(maxResults))

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`)
  const listData = await listRes.json() as { messages?: { id: string }[] }
  const ids = (listData.messages ?? []).map((m) => m.id)

  // Fetch metadata for each message in parallel
  const messages = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) return null
      const msg = await res.json() as {
        id: string
        snippet: string
        payload: { headers: { name: string; value: string }[] }
      }

      const header = (name: string) =>
        msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

      return {
        id: msg.id,
        subject: header('Subject') || '(No subject)',
        from: header('From'),
        snippet: msg.snippet ?? '',
        date: header('Date'),
      }
    }),
  )

  return messages.filter((m): m is GmailMessage => m !== null)
}
