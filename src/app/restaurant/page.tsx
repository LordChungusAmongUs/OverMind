import Sidebar from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package,
  Users,
  ClipboardList,
  DollarSign,
  ShoppingCart,
  BarChart2,
} from "lucide-react";

const modules = [
  { icon: Package, title: "Inventory", description: "Track stock levels and get low-stock alerts" },
  { icon: ShoppingCart, title: "Ordering", description: "Purchase orders and vendor price comparisons" },
  { icon: Users, title: "Scheduling", description: "Staff schedules and labor cost tracking" },
  { icon: ClipboardList, title: "Prep Lists", description: "Daily prep tasks based on sales projections" },
  { icon: DollarSign, title: "P&L Reports", description: "Daily, weekly, and monthly profit & loss" },
  { icon: BarChart2, title: "Price Comparison", description: "Compare ingredient costs across vendors" },
];

export default function RestaurantPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-56 flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">King&apos;s BBQ, Burgers, & More</h1>
          <p className="text-muted-foreground mt-1">Archdale, NC · Lexington BBQ · Smash Burgers · Fried Chicken · Quesadillas · Breakfast Biscuits</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {modules.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="opacity-60">
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
