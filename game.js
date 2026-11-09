(() => {
  "use strict";

  const SAVE_KEY = "landlordy-save-v1";
  const BASE_TILE_ZOOM = 16;
  const TILE_SIZE = 16;
  const LAND_COST = 25;
  const PRODUCTION_INTERVAL = 5 * 60 * 1000;
  const BUILDINGS = {
    farm:  { name: "Farm",  icon: "🌾", cost: 15, coins: 3,  food: 2, goods: 0, materials: 0, population: 0, description: "+2 food and +3 coins" },
    store: { name: "Store", icon: "▣",  cost: 35, coins: 6,  food: 0, goods: 1, materials: 0, population: 0, description: "+1 goods and +6 coins" },
    town:  { name: "Town",  icon: "⌂",  cost: 75, coins: 8,  food: 2, goods: 0, materials: 0, population: 2, description: "+2 food, +2 population and +8 coins" },
    city:  { name: "City",  icon: "▦",  cost: 225,coins: 20, food: 0, goods: 3, materials: 2, population: 5, description: "+3 goods, +2 materials, +5 population and +20 coins" }
  };
    const $ = (id) => document.getElementById(id);

  const defaultState = () => ({
    coins: 120,
    resources: { food: 0, goods: 0, materials: 0, population: 0 },
    lastProductionAt: Date.now(),
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
      if (!saved || typeof saved !== "object") return defaultState();
      const merged = { ...defaultState(), ...saved };
      merged.resources = { ...defaultState().resources, ...(saved.resources || {}) };
      if (!Number.isFinite(merged.lastProductionAt)) merged.lastProductionAt = Date.now();
      if (!merged.tiles || typeof merged.tiles !== "object") merged.tiles = {};
      return merged;
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
      button.className = "territory-tile" + (data.owner ? " owned" : "") + (data.building ? " built" : "") + (state.selected === key ? " selected" : "");
      button.style.left = p1.x + "px";
      button.style.top = p1.y + "px";
      button.style.width = (p2.x - p1.x) + "px";
      button.style.height = (p2.y - p1.y) + "px";
      button.disabled = playerTileIndex !== key;
      button.title = tileDescription(key, data);
      button.setAttribute("aria-label", button.title);
      button.innerHTML = data.owner ? '<span class="tile-symbol">' + (data.building ? BUILDINGS[data.building].icon : "◆") + '</span>' : "";
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
    renderResources();
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
    if (!data.owner) return "Land square " + key + " — open land";
    return "Land square " + key + " — " + (data.building ? BUILDINGS[data.building].name : "claimed land");
  }

  function getBuildingRates() {
    const rates = { coins: 0, food: 0, goods: 0, materials: 0, population: 0 };
    Object.values(state.tiles).forEach(tile => {
      if (!tile.owner || !tile.building || !BUILDINGS[tile.building]) return;
      Object.keys(rates).forEach(resource => rates[resource] += BUILDINGS[tile.building][resource] || 0);
    });
    return rates;
  }

  function renderResources() {
    const rates = getBuildingRates();
    ["food", "goods", "materials", "population"].forEach(resource => {
      $("resource-" + resource).textContent = Math.floor(state.resources[resource] || 0);
      $("rate-" + resource).textContent = "+" + rates[resource] + " / 5m";
    });
    $("coin-income").textContent = "+" + rates.coins + " coins / 5 min";
    const elapsed = Date.now() - state.lastProductionAt;
    const remaining = Math.max(0, PRODUCTION_INTERVAL - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    $("production-timer").textContent = rates.coins || rates.food || rates.goods || rates.materials || rates.population
      ? "Next production in " + minutes + "m " + seconds + "s"
      : "Build something to start producing resources.";
  }

  function processProduction() {
    const now = Date.now();
    if (!Number.isFinite(state.lastProductionAt)) state.lastProductionAt = now;
    const cycles = Math.floor((now - state.lastProductionAt) / PRODUCTION_INTERVAL);
    if (cycles <= 0) return false;
    const rates = getBuildingRates();
    Object.keys(state.resources).forEach(resource => {
      state.resources[resource] += (rates[resource] || 0) * cycles;
    });
    state.coins += rates.coins * cycles;
    state.lastProductionAt += cycles * PRODUCTION_INTERVAL;
    return true;
  }

  function renderSelected() {
    const claim = $("claim-button");
    const select = $("building-select");
    const preview = $("building-preview");
    const selectedType = select.value;
    const building = BUILDINGS[selectedType];
    const data = state.selected === null ? null : tileData(state.selected);
    const claimedCount = Object.values(state.tiles).filter(t => t.owner).length;
    const cityRequirement = selectedType === "city" && claimedCount + (data && data.owner ? 0 : 1) < 4;
    preview.textContent = building.name + " · " + building.cost + " build coins · " + building.description + " every 5 min.";
    if (state.selected === null) {
      $("tile-tag").textContent = "NONE";
      $("tile-details").innerHTML = "<strong>Tap your square</strong><p>Choose a building, then buy the land beneath your location.</p>";
      claim.disabled = true;
      claim.textContent = "BUY LAND";
      return;
    }
    const here = playerTileIndex === state.selected;
    $("tile-tag").textContent = data.owner ? "YOURS" : "OPEN";
    $("tile-details").innerHTML = "<strong></strong><p></p>";
    $("tile-details").querySelector("strong").textContent = data.building ? BUILDINGS[data.building].name : (data.owner ? "Your land" : "Open land");
    $("tile-details").querySelector("p").textContent = data.building
      ? "This building is producing resources every 5 minutes."
      : (data.owner ? "You own this square. Choose a building for it." : "Buy this square and choose its building.");
    if (data.building) {
      claim.disabled = true;
      claim.textContent = "ALREADY BUILT";
      select.disabled = true;
      preview.textContent = BUILDINGS[data.building].name + " is built here.";
      return;
    }
    select.disabled = false;
    const totalCost = building.cost + (data.owner ? 0 : LAND_COST);
    claim.textContent = (data.owner ? "BUILD " : "BUY + BUILD · ") + totalCost + " COINS";
    claim.disabled = !here || state.coins < totalCost || cityRequirement;
    if (cityRequirement) preview.textContent += " City needs 4 claimed squares (including this purchase).";
  }

  function purchaseSelected() {
    const key = state.selected;
    if (key === null || findPlayerTile() !== key) {
      showToast("You must be standing on that square to buy or build there.");
      return;
    }
    const data = tileData(key);
    if (data.building) return;
    const type = $("building-select").value;
    const building = BUILDINGS[type];
    if (!building) return;
    const claimedCount = Object.values(state.tiles).filter(t => t.owner).length;
    const cityWouldHave = claimedCount + (data.owner ? 0 : 1);
    if (type === "city" && cityWouldHave < 4) {
      showToast("A city needs 4 claimed land squares first.");
      return;
    }
    const totalCost = building.cost + (data.owner ? 0 : LAND_COST);
    if (state.coins < totalCost) {
      showToast("You need " + totalCost + " coins for this.");
      return;
    }
    state.coins -= totalCost;
    // Start a fresh five-minute production cycle when a new building is placed.
    state.lastProductionAt = Date.now();
    data.owner = true;
    data.building = type;
    state.tiles[key] = data;
    log("Built a " + building.name + " for " + totalCost + " coins.");
    showToast(building.name + " built! It produces every 5 minutes.");
    render();
  }

  function log(message) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "activity-dot";
    const text = document.createElement("span");
    text.textContent = message;
    li.append(dot, text);
    const activityLog = $("activity-log");
    if (!activityLog) return;
    activityLog.prepend(li);
    while (activityLog.children.length > 12) activityLog.lastElementChild.remove();
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
    // Keep the territory grid attached to geographic coordinates while the map is dragged.
    // Leaflet updates container-point positions during "move", not only after the drag ends.
    map.on("move", renderTiles);
    map.on("moveend zoomend", () => {
      const locationLabel = $("map-location");
      if (locationLabel) locationLabel.textContent = "OPENSTREETMAP · ZOOM " + map.getZoom();
      refreshPlayerTile();
    });
    map.on("resize", refreshPlayerTile);
    setStatus("OpenStreetMap loaded. Select a tile to claim it!");
    const locationLabel = $("map-location");
    if (locationLabel) locationLabel.textContent = "OPENSTREETMAP";
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
    const locationLabel = $("map-location");
    if (locationLabel) locationLabel.textContent = "YOUR CURRENT AREA";
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
      const locationLabel = $("map-location");
      if (locationLabel) locationLabel.textContent = (place.display_name || query).split(",").slice(0, 3).join(", ").toUpperCase();
      setStatus("Map moved to the place you searched for.");
    } catch (_) {
      showToast("Place search failed. Try again in a moment.");
      setStatus("Could not search for that place.");
    }
  }

  $("claim-button").addEventListener("click", purchaseSelected);
  $("building-select").addEventListener("change", renderSelected);
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
    const locationLabel = $("map-location");
    if (locationLabel) locationLabel.textContent = "GENERATED STARTER DISTRICT";
    refreshPlayerTile();
  });
  $("reset-game").addEventListener("click", () => {
    if (!window.confirm("Reset all LandLordy progress on this browser?")) return;
    state = defaultState();
    const activityLog = $("activity-log");
    if (activityLog) activityLog.innerHTML = "";
    log("A fresh district awaits. Welcome back!");
    render();
    $("settings-dialog").close();
    showToast("Game progress reset.");
  });

  processProduction();
  render();
  useDemoMap();
  setInterval(() => {
    if (processProduction()) {
      render();
      showToast("Your buildings produced resources!");
    } else {
      renderResources();
    }
  }, 1000);

  // On refresh, automatically recenter only if location permission was
  // already granted. If permission is still undecided, wait for a button click
  // so the browser can show its permission prompt from a user action.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state === "granted") locatePlayer();
    }).catch(() => {});
  }
})();