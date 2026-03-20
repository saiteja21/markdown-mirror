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
  runtimeSettings: {
    enableMath: false,
    mermaidTheme: "default",
    customCssPath: "",
    offlineMode: true,
    defaultCompareMode: true,
    defaultTocVisible: true,
    defaultTheme: "light",
    defaultWidthMode: "full",
    enablePrint: true,
    enableHtmlExport: true,
    enableWordExport: true,
    enableSlides: true,
    enableCompare: true,
    enableToc: true,
    enableThemeToggle: true,
    enableWidthToggle: true
  },
  panelPrefs: {
    leftWidth: 280,
    rightWidth: 300,
    leftCollapsed: false,
    rightCollapsed: true
  },
  responsiveForcedCollapse: false,
  treeKeyboardIndex: -1,
  shortcutsModalOpen: false,
  pinnedUris: new Set(),
  openTabs: [],
  slideMode: {
    active: false,
    slides: [],
    index: 0,
    renderToken: 0
  },
  wordExport: {
    open: false,
    selectedUris: new Set()
  },
  sync: {
    suppressEditorSyncUntil: 0
  },
  perf: {
    bootStartedAt: performance.now()
  }
};

const storageKeys = {
  widthMode: "markdownMirror.widthMode",
  themeMode: "markdownMirror.themeMode",
  compareMode: "markdownMirror.compareMode",
  leftPanelWidth: "markdownMirror.leftPanelWidth",
  rightPanelWidth: "markdownMirror.rightPanelWidth",
  leftPanelCollapsed: "markdownMirror.leftPanelCollapsed",
  rightPanelCollapsed: "markdownMirror.rightPanelCollapsed",
  pinnedUris: "markdownMirror.pinnedUris"
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

const treeEl = document.getElementById("tree");
const statusEl = document.getElementById("status");
const breadcrumbEl = document.getElementById("breadcrumb");
const searchInput = document.getElementById("search");
const widthToggleEl = document.getElementById("width-toggle");
const compareToggleEl = document.getElementById("compare-toggle");
const tocToggleEl = document.getElementById("toc-toggle");
const themeToggleEl = document.getElementById("theme-toggle");
const tocListEl = document.getElementById("toc-list");
const printToggleEl = document.getElementById("print-toggle");
const exportHtmlToggleEl = document.getElementById("export-html-toggle");
const exportWordToggleEl = document.getElementById("export-word-toggle");
const slidesToggleEl = document.getElementById("slides-toggle");
const shortcutsToggleEl = document.getElementById("shortcuts-toggle");
const shortcutsModalEl = document.getElementById("shortcuts-modal");
const shortcutsCloseEl = document.getElementById("shortcuts-close");
const statsEl = document.getElementById("document-stats");
const tabsBarEl = document.getElementById("tabs-bar");
const treeExpandAllEl = document.getElementById("tree-expand-all");
const treeCollapseAllEl = document.getElementById("tree-collapse-all");
const leftPanelReopenEl = document.getElementById("left-panel-reopen");
const favoritesTreeEl = document.getElementById("favorites-tree");
const fileCountEl = document.getElementById("file-count");
const backToTopEl = document.getElementById("back-to-top");
const lightboxEl = document.getElementById("lightbox");
const lightboxImageEl = document.getElementById("lightbox-image");
const lightboxCloseEl = document.getElementById("lightbox-close");
const slidesOverlayEl = document.getElementById("slides-overlay");
const slidesStageEl = document.getElementById("slides-stage");
const slidesCounterEl = document.getElementById("slides-counter");
const slidesPrevEl = document.getElementById("slides-prev");
const slidesNextEl = document.getElementById("slides-next");
const slidesCloseEl = document.getElementById("slides-close");
const wordExportModalEl = document.getElementById("word-export-modal");
const wordExportCloseEl = document.getElementById("word-export-close");
const wordExportCancelEl = document.getElementById("word-export-cancel");
const wordExportConfirmEl = document.getElementById("word-export-confirm");
const wordExportListEl = document.getElementById("word-export-list");
const wordExportSelectCurrentEl = document.getElementById("word-export-select-current");
const wordExportSelectTabsEl = document.getElementById("word-export-select-tabs");
const wordExportSelectAllEl = document.getElementById("word-export-select-all");
const wordExportClearEl = document.getElementById("word-export-clear");

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

async function loadRuntimeSettings() {
  try {
    var response = await fetch("/api/settings");
    if (!response.ok) {
      return;
    }

    var payload = await response.json();
    state.runtimeSettings.enableMath = Boolean(payload && payload.enableMath);
    state.runtimeSettings.mermaidTheme = normalizeMermaidTheme(payload && payload.mermaidTheme);
    state.runtimeSettings.customCssPath = payload && typeof payload.customCssPath === "string" ? payload.customCssPath : "";
    state.runtimeSettings.offlineMode = true;
    state.runtimeSettings.defaultCompareMode = !(payload && payload.defaultCompareMode === false);
    state.runtimeSettings.defaultTocVisible = !(payload && payload.defaultTocVisible === false);
    state.runtimeSettings.defaultTheme = payload && payload.defaultTheme === "dark" ? constants.themeDark : constants.themeLight;
    state.runtimeSettings.defaultWidthMode = payload && payload.defaultWidthMode === constants.widthModeReading
      ? constants.widthModeReading
      : constants.widthModeFull;
    state.runtimeSettings.enablePrint = !(payload && payload.enablePrint === false);
    state.runtimeSettings.enableHtmlExport = !(payload && payload.enableHtmlExport === false);
    state.runtimeSettings.enableWordExport = !(payload && payload.enableWordExport === false);
    state.runtimeSettings.enableSlides = !(payload && payload.enableSlides === false);
    state.runtimeSettings.enableCompare = !(payload && payload.enableCompare === false);
    state.runtimeSettings.enableToc = !(payload && payload.enableToc === false);
    state.runtimeSettings.enableThemeToggle = !(payload && payload.enableThemeToggle === false);
    state.runtimeSettings.enableWidthToggle = !(payload && payload.enableWidthToggle === false);
  } catch (_) {
    // Keep defaults when settings API is unavailable.
  }
}

function normalizeMermaidTheme(value) {
  var theme = String(value || "default").toLowerCase();
  if (theme === "dark" || theme === "forest" || theme === "neutral") {
    return theme;
  }
  return "default";
}

async function bootstrap() {
  await loadRuntimeSettings();
  applyRuntimeFeatureToggles();
  loadPinnedUris();
  loadPanelPrefs();
  setupPanelManager();

  setupPaneActivation();
  setupSearch();
  setupTreeControls();
  setupPrintToggle();
  setupExportHtml();
  setupWordExport();
  setupSlidesMode();
  setupBackToTop();
  setupLightbox();
  setupScrollSync();
  setupKeyboardShortcuts();
  setupWidthModeToggle();
  setupThemeToggle();
  setupCompareToggle();
  setupTocToggle();

  await loadTree();
  applyCustomCss();
  connectSocket();

  requestAnimationFrame(function () {
    var elapsed = Math.round(performance.now() - state.perf.bootStartedAt);
    console.info("[Markdown Mirror] boot complete in " + String(elapsed) + "ms");
  });
}

function setControlVisibility(element, enabled) {
  if (!element) {
    return;
  }
  element.hidden = !enabled;
}

function applyRuntimeFeatureToggles() {
  setControlVisibility(printToggleEl, state.runtimeSettings.enablePrint);
  setControlVisibility(exportHtmlToggleEl, state.runtimeSettings.enableHtmlExport);
  setControlVisibility(exportWordToggleEl, state.runtimeSettings.enableWordExport);
  setControlVisibility(slidesToggleEl, state.runtimeSettings.enableSlides);
  setControlVisibility(compareToggleEl, state.runtimeSettings.enableCompare);
  setControlVisibility(tocToggleEl, state.runtimeSettings.enableToc);
  setControlVisibility(themeToggleEl, state.runtimeSettings.enableThemeToggle);
  setControlVisibility(widthToggleEl, state.runtimeSettings.enableWidthToggle);

  if (!state.runtimeSettings.enableCompare) {
    state.compareMode = false;
  }

  if (!state.runtimeSettings.enableToc) {
    state.panelPrefs.rightCollapsed = true;
  }
}

function loadPinnedUris() {
  var serialized = readStorage(storageKeys.pinnedUris, "[]");
  try {
    var parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      state.pinnedUris = new Set(parsed.filter(function (value) {
        return typeof value === "string" && value.length > 0;
      }));
    }
  } catch (_) {
    state.pinnedUris = new Set();
  }
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
  state.panelPrefs.rightCollapsed = readStorage(
    storageKeys.rightPanelCollapsed,
    state.runtimeSettings.defaultTocVisible ? "false" : "true"
  ) === "true";
}

