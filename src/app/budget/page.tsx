import Sidebar from "@/components/layout/Sidebar";
import {
  Wallet,
  DollarSign,
  Receipt,
  TrendingUp,
  PiggyBank,
  Plane,
  CreditCard,
  BarChart3,
  Star,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Zap,
  Car,
  Home,
  Utensils,
  Tv,
} from "lucide-react";

const features = [
  {
    step: 1,
    icon: DollarSign,
    title: "Income Tracking",
    description: "Log all income sources — salary, business revenue, side hustle, investments.",
    detail: "Know exactly what's coming in each month before planning what goes out.",
    status: "planned",
  },
  {
    step: 2,
    icon: Receipt,
    title: "Bills Manager",
    description: "Track every recurring bill: due date, amount, and paid/unpaid status.",
    detail: "Never miss a due date. See your total fixed obligations at a glance.",
    status: "planned",
  },
  {
    step: 3,
    icon: CreditCard,
    title: "Expense Categories",
    description: "Log daily spending across food, gas, entertainment, subscriptions, and more.",
    detail: "See where the money actually goes, broken down by category.",
    status: "planned",
  },
  {
    step: 4,
    icon: PiggyBank,
    title: "Savings Goals",
    description: "Set targets for emergency fund, down payments, gear, or anything else.",
    detail: "Track progress toward each goal with visual fill bars and projections.",
    status: "planned",
  },
  {
    step: 5,
    icon: Plane,
    title: "Vacation Fund",
    description: "Dedicated travel savings tracker — set a destination, cost, and target date.",
    detail: "See how much to set aside per month to hit your trip goal in time.",
    status: "planned",
  },
  {
    step: 6,
    icon: BarChart3,
    title: "Monthly Summary",
    description: "Net cash flow, spending trends, month-over-month comparisons.",
    detail: "Full picture of income vs. outflow with AI insights on where to cut or save.",
    status: "planned",
  },
];

const billPreview = [
  { name: "Rent / Mortgage", icon: Home,         amount: "—",   due: "1st",  color: "text-orange-400" },
  { name: "Electric",        icon: Zap,           amount: "—",   due: "—",    color: "text-yellow-400" },
  { name: "Car Payment",     icon: Car,           amount: "—",   due: "—",    color: "text-blue-400"   },
  { name: "Subscriptions",   icon: Tv,            amount: "—",   due: "—",    color: "text-purple-400" },
  { name: "Groceries",       icon: Utensils,      amount: "—",   due: "—",    color: "text-green-400"  },
  { name: "Shopping",        icon: ShoppingCart,  amount: "—",   due: "—",    color: "text-pink-400"   },
];

export default function BudgetPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> budget.exe
          </p>
          <h1 className="text-3xl font-black font-mono">
            <span className="gradient-text">Personal Budget</span>
          </h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Bills · income · expenses · savings · vacation funds
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Income</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">this month</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Bills</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">monthly fixed</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Net Flow</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">income − expenses</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Savings</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-800">—</p>
            <p className="text-xs text-green-900 font-mono mt-1">total saved</p>
          </div>
        </div>

        {/* Bills preview table */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <Receipt className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Bills &amp; Expenses</span>
            <span className="ml-auto text-xs text-green-800 font-mono">0 entered · in development</span>
          </div>
          <div className="divide-y divide-green-500/10">
            {billPreview.map(({ name, icon: Icon, amount, due, color }) => (
              <div key={name} className="flex items-center gap-4 px-5 py-3 hover:bg-green-500/5 transition-colors">
                <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                <span className="text-sm font-mono text-green-600 flex-1">{name}</span>
                <span className="text-xs font-mono text-green-800">due {due}</span>
                <span className="text-sm font-black font-mono text-green-700 w-16 text-right">{amount}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-green-500/20 flex justify-between items-center bg-black/20">
            <span className="text-xs text-green-800 font-mono">total monthly bills</span>
            <span className="text-sm font-black font-mono text-green-700">— / mo</span>
          </div>
        </div>

        {/* Savings Goals preview */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <PiggyBank className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Savings Goals</span>
            <span className="ml-auto text-xs text-green-800 font-mono">no goals set yet</span>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            {[
              { label: "Emergency Fund",  target: "$5,000",  icon: Wallet, color: "bg-green-500/20"  },
              { label: "Vacation Fund",   target: "—",       icon: Plane,  color: "bg-blue-500/20"   },
            ].map(({ label, target, icon: Icon, color }) => (
              <div key={label} className="flex flex-col gap-3 p-4 rounded-xl border border-green-500/15 bg-black/30">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full ${color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <span className="text-sm font-mono font-bold text-green-500">{label}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono text-green-800 mb-1">
                    <span>$0 saved</span>
                    <span>target {target}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-green-500/10">
                    <div className="h-full w-0 rounded-full bg-green-500/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it will work */}
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
          <Wallet className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-700 font-mono">
            <span className="text-green-500 font-semibold">AI-powered insights coming.</span> Once bills and income are entered, the AI will analyze spending patterns, flag unusual charges, and suggest monthly adjustments to hit savings goals faster.
          </p>
        </div>

      </main>
    </div>
  );
}
