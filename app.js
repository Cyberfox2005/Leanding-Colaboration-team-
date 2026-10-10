"use strict";

const CONTRIBUTORS = [
  {
    handle: "Cyberfox2005",
    name: "Benachi Abd elouaheb",
    role: "Developer & creator",
    accent: "green"
  },
  {
    handle: "Mohking999",
    name: "Mohamed Abdrazak",
    role: "Developer & creator",
    accent: "orange"
  }
];

const peopleGrid = document.querySelector("#people-grid");
const projectGrid = document.querySelector("#project-grid");
const projectsStatus = document.querySelector("#projects-status");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
let repositories = [];
let privateRepositories = [];
let activeFilter = "all";
let failedProfiles = [];
let signedInHandle = "";
const privateAccessTitle = document.querySelector("#private-access-title");
const privateAccessDescription = document.querySelector("#private-access-description");
const privateSignIn = document.querySelector("#private-sign-in");
const privateSignOut = document.querySelector("#private-sign-out");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealObserver = !reducedMotion && "IntersectionObserver" in window
  ? new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" })
  : null;

function revealElement(element, index = 0) {
  element.classList.add("reveal");
  element.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 65}ms`);
  if (!revealObserver) {
    element.classList.add("is-visible");
    return;
  }
  revealObserver.observe(element);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createLink(label, url, className) {
  const link = createElement("a", className, label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

async function githubRequest(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error("This GitHub profile could not be found.");
    if (response.status === 403 || response.status === 429) {
      throw new Error("GitHub’s public API is temporarily rate-limited. Please try again later.");
    }
    throw new Error(`GitHub returned an error (${response.status}).`);
  }

  return response.json();
}

async function fetchRepositories(handle) {
  const allRepositories = [];
  let page = 1;
  let pageRepositories;

  do {
    pageRepositories = await githubRequest(
      `/users/${encodeURIComponent(handle)}/repos?type=owner&sort=updated&per_page=100&page=${page}`
    );
    if (!Array.isArray(pageRepositories)) {
      throw new Error("GitHub returned an unexpected repository list.");
    }
    allRepositories.push(...pageRepositories);
    page += 1;
  } while (pageRepositories.length === 100);

  return allRepositories;
}

function renderPerson(contributor, profile, error) {
  const card = createElement("article", `person-card person-card-${contributor.accent}`);
  const top = createElement("div", "person-card-top");

  if (profile && profile.avatar_url) {
    const avatar = createElement("img", "person-avatar");
    avatar.src = profile.avatar_url;
    avatar.alt = `${contributor.name}'s GitHub avatar`;
    avatar.width = 64;
    avatar.height = 64;
    avatar.loading = "lazy";
    top.append(avatar);
  } else {
    top.append(createElement("span", "person-avatar person-avatar-fallback", contributor.name.charAt(0)));
  }

  const identity = createElement("div", "person-identity");
  identity.append(
    createElement("p", "eyebrow", contributor.role),
    createElement("h3", "", contributor.name),
    createElement("p", "person-handle", `@${contributor.handle}`)
  );
  top.append(identity);

  const biography = profile && profile.bio
    ? profile.bio
    : error
      ? error.message
      : "Developer sharing projects and experiments on GitHub.";
  card.append(top, createElement("p", "person-bio", biography));

  if (profile) {
    const stats = createElement("div", "person-stats");
    stats.append(
      createElement("span", "", `${profile.public_repos} public repos`),
      createElement("span", "", `${profile.followers} followers`)
    );
    if (profile.location) stats.append(createElement("span", "", profile.location));
    card.append(stats);
  }

  const footer = createElement("div", "person-footer");
  footer.append(
    createElement("span", "person-currently", error ? "Profile temporarily unavailable" : "Find me on GitHub"),
    createLink("View profile ↗", `https://github.com/${contributor.handle}`, "person-profile-link")
  );
  card.append(footer);
  return card;
}

function renderPeople(results) {
  peopleGrid.replaceChildren();
  for (const [index, result] of results.entries()) {
    const card = renderPerson(result.contributor, result.profile, result.error);
    peopleGrid.append(card);
    revealElement(card, index);
  }
}

