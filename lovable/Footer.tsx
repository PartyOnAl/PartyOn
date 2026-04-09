import { Link } from "react-router-dom";
import { PartyPopper, Instagram, Facebook, Twitter, Youtube, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="border-t border-border/30 bg-card/30">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand & about */}
          <div className="space-y-4">
            <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              <span className="text-foreground">Party</span>
              <span className="text-primary">On</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Albania's premier nightlife platform. Discover clubs, book tickets, reserve tables — all in one place. Your night starts here.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {[Instagram, Facebook, Twitter, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider">Explore</h4>
            <nav className="flex flex-col gap-2.5">
              {[
                { label: "Events", to: "/events" },
                { label: "Clubs", to: "/clubs" },
                { label: "Promotions", to: "/#promotions" },
                { label: "My Dashboard", to: "/dashboard" },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider">Support</h4>
            <nav className="flex flex-col gap-2.5">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Help Center</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a>
              <a href="mailto:hello@partyon.al" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                hello@partyon.al
              </a>
            </nav>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider">Stay in the Loop</h4>
            <p className="text-sm text-muted-foreground">Get the hottest events and exclusive promos straight to your inbox.</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-10 px-4 rounded-lg bg-secondary/60 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <Button size="icon" className="h-10 w-10 gradient-primary shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/20">
        <div className="container py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2026 PartyOn. Albania's nightlife, simplified.</p>
          <p>Made with 💜 in Tirana</p>
        </div>
      </div>
    </footer>
  );
}