function setupPanelManager() {
  applyPanelStateFromPrefs();

  leftPanelToggleEl.addEventListener("click", function () {
    togglePanelCollapsed("left");
  });

  leftPanelReopenEl.addEventListener("click", function () {
    if (state.panelPrefs.leftCollapsed) {
      state.panelPrefs.leftCollapsed = false;
      writeStorage(storageKeys.leftPanelCollapsed, "false");
      applyPanelStateFromPrefs();
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
  updateDocumentStats();
  handleActivePaneScrollUi({ target: paneContentElements[pane] });
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

function setupPrintToggle() {
  if (!printToggleEl || !state.runtimeSettings.enablePrint) {
    return;
  }

  printToggleEl.addEventListener("click", function () {
    window.print();
  });
}

function setupExportHtml() {
  if (!exportHtmlToggleEl || !state.runtimeSettings.enableHtmlExport) {
    return;
  }

  exportHtmlToggleEl.addEventListener("click", function () {
    void exportActivePaneAsStandaloneHtml();
  });
}

function setupWordExport() {
  if (!state.runtimeSettings.enableWordExport || !exportWordToggleEl || !wordExportModalEl || !wordExportListEl) {
    return;
  }

  exportWordToggleEl.addEventListener("click", function () {
    setWordExportModalOpen(true);
  });

  if (wordExportCloseEl) {
    wordExportCloseEl.addEventListener("click", function () {
      setWordExportModalOpen(false);
    });
  }

  if (wordExportCancelEl) {
    wordExportCancelEl.addEventListener("click", function () {
      setWordExportModalOpen(false);
    });
  }

  if (wordExportConfirmEl) {
    wordExportConfirmEl.addEventListener("click", function () {
      void exportSelectionToWord();
    });
  }

  if (wordExportSelectCurrentEl) {
    wordExportSelectCurrentEl.addEventListener("click", function () {
      var current = getCurrentDocumentUri();
      state.wordExport.selectedUris = new Set(current ? [current] : []);
      renderWordExportList();
    });
  }

  if (wordExportSelectTabsEl) {
    wordExportSelectTabsEl.addEventListener("click", function () {
      var uris = state.openTabs.map(function (tab) {
        return tab.uri;
      }).filter(function (value) {
        return typeof value === "string" && value.length > 0;
      });
      state.wordExport.selectedUris = new Set(uris);
      renderWordExportList();
    });
  }

  if (wordExportSelectAllEl) {
    wordExportSelectAllEl.addEventListener("click", function () {
      state.wordExport.selectedUris = new Set(getAllMarkdownDocs().map(function (doc) {
        return doc.uri;
      }));
      renderWordExportList();
    });
  }

  if (wordExportClearEl) {
    wordExportClearEl.addEventListener("click", function () {
      state.wordExport.selectedUris = new Set();
      renderWordExportList();
    });
  }

  wordExportModalEl.addEventListener("click", function (event) {
    if (event.target === wordExportModalEl) {
      setWordExportModalOpen(false);
    }
  });
}

function setWordExportModalOpen(open) {
  if (!wordExportModalEl || !exportWordToggleEl) {
    return;
  }

  state.wordExport.open = open;
  wordExportModalEl.hidden = !open;
  exportWordToggleEl.classList.toggle("is-active", open);
  exportWordToggleEl.setAttribute("aria-pressed", String(open));

  if (open) {
    primeWordSelection();
    renderWordExportList();
    if (wordExportConfirmEl) {
      wordExportConfirmEl.focus();
    }
  }
}

function primeWordSelection() {
  if (state.wordExport.selectedUris.size > 0) {
    return;
  }

  var current = getCurrentDocumentUri();
  if (current) {
    state.wordExport.selectedUris.add(current);
    return;
  }

  var docs = getAllMarkdownDocs();
  if (docs.length > 0) {
    state.wordExport.selectedUris.add(docs[0].uri);
  }
}

function renderWordExportList() {
  if (!wordExportListEl) {
    return;
  }

  var docs = getAllMarkdownDocs();
  wordExportListEl.innerHTML = "";

  if (docs.length === 0) {
    wordExportListEl.innerHTML = '<div class="word-export-empty">No markdown files available.</div>';
    if (wordExportConfirmEl) {
      wordExportConfirmEl.disabled = true;
    }
    return;
  }

  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    var label = document.createElement("label");
    label.className = "word-export-item";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = doc.uri;
    checkbox.checked = state.wordExport.selectedUris.has(doc.uri);
    checkbox.addEventListener("change", createWordDocSelectionHandler(doc.uri, checkbox));

    var text = document.createElement("span");
    text.className = "word-export-path";
    text.textContent = doc.relativePath || extractFileName(doc.uri);

    label.appendChild(checkbox);
    label.appendChild(text);
    wordExportListEl.appendChild(label);
  }

  if (wordExportConfirmEl) {
    wordExportConfirmEl.disabled = state.wordExport.selectedUris.size === 0;
  }
}

function createWordDocSelectionHandler(uri, checkbox) {
  return function () {
    if (!uri) {
      return;
    }

    if (checkbox.checked) {
      state.wordExport.selectedUris.add(uri);
    } else {
      state.wordExport.selectedUris.delete(uri);
    }

    if (wordExportConfirmEl) {
      wordExportConfirmEl.disabled = state.wordExport.selectedUris.size === 0;
    }
  };
}

function getCurrentDocumentUri() {
  if (state.compareMode) {
    return state.selectedUriByPane[state.activePane] || state.selectedUriByPane.primary || null;
  }
  return state.selectedUriByPane.primary || null;
}

function getAllMarkdownDocs() {
  var docs = [];
  for (var i = 0; i < state.treeRoots.length; i++) {
    collectDocsFromNodes(state.treeRoots[i].children || [], docs);
  }
  docs.sort(function (a, b) {
    return String(a.relativePath || "").localeCompare(String(b.relativePath || ""));
  });
  return docs;
}

function collectDocsFromNodes(nodes, output) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file" && node.uri) {
      output.push({ uri: node.uri, relativePath: node.relativePath || node.name || "" });
      continue;
    }
    if (node.kind === "folder") {
      collectDocsFromNodes(node.children || [], output);
    }
  }
}

