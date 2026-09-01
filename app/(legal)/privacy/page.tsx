export const metadata = { title: "Privacy — Sabor Domingo" };

const h2: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 20,
  letterSpacing: "-0.02em",
  color: "#5e1d22",
  margin: "34px 0 10px",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 style={{ fontWeight: 700, fontSize: "clamp(28px, 5vw, 40px)", letterSpacing: "-0.03em", color: "#5e1d22", margin: "18px 0 6px" }}>
        Privacy policy
      </h1>
      <p style={{ color: "#a1806f", fontSize: 13 }}>Last updated: September 2026</p>

      <p>
        Sabor Domingo (&ldquo;we&rdquo;) is a small food business in Amsterdam, run by
        [FULL NAMES], registered with the Dutch Chamber of Commerce under KvK number
        [KVK NUMBER]. This page explains what personal data we handle when you use
        sabordomingo.nl, and why. Questions: hola@sabordomingo.nl.
      </p>

      <h2 style={h2}>What we collect, and why</h2>
      <p>
        <strong>When you place an order:</strong> your name, email address, delivery address,
        postal code, phone number, your dish selection, and any notes you add (for example
        allergies). We use these only to prepare and deliver your order and to contact you
        about it. Legal basis: performance of a contract.
      </p>
      <p>
        <strong>When you pay:</strong> payment is handled entirely by Stripe. We never see or
        store your card or bank details. Stripe processes your payment data as a separate
        controller — see Stripe&rsquo;s privacy policy.
      </p>
      <p>
        <strong>When you sign up for order notifications:</strong> your email address, stored
        with our email provider Brevo. We use it only to tell you when ordering opens and what
        is on the menu. Legal basis: your consent. Every email contains an unsubscribe link,
        and unsubscribing stops these emails immediately.
      </p>
      <p>
        <strong>When you send an event inquiry:</strong> the details you submit in the form, so
        we can reply.
      </p>

      <h2 style={h2}>What we don&rsquo;t do</h2>
      <p>
        No tracking cookies, no analytics profiles, no advertising, and we never sell or share
        your data for marketing. The site stores nothing on your device beyond what is
        technically necessary.
      </p>

      <h2 style={h2}>Where your data lives</h2>
      <p>
        Order data is stored with Supabase on servers in the European Union (Frankfurt).
        Emails are sent via Brevo (EU). Payments run through Stripe. The website is hosted on
        Vercel.
      </p>

      <h2 style={h2}>How long we keep it</h2>
      <p>
        Order records are kept as long as required for Dutch tax administration (7 years).
        Notification-list emails are kept until you unsubscribe. Event inquiries are deleted
        once handled.
      </p>

      <h2 style={h2}>Your rights</h2>
      <p>
        Under the GDPR (AVG) you can ask us at any time to see, correct, or delete the data we
        hold about you, or to hand it over to you. Email hola@sabordomingo.nl and we&rsquo;ll
        sort it out. You can also complain to the Autoriteit Persoonsgegevens.
      </p>
    </>
  );
}
