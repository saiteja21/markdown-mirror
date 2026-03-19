const state = {
  treeRoots: [],
  collapsedFolders: new Set(),
  searchQuery: "",
  compareMode: false,
  activePane: "primary",
  selectedUriByPane: {
    primary: null,
    secondary: null
  },
  selectedPathByPane: {
    primary: null,
    secondary: null
  },
  panelPrefs: {
    leftWidth: 280,
    rightWidth: 300,
    leftCollapsed: false,
    rightCollapsed: true
  },
  responsiveForcedCollapse: false
};

const storageKeys = {
  widthMode: "markdownMirror.widthMode",
  themeMode: "markdownMirror.themeMode",
  compareMode: "markdownMirror.compareMode",
  leftPanelWidth: "markdownMirror.leftPanelWidth",
  rightPanelWidth: "markdownMirror.rightPanelWidth",
  leftPanelCollapsed: "markdownMirror.leftPanelCollapsed",
  rightPanelCollapsed: "markdownMirror.rightPanelCollapsed"
};

const constants = {
  widthModeFull: "full",
  widthModeReading: "reading",
  themeLight: "light",
  themeDark: "dark",
  minLeftWidth: 220,
  maxLeftWidth: 520,
  defaultLeftWidth: 280,
  minRightWidth: 220,
  maxRightWidth: 520,
  defaultRightWidth: 300,
  narrowBreakpoint: 1024
};

const appShellEl = document.getElementById("app-shell");
const leftPanelEl = document.getElementById("left-panel");
const rightPanelEl = document.getElementById("toc-panel");
const leftResizerEl = document.getElementById("left-resizer");
const rightResizerEl = document.getElementById("right-resizer");
const leftPanelToggleEl = document.getElementById("left-panel-toggle");
const rightPanelToggleEl = document.getElementById("right-panel-toggle");

const treeEl = document.getElementById("tree");
const statusEl = document.getElementById("status");
const breadcrumbEl = document.getElementById("breadcrumb");
const searchInput = document.getElementById("search");
const widthToggleEl = document.getElementById("width-toggle");
const compareToggleEl = document.getElementById("compare-toggle");
const tocToggleEl = document.getElementById("toc-toggle");
const themeToggleEl = document.getElementById("theme-toggle");
const tocListEl = document.getElementById("toc-list");
const treeExpandAllEl = document.getElementById("tree-expand-all");
const treeCollapseAllEl = document.getElementById("tree-collapse-all");
const leftPanelReopenEl = document.getElementById("left-panel-reopen");
const rightPanelReopenEl = document.getElementById("right-panel-reopen");

const paneElements = {
  primary: document.getElementById("pane-primary"),
  secondary: document.getElementById("pane-secondary")
};

const paneContentElements = {
  primary: document.getElementById("content-primary"),
  secondary: document.getElementById("content-secondary")
};

let activeDrag = null;

void bootstrap();

async function bootstrap() {
  loadPanelPrefs();
  setupPanelManager();

  setupPaneActivation();
  setupSearch();
  setupTreeControls();
  setupWidthModeToggle();
  setupThemeToggle();
  setupCompareToggle();
  setupTocToggle();

  await loadTree();
  connectSocket();
}

function loadPanelPrefs() {
  state.panelPrefs.leftWidth = clamp(
    parseInt(readStorage(storageKeys.leftPanelWidth, String(constants.defaultLeftWidth)), 10) || constants.defaultLeftWidth,
    constants.minLeftWidth,
    constants.maxLeftWidth
  );

  state.panelPrefs.rightWidth = clamp(
    parseInt(readStorage(storageKeys.rightPanelWidth, String(constants.defaultRightWidth)), 10) || constants.defaultRightWidth,
    constants.minRightWidth,
    constants.maxRightWidth
  );

  state.panelPrefs.leftCollapsed = readStorage(storageKeys.leftPanelCollapsed, "false") === "true";
  state.panelPrefs.rightCollapsed = readStorage(storageKeys.rightPanelCollapsed, "true") === "true";
}

