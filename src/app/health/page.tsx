import Sidebar from "@/components/layout/Sidebar";
import { Heart, Activity, Moon, Dumbbell, Apple, BarChart2, Clock } from "lucide-react";

const modules = [
  { icon: Dumbbell,  title: "Workouts",        description: "AI-generated daily workout plans based on your goals and recovery",       active: false },
  { icon: Apple,     title: "Nutrition",        description: "Meal tracking, macro targets, and weekly meal prep planning",             active: false },
  { icon: Moon,      title: "Sleep",            description: "Sleep score tracking, bedtime reminders, and recovery metrics",           active: false },
  { icon: Activity,  title: "Progress",         description: "Weight, measurements, and body composition over time",                    active: false },
  { icon: Heart,     title: "Vitals",           description: "Heart rate, HRV, and wellness check-ins",                                active: false },
  { icon: BarChart2, title: "Analytics",        description: "Weekly and monthly health reports with trend analysis",                   active: false },
];

export default function HealthPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> health_coach.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Health Coach</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            AI-powered workouts, nutrition, sleep, and wellness tracking
          </p>
        </div>

        {/* Status strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Streak",  value: "—",  sub: "days active",      icon: Activity, color: "text-green-300" },
            { label: "Workout", value: "—",  sub: "this week",         icon: Dumbbell, color: "text-green-700" },
            { label: "Sleep",   value: "—",  sub: "avg hrs last week", icon: Moon,     color: "text-green-700" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">{label}</span>
              </div>
              <p className={`text-3xl font-black font-mono ${color}`}>{value}</p>
              <p className="text-xs text-green-800 font-mono mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Modules */}
        <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
          <span className="text-red-500">&gt;</span> modules
        </p>
        <div className="grid grid-cols-2 gap-3">
          {modules.map(({ icon: Icon, title, description, active }) => (
            <div key={title} className={`holo-card rounded-xl border p-5 transition-all ${
              active ? "border-green-500/30 bg-black/40" : "border-green-500/10 bg-black/20 opacity-50"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                  active ? "border-green-500/30 bg-green-500/10" : "border-green-500/10 bg-black/20"
                }`}>
                  <Icon className={`w-5 h-5 ${active ? "text-green-400" : "text-green-800"}`} />
                </div>
                <div>
                  <p className={`font-bold font-mono text-sm mb-1 ${active ? "text-green-300" : "text-green-800"}`}>{title}</p>
                  <p className="text-xs text-green-800 font-mono">{description}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-green-900 font-mono">
                    <Clock className="w-3 h-3" /> PLANNED
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
