"use strict";

const STORAGE_KEY = "sidequest-projects-v1";

const projectGrid = document.querySelector("#project-grid");
const emptyState = document.querySelector("#empty-state");
const dialog = document.querySelector("#project-dialog");
const projectForm = document.querySelector("#project-form");
const searchInput = document.querySelector("#search-input");
const formError = document.querySelector("#form-error");
const toast = document.querySelector("#toast");
let projects = [];
let activeFilter = "all";
let toastTimeout;

function readProjects() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Saved project data is not a list.");
    return parsed.filter((project) =>
      project &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.repo === "string" &&
      typeof project.description === "string" &&
      typeof project.owner === "string" &&
      typeof project.needsHelp === "boolean"
    );
  } catch (error) {
    console.error("Could not load saved projects:", error);
    showToast("Could not load saved projects. Check this browser's storage settings.");
    return [];
  }
}

function saveProjects() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (error) {
    console.error("Could not save projects:", error);
    showToast("Could not save. Check this browser's storage settings and try again.");
    return false;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3500);
}

function safeRepoUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts.some((part) => part === "." || part === "..")) return null;
    return `https://github.com/${parts.map(encodeURIComponent).join("/")}`;
  } catch {
    return null;
  }
}

function makeLink(label, href, className) {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (className) link.className = className;
  return link;
}

function renderProjects() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleProjects = projects.filter((project) => {
    const matchesFilter = activeFilter === "all" || project.needsHelp;
    const matchesQuery = `${project.name} ${project.repo} ${project.description} ${project.owner}`
      .toLocaleLowerCase()
      .includes(query);
    return matchesFilter && matchesQuery;
  });

  projectGrid.replaceChildren();
  for (const project of visibleProjects) {
    const repoUrl = safeRepoUrl(project.repo);
    if (!repoUrl) continue;

    const card = document.createElement("article");
    card.className = "project-card";

    const top = document.createElement("div");
    top.className = "card-topline";
    const repoName = document.createElement("span");
    repoName.className = "repo-name";
    repoName.textContent = project.repo.replace(/^https:\/\/github\.com\//, "");
    const badge = document.createElement("span");
    badge.className = `project-badge${project.needsHelp ? "" : " sharing"}`;
    badge.textContent = project.needsHelp ? "Looking for help" : "Sharing progress";
    top.append(repoName, badge);

    const title = document.createElement("h3");
    title.className = "project-name";
    title.textContent = project.name;
    const description = document.createElement("p");
    description.className = "project-description";
    description.textContent = project.description;

    const bottom = document.createElement("div");
    bottom.className = "card-bottom";
    const owner = document.createElement("span");
    owner.className = "project-owner";
    owner.append(document.createTextNode("by "));
    const ownerName = document.createElement("span");
    ownerName.textContent = project.owner;
    owner.append(ownerName);

    const links = document.createElement("div");
    links.className = "card-links";
    links.append(
      makeLink("Issues ↗", `${repoUrl}/issues`),
      makeLink("Pull requests ↗", `${repoUrl}/pulls`),
      makeLink("Open repo ↗", repoUrl, "repo-link")
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-project";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${project.name} from this browser's board`);
    remove.addEventListener("click", () => removeProject(project.id));
    links.append(remove);

    bottom.append(owner, links);
    card.append(top, title, description, bottom);
    projectGrid.append(card);
  }

  document.querySelector("#all-count").textContent = String(projects.length);
  document.querySelector("#help-count").textContent = String(projects.filter((project) => project.needsHelp).length);
  emptyState.classList.toggle("visible", projects.length === 0);
  projectGrid.hidden = projects.length === 0;
}

function removeProject(id) {
  const previousProjects = projects;
  projects = projects.filter((project) => project.id !== id);
  if (!saveProjects()) {
    projects = previousProjects;
    return;
  }
  renderProjects();
  showToast("Project removed from this browser.");
}

function openDialog() {
  formError.textContent = "";
  dialog.showModal();
}

document.querySelector("#open-modal").addEventListener("click", openDialog);
document.querySelector("#open-modal-secondary").addEventListener("click", openDialog);
document.querySelector("#empty-add").addEventListener("click", openDialog);
document.querySelector("#close-modal").addEventListener("click", () => dialog.close());
document.querySelector("#cancel-modal").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
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

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";
  if (!projectForm.reportValidity()) return;

  const formData = new FormData(projectForm);
  const repo = safeRepoUrl(String(formData.get("repo")).trim());
  if (!repo) {
    formError.textContent = "Enter a GitHub URL in the format https://github.com/owner/repository.";
    return;
  }

  const project = {
    id: crypto.randomUUID(),
    name: String(formData.get("name")).trim(),
    repo,
    description: String(formData.get("description")).trim(),
    owner: String(formData.get("owner")).trim(),
    needsHelp: formData.get("needsHelp") === "yes"
  };
  if (Object.values(project).some((value) => typeof value === "string" && !value)) {
    formError.textContent = "Please fill in every field.";
    return;
  }

  projects.unshift(project);
  if (!saveProjects()) {
    projects.shift();
    return;
  }

  projectForm.reset();
  dialog.close();
  activeFilter = "all";
  for (const button of document.querySelectorAll(".filter-button")) {
    const isActive = button.dataset.filter === "all";
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  searchInput.value = "";
  renderProjects();
  showToast("Project added. Let’s build something!");
  document.querySelector("#projects").scrollIntoView({ behavior: "smooth" });
});

function updateCountdown() {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setDate(now.getDate() + 1);
  document.querySelector("#event-date").textContent = nextDay.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const remainingMinutes = Math.max(0, Math.floor((midnight - now) / 60000));
  document.querySelector("#countdown-days").textContent = String(Math.floor(remainingMinutes / 1440)).padStart(2, "0");
  document.querySelector("#countdown-hours").textContent = String(Math.floor((remainingMinutes % 1440) / 60)).padStart(2, "0");
  document.querySelector("#countdown-minutes").textContent = String(remainingMinutes % 60).padStart(2, "0");
}

document.querySelector("#share-button").addEventListener("click", async () => {
  const shareData = { title: document.title, text: "Join me and my friends for a day of building together!", url: window.location.href };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Site link copied — send it to your friends!");
    } else {
      showToast("Copy this page's address and send it to your friends.");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Could not share the site:", error);
      showToast("Sharing failed. Copy the page address and send it to your friends.");
    }
  }
});

projects = readProjects();
renderProjects();
updateCountdown();
window.setInterval(updateCountdown, 60000);