function setupPanelManager() {
  applyPanelStateFromPrefs();

  leftPanelToggleEl.addEventListener("click", function () {
    togglePanelCollapsed("left");
  });

  rightPanelToggleEl.addEventListener("click", function () {
    togglePanelCollapsed("right");
  });

  leftPanelReopenEl.addEventListener("click", function () {
    if (state.panelPrefs.leftCollapsed) {
      state.panelPrefs.leftCollapsed = false;
      writeStorage(storageKeys.leftPanelCollapsed, "false");
      applyPanelStateFromPrefs();
    }
  });

  rightPanelReopenEl.addEventListener("click", function () {
    if (state.panelPrefs.rightCollapsed) {
      state.panelPrefs.rightCollapsed = false;
      writeStorage(storageKeys.rightPanelCollapsed, "false");
      applyPanelStateFromPrefs();
      rebuildTocForActivePane();
    }
  });

  leftResizerEl.addEventListener("pointerdown", function (event) {
    startPanelResize(event, "left");
  });
  rightResizerEl.addEventListener("pointerdown", function (event) {
    startPanelResize(event, "right");
  });

  leftResizerEl.addEventListener("dblclick", function () {
    resetPanelWidth("left");
  });
  rightResizerEl.addEventListener("dblclick", function () {
    resetPanelWidth("right");
  });

  leftResizerEl.addEventListener("keydown", function (event) {
    handleResizerKeydown(event, "left");
  });
  rightResizerEl.addEventListener("keydown", function (event) {
    handleResizerKeydown(event, "right");
  });

  window.addEventListener("pointermove", onGlobalPointerMove);
  window.addEventListener("pointerup", stopPanelResize);
  window.addEventListener("pointercancel", stopPanelResize);

  window.addEventListener("resize", applyResponsiveCollapse);
  applyResponsiveCollapse();
}

function applyPanelStateFromPrefs() {
  document.documentElement.style.setProperty("--left-panel-width", state.panelPrefs.leftWidth + "px");
  document.documentElement.style.setProperty("--right-panel-width", state.panelPrefs.rightWidth + "px");

  document.body.classList.toggle("left-panel-collapsed", state.panelPrefs.leftCollapsed);
  document.body.classList.toggle("right-panel-collapsed", state.panelPrefs.rightCollapsed);

  leftPanelToggleEl.textContent = state.panelPrefs.leftCollapsed ? "▶" : "◀";
  leftPanelToggleEl.setAttribute("aria-pressed", String(!state.panelPrefs.leftCollapsed));
  leftPanelReopenEl.setAttribute("aria-hidden", String(!state.panelPrefs.leftCollapsed));

  rightPanelToggleEl.textContent = state.panelPrefs.rightCollapsed ? "◀" : "▶";
  rightPanelToggleEl.setAttribute("aria-pressed", String(!state.panelPrefs.rightCollapsed));
  rightPanelReopenEl.setAttribute("aria-hidden", String(!state.panelPrefs.rightCollapsed));

  tocToggleEl.classList.toggle("is-active", !state.panelPrefs.rightCollapsed);
  tocToggleEl.setAttribute("aria-pressed", String(!state.panelPrefs.rightCollapsed));
}

function togglePanelCollapsed(panel) {
  if (panel === "left") {
    state.panelPrefs.leftCollapsed = !state.panelPrefs.leftCollapsed;
    writeStorage(storageKeys.leftPanelCollapsed, String(state.panelPrefs.leftCollapsed));
  } else {
    state.panelPrefs.rightCollapsed = !state.panelPrefs.rightCollapsed;
    writeStorage(storageKeys.rightPanelCollapsed, String(state.panelPrefs.rightCollapsed));
  }

  applyPanelStateFromPrefs();
}

function startPanelResize(event, panel) {
  if (state.responsiveForcedCollapse) {
    return;
  }

  event.preventDefault();

  if (panel === "left" && state.panelPrefs.leftCollapsed) {
    state.panelPrefs.leftCollapsed = false;
    writeStorage(storageKeys.leftPanelCollapsed, "false");
    applyPanelStateFromPrefs();
  }

  if (panel === "right" && state.panelPrefs.rightCollapsed) {
    state.panelPrefs.rightCollapsed = false;
    writeStorage(storageKeys.rightPanelCollapsed, "false");
    applyPanelStateFromPrefs();
  }

  activeDrag = {
    panel,
    pointerId: event.pointerId
  };

  if (panel === "left") {
    leftResizerEl.classList.add("is-dragging");
  } else {
    rightResizerEl.classList.add("is-dragging");
  }

  if (typeof event.target.setPointerCapture === "function") {
    event.target.setPointerCapture(event.pointerId);
  }
}

function onGlobalPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  if (activeDrag.panel === "left") {
    var left = clamp(Math.round(event.clientX), constants.minLeftWidth, constants.maxLeftWidth);
    state.panelPrefs.leftWidth = left;
    document.documentElement.style.setProperty("--left-panel-width", left + "px");
    return;
  }

  var viewportWidth = window.innerWidth;
  var right = clamp(Math.round(viewportWidth - event.clientX), constants.minRightWidth, constants.maxRightWidth);
  state.panelPrefs.rightWidth = right;
  document.documentElement.style.setProperty("--right-panel-width", right + "px");
}

function stopPanelResize(event) {
  if (!activeDrag || (event.pointerId && event.pointerId !== activeDrag.pointerId)) {
    return;
  }

  if (activeDrag.panel === "left") {
    writeStorage(storageKeys.leftPanelWidth, String(state.panelPrefs.leftWidth));
  } else {
    writeStorage(storageKeys.rightPanelWidth, String(state.panelPrefs.rightWidth));
  }

  leftResizerEl.classList.remove("is-dragging");
  rightResizerEl.classList.remove("is-dragging");
  activeDrag = null;
}

function resetPanelWidth(panel) {
  if (panel === "left") {
    state.panelPrefs.leftWidth = constants.defaultLeftWidth;
    document.documentElement.style.setProperty("--left-panel-width", state.panelPrefs.leftWidth + "px");
    writeStorage(storageKeys.leftPanelWidth, String(state.panelPrefs.leftWidth));
    return;
  }

  state.panelPrefs.rightWidth = constants.defaultRightWidth;
  document.documentElement.style.setProperty("--right-panel-width", state.panelPrefs.rightWidth + "px");
  writeStorage(storageKeys.rightPanelWidth, String(state.panelPrefs.rightWidth));
}

function handleResizerKeydown(event, panel) {
  var key = event.key;
  if (key !== "ArrowLeft" && key !== "ArrowRight") {
    return;
  }

  event.preventDefault();
  var delta = event.shiftKey ? 24 : 12;

  if (panel === "left") {
    if (state.panelPrefs.leftCollapsed) {
      state.panelPrefs.leftCollapsed = false;
      writeStorage(storageKeys.leftPanelCollapsed, "false");
    }

    if (key === "ArrowLeft") {
      state.panelPrefs.leftWidth = clamp(state.panelPrefs.leftWidth - delta, constants.minLeftWidth, constants.maxLeftWidth);
    } else {
      state.panelPrefs.leftWidth = clamp(state.panelPrefs.leftWidth + delta, constants.minLeftWidth, constants.maxLeftWidth);
    }

    document.documentElement.style.setProperty("--left-panel-width", state.panelPrefs.leftWidth + "px");
    writeStorage(storageKeys.leftPanelWidth, String(state.panelPrefs.leftWidth));
    applyPanelStateFromPrefs();
    return;
  }

  if (state.panelPrefs.rightCollapsed) {
    state.panelPrefs.rightCollapsed = false;
    writeStorage(storageKeys.rightPanelCollapsed, "false");
  }

  if (key === "ArrowLeft") {
    state.panelPrefs.rightWidth = clamp(state.panelPrefs.rightWidth + delta, constants.minRightWidth, constants.maxRightWidth);
  } else {
    state.panelPrefs.rightWidth = clamp(state.panelPrefs.rightWidth - delta, constants.minRightWidth, constants.maxRightWidth);
  }

  document.documentElement.style.setProperty("--right-panel-width", state.panelPrefs.rightWidth + "px");
  writeStorage(storageKeys.rightPanelWidth, String(state.panelPrefs.rightWidth));
  applyPanelStateFromPrefs();
}

function applyResponsiveCollapse() {
  var isNarrow = window.innerWidth <= constants.narrowBreakpoint;

  if (isNarrow && !state.responsiveForcedCollapse) {
    state.responsiveForcedCollapse = true;
    document.body.classList.add("left-panel-collapsed");
    document.body.classList.add("right-panel-collapsed");
    return;
  }

  if (!isNarrow && state.responsiveForcedCollapse) {
    state.responsiveForcedCollapse = false;
    applyPanelStateFromPrefs();
  }
}

function setupPaneActivation() {
  paneElements.primary.addEventListener("click", function () {
    setActivePane("primary");
  });

  paneElements.secondary.addEventListener("click", function () {
    setActivePane("secondary");
  });

  setActivePane("primary");
}

function setActivePane(pane) {
  state.activePane = pane;
  paneElements.primary.classList.toggle("is-active", pane === "primary");
  paneElements.secondary.classList.toggle("is-active", pane === "secondary");
  updateBreadcrumb();
  rebuildTocForActivePane();
}

