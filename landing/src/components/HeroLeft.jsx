import TypewriterHeading from "./TypewriterHeading.jsx";

const SIGNUP_URL = "https://talent-h-rprocess.vercel.app/login";

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HeroLeft({ onOpenVideo }) {
  return (
    <div className="hero-left anim-fade-up">
      <TypewriterHeading
        darkText="Unlock Your Next Great Hire You Thought Was Impossible to Find — Now"
        lightText=" Just One Click Away!"
      />

      <div className="btn-border-wrap hero-cta-wrap anim-delayed" style={{ animationDelay: "3.2s" }}>
        <a href={SIGNUP_URL} className="btn btn-cta btn-fill-right">
          <span className="btn-content">
            Find Talent
            <ArrowIcon />
          </span>
        </a>
      </div>

      {/* Desktop shows the video via the header nav link; on mobile that nav
          is hidden entirely, so this is the only way to reach it there. */}
      <button type="button" className="hero-video-cta-mobile" onClick={onOpenVideo}>
        ▶ How It Works
      </button>
    </div>
  );
}
