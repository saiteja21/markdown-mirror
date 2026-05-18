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
    defaultCompareMode: false,
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
  favoritesCollapsed: false,
  editedUris: new Set(),
  changedLineByUri: new Map(),
  recentEditLineByPane: {
    primary: 0,
    secondary: 0
  },
  recentEditSetAtByPane: {
    primary: 0,
    secondary: 0
  },
  suppressReadClearUntilByPane: {
    primary: 0,
    secondary: 0
  },
  paneRenderVersion: {
    primary: 0,
    secondary: 0
  },
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
  nativeHost: {
    enabled: false,
    themeSync: false,
    forcedTheme: null,
    lockThemeToggle: false,
    uiProfile: "classic",
    targetUri: null
  },
  launchOptions: {
    forceCompare: false,
    openSlides: false,
    targetUri: null
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
  pinnedUris: "markdownMirror.pinnedUris",
  favoritesCollapsed: "markdownMirror.favoritesCollapsed"
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

applyNativeHostOptions();

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
const refreshBtnEl = document.getElementById("refresh-btn");
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
const favoritesPanelEl = document.getElementById("favorites-panel");
const favoritesToggleEl = document.getElementById("favorites-toggle");
const favoritesTreeEl = document.getElementById("favorites-tree");
const fileCountEl = document.getElementById("file-count");
const liveUpdatingEl = document.getElementById("live-updating");
const backToTopEl = document.getElementById("back-to-top");
const mobileMenuToggleEl = document.getElementById("mobile-menu-toggle");
const mobileSidebarBackdropEl = document.getElementById("mobile-sidebar-backdrop");
const fileNavPrevEl = document.getElementById("file-nav-prev");
const fileNavNextEl = document.getElementById("file-nav-next");
const fileNavPrevLabelEl = document.getElementById("file-nav-prev-label");
const fileNavNextLabelEl = document.getElementById("file-nav-next-label");
const fileNavPositionEl = document.getElementById("file-nav-position");
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
let liveUpdatingHideTimer = null;

const syncMode = {
  editorToBrowser: false,
  browserToEditor: false
};

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
    state.runtimeSettings.startExplorerCollapsed = Boolean(payload && payload.startExplorerCollapsed);
    state.runtimeSettings.defaultFilePath = payload && typeof payload.defaultFilePath === "string" ? payload.defaultFilePath : "";
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
  loadFavoritesPrefs();
  loadPanelPrefs();
  applyNativeUxProfile();
  setupPanelManager();

  setupPaneActivation();
  setupSearch();
  setupTreeControls();
  setupFavoritesPanel();
  setupPrintToggle();
  setupExportHtml();
  setupWordExport();
  setupBackToTop();
  setupLightbox();
  setupKeyboardShortcuts();
  setupWidthModeToggle();
  setupThemeToggle();
  setupCompareToggle();
  setupTocToggle();

  await loadTree();
  applyLaunchOptionsAfterTreeLoad();
  applyCustomCss();
  connectSocket();

  // Defer non-critical setup
  requestAnimationFrame(function () {
    setupSlidesMode();
    setupScrollSync();
  });

  requestAnimationFrame(function () {
    var elapsed = Math.round(performance.now() - state.perf.bootStartedAt);
    console.info("[Markdown Mirror] boot complete in " + String(elapsed) + "ms");
  });
}

function loadFavoritesPrefs() {
  state.favoritesCollapsed = readStorage(storageKeys.favoritesCollapsed, "false") === "true";
}

function setupFavoritesPanel() {
  applyFavoritesCollapsedUi();

  if (!favoritesToggleEl) {
    return;
  }

  favoritesToggleEl.addEventListener("click", function () {
    state.favoritesCollapsed = !state.favoritesCollapsed;
    writeStorage(storageKeys.favoritesCollapsed, String(state.favoritesCollapsed));
    applyFavoritesCollapsedUi();
  });
}

function applyFavoritesCollapsedUi() {
  if (!favoritesPanelEl || !favoritesToggleEl) {
    return;
  }

  favoritesPanelEl.classList.toggle("collapsed", state.favoritesCollapsed);
  favoritesToggleEl.textContent = state.favoritesCollapsed ? "▶" : "▼";
  favoritesToggleEl.setAttribute("aria-expanded", String(!state.favoritesCollapsed));
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

  // Start with explorer collapsed if configured
  if (state.runtimeSettings.startExplorerCollapsed) {
    state.panelPrefs.leftCollapsed = true;
  }
}

function isNativeFocusedProfile() {
  return state.nativeHost.enabled && state.nativeHost.uiProfile === "focused";
}

function applyNativeUxProfile() {
  if (!state.nativeHost.enabled) {
    return;
  }

  document.body.classList.add("native-host");
  document.body.classList.add("native-ui-" + state.nativeHost.uiProfile);

  if (!isNativeFocusedProfile()) {
    return;
  }

  // Native focused mode: default to a clean single-pane reading/editing experience.
  state.panelPrefs.leftCollapsed = true;
  state.panelPrefs.rightCollapsed = true;
  state.runtimeSettings.defaultCompareMode = false;
  state.runtimeSettings.defaultTocVisible = false;
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
  var isMobile = window.innerWidth <= 768;

  // Toggle mobile class on body
  document.body.classList.toggle("is-mobile", isMobile);

  if (isMobile) {
    // On mobile, always close sidebar overlay when resizing into mobile range
    closeMobileSidebar();
  }

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

function openMobileSidebar() {
  document.body.classList.add("mobile-sidebar-open");
  if (mobileSidebarBackdropEl) {
    mobileSidebarBackdropEl.removeAttribute("hidden");
  }
}

function closeMobileSidebar() {
  document.body.classList.remove("mobile-sidebar-open");
  if (mobileSidebarBackdropEl) {
    mobileSidebarBackdropEl.setAttribute("hidden", "");
  }
}

// Mobile menu toggle
if (mobileMenuToggleEl) {
  mobileMenuToggleEl.addEventListener("click", function () {
    if (document.body.classList.contains("mobile-sidebar-open")) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });
}

if (mobileSidebarBackdropEl) {
  mobileSidebarBackdropEl.addEventListener("click", closeMobileSidebar);
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
  if (!printToggleEl || printToggleEl.dataset.boundPrint === "true") {
    return;
  }

  printToggleEl.dataset.boundPrint = "true";

  printToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enablePrint) {
      return;
    }
    window.print();
  });
}

function setupExportHtml() {
  if (!exportHtmlToggleEl || exportHtmlToggleEl.dataset.boundExportHtml === "true") {
    return;
  }

  exportHtmlToggleEl.dataset.boundExportHtml = "true";

  exportHtmlToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableHtmlExport) {
      return;
    }
    void exportActivePaneAsStandaloneHtml();
  });
}

