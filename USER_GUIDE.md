# Flyx User Guide

Your personal streaming hub — free, private, and open source.

---

## Welcome to Flyx! 🎉

Flyx is a free app that lets you stream movies, TV shows, anime, live TV, and
sports — all from one place. No ads. No subscriptions. No tracking. Everything
lives on your computer.

### What can you watch?

| Category | What's included |
|----------|----------------|
| 🎬 **Movies & TV** | Thousands of titles, from classics to new releases |
| 🌸 **Anime** | Subbed and dubbed, from popular series to seasonal hits |
| 📚 **Manga** | Read your favorite manga chapter by chapter |
| 📡 **Live TV** | 850+ live channels — news, sports, entertainment |
| 🏟️ **Sports** | Live sports and pay-per-view events |

### What you need

- A Windows, Mac, or Linux computer
- An internet connection
- 2 minutes for the one-time setup

---

## Installing Flyx 💻

### Windows

1. Download the **Flyx Setup.exe** file
2. Double-click to run the installer
3. Click through the setup — you can choose where to install it
4. When installation finishes, **Flyx opens automatically**

### Mac

1. Download the **Flyx.dmg** file
2. Open it and drag Flyx into your Applications folder
3. Launch Flyx from Applications (you may need to right-click → Open the first time)

### Linux

1. Download the **Flyx.AppImage** or **.deb** file
2. For AppImage: right-click → Properties → Permissions → "Allow executing", then double-click
3. For .deb: double-click to install, then launch from your app menu

---

## First-Run Setup 🚀

The first time you open Flyx, a setup wizard will guide you through 3 quick
steps:

### Step 1: Get a free TMDB account

TMDB (The Movie Database) is what gives Flyx all the movie posters,
descriptions, and search results. It's completely free — here's how to get your key:

