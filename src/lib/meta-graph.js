/**
 * Single source of truth for the Meta Graph API version.
 *
 * When Meta deprecates the version, change `GRAPH_API_VERSION` here and the
 * change propagates everywhere. Importing files should never hardcode `v21.0`
 * (or whatever the current version is) themselves.
 */
export const GRAPH_API_VERSION = 'v21.0';

export const GRAPH_FB_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const GRAPH_IG_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
export const FB_OAUTH_BASE = `https://www.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Returns the right Graph base for a given send/lookup context.
 * useIgApi=true  → Instagram Business Login token  → graph.instagram.com
 * useIgApi=false → Facebook Page Access Token      → graph.facebook.com
 */
export const graphBase = (useIgApi) => (useIgApi ? GRAPH_IG_BASE : GRAPH_FB_BASE);