function setupSearch() {
  searchInput.addEventListener("input", function () {
    state.searchQuery = searchInput.value.trim();
    renderTree();
  });

  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      searchInput.value = "";
      state.searchQuery = "";
      renderTree();
      searchInput.blur();
    }
  });
}

function setupTreeControls() {
  if (treeExpandAllEl) {
    treeExpandAllEl.addEventListener("click", function () {
      state.collapsedFolders.clear();
      renderTree();
    });
  }

  if (treeCollapseAllEl) {
    treeCollapseAllEl.addEventListener("click", function () {
      var allFolderPaths = getAllFolderPaths();
      state.collapsedFolders = new Set(allFolderPaths);
      renderTree();
    });
  }
}

function setupWidthModeToggle() {
  var initialMode = readStorage(storageKeys.widthMode, constants.widthModeFull);
  applyWidthMode(initialMode === constants.widthModeReading ? constants.widthModeReading : constants.widthModeFull);

  widthToggleEl.addEventListener("click", function () {
    var isReading = document.body.classList.contains("reading-width");
    applyWidthMode(isReading ? constants.widthModeFull : constants.widthModeReading);
  });
}

function applyWidthMode(mode) {
  var isReading = mode === constants.widthModeReading;
  document.body.classList.toggle("reading-width", isReading);
  widthToggleEl.classList.toggle("is-reading", isReading);
  widthToggleEl.textContent = isReading ? "Full Width" : "Reading Width";
  widthToggleEl.setAttribute("aria-pressed", String(isReading));
  writeStorage(storageKeys.widthMode, isReading ? constants.widthModeReading : constants.widthModeFull);
}

function setupThemeToggle() {
  var initialTheme = readStorage(storageKeys.themeMode, constants.themeLight);
  applyTheme(initialTheme === constants.themeDark ? constants.themeDark : constants.themeLight);

  themeToggleEl.addEventListener("click", function () {
    var isDark = document.body.classList.contains("theme-dark");
    applyTheme(isDark ? constants.themeLight : constants.themeDark);
  });
}

function applyTheme(theme) {
  var isDark = theme === constants.themeDark;
  document.body.classList.toggle("theme-dark", isDark);
  themeToggleEl.classList.toggle("is-active", isDark);
  themeToggleEl.textContent = isDark ? "Light" : "Dark";
  themeToggleEl.setAttribute("aria-pressed", String(isDark));

  if (window.mermaid) {
    window.__markdownMirrorMermaidInitialized = false;
  }

  writeStorage(storageKeys.themeMode, isDark ? constants.themeDark : constants.themeLight);
}

function setupCompareToggle() {
  var initialCompare = readStorage(storageKeys.compareMode, "false") === "true";
  applyCompareMode(initialCompare);

  compareToggleEl.addEventListener("click", function () {
    applyCompareMode(!state.compareMode);
  });
}

function applyCompareMode(enabled) {
  state.compareMode = enabled;
  document.body.classList.toggle("compare-mode", enabled);
  compareToggleEl.classList.toggle("is-active", enabled);
  compareToggleEl.textContent = enabled ? "Single" : "Compare";
  compareToggleEl.setAttribute("aria-pressed", String(enabled));

  if (!enabled) {
    setActivePane("primary");
    paneContentElements.secondary.innerHTML = '<p class="placeholder-note">Enable compare mode and open a second document from the file tree.</p>';
    state.selectedUriByPane.secondary = null;
    state.selectedPathByPane.secondary = null;
    refreshSelection();
  }

  updateBreadcrumb();
  rebuildTocForActivePane();
  writeStorage(storageKeys.compareMode, enabled ? "true" : "false");
}

function setupTocToggle() {
  tocToggleEl.addEventListener("click", function () {
    if (state.panelPrefs.rightCollapsed) {
      state.panelPrefs.rightCollapsed = false;
      writeStorage(storageKeys.rightPanelCollapsed, "false");
    } else {
      state.panelPrefs.rightCollapsed = true;
      writeStorage(storageKeys.rightPanelCollapsed, "true");
    }

    applyPanelStateFromPrefs();
    rebuildTocForActivePane();
  });
}

