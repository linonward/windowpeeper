import { ImageResponse } from "next/og";
import { projectConfig } from "project.config";
import { PANES } from "@/components/layout/logo-mark";

// The size social sites expect. Each opengraph-image route exports these.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Values of --background, --foreground, --muted-foreground, --primary and
// --primary-hover (docs/DESIGN.md).
const NIGHT = "#090c13";
const TEXT = "#f3eee4";
const MUTED = "#98a0b3";
const LAMP = "#ffb445";
const LAMP_HOVER = "#ffc56b";

// The preview image a shared link shows: the lit window and the project
// name, a title and a line of text, on the night canvas with a lamp glow
// (docs/DESIGN.md, Logo).
// `photo`, a data URL of a 16:9 result made with the product, goes beside
// the title in place of the text.
// The default font is Geist; next/og fetches Noto Sans from Google Fonts
// for characters Geist lacks, such as Chinese.
export function ogImage({
  title,
  description,
  locale,
  photo,
}: {
  title: string;
  description: string;
  locale: string;
  photo?: string;
}) {
  return new ImageResponse(
    (
      <div
        lang={locale}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: NIGHT,
          color: TEXT,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 48,
            padding: "56px 80px",
            backgroundImage:
              "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(255, 180, 69, 0.16), rgba(255, 180, 69, 0))",
          }}
        >
          <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34 }}>
              <svg width={48} height={48} viewBox="0 0 28 28">
                <rect width={28} height={28} rx={3} fill={LAMP} />
                {PANES.map(({ x, y, lit }) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width={10} height={10} rx={1} fill={lit ? LAMP_HOVER : NIGHT} />
                ))}
              </svg>
              {projectConfig.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  display: "block",
                  fontSize: photo ? 56 : 68,
                  lineHeight: 1.1,
                  letterSpacing: -1.5,
                  lineClamp: photo ? 4 : 2,
                }}
              >
                {title}
              </div>
              {!photo && (
                <div style={{ display: "block", fontSize: 30, color: MUTED, lineHeight: 1.4, lineClamp: 3 }}>
                  {description}
                </div>
              )}
            </div>
          </div>
          {photo && (
            // 16:9, beside the title.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={560} height={315} style={{ borderRadius: 16 }} />
          )}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
