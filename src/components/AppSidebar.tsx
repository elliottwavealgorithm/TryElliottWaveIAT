import { NavLink, useLocation } from "react-router-dom";
import { Brain, ChartCandlestick, Home, ShoppingBag, Zap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Analysis", url: "/analysis", icon: ChartCandlestick },
  { title: "Training", url: "/training", icon: Brain },
  { title: "Pricing", url: "/pricing", icon: ShoppingBag },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const isExpanded = items.some((i) => isActive(i.url));

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-accent text-primary font-medium" : "hover:bg-accent/60";

  return (
    <Sidebar className={state === "collapsed" ? "w-14" : "w-60"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span className="truncate">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="#upgrade" className="hover:bg-accent/60">
                    <Zap className="mr-2 h-4 w-4" />
                    <span className="truncate">Upgrade</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