async function loadTree() {
  var scrollTop = treeEl.scrollTop;
  var response = await fetch("/api/tree");

  if (!response.ok) {
    treeEl.innerHTML = '<div class="tree-empty">Unable to load files</div>';
    return;
  }

  var payload = await response.json();
  state.treeRoots = Array.isArray(payload.roots) ? payload.roots : [];
  renderTree();
  treeEl.scrollTop = scrollTop;

  if (!state.selectedUriByPane.primary) {
    var first = findFirstFile(state.treeRoots);
    if (first && first.uri) {
      await openDocument(first.uri, first.relativePath, "primary");
      if (state.compareMode) {
        paneContentElements.secondary.innerHTML = '<p class="placeholder-note">Select another file to compare side by side.</p>';
      }
    }
  }
}

function renderTree() {
  treeEl.innerHTML = "";
  var query = state.searchQuery.toLowerCase();

  if (state.treeRoots.length === 0) {
    treeEl.innerHTML = '<div class="tree-empty">No markdown files found</div>';
    return;
  }

  for (var i = 0; i < state.treeRoots.length; i++) {
    var root = state.treeRoots[i];
    var label = document.createElement("div");
    label.className = "tree-root-label";
    label.textContent = root.name;
    treeEl.appendChild(label);

    var container = document.createElement("div");
    treeEl.appendChild(container);
    appendNodes(container, root.children || [], root.name, query);
  }
}

function appendNodes(container, nodes, parentPath, query) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];

    if (node.kind === "folder") {
      var folderPath = parentPath + "/" + node.name;
      if (query && !folderHasMatch(node, query)) {
        continue;
      }

      var folderEl = document.createElement("div");
      folderEl.className = "tree-folder";
      if (state.collapsedFolders.has(folderPath)) {
        folderEl.classList.add("collapsed");
      }

      var header = document.createElement("div");
      header.className = "tree-folder-header";
      var toggle = document.createElement("button");
      toggle.className = "tree-folder-toggle";
      toggle.type = "button";
      toggle.innerHTML =
        '<svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '<span class="tree-folder-name">' + escapeHtml(node.name) + "</span>";
      toggle.addEventListener("click", createFolderToggleHandler(folderPath, folderEl));

      var actions = document.createElement("div");
      actions.className = "tree-folder-actions";

      var expandBtn = document.createElement("button");
      expandBtn.className = "tree-folder-action";
      expandBtn.type = "button";
      expandBtn.innerHTML =
        '<svg class="tree-folder-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="7 8 12 13 17 8"/>' +
        '<polyline points="7 13 12 18 17 13"/>' +
        "</svg>";
      expandBtn.title = "Expand this folder level";
      expandBtn.setAttribute("aria-label", "Expand this folder level");
      expandBtn.addEventListener("click", createFolderExpandCollapseHandler(folderPath, false));

      var collapseBtn = document.createElement("button");
      collapseBtn.className = "tree-folder-action";
      collapseBtn.type = "button";
      collapseBtn.innerHTML =
        '<svg class="tree-folder-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<polyline points="7 16 12 11 17 16"/>' +
        '<polyline points="7 11 12 6 17 11"/>' +
        "</svg>";
      collapseBtn.title = "Collapse this folder level";
      collapseBtn.setAttribute("aria-label", "Collapse this folder level");
      collapseBtn.addEventListener("click", createFolderExpandCollapseHandler(folderPath, true));

      actions.appendChild(expandBtn);
      actions.appendChild(collapseBtn);
      header.appendChild(toggle);
      header.appendChild(actions);

      var childrenEl = document.createElement("div");
      childrenEl.className = "tree-folder-children";
      appendNodes(childrenEl, node.children || [], folderPath, query);

      folderEl.appendChild(header);
      folderEl.appendChild(childrenEl);
      container.appendChild(folderEl);
      continue;
    }

    if (query && !node.name.toLowerCase().includes(query)) {
      continue;
    }

    var button = document.createElement("button");
    button.className = "tree-file";
    button.type = "button";
    button.innerHTML =
      '<svg class="tree-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      "<span>" + escapeHtml(node.name) + "</span>";
    button.dataset.uri = node.uri;
    button.addEventListener("click", createOpenHandler(node.uri, node.relativePath));

    container.appendChild(button);
  }

  refreshSelection();
}

function createFolderToggleHandler(folderPath, folderEl) {
  return function () {
    if (state.collapsedFolders.has(folderPath)) {
      state.collapsedFolders.delete(folderPath);
    } else {
      state.collapsedFolders.add(folderPath);
    }
    folderEl.classList.toggle("collapsed");
  };
}

