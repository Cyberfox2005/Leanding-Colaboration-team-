"use strict";

const { createGitHubAppJwt, getSession, githubFetch, isAllowedUser, sendJson } = require("../lib/github");

const ALLOWED_REPOSITORY_OWNERS = new Set(["cyberfox2005", "mohking999"]);

module.exports = async function privateRepositories(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const session = getSession(req);
  if (!session) return sendJson(res, 401, { error: "Sign in with an authorized collaborator account to view private repositories." });

  try {
    const repositories = [];
    const appJwt = createGitHubAppJwt();
    let page = 1;
    let installations;
    do {
      installations = await githubFetch(`/app/installations?per_page=100&page=${page}`, appJwt);
      if (!Array.isArray(installations)) {
        throw new Error("GitHub returned an unexpected installation list.");
      }

      for (const installation of installations) {
        const owner = installation.account && installation.account.login;
        if (!isAllowedUser(owner)) continue;

        const installationToken = await githubFetch(
          `/app/installations/${encodeURIComponent(installation.id)}/access_tokens`,
          appJwt,
          {
            method: "POST",
            body: JSON.stringify({ permissions: { metadata: "read" } })
          }
        );
        if (!installationToken || typeof installationToken.token !== "string") {
          throw new Error("GitHub did not return an installation access token.");
        }

        let repositoryPage = 1;
        let pageRepositories;
        do {
          const result = await githubFetch(
            `/installation/repositories?per_page=100&page=${repositoryPage}`,
            installationToken.token
          );
          if (!result || !Array.isArray(result.repositories)) {
            throw new Error("GitHub returned an unexpected installation repository list.");
          }
          pageRepositories = result.repositories;
          repositories.push(...pageRepositories);
          repositoryPage += 1;
        } while (pageRepositories.length === 100);
      }
      page += 1;
    } while (installations.length === 100);

    const uniqueRepositories = new Map();
    for (const repository of repositories) {
      if (!repository.private || !ALLOWED_REPOSITORY_OWNERS.has(repository.owner.login.toLowerCase())) continue;
      uniqueRepositories.set(repository.id, {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        html_url: repository.html_url,
        description: repository.description,
        language: repository.language,
        stargazers_count: repository.stargazers_count,
        forks_count: repository.forks_count,
        updated_at: repository.updated_at,
        has_issues: repository.has_issues,
        private: true,
        owner: { login: repository.owner.login }
      });
    }

    return sendJson(res, 200, {
      authenticatedAs: session.handle,
      repositories: [...uniqueRepositories.values()]
    });
  } catch (error) {
    console.error("Could not load authorized private repositories:", error);
    const message = error.message === "Your GitHub session expired. Sign in again."
      ? error.message
      : "Could not load private repositories. Confirm that the read-only GitHub App is installed on both collaborator accounts and the selected repositories.";
    return sendJson(res, 502, { error: message });
  }
};
