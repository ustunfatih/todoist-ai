import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin
  const redirectUri = `${origin}/api/auth/callback`

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
  ].join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent') // always return refresh_token

  return NextResponse.redirect(url.toString())
}
