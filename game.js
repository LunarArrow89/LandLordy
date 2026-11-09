(() => {
  "use strict";

  const SAVE_KEY = "landlordy-save-v1";
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
  let mapScriptLoading = false;
  let toastTimer = null;

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
    if (data.resource) return "Tile " + (index + 1) + " — " + data.resource resourceLabel();
    return "Tile " + (index + 1) + " — open land";
  }

  function resourceLabel() { return "resource"; }

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
    map = null;
    $("map").classList.remove("google-ready");
    $("territory-layer").style.display = "none";
    $("fallback-tiles").style.display = "grid";
    $("map-location").textContent = "GENERATED STARTER DISTRICT";
    renderTiles();
  }

  function connectGoogleMaps(key) {
    if (!key.trim()) { showToast("Enter a Google Maps API key first."); return; }
    if (window.google && window.google.maps) { initializeMap(); return; }
    if (mapScriptLoading) return;
    mapScriptLoading = true;
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key.trim()) + "&callback=landlordyMapsReady&v=weekly";
    script.async = true;
    script.defer = true;
    window.landlordyMapsReady = () => {
      mapScriptLoading = false;
      initializeMap();
    };
    script.onerror = () => {
      mapScriptLoading = false;
      showToast("Google Maps could not load. Check the key and API settings.");
    };
    document.head.appendChild(script);
  }

  function initializeMap() {
    if (!window.google || !window.google.maps) return;
    $("map").classList.add("google-ready");
    $("territory-layer").style.display = "grid";
    $("fallback-tiles").style.display = "none";
    map = new google.maps.Map($("map"), {
      center: { lat: 34.0522, lng: -118.2437 },
      zoom: 14,
      mapTypeId: "roadmap",
      streetViewControl: false,
      mapTypeControl: true,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy"
    });
    map.addListener("idle", () => {
      // The generated game grid is deliberately an abstract overlay, not a claim on real property.
      $("map-location").textContent = "GENERATED MAP DISTRICT · ZOOM " + map.getZoom();
      renderTiles();
    });
    setStatus("Google Maps connected. Select a game tile to claim it.");
    showToast("Google Maps connected!");
    render();
  }

  function searchPlace(query) {
    if (!query.trim()) return;
    if (!map) {
      $("map-location").textContent = "SEARCH: " + query.trim().toUpperCase();
      setStatus("Demo mode: connect Google Maps in settings to search real places.");
      showToast("Connect Google Maps to search real places.");
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query.trim() }, (results, status) => {
      if (status === "OK" && results[0]) {
        map.setCenter(results[0].geometry.location);
        map.setZoom(15);
        $("map-location").textContent = results[0].formatted_address.toUpperCase();
        setStatus("District generated around " + results[0].address_components[0].long_name + ".");
      } else {
        showToast("Place not found. Try a city or neighborhood.");
      }
    });
  }

  $("claim-button").addEventListener("click", claimSelected);
  $("build-button").addEventListener("click", buildSelected);
  $("menu-button").addEventListener("click", () => $("settings-dialog").showModal());
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchPlace($("place-search").value);
  });
  $("zoom-in").addEventListener("click", () => map ? map.setZoom(map.getZoom() + 1) : showToast("Connect Google Maps to zoom the real map."));
  $("zoom-out").addEventListener("click", () => map ? map.setZoom(map.getZoom() - 1) : showToast("Connect Google Maps to zoom the real map."));
  $("reset-map").addEventListener("click", () => {
    if (map) { map.setCenter({ lat: 34.0522, lng: -118.2437 }); map.setZoom(14); }
    else { $("place-search").value = ""; $("map-location").textContent = "GENERATED STARTER DISTRICT"; }
  });
  $("connect-maps").addEventListener("click", () => {
    const key = $("api-key").value.trim();
    if (key) {
      try { localStorage.setItem("landlordy-maps-key", key); } catch (_) {}
      connectGoogleMaps(key);
    }
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

  useDemoMap();
  render();
  try {
    const savedKey = localStorage.getItem("landlordy-maps-key");
    if (savedKey) $("api-key").value = savedKey;
  } catch (_) {}
})();