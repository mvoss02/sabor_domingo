-- Promotion codes: a customer can redeem a Stripe promotion code (SABOR10)
-- in Checkout on sessions that carry no automatic coupon, so Stripe may
-- charge less than the price we computed. Two numbers from now on:
--   `total`       our quoted price at checkout
--                 (subtotal - discount - promo_discount + fee), frozen.
--   `amount_paid` what Stripe actually charged (session.amount_total),
--                 written by the webhook in the same update that flips the
--                 order to 'paid'. total - amount_paid = the code discount.
-- Supersedes the 0009 note that `total` is what the customer paid: refunds,
-- revenue and the emails read amount_paid.
--
-- Null until paid: a pending or abandoned order has paid nothing yet, and 0
-- would claim a free order. No upper check against `total`: if Stripe ever
-- charged more (tax switched on), a failed constraint would leave a real
-- payment stuck as pending.
alter table orders add column amount_paid numeric(8,2) check (amount_paid >= 0);

-- Every order paid before codes existed was charged exactly `total`.
update orders set amount_paid = total where status in ('paid', 'refunded');
