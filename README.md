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

## Map provider

LandLordy uses [OpenStreetMap](https://www.openstreetmap.org/) map data with the Leaflet map library. No Google Maps account, API key, or credit card is needed. The map and search require an internet connection.

Place search uses the OpenStreetMap Nominatim search service. Public map and search services have fair-use limits, so avoid automated or repeated rapid searches. Map tiles include OpenStreetMap attribution.

## Location and privacy

- Device location is requested only after the player presses **MY LOCATION** and approves the browser prompt.
- Location access requires HTTPS (GitHub Pages provides HTTPS) or localhost.
- The current coordinates are used only in the open page to center the map and are not saved in game progress or sent to LandLordy servers.
- Searches are entered manually.
- Territory is fictional game progress, not a reason to visit a real-world location.
- Avoid interacting with the game while walking, cycling, or driving.

## Files

- `index.html` — game layout and controls
- `styles.css` — responsive pixel-inspired interface
- `game.js` — territory, inventory, local saving, OpenStreetMap loading, and location controls
