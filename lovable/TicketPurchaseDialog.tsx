import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Minus, Plus, Check, Loader2, ShieldCheck } from "lucide-react";
import type { Event } from "@/types";

type Step = "select" | "payment" | "confirm";

interface Props {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TicketPurchaseDialog = ({ event, open, onOpenChange }: Props) => {
  const [step, setStep] = useState<Step>("select");
  const [qty, setQty] = useState(1);
  const [processing, setProcessing] = useState(false);

  const total = qty * event.price;
  const fee = Math.round(total * 0.05 * 100) / 100;

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep("confirm");
    }, 2200);
  };

  const reset = () => {
    setStep("select");
    setQty(1);
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Select Tickets</DialogTitle>
                <DialogDescription>{event.title}</DialogDescription>
              </DialogHeader>

              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">General Admission</p>
                    <p className="text-xs text-muted-foreground">{event.ticketsLeft} remaining</p>
                  </div>
                  <p className="font-display text-lg font-bold">{event.currency}{event.price}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" className="h-8 w-8 border-border/50" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="font-display text-lg font-bold w-8 text-center">{qty}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 border-border/50" onClick={() => setQty(Math.min(10, qty + 1))} disabled={qty >= 10}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{event.currency}{total}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Service fee</span><span>{event.currency}{fee}</span></div>
                <Separator className="bg-border/50" />
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{event.currency}{(total + fee).toFixed(2)}</span></div>
              </div>

              <Button className="w-full gradient-primary text-primary-foreground font-semibold" size="lg" onClick={() => setStep("payment")}>
                Continue to Payment
              </Button>
            </motion.div>
          )}

          {step === "payment" && (
            <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" /> Payment
                </DialogTitle>
                <DialogDescription>{qty}× ticket · {event.currency}{(total + fee).toFixed(2)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input placeholder="you@email.com" className="bg-secondary/50 border-border/50" />
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
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>Payments secured with 256-bit SSL encryption</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-border/50" size="lg" onClick={() => setStep("select")} disabled={processing}>
                  Back
                </Button>
                <Button className="flex-1 gradient-primary text-primary-foreground font-semibold" size="lg" onClick={handlePay} disabled={processing}>
                  {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</> : `Pay ${event.currency}${(total + fee).toFixed(2)}`}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 space-y-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
                <Check className="h-8 w-8 text-primary-foreground" />
              </motion.div>
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-bold">You're In!</h3>
                <p className="text-muted-foreground text-sm">
                  {qty} ticket{qty > 1 ? "s" : ""} for <span className="text-foreground font-medium">{event.title}</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2 text-sm text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-mono text-xs">NX-{Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{event.currency}{(total + fee).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Confirmed</Badge></div>
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