function setupWordExport() {
  if (!exportWordToggleEl || !wordExportModalEl || !wordExportListEl || wordExportModalEl.dataset.boundWordExport === "true") {
    return;
  }

  wordExportModalEl.dataset.boundWordExport = "true";

  // Search input for filtering files
  var wordExportSearchEl = document.getElementById("word-export-search");
  if (wordExportSearchEl) {
    wordExportSearchEl.addEventListener("input", function () {
      renderWordExportList();
    });
  }

  exportWordToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableWordExport) {
      return;
    }
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
      if (!state.runtimeSettings.enableWordExport) {
        return;
      }
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

  // Filter by search
  var searchEl = document.getElementById("word-export-search");
  var query = (searchEl ? searchEl.value : "").toLowerCase().trim();
  var filtered = docs;
  if (query) {
    filtered = docs.filter(function (doc) {
      return (doc.relativePath || "").toLowerCase().indexOf(query) >= 0;
    });
  }

  // === Selected Files Section (always at top) ===
  var selectedDocs = filtered.filter(function (d) { return state.wordExport.selectedUris.has(d.uri); });
  if (selectedDocs.length > 0) {
    var selectedHeader = document.createElement("div");
    selectedHeader.className = "word-export-section-header";
    selectedHeader.innerHTML = '<span class="word-export-section-icon">✓</span> Selected Files (' + selectedDocs.length + ')';
    wordExportListEl.appendChild(selectedHeader);

    for (var s = 0; s < selectedDocs.length; s++) {
      wordExportListEl.appendChild(createWordExportItem(selectedDocs[s], true));
    }
  }

  // === All Files by Folder (collapsible) ===
  var folderMap = new Map();
  for (var i = 0; i < filtered.length; i++) {
    var doc = filtered[i];
    var parts = (doc.relativePath || "").replace(/\\/g, "/").split("/");
    var fileName = parts.pop() || doc.relativePath;
    var folder = parts.length > 0 ? parts.join("/") : "(root)";
    if (!folderMap.has(folder)) {
      folderMap.set(folder, []);
    }
    folderMap.get(folder).push({ doc: doc, fileName: fileName });
  }

  var allFoldersHeader = document.createElement("div");
  allFoldersHeader.className = "word-export-section-header";
  allFoldersHeader.innerHTML = '<span class="word-export-section-icon">📁</span> All Files';
  wordExportListEl.appendChild(allFoldersHeader);

  folderMap.forEach(function (files, folder) {
    var folderWrapper = document.createElement("div");
    folderWrapper.className = "word-export-folder-group";

    var folderHeader = document.createElement("button");
    folderHeader.type = "button";
    folderHeader.className = "word-export-folder";
    var hasSelected = files.some(function (f) { return state.wordExport.selectedUris.has(f.doc.uri); });
    folderHeader.innerHTML = '<span class="word-export-folder-arrow">▶</span> ' +
      escapeHtml(folder) +
      ' <span class="word-export-folder-count">(' + files.length + ')</span>' +
      (hasSelected ? ' <span class="word-export-folder-selected">●</span>' : '');

    var folderContent = document.createElement("div");
    folderContent.className = "word-export-folder-content";
    folderContent.hidden = true;

    folderHeader.addEventListener("click", (function (content, header) {
      return function () {
        var collapsed = !content.hidden;
        content.hidden = collapsed;
        var arrow = header.querySelector(".word-export-folder-arrow");
        if (arrow) arrow.textContent = collapsed ? "▶" : "▼";
      };
    })(folderContent, folderHeader));

    for (var j = 0; j < files.length; j++) {
      folderContent.appendChild(createWordExportItem(files[j].doc, false, files[j].fileName));
    }

    folderWrapper.appendChild(folderHeader);
    folderWrapper.appendChild(folderContent);
    wordExportListEl.appendChild(folderWrapper);
  });

  if (wordExportConfirmEl) {
    wordExportConfirmEl.disabled = state.wordExport.selectedUris.size === 0;
  }
}

