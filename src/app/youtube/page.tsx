import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Youtube,
  Eye,
  Users,
  ThumbsUp,
  Upload,
  Calendar,
  MessageSquare,
  BarChart2,
} from "lucide-react";

const automations = [
  { icon: Upload, title: "Upload & Scheduling", description: "Schedule uploads, auto-set titles, descriptions, and tags" },
  { icon: BarChart2, title: "Analytics", description: "Views, watch time, subscribers, and revenue" },
  { icon: MessageSquare, title: "Comments", description: "Auto-moderate, flag spam, draft replies" },
  { icon: Calendar, title: "Content Calendar", description: "Plan your upload schedule and track video pipeline" },
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
            <p className="text-muted-foreground">@djthirstyboy</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { icon: Eye, label: "Total Views" },
            { icon: Users, label: "Subscribers" },
            { icon: ThumbsUp, label: "Total Likes" },
            { icon: Youtube, label: "Videos" },
          ].map(({ icon: Icon, label }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-400/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold text-muted-foreground">—</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modules */}
        <div className="grid grid-cols-2 gap-4">
          {automations.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="opacity-60">
              <CardContent className="p-5 flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-red-400" />
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
