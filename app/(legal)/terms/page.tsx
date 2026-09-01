export const metadata = { title: "Terms — Sabor Domingo" };

const h2: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 20,
  letterSpacing: "-0.02em",
  color: "#5e1d22",
  margin: "34px 0 10px",
};

export default function TermsPage() {
  return (
    <>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", color: "#5e1d22", margin: "18px 0 6px" }}>
        Terms &amp; conditions
      </h1>
      <p style={{ color: "#a1806f", fontSize: 13 }}>Last updated: September 2026</p>

      <p>
        These terms apply to orders placed at sabordomingo.nl, operated by Sabor Domingo,
        [FULL NAMES], Amsterdam, KvK [KVK NUMBER], BTW [BTW NUMBER], hola@sabordomingo.nl.
      </p>

      <h2 style={h2}>How ordering works</h2>
      <p>
        We take orders from Wednesday until Sunday 22:00. We cook everything fresh on Monday
        and deliver chilled meal packs on the delivery day you choose at checkout, within our
        Amsterdam delivery area. Payment is taken at the moment of ordering, via Stripe. We
        confirm your dishes by email on Monday morning after buying ingredients at the market.
      </p>

      <h2 style={h2}>Changes and cancellation</h2>
      <p>
        You can change or cancel your order free of charge until Sunday 22:00 of the order
        week — message us on Instagram or email hola@sabordomingo.nl and we adjust or refund
        in full. After the cut-off we have bought your ingredients and can no longer cancel
        the order.
      </p>
      <p>
        Because our meals are fresh, perishable food prepared to order, the statutory 14-day
        right of withdrawal for online purchases does not apply (art. 6:230p BW / EU Consumer
        Rights Directive, perishable goods exception).
      </p>

      <h2 style={h2}>Delivery</h2>
      <p>
        We deliver in the evening on the day you selected. If nobody is home, we&rsquo;ll call
        the phone number from your order and agree on a solution (neighbour, safe spot, or
        pickup). Meals arrive chilled: refrigerate promptly, keep up to 4 days in the fridge
        or 1 month in the freezer, and follow the reheating notes provided.
      </p>

      <h2 style={h2}>Allergies</h2>
      <p>
        Our kitchen handles all common allergens. List your allergies in the order notes and
        we will tell you honestly whether a dish is safe for you. When in doubt, contact us
        before ordering.
      </p>

      <h2 style={h2}>If something goes wrong</h2>
      <p>
        Not happy with an order? Tell us within 24 hours of delivery and we will make it right
        — replacement or refund. Our liability is limited to the amount you paid for the
        order. Dutch law applies.
      </p>
    </>
  );
}
