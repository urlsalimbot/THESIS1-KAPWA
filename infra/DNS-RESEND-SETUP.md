# KAPWA — name.com DNS + Resend email setup

Goal: route transactional email (verify account, reset password, notifications)
through **Resend**, sending from the subdomain `mail.kapwa.software`. Site DNS
(`kapwa.software` / `www.kapwa.software`) is a separate track, done after the
EC2 deploy.

Two separate tracks. **Do email first** — it needs no server IP.

---

## Facts pinned

- Domain owner: typwtypw (name.com)
- DNS host: name.com (authoritative — add records in name.com DNS Management)
- Registered domain: `kapwa.software` (currently parked; NS = `ns1bcp/ns2btz/ns3npv/ns4hmp.name.com`)
- Site hostnames (later): `kapwa.software` + `www.kapwa.software`
- Email subdomain: `mail.kapwa.software`
- Send provider: Resend (SMTP relay — `EMAIL_HOST=smtp.resend.com`, port 465)
- Server: AWS EC2 + docker stack (`deploy.sh`) — **not yet deployed**

> `infra/.env.production` has been switched from the old placeholder
> `kapwa.mswdo-norzagaray.gov.ph` to `kapwa.software`, and the Resend `EMAIL_*`
> block is now active. Only `EMAIL_PASS` still needs a real value (step A4).

---

# TRACK A — Resend email (do now, zero IP needed)

## A1. Resend: add the sending domain

1. Log in at https://resend.com → **Domains** → **Add Domain**.
2. Domain: `mail.kapwa.software`
3. Region: default (US East).
4. Resend now shows the exact record set for this domain. **Copy the values
   verbatim from the dashboard — do not type them from memory or from any
   example.** DKIM host/value strings are unique per account, and Resend has
   changed their format over time (older accounts saw three `s1/s2/s3` CNAMEs;
   newer ones typically show a single `resend._domainkey` CNAME).

The typical shape is below. Treat the *host names* as illustrative and the
*values* as "whatever Resend currently displays":

| Type  | Host (relative — name.com appends `.kapwa.software`) | Value                        | TTL |
|-------|------------------------------------------------------|------------------------------|-----|
| TXT   | `mail` or `send.mail`                                | `v=spf1 include:amazonses.com ~all` | 300 |
| CNAME | `resend._domainkey.mail`                             | *(copy from Resend)*         | 300 |
| MX    | `mail` or `send.mail`                                | `10 feedback-smtp.us-east-1.amazonses.com` | 300 |

## A2. name.com: add the records

1. https://name.com/account/domain/details/kapwa.software → **DNS Records**
2. **Add Record** for each row Resend listed.
3. name.com field quirks:
   - **Host** takes the label only — enter `mail`, `resend._domainkey.mail`, etc.
     name.com appends `.kapwa.software`. Never paste the full FQDN, and don't add
     a trailing dot.
   - Use `@` for the zone apex.
   - TTL `300` is fine.
4. Save. name.com publishes within ~1–5 minutes.

### Optional but recommended — DMARC

Adds policy + reporting so mailbox providers trust the subdomain:

| Type | Host          | Value                  | TTL |
|------|---------------|------------------------|-----|
| TXT  | `_dmarc.mail` | `v=DMARC1; p=none;`    | 300 |

Start at `p=none` (monitor only); tighten to `quarantine`/`reject` once reports
look clean.

## A3. Verify in Resend

1. Resend → Domains → `mail.kapwa.software` → **Verify**.
2. Confirm DNS propagation independently before/after:
   - TXT (SPF): `mail.kapwa.software`
   - CNAME (DKIM): `resend._domainkey.mail.kapwa.software`
   - MX: `mail.kapwa.software`
3. Wait for status → **Verified** (usually < 10 min after propagation; name.com
   records can take a few minutes to leave their own resolvers).

## A4. Point the API at Resend

`infra/.env.production` is already wired to Resend. Replace the placeholder API
key, then redeploy:

```dotenv
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASS=re_...                                   # ← your Resend API key
EMAIL_FROM="KAPWA MSWDO <noreply@mail.kapwa.software>"
```

- Create the key at Resend → **API Keys** → *Create API Key* (scope: Sending).
- `EMAIL_USER` is the literal string `resend`; the **password is the API key**.
- Port `465` = implicit TLS → `email.service.ts` sets `secure:true`.
- `EMAIL_FROM` **must stay double-quoted** — `deploy.sh` `source`s the env file,
  and the spaces/`<>` would otherwise break the shell.
- Boot logs `SMTP transporter verified — email delivery enabled` on success, or
  `SMTP transporter verification FAILED` if the key/records are wrong.
- Server code: `kapwa-server/src/email/email.service.ts`.

---

# TRACK B — Site DNS (do AFTER EC2 deploy)

Wait for: EC2 up + Elastic IP allocated + Caddy/docker serving :80/:443.

1. name.com → DNS Records → add (replace `<EC2_ELASTIC_IP>`):

| Type | Host  | Value             | TTL |
|------|-------|-------------------|-----|
| A    | `www` | `<EC2_ELASTIC_IP>` | 300 |
| A    | `@`   | `<EC2_ELASTIC_IP>` | 300 |

   > **Delete the existing parking A record on `@` (`91.195.240.94`)** when you
   > add the real one. Drop the `api` hostname if the stack serves API + SPA
   > through one Caddy on :80/:443.

2. Uncomment the production block in `infra/Caddyfile` and set the site address
   to `kapwa.software, www.kapwa.software`.
3. TLS: Caddy auto-issues Let's Encrypt certs on first request — no manual step.
4. Keep Resend sending on `mail.kapwa.software` **only**; the apex/`www` stay for
   the site.

---

# Order check

- [ ] A1 Resend domain `mail.kapwa.software` added
- [ ] A2 name.com DNS records added (SPF TXT, DKIM CNAME, feedback MX)
- [ ] A2b DMARC TXT added (optional)
- [ ] A3 Resend status → Verified
- [ ] A4 `EMAIL_PASS` set to a real Resend API key + redeploy
- [ ] EC2 deployed (+ Elastic IP)
- [ ] B parking A record replaced with EC2 IP; Caddy prod block enabled
- [ ] Caddy serving https://kapwa.software
- [ ] End-to-end email test (register → verify link) green
