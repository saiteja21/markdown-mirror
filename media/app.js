const state = {
  selectedUri: null,
  treeRoots: []
};

const treeEl = document.getElementById("tree");
const contentEl = document.getElementById("content");
const statusEl = document.getElementById("status");
const docTitleEl = document.getElementById("doc-title");

void bootstrap();

async function bootstrap() {
  await loadTree();
  connectSocket();
}

async function loadTree() {
  const response = await fetch("/api/tree");
  if (!response.ok) {
    contentEl.innerHTML = "<p>Unable to load workspace tree.</p>";
    return;
  }

  const payload = await response.json();
  state.treeRoots = Array.isArray(payload.roots) ? payload.roots : [];
  renderTree();

  const firstFile = findFirstFile(state.treeRoots);
  if (firstFile && firstFile.uri) {
    await openDocument(firstFile.uri, firstFile.relativePath);
  }
}

function renderTree() {
  treeEl.innerHTML = "";

  if (state.treeRoots.length === 0) {
    treeEl.innerHTML = "<p>No markdown files found.</p>";
    return;
  }

  for (const root of state.treeRoots) {
    const rootLabel = document.createElement("div");
    rootLabel.className = "tree-label";
    rootLabel.textContent = root.name;
    treeEl.appendChild(rootLabel);

    const group = document.createElement("div");
    group.className = "tree-group";
    treeEl.appendChild(group);
    appendNodes(group, root.children || []);
  }
}

function appendNodes(container, nodes) {
  for (const node of nodes) {
    if (node.kind === "folder") {
      const label = document.createElement("div");
      label.className = "tree-label";
      label.textContent = node.name;
      container.appendChild(label);

      const group = document.createElement("div");
      group.className = "tree-group";
      container.appendChild(group);
      appendNodes(group, node.children || []);
      continue;
    }

    const button = document.createElement("button");
    button.className = "tree-item";
    button.type = "button";
    button.textContent = node.name;
    button.dataset.uri = node.uri;
    button.addEventListener("click", () => {
      void openDocument(node.uri, node.relativePath);
    });

    if (state.selectedUri && state.selectedUri === node.uri) {
      button.classList.add("active");
    }

    container.appendChild(button);
  }
}

async function openDocument(uri, relativePath) {
  if (!uri) {
    return;
  }

  const response = await fetch(`/api/document?uri=${encodeURIComponent(uri)}`);
  if (!response.ok) {
    contentEl.innerHTML = "<p>Unable to load markdown content.</p>";
    return;
  }

  const payload = await response.json();
  state.selectedUri = payload.uri;
  docTitleEl.textContent = relativePath || payload.relativePath || "Untitled";
  contentEl.innerHTML = payload.html || "";
  refreshSelection();
}

function refreshSelection() {
  for (const node of treeEl.querySelectorAll(".tree-item")) {
    if (node.dataset.uri === state.selectedUri) {
      node.classList.add("active");
    } else {
      node.classList.remove("active");
    }
  }
}

function connectSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener("open", () => {
    statusEl.textContent = "Connected";
    statusEl.classList.add("online");
  });

  socket.addEventListener("close", () => {
    statusEl.textContent = "Disconnected";
    statusEl.classList.remove("online");
    setTimeout(connectSocket, 1000);
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type !== "document-updated") {
      return;
    }

    if (message.uri !== state.selectedUri) {
      return;
    }

    if (typeof message.html === "string") {
      // Only replace rendered content to avoid full page flicker.
      contentEl.innerHTML = message.html;
    }
  });
}

function findFirstFile(roots) {
  for (const root of roots) {
    const found = findFirstInNodes(root.children || []);
    if (found) {
      return found;
    }
  }
  return null;
}

function findFirstInNodes(nodes) {
  for (const node of nodes) {
    if (node.kind === "file" && node.uri) {
      return node;
    }

    if (node.kind === "folder") {
      const found = findFirstInNodes(node.children || []);
      if (found) {
        return found;
      }
    }
  }

  return null;
}