function setupSlidesMode() {
  if (!state.runtimeSettings.enableSlides) {
    if (slidesOverlayEl) {
      slidesOverlayEl.hidden = true;
    }
    return;
  }

  if (slidesToggleEl) {
    slidesToggleEl.addEventListener("click", function () {
      toggleSlidesMode();
    });
  }

  if (slidesCloseEl) {
    slidesCloseEl.addEventListener("click", function () {
      setSlidesMode(false);
    });
  }

  if (slidesPrevEl) {
    slidesPrevEl.addEventListener("click", function () {
      setSlideIndex(state.slideMode.index - 1);
    });
  }

  if (slidesNextEl) {
    slidesNextEl.addEventListener("click", function () {
      setSlideIndex(state.slideMode.index + 1);
    });
  }

  window.addEventListener("resize", function () {
    if (state.slideMode.active) {
      refreshSlideOverflowState();
    }
  });
}

function setupBackToTop() {
  if (!backToTopEl) {
    return;
  }

  backToTopEl.addEventListener("click", function () {
    var content = paneContentElements[state.activePane];
    if (content) {
      content.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  paneContentElements.primary.addEventListener("scroll", handleActivePaneScrollUi);
  paneContentElements.secondary.addEventListener("scroll", handleActivePaneScrollUi);
}

function handleActivePaneScrollUi(event) {
  if (!backToTopEl) {
    return;
  }

  var content = paneContentElements[state.activePane];
  if (!content || event.target !== content) {
    return;
  }

  backToTopEl.classList.toggle("visible", content.scrollTop > 500);
}

function setupLightbox() {
  if (lightboxCloseEl) {
    lightboxCloseEl.addEventListener("click", function () {
      setLightboxOpen(false);
    });
  }

  if (lightboxEl) {
    lightboxEl.addEventListener("click", function (event) {
      if (event.target === lightboxEl) {
        setLightboxOpen(false);
      }
    });
  }
}

function setLightboxOpen(open, src) {
  if (!lightboxEl || !lightboxImageEl) {
    return;
  }

  lightboxEl.hidden = !open;
  if (open && src) {
    lightboxImageEl.src = src;
  }
  if (!open) {
    lightboxImageEl.removeAttribute("src");
  }
}

function setupScrollSync() {
  paneContentElements.primary.addEventListener("scroll", createScrollSyncHandler("primary"));
  paneContentElements.secondary.addEventListener("scroll", createScrollSyncHandler("secondary"));
}

function createScrollSyncHandler(pane) {
  var lastSent = 0;
  return function () {
    var now = Date.now();
    if (now - lastSent < 120) {
      return;
    }
    lastSent = now;

    if (Date.now() < state.sync.suppressEditorSyncUntil) {
      return;
    }

    var uri = state.selectedUriByPane[pane];
    if (!uri) {
      return;
    }

    var content = paneContentElements[pane];
    var max = Math.max(content.scrollHeight - content.clientHeight, 1);
    var ratio = content.scrollTop / max;
    void postScrollSync(uri, ratio);
  };
}

async function postScrollSync(uri, ratio) {
  try {
    await fetch("/api/scroll-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ uri: uri, ratio: ratio })
    });
  } catch (_) {
    // Ignore sync failures to avoid interrupting UX.
  }
}

function setupKeyboardShortcuts() {
  if (shortcutsToggleEl && shortcutsModalEl) {
    shortcutsToggleEl.addEventListener("click", function () {
      toggleShortcutsModal();
    });
  }

  if (shortcutsCloseEl && shortcutsModalEl) {
    shortcutsCloseEl.addEventListener("click", function () {
      setShortcutsModalOpen(false);
    });
  }

  if (shortcutsModalEl) {
    shortcutsModalEl.addEventListener("click", function (event) {
      if (event.target === shortcutsModalEl) {
        setShortcutsModalOpen(false);
      }
    });
  }

  window.addEventListener("keydown", handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  var key = event.key;
  var inEditable = isEditableTarget(event.target);

  if (key === "?" && !inEditable) {
    event.preventDefault();
    toggleShortcutsModal();
    return;
  }

  if (key === "Escape" && state.shortcutsModalOpen) {
    event.preventDefault();
    setShortcutsModalOpen(false);
    return;
  }

  if (key === "Escape" && state.wordExport.open) {
    event.preventDefault();
    setWordExportModalOpen(false);
    return;
  }

  if (key === "Escape" && state.slideMode.active) {
    event.preventDefault();
    setSlidesMode(false);
    return;
  }

  if (key === "Escape" && lightboxEl && !lightboxEl.hidden) {
    event.preventDefault();
    setLightboxOpen(false);
    return;
  }

  if (state.shortcutsModalOpen || state.wordExport.open || inEditable) {
    return;
  }

  if (state.slideMode.active) {
    if (key === "ArrowLeft") {
      event.preventDefault();
      setSlideIndex(state.slideMode.index - 1);
      return;
    }
    if (key === "ArrowRight") {
      event.preventDefault();
      setSlideIndex(state.slideMode.index + 1);
      return;
    }
  }

  if (key === "/") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (key === "t" || key === "T") {
    if (!state.runtimeSettings.enableToc) {
      return;
    }
    event.preventDefault();
    tocToggleEl.click();
    return;
  }

  if (key === "d" || key === "D") {
    if (!state.runtimeSettings.enableThemeToggle) {
      return;
    }
    event.preventDefault();
    themeToggleEl.click();
    return;
  }

  if (key === "p" || key === "P") {
    if (!state.runtimeSettings.enablePrint) {
      return;
    }
    event.preventDefault();
    window.print();
    return;
  }

  if (key === "j" || key === "J") {
    event.preventDefault();
    moveTreeFocus(1);
    return;
  }

  if (key === "k" || key === "K") {
    event.preventDefault();
    moveTreeFocus(-1);
    return;
  }

  if (key === "Enter") {
    if (openFocusedTreeFile()) {
      event.preventDefault();
    }
    return;
  }

  if (key === "[") {
    event.preventDefault();
    openSiblingFile(-1);
    return;
  }

  if (key === "]") {
    event.preventDefault();
    openSiblingFile(1);
  }
}

function toggleShortcutsModal() {
  setShortcutsModalOpen(!state.shortcutsModalOpen);
}

function setShortcutsModalOpen(open) {
  state.shortcutsModalOpen = open;

  if (!shortcutsModalEl) {
    return;
  }

  shortcutsModalEl.hidden = !open;
  if (shortcutsToggleEl) {
    shortcutsToggleEl.setAttribute("aria-pressed", String(open));
  }
  if (open && shortcutsCloseEl) {
    shortcutsCloseEl.focus();
  }
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  var tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function getVisibleTreeFileButtons() {
  return Array.prototype.slice.call(treeEl.querySelectorAll(".tree-file"));
}

function moveTreeFocus(delta) {
  var files = getVisibleTreeFileButtons();
  if (files.length === 0) {
    return;
  }

  var currentFocused = document.activeElement;
  var activeIndex = files.indexOf(currentFocused);
  var selectedIndex = getSelectedTreeIndex(files);

  if (activeIndex >= 0) {
    state.treeKeyboardIndex = activeIndex;
  } else if (state.treeKeyboardIndex < 0) {
    state.treeKeyboardIndex = selectedIndex >= 0 ? selectedIndex : 0;
  }

  state.treeKeyboardIndex = clamp(state.treeKeyboardIndex + delta, 0, files.length - 1);
  applyTreeKeyboardFocus(files[state.treeKeyboardIndex]);
}

function getSelectedTreeIndex(files) {
  var primaryUri = state.selectedUriByPane.primary;
  var secondaryUri = state.selectedUriByPane.secondary;
  for (var i = 0; i < files.length; i++) {
    var uri = files[i].dataset.uri;
    if (uri && (uri === primaryUri || uri === secondaryUri)) {
      return i;
    }
  }
  return -1;
}

function applyTreeKeyboardFocus(button) {
  if (!button) {
    return;
  }

  var files = getVisibleTreeFileButtons();
  for (var i = 0; i < files.length; i++) {
    files[i].classList.remove("kbd-focus");
  }

  button.classList.add("kbd-focus");
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest" });
}

function openFocusedTreeFile() {
  var focused = document.activeElement;
  if (!focused || !(focused instanceof HTMLElement) || !focused.classList.contains("tree-file")) {
    return false;
  }

  focused.click();
  return true;
}

function openSiblingFile(direction) {
  var files = getVisibleTreeFileButtons();
  if (files.length === 0) {
    return;
  }

  var targetPane = state.compareMode ? state.activePane : "primary";
  var currentUri = state.selectedUriByPane[targetPane] || state.selectedUriByPane.primary;
  var currentIndex = -1;
  for (var i = 0; i < files.length; i++) {
    if (files[i].dataset.uri === currentUri) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex < 0) {
    currentIndex = 0;
  }

  var nextIndex = clamp(currentIndex + direction, 0, files.length - 1);
  files[nextIndex].click();
  applyTreeKeyboardFocus(files[nextIndex]);
  state.treeKeyboardIndex = nextIndex;
}

function setupWidthModeToggle() {
  if (!state.runtimeSettings.enableWidthToggle) {
    applyWidthMode(constants.widthModeFull);
    return;
  }

  var initialMode = readStorage(storageKeys.widthMode, state.runtimeSettings.defaultWidthMode || constants.widthModeFull);
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
  if (!state.runtimeSettings.enableThemeToggle) {
    applyTheme(constants.themeLight);
    return;
  }

  var initialTheme = readStorage(storageKeys.themeMode, state.runtimeSettings.defaultTheme || constants.themeLight);
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
  if (!state.runtimeSettings.enableCompare) {
    applyCompareMode(false);
    return;
  }

  var initialCompare = readStorage(storageKeys.compareMode, state.runtimeSettings.defaultCompareMode ? "true" : "false") === "true";
  applyCompareMode(initialCompare);

  compareToggleEl.addEventListener("click", function () {
    applyCompareMode(!state.compareMode);
  });
}

function applyCompareMode(enabled) {
  if (!state.runtimeSettings.enableCompare) {
    enabled = false;
  }

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
  if (!state.runtimeSettings.enableToc) {
    state.panelPrefs.rightCollapsed = true;
    writeStorage(storageKeys.rightPanelCollapsed, "true");
    applyPanelStateFromPrefs();
    return;
  }

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
  var startedAt = performance.now();
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
  console.info("[Markdown Mirror] tree loaded in " + String(Math.round(performance.now() - startedAt)) + "ms");

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
  var totalFiles = countFilesInRoots(state.treeRoots);
  if (fileCountEl) {
    fileCountEl.textContent = String(totalFiles) + (totalFiles === 1 ? " file" : " files");
  }

  if (state.treeRoots.length === 0) {
    treeEl.innerHTML = '<div class="tree-empty">No markdown files found</div>';
    renderFavorites();
    return;
  }

  for (var i = 0; i < state.treeRoots.length; i++) {
    var root = state.treeRoots[i];
    var label = document.createElement("div");
    label.className = "tree-root-label";
    label.innerHTML = '<span class="workspace-dot" style="background:' + getWorkspaceColor(i) + '"></span>' + escapeHtml(root.name);
    treeEl.appendChild(label);

    var container = document.createElement("div");
    treeEl.appendChild(container);
    appendNodes(container, root.children || [], root.name, query);
  }

  renderFavorites();
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
    if (state.pinnedUris.has(node.uri)) {
      button.classList.add("is-pinned");
    }
    button.type = "button";
    button.innerHTML =
      '<svg class="tree-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      "<span>" + escapeHtml(node.name) + "</span>" +
      '<span class="tree-file-pin" role="button" tabindex="0" title="Pin file" aria-label="Pin file">★</span>';
    button.dataset.uri = node.uri;
    button.dataset.relativePath = node.relativePath;
    button.addEventListener("click", createOpenHandler(node.uri, node.relativePath));

    var pinButton = button.querySelector(".tree-file-pin");
    if (pinButton) {
      pinButton.addEventListener("click", createPinToggleHandler(node.uri));
    }

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

function createPinToggleHandler(uri) {
  return function (event) {
    event.preventDefault();
    event.stopPropagation();
    if (!uri) {
      return;
    }

    if (state.pinnedUris.has(uri)) {
      state.pinnedUris.delete(uri);
    } else {
      state.pinnedUris.add(uri);
    }

    writeStorage(storageKeys.pinnedUris, JSON.stringify(Array.from(state.pinnedUris)));
    renderTree();
  };
}

function renderFavorites() {
  if (!favoritesTreeEl) {
    return;
  }

  favoritesTreeEl.innerHTML = "";
  var pinnedList = Array.from(state.pinnedUris);
  if (pinnedList.length === 0) {
    favoritesTreeEl.innerHTML = '<div class="tree-empty">No pinned files</div>';
    return;
  }

  var indexed = indexFilesByUri(state.treeRoots);
  for (var i = 0; i < pinnedList.length; i++) {
    var uri = pinnedList[i];
    var node = indexed.get(uri);
    if (!node) {
      continue;
    }

    var button = document.createElement("button");
    button.className = "tree-file is-pinned";
    button.type = "button";
    button.dataset.uri = uri;
    button.innerHTML = '<span>' + escapeHtml(node.name || node.relativePath || "Pinned") + '</span>';
    button.addEventListener("click", createOpenHandler(uri, node.relativePath));
    favoritesTreeEl.appendChild(button);
  }
}

function indexFilesByUri(roots) {
  var map = new Map();
  for (var i = 0; i < roots.length; i++) {
    indexFileNodes(roots[i].children || [], map);
  }
  return map;
}

function indexFileNodes(nodes, output) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file" && node.uri) {
      output.set(node.uri, node);
      continue;
    }
    if (node.kind === "folder") {
      indexFileNodes(node.children || [], output);
    }
  }
}

function countFilesInRoots(roots) {
  var count = 0;
  for (var i = 0; i < roots.length; i++) {
    count += countFilesInNodes(roots[i].children || []);
  }
  return count;
}

function countFilesInNodes(nodes) {
  var count = 0;
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file") {
      count += 1;
      continue;
    }
    if (node.kind === "folder") {
      count += countFilesInNodes(node.children || []);
    }
  }
  return count;
}

