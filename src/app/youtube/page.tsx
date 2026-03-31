import Sidebar from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Youtube,
  Eye,
  ThumbsUp,
  Users,
  Upload,
  Calendar,
  MessageSquare,
  BarChart2,
  AlertTriangle,
} from "lucide-react";

const automations = [
  {
    icon: Upload,
    title: "Video Upload & Scheduling",
    description: "Schedule uploads, auto-set titles, descriptions, tags, and thumbnails",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    icon: BarChart2,
    title: "Analytics Dashboard",
    description: "Views, watch time, subscribers, revenue — all in one place",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: MessageSquare,
    title: "Comment Management",
    description: "Auto-moderate comments, flag spam, draft reply suggestions",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Calendar,
    title: "Content Calendar",
    description: "Plan your upload schedule, track video pipeline",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
];

export default function YouTubePage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Youtube className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">YouTube</h1>
            <p className="text-muted-foreground">@djthirstyboy — Music Channel</p>
          </div>
        </div>

        {/* Setup Banner */}
        <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">YouTube API Key Required</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add your YouTube Data API v3 key in Settings → Integrations to enable live stats and automation.
            </p>
          </div>
        </div>

        {/* Stats Placeholder */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { icon: Eye, label: "Total Views", value: "—" },
            { icon: Users, label: "Subscribers", value: "—" },
            { icon: ThumbsUp, label: "Total Likes", value: "—" },
            { icon: Youtube, label: "Videos", value: "—" },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-400/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Automations */}
        <h2 className="text-lg font-semibold mb-4">Automation Modules</h2>
        <div className="grid grid-cols-2 gap-4">
          {automations.map(({ icon: Icon, title, description, color, bg }) => (
            <Card
              key={title}
              className="hover:border-primary/30 transition-colors cursor-pointer"
            >
              <CardContent className="p-5 flex gap-4">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
