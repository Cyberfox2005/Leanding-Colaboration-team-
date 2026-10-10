"use strict";

const { clearCookie, SESSION_COOKIE, sendJson } = require("../../lib/github");

module.exports = function logout(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  clearCookie(res, SESSION_COOKIE, req);
  return sendJson(res, 200, { authenticated: false });
};