function getWorkspaceColor(index) {
  var colors = ["#22c55e", "#38bdf8", "#f59e0b", "#f43f5e", "#818cf8", "#10b981"];
  return colors[index % colors.length];
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

  var startedAt = performance.now();
  var targetPane = pane || "primary";
  var response = await fetch("/api/document?uri=" + encodeURIComponent(uri));
  if (!response.ok) {
    paneContentElements[targetPane].innerHTML = '<p class="placeholder-note">Unable to load document.</p>';
    return;
  }

  var payload = await response.json();
  state.selectedUriByPane[targetPane] = payload.uri;
  state.selectedPathByPane[targetPane] = relativePath || payload.relativePath || "Untitled";
  rememberTab(payload.uri, state.selectedPathByPane[targetPane]);

  paneContentElements[targetPane].innerHTML = payload.html || "";
  paneContentElements[targetPane].scrollTop = 0;

  await postRenderEnhancements(paneContentElements[targetPane], targetPane, { heavy: true });
  refreshSelection();
  updateBreadcrumb();
  updateDocumentStats();

  if (targetPane === state.activePane) {
    rebuildTocForActivePane();
    scrollToHashAnchor(paneContentElements[targetPane]);
  }

  renderTabs();
  console.info("[Markdown Mirror] document render (" + targetPane + ") in " + String(Math.round(performance.now() - startedAt)) + "ms");
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

function rememberTab(uri, relativePath) {
  if (!uri) {
    return;
  }

  var existing = state.openTabs.find(function (tab) {
    return tab.uri === uri;
  });
  if (existing) {
    existing.relativePath = relativePath;
    existing.lastOpenedAt = Date.now();
    return;
  }

  state.openTabs.push({
    uri: uri,
    relativePath: relativePath,
    lastOpenedAt: Date.now()
  });

  if (state.openTabs.length > 16) {
    state.openTabs.sort(function (a, b) {
      return b.lastOpenedAt - a.lastOpenedAt;
    });
    state.openTabs = state.openTabs.slice(0, 16);
  }
}

function removeTab(uri) {
  state.openTabs = state.openTabs.filter(function (tab) {
    return tab.uri !== uri;
  });
}

function renderTabs() {
  if (!tabsBarEl) {
    return;
  }

  tabsBarEl.innerHTML = "";
  if (state.openTabs.length === 0) {
    return;
  }

  var targetPane = state.compareMode ? state.activePane : "primary";
  var activeUri = state.selectedUriByPane[targetPane] || state.selectedUriByPane.primary;

  var sorted = state.openTabs.slice().sort(function (a, b) {
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  for (var i = 0; i < sorted.length; i++) {
    var tab = sorted[i];
    var button = document.createElement("button");
    button.type = "button";
    button.className = "doc-tab";
    if (tab.uri === activeUri) {
      button.classList.add("is-active");
    }
    button.textContent = extractFileName(tab.relativePath || "Untitled");
    button.title = tab.relativePath || tab.uri;
    button.addEventListener("click", createTabOpenHandler(tab.uri, tab.relativePath));
    tabsBarEl.appendChild(button);
  }
}

function createTabOpenHandler(uri, relativePath) {
  return function () {
    var pane = state.compareMode ? state.activePane : "primary";
    void openDocument(uri, relativePath, pane);
  };
}

function extractFileName(pathValue) {
  if (!pathValue) {
    return "Untitled";
  }
  var parts = pathValue.split("/");
  return parts[parts.length - 1] || pathValue;
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
      void updatePaneIfMatching("primary", message.uri, message.html, message.reason);
      void updatePaneIfMatching("secondary", message.uri, message.html, message.reason);
    }

    if (message.type === "viewport-updated") {
      applyEditorViewportSync("primary", message);
      applyEditorViewportSync("secondary", message);
    }
  });
}