function createFolderExpandCollapseHandler(folderPath, collapse) {
  return function (event) {
    event.preventDefault();
    event.stopPropagation();
    setFolderAndDescendantsCollapsed(folderPath, collapse);
    renderTree();
  };
}

function setFolderAndDescendantsCollapsed(folderPath, collapse) {
  var allFolderPaths = getAllFolderPaths();
  var prefix = folderPath + "/";

  for (var i = 0; i < allFolderPaths.length; i++) {
    var path = allFolderPaths[i];
    if (path === folderPath || path.indexOf(prefix) === 0) {
      if (collapse) {
        state.collapsedFolders.add(path);
      } else {
        state.collapsedFolders.delete(path);
      }
    }
  }
}

function getAllFolderPaths() {
  var paths = [];
  for (var i = 0; i < state.treeRoots.length; i++) {
    var root = state.treeRoots[i];
    collectFolderPaths(root.children || [], root.name, paths);
  }
  return paths;
}

function collectFolderPaths(nodes, parentPath, output) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind !== "folder") {
      continue;
    }

    var folderPath = parentPath + "/" + node.name;
    output.push(folderPath);
    collectFolderPaths(node.children || [], folderPath, output);
  }
}

function createOpenHandler(uri, relativePath) {
  return function () {
    var targetPane = state.compareMode ? state.activePane : "primary";
    void openDocument(uri, relativePath, targetPane);
  };
}

function folderHasMatch(folder, query) {
  var children = folder.children || [];
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.kind === "file" && child.name.toLowerCase().includes(query)) {
      return true;
    }
    if (child.kind === "folder" && folderHasMatch(child, query)) {
      return true;
    }
  }
  return false;
}

async function openDocument(uri, relativePath, pane) {
  if (!uri) {
    return;
  }

  var targetPane = pane || "primary";
  var response = await fetch("/api/document?uri=" + encodeURIComponent(uri));
  if (!response.ok) {
    paneContentElements[targetPane].innerHTML = '<p class="placeholder-note">Unable to load document.</p>';
    return;
  }

  var payload = await response.json();
  state.selectedUriByPane[targetPane] = payload.uri;
  state.selectedPathByPane[targetPane] = relativePath || payload.relativePath || "Untitled";

  paneContentElements[targetPane].innerHTML = payload.html || "";
  paneContentElements[targetPane].scrollTop = 0;

  await postRenderEnhancements(paneContentElements[targetPane], targetPane);
  refreshSelection();
  updateBreadcrumb();

  if (targetPane === state.activePane) {
    rebuildTocForActivePane();
  }
}

function refreshSelection() {
  var primaryUri = state.selectedUriByPane.primary;
  var secondaryUri = state.selectedUriByPane.secondary;
  var items = treeEl.querySelectorAll(".tree-file");

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var uri = item.dataset.uri;
    if (uri && (uri === primaryUri || uri === secondaryUri)) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  }
}

function updateBreadcrumb() {
  var primaryPath = state.selectedPathByPane.primary;
  var secondaryPath = state.selectedPathByPane.secondary;

  if (state.compareMode) {
    var left = primaryPath ? escapeHtml(primaryPath) : "No file";
    var right = secondaryPath ? escapeHtml(secondaryPath) : "No file";
    var activeLabel = state.activePane === "primary" ? "Primary" : "Secondary";
    breadcrumbEl.innerHTML =
      '<span class="breadcrumb-segment">' + activeLabel + '</span>' +
      '<span class="breadcrumb-separator">:</span>' +
      '<span class="breadcrumb-current">' + (state.activePane === "primary" ? left : right) + '</span>' +
      '<span class="breadcrumb-separator">|</span>' +
      '<span class="breadcrumb-segment">Primary</span>' +
      '<span class="breadcrumb-separator">:</span>' +
      '<span class="breadcrumb-segment">' + left + '</span>' +
      '<span class="breadcrumb-separator">|</span>' +
      '<span class="breadcrumb-segment">Secondary</span>' +
      '<span class="breadcrumb-separator">:</span>' +
      '<span class="breadcrumb-segment">' + right + '</span>';
    return;
  }

  if (!primaryPath) {
    breadcrumbEl.innerHTML = '<span class="breadcrumb-text">Select a file to preview</span>';
    return;
  }

  var parts = primaryPath.split("/");
  var html = "";
  for (var i = 0; i < parts.length; i++) {
    if (i > 0) {
      html += '<span class="breadcrumb-separator">/</span>';
    }
    if (i === parts.length - 1) {
      html += '<span class="breadcrumb-current">' + escapeHtml(parts[i]) + "</span>";
    } else {
      html += '<span class="breadcrumb-segment">' + escapeHtml(parts[i]) + "</span>";
    }
  }
  breadcrumbEl.innerHTML = html;
}

