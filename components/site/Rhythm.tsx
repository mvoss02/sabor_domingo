import type { Settings } from "@/lib/types";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

const OPEN_NOTES = [
  "Menu is live. Early orders get first choice.",
  "Plan the week. The 10-meal pack is popular now.",
  "We start counting kilos and calling suppliers.",
];

function buildWeek(settings: Settings) {
  const openIdx = DAY_ORDER.indexOf(settings.open_day);
  const closeIdx = DAY_ORDER.indexOf(settings.close_day);
  let openNoteIdx = 0;

  return DAY_ORDER.map((day) => {
    const isClose = day === settings.close_day;
    const isCook = day === settings.cook_day;
    const isDelivery = settings.delivery_days.includes(day);
    const isOpenDay = day === settings.open_day;
    const idx = DAY_ORDER.indexOf(day);
    const inOpenWindow = openIdx !== -1 && closeIdx !== -1 && idx >= openIdx && idx <= closeIdx;

    if (isClose) {
      return {
        short: SHORT[day as keyof typeof SHORT],
        title: "Orders close",
        note: `Cut-off at ${settings.cutoff_time}. After that the list is final.`,
        bg: "#f2a63b",
        fg: "#4a1519",
      };
    }
    if (isCook) {
      return {
        short: SHORT[day as keyof typeof SHORT],
        title: "Cooking day",
        note: isDelivery
          ? "Market at dawn, pots on all day, first deliveries in the evening."
          : "Market at dawn, pots on all day.",
        bg: "#c8492a",
        fg: "#fdf6e8",
      };
    }
    if (isDelivery && isOpenDay) {
      return {
        short: SHORT[day as keyof typeof SHORT],
        title: "Deliver + open",
        note: "Last deliveries go out and the next menu opens.",
        bg: "#2e6b3e",
        fg: "#fdf6e8",
      };
    }
    if (isDelivery) {
      return {
        short: SHORT[day as keyof typeof SHORT],
        title: "Delivery",
        note: "Second round across the city.",
        bg: "#2e6b3e",
        fg: "#fdf6e8",
      };
    }
    if (inOpenWindow) {
      const note = OPEN_NOTES[openNoteIdx % OPEN_NOTES.length];
      openNoteIdx += 1;
      return {
        short: SHORT[day as keyof typeof SHORT],
        title: "Orders open",
        note,
        bg: "#ece0cb",
        fg: "#3d1f18",
      };
    }
    return {
      short: SHORT[day as keyof typeof SHORT],
      title: day,
      note: "",
      bg: "#ece0cb",
      fg: "#3d1f18",
    };
  });
}

export default function Rhythm({ settings }: { settings: Settings }) {
  const week = buildWeek(settings);
  const deliveryDays = settings.delivery_days;
  const firstDelivery = deliveryDays[0] ?? settings.cook_day;
  const lastDelivery = deliveryDays[deliveryDays.length - 1] ?? settings.cook_day;

  return (
    <section
      id="howitworks"
      style={{
        background: "#5e1d22",
        color: "#fdf6e8",
        padding: "clamp(38px, 6vw, 82px) clamp(16px, 4vw, 44px)",
      }}
    >
      <div style={{ maxWidth: 1360, margin: "0 auto" }}>
        <p
          style={{
            fontFamily: "'Caveat Brush', cursive",
            fontSize: "clamp(21px, 2.8vw, 28px)",
            color: "#f2a63b",
            margin: "0 0 8px",
          }}
        >
          el ritmo de la semana
        </p>
        <h2
          style={{
            fontWeight: 700,
            fontSize: "clamp(28px, 5vw, 50px)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            margin: "0 0 12px",
            maxWidth: "22ch",
          }}
        >
          One kitchen, one cooking day.
        </h2>
        <p
          style={{
            fontSize: "clamp(15px, 1.6vw, 17.5px)",
            color: "#e0cdb8",
            maxWidth: "58ch",
            margin: "0 0 38px",
            lineHeight: 1.65,
          }}
        >
          We are not a restaurant and we don&apos;t cook on demand. We cook once a week, the way it
          is done at home — big clay pots, slow, all at once.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 42 }}>
          {week.map((day) => (
            <div
              key={day.short}
              style={{
                flex: "1 1 118px",
                minWidth: 0,
                borderRadius: 12,
                padding: "16px 14px",
                minHeight: 140,
                display: "flex",
                flexDirection: "column",
                background: day.bg,
                color: day.fg,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  opacity: 0.75,
                  marginBottom: 12,
                }}
              >
                {day.short}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, marginBottom: 6 }}>
                  {day.title}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, opacity: 0.82 }}>{day.note}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "clamp(20px, 3vw, 40px)",
            borderTop: "1px solid #7c3a35",
            paddingTop: 34,
          }}
        >
          <div style={{ flex: "1 1 230px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 32, color: "#ece0cb", lineHeight: 1, letterSpacing: "-0.02em" }}>
              01
            </div>
            <h3 style={{ fontWeight: 600, fontSize: 19, margin: "10px 0 8px" }}>
              You order {settings.open_day} → {settings.close_day}
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#e0cdb8", margin: 0 }}>
              Pick a 4-meal or 10-meal pack, choose your dishes, pay by card. The list closes{" "}
              {settings.close_day} at {settings.cutoff_time} and opens again {settings.open_day}{" "}
              morning.
            </p>
          </div>
          <div style={{ flex: "1 1 230px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 32, color: "#e8724f", lineHeight: 1, letterSpacing: "-0.02em" }}>
              02
            </div>
            <h3 style={{ fontWeight: 600, fontSize: 19, margin: "10px 0 8px" }}>
              We cook on {settings.cook_day}
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#e0cdb8", margin: 0 }}>
              Market in the morning, kitchen all day. We only buy and cook what was actually
              ordered — nothing frozen, no waste.
            </p>
          </div>
          <div style={{ flex: "1 1 230px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 32, color: "#7fae86", lineHeight: 1, letterSpacing: "-0.02em" }}>
              03
            </div>
            <h3 style={{ fontWeight: 600, fontSize: 19, margin: "10px 0 8px" }}>
              Delivered {firstDelivery} → {lastDelivery}
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#e0cdb8", margin: 0 }}>
              Choose your day at checkout. Meals arrive portioned and sealed with reheating notes
              — fridge for 4 days, freezer for a month.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