function applyEditorViewportSync(pane, message) {
  if (!message || state.selectedUriByPane[pane] !== message.uri) {
    return;
  }

  var total = Math.max(1, Number(message.totalLines) || 1);
  var topLine = Math.max(0, Number(message.topLine) || 0);
  var ratio = topLine / total;
  var content = paneContentElements[pane];
  var max = Math.max(content.scrollHeight - content.clientHeight, 0);

  state.sync.suppressEditorSyncUntil = Date.now() + 320;
  content.scrollTop = Math.round(max * ratio);
}

function clearPaneIfDeleted(pane, uri) {
  if (state.selectedUriByPane[pane] !== uri) {
    return;
  }

  state.selectedUriByPane[pane] = null;
  state.selectedPathByPane[pane] = null;
  paneContentElements[pane].innerHTML = '<p class="placeholder-note">This file was deleted. Select another file.</p>';
  removeTab(uri);
  updateBreadcrumb();
  refreshSelection();
  rebuildTocForActivePane();
  renderTabs();
}

async function updatePaneIfMatching(pane, uri, html, reason) {
  if (state.selectedUriByPane[pane] !== uri) {
    return;
  }

  paneContentElements[pane].innerHTML = html;
  var heavyEnhancements = reason !== "typed";
  await postRenderEnhancements(paneContentElements[pane], pane, { heavy: heavyEnhancements });

  if (pane === state.activePane) {
    rebuildTocForActivePane();
    updateDocumentStats();
  }
}

