import Sidebar from "@/components/layout/Sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Package,
  Users,
  ClipboardList,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";

const modules = [
  {
    icon: Package,
    title: "Inventory",
    description: "Track stock levels, set par levels, get low-stock alerts",
    status: "Connect Figure POS",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: ShoppingCart,
    title: "Ordering",
    description: "Create purchase orders, compare vendor prices, track deliveries",
    status: "Connect Figure POS",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Users,
    title: "Scheduling",
    description: "Staff schedules, shift management, labor cost tracking",
    status: "Connect Figure POS",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: ClipboardList,
    title: "Prep Lists",
    description: "Daily prep tasks auto-generated from sales projections",
    status: "Connect Figure POS",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: DollarSign,
    title: "P&L Reports",
    description: "Daily, weekly, monthly profit & loss with cost breakdowns",
    status: "Connect Figure POS",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: AlertTriangle,
    title: "Price Comparison",
    description: "Compare ingredient costs across vendors, flag savings opportunities",
    status: "Connect Figure POS",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
];

export default function RestaurantPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Restaurant</h1>
          <p className="text-muted-foreground mt-1">
            Manage your restaurant — powered by Figure POS
          </p>
        </div>

        {/* Setup Banner */}
        <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Figure POS Connection Required</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              To enable live data, I need your Figure POS credentials and restaurant URL.
              Add them in Settings → Integrations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {modules.map(({ icon: Icon, title, description, status, color, bg }) => (
            <Card
              key={title}
              className="hover:border-primary/30 transition-colors cursor-pointer"
            >
              <CardContent className="p-5">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{description}</p>
                <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                  {status}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
