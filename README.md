# LandLordy

LandLordy is a browser-based, hybrid map and pixel-territory strategy game. It is designed to work on phones, tablets, and computers.

## Current gameplay

- A generated 8 × 6 district grid sits over a real map.
- Claim open tiles for 25 coins.
- Resource tiles provide wood or stone when claimed.
- Build an outpost on owned land for 40 coins and 1 wood.
- Earn experience, level up, and receive coin rewards.
- Progress is saved locally in the browser.

The game grid is an abstract game layer. Claiming a tile does **not** claim real property or represent ownership of a real location. There are no tasks that require travelling to a place.

## Run it

You can open `index.html` directly, or publish the repository with GitHub Pages:

1. Open the repository's **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose `main` and `/ (root)`, then save.
5. Open the published Pages URL after deployment finishes.

## Connect Google Maps

LandLordy now uses the Google Maps JavaScript API. To connect it:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project.
3. Enable **Maps JavaScript API** for that project.
4. Create an API key in **APIs & Services → Credentials**.
5. Restrict the key to your website's HTTP referrers (for GitHub Pages, add your exact `https://YOUR-USERNAME.github.io/*` site pattern) and restrict API access to **Maps JavaScript API**.
6. Open LandLordy, click the menu button, paste the key into **GOOGLE MAPS API KEY**, and press **SAVE & LOAD GOOGLE MAPS**.

Google may require a billing account for Maps Platform. Do not post your API key publicly. The key is saved in this browser's local storage and is not committed to this repository. Because browser keys are visible to visitors who inspect a page, HTTP-referrer and API restrictions are important.

The **MY LOCATION** button asks the browser for permission only after it is clicked. Location access requires HTTPS (GitHub Pages provides HTTPS) or localhost. If permission is denied, the game remains playable.

## Privacy and gameplay safety

- Device location is requested only after the player presses **MY LOCATION** and approves the browser prompt.
- The current coordinates are used in the open page to center the map and are not saved in game progress or sent to LandLordy servers.
- Searches are entered manually.
- Territory is fictional game progress, not a reason to visit a real-world location.
- Avoid interacting with the game while walking, cycling, or driving.

## Files

- `index.html` — game layout and controls
- `styles.css` — responsive pixel-inspired interface
- `game.js` — territory, inventory, local saving, Google Maps loading, and location controls
