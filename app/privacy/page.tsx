import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Realist collects, what other members can see, who we share it with, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <div className="prose-notes mt-6 text-[15px]">
        <p className="text-ink-faint">Last updated: September 2026</p>
        <p>
          Realist is a set of tools for Canadian real estate investors. This page says, in plain language, what we
          collect when you use it, what other people can see, who we share it with, and what you can change. It is
          written to meet Canada&rsquo;s privacy law (PIPEDA) and anti-spam law (CASL).
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your email address and, if you give them, your name, phone number, city,
            province and what you&rsquo;re looking to buy. If you set a password we store only a one-way hash of it; if
            you sign in with Google we store the identifier Google gives us, not your Google password.
          </li>
          <li>
            <strong>Your analyses:</strong> the deals you underwrite — the address or MLS&reg; number, the numbers you
            entered, the starting numbers we offered, and your call on the deal (pursue, watch, pass).
          </li>
          <li>
            <strong>Saved deals and your power-team checklist.</strong>
          </li>
          <li>
            <strong>Requests you send us:</strong> when you ask for a showing, an offer, financing, an introduction to a
            professional, a second opinion, or event invitations, we keep what you typed, the property it was about, the
            numbers you were looking at, the page you sent it from, and any campaign tags (UTM) in the link that brought
            you.
          </li>
          <li>
            <strong>Meetup RSVPs:</strong> your name and email, and which event. You finish the RSVP on Meetup.com, under
            Meetup&rsquo;s own privacy policy.
          </li>
          <li>
            <strong>A record of your consent</strong> to marketing email — when you gave it, where, and when you
            withdrew it.
          </li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use two of our own: one that keeps you signed in, and one anonymous identifier that remembers the deals
          you underwrote before creating an account, so they are waiting for you when you do. We do not currently use
          advertising cookies or third-party analytics trackers.
        </p>

        <h2>What other members can see</h2>
        <ul>
          <li>
            <strong>The leaderboard and your track-record page</strong> show you as your first name and last initial,
            your city, how many deals you have underwritten, your streak and badges, the markets you look at, and the
            cap rates and calls on your recent analyses — by market only.{" "}
            <strong>
              They never show an address, an MLS&reg; number, your email, your phone number or your surname.
            </strong>{" "}
            You can step off the leaderboard and remove your public page at any time in your{" "}
            <Link href="/account">account</Link>.
          </li>
          <li>
            <strong>Community numbers on a listing</strong> (for example a median rent) are medians across members,
            shown only once at least three members have worked that deal. They never show who.
          </li>
          <li>
            <strong>An analysis you choose to share</strong> by link shows your numbers, under your first name and last
            initial, to anyone who has the link.
          </li>
        </ul>

        <h2>How the tools learn</h2>
        <p>
          When enough different members in a market change the same starting number — a vacancy rate, or our rent
          estimate — the next person in that market starts from the median of what those members used. This only ever
          uses aggregates: a value needs at least five members behind it, and no individual&rsquo;s numbers are shown
          to anyone.
        </p>

        <h2>How we use your information</h2>
        <ul>
          <li>To run the tools, keep your history, and show you where you stand.</li>
          <li>
            To answer what you asked for. A person on our team reads every request, and we email you a confirmation
            with a link to your account.
          </li>
          <li>
            To send sign-in and confirmation emails, which are part of the service. We send marketing email — meetup
            announcements, product updates, a weekly note about your track record — only if you have agreed to it.
            Every such email has a one-press unsubscribe that works without signing in.
          </li>
          <li>
            To notice when a member is actively underwriting deals, so our team can offer help. This uses how many
            deals you have analysed, not their contents.
          </li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We do not sell personal information. We share it only as follows:</p>
        <ul>
          <li>
            <strong>Service providers</strong> that run the site for us: hosting and database (Vercel, Neon), email
            delivery (Resend), and our customer-relationship system (GoHighLevel), where your contact details, your
            requests and tags describing your interests are kept so our team can follow up.
          </li>
          <li>
            <strong>The professionals you ask to meet.</strong> When you request a showing, an offer, financing or an
            introduction, we pass your request to the brokerage, agent or mortgage broker who will act on it — our own
            team near Toronto, or a referral partner in your market. Realtors and mortgage brokers in our network pay
            Realist a referral fee when a deal closes or funds; this is how the tools stay free, and it is disclosed to
            you in writing before you sign anything with them.
          </li>
          <li>
            <strong>Keypr, our cash-back brokerage partner</strong> — only if you tick the box that says so on an
            Ontario request, and then only your name, email and phone number. Referral fees on introductions
            are received by Valery Real Estate Inc.
          </li>
          <li>
            <strong>Anthropic</strong>, when you ask for an AI-written deal memo or run the multiplex underwriter: the
            property and the numbers are sent to be written up. Your name, email and phone number are not.
          </li>
          <li>
            <strong>Maps and photos.</strong> When you open the listings map or a listing, your browser loads
            map tiles from OpenFreeMap and listing photos from REALTOR.ca&rsquo;s servers. As with any website,
            they see your IP address; we send them nothing else about you.
          </li>
          <li>When the law requires it.</li>
        </ul>
        <p>Some of these providers process data outside Canada, including in the United States.</p>

        <h2>Listing data</h2>
        <p>
          MLS&reg; listing content comes from the REALTOR.ca Data Distribution Facility (DDF&reg;) under licence from
          CREA. Rent and yield figures shown on listings are our estimates, not the listing brokerage&rsquo;s.
        </p>

        <h2>Keeping it safe, and for how long</h2>
        <p>
          Passwords are stored as one-way hashes, sign-in links work once, and access to member data is restricted to
          the people who need it. We keep your account and analyses until you ask us to delete them, and requests you
          send for as long as needed to act on them and to meet our legal obligations.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            See and correct your details in your <Link href="/account">account</Link>.
          </li>
          <li>Leave the leaderboard and remove your public page there too.</li>
          <li>Turn marketing email off there, or from the unsubscribe link in any email.</li>
          <li>
            Ask for a copy of your information, or for your account and its data to be deleted, by emailing{" "}
            <a href="mailto:privacy@realist.ca">privacy@realist.ca</a>.
          </li>
        </ul>

        <h2>Contact</h2>
        <p>
          Questions or complaints about privacy: <a href="mailto:privacy@realist.ca">privacy@realist.ca</a>. If we
          can&rsquo;t resolve it, you may contact the Office of the Privacy Commissioner of Canada.
        </p>
      </div>
    </article>
  );
}
