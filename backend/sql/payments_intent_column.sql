-- Stripe PaymentIntent id (pi_...) written on checkout.session.completed (see event.service handleEvent).
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS intent text NULL;
