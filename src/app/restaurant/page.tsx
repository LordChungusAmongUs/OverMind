import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import {
  Package, Users, ClipboardList, DollarSign,
  ShoppingCart, BarChart2, Clock, Puzzle,
} from "lucide-react";

const hours = [
  { day: "Mon – Fri", open: "6:30 AM", close: "3:00 PM" },
  { day: "Sat – Sun", open: "7:00 AM", close: "3:00 PM" },
];

const modules = [
  { icon: Package,      title: "Inventory",         description: "Stock levels, counts, auto-generate orders",   href: "/restaurant/inventory", active: true  },
  { icon: ShoppingCart, title: "Ordering",           description: "Purchase orders and vendor price comparisons", href: null,                    active: false },
  { icon: Users,        title: "Scheduling",         description: "Staff schedules and labor cost tracking",      href: null,                    active: false },
  { icon: ClipboardList,title: "Prep Lists",         description: "Daily prep tasks based on sales projections",  href: null,                    active: false },
  { icon: DollarSign,   title: "P&L Reports",        description: "Daily, weekly, and monthly profit & loss",     href: null,                    active: false },
  { icon: BarChart2,    title: "Price Comparison",   description: "Compare ingredient costs across vendors",      href: null,                    active: false },
];

const staffRoles = ["2 Waitresses", "2 Grill Cooks", "2 Line Cooks", "1 Biscuit Maker", "1 Drive-Thru"];

export default function RestaurantPage() {
  return (
    <div className="flex min-h-screen crt">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-green-600 font-mono tracking-widest uppercase mb-1">
            <span className="text-red-500">&gt;</span> restaurant_os.exe
          </p>
          <h1 className="text-3xl font-black font-mono text-green-300">King&apos;s BBQ, Burgers, &amp; More</h1>
          <p className="text-green-700 text-sm font-mono mt-1">
            Archdale, NC · Lexington BBQ · Smash Burgers · Fried Chicken · Quesadillas · Breakfast Biscuits
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">

          {/* Hours */}
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-500 uppercase tracking-wider">Hours</span>
            </div>
            <div className="space-y-2">
              {hours.map(({ day, open, close }) => (
                <div key={day} className="flex items-center justify-between">
                  <span className="text-xs text-green-700 font-mono">{day}</span>
                  <span className="text-xs font-mono font-semibold text-green-400">{open} – {close}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Staff */}
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-500 uppercase tracking-wider">Staff</span>
            </div>
            <p className="text-3xl font-black font-mono text-green-300">~15</p>
            <p className="text-xs text-green-700 font-mono mb-2">employees total</p>
            <div className="space-y-1">
              {staffRoles.map(role => (
                <p key={role} className="text-xs text-green-700 font-mono">
                  <span className="text-red-500">›</span> {role}
                </p>
              ))}
            </div>
          </div>

          {/* Top Sellers */}
          <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-mono font-semibold text-green-500 uppercase tracking-wider">Top Sellers</span>
            </div>
            {[
              { rank: 1, item: "Tenderloin Biscuit" },
              { rank: 2, item: "Cheeseburger" },
            ].map(({ rank, item }) => (
              <div key={item} className="flex items-center gap-2 mb-2">
                <span className="text-xs font-black font-mono text-green-400">#{rank}</span>
                <span className="text-sm font-mono text-green-300">{item}</span>
              </div>
            ))}
            <p className="text-xs text-green-800 font-mono mt-2">More data once POS connected</p>
          </div>

          {/* Figure POS */}
          <div className="holo-card rounded-xl border border-yellow-500/20 bg-black/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Puzzle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-mono font-semibold text-yellow-600 uppercase tracking-wider">Figure POS</span>
            </div>
            <span className="text-xs px-2 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 font-mono">
              PENDING SETUP
            </span>
            <p className="text-xs text-green-800 font-mono mt-3">
              Chrome extension required.<br />Sign in manually — I&apos;ll scrape the rest.
            </p>
          </div>
        </div>

        {/* Module grid */}
        <p className="text-xs text-green-700 font-mono uppercase tracking-widest mb-3">
          <span className="text-red-500">&gt;</span> modules
        </p>
        <div className="grid grid-cols-3 gap-4">
          {modules.map(({ icon: Icon, title, description, href, active }) => {
            const card = (
              <div className={`holo-card rounded-xl border p-5 transition-all ${
                active
                  ? "border-green-500/30 bg-black/40 hover:border-green-400/50 cursor-pointer"
                  : "border-green-500/10 bg-black/20 opacity-40 cursor-default"
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 border ${
                  active ? "bg-green-500/10 border-green-500/30" : "bg-black/20 border-green-500/10"
                }`}>
                  <Icon className={`w-5 h-5 ${active ? "text-green-400" : "text-green-800"}`} />
                </div>
                <h3 className={`font-bold font-mono mb-1 ${active ? "text-green-300" : "text-green-700"}`}>{title}</h3>
                <p className="text-xs text-green-700 font-mono">{description}</p>
                {active && (
                  <span className="mt-3 inline-block text-xs text-green-400 font-mono font-semibold">
                    <span className="text-red-500">&gt;</span> OPEN
                  </span>
                )}
                {!active && (
                  <span className="mt-3 inline-block text-xs text-green-900 font-mono">[ LOCKED ]</span>
                )}
              </div>
            );
            return href ? <Link key={title} href={href}>{card}</Link> : <div key={title}>{card}</div>;
          })}
        </div>

      </main>
    </div>
  );
}