function createWordExportItem(doc, showFullPath, displayName) {
  var label = document.createElement("label");
  label.className = "word-export-item";
  if (state.wordExport.selectedUris.has(doc.uri)) {
    label.classList.add("is-selected");
  }

  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = doc.uri;
  checkbox.checked = state.wordExport.selectedUris.has(doc.uri);
  checkbox.addEventListener("change", createWordDocSelectionHandler(doc.uri, checkbox));

  var text = document.createElement("span");
  text.className = "word-export-path";
  text.textContent = showFullPath ? (doc.relativePath || extractFileName(doc.uri)) : (displayName || extractFileName(doc.uri));

  label.appendChild(checkbox);
  label.appendChild(text);
  return label;
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

    // Re-render to update selected section at top
    renderWordExportList();
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
  if (!slidesOverlayEl || slidesOverlayEl.dataset.boundSlides === "true") {
    return;
  }

  slidesOverlayEl.dataset.boundSlides = "true";

  if (slidesToggleEl) {
    slidesToggleEl.addEventListener("click", function () {
      if (!state.runtimeSettings.enableSlides) {
        return;
      }
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

  // File navigation buttons
  if (fileNavPrevEl) {
    fileNavPrevEl.addEventListener("click", function () {
      openSiblingFile(-1);
    });
  }
  if (fileNavNextEl) {
    fileNavNextEl.addEventListener("click", function () {
      openSiblingFile(1);
    });
  }

  paneContentElements.primary.addEventListener("scroll", handleActivePaneScrollUi);
  paneContentElements.secondary.addEventListener("scroll", handleActivePaneScrollUi);
  paneContentElements.primary.addEventListener("click", createPaneReadHandler("primary"));
  paneContentElements.secondary.addEventListener("click", createPaneReadHandler("secondary"));
  paneContentElements.primary.addEventListener("click", createContentLinkHandler("primary"));
  paneContentElements.secondary.addEventListener("click", createContentLinkHandler("secondary"));
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

  if (event.target === paneContentElements.primary) {
    clearRecentEditHighlightForPane("primary");
  } else if (event.target === paneContentElements.secondary) {
    clearRecentEditHighlightForPane("secondary");
  }
}

function createPaneReadHandler(pane) {
  return function () {
    clearRecentEditHighlightForPane(pane);
  };
}

function createContentLinkHandler(pane) {
  return function (event) {
    var anchor = event.target.closest("a[href]");
    if (!anchor) {
      return;
    }

    var href = anchor.getAttribute("href") || "";
    if (!href) {
      return;
    }

    // External links: open in new tab
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    // Mailto: do nothing special
    if (/^mailto:/i.test(href)) {
      return;
    }

    // In-page anchor
    if (href.startsWith("#")) {
      event.preventDefault();
      var anchorId = href.slice(1);
      var target = paneContentElements[pane].querySelector("#" + CSS.escape(anchorId));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    // Internal relative .md link - resolve and open
    event.preventDefault();
    var currentPath = state.selectedPathByPane[pane];
    if (!currentPath) {
      return;
    }

    var hashPart = "";
    var hrefPath = href;
    var hashIndex = href.indexOf("#");
    if (hashIndex >= 0) {
      hrefPath = href.slice(0, hashIndex);
      hashPart = href.slice(hashIndex);
    }

    var resolvedRelative = normalizeRelativeDocPath(currentPath, hrefPath);
    var matchedNode = findTreeNodeByRelativePath(resolvedRelative);
    if (matchedNode && matchedNode.uri) {
      void openDocument(matchedNode.uri, matchedNode.relativePath, pane);
    } else {
      // Try with .md extension appended
      var withExt = resolvedRelative.toLowerCase().endsWith(".md") ? resolvedRelative : resolvedRelative + ".md";
      matchedNode = findTreeNodeByRelativePath(withExt);
      if (matchedNode && matchedNode.uri) {
        void openDocument(matchedNode.uri, matchedNode.relativePath, pane);
      }
    }
  };
}

function findTreeNodeByRelativePath(targetPath) {
  var normalized = (targetPath || "").replace(/\\/g, "/").toLowerCase();
  return findNodeInTree(state.treeRoots, normalized);
}

function findNodeInTree(nodes, targetNormalized) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file") {
      var nodePath = (node.relativePath || "").replace(/\\/g, "/").toLowerCase();
      if (nodePath === targetNormalized) {
        return node;
      }
    }
    if (node.children) {
      var found = findNodeInTree(node.children, targetNormalized);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function clearRecentEditHighlightForPane(pane) {
  if (!pane || !state.recentEditLineByPane || !state.recentEditLineByPane[pane]) {
    return;
  }

  var now = Date.now();
  var suppressUntil = state.suppressReadClearUntilByPane[pane] || 0;
  if (now < suppressUntil) {
    return;
  }

  var setAt = state.recentEditSetAtByPane[pane] || 0;
  if (setAt > 0 && (now - setAt) < 1600) {
    return;
  }

  state.recentEditLineByPane[pane] = 0;
  state.recentEditSetAtByPane[pane] = 0;
  state.suppressReadClearUntilByPane[pane] = 0;
  if (pane === state.activePane) {
    rebuildTocForActivePane();
  }
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

    // Zoom controls via scroll wheel
    lightboxEl.addEventListener("wheel", function (event) {
      if (lightboxEl.hidden || !lightboxImageEl) return;
      event.preventDefault();
      var current = parseFloat(lightboxImageEl.dataset.zoom || "1");
      var delta = event.deltaY < 0 ? 0.2 : -0.2;
      var next = Math.max(0.3, Math.min(5, current + delta));
      lightboxImageEl.dataset.zoom = String(next);
      lightboxImageEl.style.transform = "scale(" + next + ")";
    }, { passive: false });
  }
}

function setLightboxOpen(open, src) {
  if (!lightboxEl || !lightboxImageEl) {
    return;
  }

  lightboxEl.hidden = !open;
  if (open && src) {
    lightboxImageEl.src = src;
    lightboxImageEl.style.transform = "scale(1)";
    lightboxImageEl.dataset.zoom = "1";
  }
  if (!open) {
    lightboxImageEl.removeAttribute("src");
    lightboxImageEl.style.transform = "";
  }
}

function setupScrollSync() {
  if (!syncMode.browserToEditor) {
    return;
  }

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

    if (!syncMode.browserToEditor) {
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

  // Wrap around: loop from last → first and first → last
  var nextIndex = (currentIndex + direction + files.length) % files.length;
  files[nextIndex].click();
  applyTreeKeyboardFocus(files[nextIndex]);
  state.treeKeyboardIndex = nextIndex;
}

function updateFileNav() {
  var files = getVisibleTreeFileButtons();
  if (files.length === 0) {
    if (fileNavPrevEl) fileNavPrevEl.disabled = true;
    if (fileNavNextEl) fileNavNextEl.disabled = true;
    if (fileNavPositionEl) fileNavPositionEl.textContent = "";
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

  if (fileNavPrevEl) fileNavPrevEl.disabled = files.length <= 1;
  if (fileNavNextEl) fileNavNextEl.disabled = files.length <= 1;

  if (currentIndex >= 0 && fileNavPositionEl) {
    fileNavPositionEl.textContent = (currentIndex + 1) + " / " + files.length;
  }

  // Show previous/next file names
  if (currentIndex >= 0) {
    var prevIndex = (currentIndex - 1 + files.length) % files.length;
    var nextIndex = (currentIndex + 1) % files.length;
    var prevName = (files[prevIndex].dataset.name || "").trim();
    var nextName = (files[nextIndex].dataset.name || "").trim();
    if (fileNavPrevLabelEl) fileNavPrevLabelEl.textContent = prevName;
    if (fileNavNextLabelEl) fileNavNextLabelEl.textContent = nextName;
  }
}

function setupWidthModeToggle() {
  var initialMode = readStorage(storageKeys.widthMode, state.runtimeSettings.defaultWidthMode || constants.widthModeFull);
  applyWidthMode(state.runtimeSettings.enableWidthToggle && initialMode === constants.widthModeReading ? constants.widthModeReading : constants.widthModeFull);

  if (!widthToggleEl || widthToggleEl.dataset.boundWidthToggle === "true") {
    return;
  }

  widthToggleEl.dataset.boundWidthToggle = "true";
  widthToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableWidthToggle) {
      return;
    }
    var isReading = document.body.classList.contains("reading-width");
    applyWidthMode(isReading ? constants.widthModeFull : constants.widthModeReading);
  });
}

function applyWidthMode(mode) {
  var isReading = mode === constants.widthModeReading;
  document.body.classList.toggle("reading-width", isReading);
  widthToggleEl.classList.toggle("is-reading", isReading);
  widthToggleEl.title = isReading ? "Switch to Full Width" : "Switch to Reading Width";
  widthToggleEl.setAttribute("aria-pressed", String(isReading));
  writeStorage(storageKeys.widthMode, isReading ? constants.widthModeReading : constants.widthModeFull);
}

function setupThemeToggle() {
  var forcedTheme = state.nativeHost.themeSync ? state.nativeHost.forcedTheme : null;
  var initialTheme = forcedTheme || readStorage(storageKeys.themeMode, state.runtimeSettings.defaultTheme || constants.themeLight);
  applyTheme(initialTheme === constants.themeDark ? constants.themeDark : constants.themeLight, {
    persist: !forcedTheme
  });

  var canToggleTheme = state.runtimeSettings.enableThemeToggle && !state.nativeHost.lockThemeToggle;
  applyThemeToggleAvailability(canToggleTheme);

  if (!themeToggleEl || themeToggleEl.dataset.boundThemeToggle === "true") {
    return;
  }

  themeToggleEl.dataset.boundThemeToggle = "true";
  themeToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableThemeToggle || state.nativeHost.lockThemeToggle) {
      return;
    }
    var isDark = document.body.classList.contains("theme-dark");
    applyTheme(isDark ? constants.themeLight : constants.themeDark);
  });
}

if (refreshBtnEl) {
  refreshBtnEl.addEventListener("click", function () {
    var uri = state.selectedUriByPane.primary;
    var path = state.selectedPathByPane.primary;
    if (uri) {
      openDocument(uri, path, "primary");
    }
  });
}

function applyTheme(theme, options) {
  var persist = !(options && options.persist === false);
  var isDark = theme === constants.themeDark;
  document.body.classList.toggle("theme-dark", isDark);
  themeToggleEl.classList.toggle("is-active", isDark);
  themeToggleEl.title = isDark ? "Switch to Light theme" : "Switch to Dark theme";
  themeToggleEl.setAttribute("aria-pressed", String(isDark));

  if (window.mermaid) {
    // Re-render is not needed — diagrams always use light theme in white container
    window.__markdownMirrorMermaidInitialized = false;
  }

  if (persist) {
    writeStorage(storageKeys.themeMode, isDark ? constants.themeDark : constants.themeLight);
  }
}

function applyThemeToggleAvailability(enabled) {
  if (!themeToggleEl) {
    return;
  }

  themeToggleEl.disabled = !enabled;
  if (!enabled && state.nativeHost.lockThemeToggle) {
    themeToggleEl.title = "Following VS Code theme";
  } else {
    themeToggleEl.title = "Toggle light/dark theme";
  }
}

