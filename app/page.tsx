import CurrentYear from "./current-year";
import Link from "next/link";

const courts = [
  {
    id: "court-01",
    name: "Court 01",
    type: "Outdoor Court",
    price: 300,
    image:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85",
    tag: "POPULAR",
  },
  {
    id: "court-02",
    name: "Court 02",
    type: "Outdoor Court",
    price: 300,
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85",
    tag: "AVAILABLE FOR BOOKING",
  },
  {
    id: "court-03",
    name: "Court 03",
    type: "Outdoor Court",
    price: 300,
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=85",
    tag: "GREAT FOR DOUBLES",
  },
];

const services = [
  {
    number: "01",
    icon: "▦",
    title: "Book a Court",
    description:
      "Find a time that works for you and reserve one of our 20 pickleball courts in General Santos City.",
    link: "#courts",
    action: "Explore courts",
  },
  {
    number: "02",
    icon: "↗",
    title: "Rent Equipment",
    description:
      "Need a paddle or other playing equipment? Check rental options before heading to the court.",
    link: "/equipment",
    action: "Explore rentals",
  },
  {
    number: "03",
    icon: "＋",
    title: "Top Up Your Card",
    description:
      "Add funds to your PCKL+ membership card and keep your facility transactions organized.",
    link: "#membership",
    action: "Manage your card",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="PCKL+ home">
          PCKL<span>+</span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-active" href="/">
            Home
          </Link>
          <a href="#courts">Courts</a>
          <a href="#services">Services</a>
          <a href="#location">Location</a>
        </nav>

        <div className="header-actions">
          <a className="login-link" href="/login">
            Log in
          </a>
          <a className="button button-lime button-small" href="/register">
            Get started <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-photo" role="img" aria-label="Pickleball court and net" />

        <div className="hero-overlay" />

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            YOUR GAME. YOUR COURT.
          </div>

          <h1>
            Find your
            <br />
            <span>court.</span> Own
            <br />
            your game.
          </h1>

          <p className="hero-description">
            Your next pickleball game starts here. Book a court, rent
            equipment, and manage your membership — all in one place.
          </p>

          <div className="hero-actions">
            <a className="button button-lime" href="#courts">
              Book a court <span aria-hidden="true">↗</span>
            </a>
            <a className="button button-outline" href="#services">
              Explore PCKL+
            </a>
          </div>

          <div className="hero-stats">
            <div>
              <strong>20</strong>
              <span>Pickleball courts</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>01</strong>
              <span>Convenient location</span>
            </div>
            <div className="stat-divider" />
            <div>
              <strong>100%</strong>
              <span>Made for your game</span>
            </div>
          </div>
        </div>

        <div className="booking-card">
          <div className="booking-card-top">
            <div>
              <span className="small-label">READY TO PLAY?</span>
              <h2>Find your court</h2>
            </div>
            <span className="booking-icon" aria-hidden="true">
              ↗
            </span>
          </div>

          <form action="/courts" method="get" className="booking-form">
            <label htmlFor="location">Location</label>
            <div className="input-with-icon">
              <span aria-hidden="true">⌖</span>
              <input
                id="location"
                name="location"
                value="General Santos City"
                readOnly
                aria-label="Facility location"
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="booking-date">Date</label>
                <input
                  id="booking-date"
                  type="date"
                  name="date"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="booking-time">Start time</label>
                <select
                  id="booking-time"
                  name="time"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select time
                  </option>
                  <option value="07:00">7:00 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="20:00">8:00 PM</option>
                </select>
              </div>
            </div>

            <button className="button button-lime booking-submit" type="submit">
              Find a court <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="booking-note">
            <span aria-hidden="true">●</span> One location. Twenty courts.
          </p>
        </div>

        <div className="hero-caption">
          <span className="caption-line" />
          <span>PLAY MORE. PLAN LESS.</span>
        </div>
      </section>

      <section className="trust-strip" aria-label="PCKL+ benefits">
        <div className="trust-item">
          <span className="trust-symbol">01</span>
          <div>
            <strong>Easy reservations</strong>
            <span>Plan your next match</span>
          </div>
        </div>
        <div className="trust-item">
          <span className="trust-symbol">02</span>
          <div>
            <strong>Equipment rentals</strong>
            <span>Get game-ready</span>
          </div>
        </div>
        <div className="trust-item">
          <span className="trust-symbol">03</span>
          <div>
            <strong>Membership card</strong>
            <span>Manage your balance</span>
          </div>
        </div>
        <div className="trust-location">
          <span aria-hidden="true">⌖</span> GENERAL SANTOS CITY
        </div>
      </section>

      <section className="section courts-section" id="courts">
        <div className="section-heading">
          <div>
            <p className="section-kicker">YOUR NEXT MATCH STARTS HERE</p>
            <h2>
              Meet your <span>court.</span>
            </h2>
            <p className="section-description">
              Explore our courts and find the perfect spot for your next game.
            </p>
          </div>
          <a className="text-link" href="/courts">
            View all 20 courts <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="court-grid">
          {courts.map((court) => (
            <article className="court-card" key={court.id}>
              <div className="court-image-wrap">
                <img src={court.image} alt={`${court.name} pickleball court`} />
                <span className="court-tag">{court.tag}</span>
                <span className="court-number">{court.id.replace("court-", "")}</span>
              </div>

              <div className="court-card-content">
                <div className="court-card-title">
                  <div>
                    <h3>{court.name}</h3>
                    <p>
                      <span className="location-dot" /> General Santos City
                    </p>
                  </div>
                  <span className="court-arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>

                <div className="court-card-footer">
                  <span className="court-type">{court.type}</span>
                  <span className="court-price">
                    <strong>₱{court.price}</strong>
                    <span>/ hour</span>
                  </span>
                </div>

                <a className="button button-navy court-book-button" href="/courts">
                  Check availability
                </a>
              </div>
            </article>
          ))}
        </div>

        <p className="availability-disclaimer">
          Court photos are illustrative. Prices and available time slots shown
          here are sample content and should be confirmed before launch.
        </p>
      </section>

      <section className="services-section" id="services">
        <div className="section services-inner">
          <div className="services-heading">
            <p className="section-kicker">MORE THAN A BOOKING</p>
            <h2>
              Everything you need.
              <br />
              <span>One place.</span>
            </h2>
            <p>
              From reserving your court to getting your equipment ready,
              PCKL+ helps make every visit easier.
            </p>
          </div>

          <div className="service-list">
            {services.map((service) => (
              <article className="service-card" key={service.number}>
                <span className="service-number">{service.number}</span>
                <span className="service-icon" aria-hidden="true">
                  {service.icon}
                </span>
                <div className="service-copy">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <a href={service.link}>
                    {service.action} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="membership-section" id="membership">
        <div className="membership-copy">
          <p className="section-kicker">YOUR GAME, YOUR WAY</p>
          <h2>
            Make every visit
            <br />
            <span>count.</span>
          </h2>
          <p>
            Create your PCKL+ account to manage reservations, rent equipment,
            and keep track of your membership card balance.
          </p>
          <a className="button button-navy" href="/register">
            Join PCKL+ <span aria-hidden="true">↗</span>
          </a>
          <a className="button button-navy" href="/membership/top-up">
            Top up your card <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="membership-visual">
          <div className="membership-card">
            <div className="membership-card-top">
              <span className="membership-logo">
                PCKL<span>+</span>
              </span>
              <span className="membership-chip" aria-hidden="true">
                ▦
              </span>
            </div>
            <div className="membership-card-middle">
              <span>MEMBERSHIP CARD</span>
              <strong>YOUR GAME. YOUR RULES.</strong>
            </div>
            <div className="membership-card-bottom">
              <span>PLAY MORE.</span>
              <span>GSM · PH</span>
            </div>
            <div className="card-decoration" aria-hidden="true" />
          </div>
          <p className="membership-caption">
            One account to keep your pickleball activities organized.
          </p>
        </div>
      </section>

      <section className="location-section" id="location">
        <div className="location-copy">
          <p className="section-kicker">LOCAL COURTS. BIG ENERGY.</p>
          <h2>
            See you on
            <br />
            the <span>court.</span>
          </h2>
          <p>
            PCKL+ is designed for one pickleball facility in General Santos
            City, with 20 courts to support your next match.
          </p>
          <div className="location-detail">
            <span className="location-pin" aria-hidden="true">
              ⌖
            </span>
            <div>
              <strong>General Santos City</strong>
              <span>South Cotabato, Philippines</span>
            </div>
          </div>
        </div>
        <div className="location-photo" role="img" aria-label="Outdoor sports court" />
      </section>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/">
          PCKL<span>+</span>
        </Link>
        <p>Made for the love of the game.</p>
        <div className="footer-links">
          <a href="#courts">Courts</a>
          <a href="#services">Services</a>
          <a href="/login">Log in</a>
          <a href="/register">Register</a>
        </div>
        <CurrentYear className="copyright" />
      </footer>
    </main>
  );
}