import { ImageResponse } from "next/og";

// iPhone / iPad home-screen icon: the Parcel Manage mark (deep green tile, white PM, gold dot).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#032017", color: "#ffffff", fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>
        PM
        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#f7bd40", marginLeft: 4, marginTop: 40 }} />
      </div>
    ),
    size,
  );
}
