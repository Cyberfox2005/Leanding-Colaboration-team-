"use strict";

const { clearCookie, getSession, SESSION_COOKIE, sendJson } = require("../../lib/github");

module.exports = function session(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const currentSession = getSession(req);
  if (!currentSession) {
    clearCookie(res, SESSION_COOKIE, req);
    return sendJson(res, 200, { authenticated: false });
  }

  return sendJson(res, 200, {
    authenticated: true,
    handle: currentSession.handle,
    expiresAt: currentSession.expiresAt
  });
};
