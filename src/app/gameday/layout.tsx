// ─────────────────────────────────────────────────────────────────────────────
// Gameday layout.
//
// The only job here is to set the theme BEFORE first paint. Without this the
// page renders light, then snaps to dark once React hydrates — a white flash
// straight into the eyes of somebody watching football at 11pm.
// ─────────────────────────────────────────────────────────────────────────────

const NO_FLASH_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("gameday.viewer.v1");
    var theme = raw ? (JSON.parse(raw).theme || "dark") : "dark";
    var dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
      document.documentElement.style.backgroundColor = "#0a0e17";
    }
  } catch (e) {
    // Storage blocked — fall through to the default light render.
  }
})();
`;

export default function GamedayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      {children}
    </>
  );
}
