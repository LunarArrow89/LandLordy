(() => {
  "use strict";

  const SAVE_KEY = "landlordy-save-v1";
  const BASE_TILE_ZOOM = 16;
  const TILE_SIZE = 256;
  const CLAIM_COST = 25;
    const $ = (id) => document.getElementById(id);

  const defaultState = () => ({
    coins: 120,
    tiles: {}, selected: null, mapCenter: "starter"
  });

  let state = loadState();
  let map = null;
  let toastTimer = null;
  let currentDevicePosition = null;
  let playerLocationMarker = null;
  let playerTileIndex = null;
  let visibleTileKeys = [];

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      return saved && typeof saved === "object" ? { ...defaultState(), ...saved } : defaultState();
    } catch (_) { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function tileKey(key) { return String(key); }

  function tileData(index) {
    const key = tileKey(index);
    const saved = state.tiles[key];
    if (saved) return saved;
    return { owner: false };
  }

  function updateVisibleTileKeys() {
    if (!map) return;
    const zoom = map.getZoom();
    const cell = TILE_SIZE * Math.pow(2, zoom - BASE_TILE_ZOOM);
    const bounds = map.getBounds();
    const nw = map.project(bounds.getNorthWest(), zoom);
    const se = map.project(bounds.getSouthEast(), zoom);
    const minX = Math.floor(nw.x / cell), maxX = Math.floor(se.x / cell);
    const minY = Math.floor(nw.y / cell), maxY = Math.floor(se.y / cell);
    const layer = $("territory-layer");
    layer.innerHTML = "";
    playerTileIndex = findPlayerTile();
    visibleTileKeys = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const key = x + ":" + y;
      visibleTileKeys.push(key);
      const p1 = map.latLngToContainerPoint(map.unproject(L.point(x * cell, y * cell), zoom));
      const p2 = map.latLngToContainerPoint(map.unproject(L.point((x + 1) * cell, (y + 1) * cell), zoom));
      const data = tileData(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "territory-tile" + (data.owner ? " owned" : "") + (state.selected === key ? " selected" : "");
      button.style.left = p1.x + "px";
      button.style.top = p1.y + "px";
      button.style.width = (p2.x - p1.x) + "px";
      button.style.height = (p2.y - p1.y) + "px";
      button.disabled = playerTileIndex !== key;
      button.title = tileDescription(key, data);
      button.setAttribute("aria-label", button.title);
      button.innerHTML = data.owner ? '<span class="tile-symbol">◆</span>' : "";
      button.addEventListener("click", () => {
        if (findPlayerTile() !== key) return;
        state.selected = key;
        setStatus("Land square selected.");
        render();
      });
      layer.appendChild(button);
    }
  }

  function render() {
    $("coins").textContent = state.coins;
    const claimedCount = Object.values(state.tiles).filter(t => t.owner).length;
    $("level").textContent = 1 + Math.floor(claimedCount / 5);
    renderTiles();
    renderSelected();
    saveState();
  }

  function findPlayerTile() {
    if (!map || !currentDevicePosition) return null;
    const zoom = map.getZoom();
    const cell = TILE_SIZE * Math.pow(2, zoom - BASE_TILE_ZOOM);
    const point = map.project([currentDevicePosition.lat, currentDevicePosition.lng], zoom);
    return Math.floor(point.x / cell) + ":" + Math.floor(point.y / cell);
  }

  function renderTiles() {
    if (map) updateVisibleTileKeys();
  }

  function tileDescription(key, data) {
    return data.owner ? "Land square " + key + " — claimed by you" : "Land square " + key + " — open land";
  }

  function renderSelected() {
    const claim = $("claim-button");
    if (state.selected === null) {
      $("tile-tag").textContent = "NONE";
      $("tile-details").innerHTML = "<strong>Tap your square</strong><p>Claim the land beneath your location.</p>";
      claim.disabled = true;
      return;
    }
    const data = tileData(state.selected);
    const here = playerTileIndex === state.selected;
    $("tile-tag").textContent = data.owner ? "YOURS" : "OPEN";
    $("tile-details").innerHTML = "<strong></strong><p></p>";
    $("tile-details").querySelector("strong").textContent = data.owner ? "Your land" : "Open land";
    $("tile-details").querySelector("p").textContent = data.owner ? "This square belongs to you." : "Claim this square to add it to your land.";
    claim.disabled = !here || data.owner || state.coins < CLAIM_COST;
    claim.textContent = data.owner ? "ALREADY CLAIMED" : "CLAIM LAND · " + CLAIM_COST + " COINS";
  }

  function claimSelected() {
    const key = state.selected;
    if (key === null || findPlayerTile() !== key) {
      showToast("You must be standing on that square to claim it.");
      return;
    }
    const data = tileData(key);
    if (data.owner || state.coins < CLAIM_COST) return;
    state.coins -= CLAIM_COST;
    data.owner = true;
    state.tiles[key] = data;
    log("Claimed a square of land for " + CLAIM_COST + " coins.");
    showToast("Land claimed!");
    render();
  }

  function log(message) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "activity-dot";
    const text = document.createElement("span");
    text.textContent = message;
    li.append(dot, text);
    $("activity-log").prepend(li);
    while ($("activity-log").children.length > 12) $("activity-log").lastElementChild.remove();
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function setStatus(message) { $("map-status").textContent = message; }

  function useDemoMap() {
    // Clear any old Google Maps key saved by the previous experimental setup.
    try { localStorage.removeItem("landlordy-google-maps-key-v1"); } catch (_) {}
    $("map").classList.add("map-ready");
    if (!window.L) {
      $("map-fallback").style.display = "block";
      $("territory-layer").style.display = "none";
      setStatus("Map library did not load. Check your internet connection and reload.");
      return;
    }

    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true
    }).setView([34.0522, -118.2437], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    $("map-fallback").style.display = "none";
    $("territory-layer").style.display = "grid";

    if (currentDevicePosition) showPlayerOnMap(currentDevicePosition);
    map.on("moveend zoomend", () => {
      $("map-location").textContent = "OPENSTREETMAP · ZOOM " + map.getZoom();
      refreshPlayerTile();
    });
    map.on("resize", refreshPlayerTile);
    setStatus("OpenStreetMap loaded. Select a tile to claim it!");
    $("map-location").textContent = "OPENSTREETMAP";
    renderTiles();
    setTimeout(() => map.invalidateSize(), 100);
  }


  function locatePlayer() {
    if (!navigator.geolocation) {
      setStatus("This browser does not support location. Try a browser with location enabled.");
      showToast("Location is not available in this browser.");
      return;
    }

    const button = $("locate-me");
    button.disabled = true;
    button.textContent = "FINDING YOU…";
    setStatus("Getting your current location…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentDevicePosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        button.disabled = false;
        button.textContent = "⌖ MY LOCATION";
        showPlayerOnMap(currentDevicePosition);
        refreshPlayerTile();
        setStatus("Map centered on your current location.");
        showToast("Location found!");
      },
      (error) => {
        button.disabled = false;
        button.textContent = "⌖ MY LOCATION";
        let message = "Couldn't get your location. Check that device location is turned on and try again.";
        if (error.code === 1) {
          message = "Location permission is blocked. Allow location for this site in your browser's site settings, then try again.";
        } else if (error.code === 3) {
          message = "Location took too long. Check your connection and device location, then try again.";
        }
        setStatus(message);
        showToast(message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function showPlayerOnMap(position) {
    if (!map || !window.L) return;
    const point = [position.lat, position.lng];

    // Smoothly move the map camera so the player's location is centered.
    map.flyTo(point, 17, {
      animate: true,
      duration: 1.2
    });

    if (playerLocationMarker) playerLocationMarker.remove();
    playerLocationMarker = L.circleMarker(point, {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#4285f4",
      fillOpacity: 1
    }).addTo(map);
    playerLocationMarker.bindTooltip("Your current location");
    $("map-location").textContent = "YOUR CURRENT AREA";
    setStatus("Moving the map to your location…");
  }

  function refreshPlayerTile() {
    // The visible grid now represents different geographic squares after a pan or zoom.
    state.selected = null;
    renderTiles();
    renderSelected();
    if (playerTileIndex === null) setStatus("Your location is outside the visible territory grid. Move the map so your location marker is over a square.");
    else setStatus("You are on square " + (playerTileIndex + 1) + ". Only this square can be used.");
  }

  async function searchPlace(query) {
    if (!query.trim()) return;
    if (!map) { showToast("Map is still loading. Try again in a moment."); return; }
    setStatus("Searching for " + query.trim() + "…");
    try {
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query.trim()));
      if (!response.ok) throw new Error("Search unavailable");
      const results = await response.json();
      if (!results.length) {
        showToast("Place not found. Try a city or neighborhood.");
        setStatus("No matching place found.");
        return;
      }
      const place = results[0];
      map.setView([Number(place.lat), Number(place.lon)], 15);
      $("map-location").textContent = (place.display_name || query).split(",").slice(0, 3).join(", ").toUpperCase();
      setStatus("Map moved to the place you searched for.");
    } catch (_) {
      showToast("Place search failed. Try again in a moment.");
      setStatus("Could not search for that place.");
    }
  }

  $("claim-button").addEventListener("click", claimSelected);
  $("locate-me").addEventListener("click", locatePlayer);
  $("menu-button").addEventListener("click", () => $("settings-dialog").showModal());
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchPlace($("place-search").value);
  });
  $("zoom-in").addEventListener("click", () => map ? map.zoomIn() : showToast("Map is still loading."));
  $("zoom-out").addEventListener("click", () => map ? map.zoomOut() : showToast("Map is still loading."));
  $("reset-map").addEventListener("click", () => {
    $("place-search").value = "";
    if (map) map.setView([34.0522, -118.2437], 14);
    $("map-location").textContent = "GENERATED STARTER DISTRICT";
    refreshPlayerTile();
  });
  $("clear-log").addEventListener("click", () => { $("activity-log").innerHTML = ""; });
  $("reset-game").addEventListener("click", () => {
    if (!window.confirm("Reset all LandLordy progress on this browser?")) return;
    state = defaultState();
    $("activity-log").innerHTML = "";
    log("A fresh district awaits. Welcome back!");
    render();
    $("settings-dialog").close();
    showToast("Game progress reset.");
  });

  render();
  useDemoMap();

  // On refresh, automatically recenter only if location permission was
  // already granted. If permission is still undecided, wait for a button click
  // so the browser can show its permission prompt from a user action.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state === "granted") locatePlayer();
    }).catch(() => {});
  }
})();