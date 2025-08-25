import { NavLink } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageToggle } from "@/components/ui/language-toggle";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Analysis", to: "/analysis" },
  { label: "Training", to: "/training" },
  { label: "Pricing", to: "/pricing" },
];

export const Header = () => {

  return (
    <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="ml-1" />
          <div className="font-extrabold tracking-tight text-xl text-gradient-brand hover-scale">
            TryElliottWave
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm ${
                    isActive ? "bg-accent text-foreground" : "hover:bg-accent/60"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button variant="glass" size="icon" aria-label="Notifications">
            <Bell />
          </Button>
          <div className="w-8 h-8 rounded-full bg-gradient-primary shadow-glow" aria-label="User avatar" />
        </div>
      </div>
    </header>
  );
};
