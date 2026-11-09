(() => {
  "use strict";

  const SAVE_KEY = "landlordy-save-v1";
  const MAP_KEY_STORAGE = "landlordy-google-maps-key-v1";
  const TILE_COUNT = 48;
  const CLAIM_COST = 25;
  const BUILD_COST = 40;
  const $ = (id) => document.getElementById(id);

  const defaultState = () => ({
    coins: 120, wood: 3, stone: 2, energy: 5, level: 1, xp: 0,
    tiles: {}, selected: null, mapCenter: "starter"
  });

  let state = loadState();
  let map = null;
  let googleMapsLoading = null;
  let googleMapMarker = null;
  let googleMapCircle = null;
  let toastTimer = null;
  let currentDevicePosition = null;
  let playerLocationMarker = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      return saved && typeof saved === "object" ? { ...defaultState(), ...saved } : defaultState();
    } catch (_) { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function tileData(index) {
    const saved = state.tiles[index];
    if (saved) return saved;
    // Fixed, deterministic resource placement so the same generated district is consistent.
    const resource = index % 11 === 3 ? "wood" : index % 13 === 6 ? "stone" : null;
    return { owner: false, built: false, resource };
  }

  function render() {
    $("coins").textContent = state.coins;
    $("land-count").textContent = Object.values(state.tiles).filter(t => t.owner).length;
    $("level").textContent = state.level;
    $("wood").textContent = state.wood;
    $("stone").textContent = state.stone;
    $("energy").textContent = state.energy;
    $("mission-claim").textContent = Object.values(state.tiles).some(t => t.owner) ? "✓" : "○";
    $("mission-build").textContent = Object.values(state.tiles).some(t => t.built) ? "✓" : "○";
    renderTiles();
    renderSelected();
    saveState();
  }

  function renderTiles() {
    const layer = map ? $("territory-layer") : $("fallback-tiles");
    layer.innerHTML = "";
    for (let i = 0; i < TILE_COUNT; i++) {
      const data = tileData(i);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "territory-tile" +
        (data.owner ? " owned" : "") + (data.built ? " built" : "") +
        (data.resource && !data.owner ? " resource" : "") +
        (state.selected === i ? " selected" : "");
      button.setAttribute("aria-label", tileDescription(i, data));
      button.title = tileDescription(i, data);
      button.innerHTML = data.built ? '<span class="tile-symbol">⌂</span>' :
        data.owner ? '<span class="tile-symbol">◆</span>' :
        data.resource ? '<span class="tile-symbol">' + (data.resource === "wood" ? "♣" : "◈") + '</span>' : "";
      button.addEventListener("click", () => {
        state.selected = i;
        setStatus("Tile " + (i + 1) + " selected.");
        render();
      });
      layer.appendChild(button);
    }
  }

  function tileDescription(index, data) {
    if (data.built) return "Tile " + (index + 1) + " — your outpost";
    if (data.owner) return "Tile " + (index + 1) + " — claimed by you";
    if (data.resource) return "Tile " + (index + 1) + " — " + data.resource + " resource";
    return "Tile " + (index + 1) + " — open land";
  }


  function renderSelected() {
    const claim = $("claim-button");
    const build = $("build-button");
    if (state.selected === null) {
      $("tile-tag").textContent = "NONE";
      $("tile-details").innerHTML = '<div class="tile-icon">▦</div><div><strong>Pick a tile</strong><p>Select any open square on the map to see what it contains.</p></div>';
      claim.disabled = true; build.disabled = true;
      return;
    }
    const index = state.selected;
    const data = tileData(index);
    $("tile-tag").textContent = data.owner ? "YOURS" : data.resource ? "RESOURCE" : "OPEN";
    const title = data.built ? "Outpost · Tile " + (index + 1) :
      data.owner ? "Your land · Tile " + (index + 1) :
      data.resource ? data.resource.toUpperCase() + " deposit · Tile " + (index + 1) :
      "Open land · Tile " + (index + 1);
    const desc = data.built ? "Your outpost is established here. It earns you a little experience." :
      data.owner ? "This tile belongs to your growing territory." :
      data.resource ? "Claim this tile to collect its " + data.resource + " supply." :
      "Claim this tile and add it to your territory.";
    $("tile-details").innerHTML = '<div class="tile-icon">' + (data.built ? "⌂" : data.resource ? (data.resource === "wood" ? "♣" : "◈") : "▦") + '</div><div><strong></strong><p></p></div>';
    $("tile-details").querySelector("strong").textContent = title;
    $("tile-details").querySelector("p").textContent = desc;
    claim.disabled = data.owner || state.coins < CLAIM_COST;
    claim.textContent = data.owner ? "ALREADY CLAIMED" : "CLAIM TILE · " + CLAIM_COST + " COINS";
    build.disabled = !data.owner || data.built || state.coins < BUILD_COST || state.wood < 1;
    build.textContent = data.built ? "OUTPOST BUILT" : "BUILD · " + BUILD_COST + " COINS + 1 WOOD";
  }

  function claimSelected() {
    const i = state.selected;
    if (i === null) return;
    const data = tileData(i);
    if (data.owner || state.coins < CLAIM_COST) return;
    state.coins -= CLAIM_COST;
    data.owner = true;
    state.tiles[i] = data;
    if (data.resource === "wood") { state.wood += 2; log("Collected 2 wood from your new tile."); }
    if (data.resource === "stone") { state.stone += 2; log("Collected 2 stone from your new tile."); }
    addXp(10);
    log("Claimed tile " + (i + 1) + " for " + CLAIM_COST + " coins.");
    showToast("Tile claimed! Your territory is growing.");
    render();
  }

  function buildSelected() {
    const i = state.selected;
    if (i === null) return;
    const data = tileData(i);
    if (!data.owner || data.built || state.coins < BUILD_COST || state.wood < 1) return;
    state.coins -= BUILD_COST;
    state.wood -= 1;
    data.built = true;
    state.tiles[i] = data;
    addXp(25);
    state.coins += 50;
    log("Built an outpost on tile " + (i + 1) + ". Starter reward: 50 coins.");
    showToast("Outpost built! +50 coins.");
    render();
  }

  function addXp(amount) {
    state.xp += amount;
    const needed = state.level * 50;
    if (state.xp >= needed) {
      state.xp -= needed;
      state.level += 1;
      state.coins += 20;
      log("Level up! You are now level " + state.level + ". +20 coins.");
    }
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
    $("map").classList.remove("map-ready");
    $("map-fallback").style.display = "block";
    $("territory-layer").style.display = "none";
    renderTiles();
    const savedKey = localStorage.getItem(MAP_KEY_STORAGE) || "";
    $("google-maps-key").value = savedKey;
    if (savedKey) loadGoogleMaps(savedKey);
    else setStatus("Add your Google Maps API key in the menu to load Google Maps.");
  }

  function loadGoogleMaps(apiKey) {
    if (!apiKey || !apiKey.trim()) {
      setStatus("Enter a Google Maps API key in settings.");
      return;
    }
    if (window.google && window.google.maps) {
      initializeGoogleMap();
      return;
    }
    if (googleMapsLoading) return googleMapsLoading;
    setStatus("Loading Google Maps…");
    googleMapsLoading = new Promise((resolve, reject) => {
      const callbackName = "__landlordyGoogleMapsReady";
      window[callbackName] = () => {
        delete window[callbackName];
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey.trim()) + "&callback=" + callbackName + "&v=weekly";
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window[callbackName];
        googleMapsLoading = null;
        reject(new Error("Google Maps could not load. Check the API key and enabled API."));
      };
      document.head.appendChild(script);
    }).then(() => {
      initializeGoogleMap();
      googleMapsLoading = null;
    }).catch((error) => {
      googleMapsLoading = null;
      setStatus(error.message + " Check your key and Maps JavaScript API settings.");
      showToast("Google Maps could not load. Check your API key.");
    });
    return googleMapsLoading;
  }

  function initializeGoogleMap() {
    if (!window.google || !window.google.maps) return;
    if (!map) {
      map = new google.maps.Map($("map"), {
        center: currentDevicePosition || { lat: 34.0522, lng: -118.2437 },
        zoom: currentDevicePosition ? 16 : 14,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy"
      });
      map.addListener("idle", () => {
        $("map-location").textContent = "GOOGLE MAPS · ZOOM " + map.getZoom();
      });
    }
    $("map").classList.add("map-ready");
    $("map-fallback").style.display = "none";
    $("territory-layer").style.display = "grid";
    if (currentDevicePosition) showPlayerOnMap(currentDevicePosition);
    renderTiles();
    setStatus("Google Maps loaded. Select a tile to claim it!");
    $("map-location").textContent = "GOOGLE MAPS";
  }

  function saveGoogleMapsKey() {
    const key = $("google-maps-key").value.trim();
    if (!key) {
      showToast("Paste your Google Maps API key first.");
      return;
    }
    localStorage.setItem(MAP_KEY_STORAGE, key);
    showToast("API key saved in this browser. Reloading the map…");
    window.location.reload();
  }

  function clearGoogleMapsKey() {
    localStorage.removeItem(MAP_KEY_STORAGE);
    $("google-maps-key").value = "";
    showToast("Saved API key cleared from this browser.");
    window.location.reload();
  }


  function locatePlayer() {
    if (!map) {
      showToast("Add your Google Maps API key in the menu first.");
      return;
    }
    if (!navigator.geolocation) {
      showToast("Location is not available in this browser.");
      return;
    }
    $("locate-me").disabled = true;
    $("locate-me").textContent = "REQUESTING…";
    setStatus("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentDevicePosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        $("locate-me").disabled = false;
        $("locate-me").textContent = "⌖ MY LOCATION";
        showPlayerOnMap(currentDevicePosition);
        setStatus("Map centered on your location. Location is only used in this tab.");
        showToast("Your location is on the map.");
      },
      (error) => {
        $("locate-me").disabled = false;
        $("locate-me").textContent = "⌖ MY LOCATION";
        const message = error.code === 1 ? "Location permission was denied." :
          error.code === 2 ? "Your location could not be determined." :
          "Location request timed out. Try again.";
        setStatus(message + " You can still play without location.");
        showToast(message);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }

  function showPlayerOnMap(position) {
    if (!map || !window.google || !window.google.maps) return;
    const point = { lat: position.lat, lng: position.lng };
    map.setCenter(point);
    map.setZoom(16);
    if (googleMapMarker) googleMapMarker.setMap(null);
    if (googleMapCircle) googleMapCircle.setMap(null);
    googleMapMarker = new google.maps.Marker({
      position: point,
      map,
      title: "Your current location"
    });
    googleMapCircle = new google.maps.Circle({
      map,
      center: point,
      radius: 35,
      fillColor: "#4285f4",
      fillOpacity: 0.12,
      strokeColor: "#4285f4",
      strokeOpacity: 0.65,
      strokeWeight: 1
    });
    $("map-location").textContent = "YOUR CURRENT AREA";
  }

  async function searchPlace(query) {
    if (!query.trim()) return;
    if (!map) {
      showToast("Add your Google Maps API key in the menu first.");
      return;
    }
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
      map.setCenter({ lat: Number(place.lat), lng: Number(place.lon) });
      map.setZoom(15);
      $("map-location").textContent = (place.display_name || query).split(",").slice(0, 3).join(", ").toUpperCase();
      setStatus("Map moved to the place you searched for.");
    } catch (_) {
      showToast("Place search failed. Try again in a moment.");
      setStatus("Could not search for that place.");
    }
  }

  $("claim-button").addEventListener("click", claimSelected);
  $("locate-me").addEventListener("click", locatePlayer);
  $("save-map-key").addEventListener("click", saveGoogleMapsKey);
  $("clear-map-key").addEventListener("click", clearGoogleMapsKey);
  $("build-button").addEventListener("click", buildSelected);
  $("menu-button").addEventListener("click", () => $("settings-dialog").showModal());
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchPlace($("place-search").value);
  });
  $("zoom-in").addEventListener("click", () => map ? map.zoomIn() : showToast("Map is still loading."));
  $("zoom-out").addEventListener("click", () => map ? map.zoomOut() : showToast("Map is still loading."));
  $("reset-map").addEventListener("click", () => {
    $("place-search").value = "";
    if (map) { map.setCenter({ lat: 34.0522, lng: -118.2437 }); map.setZoom(14); }
    $("map-location").textContent = "GENERATED STARTER DISTRICT";
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
})();