function renderProjects() {
  const allRepositories = [...repositories, ...privateRepositories];
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleRepositories = allRepositories.filter((repository) => {
    const matchesOwner = activeFilter === "all" || repository.owner.login === activeFilter;
    const searchContent = `${repository.name} ${repository.description || ""} ${repository.owner.login} ${repository.language || ""}`;
    return matchesOwner && searchContent.toLocaleLowerCase().includes(query);
  });

  projectGrid.replaceChildren();
  for (const [index, repository] of visibleRepositories.entries()) {
    const card = createElement(
      "article",
      `project-card${repository.owner.login.toLowerCase() === "mohking999" ? " project-card-mohamed" : ""}${repository.private ? " project-card-private" : ""}`
    );
    const top = createElement("div", "card-topline");
    const owner = createLink(`@${repository.owner.login}`, `https://github.com/${repository.owner.login}`, "repo-owner");
    const updatedAt = new Date(repository.updated_at);
    const updated = createElement(
      "span",
      "repo-updated",
      Number.isNaN(updatedAt.getTime())
        ? "Public repository"
        : `Updated ${updatedAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
    );
    const metadata = createElement("div", "repo-meta");
    metadata.append(updated);
    if (repository.private) metadata.append(createElement("span", "repo-visibility", "Private"));
    top.append(owner, metadata);

    card.append(
      top,
      createElement("h3", "project-name", repository.name),
      createElement(
        "p",
        "project-description",
        repository.description || "A public project on GitHub. Open the repository to explore the code."
      )
    );

    const bottom = createElement("div", "card-bottom");
    const details = createElement("div", "repo-details");
    if (repository.language) {
      const language = createElement("span", "repo-language");
      language.append(createElement("span", "language-dot", ""), document.createTextNode(repository.language));
      details.append(language);
    }
    details.append(
      createElement("span", "repo-stat", `★ ${repository.stargazers_count}`),
      createElement("span", "repo-stat", `⑂ ${repository.forks_count}`)
    );

    const links = createElement("div", "card-links");
    links.append(createLink("Explore repo ↗", repository.html_url, "repo-link"));
    if (repository.has_issues) {
      links.append(createLink("Issues ↗", `${repository.html_url}/issues`));
    }
    bottom.append(details, links);
    card.append(bottom);
    projectGrid.append(card);
    revealElement(card, index % 6);
  }

  const benachiCount = allRepositories.filter((repo) => repo.owner.login.toLowerCase() === "cyberfox2005").length;
  const mohamedCount = allRepositories.filter((repo) => repo.owner.login.toLowerCase() === "mohking999").length;
  document.querySelector("#all-count").textContent = String(allRepositories.length);
  document.querySelector("#benachi-count").textContent = String(benachiCount);
  document.querySelector("#mohamed-count").textContent = String(mohamedCount);

  const loading = projectsStatus.dataset.loading === "true";
  projectsStatus.hidden = loading || allRepositories.length > 0;
  projectGrid.hidden = loading || visibleRepositories.length === 0;
  emptyState.classList.toggle("visible", !loading && allRepositories.length > 0 && visibleRepositories.length === 0);

  if (!loading && allRepositories.length === 0) {
    projectsStatus.hidden = false;
    projectsStatus.textContent = failedProfiles.length === CONTRIBUTORS.length
      ? "GitHub projects couldn’t be loaded. Check your connection or try again in a little while."
      : "No public repositories were found for these profiles yet.";
    emptyState.classList.remove("visible");
  } else if (visibleRepositories.length === 0 && allRepositories.length > 0) {
    document.querySelector("#empty-title").textContent = "No matching projects.";
    document.querySelector("#empty-description").textContent = "Try a different search or show projects from both of us.";
  }
}

async function loadContributors() {
  projectsStatus.dataset.loading = "true";
  projectsStatus.hidden = false;
  projectsStatus.textContent = "Loading repositories from GitHub…";

  const results = await Promise.all(CONTRIBUTORS.map(async (contributor) => {
    try {
      const [profile, contributorRepositories] = await Promise.all([
        githubRequest(`/users/${encodeURIComponent(contributor.handle)}`),
        fetchRepositories(contributor.handle)
      ]);
      return { contributor, profile, repositories: contributorRepositories };
    } catch (error) {
      console.error(`Could not load GitHub data for @${contributor.handle}:`, error);
      return { contributor, profile: null, repositories: [], error };
    }
  }));

  failedProfiles = results.filter((result) => result.error);
  renderPeople(results);
  repositories = results.flatMap((result) => result.repositories);
  repositories.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  projectsStatus.dataset.loading = "false";
  renderProjects();
}

function setPrivateAccessMessage(title, description) {
  privateAccessTitle.textContent = title;
  privateAccessDescription.textContent = description;
}

async function loadPrivateRepositories() {
  if (window.location.protocol === "file:") {
    privateSignIn.hidden = true;
    setPrivateAccessMessage(
      "Deploy the portfolio to Vercel to enable private access.",
      "Private repositories are protected by server-side GitHub sign-in. Deploy this site and configure its GitHub App to unlock them."
    );
    return;
  }

  try {
    const sessionResponse = await fetch("/api/auth/session", { credentials: "same-origin" });
    if (!sessionResponse.ok) throw new Error(`Sign-in status is unavailable (${sessionResponse.status}).`);
    const session = await sessionResponse.json();
    if (!session.authenticated) {
      setPrivateAccessMessage(
        "Your private repositories stay private.",
        "Sign in as Benachi or Mohamed to see private repositories the GitHub App is allowed to access."
      );
      return;
    }

    signedInHandle = session.handle;
    privateSignIn.hidden = true;
    privateSignOut.hidden = false;
    setPrivateAccessMessage(`Signed in as @${signedInHandle}.`, "Loading the private repositories this GitHub App is authorized to read…");

    const response = await fetch("/api/repos", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Private repositories are unavailable (${response.status}).`);
    if (!Array.isArray(data.repositories)) throw new Error("GitHub returned an unexpected private repository list.");
    privateRepositories = data.repositories;
    setPrivateAccessMessage(
      `Signed in as @${signedInHandle}.`,
      privateRepositories.length
        ? `${privateRepositories.length} private ${privateRepositories.length === 1 ? "repository is" : "repositories are"} available to this read-only GitHub App installation.`
        : "No private repositories have been granted to the GitHub App for these accounts."
    );
    renderProjects();
  } catch (error) {
    console.error("Could not load private GitHub repositories:", error);
    setPrivateAccessMessage(
      "Private repositories are unavailable.",
      `${error.message} Deploy to Vercel and complete the GitHub App setup to enable secure access.`
    );
  }
}