function setupCompareToggle() {
  var initialCompare = state.launchOptions.forceCompare
    ? true
    : isNativeFocusedProfile()
      ? false
      : readStorage(storageKeys.compareMode, state.runtimeSettings.defaultCompareMode ? "true" : "false") === "true";
  applyCompareMode(state.runtimeSettings.enableCompare ? initialCompare : false);

  if (!compareToggleEl || compareToggleEl.dataset.boundCompareToggle === "true") {
    return;
  }

  compareToggleEl.dataset.boundCompareToggle = "true";
  compareToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableCompare) {
      return;
    }
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
  compareToggleEl.title = enabled ? "Switch to Single View" : "Switch to Split View";
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
  if (!tocToggleEl || tocToggleEl.dataset.boundTocToggle === "true") {
    return;
  }

  tocToggleEl.dataset.boundTocToggle = "true";
  tocToggleEl.addEventListener("click", function () {
    if (!state.runtimeSettings.enableToc) {
      return;
    }

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
    var initialNode = null;
    if (state.nativeHost.targetUri) {
      initialNode = findFileByUri(state.treeRoots, state.nativeHost.targetUri);
    }

    if (!initialNode) {
      initialNode = findFirstFile(state.treeRoots);
    }

    if (initialNode && initialNode.uri) {
      await openDocument(initialNode.uri, initialNode.relativePath, "primary");
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
  updateFileNav();
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
    if (state.editedUris.has(node.uri)) {
      button.classList.add("is-edited");
    }
    button.type = "button";
    button.innerHTML =
      '<svg class="tree-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      "<span>" + escapeHtml(node.name) + "</span>" +
      '<span class="tree-file-pin" role="button" tabindex="0" title="Pin file" aria-label="Pin file">★</span>';
    button.dataset.uri = node.uri;
    button.dataset.name = node.name;
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
    if (state.editedUris.has(uri)) {
      button.classList.add("is-edited");
    }
    button.type = "button";
    button.dataset.uri = uri;
    button.dataset.name = node.name || node.relativePath || "Pinned";
    button.innerHTML =
      '<span>' + escapeHtml(node.name || node.relativePath || "Pinned") + '</span>' +
      '<span class="tree-file-pin" role="button" tabindex="0" title="Unfavorite" aria-label="Unfavorite">★</span>';
    button.addEventListener("click", createOpenHandler(uri, node.relativePath));

    var pinButton = button.querySelector(".tree-file-pin");
    if (pinButton) {
      pinButton.addEventListener("click", createPinToggleHandler(uri));
    }

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

  // Close mobile sidebar when a file is selected
  if (document.body.classList.contains("is-mobile")) {
    closeMobileSidebar();
  }

  var startedAt = performance.now();
  var targetPane = pane || "primary";
  var requestVersion = bumpPaneRenderVersion(targetPane);
  var response = await fetch("/api/document?uri=" + encodeURIComponent(uri));
  if (!isPaneRenderVersionCurrent(targetPane, requestVersion)) {
    return;
  }

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
  if (!isPaneRenderVersionCurrent(targetPane, requestVersion)) {
    return;
  }

  var changedLine = state.changedLineByUri.get(payload.uri);
  if (changedLine) {
    state.recentEditLineByPane[targetPane] = changedLine;
    state.recentEditSetAtByPane[targetPane] = Date.now();
    state.suppressReadClearUntilByPane[targetPane] = Date.now() + 1000;
    scrollToSourceLine(paneContentElements[targetPane], changedLine);
    state.changedLineByUri.delete(payload.uri);
  } else {
    state.recentEditLineByPane[targetPane] = 0;
    state.recentEditSetAtByPane[targetPane] = 0;
    state.suppressReadClearUntilByPane[targetPane] = 0;
  }

  var wasEdited = state.editedUris.has(payload.uri);
  state.editedUris.delete(payload.uri);
  if (wasEdited) {
    renderTree();
  }
  refreshSelection();
  updateBreadcrumb();
  updateDocumentStats();
  updateFileNav();

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
    var primaryClass = state.activePane === "primary" ? "breadcrumb-current" : "breadcrumb-segment";
    var secondaryClass = state.activePane === "secondary" ? "breadcrumb-current" : "breadcrumb-segment";
    breadcrumbEl.innerHTML =
      '<span class="breadcrumb-segment">Primary</span>' +
      '<span class="breadcrumb-separator">:</span>' +
      '<span class="' + primaryClass + '">' + left + '</span>' +
      '<span class="breadcrumb-separator">|</span>' +
      '<span class="breadcrumb-segment">Secondary</span>' +
      '<span class="breadcrumb-separator">:</span>' +
      '<span class="' + secondaryClass + '">' + right + '</span>';
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

  var tabPicker = document.createElement("select");
  tabPicker.className = "tabs-select";
  tabPicker.setAttribute("aria-label", "Open document tabs");

  for (var pickerIndex = 0; pickerIndex < sorted.length; pickerIndex++) {
    var pickerTab = sorted[pickerIndex];
    var option = document.createElement("option");
    option.value = pickerTab.uri;
    option.textContent = pickerTab.relativePath || extractFileName(pickerTab.uri) || "Untitled";
    option.title = pickerTab.relativePath || pickerTab.uri;
    if (pickerTab.uri === activeUri) {
      option.selected = true;
    }
    tabPicker.appendChild(option);
  }

  tabPicker.addEventListener("change", function () {
    var selectedUri = tabPicker.value;
    for (var k = 0; k < sorted.length; k++) {
      if (sorted[k].uri === selectedUri) {
        void openDocument(sorted[k].uri, sorted[k].relativePath, targetPane);
        break;
      }
    }
  });

  tabsBarEl.appendChild(tabPicker);

  for (var i = 0; i < sorted.length; i++) {
    var tab = sorted[i];
    var tabEl = document.createElement("div");
    tabEl.className = "doc-tab";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "doc-tab-open";
    if (tab.uri === activeUri) {
      tabEl.classList.add("is-active");
    }
    button.textContent = extractFileName(tab.relativePath || "Untitled");
    button.title = tab.relativePath || tab.uri;
    button.addEventListener("click", createTabOpenHandler(tab.uri, tab.relativePath));

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "doc-tab-close";
    closeButton.textContent = "×";
    closeButton.title = "Close";
    closeButton.setAttribute("aria-label", "Close " + (tab.relativePath || extractFileName(tab.uri) || "tab"));
    closeButton.addEventListener("click", createTabCloseHandler(tab.uri));

    tabEl.appendChild(button);
    tabEl.appendChild(closeButton);
    tabsBarEl.appendChild(tabEl);
  }
}

function createTabCloseHandler(uri) {
  return function (event) {
    event.preventDefault();
    event.stopPropagation();

    var pane = state.compareMode ? state.activePane : "primary";
    var activeUri = state.selectedUriByPane[pane] || state.selectedUriByPane.primary;
    var wasActive = activeUri === uri;

    removeTab(uri);

    if (!wasActive) {
      renderTabs();
      return;
    }

    if (state.openTabs.length === 0) {
      state.selectedUriByPane[pane] = null;
      state.selectedPathByPane[pane] = null;
      paneContentElements[pane].innerHTML = '<p class="placeholder-note">Select a markdown file from the explorer.</p>';
      refreshSelection();
      updateBreadcrumb();
      updateDocumentStats();
      rebuildTocForActivePane();
      renderTabs();
      return;
    }

    var fallback = state.openTabs
      .slice()
      .sort(function (a, b) {
        return b.lastOpenedAt - a.lastOpenedAt;
      })[0];

    if (fallback) {
      void openDocument(fallback.uri, fallback.relativePath, pane);
    } else {
      renderTabs();
    }
  };
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

function getHeadingLabelText(heading, fallbackText) {
  if (!heading) {
    return fallbackText || "Section";
  }

  var clone = heading.cloneNode(true);
  var anchors = clone.querySelectorAll(".heading-anchor");
  for (var i = 0; i < anchors.length; i++) {
    anchors[i].remove();
  }

  var text = clone.textContent ? clone.textContent.trim() : "";
  return text || fallbackText || "Section";
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
  var recentLine = state.recentEditLineByPane[state.activePane] || 0;
  for (var i = 0; i < headings.length; i++) {
    var heading = headings[i];
    var text = getHeadingLabelText(heading, "Section");
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
    var sourceLine = Number(heading.getAttribute("data-source-line") || "0");
    if (recentLine > 0 && sourceLine > 0 && Math.abs(sourceLine - recentLine) <= 3) {
      button.classList.add("toc-item-edited");
    }
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

    scrollTargetIntoPane(contentEl, target, true);
  };
}

var wsReconnectDelay = 1000;

function connectSocket() {
  var protocol = location.protocol === "https:" ? "wss" : "ws";
  var socket = new WebSocket(protocol + "://" + location.host + "/ws");
  var treeRefreshTimer = null;

  socket.addEventListener("open", function () {
    wsReconnectDelay = 1000; // Reset backoff on successful connect
    statusEl.classList.add("online");
    statusEl.querySelector(".status-text").textContent = "Connected";
  });

  socket.addEventListener("close", function () {
    statusEl.classList.remove("online");
    statusEl.querySelector(".status-text").textContent = "Disconnected";
    setTimeout(connectSocket, wsReconnectDelay);
    wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 30000); // Exponential backoff, max 30s
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
      markUriAsEdited(message.uri, message.changedLine);
      void updatePaneIfMatching("primary", message.uri, message.html, message.reason, message.changedLine);
      void updatePaneIfMatching("secondary", message.uri, message.html, message.reason, message.changedLine);
    }

    if (syncMode.editorToBrowser && message.type === "viewport-updated") {
      applyEditorViewportSync("primary", message);
      applyEditorViewportSync("secondary", message);
    }

    if (message.type === "settings-updated") {
      void handleRuntimeSettingsUpdated();
    }
  });
}

function markUriAsEdited(uri, changedLine) {
  if (!uri) {
    return;
  }

  var wasEdited = state.editedUris.has(uri);
  state.editedUris.add(uri);
  if (typeof changedLine === "number" && changedLine > 0) {
    state.changedLineByUri.set(uri, changedLine);
  }

  if (!wasEdited) {
    renderTree();
  }
}

async function handleRuntimeSettingsUpdated() {
  await loadRuntimeSettings();
  applyRuntimeFeatureToggles();
  setupWidthModeToggle();
  setupThemeToggle();
  setupCompareToggle();
  setupTocToggle();

  if (!state.runtimeSettings.enableCompare && state.compareMode) {
    applyCompareMode(false);
  }

  if (!state.runtimeSettings.enableToc) {
    state.panelPrefs.rightCollapsed = true;
    writeStorage(storageKeys.rightPanelCollapsed, "true");
    applyPanelStateFromPrefs();
  }

  if (!state.runtimeSettings.enableSlides && state.slideMode.active) {
    setSlidesMode(false);
  }

  await loadTree();
  await refreshOpenPanesAfterSettingsChange();
}

async function refreshOpenPanesAfterSettingsChange() {
  var primaryUri = state.selectedUriByPane.primary;
  var secondaryUri = state.selectedUriByPane.secondary;

  if (primaryUri) {
    await openDocument(primaryUri, state.selectedPathByPane.primary || "", "primary");
  }

  if (state.compareMode && secondaryUri) {
    await openDocument(secondaryUri, state.selectedPathByPane.secondary || "", "secondary");
  }
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

async function updatePaneIfMatching(pane, uri, html, reason, changedLine) {
  if (state.selectedUriByPane[pane] !== uri) {
    return;
  }

  var requestVersion = bumpPaneRenderVersion(pane);

  if (reason === "typed") {
    showLiveUpdatingPulse();
  }

  paneContentElements[pane].innerHTML = html;
  if (typeof changedLine === "number" && changedLine > 0) {
    state.recentEditLineByPane[pane] = changedLine;
    state.recentEditSetAtByPane[pane] = Date.now();
    state.suppressReadClearUntilByPane[pane] = Date.now() + 600;
  } else {
    state.recentEditLineByPane[pane] = 0;
    state.recentEditSetAtByPane[pane] = 0;
    state.suppressReadClearUntilByPane[pane] = 0;
  }
  var heavyEnhancements = reason !== "typed";
  await postRenderEnhancements(paneContentElements[pane], pane, { heavy: heavyEnhancements });
  if (!isPaneRenderVersionCurrent(pane, requestVersion)) {
    return;
  }

  if (pane === state.activePane) {
    rebuildTocForActivePane();
    updateDocumentStats();
  }

  if (state.editedUris.has(uri)) {
    state.editedUris.delete(uri);
    renderTree();
  }
}

function showLiveUpdatingPulse() {
  if (!liveUpdatingEl) {
    return;
  }

  liveUpdatingEl.hidden = false;
  if (liveUpdatingHideTimer) {
    clearTimeout(liveUpdatingHideTimer);
  }

  liveUpdatingHideTimer = setTimeout(function () {
    liveUpdatingEl.hidden = true;
    liveUpdatingHideTimer = null;
  }, 1400);
}

function bumpPaneRenderVersion(pane) {
  if (!pane || !state.paneRenderVersion || !Object.prototype.hasOwnProperty.call(state.paneRenderVersion, pane)) {
    return 0;
  }

  state.paneRenderVersion[pane] += 1;
  return state.paneRenderVersion[pane];
}

function isPaneRenderVersionCurrent(pane, version) {
  if (!pane || !state.paneRenderVersion || !Object.prototype.hasOwnProperty.call(state.paneRenderVersion, pane)) {
    return false;
  }

  return state.paneRenderVersion[pane] === version;
}

function scrollToSourceLine(container, line) {
  if (!container || !line) {
    return;
  }

  var candidates = container.querySelectorAll("[data-source-line]");
  if (!candidates || candidates.length === 0) {
    return;
  }

  var target = null;
  var bestDistance = Number.MAX_SAFE_INTEGER;
  for (var i = 0; i < candidates.length; i++) {
    var node = candidates[i];
    var sourceLine = Number(node.getAttribute("data-source-line") || "0");
    if (!sourceLine) {
      continue;
    }

    var distance = Math.abs(sourceLine - line);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = node;
    }
  }

  if (target) {
    scrollTargetIntoPane(container, target, true);
  }
}

async function postRenderEnhancements(container, pane, options) {
  var heavy = !options || options.heavy !== false;
  renderMathExpressions(container);
  if (heavy) {
    await renderMermaidDiagrams(container);
  }
  attachHeadingAnchors(container, pane);
  attachInDocumentHashLinkHandlers(container, pane);
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
  if (!container) {
    return;
  }

  var diagrams = container.querySelectorAll(".mermaid");
  if (diagrams.length === 0) {
    return;
  }

  if (!window.mermaid) {
    return;
  }

  // Always use 'default' (light) theme — diagrams render in a white container
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default"
  });
  window.__markdownMirrorMermaidInitialized = true;

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