function rebuildTocForActivePane() {
  if (state.panelPrefs.rightCollapsed) {
    return;
  }

  var contentEl = paneContentElements[state.activePane];
  var headings = contentEl.querySelectorAll("h1, h2, h3");
  tocListEl.innerHTML = "";

  if (headings.length === 0) {
    tocListEl.innerHTML = '<div class="toc-empty">No headings in this document.</div>';
    return;
  }

  var usedIds = new Set();
  for (var i = 0; i < headings.length; i++) {
    var heading = headings[i];
    var text = heading.textContent ? heading.textContent.trim() : "Section";
    var level = parseInt(heading.tagName.slice(1), 10);

    var id = heading.id || slugify(text);
    if (!id) {
      id = "section-" + (i + 1);
    }

    var uniqueId = id;
    var suffix = 1;
    while (usedIds.has(uniqueId)) {
      suffix += 1;
      uniqueId = id + "-" + suffix;
    }

    usedIds.add(uniqueId);
    heading.id = uniqueId;

    var button = document.createElement("button");
    button.type = "button";
    button.className = "toc-item depth-" + Math.min(level, 3);
    button.textContent = text;
    button.addEventListener("click", createTocJumpHandler(contentEl, uniqueId));
    tocListEl.appendChild(button);
  }
}

function createTocJumpHandler(contentEl, headingId) {
  return function () {
    var target = contentEl.querySelector("#" + cssEscape(headingId));
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function connectSocket() {
  var protocol = location.protocol === "https:" ? "wss" : "ws";
  var socket = new WebSocket(protocol + "://" + location.host + "/ws");
  var treeRefreshTimer = null;

  socket.addEventListener("open", function () {
    statusEl.classList.add("online");
    statusEl.querySelector(".status-text").textContent = "Connected";
  });

  socket.addEventListener("close", function () {
    statusEl.classList.remove("online");
    statusEl.querySelector(".status-text").textContent = "Disconnected";
    setTimeout(connectSocket, 1000);
  });

  socket.addEventListener("message", function (event) {
    var message;
    try {
      message = JSON.parse(event.data);
    } catch (_) {
      return;
    }

    if (message.type === "document-deleted" || (message.type === "document-updated" && message.reason === "created")) {
      if (treeRefreshTimer) {
        clearTimeout(treeRefreshTimer);
      }
      treeRefreshTimer = setTimeout(function () {
        treeRefreshTimer = null;
        void loadTree();
      }, 300);
    }

    if (message.type === "document-deleted") {
      clearPaneIfDeleted("primary", message.uri);
      clearPaneIfDeleted("secondary", message.uri);
    }

    if (message.type === "document-updated" && typeof message.html === "string") {
      void updatePaneIfMatching("primary", message.uri, message.html);
      void updatePaneIfMatching("secondary", message.uri, message.html);
    }
  });
}

function clearPaneIfDeleted(pane, uri) {
  if (state.selectedUriByPane[pane] !== uri) {
    return;
  }

  state.selectedUriByPane[pane] = null;
  state.selectedPathByPane[pane] = null;
  paneContentElements[pane].innerHTML = '<p class="placeholder-note">This file was deleted. Select another file.</p>';
  updateBreadcrumb();
  refreshSelection();
  rebuildTocForActivePane();
}

async function updatePaneIfMatching(pane, uri, html) {
  if (state.selectedUriByPane[pane] !== uri) {
    return;
  }

  paneContentElements[pane].innerHTML = html;
  await postRenderEnhancements(paneContentElements[pane], pane);

  if (pane === state.activePane) {
    rebuildTocForActivePane();
  }
}

async function postRenderEnhancements(container, pane) {
  await renderMermaidDiagrams(container);
  attachMermaidDownloadButtons(container, pane);
  attachCodeCopyButtons(container);
}

async function renderMermaidDiagrams(container) {
  if (!window.mermaid || !container) {
    return;
  }

  if (!window.__markdownMirrorMermaidInitialized) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: document.body.classList.contains("theme-dark") ? "dark" : "default"
    });
    window.__markdownMirrorMermaidInitialized = true;
  }

  try {
    await window.mermaid.run({ querySelector: "#" + container.id + " .mermaid" });
  } catch (_) {
    // Keep rendering resilient when diagram syntax is invalid.
  }
}