async function signOut() {
  privateSignOut.disabled = true;
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });
    if (!response.ok) throw new Error(`Sign-out failed (${response.status}).`);
    privateRepositories = [];
    signedInHandle = "";
    privateSignOut.hidden = true;
    privateSignIn.hidden = false;
    setPrivateAccessMessage(
      "Your private repositories stay private.",
      "Sign in as Benachi or Mohamed to see private repositories the GitHub App is allowed to access."
    );
    renderProjects();
  } catch (error) {
    console.error("Could not sign out:", error);
    setPrivateAccessMessage("Could not sign out.", "Please refresh the page and try again.");
  } finally {
    privateSignOut.disabled = false;
  }
}

searchInput.addEventListener("input", renderProjects);

for (const button of document.querySelectorAll(".filter-button")) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    for (const filterButton of document.querySelectorAll(".filter-button")) {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    }
    renderProjects();
  });
}

document.querySelector("#reset-filters").addEventListener("click", () => {
  activeFilter = "all";
  searchInput.value = "";
  for (const button of document.querySelectorAll(".filter-button")) {
    const isActive = button.dataset.filter === "all";
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  renderProjects();
});
privateSignOut.addEventListener("click", signOut);

const authNotice = new URLSearchParams(window.location.search).get("auth");
if (authNotice) {
  const authMessages = {
    success: "GitHub sign-in successful.",
    "not-authorized": "Only Benachi and Mohamed can sign in to view private projects.",
    "not-configured": "GitHub sign-in is not configured yet. Finish the Vercel setup first.",
    invalid: "GitHub sign-in could not be verified. Please try again.",
    failed: "GitHub sign-in failed. Please try again.",
    cancelled: "GitHub sign-in was cancelled."
  };
  if (authMessages[authNotice]) setPrivateAccessMessage("GitHub sign-in", authMessages[authNotice]);
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
}

document
  .querySelectorAll(".hero-copy, .hero-note, .people-section > .section-heading, .projects-section > .section-heading, .board-toolbar, .bottom-cta")
  .forEach((element, index) => revealElement(element, index));

loadContributors();
loadPrivateRepositories();
