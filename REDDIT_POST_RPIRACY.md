# Reddit Post for r/Piracy

## Title Options (pick one)

**Option A:** "I reverse engineered pirate streaming sites to steal from the thieves. 5 months later, here's an ad-free, open source alternative."

**Option B:** "Built an ad-free streaming frontend by cracking the obfuscation on sites that were already stealing content. Open source, no tracking, runs free."

**Option C:** "What if pirate streaming sites weren't actively trying to give your browser cancer? 5 months of reverse engineering later..."

---

## Post

Every pirate streaming site follows the same playbook: wrap stolen content in 47 pop-ups, a crypto miner, and a UI designed by someone who hates you personally.

I spent 5 months asking "does it actually have to be this way?" Turns out: no.

### What I Made

**Flyx** - a streaming frontend that treats you like a human:

- Zero ads, zero pop-ups, zero miners
- No account required, no email harvesting
- No tracking cookies or fingerprinting
- Clean UI that doesn't assault your eyes
- Works on any device
- Runs entirely on free hosting (Vercel)
- Fully open source

### The Fun Part

The sites I'm pulling from aren't legitimate businesses - they're pirates profiting off content they don't own by wrapping it in malware. Their "security" isn't protecting IP, it's protecting their ad revenue.

So I cracked it.

Spent way too many 3 AM sessions staring at obfuscated JavaScript with variable names like `_0x4a3f`. Built deobfuscation tools. Learned more about HLS proxying than any sane person should. Documented the whole journey on the site's about page (it reads like a fever dream because I wrote most of it sleep-deprived).

### Why Open Source?

Because I mass-produced poor decisions for 5 months and someone should benefit from it. Also maybe someone smarter can make it better.

### Technical Highlights

- Next.js 14 with serverless functions
- Custom proxy layer for stream extraction
- Multiple provider fallbacks
- No backend servers to maintain

Links in my profile to avoid automod. Happy to answer questions about how any of it works.

---

## Alternative Shorter Version

Every pirate streaming site: stolen content + 47 pop-ups + crypto miner + UI designed by Satan.

I spent 5 months reverse engineering these sites to extract streams without the cancer. Built an open source frontend that's ad-free, tracking-free, and doesn't require an account.

The irony? I'm stealing from thieves. These sites profit from content they don't own by wrapping it in malware. Their "security" protects ad revenue, not IP. So I cracked it.

Fully open source. Runs on Vercel's free tier. Links in my profile.

---

## IMPORTANT: Posting Strategy for r/Piracy

r/Piracy has aggressive automod. Follow these steps:

### Before Posting

1. **Set up your Reddit profile first:**
   - Add to bio: `Flyx: [SITE_URL] | GitHub: [REPO_URL]`
   - Or create a pinned post on your profile with links

2. **Build some karma first** (if new account):
   - Comment helpfully on other r/Piracy posts
   - Participate in the community for a few days

### When Posting

1. **Never put links in the post body** - instant removal
2. **Say "links in my profile"** - this is accepted
3. **Post on weekends** - mods more active for manual approvals
4. **Don't edit after posting** - can re-trigger automod

### First Comment to Add

```
For anyone asking - links are in my profile bio. Didn't want to trigger automod.

GitHub has full setup instructions if you want to self-host. Runs entirely on free tiers.

Happy to answer technical questions about the reverse engineering process.
```

### If Removed

1. Wait 24 hours, then message mods politely asking for manual review
2. Try the weekly megathread as backup
3. Consider r/Piracy's Discord if they have one

---

## Key Differences from r/PiracyArchive Post

- More emphasis on the "stealing from thieves" angle - r/Piracy appreciates the irony
- Technical details about reverse engineering - this community likes knowing how things work
- Shorter, punchier tone - r/Piracy is more casual than archive subs
- Removed some of the self-deprecating humor - keep some but don't overdo it

---

## Engagement Tips

When people comment, be ready to discuss:

1. **"How does it work?"** - Explain the proxy layer, provider extraction, HLS rewriting
2. **"Is it safe?"** - Open source, no tracking, can self-host, runs on Vercel
3. **"Will it get taken down?"** - It's a frontend, doesn't host content, similar legal position to other aggregators
4. **"Can I self-host?"** - Yes, GitHub has instructions, free Vercel deployment
5. **"What providers does it use?"** - Be vague here, don't name specific sites

---

## Timing

Best times to post on r/Piracy:
- Saturday/Sunday afternoon (US time)
- Avoid Monday mornings
- Check if there's already a similar post trending - wait if so