function attachHeadingAnchors(container, pane) {
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
    anchor.addEventListener("click", createHeadingAnchorHandler(uniqueId, pane));
    heading.appendChild(anchor);
  }
}

function createHeadingAnchorHandler(headingId, pane) {
  return function (event) {
    event.preventDefault();
    var contentEl = paneContentElements[pane] || paneContentElements[state.activePane];
    if (contentEl) {
      setActivePane(pane);
      var target = contentEl.querySelector("#" + cssEscape(headingId));
      if (target) {
        scrollTargetIntoPane(contentEl, target, true);
      }
    }

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

  var target = resolveHashTarget(contentEl, rawHash);
  if (target) {
    scrollTargetIntoPane(contentEl, target, false);
  }
}

function resolveHashTarget(container, rawHash) {
  if (!container || !rawHash) {
    return null;
  }

  var decoded = safeDecodeURIComponent(rawHash);
  var normalized = decoded.replace(/^#/, "");
  var candidates = [
    normalized,
    rawHash,
    normalized.toLowerCase(),
    slugify(normalized),
    normalized.replace(/^user-content-/, "")
  ];

  for (var i = 0; i < candidates.length; i++) {
    var id = candidates[i];
    if (!id) {
      continue;
    }

    var exact = container.querySelector("#" + cssEscape(id));
    if (exact) {
      return exact;
    }
  }

  return null;
}

function scrollTargetIntoPane(contentEl, target, smooth) {
  if (!contentEl || !target) {
    return;
  }

  var targetTop = target.getBoundingClientRect().top;
  var contentTop = contentEl.getBoundingClientRect().top;
  var nextTop = contentEl.scrollTop + (targetTop - contentTop) - 8;
  // Clamp to max scrollable position to prevent white space at bottom
  var maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
  contentEl.scrollTo({
    top: Math.max(0, Math.min(nextTop, maxScroll)),
    behavior: smooth ? "smooth" : "auto"
  });
}

function attachInDocumentHashLinkHandlers(container, pane) {
  if (!container) {
    return;
  }

  var links = container.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    if (link.classList.contains("heading-anchor") || link.dataset.boundHashNav === "true") {
      continue;
    }

    link.dataset.boundHashNav = "true";
    link.addEventListener("click", createInDocumentHashLinkHandler(container, pane, link));
  }
}

function createInDocumentHashLinkHandler(container, pane, link) {
  return function (event) {
    var href = link.getAttribute("href") || "";
    var rawHash = href.slice(1);
    if (!rawHash) {
      return;
    }

    var target = resolveHashTarget(container, rawHash);
    if (!target) {
      return;
    }

    event.preventDefault();
    setActivePane(pane);
    var contentEl = paneContentElements[pane] || container;
    scrollTargetIntoPane(contentEl, target, true);

    var finalId = target.id || safeDecodeURIComponent(rawHash);
    var hash = "#" + encodeURIComponent(finalId);
    if (history && typeof history.replaceState === "function") {
      history.replaceState(null, "", hash);
    } else {
      location.hash = hash;
    }
  };
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

    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.removeAttribute("style");
    inlineSvgStyles(svgNode, clone);

    var svgData = new XMLSerializer().serializeToString(clone);
    var svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));

    var img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgBase64;
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

    var dataUrl = canvas.toDataURL("image/png");
    triggerDownload(dataUrl, fileName);
  } catch (err) {
    console.warn("[Markdown Mirror] PNG conversion failed:", err);
    // No SVG fallback — show error to user
    alert("Unable to convert diagram to PNG. Try again or take a screenshot.");
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
  // Images
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

  // Mermaid SVGs
  var mermaidDivs = container.querySelectorAll(".mermaid");
  for (var m = 0; m < mermaidDivs.length; m++) {
    var mDiv = mermaidDivs[m];
    if (mDiv.dataset.boundLightbox) {
      continue;
    }
    mDiv.dataset.boundLightbox = "true";
    mDiv.style.cursor = "zoom-in";
    mDiv.addEventListener("click", createMermaidLightboxHandler(mDiv));
  }
}