async function postRenderEnhancements(container, pane, options) {
  var heavy = !options || options.heavy !== false;
  renderMathExpressions(container);
  if (heavy) {
    await renderMermaidDiagrams(container);
  }
  attachHeadingAnchors(container);
  attachTaskCheckboxHandlers(container, pane);
  attachImageLightboxHandlers(container);
  validateInternalLinks(container, pane);
  if (heavy) {
    attachMermaidDownloadButtons(container, pane);
    attachCodeCopyButtons(container);
  }
}

function renderMathExpressions(container) {
  if (!state.runtimeSettings.enableMath || !container || typeof window.renderMathInElement !== "function") {
    return;
  }

  try {
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false,
      strict: "ignore",
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    });
  } catch (_) {
    // Ignore invalid equations to keep preview stable.
  }
}

async function renderMermaidDiagrams(container) {
  if (!window.mermaid || !container) {
    return;
  }

  if (!window.__markdownMirrorMermaidInitialized) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: resolveMermaidTheme()
    });
    window.__markdownMirrorMermaidInitialized = true;
  }

  try {
    await window.mermaid.run({ querySelector: "#" + container.id + " .mermaid" });
  } catch (_) {
    // Keep rendering resilient when diagram syntax is invalid.
  }
}

function resolveMermaidTheme() {
  var configured = state.runtimeSettings.mermaidTheme || "default";
  if (configured === "dark" || configured === "forest" || configured === "neutral") {
    return configured;
  }

  return document.body.classList.contains("theme-dark") ? "dark" : "default";
}

function attachHeadingAnchors(container) {
  var headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
  var usedIds = new Set();

  for (var i = 0; i < headings.length; i++) {
    var heading = headings[i];
    var text = (heading.textContent || "").trim() || "section-" + String(i + 1);
    var baseId = heading.id || slugify(text) || "section-" + String(i + 1);
    var uniqueId = baseId;
    var suffix = 1;

    while (usedIds.has(uniqueId)) {
      suffix += 1;
      uniqueId = baseId + "-" + String(suffix);
    }

    usedIds.add(uniqueId);
    heading.id = uniqueId;

    var existingAnchor = heading.querySelector(".heading-anchor");
    if (existingAnchor) {
      continue;
    }

    var anchor = document.createElement("a");
    anchor.className = "heading-anchor";
    anchor.href = "#" + encodeURIComponent(uniqueId);
    anchor.textContent = "#";
    anchor.setAttribute("aria-label", "Link to section " + text);
    anchor.addEventListener("click", createHeadingAnchorHandler(uniqueId));
    heading.appendChild(anchor);
  }
}

function createHeadingAnchorHandler(headingId) {
  return function (event) {
    event.preventDefault();
    var hash = "#" + encodeURIComponent(headingId);
    if (history && typeof history.replaceState === "function") {
      history.replaceState(null, "", hash);
    } else {
      location.hash = hash;
    }
  };
}

function scrollToHashAnchor(contentEl) {
  if (!contentEl || !location.hash) {
    return;
  }

  var rawHash = location.hash.slice(1);
  if (!rawHash) {
    return;
  }

  var headingId = safeDecodeURIComponent(rawHash);
  var target = contentEl.querySelector("#" + cssEscape(headingId));
  if (target) {
    target.scrollIntoView({ block: "start" });
  }
}

function updateDocumentStats() {
  if (!statsEl) {
    return;
  }

  var contentEl = paneContentElements[state.activePane];
  if (!contentEl) {
    statsEl.textContent = "Words: 0 • Characters: 0 • Reading: 0 min";
    return;
  }

  var text = (contentEl.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) {
    statsEl.textContent = "Words: 0 • Characters: 0 • Reading: 0 min";
    return;
  }

  var words = (text.match(/\S+/g) || []).length;
  var chars = text.length;
  var minutes = Math.max(1, Math.ceil(words / 200));
  var paneLabel = state.compareMode ? "(" + (state.activePane === "primary" ? "Primary" : "Secondary") + ") " : "";
  statsEl.textContent = paneLabel + "Words: " + String(words) + " • Characters: " + String(chars) + " • Reading: " + String(minutes) + " min";
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

function attachTaskCheckboxHandlers(container, pane) {
  var items = container.querySelectorAll("li.task-list-item");
  for (var i = 0; i < items.length; i++) {
    var li = items[i];
    var input = li.querySelector('input[type="checkbox"]');
    if (!input) {
      continue;
    }

    input.removeAttribute("disabled");
    if (!input.dataset.boundToggle) {
      input.dataset.boundToggle = "true";
      input.addEventListener("change", createTaskCheckboxToggleHandler(pane, li, input));
    }
  }
}

function createTaskCheckboxToggleHandler(pane, li, input) {
  return function () {
    var uri = state.selectedUriByPane[pane];
    var sourceLine = Number(li.getAttribute("data-source-line") || input.getAttribute("data-source-line") || "0");
    if (!uri || !sourceLine) {
      return;
    }

    void fetch("/api/toggle-checkbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uri: uri,
        sourceLine: sourceLine,
        checked: Boolean(input.checked)
      })
    });
  };
}

function attachImageLightboxHandlers(container) {
  var images = container.querySelectorAll("img");
  for (var i = 0; i < images.length; i++) {
    var image = images[i];
    if (image.dataset.boundLightbox) {
      continue;
    }

    image.dataset.boundLightbox = "true";
    image.style.cursor = "zoom-in";
    image.addEventListener("click", createImageLightboxHandler(image));
  }
}

