# LandLordy

LandLordy is a browser-based, hybrid map and pixel-territory strategy game. It is designed to work on phones, tablets, and computers.

## Current gameplay

- A generated 8 × 6 district grid sits over a map.
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

## Optional Google Maps connection

The demo district works without an API key. To show real map backgrounds and search for a city or neighborhood:

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Maps JavaScript API** and **Geocoding API**.
3. Create an API key and restrict it to the website domain where possible.
4. In LandLordy, open the menu, paste the key, and choose **Connect Google Maps**.

Google Maps usage may require billing to be enabled. The key is stored in this browser's local storage; do not commit it to GitHub or share it publicly. For a public release, use appropriate API key restrictions and review Google's current Maps Platform terms.

## Privacy and safety

- LandLordy does not request live device location.
- Searches are entered manually; no precise player coordinates are shared with other players.
- Territory is fictional game progress, not a reason to visit a real-world location.
- Avoid interacting with the game while walking, cycling, or driving.

## Files

- `index.html` — game layout and controls
- `styles.css` — responsive pixel-inspired interface
- `game.js` — territory, inventory, saving, and optional Maps integration