function createMermaidLightboxHandler(mermaidDiv) {
  return function () {
    var svg = mermaidDiv.querySelector("svg");
    if (!svg) return;
    // Convert to PNG for lightbox
    svgToPngDataUrl(svg).then(function(pngUrl) {
      setLightboxOpen(true, pngUrl);
    }).catch(function() {
      // If PNG fails, skip lightbox
    });
  };
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
  var uri = state.selectedUriByPane[pane];
  var relativePath = state.selectedPathByPane[pane];
  if (!uri || !relativePath) {
    return;
  }

  // Fetch full rendered document from server (not just visible viewport)
  var docResponse = await fetch("/api/document?uri=" + encodeURIComponent(uri));
  if (!docResponse.ok) {
    return;
  }
  var docPayload = await docResponse.json();
  var fullHtml = docPayload.html || "";

  var cssParts = await Promise.all([
    fetchTextOrEmpty("/app.css"),
    fetchTextOrEmpty("/vendor/highlightjs/github.min.css"),
    fetchTextOrEmpty("/vendor/katex/katex.min.css")
  ]);

  var html = "<!doctype html><html><head><meta charset=\"utf-8\"/><title>" +
    escapeHtml(relativePath) +
    "</title><style>" + cssParts.join("\n") + "</style></head><body><main class=\"document-content\">" +
    fullHtml +
    "</main></body></html>";

  var blob = new Blob([html], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  triggerDownload(url, extractFileName(relativePath).replace(/\.md$/i, "") + ".html");
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
    await replaceMermaidSvgsWithDataImages(container);
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
    try {
      // Convert SVG to PNG via canvas for Word compatibility
      var pngDataUrl = await svgToPngDataUrl(svg);
      var img = document.createElement("img");
      img.src = pngDataUrl;
      img.alt = "Mermaid diagram";
      img.style.maxWidth = "100%";
      svg.parentNode.replaceWith(img);
    } catch (_) {
      // Fallback: try again with a simpler approach
      try {
        var pngRetry = await svgToPngDataUrl(svg);
        var retryImg = document.createElement("img");
        retryImg.src = pngRetry;
        retryImg.alt = "Mermaid diagram";
        retryImg.style.maxWidth = "100%";
        svg.parentNode.replaceWith(retryImg);
      } catch (_2) {
        // Remove the SVG entirely if conversion fails
        svg.parentNode.innerHTML = '<p style="color:#94a3b8;font-style:italic">[Diagram could not be exported]</p>';
      }
    }
  }
}

async function svgToPngDataUrl(svgElement) {
  var clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  var rect = svgElement.getBoundingClientRect();
  var width = Math.ceil(rect.width) || parseInt(svgElement.getAttribute("width"), 10) || 800;
  var height = Math.ceil(rect.height) || parseInt(svgElement.getAttribute("height"), 10) || 600;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("style");
  inlineSvgStyles(svgElement, clone);

  var svgData = new XMLSerializer().serializeToString(clone);
  var svgBase64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));

  var img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise(function (resolve, reject) {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgBase64;
  });

  var scale = 2;
  var canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  var ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
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

function findFileByUri(roots, targetUri) {
  if (!targetUri) {
    return null;
  }

  for (var i = 0; i < roots.length; i++) {
    var found = findByUriInNodes(roots[i].children || [], targetUri);
    if (found) {
      return found;
    }
  }

  return null;
}

