import { type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return new Response(errorPage(error ?? 'No code returned'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const redirectUri = `${origin}/api/auth/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json() as { refresh_token?: string; error?: string }

  if (!tokenRes.ok || !tokens.refresh_token) {
    return new Response(errorPage(tokens.error ?? 'No refresh token returned — try connecting again'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new Response(successPage(tokens.refresh_token), {
    headers: { 'Content-Type': 'text/html' },
  })
}

function successPage(refreshToken: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Google Connected — Life OS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #020817; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 1rem; padding: 2rem; max-width: 560px; width: 100%; }
    h1 { color: #a3e635; font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1rem; line-height: 1.6; }
    .token-box { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 1rem; font-family: monospace; font-size: 0.75rem; word-break: break-all; color: #818cf8; margin: 1rem 0; }
    .step { background: #0f1f3d; border: 1px solid #1e3a5f; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.75rem; }
    .step-num { display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; background: #6366f1; border-radius: 50%; font-size: 0.75rem; font-weight: bold; margin-right: 0.5rem; }
    button { background: #6366f1; color: white; border: none; border-radius: 0.5rem; padding: 0.5rem 1rem; font-size: 0.875rem; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .success-icon { font-size: 2rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="success-icon">✅</div>
    <h1>Google Connected Successfully</h1>
    <p>Copy the refresh token below and add it to your Vercel environment variables to activate Google Calendar and Gmail features.</p>

    <div class="token-box" id="token">${refreshToken}</div>
    <button onclick="navigator.clipboard.writeText('${refreshToken}').then(() => this.textContent = 'Copied!')">Copy Token</button>

    <p style="margin-top: 1.5rem; font-weight: 600; color: #e2e8f0;">Next steps:</p>

    <div class="step">
      <span class="step-num">1</span>
      Go to <strong>Vercel → Your Project → Settings → Environment Variables</strong>
    </div>
    <div class="step">
      <span class="step-num">2</span>
      Add a new variable: <code style="color:#818cf8">GOOGLE_REFRESH_TOKEN</code> = the token above
    </div>
    <div class="step">
      <span class="step-num">3</span>
      Redeploy the project (Vercel → Deployments → Redeploy)
    </div>
    <div class="step">
      <span class="step-num">4</span>
      Calendar events will now appear in your Daily Planner, and Gmail scanning will be available
    </div>
  </div>
</body>
</html>`
}

function errorPage(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Auth Error — Life OS</title>
  <style>
    body { background: #020817; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
    .card { background: #0f172a; border: 1px solid #7f1d1d; border-radius: 1rem; padding: 2rem; max-width: 480px; }
    h1 { color: #f87171; margin-bottom: 1rem; }
    p { color: #94a3b8; font-size: 0.875rem; }
    a { color: #818cf8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Failed</h1>
    <p>${message}</p>
    <p style="margin-top: 1rem"><a href="/api/auth/google">Try again</a></p>
  </div>
</body>
</html>`
}
