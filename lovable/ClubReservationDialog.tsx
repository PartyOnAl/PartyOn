import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Minus, Plus, Check, Loader2, Wine, Clock, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Club } from "@/types";

type Step = "select" | "details" | "confirm";

const TABLE_OPTIONS = [
  { id: "standard", label: "Standard Table", seats: 4, minSpend: 0, description: "Main floor seating" },
  { id: "vip", label: "VIP Table", seats: 6, minSpend: 150, description: "Elevated area, priority service" },
  { id: "premium", label: "Premium Booth", seats: 8, minSpend: 400, description: "Private booth, dedicated server" },
];

const TIME_SLOTS = ["20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];

interface Props {
  club: Club;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClubReservationDialog = ({ club, open, onOpenChange }: Props) => {
  const [step, setStep] = useState<Step>("select");
  const [selectedTable, setSelectedTable] = useState(TABLE_OPTIONS[0].id);
  const [guests, setGuests] = useState(2);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>();
  const [processing, setProcessing] = useState(false);

  const table = TABLE_OPTIONS.find((t) => t.id === selectedTable)!;

  const handleConfirm = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep("confirm");
    }, 1500);
  };

  const reset = () => {
    setStep("select");
    setSelectedTable(TABLE_OPTIONS[0].id);
    setGuests(2);
    setDate(undefined);
    setTime(undefined);
    setProcessing(false);
  };

  const canProceed = date && time;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 overflow-hidden max-h-[90vh] overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center gap-2">
                  <Wine className="h-5 w-5 text-accent" /> Reserve a Table
                </DialogTitle>
                <DialogDescription>{club.name} · Free entrance</DialogDescription>
              </DialogHeader>

              {/* Table selection */}
              <div className="space-y-2.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Table Type</Label>
                {TABLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSelectedTable(opt.id); setGuests(Math.min(guests, opt.seats)); }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
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
                        {opt.minSpend > 0 ? (
                          <>
                            <p className="text-[10px] text-muted-foreground">min. spend</p>
                            <p className="font-display font-bold text-sm">€{opt.minSpend}</p>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">No minimum</Badge>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">up to {opt.seats} guests</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Date & time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal border-border/50 bg-secondary/50", !date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "MMM d") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        disabled={(d) => d < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Time</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal border-border/50 bg-secondary/50", !time && "text-muted-foreground")}>
                        <Clock className="mr-2 h-4 w-4" />
                        {time || "Pick time"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="grid grid-cols-2 gap-1">
                        {TIME_SLOTS.map((t) => (
                          <Button key={t} variant={time === t ? "default" : "ghost"} size="sm" className={time === t ? "bg-accent text-accent-foreground" : ""} onClick={() => setTime(t)}>
                            {t}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Guests */}
              <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/50">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Guests</Label>
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

              {table.minSpend > 0 && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Wine className="h-3 w-3 text-accent" />
                  This table has a minimum spend of €{table.minSpend}, payable at the venue
                </p>
              )}

              <Button
                className="w-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
                size="lg"
                onClick={() => setStep("details")}
                disabled={!canProceed}
              >
                Continue
              </Button>
            </motion.div>
          )}

          {step === "details" && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Your Details</DialogTitle>
                <DialogDescription>
                  {table.label} · {date && format(date, "MMM d")} at {time} · {guests} guest{guests > 1 ? "s" : ""}
                </DialogDescription>
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
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input placeholder="you@email.com" className="bg-secondary/50 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Special Requests (optional)</Label>
                  <Input placeholder="Birthday, anniversary, dietary needs..." className="bg-secondary/50 border-border/50" />
                </div>
              </div>

              {table.minSpend > 0 && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
                  <p className="text-accent font-medium text-xs">Minimum spend: €{table.minSpend}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">No upfront payment — settle at the venue</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-border/50" size="lg" onClick={() => setStep("select")} disabled={processing}>
                  Back
                </Button>
                <Button className="flex-1 bg-accent text-accent-foreground font-semibold hover:bg-accent/90" size="lg" onClick={handleConfirm} disabled={processing}>
                  {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Reserving…</> : "Confirm Reservation"}
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
                <h3 className="font-display text-2xl font-bold">You're All Set!</h3>
                <p className="text-muted-foreground text-sm">
                  Your table at <span className="text-foreground font-medium">{club.name}</span> is reserved
                </p>
              </div>
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-2 text-sm text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">Reservation #</span><span className="font-mono text-xs">TR-{Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{date && format(date, "EEEE, MMM d")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{time}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Table</span><span className="font-medium">{table.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span className="font-medium">{guests}</span></div>
                {table.minSpend > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Min. spend</span><span className="font-medium">€{table.minSpend} (at venue)</span></div>
                )}
                <Separator className="bg-border/50" />
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">Confirmed</Badge></div>
              </div>
              <p className="text-[11px] text-muted-foreground">A confirmation has been sent to your email</p>
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
