import { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Header } from "./Header";
import { AppSidebar } from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <Header />
          <div className="px-4 md:px-8 py-6">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
