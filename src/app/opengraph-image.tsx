import { ImageResponse } from "next/og";

export const alt =
  "Athreix Prospect AI — responsible B2B and B2C prospect intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#080706",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "58px 64px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
        <div
          style={{
            alignItems: "center",
            background: "#f3c624",
            borderRadius: 14,
            color: "#0b0a07",
            display: "flex",
            fontSize: 30,
            fontWeight: 800,
            height: 54,
            justifyContent: "center",
            width: 54,
          }}
        >
          A
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
          athreix
        </div>
        <div
          style={{
            color: "#4f4d47",
            display: "flex",
            fontSize: 22,
          }}
        >
          prospect ai
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 950 }}>
        <div
          style={{
            color: "#f3c624",
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Evidence-led prospect intelligence
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 760,
            letterSpacing: -4,
            lineHeight: 0.98,
            marginTop: 22,
          }}
        >
          Find your next customers with AI.
        </div>
        <div
          style={{
            color: "#dfdedb",
            display: "flex",
            fontSize: 27,
            lineHeight: 1.35,
            marginTop: 26,
          }}
        >
          Search, rank, explain, draft, organize, and export—across B2B and
          permissioned B2C workflows.
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid #0b0a07",
          color: "#4f4d47",
          display: "flex",
          fontSize: 18,
          justifyContent: "space-between",
          paddingTop: 22,
        }}
      >
        <span>Source-supported · Explainable · Draft-only outreach</span>
        <span>ATHREIX · PROSPECT AI</span>
      </div>
    </div>,
    size,
  );
}
