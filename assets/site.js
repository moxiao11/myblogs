(function () {
  const input = document.querySelector("[data-search]");
  const list = document.querySelector("[data-post-list]");
  const empty = document.querySelector("[data-empty]");

  if (!input || !list) {
    return;
  }

  const cards = Array.from(list.querySelectorAll("[data-post-card]"));

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    for (const card of cards) {
      const haystack = card.getAttribute("data-search-text") || "";
      const matched = !query || haystack.includes(query);
      card.hidden = !matched;
      if (matched) {
        visible += 1;
      }
    }

    if (empty) {
      empty.hidden = visible !== 0;
    }
  });
})();
