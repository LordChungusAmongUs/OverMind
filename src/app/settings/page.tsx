import Sidebar from "@/components/layout/Sidebar";
import { Key, Globe, Database, Youtube, TrendingUp, UtensilsCrossed, CheckCircle2, XCircle } from "lucide-react";

const integrations = [
  {
    icon: UtensilsCrossed,
    name: "Figure POS",
    description: "Restaurant data — inventory, sales, scheduling",
    key: "FIGURE_POS_URL",
    placeholder: "https://your-restaurant.figure.com",
    connected: false,
  },
  {
    icon: Youtube,
    name: "YouTube OAuth",
    description: "Channel uploads and automation",
    key: "YOUTUBE_CLIENT_ID / SECRET",
    placeholder: "See /api/youtube/token setup",
    connected: true,
  },
  {
    icon: TrendingUp,
    name: "Markets Feed",
    description: "Live price feeds for BTC, MSTR, COIN",
    key: "MARKET_API_KEY",
    placeholder: "Coming soon",
    connected: false,
  },
  {
    icon: Database,
    name: "Supabase",
    description: "Primary database and storage",
    key: "NEXT_PUBLIC_SUPABASE_URL",
    placeholder: "https://xxx.supabase.co",
    connected: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> system_config.exe
          </p>
          <h1 className="text-3xl font-black font-mono text-green-300">Settings</h1>
          <p className="text-green-700 text-sm font-mono mt-1">Integrations, API keys, environment</p>
        </div>

        <div className="max-w-2xl space-y-3">
          {integrations.map(({ icon: Icon, name, description, key, placeholder, connected }) => (
            <div key={name} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                  connected ? "bg-green-500/10 border-green-500/30" : "bg-black/30 border-green-500/15"
                }`}>
                  <Icon className={`w-5 h-5 ${connected ? "text-green-400" : "text-green-700"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold font-mono text-green-300">{name}</h3>
                    {connected ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 font-mono">
                        <CheckCircle2 className="w-3 h-3" /> ONLINE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/5 text-red-400 font-mono">
                        <XCircle className="w-3 h-3" /> OFFLINE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-green-700 font-mono mb-3">{description}</p>
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-green-700 flex-shrink-0" />
                    <code className="text-xs text-green-500 bg-black/50 border border-green-500/20 px-2 py-1 rounded font-mono">
                      {key}
                    </code>
                  </div>
                  <p className="text-xs text-green-800 font-mono mt-2">
                    .env.local: <code className="text-green-700">{key}=&quot;{placeholder}&quot;</code>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Env block */}
        <div className="mt-6 max-w-2xl">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-green-500/20">
              <Globe className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-bold text-green-400 uppercase tracking-wider">Environment Setup</span>
            </div>
            <div className="p-5">
              <p className="text-xs text-green-700 font-mono mb-3">
                Create <code className="text-green-500 bg-black/50 border border-green-500/20 px-1.5 py-0.5 rounded">.env.local</code> in project root:
              </p>
              <pre className="bg-black/60 border border-green-500/20 rounded-lg p-4 text-xs text-green-500 font-mono overflow-x-auto leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
FIGURE_POS_URL=your_figure_pos_url
FIGURE_POS_USER=your_email
FIGURE_POS_PASS=your_password`}
              </pre>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
