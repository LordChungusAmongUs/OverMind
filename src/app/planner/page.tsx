import Sidebar from "@/components/layout/Sidebar";
import {
  CalendarDays,
  Star,
  Clock,
  CheckSquare,
  Sparkles,
  Repeat,
  Timer,
  ListTodo,
  Dumbbell,
  Music2,
  UtensilsCrossed,
  ShoppingCart,
  Home,
  Tv,
  Coffee,
  Plus,
} from "lucide-react";

const features = [
  {
    step: 1,
    icon: Timer,
    title: "Time Blocks",
    description: "Schedule dedicated focus blocks for work, content creation, rest, and more.",
    detail: "Drag-and-drop blocks onto a daily timeline. The AI suggests optimal block placement based on your habits.",
    status: "planned",
  },
  {
    step: 2,
    icon: CheckSquare,
    title: "Chores & Tasks",
    description: "Add one-off and recurring chores — cleaning, laundry, errands, car maintenance.",
    detail: "Set frequency (daily, weekly, monthly) and get reminders when they're due.",
    status: "planned",
  },
  {
    step: 3,
    icon: Sparkles,
    title: "Fun & Activities",
    description: "Log the things you actually want to do — games, movies, going out, hobbies.",
    detail: "Balance work and play. The AI will flag when you're overloading your day.",
    status: "planned",
  },
  {
    step: 4,
    icon: Repeat,
    title: "Recurring Routines",
    description: "Build morning routines, gym days, content days, and other weekly patterns.",
    detail: "Set a template for recurring days and let the planner auto-populate your schedule.",
    status: "planned",
  },
  {
    step: 5,
    icon: CalendarDays,
    title: "Daily View",
    description: "See everything scheduled for the day in a single, clean timeline.",
    detail: "Color-coded by category. Shows what's done, what's next, and what's coming up.",
    status: "planned",
  },
  {
    step: 6,
    icon: ListTodo,
    title: "AI Scheduling",
    description: "Describe what you need to get done and let the AI build your day.",
    detail: "Just say 'I need to record a mix, clean the kitchen, and hit the gym' — it schedules it.",
    status: "planned",
  },
];

const categoryPreviews = [
  {
    label: "Fun & Entertainment",
    icon: Sparkles,
    color: "border-purple-500/30 bg-purple-500/5",
    iconColor: "text-purple-400",
    items: ["Watch a movie", "Play games", "Go out"],
    count: 0,
  },
  {
    label: "Chores",
    icon: Home,
    color: "border-yellow-500/30 bg-yellow-500/5",
    iconColor: "text-yellow-400",
    items: ["Laundry", "Clean kitchen", "Take out trash"],
    count: 0,
  },
  {
    label: "Time Blocks",
    icon: Timer,
    color: "border-blue-500/30 bg-blue-500/5",
    iconColor: "text-blue-400",
    items: ["Deep work", "Content creation", "Admin"],
    count: 0,
  },
  {
    label: "Fitness",
    icon: Dumbbell,
    color: "border-orange-500/30 bg-orange-500/5",
    iconColor: "text-orange-400",
    items: ["Gym session", "Run", "Stretch"],
    count: 0,
  },
  {
    label: "Music / Content",
    icon: Music2,
    color: "border-green-500/30 bg-green-500/5",
    iconColor: "text-green-400",
    items: ["Record mix", "Edit video", "Post content"],
    count: 0,
  },
  {
    label: "Errands",
    icon: ShoppingCart,
    color: "border-red-500/30 bg-red-500/5",
    iconColor: "text-red-400",
    items: ["Grocery run", "Gas station", "Pickup order"],
    count: 0,
  },
];

export default function PlannerPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> planner.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Activity Planner</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Time blocks · chores · fun activities · routines · AI scheduling
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Today</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">tasks scheduled</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Chores</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">due this week</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Blocked</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">hours today</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Free</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">unscheduled hrs</p>
          </div>
        </div>

        {/* Today's schedule placeholder */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <CalendarDays className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Today&apos;s Schedule</span>
            <span className="ml-auto text-xs text-green-800 font-mono">nothing planned yet</span>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="relative w-12 h-12">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-12 h-12 rounded-full bg-green-500/5 border border-green-500/30 flex items-center justify-center">
                <Plus className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-sm font-mono text-green-700">No activities scheduled for today.</p>
            <p className="text-xs text-green-900 font-mono">Add time blocks, chores, and activities once this module is live.</p>
          </div>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {categoryPreviews.map(({ label, icon: Icon, color, iconColor, items }) => (
            <div key={label} className={`rounded-xl border ${color} bg-black/40 p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${iconColor}`} />
                <span className="text-xs font-mono font-bold text-green-600 uppercase tracking-wider">{label}</span>
                <span className="ml-auto text-xs text-green-900 font-mono">0 items</span>
              </div>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs font-mono text-green-900">
                    <div className="w-1 h-1 rounded-full bg-green-800 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-xs text-green-900/50 font-mono mt-3 italic">example items — not entered yet</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-7 h-7 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">How It Works</span>
            <span className="ml-auto text-xs text-green-800 font-mono">6 modules · in development</span>
          </div>
          <div className="p-5 space-y-3">
            {features.map(({ step, icon: Icon, title, description, detail }) => (
              <div key={step} className="flex gap-4 p-4 rounded-xl border border-green-500/15 bg-black/30">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-black/60 border border-green-500/20 flex items-center justify-center">
                    <span className="text-xs font-mono font-bold text-green-700">{step}</span>
                  </div>
                  {step < features.length && <div className="w-px flex-1 bg-green-500/10 min-h-[16px]" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm font-mono font-bold text-green-500">{title}</p>
                    <span className="ml-auto flex items-center gap-1 text-xs text-green-900 font-mono flex-shrink-0">
                      <Clock className="w-3 h-3" /> planned
                    </span>
                  </div>
                  <p className="text-sm text-green-600 font-mono">{description}</p>
                  <p className="text-xs text-green-800 font-mono mt-1">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-green-500/15 bg-black/30">
          <Tv className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700 font-mono">
            <span className="text-green-500 font-semibold">Integrates with the rest of Overmind.</span> The planner will pull gym days from Health, content days from Music, and weather from the Briefing page — so your schedule is always aware of what&apos;s going on.
          </p>
        </div>

      </main>
    </div>
  );
}