function createImageLightboxHandler(image) {
  return function () {
    if (!image || !image.src) {
      return;
    }
    setLightboxOpen(true, image.src);
  };
}

function validateInternalLinks(container, pane) {
  var currentPath = state.selectedPathByPane[pane];
  if (!currentPath) {
    return;
  }

  var allPaths = buildRelativePathIndex(state.treeRoots);
  var links = container.querySelectorAll("a[href]");
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var href = link.getAttribute("href") || "";
    if (!href || /^(https?:|mailto:|#|data:)/i.test(href)) {
      continue;
    }

    var targetPath = normalizeRelativeDocPath(currentPath, href);
    var exists = allPaths.has(targetPath);
    link.classList.toggle("broken-link", !exists);
    if (!exists) {
      link.title = "Broken internal link: " + targetPath;
    }
  }
}

function buildRelativePathIndex(roots) {
  var set = new Set();
  for (var i = 0; i < roots.length; i++) {
    collectRelativePaths(roots[i].children || [], set);
  }
  return set;
}

function collectRelativePaths(nodes, output) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file") {
      output.add((node.relativePath || "").replace(/\\/g, "/"));
      continue;
    }
    collectRelativePaths(node.children || [], output);
  }
}

function normalizeRelativeDocPath(fromPath, href) {
  var cleanHref = href.split("#")[0].split("?")[0].replace(/\\/g, "/");
  var fromParts = (fromPath || "").replace(/\\/g, "/").split("/");
  fromParts.pop();

  var targetParts = fromParts.concat(cleanHref.split("/"));
  var normalized = [];
  for (var i = 0; i < targetParts.length; i++) {
    var part = targetParts[i];
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join("/");
}

async function applyCustomCss() {
  if (!state.runtimeSettings.customCssPath) {
    return;
  }

  try {
    var response = await fetch("/api/custom-css");
    if (!response.ok) {
      return;
    }

    var css = await response.text();
    var existing = document.getElementById("custom-css-runtime");
    if (!existing) {
      existing = document.createElement("style");
      existing.id = "custom-css-runtime";
      document.head.appendChild(existing);
    }
    existing.textContent = css;
  } catch (_) {
    // Keep default styles when custom CSS fails to load.
  }
}

async function exportActivePaneAsStandaloneHtml() {
  var pane = state.compareMode ? state.activePane : "primary";
  var contentEl = paneContentElements[pane];
  if (!contentEl || !state.selectedPathByPane[pane]) {
    return;
  }

  var clone = contentEl.cloneNode(true);
  await replaceMermaidSvgsWithDataImages(clone);

  var cssParts = await Promise.all([
    fetchTextOrEmpty("/app.css"),
    fetchTextOrEmpty("/vendor/highlightjs/github.min.css"),
    fetchTextOrEmpty("/vendor/katex/katex.min.css")
  ]);

  var html = "<!doctype html><html><head><meta charset=\"utf-8\"/><title>" +
    escapeHtml(state.selectedPathByPane[pane]) +
    "</title><style>" + cssParts.join("\n") + "</style></head><body><main class=\"document-content\">" +
    clone.innerHTML +
    "</main></body></html>";

  var blob = new Blob([html], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  triggerDownload(url, extractFileName(state.selectedPathByPane[pane]).replace(/\.md$/i, "") + ".html");
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 200);
}

async function exportSelectionToWord() {
  var selectedUris = Array.from(state.wordExport.selectedUris);
  if (selectedUris.length === 0) {
    return;
  }

  if (wordExportConfirmEl) {
    wordExportConfirmEl.disabled = true;
    wordExportConfirmEl.textContent = "Exporting...";
  }

  try {
    var fileIndex = indexFilesByUri(state.treeRoots);
    var sections = [];

    for (var i = 0; i < selectedUris.length; i++) {
      var uri = selectedUris[i];
      var doc = await loadDocumentForWordExport(uri, fileIndex);
      if (doc) {
        sections.push(doc);
      }
    }

    if (sections.length === 0) {
      return;
    }

    var cssParts = await Promise.all([
      fetchTextOrEmpty("/app.css"),
      fetchTextOrEmpty("/vendor/highlightjs/github.min.css"),
      fetchTextOrEmpty("/vendor/katex/katex.min.css")
    ]);

    var htmlParts = [];
    for (var sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      var section = sections[sectionIndex];
      var pageBreakClass = sectionIndex < sections.length - 1 ? " word-doc-page-break" : "";
      htmlParts.push(
        '<section class="word-doc-section' + pageBreakClass + '">' +
        '<h1 class="word-doc-title">' + escapeHtml(section.relativePath || "Untitled") + "</h1>" +
        section.html +
        "</section>"
      );
    }

    var wordCss = [
      "body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;background:#ffffff;margin:0;padding:18px;}",
      ".word-doc-section{margin:0 auto;max-width:980px;}",
      ".word-doc-title{font-size:28px;margin:0 0 16px;border-bottom:1px solid #cbd5e1;padding-bottom:8px;}",
      ".word-doc-page-break{page-break-after:always;break-after:page;}",
      ".heading-anchor,.code-copy-btn,.mermaid-actions{display:none !important;}"
    ].join("");

    var completeHtml = "<!doctype html><html><head><meta charset=\"utf-8\"/>" +
      "<title>Markdown Mirror Export</title>" +
      "<style>" + cssParts.join("\n") + wordCss + "</style></head><body>" +
      htmlParts.join("\n") +
      "</body></html>";

    var blob = new Blob([completeHtml], { type: "application/msword;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, buildWordExportFileName(sections));
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 300);

    setWordExportModalOpen(false);
  } finally {
    if (wordExportConfirmEl) {
      wordExportConfirmEl.disabled = state.wordExport.selectedUris.size === 0;
      wordExportConfirmEl.textContent = "Export .doc";
    }
  }
}

async function loadDocumentForWordExport(uri, fileIndex) {
  var fromPane = findRenderedPaneByUri(uri);
  var relativePath = resolveRelativePathForUri(uri, fileIndex);

  if (fromPane) {
    var paneNode = paneContentElements[fromPane];
    if (paneNode) {
      var paneClone = paneNode.cloneNode(true);
      cleanupExportNode(paneClone);
      await replaceMermaidSvgsWithDataImages(paneClone);
      await inlineImageSourcesAsData(paneClone);
      return {
        uri: uri,
        relativePath: relativePath,
        html: paneClone.innerHTML
      };
    }
  }

  try {
    var response = await fetch("/api/document?uri=" + encodeURIComponent(uri));
    if (!response.ok) {
      return null;
    }

    var payload = await response.json();
    var container = document.createElement("div");
    container.innerHTML = payload.html || "";
    cleanupExportNode(container);
    await inlineImageSourcesAsData(container);

    return {
      uri: uri,
      relativePath: relativePath || payload.relativePath || "Untitled",
      html: container.innerHTML
    };
  } catch (_) {
    return null;
  }
}

function cleanupExportNode(node) {
  var selectors = [".heading-anchor", ".code-copy-btn", ".mermaid-actions"];
  for (var i = 0; i < selectors.length; i++) {
    var matches = node.querySelectorAll(selectors[i]);
    for (var j = 0; j < matches.length; j++) {
      matches[j].remove();
    }
  }
}

function findRenderedPaneByUri(uri) {
  if (!uri) {
    return null;
  }
  if (state.selectedUriByPane.primary === uri) {
    return "primary";
  }
  if (state.selectedUriByPane.secondary === uri) {
    return "secondary";
  }
  return null;
}

function resolveRelativePathForUri(uri, fileIndex) {
  var node = fileIndex.get(uri);
  if (node && node.relativePath) {
    return node.relativePath;
  }

  if (state.selectedUriByPane.primary === uri) {
    return state.selectedPathByPane.primary || "Untitled";
  }

  if (state.selectedUriByPane.secondary === uri) {
    return state.selectedPathByPane.secondary || "Untitled";
  }

  var tab = state.openTabs.find(function (entry) {
    return entry.uri === uri;
  });
  return tab ? (tab.relativePath || "Untitled") : "Untitled";
}

async function inlineImageSourcesAsData(root) {
  var images = root.querySelectorAll("img[src]");
  for (var i = 0; i < images.length; i++) {
    var src = images[i].getAttribute("src") || "";
    if (!src || /^data:/i.test(src)) {
      continue;
    }

    try {
      var absoluteSrc = new URL(src, window.location.origin).toString();
      var absoluteHost = new URL(absoluteSrc).origin;
      if (state.runtimeSettings.offlineMode && absoluteHost !== window.location.origin) {
        continue;
      }

      var response = await fetch(absoluteSrc);
      if (!response.ok) {
        continue;
      }

      var blob = await response.blob();
      var dataUrl = await blobToDataUrl(blob);
      images[i].setAttribute("src", dataUrl);
    } catch (_) {
      // Keep original image URL when conversion fails.
    }
  }
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ""));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildWordExportFileName(sections) {
  if (sections.length === 1) {
    return extractFileName(sections[0].relativePath || "document").replace(/\.md$/i, "") + ".doc";
  }

  var stamp = new Date().toISOString().slice(0, 10);
  return "markdown-mirror-export-" + stamp + ".doc";
}

function fetchTextOrEmpty(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) {
      return "";
    }
    return response.text();
  }).catch(function () {
    return "";
  });
}

