import { Settings, Key, Clock, Globe, Link2 } from 'lucide-react'
import { Card } from '@/components/ui/card'

const isGoogleConnected = !!process.env.GOOGLE_REFRESH_TOKEN

function EnvRow({ name, label, description }: { name: string; label: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-800 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <code className="text-xs font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-2 py-1 shrink-0">
        {name}
      </code>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen p-8 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="size-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        </div>
        <p className="mt-1 text-slate-500">Configure your Life OS via environment variables</p>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Key className="size-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">API Keys</span>
          </div>
          <EnvRow
            name="TODOIST_API_KEY"
            label="Todoist API Key"
            description="From todoist.com → Settings → Integrations → Developer"
          />
          <EnvRow
            name="GOOGLE_AI_API_KEY"
            label="Google AI (Gemini) Key"
            description="Free at aistudio.google.com/apikey — Gemini 2.0 Flash is used"
          />
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="size-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Work Hours</span>
          </div>
          <EnvRow
            name="WORK_START_HOUR"
            label="Work Start Hour"
            description="24h format. Default: 9 (9:00 AM)"
          />
          <EnvRow
            name="WORK_END_HOUR"
            label="Work End Hour"
            description="24h format. Default: 18 (6:00 PM)"
          />
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Globe className="size-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">Locale</span>
          </div>
          <EnvRow
            name="TIMEZONE"
            label="Timezone"
            description="Used for scheduling. Default: Asia/Qatar"
          />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-200">Google Integration</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${isGoogleConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
              {isGoogleConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {isGoogleConnected ? (
            <p className="text-xs text-slate-500">
              Google Calendar and Gmail are active. Calendar events appear in your Daily Planner automatically.
              To reconnect, visit <code className="text-indigo-400">/api/auth/google</code>.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Connect Google to enable Calendar integration in the Daily Planner and Gmail task scanning.
              </p>
              <a
                href="/api/auth/google"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Connect Google Account
              </a>
            </div>
          )}
        </Card>

        <Card className="border-dashed">
          <p className="text-xs text-slate-500 leading-relaxed">
            All settings are managed via a <code className="text-indigo-400">.env.local</code> file
            in the <code className="text-indigo-400">web/</code> directory.
            Copy <code className="text-indigo-400">web/.env.example</code> to <code className="text-indigo-400">web/.env.local</code> and
            fill in your values. Restart the dev server after changes.
          </p>
        </Card>
      </div>
    </div>
  )
}
