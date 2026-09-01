import { NextRequest, NextResponse } from "next/server";

// Demo gate: active only while DEMO_PASSWORD is set (delete the env var to launch).
// Excludes /api/py/* so Stripe webhooks and checkout keep working.

const OPEN_PATHS = [/^\/api\/py\//, /^\/_next\//, /^\/img\//, /^\/icon\.svg$/, /^\/favicon/];

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function gatePage(error = ""): Response {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Sabor Domingo</title></head>
<body style="margin:0;background:#5e1d22;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
<form method="POST" action="/gate" style="max-width:340px;width:100%;padding:24px;text-align:center">
<div style="font-weight:700;font-size:26px;color:#fdf6e8;letter-spacing:0.08em">SABOR</div>
<div style="font-size:15px;color:#f2a63b;margin:2px 0 24px">Domingo &middot; coming soon</div>
<input type="password" name="pw" placeholder="Password" autofocus
 style="width:100%;box-sizing:border-box;padding:14px 12px;border-radius:9px;border:1px solid #7c3a35;background:#4a1519;color:#fdf6e8;font-size:15px;margin-bottom:12px">
<button type="submit" style="width:100%;padding:15px;border-radius:999px;border:none;background:#c8492a;color:#fdf6e8;font-weight:600;font-size:15px;cursor:pointer">Enter</button>
${error ? `<p style="color:#f2a63b;font-size:13px;margin:12px 0 0">${error}</p>` : ""}
</form></body></html>`;
  return new Response(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}

export async function middleware(req: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((r) => r.test(pathname))) return NextResponse.next();

  const expected = await sha256Hex(password);
  if (req.cookies.get("sd_demo")?.value === expected) return NextResponse.next();

  if (pathname === "/gate" && req.method === "POST") {
    const form = await req.formData().catch(() => null);
    if (form?.get("pw") === password) {
      const res = NextResponse.redirect(new URL("/", req.url), 303);
      res.cookies.set("sd_demo", expected, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return res;
    }
    return gatePage("Wrong password — try again");
  }

  return gatePage();
}
