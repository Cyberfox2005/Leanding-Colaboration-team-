"use strict";

const crypto = require("node:crypto");
const {
  SESSION_COOKIE,
  STATE_COOKIE,
  SESSION_LIFETIME_SECONDS,
  appendCookie,
  clearCookie,
  cookieOptions,
  encryptSession,
  getCookie,
  getSiteUrl,
  setSecurityHeaders,
  githubFetch,
  isAllowedUser
} = require("../../lib/github");

module.exports = async function callback(req, res) {
  setSecurityHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed.");
  }

  let siteUrl;
  try {
    siteUrl = getSiteUrl(req);
  } catch (error) {
    console.error("GitHub sign-in callback has no valid site URL:", error);
    return res.status(500).send("GitHub sign-in is not configured with a site URL.");
  }
  const stateCookie = getCookie(req, STATE_COOKIE);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  clearCookie(res, STATE_COOKIE, req);

  if (
    !state ||
    !stateCookie ||
    Buffer.byteLength(state) !== Buffer.byteLength(stateCookie) ||
    !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie))
  ) {
    return res.redirect(302, `${siteUrl}/?auth=invalid#projects`);
  }

  if (typeof req.query.error === "string") {
    return res.redirect(302, `${siteUrl}/?auth=cancelled#projects`);
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) return res.redirect(302, `${siteUrl}/?auth=invalid#projects`);

  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  if (
    !clientId ||
    !clientSecret ||
    !process.env.GITHUB_APP_ID ||
    !process.env.GITHUB_APP_PRIVATE_KEY ||
    !process.env.AUTH_SECRET ||
    !process.env.SITE_URL
  ) {
    return res.redirect(302, `${siteUrl}/?auth=not-configured#projects`);
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${siteUrl}/api/auth/callback`
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenData.access_token !== "string") {
      console.error("GitHub OAuth token exchange failed:", tokenData.error || tokenResponse.status);
      return res.redirect(302, `${siteUrl}/?auth=failed#projects`);
    }

    const profile = await githubFetch("/user", tokenData.access_token);
    if (!isAllowedUser(profile.login)) {
      return res.redirect(302, `${siteUrl}/?auth=not-authorized#projects`);
    }

    const tokenLifetime = Number.isFinite(Number(tokenData.expires_in))
      ? Math.min(Number(tokenData.expires_in), SESSION_LIFETIME_SECONDS)
      : SESSION_LIFETIME_SECONDS;
    const maxAge = Math.max(60, tokenLifetime);
    const encrypted = encryptSession({
      handle: profile.login,
      expiresAt: Date.now() + maxAge * 1000
    });
    appendCookie(res, SESSION_COOKIE, encrypted, cookieOptions(req, maxAge));
    return res.redirect(302, `${siteUrl}/?auth=success#projects`);
  } catch (error) {
    console.error("GitHub sign-in callback failed:", error);
    return res.redirect(302, `${siteUrl}/?auth=failed#projects`);
  }
};