async function replaceMermaidSvgsWithDataImages(root) {
  var svgs = root.querySelectorAll(".mermaid svg");
  for (var i = 0; i < svgs.length; i++) {
    var svg = svgs[i];
    var text = new XMLSerializer().serializeToString(svg);
    var dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
    var img = document.createElement("img");
    img.src = dataUri;
    img.alt = "Mermaid diagram";
    svg.parentNode.replaceWith(img);
  }
}

function toggleSlidesMode() {
  setSlidesMode(!state.slideMode.active);
}

function setSlidesMode(open) {
  if (!slidesOverlayEl || !slidesStageEl || !slidesCounterEl || !slidesToggleEl) {
    return;
  }

  state.slideMode.active = open;
  slidesOverlayEl.hidden = !open;
  slidesToggleEl.classList.toggle("is-active", open);
  slidesToggleEl.setAttribute("aria-pressed", String(open));

  if (!open) {
    return;
  }

  buildSlidesFromActivePane();
  setSlideIndex(0);
}

function buildSlidesFromActivePane() {
  var pane = state.compareMode ? state.activePane : "primary";
  var contentEl = paneContentElements[pane];
  if (!contentEl) {
    state.slideMode.slides = [];
    return;
  }

  var html = contentEl.innerHTML;
  var parts = html.split(/<hr\s*\/?\s*>/i).filter(function (part) {
    return part.trim().length > 0;
  });

  if (parts.length <= 1) {
    parts = splitSlidesByHeading(contentEl);
  }

  state.slideMode.slides = parts.length > 0 ? parts : [html];
}

function setSlideIndex(index) {
  if (!slidesStageEl || !slidesCounterEl || state.slideMode.slides.length === 0) {
    if (slidesStageEl) {
      slidesStageEl.innerHTML = '<div class="slide-empty">No slide content available.</div>';
    }
    if (slidesCounterEl) {
      slidesCounterEl.textContent = "0 / 0";
    }
    return;
  }

  var max = state.slideMode.slides.length - 1;
  state.slideMode.index = clamp(index, 0, max);
  void renderCurrentSlide();
  slidesCounterEl.textContent = String(state.slideMode.index + 1) + " / " + String(state.slideMode.slides.length);
}

function splitSlidesByHeading(contentEl) {
  if (!contentEl) {
    return [];
  }

  var blocks = Array.prototype.slice.call(contentEl.children || []);
  if (blocks.length === 0) {
    return [];
  }

  var slides = [];
  var current = [];

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var tagName = (block.tagName || "").toLowerCase();
    var isBreakHeading = tagName === "h1" || tagName === "h2";

    if (isBreakHeading && current.length > 0) {
      slides.push(current.join(""));
      current = [];
    }

    current.push(block.outerHTML || "");
  }

  if (current.length > 0) {
    slides.push(current.join(""));
  }

  if (slides.length <= 1) {
    return [];
  }

  return slides;
}

async function renderCurrentSlide() {
  if (!slidesStageEl || state.slideMode.slides.length === 0) {
    return;
  }

  var token = ++state.slideMode.renderToken;
  var pane = state.compareMode ? state.activePane : "primary";
  var html = state.slideMode.slides[state.slideMode.index] || "";
  slidesStageEl.innerHTML = '<article class="slide-page"><div class="slide-page-inner">' + html + "</div></article>";

  var slideBody = slidesStageEl.querySelector(".slide-page-inner");
  if (!slideBody) {
    return;
  }

  await postRenderEnhancements(slideBody, pane, { heavy: true });
  if (token !== state.slideMode.renderToken) {
    return;
  }

  refreshSlideOverflowState();
}

function refreshSlideOverflowState() {
  if (!slidesStageEl) {
    return;
  }

  var page = slidesStageEl.querySelector(".slide-page");
  if (!page) {
    return;
  }

  var overflowing = page.scrollHeight > page.clientHeight + 2;
  page.classList.toggle("is-overflowing", overflowing);
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

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

window.__markdownMirrorMermaidInitialized = false;
