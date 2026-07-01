(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupSearch() {
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
  }

  function setupDrawer() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const closeButtons = Array.from(document.querySelectorAll("[data-menu-close]"));
    const backdrop = document.querySelector(".drawer-backdrop");
    const drawer = document.querySelector(".site-drawer");

    if (!toggle || !drawer || !backdrop) {
      return;
    }

    const setOpen = (open) => {
      document.body.classList.toggle("drawer-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      drawer.setAttribute("aria-hidden", String(!open));
      backdrop.hidden = !open;
    };

    toggle.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("drawer-open"));
    });

    for (const button of closeButtons) {
      button.addEventListener("click", () => setOpen(false));
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    });
  }

  function setupThemeSwitch() {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) {
      return;
    }

    toggle.addEventListener("click", () => {
      document.body.classList.toggle("theme-dim");
    });
  }

  function setupDrawerSearch() {
    const drawerInput = document.querySelector("[data-drawer-search]");
    const pageInput = document.querySelector("[data-search]");

    if (!drawerInput || !pageInput) {
      return;
    }

    drawerInput.addEventListener("input", () => {
      pageInput.value = drawerInput.value;
      pageInput.dispatchEvent(new Event("input"));
      document.querySelector("#posts")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function setupCalendar() {
    const mount = document.querySelector("[data-calendar]");
    if (!mount) {
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = first.getDay();
    const labels = ["日", "一", "二", "三", "四", "五", "六"];
    const cells = [];

    for (const label of labels) {
      cells.push(`<strong>${label}</strong>`);
    }
    for (let index = 0; index < offset; index += 1) {
      cells.push("<span></span>");
    }
    for (let day = 1; day <= days; day += 1) {
      const className = day === now.getDate() ? "calendar-today" : "";
      cells.push(`<span class="${className}">${day}</span>`);
    }

    mount.innerHTML = `
      <div class="calendar-head"><span>‹</span><strong>${year}年${month + 1}月</strong><span>›</span></div>
      <div class="calendar-grid">${cells.join("")}</div>
    `;
  }

  function setupQuizInteractions() {
    const cards = Array.from(document.querySelectorAll(".qa-card"));
    if (!cards.length) {
      return;
    }

    const answerPattern = /(?:^|[，,、\s：:])([A-D])(?=（|\(|$|[，,、\s])/g;

    const selectedOptions = (options) => {
      return options
        .filter((option) => option.classList.contains("is-selected"))
        .map((option) => option.dataset.option)
        .filter(Boolean)
        .sort();
    };

    const sameOptions = (left, right) => {
      return left.length === right.length && left.every((value, index) => value === right[index]);
    };

    for (const card of cards) {
      const answerLine = card.nextElementSibling?.classList.contains("answer-line") ? card.nextElementSibling : null;
      if (!answerLine) {
        continue;
      }

      const answerText = answerLine.textContent.replace(/^答案[:：]\s*/, "").trim();
      const correct = [...answerText.matchAll(answerPattern)]
        .map((match) => match[1])
        .filter((value, index, all) => all.indexOf(value) === index)
        .sort();
      const options = Array.from(card.querySelectorAll("[data-option]"));
      const controls = document.createElement("div");
      const status = document.createElement("p");
      const submit = document.createElement("button");
      const reveal = document.createElement("button");
      const reset = document.createElement("button");
      const isMultiple = correct.length > 1;

      answerLine.hidden = true;
      card.classList.add("is-interactive");
      status.className = "quiz-status";
      status.setAttribute("aria-live", "polite");
      submit.className = "quiz-button";
      submit.type = "button";
      submit.textContent = "提交答案";
      submit.hidden = !isMultiple || !options.length;
      reveal.className = "quiz-button quiz-button-secondary";
      reveal.type = "button";
      reveal.textContent = options.length ? "显示答案" : "显示答案";
      reset.className = "quiz-button quiz-button-secondary";
      reset.type = "button";
      reset.textContent = "重做";
      reset.hidden = !options.length;
      controls.className = "quiz-controls";
      controls.append(submit, reveal, reset, status);
      card.appendChild(controls);

      const clearResult = () => {
        card.classList.remove("quiz-correct", "quiz-wrong", "answer-revealed");
        answerLine.hidden = true;
        status.textContent = "";
        for (const option of options) {
          option.classList.remove("is-selected", "is-correct-option", "is-wrong-option");
          option.setAttribute("aria-pressed", "false");
        }
      };

      const showAnswer = () => {
        answerLine.hidden = false;
        card.classList.add("answer-revealed");
        for (const option of options) {
          if (correct.includes(option.dataset.option)) {
            option.classList.add("is-correct-option");
          }
        }
      };

      const evaluate = () => {
        const selected = selectedOptions(options);
        if (options.length && selected.length === 0) {
          status.textContent = "请选择选项";
          return;
        }

        const isCorrect = sameOptions(selected, correct);
        card.classList.toggle("quiz-correct", isCorrect);
        card.classList.toggle("quiz-wrong", !isCorrect);
        showAnswer();

        for (const option of options) {
          const optionName = option.dataset.option;
          option.classList.toggle("is-correct-option", correct.includes(optionName));
          option.classList.toggle("is-wrong-option", selected.includes(optionName) && !correct.includes(optionName));
        }

        status.textContent = isCorrect ? "回答正确" : "回答错误";
      };

      for (const option of options) {
        option.setAttribute("role", "button");
        option.setAttribute("aria-pressed", "false");
        option.addEventListener("click", () => {
          if (!isMultiple) {
            for (const other of options) {
              other.classList.remove("is-selected", "is-correct-option", "is-wrong-option");
              other.setAttribute("aria-pressed", "false");
            }
          }

          option.classList.toggle("is-selected");
          option.setAttribute("aria-pressed", String(option.classList.contains("is-selected")));

          if (isMultiple) {
            card.classList.remove("quiz-correct", "quiz-wrong");
            answerLine.hidden = true;
            for (const current of options) {
              current.classList.remove("is-correct-option", "is-wrong-option");
            }
            status.textContent = `已选择 ${selectedOptions(options).join("、") || "无"}`;
          } else {
            evaluate();
          }
        });
        option.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            option.click();
          }
        });
      }

      submit.addEventListener("click", evaluate);
      reveal.addEventListener("click", () => {
        showAnswer();
        status.textContent = options.length ? "已显示正确答案" : "";
      });
      reset.addEventListener("click", clearResult);
    }
  }

  function setupClickWords() {
    if (prefersReducedMotion) {
      return;
    }

    const words = ["Crystal", "Sky", "LaTeX", "数学", "算法", "热爱", "写作"];
    const colors = ["#2563eb", "#0d9488", "#e14d5a", "#c47f12", "#7c3aed"];
    let index = 0;

    document.addEventListener("click", (event) => {
      const word = document.createElement("span");
      word.className = "click-word";
      word.textContent = words[index % words.length];
      word.style.left = `${event.clientX}px`;
      word.style.top = `${event.clientY}px`;
      word.style.color = colors[index % colors.length];
      document.body.appendChild(word);
      index += 1;
      window.setTimeout(() => word.remove(), 1300);
    });
  }

  function setupTypewriter() {
    if (prefersReducedMotion) {
      return;
    }

    const title = document.querySelector(".home-hero h1");
    if (!title || title.dataset.typed === "true") {
      return;
    }

    const text = title.textContent.trim();
    if (!text) {
      return;
    }

    title.dataset.typed = "true";
    title.textContent = "";
    title.classList.add("typewriter-cursor");

    let index = 0;
    const timer = window.setInterval(() => {
      title.textContent = text.slice(0, index + 1);
      index += 1;
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 95);
  }

  function setupParticleLines() {
    if (prefersReducedMotion) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.id = "particle-line-bg";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);

    const context = canvas.getContext("2d");
    const particles = [];
    const pointer = { active: false, x: 0, y: 0 };
    const palette = ["#2563eb", "#0d9488", "#e14d5a"];
    let width = 0;
    let height = 0;
    let particleCount = 0;

    function resize() {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      particleCount = Math.max(28, Math.min(82, Math.floor((width * height) / 17000)));
      while (particles.length < particleCount) {
        particles.push({
          color: palette[particles.length % palette.length],
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          x: Math.random() * width,
          y: Math.random() * height
        });
      }
      particles.length = particleCount;
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -1;
        }
        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -1;
        }

        context.beginPath();
        context.fillStyle = particle.color;
        context.globalAlpha = 0.5;
        context.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        context.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const first = particles[i];
          const second = particles[j];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance < 130) {
            context.beginPath();
            context.strokeStyle = "#2563eb";
            context.globalAlpha = (1 - distance / 130) * 0.22;
            context.moveTo(first.x, first.y);
            context.lineTo(second.x, second.y);
            context.stroke();
          }
        }
      }

      if (pointer.active) {
        for (const particle of particles) {
          const distance = Math.hypot(particle.x - pointer.x, particle.y - pointer.y);
          if (distance < 170) {
            context.beginPath();
            context.strokeStyle = "#0d9488";
            context.globalAlpha = (1 - distance / 170) * 0.32;
            context.moveTo(particle.x, particle.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
          }
        }
      }

      context.globalAlpha = 1;
      window.requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (event) => {
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    });
    window.addEventListener("mouseleave", () => {
      pointer.active = false;
    });

    resize();
    draw();
  }

  setupSearch();
  setupDrawer();
  setupThemeSwitch();
  setupDrawerSearch();
  setupCalendar();
  setupQuizInteractions();
  setupClickWords();
  setupTypewriter();
  setupParticleLines();
})();