1. Go to [themoviedb.org/signup](https://www.themoviedb.org/signup) and create a free account
2. Go to your [API settings](https://www.themoviedb.org/settings/api) and click **"Request an API Key"**
3. Choose **Developer** (not Professional)
4. Fill out the form:
   - App Name: `Flyx`
   - App URL: `http://localhost`
   - Description: `Personal streaming app`
5. Copy the long code labeled **"API Read Access Token"**
6. Paste it into Flyx's setup wizard

> **Why does Flyx need this?** TMDB is like a giant library catalog for movies
> and TV. Flyx uses your personal key to look up posters, ratings, cast info,
> and descriptions. Your key is free, personal, and never shared.

### Step 2: Choose who's using Flyx

- **Just me** — The app opens directly to your content. No accounts needed.
- **Family or friends** — You can create separate accounts for people you share
  Flyx with. Each person gets their own watchlist and progress tracking.

If you pick "Family or friends," you'll set a secret key. You'll use this to
create accounts for your people — keep it safe!

### Step 3: Launch!

That's it! Click **Launch Flyx** and you're in.

> 💡 **Need to change your setup later?** Close Flyx, go to
> `%APPDATA%\Flyx\flyx-data` (on Windows) and delete the `.env` file. Reopen
> Flyx to run the setup wizard again.

---

## The Main Screen 🏠

When you open Flyx, here's what you'll see:

- **Sidebar** (left side) — Navigation to all sections: Home, Movies, TV Shows,
  Anime, Manga, Live TV, Search, Watchlist, Settings, Help
- **Home screen** — Trending movies and TV, "Continue Watching," and curated
  categories
- **Search bar** — Press `Ctrl+K` (or `⌘K` on Mac) to search anything instantly

On phones and tablets, the sidebar becomes a bottom tab bar.

---

## Finding Something to Watch 🔍

### Browse by category

Click **Movies** or **TV Shows** in the sidebar. You can filter by:
- Genre (Action, Comedy, Horror, etc.)
- Year
- Rating
- Popularity

### Search

Press `Ctrl+K` (Windows) or `⌘K` (Mac) to open the search bar. Start typing any
movie, show, or actor — results appear instantly.

### Details page

Click any poster to see:
- Full description and rating
- Cast and crew
- Similar titles you might like
- **Watch Now** button to start playing

---

## Watching on Your TV, Phone, or Tablet 📺

This is one of Flyx's best features — you can stream to any device on your home
Wi-Fi!

### How it works

1. **Keep Flyx open** on your computer — it runs a small web server in the
   background
2. **Make sure your other device is on the same Wi-Fi** as your computer
3. **Open a web browser** on your TV, phone, or tablet
4. **Type in your Flyx address** — you can find it in **Help → Watch on TV**
   inside the app. It looks like `http://192.168.1.42:3891`
5. The full Flyx app loads on your device — browse, search, and play!

### Tips for different devices

| Device | How to watch |
|--------|-------------|
| **Smart TV** | Use the built-in web browser (called "Internet" on Samsung, "Web Browser" on LG) |
| **Phone / Tablet** | Open Chrome or Safari, type in the Flyx address. The app automatically adapts to your screen. |
| **Game console** | PlayStation and Xbox both have web browsers that work |
| **Chromecast** | Click the Cast icon in the video player to send video directly to your TV |
| **Apple TV** | Use AirPlay from Safari on a Mac, or open the address in a browser on your TV |

### Troubleshooting connections

- **Both devices on the same Wi-Fi?** Guest networks usually don't work — make
  sure both devices are on the main network.
- **Windows Firewall popup?** The first time you use Flyx, Windows may ask if you
  want to allow it on the network. Click **Allow**.
- **VPN?** Turn off your VPN temporarily — some VPNs block local connections.
- **Wrong address?** The address can change if your computer restarts. Check
  **Help → Watch on TV** for the current address.

---

## The Video Player 🎮

Once you start watching, here's how to control playback:

### Keyboard shortcuts (desktop)

**Playback:**
- `Space` or `K` — Play / Pause
- `←` `→` — Skip back / forward 10 seconds
- `Shift` + `←` `→` — Skip 30 seconds
- `0` through `9` — Jump to 0%–90% of the video
- `N` — Next episode
- Double-click left/right side of video — Skip 10 seconds

**Audio & Display:**
- `↑` `↓` — Volume up / down
- `M` — Mute
- `F` — Fullscreen
- `,` `.` — Slow down / speed up playback

**Casting:**
- Click the **Cast icon** in the player to send video to a Chromecast or
  AirPlay device
- `Ctrl` + browser menu → Cast (on Windows)
- AirPlay icon (on Mac / Safari)

### Touch controls (phone / tablet)

- **Tap the video** — Show or hide controls
- **Center play button** — Play / Pause
- **−10s / +10s buttons** — Skip back or forward
- **Drag the timeline bar** — Scrub to any point
- **Servers button** — Switch video sources
- **Settings button** — Change playback speed
- **Cast icon** — Send to Chromecast or AirPlay

### Player features

- **Servers:** If a video doesn't load well, click **Servers** and try a
  different source. Different servers may have different speeds or quality.
- **Speed:** Watch at 1.25×, 1.5×, or 2× speed without changing the pitch.
- **Subtitles:** Click the subtitle icon to turn on captions or change language.
  Customize how they look in **Settings → Subtitles**.
- **Next Episode:** An "Up Next" button appears near the end of each episode.
  You can set when it shows in **Settings → Playback**.
- **Auto-play:** Turn on in **Settings → Playback** to automatically start the
  next episode.

---

## Your Watchlist & Continue Watching 📋

- **Add to Watchlist:** Click the bookmark icon on any poster to save it
- **Continue Watching:** Flyx remembers where you stopped. Pick up right where
  you left off from the home screen.
- **Progress tracking:** For TV shows, Flyx tracks which season and episode
  you're on.
- **Find your stuff:** Everything you've saved is under **Watchlist** in the
  sidebar.

---

## Anime & Manga 🌸

Flyx has dedicated sections for anime and manga fans:

- **Anime:** Browse by popularity, season, or genre. Choose between subbed
  (original audio with subtitles) and dubbed versions.
- **Manga:** Browse series and read chapter by chapter. The reader saves your
  progress automatically.

---

## Live TV & Sports 📡

Click **Live TV** in the sidebar to access 850+ channels:

- **Categories:** News, Sports, Entertainment, Kids, and more — use the sidebar
  to jump between genres
- **Channel guide:** Browse channels by category, click any to start watching
- **Sports & PPV:** Major sports events and pay-per-view events appear here when
  they're airing

---

## Settings ⚙️

Found under **Settings** in the sidebar:

| Tab | What it does |
|-----|-------------|
| 🔄 **Sync** | Cross-device sync — access your watchlist and progress from any device |
| 📡 **Providers** | Manage streaming sources — enable, disable, or reorder them |
| ▶️ **Playback** | Auto-play next episode, countdown timer, "Up Next" timing |
| 💬 **Subtitles** | Language, font size, background, position — with live preview |
| 🔒 **Security** | Account management and access control |

---

## Your Privacy 🔒

Flyx is built with privacy as a core principle:

- **Everything is stored on your computer.** Your watchlist, progress, and
  settings never leave your device.
- **No Flyx accounts.** The app runs on your machine — there's no Flyx server
  collecting your data.
- **No ads, no trackers.** The code is open source — anyone can verify there's
  nothing shady.
- **Your TMDB key is yours.** It's between you and TMDB. Flyx uses it only to
  look up posters and descriptions.

### Where your data lives

On Windows: `%APPDATA%\Flyx\flyx-data\`
On Mac: `~/Library/Application Support/Flyx/flyx-data/`
On Linux: `~/.config/Flyx/flyx-data/`

Want to back up Flyx? Copy the `flyx-data` folder. Want to start fresh? Delete it.

---

## Troubleshooting 🔧

### Video won't play or keeps buffering

1. Click the **Servers** button in the player and try a different source
2. Check your internet — load a website in another tab to verify you're online
3. Move closer to your Wi-Fi router or use a wired connection
4. Some servers may be temporarily down — try again in a few minutes

### Can't connect from my phone or TV

1. Make sure Flyx is **running and open** on your computer
2. Both devices must be on the **same Wi-Fi network**
3. Check the current address in **Help → Watch on TV** — it may have changed
4. If you see "Connection refused," Windows Firewall may be blocking Flyx.
   Allow it in Windows Firewall settings.

### Content won't load / No posters or descriptions

1. Your TMDB key may not be working. Go to
   [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
   and verify your key is still active.
2. To update your key: close Flyx, delete the `.env` file in your `flyx-data`
   folder, and reopen Flyx to run the setup wizard again.

### The app feels slow

1. Close unused browser tabs and apps to free up resources
2. If streaming to multiple devices, try reducing to one stream
3. Restart Flyx — this clears temporary caches

### The window is blank or white

1. Wait a few seconds — the server takes a moment to start
2. Close and reopen Flyx
3. Check your antivirus — some security software blocks local servers

---

## Getting Help 💬

- **In-app help:** Click **Help** in the sidebar for detailed guides and tips
- **Discord:** Join the [Flyx Discord server](https://discord.gg/CUG5p8B3vq) for
  community help
- **GitHub:** Report bugs or suggest features at
  [github.com/Vynx-Velvet/Flyx-main](https://github.com/Vynx-Velvet/Flyx-main)

---

## FAQ ❓

### Is Flyx really free?

Yes. Flyx is open source (MIT license) and always will be. You don't need to pay
anything — ever.

### Is this legal?

Flyx itself is a streaming aggregator — similar to a web browser. It finds
publicly available content from free streaming providers. You should check your
local laws regarding streaming content.

### Do I need to keep the app open?

Yes, Flyx runs a small server in the background. Keep the app window open
(minimizing is fine) for it to work on other devices.

### Can I use Flyx outside my home?

Flyx is designed for your home network. To watch remotely, you'd need to set up
a VPN or port forwarding on your router — this is for advanced users.

### How do I get updates?

Download the latest version from the
[GitHub releases page](https://github.com/Vynx-Velvet/Flyx-main/releases). Your
data (watchlist, progress, settings) stays safe in the `flyx-data` folder.

### Can I customize which streaming sources are used?

Yes! Go to **Settings → Providers** to enable, disable, or reorder streaming
sources. If a particular source never works for you, turn it off there.

---

**Enjoy Flyx!** 🚀
