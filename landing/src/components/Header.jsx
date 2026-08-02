const NAV_LINKS = ["Find Talent", "How It Works", "Blog", "Pricing"];
const LOGIN_URL = "https://talent-h-rprocess.vercel.app/login";

function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#000" />
      <rect x="10" y="10" width="12" height="12" rx="2" transform="rotate(45 16 16)" fill="#fff" />
    </svg>
  );
}

export default function Header({ onOpenVideo }) {
  return (
    <header className="site-header anim-fade-down">
      <div className="site-header-inner">
        <div className="header-left">
          <a href="#" className="logo-mark" aria-label="People Hire">
            <LogoMark />
            <span className="logo-word font-display">People Hire</span>
          </a>
          <nav className="nav-links">
            {NAV_LINKS.map((label) =>
              label === "How It Works" ? (
                <a key={label} href="#" className="nav-link" onClick={(e) => { e.preventDefault(); onOpenVideo(); }}>
                  {label}
                </a>
              ) : (
                <a key={label} href="#" className="nav-link">
                  {label}
                </a>
              )
            )}
          </nav>
        </div>
        <div className="header-right">
          <a href={LOGIN_URL} className="nav-link nav-link-light">
            Log In
          </a>
          <div className="btn-border-wrap">
            <a href={LOGIN_URL} className="btn btn-fill-left">
              <span className="btn-content">Join Now</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
