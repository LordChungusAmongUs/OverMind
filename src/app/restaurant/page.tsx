import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  Package,
  Users,
  ClipboardList,
  DollarSign,
  ShoppingCart,
  BarChart2,
  Clock,
  Puzzle,
} from "lucide-react";

const hours = [
  { day: "Mon – Fri", open: "6:30 AM", close: "3:00 PM" },
  { day: "Sat – Sun", open: "7:00 AM", close: "3:00 PM" },
];

const modules = [
  { icon: Package, title: "Inventory", description: "Track stock levels, counts, and auto-generate orders", href: "/restaurant/inventory", active: true },
  { icon: ShoppingCart, title: "Ordering", description: "Purchase orders and vendor price comparisons", href: null, active: false },
  { icon: Users, title: "Scheduling", description: "Staff schedules and labor cost tracking", href: null, active: false },
  { icon: ClipboardList, title: "Prep Lists", description: "Daily prep tasks based on sales projections", href: null, active: false },
  { icon: DollarSign, title: "P&L Reports", description: "Daily, weekly, and monthly profit & loss", href: null, active: false },
  { icon: BarChart2, title: "Price Comparison", description: "Compare ingredient costs across vendors", href: null, active: false },
];

export default function RestaurantPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">King&apos;s BBQ, Burgers, & More</h1>
          <p className="text-muted-foreground mt-1">
            Archdale, NC · Lexington BBQ · Smash Burgers · Fried Chicken · Quesadillas · Breakfast Biscuits
          </p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-6">
          {/* Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-primary" /> Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hours.map(({ day, open, close }) => (
                  <div key={day} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{day}</span>
                    <span className="font-medium">{open} – {close}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Staff */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" /> Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">~15</p>
              <p className="text-sm text-muted-foreground mt-1">employees total</p>
              <div className="mt-3 space-y-1">
                {[
                  "2 Waitresses",
                  "2 Grill Cooks",
                  "2 Line Cooks",
                  "1 Biscuit Maker",
                  "1 Drive-Thru",
                ].map((role) => (
                  <p key={role} className="text-xs text-muted-foreground">· {role}</p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Sellers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart2 className="w-4 h-4 text-primary" /> Top Sellers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { rank: 1, item: "Tenderloin Biscuit" },
                  { rank: 2, item: "Cheeseburger" },
                ].map(({ rank, item }) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-primary w-4">#{rank}</span>
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">More data once Figure POS connected</p>
            </CardContent>
          </Card>

          {/* Figure POS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Puzzle className="w-4 h-4 text-primary" /> Figure POS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
                Pending setup
              </span>
              <p className="text-sm text-muted-foreground mt-3">
                Chrome extension required. Sign in manually — I&apos;ll scrape the rest.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Modules */}
        <div className="grid grid-cols-3 gap-4">
          {modules.map(({ icon: Icon, title, description, href, active }) => {
            const inner = (
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${active ? "bg-primary/10" : "bg-secondary"}`}>
                  <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
                {active && <span className="mt-2 inline-block text-xs text-primary font-medium">Open →</span>}
              </CardContent>
            );
            return href ? (
              <Link key={title} href={href}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">{inner}</Card>
              </Link>
            ) : (
              <Card key={title} className="opacity-50">{inner}</Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
