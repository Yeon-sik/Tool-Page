"use strict";

(function homeHub() {
  const searchInput = document.querySelector("#tool-search-input");
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const statusLine = document.querySelector("#results-status");
  const emptyState = document.querySelector("#empty-state");
  const resetButton = document.querySelector("[data-reset-filters]");
  const recentShell = document.querySelector("#recent-tool-shell");
  const recentLink = document.querySelector("#recent-tool-link");
  const recentMeta = document.querySelector("#recent-tool-meta");

  if (!searchInput || !statusLine || filterButtons.length === 0) {
    return;
  }

  const STORAGE_KEY = "tool-page:recent-tool";
  const categoryLabels = {
    all: "전체",
    image: "이미지",
    document: "문서",
    audio: "오디오",
  };

  const cards = Array.from(document.querySelectorAll("[data-tool-card]")).map((card) => {
    const title = card.querySelector("h3");
    const link = card.querySelector("[data-tool-link]");

    return {
      element: card,
      id: card.dataset.toolId || "",
      category: card.dataset.category || "all",
      keywords: normalize(card.dataset.keywords || ""),
      purpose: card.dataset.purpose || "",
      title: title ? title.textContent.trim() : "",
      searchText: normalize(
        [card.dataset.keywords, card.dataset.purpose, title ? title.textContent : "", card.textContent]
          .filter(Boolean)
          .join(" ")
      ),
      href: link ? link.getAttribute("href") || "" : "",
      cta: link ? link.textContent.trim() : "도구 열기",
    };
  });

  let activeCategory = "all";

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveCategory(button.dataset.filter || "all");
      render();
    });
  });

  searchInput.addEventListener("input", render);

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      resetFilters();
      searchInput.focus();
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-tool-link]");
    if (!link) {
      return;
    }

    const card = link.closest("[data-tool-card]");
    if (!card || !card.dataset.toolId) {
      return;
    }

    saveRecentTool(card.dataset.toolId);
    renderRecentTool(card.dataset.toolId);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !isTypingContext(event.target)) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    if (event.key === "Escape") {
      const shouldReset = searchInput.value.trim() !== "" || activeCategory !== "all";

      if (shouldReset) {
        event.preventDefault();
        resetFilters();
      }
    }
  });

  renderRecentTool(loadRecentTool());
  render();

  function render() {
    const query = normalize(searchInput.value);
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesCategory = activeCategory === "all" || card.category === activeCategory;
      const matchesQuery = query === "" || card.searchText.includes(query);
      const isVisible = matchesCategory && matchesQuery;

      card.element.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }

    statusLine.textContent = buildStatusMessage(visibleCount, query);
  }

  function buildStatusMessage(visibleCount, query) {
    if (visibleCount === 0) {
      return `일치하는 도구가 없습니다. 카테고리: ${categoryLabels[activeCategory]}${query ? ` · 검색어: ${searchInput.value.trim()}` : ""}`;
    }

    if (activeCategory === "all" && query === "" && visibleCount === cards.length) {
      return `${cards.length}개 도구를 모두 보고 있습니다.`;
    }

    return `${cards.length}개 중 ${visibleCount}개 도구가 보입니다. 카테고리: ${categoryLabels[activeCategory]}${
      query ? ` · 검색어: ${searchInput.value.trim()}` : ""
    }`;
  }

  function setActiveCategory(nextCategory) {
    activeCategory = categoryLabels[nextCategory] ? nextCategory : "all";

    filterButtons.forEach((button) => {
      const isActive = (button.dataset.filter || "all") === activeCategory;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function resetFilters() {
    searchInput.value = "";
    setActiveCategory("all");
    render();
  }

  function renderRecentTool(toolId) {
    if (!recentShell || !recentLink || !recentMeta) {
      return;
    }

    const recentCard = cards.find((card) => card.id === toolId);
    if (!recentCard || !recentCard.href) {
      recentShell.hidden = true;
      recentMeta.textContent = "";
      return;
    }

    recentShell.hidden = false;
    recentLink.href = recentCard.href;
    recentLink.textContent = `최근 사용: ${recentCard.title}`;
    recentMeta.textContent = "";

    const strong = document.createElement("strong");
    strong.textContent = recentCard.cta;
    recentMeta.append(strong, ` 버튼으로 다시 들어갈 수 있습니다. ${recentCard.purpose}`);
  }

  function loadRecentTool() {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) {
        return "";
      }

      const parsed = JSON.parse(storedValue);
      return typeof parsed?.toolId === "string" ? parsed.toolId : "";
    } catch (error) {
      return "";
    }
  }

  function saveRecentTool(toolId) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          toolId,
          savedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      return;
    }
  }

  function isTypingContext(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName;
    return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  }

  function normalize(value) {
    return value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
  }
})();