function findByUriInNodes(nodes, targetUri) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.kind === "file" && node.uri === targetUri) {
      return node;
    }

    if (node.kind === "folder") {
      var found = findByUriInNodes(node.children || [], targetUri);
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

function applyNativeHostOptions() {
  var params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (_) {
    return;
  }

  state.launchOptions.forceCompare = params.get("mm_compare") === "1";
  state.launchOptions.openSlides = params.get("mm_slides") === "1";
  var launchTargetUri = params.get("mm_open_uri");
  state.launchOptions.targetUri = typeof launchTargetUri === "string" && launchTargetUri.length > 0 ? launchTargetUri : null;

  // Read theme from URL for both browser and native modes
  var rawTheme = String(params.get("mm_theme") || "").toLowerCase();
  if (rawTheme === constants.themeDark || rawTheme === constants.themeLight) {
    state.runtimeSettings.defaultTheme = rawTheme;
  }

  if (params.get("mm_native") !== "1") {
    return;
  }

  state.nativeHost.enabled = true;
  state.nativeHost.uiProfile = String(params.get("mm_native_ui") || "focused").toLowerCase() === "classic"
    ? "classic"
    : "focused";

  var targetUri = params.get("mm_open_uri");
  state.nativeHost.targetUri = typeof targetUri === "string" && targetUri.length > 0 ? targetUri : null;

  var forcedTheme = rawTheme === constants.themeDark || rawTheme === constants.themeLight ? rawTheme : null;
  state.nativeHost.themeSync = Boolean(forcedTheme);
  state.nativeHost.forcedTheme = forcedTheme;
  state.nativeHost.lockThemeToggle = state.nativeHost.themeSync && params.get("mm_lockTheme") !== "0";
}

function applyLaunchOptionsAfterTreeLoad() {
  if (state.launchOptions.targetUri && state.selectedUriByPane.primary !== state.launchOptions.targetUri) {
    var byTarget = findFileByUri(state.treeRoots, state.launchOptions.targetUri);
    if (byTarget && byTarget.uri) {
      void openDocument(byTarget.uri, byTarget.relativePath, "primary");
    }
  }

  // Default file on launch: open configured file if no explicit target was set
  if (!state.launchOptions.targetUri && state.runtimeSettings.defaultFilePath && !state.selectedUriByPane.primary) {
    var defaultNode = findTreeNodeByRelativePath(state.runtimeSettings.defaultFilePath);
    if (defaultNode && defaultNode.uri) {
      void openDocument(defaultNode.uri, defaultNode.relativePath, "primary");
    }
  }

  if (state.launchOptions.forceCompare && state.runtimeSettings.enableCompare) {
    applyCompareMode(true);
  }

  if (state.launchOptions.openSlides && state.runtimeSettings.enableSlides) {
    window.requestAnimationFrame(function () {
      setSlidesMode(true);
    });
  }
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

// ===== READING PROGRESS BAR =====
(function setupReadingProgress() {
  var progressEl = document.getElementById("reading-progress");
  if (!progressEl) return;

  function updateProgress() {
    var pane = state.compareMode ? state.activePane : "primary";
    var contentEl = paneContentElements[pane];
    if (!contentEl) return;
    var scrollTop = contentEl.scrollTop;
    var scrollHeight = contentEl.scrollHeight - contentEl.clientHeight;
    var pct = scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0;
    progressEl.style.width = pct + "%";
  }

  if (paneContentElements.primary) paneContentElements.primary.addEventListener("scroll", updateProgress);
  if (paneContentElements.secondary) paneContentElements.secondary.addEventListener("scroll", updateProgress);
})();

// ===== SCROLL-SPY FOR TOC =====
(function setupScrollSpy() {
  var lastActive = null;

  function runScrollSpy() {
    var pane = state.compareMode ? state.activePane : "primary";
    var contentEl = paneContentElements[pane];
    if (!contentEl || !tocListEl) return;

    var headings = contentEl.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
    if (headings.length === 0) return;

    var containerTop = contentEl.getBoundingClientRect().top;
    var activeId = null;

    for (var i = headings.length - 1; i >= 0; i--) {
      var rect = headings[i].getBoundingClientRect();
      if (rect.top - containerTop <= 60) {
        activeId = headings[i].id;
        break;
      }
    }

    if (activeId === lastActive) return;
    lastActive = activeId;

    var tocItems = tocListEl.querySelectorAll(".toc-item");
    for (var j = 0; j < tocItems.length; j++) {
      var item = tocItems[j];
      var href = (item.getAttribute("data-heading-id") || item.getAttribute("href") || "").replace("#", "");
      item.classList.toggle("is-active-spy", href === activeId);
    }
  }

  if (paneContentElements.primary) paneContentElements.primary.addEventListener("scroll", runScrollSpy);
  if (paneContentElements.secondary) paneContentElements.secondary.addEventListener("scroll", runScrollSpy);
})();

// ===== COMMAND PALETTE =====
(function setupCommandPalette() {
  var paletteEl = document.getElementById("cmd-palette");
  var inputEl = document.getElementById("cmd-palette-input");
  var resultsEl = document.getElementById("cmd-palette-results");
  var toggleBtn = document.getElementById("cmd-palette-toggle");
  if (!paletteEl || !inputEl || !resultsEl) return;

  var focusIndex = -1;
  var currentResults = [];

  function openPalette() {
    paletteEl.hidden = false;
    inputEl.value = "";
    inputEl.focus();
    focusIndex = -1;
    renderResults("");
  }

  function closePalette() {
    paletteEl.hidden = true;
    inputEl.blur();
  }

  function getActions() {
    return [
      { type: "action", label: "Toggle Dark/Light Theme", action: function() { if (themeToggleEl) themeToggleEl.click(); } },
      { type: "action", label: "Toggle TOC Panel", action: function() { if (tocToggleEl) tocToggleEl.click(); } },
      { type: "action", label: "Toggle Split View", action: function() { if (compareToggleEl) compareToggleEl.click(); } },
      { type: "action", label: "Toggle Reading Width", action: function() { if (widthToggleEl) widthToggleEl.click(); } },
      { type: "action", label: "Print / Export PDF", action: function() { if (printToggleEl) printToggleEl.click(); } },
      { type: "action", label: "Export HTML", action: function() { if (exportHtmlToggleEl) exportHtmlToggleEl.click(); } },
      { type: "action", label: "Export Word", action: function() { if (exportWordToggleEl) exportWordToggleEl.click(); } },
      { type: "action", label: "Slides Mode", action: function() { if (slidesToggleEl) slidesToggleEl.click(); } },
      { type: "action", label: "Keyboard Shortcuts", action: function() { if (shortcutsToggleEl) shortcutsToggleEl.click(); } }
    ];
  }

  function getFiles() {
    var docs = getAllMarkdownDocs();
    return docs.map(function(doc) {
      return { type: "file", label: doc.relativePath, uri: doc.uri, relativePath: doc.relativePath };
    });
  }

  function getHeadings() {
    var pane = state.compareMode ? state.activePane : "primary";
    var contentEl = paneContentElements[pane];
    if (!contentEl) return [];
    var heads = contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
    var result = [];
    for (var i = 0; i < heads.length; i++) {
      var text = (heads[i].textContent || "").trim();
      var id = heads[i].id || "";
      if (text) result.push({ type: "heading", label: text, id: id, element: heads[i] });
    }
    return result;
  }

  function renderResults(query) {
    resultsEl.innerHTML = "";
    currentResults = [];
    var q = query.toLowerCase().trim();
    var isActionMode = q.startsWith(">");

    if (isActionMode) {
      var aq = q.slice(1).trim();
      var actions = getActions().filter(function(a) { return !aq || a.label.toLowerCase().indexOf(aq) >= 0; });
      if (actions.length > 0) {
        addSection("Actions");
        actions.forEach(function(a) { addResult("\u26A1", a.label, "", a); });
      }
    } else {
      var files = getFiles().filter(function(f) { return !q || f.label.toLowerCase().indexOf(q) >= 0; });
      if (files.length > 0) {
        addSection("Files");
        files.slice(0, 10).forEach(function(f) { addResult("\uD83D\uDCC4", f.label, "", f); });
      }
      var headings = getHeadings().filter(function(h) { return !q || h.label.toLowerCase().indexOf(q) >= 0; });
      if (headings.length > 0) {
        addSection("Headings");
        headings.slice(0, 10).forEach(function(h) { addResult("#", h.label, "", h); });
      }
      if (!q || q.length < 2) {
        var acts = getActions().slice(0, 5);
        if (acts.length > 0) {
          addSection("Actions (type > for all)");
          acts.forEach(function(a) { addResult("\u26A1", a.label, "", a); });
        }
      }
    }

    focusIndex = currentResults.length > 0 ? 0 : -1;
    updateFocus();
  }

  function addSection(title) {
    var div = document.createElement("div");
    div.className = "cmd-result-section";
    div.textContent = title;
    resultsEl.appendChild(div);
  }

  function addResult(icon, label, hint, data) {
    var idx = currentResults.length;
    var div = document.createElement("div");
    div.className = "cmd-result";
    div.dataset.index = String(idx);
    div.innerHTML = '<span class="cmd-result-icon">' + escapeHtml(icon) + '</span>' +
      '<span class="cmd-result-label">' + escapeHtml(label) + '</span>' +
      (hint ? '<span class="cmd-result-hint">' + escapeHtml(hint) + '</span>' : '');
    div.addEventListener("click", function() { executeResult(data); });
    resultsEl.appendChild(div);
    currentResults.push({ element: div, data: data });
  }

  function executeResult(data) {
    closePalette();
    if (data.type === "action" && typeof data.action === "function") {
      data.action();
    } else if (data.type === "file" && data.uri) {
      void openDocument(data.uri, data.relativePath, "primary");
    } else if (data.type === "heading" && data.element) {
      data.element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function updateFocus() {
    for (var i = 0; i < currentResults.length; i++) {
      currentResults[i].element.classList.toggle("is-focused", i === focusIndex);
    }
    if (focusIndex >= 0 && currentResults[focusIndex]) {
      currentResults[focusIndex].element.scrollIntoView({ block: "nearest" });
    }
  }

  inputEl.addEventListener("input", function() { renderResults(inputEl.value); });
  inputEl.addEventListener("keydown", function(e) {
    if (e.key === "Escape") { closePalette(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); focusIndex = Math.min(focusIndex + 1, currentResults.length - 1); updateFocus(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); focusIndex = Math.max(focusIndex - 1, 0); updateFocus(); return; }
    if (e.key === "Enter" && focusIndex >= 0 && currentResults[focusIndex]) { executeResult(currentResults[focusIndex].data); return; }
  });

  paletteEl.addEventListener("click", function(e) { if (e.target === paletteEl) closePalette(); });
  if (toggleBtn) toggleBtn.addEventListener("click", openPalette);

  document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (paletteEl.hidden) openPalette(); else closePalette();
    }
  });
})();

// Ctrl+R to refresh current file
document.addEventListener("keydown", function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "r") {
    e.preventDefault();
    if (refreshBtnEl) refreshBtnEl.click();
  }
});

