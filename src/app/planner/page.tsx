"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  CalendarDays, CheckSquare, Timer, ListTodo, Dumbbell,
  Music2, ShoppingCart, Home, Sparkles, Plus, X, Loader2,
  Check, ChevronDown, ChevronUp, Briefcase, Repeat,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  name: string;
  category: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number;
  recurrence: string;
  completed_dates: string[];
  notes: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "Chores",         icon: Home,         color: "text-yellow-400", bg: "border-yellow-500/30 bg-yellow-500/5"  },
  { label: "Fitness",        icon: Dumbbell,      color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5"  },
  { label: "Music/Content",  icon: Music2,        color: "text-green-400",  bg: "border-green-500/30 bg-green-500/5"   },
  { label: "Errands",        icon: ShoppingCart,  color: "text-red-400",    bg: "border-red-500/30 bg-red-500/5"       },
  { label: "Business",       icon: Briefcase,     color: "text-blue-400",   bg: "border-blue-500/30 bg-blue-500/5"     },
  { label: "Fun",            icon: Sparkles,      color: "text-purple-400", bg: "border-purple-500/30 bg-purple-500/5" },
  { label: "Time Block",     icon: Timer,         color: "text-cyan-400",   bg: "border-cyan-500/30 bg-cyan-500/5"     },
  { label: "General",        icon: ListTodo,      color: "text-green-600",  bg: "border-green-500/20 bg-black/40"      },
];

const RECURRENCES = ["none", "daily", "weekly", "monthly"];

const BLANK = {
  name: "", category: "General", scheduled_date: "", scheduled_time: "",
  duration_minutes: "60", recurrence: "none", notes: "",
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function isScheduledToday(task: Task, today: string): boolean {
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekly") {
    const ref = task.scheduled_date ?? task.created_at.split("T")[0];
    const refDay = new Date(ref + "T12:00:00").getDay();
    const todayDay = new Date(today + "T12:00:00").getDay();
    return refDay === todayDay;
  }
  if (task.recurrence === "monthly") {
    const ref = task.scheduled_date ?? task.created_at.split("T")[0];
    const refDom = parseInt(ref.split("-")[2]);
    const todayDom = parseInt(today.split("-")[2]);
    return refDom === todayDom;
  }
  return task.scheduled_date === today;
}

