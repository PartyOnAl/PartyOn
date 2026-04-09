import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Minus, Plus, Check, Loader2, ShieldCheck, CreditCard, Wine, Clock } from "lucide-react";
import type { Event } from "@/types";

type Step = "select" | "payment" | "confirm";

const TABLE_OPTIONS = [
  { id: "standard", label: "Standard Table", seats: 4, price: 100, description: "Main floor, great view of the DJ" },
  { id: "vip", label: "VIP Table", seats: 6, price: 250, description: "Elevated platform, bottle service included" },
  { id: "premium", label: "Premium Booth", seats: 8, price: 500, description: "Private booth, dedicated server, premium bottles" },
];

interface Props {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TableReservationDialog = ({ event, open, onOpenChange }: Props) => {
  const [step, setStep] = useState<Step>("select");
  const [selectedTable, setSelectedTable] = useState(TABLE_OPTIONS[0].id);
  const [guests, setGuests] = useState(2);
  const [processing, setProcessing] = useState(false);

  const table = TABLE_OPTIONS.find((t) => t.id === selectedTable)!;
  const total = table.price;
  const deposit = Math.round(total * 0.3);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep("confirm");
    }, 2200);
  };

  const reset = () => {
    setStep("select");
    setSelectedTable(TABLE_OPTIONS[0].id);
    setGuests(2);
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <Wine className="h-5 w-5 text-accent" /> Reserve a Table
                </DialogTitle>
                <DialogDescription>{event.title}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {TABLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedTable(opt.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedTable === opt.id
                        ? "border-accent bg-accent/10"
                        : "border-border/50 bg-secondary/30 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{opt.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold">{event.currency}{opt.price}</p>
                        <p className="text-[10px] text-muted-foreground">up to {opt.seats} guests</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Number of Guests</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 border-border/50" onClick={() => setGuests(Math.max(1, guests - 1))} disabled={guests <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-display text-lg font-bold w-8 text-center">{guests}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 border-border/50" onClick={() => setGuests(Math.min(table.seats, guests + 1))} disabled={guests >= table.seats}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">max {table.seats}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>{table.label}</span><span>{event.currency}{total}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Deposit (30%)</span><span>{event.currency}{deposit}</span></div>
                <Separator className="bg-border/50" />
                <div className="flex justify-between font-semibold text-base"><span>Due now</span><span>{event.currency}{deposit}</span></div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Remaining {event.currency}{total - deposit} paid at venue</p>
              </div>

              <Button className="w-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90" size="lg" onClick={() => setStep("payment")}>
                Continue to Payment
              </Button>
            </motion.div>
          )}

          {step === "payment" && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-accent" /> Payment
                </DialogTitle>
                <DialogDescription>{table.label} · Deposit {event.currency}{deposit}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <Input placeholder="John Doe" className="bg-secondary/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                  <Input placeholder="+355 69 123 4567" className="bg-secondary/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Card Number</Label>
                  <Input placeholder="4242 4242 4242 4242" className="bg-secondary/50 border-border/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Expiry</Label>
                    <Input placeholder="MM / YY" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">CVC</Label>
                    <Input placeholder="123" className="bg-secondary/50 border-border/50" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                <span>Payments secured with 256-bit SSL encryption</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-border/50" size="lg" onClick={() => setStep("select")} disabled={processing}>
                  Back
                </Button>
                <Button className="flex-1 bg-accent text-accent-foreground font-semibold hover:bg-accent/90" size="lg" onClick={handlePay} disabled={processing}>
                  {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</> : `Pay ${event.currency}${deposit}`}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 space-y-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="mx-auto w-16 h-16 rounded-full bg-accent flex items-center justify-center">
                <Check className="h-8 w-8 text-accent-foreground" />
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-bold">Table Reserved!</h3>
                <p className="text-muted-foreground text-sm">
                  {table.label} for {guests} guest{guests > 1 ? "s" : ""} at <span className="text-foreground font-medium">{event.title}</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2 text-sm text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">Reservation #</span><span className="font-mono text-xs">TR-{Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span className="font-medium">{event.currency}{deposit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-medium">{event.currency}{total - deposit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">Confirmed</Badge></div>
              </div>
              <Button className="w-full" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
