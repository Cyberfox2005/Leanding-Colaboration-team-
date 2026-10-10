"use strict";

const crypto = require("node:crypto");
const { STATE_COOKIE, appendCookie, cookieOptions, getSiteUrl, setSecurityHeaders } = require("../../lib/github");

module.exports = function login(req, res) {
  setSecurityHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed.");
  }

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
    return res.status(503).send("GitHub sign-in is not configured yet.");
  }

  try {
    const state = crypto.randomBytes(32).toString("base64url");
    appendCookie(res, STATE_COOKIE, state, cookieOptions(req, 10 * 60));
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", `${getSiteUrl(req)}/api/auth/callback`);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("allow_signup", "false");
    return res.redirect(302, authorizeUrl.toString());
  } catch (error) {
    console.error("Could not start GitHub sign-in:", error);
    return res.status(500).send("Could not start GitHub sign-in.");
  }
};
