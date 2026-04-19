"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";
import {
  DollarSign, Receipt, TrendingUp, PiggyBank,
  CreditCard, ArrowUpRight, ArrowDownRight, Plus, X, Loader2,
  Check, ChevronDown, ChevronUp, Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bill {
  id: string;
  name: string;
  amount: number;
  due_day: number | null;
  category: string;
  last_paid_month: string | null;
  created_at: string;
}

interface Income {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  created_at: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  saved: number;
  emoji: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BILL_CATEGORIES = ["Housing", "Utilities", "Transport", "Food", "Subscriptions", "Insurance", "Health", "Entertainment", "Shopping", "Other"];
const FREQUENCIES = ["monthly", "biweekly", "weekly", "annual"];

const BLANK_BILL = { name: "", amount: "", due_day: "", category: "Other" };
const BLANK_INCOME = { name: "", amount: "", frequency: "monthly" };
const BLANK_GOAL = { name: "", target: "", saved: "", emoji: "🎯" };

function toMonthly(amount: number, frequency: string): number {
  if (frequency === "biweekly") return (amount * 26) / 12;
  if (frequency === "weekly") return (amount * 52) / 12;
  if (frequency === "annual") return amount / 12;
  return amount;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBillForm, setShowBillForm] = useState(false);
  const [newBill, setNewBill] = useState({ ...BLANK_BILL });
  const [savingBill, setSavingBill] = useState(false);

  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [newIncome, setNewIncome] = useState({ ...BLANK_INCOME });
  const [savingIncome, setSavingIncome] = useState(false);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ ...BLANK_GOAL });
  const [savingGoal, setSavingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editSaved, setEditSaved] = useState("");

  const [billError, setBillError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [showBills, setShowBills] = useState(true);
  const [showIncome, setShowIncome] = useState(true);

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: b }, { data: inc }, { data: g }] = await Promise.all([
      supabase.from("budget_bills").select("*").order("created_at"),
      supabase.from("budget_income").select("*").order("created_at"),
      supabase.from("budget_savings_goals").select("*").order("created_at"),
    ]);
    setBills(b ?? []);
    setIncome(inc ?? []);
    setGoals(g ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const thisMonth = currentMonth();
  const totalBills = bills.reduce((s, b) => s + Number(b.amount), 0);
  const totalMonthlyIncome = income.reduce((s, i) => s + toMonthly(Number(i.amount), i.frequency), 0);
  const netFlow = totalMonthlyIncome - totalBills;
  const totalSaved = goals.reduce((s, g) => s + Number(g.saved), 0);
  const paidCount = bills.filter(b => b.last_paid_month === thisMonth).length;

  // ── Bill actions ───────────────────────────────────────────────────────────

  async function addBill() {
    if (!newBill.name.trim() || !newBill.amount) return;
    setSavingBill(true);
    setBillError(null);
    const { data, error } = await supabase.from("budget_bills").insert({
      name: newBill.name.trim(),
      amount: parseFloat(newBill.amount),
      due_day: newBill.due_day ? parseInt(newBill.due_day) : null,
      category: newBill.category,
    }).select().single();
    if (error) { setBillError(error.message); setSavingBill(false); return; }
    if (data) setBills(prev => [...prev, data]);
    setNewBill({ ...BLANK_BILL });
    setShowBillForm(false);
    setSavingBill(false);
  }

  async function deleteBill(id: string) {
    await supabase.from("budget_bills").delete().eq("id", id);
    setBills(prev => prev.filter(b => b.id !== id));
  }

  async function togglePaid(bill: Bill) {
    const isPaid = bill.last_paid_month === thisMonth;
    const newVal = isPaid ? null : thisMonth;
    await supabase.from("budget_bills").update({ last_paid_month: newVal }).eq("id", bill.id);
    setBills(prev => prev.map(b => b.id === bill.id ? { ...b, last_paid_month: newVal } : b));
  }

  // ── Income actions ─────────────────────────────────────────────────────────

  async function addIncome() {
    if (!newIncome.name.trim() || !newIncome.amount) return;
    setSavingIncome(true);
    setIncomeError(null);
    const { data, error } = await supabase.from("budget_income").insert({
      name: newIncome.name.trim(),
      amount: parseFloat(newIncome.amount),
      frequency: newIncome.frequency,
    }).select().single();
    if (error) { setIncomeError(error.message); setSavingIncome(false); return; }
    if (data) setIncome(prev => [...prev, data]);
    setNewIncome({ ...BLANK_INCOME });
    setShowIncomeForm(false);
    setSavingIncome(false);
  }

  async function deleteIncome(id: string) {
    await supabase.from("budget_income").delete().eq("id", id);
    setIncome(prev => prev.filter(i => i.id !== id));
  }

  // ── Goal actions ───────────────────────────────────────────────────────────

  async function addGoal() {
    if (!newGoal.name.trim() || !newGoal.target) return;
    setSavingGoal(true);
    setGoalError(null);
    const { data, error } = await supabase.from("budget_savings_goals").insert({
      name: newGoal.name.trim(),
      target: parseFloat(newGoal.target),
      saved: newGoal.saved ? parseFloat(newGoal.saved) : 0,
      emoji: newGoal.emoji || "🎯",
    }).select().single();
    if (error) { setGoalError(error.message); setSavingGoal(false); return; }
    if (data) setGoals(prev => [...prev, data]);
    setNewGoal({ ...BLANK_GOAL });
    setShowGoalForm(false);
    setSavingGoal(false);
  }

  async function deleteGoal(id: string) {
    await supabase.from("budget_savings_goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  async function updateSaved(goal: SavingsGoal) {
    const val = parseFloat(editSaved);
    if (isNaN(val)) return;
    await supabase.from("budget_savings_goals").update({ saved: val }).eq("id", goal.id);
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, saved: val } : g));
    setEditingGoal(null);
    setEditSaved("");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
            Bills · income · expenses · savings goals
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Income</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">
              {loading ? "—" : fmt(totalMonthlyIncome)}
            </p>
            <p className="text-xs text-green-800 font-mono mt-1">/ month</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Bills</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">
              {loading ? "—" : fmt(totalBills)}
            </p>
            <p className="text-xs text-green-800 font-mono mt-1">{paidCount}/{bills.length} paid</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Net Flow</span>
            </div>
            <p className={`text-2xl font-black font-mono ${netFlow >= 0 ? "text-green-300" : "text-red-400"}`}>
              {loading ? "—" : fmt(netFlow)}
            </p>
            <p className="text-xs text-green-800 font-mono mt-1">income − bills</p>
          </div>
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider">Saved</span>
            </div>
            <p className="text-2xl font-black font-mono text-green-300">
              {loading ? "—" : fmt(totalSaved)}
            </p>
            <p className="text-xs text-green-800 font-mono mt-1">across all goals</p>
          </div>
        </div>

        {/* Bills */}
        <div className="holo-card rounded-xl border border-green-400/30 bg-black/40 glow-border mb-6">
          <button
            onClick={() => setShowBills(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5"
          >
            <Receipt className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Bills &amp; Expenses</span>
            <span className="ml-auto flex items-center gap-2 text-xs text-green-700 font-mono">
              {fmt(totalBills)}/mo
              {showBills ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {showBills && (
            <>
              {bills.length === 0 && !showBillForm && (
                <p className="text-xs text-green-800 font-mono px-5 py-4">No bills entered yet.</p>
              )}

              {bills.length > 0 && (
                <div className="divide-y divide-green-500/10">
                  {bills.map(bill => {
                    const isPaid = bill.last_paid_month === thisMonth;
                    return (
                      <div key={bill.id} className="flex items-center gap-3 px-5 py-3 hover:bg-green-500/5 transition-colors">
                        <button
                          onClick={() => togglePaid(bill)}
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            isPaid
                              ? "border-green-400 bg-green-500/20 text-green-400"
                              : "border-green-500/30 text-transparent hover:border-green-500/60"
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-mono font-bold ${isPaid ? "line-through text-green-800" : "text-green-300"}`}>
                            {bill.name}
                          </p>
                          <p className="text-xs text-green-800 font-mono">
                            {bill.category}{bill.due_day ? ` · due ${bill.due_day}${ordinal(bill.due_day)}` : ""}
                          </p>
                        </div>
                        <span className={`text-sm font-black font-mono ${isPaid ? "text-green-800" : "text-green-400"}`}>
                          {fmt(bill.amount)}
                        </span>
                        <button
                          onClick={() => deleteBill(bill.id)}
                          className="text-green-900 hover:text-red-500 transition-colors ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add bill form */}
              {showBillForm && (
                <div className="px-5 py-4 border-t border-green-500/10 bg-black/20">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Bill name *"
                      value={newBill.name}
                      onChange={e => setNewBill(p => ({ ...p, name: e.target.value }))}
                    />
                    <input
                      type="number"
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Amount *"
                      value={newBill.amount}
                      onChange={e => setNewBill(p => ({ ...p, amount: e.target.value }))}
                    />
                    <input
                      type="number"
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Due day (1–31)"
                      value={newBill.due_day}
                      onChange={e => setNewBill(p => ({ ...p, due_day: e.target.value }))}
                    />
                    <select
                      className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                      value={newBill.category}
                      onChange={e => setNewBill(p => ({ ...p, category: e.target.value }))}
                    >
                      {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {billError && <p className="text-xs text-red-400 font-mono mb-2">{billError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={addBill}
                      disabled={savingBill || !newBill.name.trim() || !newBill.amount}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-xs hover:bg-green-500/20 transition-all disabled:opacity-40"
                    >
                      {savingBill ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add Bill
                    </button>
                    <button onClick={() => setShowBillForm(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="px-5 py-3 border-t border-green-500/10 flex justify-between items-center bg-black/20">
                <button
                  onClick={() => { setShowBillForm(v => !v); }}
                  className="flex items-center gap-1 text-xs font-mono text-green-700 hover:text-green-400 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add bill
                </button>
                <span className="text-sm font-black font-mono text-green-500">{fmt(totalBills)}/mo</span>
              </div>
            </>
          )}
        </div>

        {/* Income */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <button
            onClick={() => setShowIncome(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5"
          >
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Income Sources</span>
            <span className="ml-auto flex items-center gap-2 text-xs text-green-700 font-mono">
              {fmt(totalMonthlyIncome)}/mo
              {showIncome ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {showIncome && (
            <>
              {income.length === 0 && !showIncomeForm && (
                <p className="text-xs text-green-800 font-mono px-5 py-4">No income sources added yet.</p>
              )}

              {income.length > 0 && (
                <div className="divide-y divide-green-500/10">
                  {income.map(src => (
                    <div key={src.id} className="flex items-center gap-3 px-5 py-3 hover:bg-green-500/5 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-bold text-green-300">{src.name}</p>
                        <p className="text-xs text-green-800 font-mono">
                          {fmt(src.amount)} {src.frequency} · {fmt(toMonthly(src.amount, src.frequency))}/mo
                        </p>
                      </div>
                      <button
                        onClick={() => deleteIncome(src.id)}
                        className="text-green-900 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showIncomeForm && (
                <div className="px-5 py-4 border-t border-green-500/10 bg-black/20">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Source name *"
                      value={newIncome.name}
                      onChange={e => setNewIncome(p => ({ ...p, name: e.target.value }))}
                    />
                    <input
                      type="number"
                      className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                      placeholder="Amount *"
                      value={newIncome.amount}
                      onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))}
                    />
                    <select
                      className="col-span-2 bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-green-400/60"
                      value={newIncome.frequency}
                      onChange={e => setNewIncome(p => ({ ...p, frequency: e.target.value }))}
                    >
                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  {incomeError && <p className="text-xs text-red-400 font-mono mb-2">{incomeError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={addIncome}
                      disabled={savingIncome || !newIncome.name.trim() || !newIncome.amount}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-xs hover:bg-green-500/20 transition-all disabled:opacity-40"
                    >
                      {savingIncome ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add Source
                    </button>
                    <button onClick={() => setShowIncomeForm(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="px-5 py-3 border-t border-green-500/10 flex justify-between items-center bg-black/20">
                <button
                  onClick={() => setShowIncomeForm(v => !v)}
                  className="flex items-center gap-1 text-xs font-mono text-green-700 hover:text-green-400 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add source
                </button>
                <span className="text-sm font-black font-mono text-green-500">{fmt(totalMonthlyIncome)}/mo</span>
              </div>
            </>
          )}
        </div>

        {/* Savings Goals */}
        <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-6">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-green-500/20 bg-green-500/5">
            <PiggyBank className="w-4 h-4 text-green-400" />
            <span className="text-sm font-mono font-black uppercase tracking-widest gradient-text">Savings Goals</span>
            <span className="ml-auto text-xs text-green-700 font-mono">{fmt(totalSaved)} saved</span>
          </div>

          <div className="p-5 space-y-3">
            {goals.length === 0 && !showGoalForm && (
              <p className="text-xs text-green-800 font-mono">No goals set yet.</p>
            )}

            {goals.map(goal => {
              const pct = goal.target > 0 ? Math.min(100, (goal.saved / goal.target) * 100) : 0;
              const monthsLeft = netFlow > 0 && goal.saved < goal.target
                ? Math.ceil((goal.target - goal.saved) / netFlow)
                : null;
              return (
                <div key={goal.id} className="p-4 rounded-xl border border-green-500/15 bg-black/30">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{goal.emoji}</span>
                    <span className="text-sm font-mono font-bold text-green-400">{goal.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => { setEditingGoal(goal); setEditSaved(String(goal.saved)); }}
                        className="text-green-800 hover:text-green-500 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="text-green-900 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingGoal?.id === goal.id ? (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="number"
                        className="flex-1 bg-black/60 border border-green-500/30 rounded-lg px-3 py-1.5 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                        placeholder="Amount saved"
                        value={editSaved}
                        onChange={e => setEditSaved(e.target.value)}
                      />
                      <button
                        onClick={() => updateSaved(goal)}
                        className="px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-xs hover:bg-green-500/20 transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoal(null)}
                        className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  <div className="flex justify-between text-xs font-mono text-green-700 mb-1.5">
                    <span>{fmt(goal.saved)} saved</span>
                    <span>target {fmt(goal.target)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-green-500/10 mb-1.5">
                    <div
                      className="h-full rounded-full bg-green-500/50 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-green-800">
                    <span>{pct.toFixed(0)}% complete</span>
                    {monthsLeft !== null && (
                      <span>{monthsLeft} mo at current net flow</span>
                    )}
                    {goal.saved >= goal.target && (
                      <span className="text-green-400 font-bold">GOAL REACHED!</span>
                    )}
                  </div>
                </div>
              );
            })}

            {showGoalForm && (
              <div className="p-4 rounded-xl border border-green-400/20 bg-black/30">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Goal name *"
                    value={newGoal.name}
                    onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Emoji"
                    value={newGoal.emoji}
                    onChange={e => setNewGoal(p => ({ ...p, emoji: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Target amount *"
                    value={newGoal.target}
                    onChange={e => setNewGoal(p => ({ ...p, target: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="bg-black/60 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono placeholder-green-800 focus:outline-none focus:border-green-400/60"
                    placeholder="Already saved"
                    value={newGoal.saved}
                    onChange={e => setNewGoal(p => ({ ...p, saved: e.target.value }))}
                  />
                </div>
                {goalError && <p className="text-xs text-red-400 font-mono mb-2">{goalError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={addGoal}
                    disabled={savingGoal || !newGoal.name.trim() || !newGoal.target}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-300 font-mono font-bold text-xs hover:bg-green-500/20 transition-all disabled:opacity-40"
                  >
                    {savingGoal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add Goal
                  </button>
                  <button onClick={() => setShowGoalForm(false)} className="text-xs font-mono text-green-800 hover:text-green-600 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={() => setShowGoalForm(v => !v)}
              className="flex items-center gap-1 text-xs font-mono text-green-700 hover:text-green-400 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add savings goal
            </button>
          </div>
        </div>

        {/* Net Flow Summary */}
        {(bills.length > 0 || income.length > 0) && (
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border font-mono ${
            netFlow >= 0
              ? "border-green-500/20 bg-green-500/5"
              : "border-red-500/20 bg-red-500/5"
          }`}>
            <CreditCard className={`w-5 h-5 flex-shrink-0 ${netFlow >= 0 ? "text-green-400" : "text-red-400"}`} />
            <div>
              <p className={`text-sm font-bold ${netFlow >= 0 ? "text-green-300" : "text-red-400"}`}>
                {netFlow >= 0
                  ? `${fmt(netFlow)}/mo left after bills`
                  : `${fmt(Math.abs(netFlow))}/mo over budget`}
              </p>
              <p className="text-xs text-green-800 mt-0.5">
                {fmt(totalMonthlyIncome)} income − {fmt(totalBills)} bills
              </p>
            </div>
            {netFlow > 0 && goals.length > 0 && (
              <div className="ml-auto text-right">
                <p className="text-xs text-green-600">if you save {fmt(netFlow)}/mo</p>
                <p className="text-xs text-green-800">goals funded in {Math.ceil((goals.reduce((s,g) => s + Math.max(0, g.target - g.saved), 0)) / netFlow)} mo</p>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
