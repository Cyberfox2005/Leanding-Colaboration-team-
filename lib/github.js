"use strict";

const crypto = require("node:crypto");

const SESSION_COOKIE = "bm_github_session";
const STATE_COOKIE = "bm_github_oauth_state";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const ALLOWED_USERS = new Set(["cyberfox2005", "mohking999"]);

function setSecurityHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function sendJson(res, status, body) {
  setSecurityHeaders(res);
  res.status(status).json(body);
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";
  for (const item of cookies.split(";")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function cookieOptions(req, maxAge) {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
    `Max-Age=${maxAge}`
  ].join("; ");
}

function appendCookie(res, name, value, options) {
  const existing = res.getHeader("Set-Cookie");
  const cookie = `${name}=${encodeURIComponent(value)}; ${options}`;
  res.setHeader("Set-Cookie", existing ? [...[].concat(existing), cookie] : cookie);
}

function clearCookie(res, name, req) {
  appendCookie(res, name, "", cookieOptions(req, 0));
}

function getEncryptionKey() {
  const encoded = process.env.AUTH_SECRET;
  if (!encoded) throw new Error("AUTH_SECRET is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("AUTH_SECRET must be a base64-encoded 32-byte key.");
  return key;
}

function encryptSession(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function decryptSession(value) {
  if (!value) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const session = JSON.parse(plaintext);
    if (
      typeof session.handle !== "string" ||
      !ALLOWED_USERS.has(session.handle.toLowerCase()) ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) return null;
    return session;
  } catch {
    return null;
  }
}

function isAllowedUser(handle) {
  return typeof handle === "string" && ALLOWED_USERS.has(handle.toLowerCase());
}

function createGitHubAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) throw new Error("GitHub App server credentials are not configured.");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: appId
  })).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const signingKey = privateKey.replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedToken), signingKey).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

function getSession(req) {
  return decryptSession(getCookie(req, SESSION_COOKIE));
}

function getSiteUrl(req) {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host;
  if (!host) throw new Error("SITE_URL must be set for this deployment.");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

async function githubFetch(path, accessToken, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your GitHub session expired. Sign in again.");
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub denied this request or temporarily rate-limited the app.");
    }
    if (response.status === 404) {
      throw new Error("No GitHub App installation was found for this account.");
    }
    throw new Error(data && data.message ? data.message : `GitHub returned an error (${response.status}).`);
  }
  return data;
}

module.exports = {
  ALLOWED_USERS,
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_LIFETIME_SECONDS,
  appendCookie,
  clearCookie,
  cookieOptions,
  createGitHubAppJwt,
  encryptSession,
  getCookie,
  getSession,
  getSiteUrl,
  githubFetch,
  isAllowedUser,
  sendJson,
  setSecurityHeaders
};
