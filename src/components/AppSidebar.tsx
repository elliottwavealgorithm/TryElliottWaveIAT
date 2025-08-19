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
import { useTranslation } from "react-i18next";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  
  const items = [
    { title: t('navigation.dashboard'), url: "/", icon: Home },
    { title: t('navigation.analysis'), url: "/analysis", icon: ChartCandlestick },
    { title: t('navigation.training'), url: "/training", icon: Brain },
    { title: t('navigation.pricing'), url: "/pricing", icon: ShoppingBag },
  ];
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
                    <span className="truncate">{t('navigation.upgrade')}</span>
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
