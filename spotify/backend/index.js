export function createSpotifyAuthRequest({ clientId, redirectUri, state, scopes = [] }) {
  if (!clientId || !redirectUri || !state) throw new TypeError("clientId, redirectUri, and state are required");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: [...new Set(scopes)].sort().join(" "),
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function normalizeSpotifyPlayback(payload) {
  if (!payload || typeof payload !== "object") return { playing: false, item: null, progressMs: 0 };
  const item = payload.item && typeof payload.item === "object" ? payload.item : null;
  return {
    playing: Boolean(payload.is_playing),
    progressMs: Number.isFinite(payload.progress_ms) ? Math.max(0, payload.progress_ms) : 0,
    item: item
      ? {
          id: typeof item.id === "string" ? item.id : null,
          title: typeof item.name === "string" ? item.name : "Unknown",
          artists: Array.isArray(item.artists)
            ? item.artists.map((artist) => artist?.name).filter((name) => typeof name === "string")
            : [],
        }
      : null,
  };
}

export function spotifyCommand(command) {
  const routes = {
    play: { method: "PUT", path: "/v1/me/player/play" },
    pause: { method: "PUT", path: "/v1/me/player/pause" },
    next: { method: "POST", path: "/v1/me/player/next" },
    previous: { method: "POST", path: "/v1/me/player/previous" },
  };
  const route = routes[command];
  if (!route) throw new TypeError(`unsupported Spotify command '${command}'`);
  return route;
}
