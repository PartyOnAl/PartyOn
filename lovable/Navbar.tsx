import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, X, User, LogOut, LayoutDashboard, PartyPopper, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const getDashboardLink = () => {
    if (hasRole("admin")) return "/admin";
    if (hasRole("manager")) return "/manager";
    if (hasRole("hostess")) return "/hostess";
    return "/dashboard";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/30">
      <div className="container flex items-center justify-between h-16 gap-4">
        {/* Logo */}
        <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-2 shrink-0">
          <PartyPopper className="h-5 w-5 text-primary" />
          <span className="text-foreground">Party</span>
          <span className="text-primary">On</span>
        </Link>

        {/* Search bar - desktop */}
        <div className="hidden md:flex relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-10 h-9 bg-secondary/60 border-border/40 text-sm rounded-full focus-visible:ring-primary/30"
          />
        </div>

        {/* Nav links - desktop */}
        <div className="hidden md:flex items-center gap-8">
          <Link to="/events" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">Events</Link>
          <Link to="/clubs" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">Clubs</Link>
          <Link to="/#promotions" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">Promotions</Link>
        </div>

        {/* Right icons - desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground" onClick={() => navigate(getDashboardLink())}>
                <LayoutDashboard className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground" onClick={signOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground" onClick={() => navigate("/auth")}>
              <User className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground">
            <ShoppingCart className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile menu button */}
        <Button variant="ghost" size="icon" className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:hidden bg-background border-t border-border/30">
            <div className="container py-4 flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search" className="pl-10 bg-secondary/60 border-border/40 text-sm rounded-full" />
              </div>
              <Link to="/events" className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>Events</Link>
              <Link to="/clubs" className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>Clubs</Link>
              <Link to="/#promotions" className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>Promotions</Link>
              {user ? (
                <>
                  <Link to={getDashboardLink()} className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                  <Button variant="outline" size="sm" className="border-primary/30 w-full mt-2" onClick={() => { signOut(); setMobileOpen(false); }}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="border-primary/30 w-full mt-2" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>
                  <User className="h-4 w-4 mr-2" /> Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
