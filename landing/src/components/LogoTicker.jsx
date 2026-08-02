// Inline SVG marks + name, not hotlinked images — nothing here depends on a
// third-party asset host staying up.
const COMPANIES = [
  { name: "Nexora", icon: <rect x="3" y="3" width="18" height="18" rx="5" /> },
  { name: "Cursive", icon: <circle cx="12" cy="12" r="9" /> },
  { name: "Lumen", icon: <path d="M12 3L21 20H3L12 3Z" strokeLinejoin="round" /> },
  { name: "Frostline", icon: <path d="M4 20V10L12 4L20 10V20H14V14H10V20H4Z" strokeLinejoin="round" /> },
  { name: "Vantage", icon: <path d="M12 2L14.5 9H21.5L15.8 13.5L18 21L12 16.5L6 21L8.2 13.5L2.5 9H9.5L12 2Z" strokeWidth="1.4" strokeLinejoin="round" /> },
];
// Repeated 4x back-to-back for a seamless scroll loop.
const TRACK = [...COMPANIES, ...COMPANIES, ...COMPANIES, ...COMPANIES];

export default function LogoTicker() {
  return (
    <div className="logo-ticker anim-delayed" style={{ animationDelay: "0.6s" }}>
      <div className="logo-ticker-mask">
        <div className="logo-ticker-track">
          {TRACK.map((c, i) => (
            <div key={i} className="logo-ticker-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" aria-hidden="true">
                {c.icon}
              </svg>
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
