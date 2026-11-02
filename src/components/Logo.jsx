/**
 * Logoet: "Just nails" i guld-skråskrift med et lille hjerte og "BY AK" under.
 *
 * Har I logoet som billedfil? Læg den i /public som logo.png (gerne med gennemsigtig
 * baggrund) og skift LOGO_IMAGE herunder til '/logo.png'. Så bruges billedet overalt.
 */
const LOGO_IMAGE = null;

export default function Logo({ size = 'md' }) {
  if (LOGO_IMAGE) {
    return <img className={`logo-img logo-${size}`} src={LOGO_IMAGE} alt="Just Nails by AK" />;
  }
  return (
    <div className={`logo logo-${size}`} role="img" aria-label="Just Nails by AK">
      <div className="logo-script">
        <span>Just nails</span>
        <svg className="logo-heart" viewBox="0 0 24 22" aria-hidden="true">
          <defs>
            <linearGradient id="goldHeart" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F3DFA8" />
              <stop offset="0.55" stopColor="#D4AF6A" />
              <stop offset="1" stopColor="#A9823F" />
            </linearGradient>
          </defs>
          <path
            d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.1 4 6.1 4c2.4 0 3.9 1.5 5.9 3.6C14 5.5 15.5 4 17.9 4c4 0 5.8 4.4 4.1 7.7C19.5 16.4 12 21 12 21z"
            fill="url(#goldHeart)"
          />
        </svg>
      </div>
      <div className="logo-by">BY AK</div>
    </div>
  );
}
