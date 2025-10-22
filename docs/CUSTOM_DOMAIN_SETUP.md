# Custom Domain Setup Guide

Quick guide to add a custom domain to kinetiCORE Cloudflare Pages deployment.

## Option 1: Using Cloudflare Registrar (Recommended)

**Benefits:**
- Cheapest prices (at-cost pricing)
- Automatic DNS configuration
- Integrated SSL certificates
- Simplest setup

### Steps:

1. **Register Domain**
   - Go to [Cloudflare Registrar](https://dash.cloudflare.com/?to=/:account/domains/register)
   - Search for available domains: `kineticore.com`, `kcore.io`, etc.
   - Purchase domain (~R200-450/year depending on TLD)

2. **Add to Pages Project**
   - Navigate to: Cloudflare Dashboard → Workers & Pages → kineticore
   - Click **Custom domains** tab
   - Click **Set up a custom domain**
   - Enter domain: `kineticore.com` (or your domain)
   - Click **Continue**
   - DNS records auto-configured ✅
   - SSL certificate auto-provisioned ✅

3. **Wait for Activation**
   - DNS propagation: ~5 minutes
   - SSL certificate: ~5 minutes
   - **Total time:** ~10 minutes

4. **Done!**
   - Your app is now live at: `https://kineticore.com`
   - Old URL still works: `https://kineticore.pages.dev`

---

## Option 2: Using External Registrar (Namecheap, Google, etc.)

If you already own a domain or prefer another registrar:

### Steps:

1. **Buy Domain** (if you don't have one)
   - [Namecheap](https://namecheap.com)
   - [Google Domains](https://domains.google)
   - [GoDaddy](https://godaddy.com)

2. **Add Domain to Cloudflare** (free)
   - Cloudflare Dashboard → Add a Site
   - Enter your domain: `kineticore.com`
   - Select Free plan
   - Follow DNS migration steps

3. **Update Nameservers** at your registrar
   - Cloudflare will show 2 nameservers:
     ```
     ns1.cloudflare.com
     ns2.cloudflare.com
     ```
   - Go to your registrar (Namecheap, Google, etc.)
   - Find "Nameservers" or "DNS Settings"
   - Replace with Cloudflare nameservers
   - Wait 24 hours for propagation (usually <1 hour)

4. **Add Custom Domain to Pages**
   - Navigate to: Workers & Pages → kineticore
   - Click **Custom domains** → **Set up a custom domain**
   - Enter: `kineticore.com`
   - Cloudflare auto-configures DNS
   - SSL certificate auto-issued

5. **Done!**
   - App live at: `https://kineticore.com`

---

## Adding a Subdomain

Instead of `kineticore.com`, use `app.kineticore.com`:

### Steps:

1. **Go to Custom Domains in Cloudflare Pages**
2. **Click Set up a custom domain**
3. **Enter subdomain:** `app.kineticore.com`
4. **Cloudflare creates CNAME record automatically**
5. **Wait 5 minutes for SSL**

**Result:** App at `https://app.kineticore.com`

---

## Multiple Domains (Aliases)

You can add multiple domains pointing to the same app:

### Example Setup:
- `kineticore.com` (primary)
- `www.kineticore.com` (redirect to primary)
- `app.kineticore.com` (alternate)
- `kcore.io` (short version)

### Steps:
1. Add each domain in **Custom domains** tab
2. Cloudflare handles DNS for all
3. All URLs show the same app

---

## DNS Configuration Details

### For Root Domain (`kineticore.com`)

Cloudflare automatically creates:
```
Type: CNAME
Name: @ (or kineticore.com)
Target: kineticore.pages.dev
Proxy: Yes (orange cloud)
```

### For Subdomain (`app.kineticore.com`)

Cloudflare automatically creates:
```
Type: CNAME
Name: app
Target: kineticore.pages.dev
Proxy: Yes (orange cloud)
```

### For www Redirect

Add in Cloudflare DNS:
```
Type: CNAME
Name: www
Target: kineticore.pages.dev
Proxy: Yes
```

Then add `www.kineticore.com` to Custom domains in Pages.

---

## SSL Certificate Management

**Automatic by Cloudflare:**
- ✅ Free SSL certificates (Universal SSL)
- ✅ Auto-renewal (every 90 days)
- ✅ Wildcard support (`*.kineticore.com`)
- ✅ HTTPS enforced automatically

**No manual configuration needed!**

---

## Email Setup with Custom Domain

If you want `george@kineticore.com` email:

### Option 1: Cloudflare Email Routing (Free)

1. Cloudflare Dashboard → Email → Email Routing
2. Enable Email Routing
3. Add destination: `your-personal@gmail.com`
4. Add custom address: `george@kineticore.com`
5. Forward to your Gmail

**Free forever** - unlimited email addresses and forwarding.

### Option 2: Google Workspace (Paid)

Professional email with 30GB storage:
- Cost: ~R100/month per user
- Full Gmail experience
- Calendar, Drive included

---

## Cost Breakdown

### Domain Registration (Yearly)
- `.com` domain: ~R250/year (Cloudflare Registrar)
- `.io` domain: ~R450/year
- `.app` domain: ~R200/year
- `.dev` domain: ~R200/year
- `.tech` domain: ~R150/year

### Cloudflare Services
- DNS hosting: **R0** (free)
- SSL certificates: **R0** (free)
- Pages hosting: **R0** (free tier, 500 builds/month)
- Email routing: **R0** (free, unlimited)
- CDN & bandwidth: **R0** (unlimited)

### Total Annual Cost
- **Minimum:** R150/year (`.tech` domain only)
- **Recommended:** R250/year (`.com` domain)

---

## Recommended Domains for kinetiCORE

Check availability and choose:

### Professional & Memorable:
1. `kineticore.com` - Best overall
2. `kineticore.io` - Tech-focused
3. `kineticore.app` - Modern web app

### Short & Catchy:
1. `kcore.io` - Very short
2. `kcore.app` - Modern
3. `ksim.io` - "K Sim" = Kinetic Simulator

### Industry Specific:
1. `kineticore.tech` - Technology
2. `kineticore.dev` - Developer tool
3. `kineticore.engineering` - Professional

---

## Testing Custom Domain

After setup, verify everything works:

### 1. Check DNS Propagation
```bash
# Check if domain resolves
nslookup kineticore.com

# Should show Cloudflare IP addresses
```

### 2. Test HTTPS
```bash
# Visit in browser
https://kineticore.com

# Should show:
# ✅ Green padlock (secure)
# ✅ Valid SSL certificate
# ✅ Your kinetiCORE app loads
```

### 3. Test Redirects
- Visit `http://kineticore.com` → Should redirect to `https://`
- Visit `www.kineticore.com` → Should work (if configured)

---

## Troubleshooting

### Domain Not Loading

**Check DNS:**
```bash
nslookup kineticore.com
```

**Should return Cloudflare IPs:**
- IPv4: `104.21.x.x` or `172.67.x.x`
- IPv6: `2606:4700:...`

**If wrong IPs:**
- Wait for DNS propagation (up to 24 hours)
- Verify nameservers at your registrar
- Check Cloudflare DNS settings

### SSL Certificate Error

**"Your connection is not private"**

**Causes:**
- DNS not fully propagated (wait 5-10 minutes)
- SSL certificate still provisioning (wait 5 minutes)
- Mixed content (HTTP resources on HTTPS page)

**Fix:**
- Wait 10 minutes after DNS changes
- Clear browser cache (Ctrl+Shift+Del)
- Try incognito mode

### Domain Shows Old Content

**Cloudflare cache:**
1. Cloudflare Dashboard → Caching
2. Click **Purge Everything**
3. Hard refresh browser (Ctrl+Shift+R)

---

## Advanced: Apex Domain with Custom Nameservers

If you want to keep your registrar's nameservers:

**Not recommended** - Cloudflare's automatic setup is much easier.

But if you must:
1. Don't migrate to Cloudflare nameservers
2. Manually add DNS records at your registrar:
   ```
   Type: CNAME
   Name: @
   Value: kineticore.pages.dev
   ```
3. Add custom domain in Cloudflare Pages
4. Verify ownership with TXT record

**Note:** Loses Cloudflare CDN benefits, SSL auto-renewal, and DDoS protection.

---

## Support

**Domain Registration Issues:**
- Cloudflare Support: [https://support.cloudflare.com/](https://support.cloudflare.com/)
- Registrar support (Namecheap, Google, etc.)

**DNS/SSL Issues:**
- [Cloudflare Community](https://community.cloudflare.com/)
- Check [Cloudflare Status](https://www.cloudflarestatus.com/)

**kinetiCORE Team:**
- Open GitHub issue for deployment-specific problems
- Slack: #deployment-help

---

**Last Updated:** October 2025
**Maintainer:** George McIntyre