function attachMermaidDownloadButtons(container, pane) {
  var blocks = container.querySelectorAll(".mermaid");
  var index = 1;

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var svg = block.querySelector("svg");
    if (!svg) {
      continue;
    }

    var existing = block.nextElementSibling;
    if (existing && existing.classList.contains("mermaid-actions")) {
      existing.remove();
    }

    var actions = document.createElement("div");
    actions.className = "mermaid-actions";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "mermaid-download";
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>' +
      "</svg>Download PNG";

    var fileName = pane + "-diagram-" + index + ".png";
    button.addEventListener("click", createDiagramDownloadHandler(svg, fileName));

    actions.appendChild(button);
    block.parentNode.insertBefore(actions, block.nextSibling);
    index += 1;
  }
}

function createDiagramDownloadHandler(svg, fileName) {
  return function () {
    void downloadMermaidPng(svg, fileName);
  };
}

async function downloadMermaidPng(svgNode, fileName) {
  try {
    var clone = svgNode.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    var rect = svgNode.getBoundingClientRect();
    var width = Math.ceil(rect.width) || parseInt(svgNode.getAttribute("width"), 10) || 800;
    var height = Math.ceil(rect.height) || parseInt(svgNode.getAttribute("height"), 10) || 600;

    clone.setAttribute("width", width);
    clone.setAttribute("height", height);
    inlineSvgStyles(svgNode, clone);

    var svgData = new XMLSerializer().serializeToString(clone);
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var imgUrl = URL.createObjectURL(svgBlob);

    var img = new Image();
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgUrl;
    });

    var scale = 2;
    var canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    var ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(imgUrl);

    canvas.toBlob(function (blob) {
      if (!blob) {
        return;
      }

      var objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, fileName);
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 100);
    }, "image/png");
  } catch (_) {
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString(svgNode);
    var fallbackBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    var fallbackUrl = URL.createObjectURL(fallbackBlob);
    triggerDownload(fallbackUrl, fileName.replace(".png", ".svg"));
    setTimeout(function () {
      URL.revokeObjectURL(fallbackUrl);
    }, 100);
  }
}

function inlineSvgStyles(sourceNode, cloneNode) {
  var sourceChildren = sourceNode.querySelectorAll("*");
  var cloneChildren = cloneNode.querySelectorAll("*");
  var props = [
    "fill",
    "stroke",
    "stroke-width",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
    "dominant-baseline",
    "opacity",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin"
  ];

  for (var i = 0; i < sourceChildren.length && i < cloneChildren.length; i++) {
    var computed = window.getComputedStyle(sourceChildren[i]);
    for (var j = 0; j < props.length; j++) {
      var value = computed.getPropertyValue(props[j]);
      if (value) {
        cloneChildren[i].style.setProperty(props[j], value);
      }
    }
  }
}

function attachCodeCopyButtons(container) {
  var preBlocks = container.querySelectorAll("pre");
  for (var i = 0; i < preBlocks.length; i++) {
    var pre = preBlocks[i];
    if (pre.querySelector(".code-copy-btn")) {
      continue;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-btn";
    button.textContent = "Copy";
    button.addEventListener("click", createCodeCopyHandler(pre, button));

    pre.style.position = "relative";
    pre.appendChild(button);
  }
}

function createCodeCopyHandler(pre, button) {
  return function () {
    var code = pre.querySelector("code");
    if (!code) {
      return;
    }

    navigator.clipboard.writeText(code.textContent || "").then(function () {
      button.textContent = "Copied!";
      button.classList.add("copied");
      setTimeout(function () {
        button.textContent = "Copy";
        button.classList.remove("copied");
      }, 2000);
    });
  };
}

function triggerDownload(url, fileName) {
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function findFirstFile(roots) {
  for (var i = 0; i < roots.length; i++) {
    var found = findFirstInNodes(roots[i].children || []);
    if (found) {
      return found;
    }
  }
  return null;
}

function findFirstInNodes(nodes) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].kind === "file" && nodes[i].uri) {
      return nodes[i];
    }
    if (nodes[i].kind === "folder") {
      var found = findFirstInNodes(nodes[i].children || []);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function readStorage(key, fallback) {
  try {
    var value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (_) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage issues to keep runtime behavior stable.
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

window.__markdownMirrorMermaidInitialized = false;
