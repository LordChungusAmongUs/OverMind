import Sidebar from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Key, Globe, Database, Youtube, TrendingUp, UtensilsCrossed } from "lucide-react";

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
    name: "YouTube Data API",
    description: "Channel analytics and automation",
    key: "YOUTUBE_API_KEY",
    placeholder: "AIza...",
    connected: false,
  },
  {
    icon: TrendingUp,
    name: "Markets (Future)",
    description: "Live price feeds for BTC, MSTR, COIN",
    key: "MARKET_API_KEY",
    placeholder: "Coming soon",
    connected: false,
  },
  {
    icon: Database,
    name: "Supabase",
    description: "Database connection",
    key: "SUPABASE_URL",
    placeholder: "https://xxx.supabase.co",
    connected: false,
  },
];

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage integrations and API keys</p>
        </div>

        <div className="max-w-2xl space-y-4">
          {integrations.map(({ icon: Icon, name, description, key, placeholder, connected }) => (
            <Card key={name}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold">{name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "bg-green-400/10 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                        {connected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{description}</p>
                    <div className="flex items-center gap-2">
                      <Key className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <code className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {key}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Add to your <code className="bg-secondary px-1 rounded">.env.local</code> file: {" "}
                      <code className="bg-secondary px-1 rounded">{key}=&quot;{placeholder}&quot;</code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> Environment Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Create a <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">.env.local</code> file in your project root with:
              </p>
              <pre className="bg-secondary rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
YOUTUBE_API_KEY=your_youtube_api_key
FIGURE_POS_URL=your_figure_pos_url
FIGURE_POS_USER=your_email
FIGURE_POS_PASS=your_password`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