function getCategoryMeta(label: string) {
  return CATEGORIES.find(c => c.label === label) ?? CATEGORIES[CATEGORIES.length - 1];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(["Chores", "Fitness", "Music/Content"]));
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const today = todayStr();

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("planner_tasks")
      .select("*")
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .order("created_at");
    setTasks(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const todayTasks = tasks.filter(t => isScheduledToday(t, today));
  const completedToday = todayTasks.filter(t => t.completed_dates.includes(today));
  const pendingToday = todayTasks.filter(t => !t.completed_dates.includes(today));

  const hoursBlocked = todayTasks
    .filter(t => t.category === "Time Block" && !t.completed_dates.includes(today))
    .reduce((s, t) => s + t.duration_minutes / 60, 0);

  const choresDueThisWeek = tasks.filter(t => {
    if (t.category !== "Chores") return false;
    if (t.recurrence !== "none") return true;
    if (!t.scheduled_date) return false;
    const diff = (new Date(t.scheduled_date).getTime() - new Date(today).getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function addTask() {
    if (!newTask.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { data, error } = await supabase.from("planner_tasks").insert({
      name: newTask.name.trim(),
      category: newTask.category,
      scheduled_date: newTask.scheduled_date || null,
      scheduled_time: newTask.scheduled_time || null,
      duration_minutes: parseInt(newTask.duration_minutes) || 60,
      recurrence: newTask.recurrence,
      notes: newTask.notes || null,
    }).select().single();
    if (error) { setSaveError(error.message); setSaving(false); return; }
    if (data) setTasks(prev => [...prev, data]);
    setNewTask({ ...BLANK });
    setShowAdd(false);
    setSaving(false);
  }

  async function deleteTask(id: string) {
    await supabase.from("planner_tasks").delete().eq("id", id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function toggleComplete(task: Task) {
    const isDone = task.completed_dates.includes(today);
    const newDates = isDone
      ? task.completed_dates.filter(d => d !== today)
      : [...task.completed_dates, today];
    await supabase.from("planner_tasks").update({ completed_dates: newDates }).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed_dates: newDates } : t));
  }

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
            Tasks · chores · routines · time blocks
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Today</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">{loading ? "—" : todayTasks.length}</p>
            <p className="text-xs text-green-800 font-mono mt-1">{completedToday.length} done</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Home className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Chores</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">{loading ? "—" : choresDueThisWeek}</p>
            <p className="text-xs text-green-800 font-mono mt-1">due this week</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Blocked</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">{loading ? "—" : hoursBlocked.toFixed(1)}</p>
            <p className="text-xs text-green-800 font-mono mt-1">hrs today</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Total</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">{loading ? "—" : tasks.length}</p>
            <p className="text-xs text-green-800 font-mono mt-1">tasks in planner</p>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <span className="ping-slow absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative w-7 h-7 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CalendarDays className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Today&apos;s Schedule</span>
            <span className="ml-auto text-xs text-green-700 font-mono">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>

          {todayTasks.length === 0 && !loading && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-mono text-green-800">Nothing scheduled for today.</p>
              <p className="text-xs text-green-900 font-mono mt-1">Add tasks below or use the + button.</p>
            </div>
          )}

          {pendingToday.length > 0 && (
            <div className="divide-y divide-green-500/10">
              {pendingToday
                .sort((a, b) => (a.scheduled_time ?? "99") < (b.scheduled_time ?? "99") ? -1 : 1)
                .map(task => {
                  const meta = getCategoryMeta(task.category);
                  const Icon = meta.icon;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-green-500/5 transition-colors">
                      <button
                        onClick={() => toggleComplete(task)}
                        className="w-5 h-5 rounded border border-green-500/30 flex items-center justify-center flex-shrink-0 hover:border-green-400 transition-colors text-transparent hover:text-green-400"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-bold text-green-300">{task.name}</p>
                        <p className="text-xs text-green-800 font-mono">
                          {task.category}
                          {task.scheduled_time ? ` · ${task.scheduled_time}` : ""}
                          {task.category === "Time Block" ? ` · ${task.duration_minutes}min` : ""}
                          {task.recurrence !== "none" ? ` · ${task.recurrence}` : ""}
                        </p>
                      </div>
                      {task.recurrence !== "none" && (
                        <Repeat className="w-3.5 h-3.5 text-green-800 flex-shrink-0" />
                      )}
                    </div>
                  );
              })}
            </div>
          )}

          {completedToday.length > 0 && (
            <div className="border-t border-green-500/10">
              <p className="text-xs text-green-800 font-mono px-5 pt-3 pb-1 uppercase tracking-wider">Completed</p>
              <div className="divide-y divide-green-500/10">
                {completedToday.map(task => {
                  const meta = getCategoryMeta(task.category);
                  const Icon = meta.icon;
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-2.5 opacity-50">
                      <button
                        onClick={() => toggleComplete(task)}
                        className="w-5 h-5 rounded border border-green-400 bg-green-500/20 flex items-center justify-center flex-shrink-0 text-green-400"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
                      <p className="text-sm font-mono text-green-700 line-through">{task.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add Task */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <button
            onClick={() => setShowAdd(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5"
          >
            <Plus className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Add Task</span>
            {showAdd ? <ChevronUp className="w-3.5 h-3.5 text-green-700 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-green-700 ml-auto" />}
          </button>

          {showAdd && (
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                  placeholder="Task name *"
                  value={newTask.name}
                  onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                />
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={newTask.category}
                  onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
                <select
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={newTask.recurrence}
                  onChange={e => setNewTask(p => ({ ...p, recurrence: e.target.value }))}
                >
                  {RECURRENCES.map(r => <option key={r} value={r}>{r === "none" ? "one-time" : r}</option>)}
                </select>
                <input
                  type="date"
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={newTask.scheduled_date}
                  onChange={e => setNewTask(p => ({ ...p, scheduled_date: e.target.value }))}
                />
                <input
                  type="time"
                  className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                  value={newTask.scheduled_time}
                  onChange={e => setNewTask(p => ({ ...p, scheduled_time: e.target.value }))}
                />
                {newTask.category === "Time Block" && (
                  <input
                    type="number"
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Duration (minutes)"
                    value={newTask.duration_minutes}
                    onChange={e => setNewTask(p => ({ ...p, duration_minutes: e.target.value }))}
                  />
                )}
              </div>
              {saveError && <p className="text-xs text-red-400 font-mono mb-2">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={addTask}
                  disabled={saving || !newTask.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {saving ? "Saving..." : "Add Task"}
                </button>
                <button onClick={() => setShowAdd(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* All Tasks by Category */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-mono text-green-700 uppercase tracking-widest">
              <span className="text-red-500">&gt;</span> all tasks
            </p>
            <div className="flex gap-1 ml-auto flex-wrap justify-end">
              <button
                onClick={() => setFilterCat(null)}
                className={`text-xs px-2 py-0.5 rounded font-mono transition-all ${!filterCat ? "bg-green-500/20 text-green-300" : "text-green-800 hover:text-green-600"}`}
              >
                all
              </button>
              {CATEGORIES.map(c => (
                <button
                  key={c.label}
                  onClick={() => setFilterCat(f => f === c.label ? null : c.label)}
                  className={`text-xs px-2 py-0.5 rounded font-mono transition-all ${filterCat === c.label ? "bg-green-500/20 text-green-300" : "text-green-800 hover:text-green-600"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {CATEGORIES.filter(c => !filterCat || c.label === filterCat).map(cat => {
            const catTasks = tasks.filter(t => t.category === cat.label);
            if (catTasks.length === 0) return null;
            const Icon = cat.icon;
            const isOpen = expandedCats.has(cat.label);
            return (
              <div key={cat.label} className={`rounded-xl border ${cat.bg} bg-black/40`}>
                <button
                  onClick={() => toggleCat(cat.label)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${cat.color}`} />
                  <span className="text-xs font-mono font-bold text-green-500 uppercase tracking-wider">{cat.label}</span>
                  <span className="text-xs text-green-800 font-mono">{catTasks.length} task{catTasks.length !== 1 ? "s" : ""}</span>
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-green-800 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-green-800 ml-auto" />}
                </button>

                {isOpen && (
                  <div className="border-t border-green-500/10 divide-y divide-green-500/10">
                    {catTasks.map(task => {
                      const doneToday = task.completed_dates.includes(today);
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-green-500/5 transition-colors">
                          <button
                            onClick={() => toggleComplete(task)}
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                              doneToday
                                ? "border-green-400 bg-green-500/20 text-green-400"
                                : "border-green-500/30 text-transparent hover:border-green-400 hover:text-green-400"
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-mono font-bold ${doneToday ? "line-through text-green-800" : "text-green-300"}`}>
                              {task.name}
                            </p>
                            <p className="text-xs text-green-800 font-mono">
                              {task.recurrence !== "none" ? `↻ ${task.recurrence}` : task.scheduled_date ?? "no date"}
                              {task.scheduled_time ? ` · ${task.scheduled_time}` : ""}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-green-900 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && tasks.length === 0 && (
            <div className="text-center py-12 border border-dashed border-green-500/20 rounded-xl">
              <ListTodo className="w-8 h-8 text-green-800 mx-auto mb-3" />
              <p className="text-sm text-green-700 font-mono">No tasks yet.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-2 text-xs font-mono text-green-500 hover:text-green-300 transition-colors underline underline-offset-2"
              >
                Add your first task →
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
