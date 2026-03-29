# Meetup Hosts - Realist.ca Onboarding

Priority: HIGH - These hosts pay $250/month and need accounts.

## Hosts

| Name | Location | Email | Status |
|------|----------|-------|--------|
| Daniel Foch | Toronto, ON | danielfoch@gmail.com | ✓ Has account |
| James Anderson | Vancouver, BC | **NEEDED** | Pending |
| Sylvia Castonguay | Calgary, AB | **NEEDED** | Pending |
| LJ Aguinaga | Montreal, QC | **NEEDED** | Pending |
| Cameron Biroux | Moncton, NB | **NEEDED** | Pending |

**⚠️ ACTION REQUIRED:** Only Daniel has email on file. Need contact info for 4 other hosts.

## Database Schema (to add to PostgreSQL)

```sql
-- Meetup Hosts table
CREATE TABLE meetup_hosts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  province TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  monthly_fee_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO meetup_hosts (name, email, location, province, bio, photo_url) VALUES
('Daniel Foch', 'danielfoch@gmail.com', 'Toronto', 'ON', 'Host & Lead - Canadian Real Estate Investor Podcast', '/images/hosts/daniel.jpg'),
('James Anderson', 'JAMES_NEED_EMAIL', 'Vancouver', 'BC', 'BC Market Expert', '/images/hosts/james.jpg'),
('Sylvia Castonguay', 'SYLVIA_NEED_EMAIL', 'Calgary', 'AB', 'Alberta Market Expert', '/images/hosts/sylvia.jpg'),
('LJ Aguinaga', 'LJ_NEED_EMAIL', 'Montreal', 'QC', 'Quebec Market Expert', '/images/hosts/lj.jpg'),
('Cameron Biroux', 'CAMERON_NEED_EMAIL', 'Moncton', 'NB', 'New Brunswick Market Expert', '/images/hosts/cameron.jpg');
```

## Events Page Updates

**Route:** `/community/events` or `/events`

Add "Local Hosts" section:
```jsx
// Component: LocalHostsSection
const hosts = await db.query('SELECT * FROM meetup_hosts WHERE is_active = true');

return (
  <section className="local-hosts">
    <h2>🇨🇦 Local Hosts</h2>
    <div className="hosts-grid">
      {hosts.map(host => (
        <HostCard 
          name={host.name}
          location={host.location}
          bio={host.bio}
          photo={host.photo_url}
        />
      ))}
    </div>
  </section>
);
```

## Email Templates

### Invitation Email (for hosts without accounts)

**Subject:** Welcome to Realist.ca - Your Host Account

**Body:**
```
Hi [NAME],

As one of our valued meetup hosts paying $250/month, I wanted to personally invite you to Realist.ca.

Your hosts:
- Daniel Foch (Toronto) - already on platform
- James Anderson (Vancouver)
- Sylvia Castonguay (Calgary)
- LJ Aguinaga (Montreal)
- Cameron Biroux (Moncton)

What you get:
✓ Free premium access
✓ Your profile displayed on realist.ca/community/events
✓ Lead routing from investors in your market
✓ Deal analysis tool for your events

Next steps:
1. Go to https://realist.ca/signup
2. Use your email: [EMAIL]
3. I'll upgrade you to premium manually

Let me know if you have any questions!

Best,
Daniel

--
Realist.ca - Canadian Real Estate Deal Intelligence
```

## Tasks

- [ ] **CRITICAL:** Get email addresses for James, Sylvia, LJ, Cameron
- [ ] Add meetup_hosts table to PostgreSQL (Replit DB)
- [ ] Create seed data with hosts
- [ ] Build Local Hosts section on /community/events page
- [ ] Email each host personally (Daniel already has account)
- [ ] Give premium access to all hosts
- [ ] Verify hosts appear on events page