// ===== TOPBAR OVERFLOW MENU =====
(function setupOverflowMenu() {
  var moreBtn = document.getElementById("topbar-more");
  var menu = document.getElementById("topbar-overflow-menu");
  if (!moreBtn || !menu) return;

  moreBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (menu.hasAttribute("hidden")) {
      menu.removeAttribute("hidden");
    } else {
      menu.setAttribute("hidden", "");
    }
  });

  document.addEventListener("click", function() {
    menu.setAttribute("hidden", "");
  });

  menu.addEventListener("click", function() {
    menu.setAttribute("hidden", "");
  });
})();

/* ── Data File Tree View Interactions ── */
(function initDataTreeInteractions() {
  document.addEventListener("click", function(e) {
    var target = e.target;
    if (!target) { return; }

    // Data tree expand/collapse
    var node = target.closest(".data-node.data-expandable");
    if (node && target.closest(".data-key")) {
      node.classList.toggle("collapsed");
      e.preventDefault();
      return;
    }

    // Data view toggle (tree/source)
    if (target.classList.contains("data-view-btn")) {
      var viewer = target.closest(".data-file-viewer");
      if (!viewer) { return; }
      var view = target.getAttribute("data-view");
      var btns = viewer.querySelectorAll(".data-view-btn");
      var panels = viewer.querySelectorAll(".data-view-panel");
      for (var i = 0; i < btns.length; i++) { btns[i].classList.remove("active"); }
      for (var j = 0; j < panels.length; j++) { panels[j].classList.remove("active"); }
      target.classList.add("active");
      var panelClass = view === "source" ? "data-source-panel" : "data-tree-panel";
      var activePanel = viewer.querySelector("." + panelClass);
      if (activePanel) { activePanel.classList.add("active"); }
      e.preventDefault();
      return;
    }
  });
})();

/* ── Workspace Full-Text Search ── */
(function initWorkspaceSearch() {
  var overlayEl = document.getElementById("workspace-search-overlay");
  var inputEl = document.getElementById("workspace-search-input");
  var resultsEl = document.getElementById("workspace-search-results");
  var statusEl = document.getElementById("workspace-search-status");
  var closeEl = document.getElementById("workspace-search-close");
  if (!overlayEl || !inputEl || !resultsEl || !closeEl) { return; }

  var debounceTimer = null;
  var abortController = null;

  function openSearch() {
    overlayEl.classList.add("open");
    inputEl.value = "";
    resultsEl.innerHTML = "";
    if (statusEl) { statusEl.hidden = true; }
    setTimeout(function() { inputEl.focus(); }, 50);
  }

  function closeSearch() {
    overlayEl.classList.remove("open");
    if (debounceTimer) { clearTimeout(debounceTimer); }
    if (abortController) { abortController.abort(); }
  }

  closeEl.addEventListener("click", closeSearch);

  overlayEl.addEventListener("click", function(e) {
    if (e.target === overlayEl) { closeSearch(); }
  });

  document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      if (overlayEl.classList.contains("open")) {
        closeSearch();
      } else {
        openSearch();
      }
    }
    if (e.key === "Escape" && overlayEl.classList.contains("open")) {
      closeSearch();
    }
  });

  // Expose for toolbar/menu integration
  window.__openWorkspaceSearch = openSearch;

  inputEl.addEventListener("input", function() {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    var query = inputEl.value.trim();
    if (!query) {
      resultsEl.innerHTML = "";
      if (statusEl) { statusEl.hidden = true; }
      return;
    }
    debounceTimer = setTimeout(function() { runSearch(query); }, 300);
  });

  function runSearch(query) {
    if (abortController) { abortController.abort(); }
    abortController = new AbortController();
    resultsEl.innerHTML = '<div class="search-no-results">Searching...</div>';
    if (statusEl) { statusEl.hidden = true; }

    fetch("/api/search?q=" + encodeURIComponent(query), { signal: abortController.signal })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) {
          resultsEl.innerHTML = '<div class="search-no-results">' + escapeHtml(data.error) + '</div>';
          return;
        }
        if (!data.results || data.results.length === 0) {
          resultsEl.innerHTML = '<div class="search-no-results">No results found.</div>';
          return;
        }
        renderSearchResults(data.results, query);
        if (statusEl) {
          var totalMatches = data.results.reduce(function(sum, r) { return sum + r.matches.length; }, 0);
          statusEl.textContent = totalMatches + " match" + (totalMatches !== 1 ? "es" : "") + " in " + data.results.length + " file" + (data.results.length !== 1 ? "s" : "");
          statusEl.hidden = false;
        }
      })
      .catch(function(err) {
        if (err.name !== "AbortError") {
          resultsEl.innerHTML = '<div class="search-no-results">Search failed.</div>';
        }
      });
  }

  function renderSearchResults(results, query) {
    var html = "";
    for (var i = 0; i < results.length; i++) {
      var file = results[i];
      html += '<div class="search-result-group">';
      html += '<div class="search-result-file">' + escapeHtml(file.relativePath) + ' <span class="match-count">(' + file.matches.length + ')</span></div>';
      for (var j = 0; j < file.matches.length; j++) {
        var match = file.matches[j];
        html += '<div class="search-result-match" data-uri="' + escapeHtml(file.uri) + '">';
        html += '<span class="search-result-line-num">L' + match.line + '</span>';
        html += '<span class="search-result-text">' + highlightMatch(match.text, query) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    resultsEl.innerHTML = html;
  }

  resultsEl.addEventListener("click", function(e) {
    var matchEl = e.target.closest(".search-result-match");
    if (!matchEl) { return; }
    var uri = matchEl.getAttribute("data-uri");
    if (uri && typeof openDocument === "function") {
      openDocument(uri);
      closeSearch();
    }
  });

  function highlightMatch(text, query) {
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp("(" + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return escaped.replace(regex, "<mark>$1</mark>");
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".mm-plantuml-download");
    if (btn) {
      e.preventDefault();
      var pngSrc = btn.dataset.src;
      if (pngSrc) {
        var a = document.createElement("a");
        a.href = pngSrc;
        a.download = "plantuml-diagram.png";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  });
})();

