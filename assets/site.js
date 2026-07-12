(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupSearch() {
    const input = document.querySelector("[data-search]");
    const empty = document.querySelector("[data-empty]");

    if (!input) {
      return;
    }

    const cards = Array.from(document.querySelectorAll("[data-search-item]"));

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

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.focus();
        input.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const explanationLine = answerLine.nextElementSibling?.classList.contains("explanation-line") ? answerLine.nextElementSibling : null;
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
      const answerStack = document.createElement("div");
      const isMultiple = correct.length > 1;

      answerStack.className = "qa-answer-stack";
      answerStack.hidden = true;
      answerLine.hidden = false;
      answerStack.appendChild(answerLine);
      if (explanationLine) {
        explanationLine.hidden = false;
        answerStack.appendChild(explanationLine);
      }
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
      card.append(controls, answerStack);

      const clearResult = () => {
        card.classList.remove("quiz-correct", "quiz-wrong", "answer-revealed");
        answerStack.hidden = true;
        reveal.textContent = "显示答案";
        status.textContent = "";
        for (const option of options) {
          option.classList.remove("is-selected", "is-correct-option", "is-wrong-option");
          option.setAttribute("aria-pressed", "false");
        }
      };

      const showAnswer = () => {
        answerStack.hidden = false;
        reveal.textContent = explanationLine ? "收起答案与解析" : "收起答案";
        card.classList.add("answer-revealed");
        for (const option of options) {
          if (correct.includes(option.dataset.option)) {
            option.classList.add("is-correct-option");
          }
        }
        if (window.MathJax?.typesetPromise) {
          window.MathJax.typesetPromise([answerStack]).catch(() => {});
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
            answerStack.hidden = true;
            reveal.textContent = "显示答案";
            for (const current of options) {
              current.classList.remove("is-correct-option", "is-wrong-option");
            }
            status.textContent = `已选择 ${selectedOptions(options).join("、") || "无"}`;
          } else {
            card.classList.remove("quiz-correct", "quiz-wrong");
            answerStack.hidden = true;
            reveal.textContent = "显示答案";
            status.textContent = `已选择 ${selectedOptions(options).join("、") || "无"}`;
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
        if (!answerStack.hidden) {
          answerStack.hidden = true;
          card.classList.remove("answer-revealed");
          reveal.textContent = "显示答案";
          status.textContent = "";
          return;
        }
        showAnswer();
        status.textContent = options.length ? "已显示正确答案" : "";
      });
      reset.addEventListener("click", clearResult);
    }
  }

  function setupInlineAnswerInteractions() {
    if (!document.body.classList.contains("inline-answers")) {
      return;
    }

    for (const answerLine of document.querySelectorAll(".answer-line")) {
      if (answerLine.closest(".qa-card")) {
        continue;
      }
      const explanationLine = answerLine.nextElementSibling?.classList.contains("explanation-line") ? answerLine.nextElementSibling : null;
      const controls = document.createElement("div");
      const reveal = document.createElement("button");

      answerLine.hidden = true;
      if (explanationLine) {
        explanationLine.hidden = true;
      }

      controls.className = "quiz-controls inline-answer-controls";
      reveal.className = "quiz-button quiz-button-secondary";
      reveal.type = "button";
      reveal.textContent = "显示答案与解析";
      controls.appendChild(reveal);
      answerLine.before(controls);

      reveal.addEventListener("click", () => {
        const revealed = !answerLine.hidden;
        answerLine.hidden = revealed;
        if (explanationLine) {
          explanationLine.hidden = revealed;
        }
        reveal.textContent = revealed ? "显示答案与解析" : "收起答案与解析";
        if (!revealed && window.MathJax?.typesetPromise) {
          window.MathJax.typesetPromise([answerLine, explanationLine].filter(Boolean)).catch(() => {});
        }
      });
    }
  }

  function setupChallengeMode() {
    const startButton = document.querySelector("[data-challenge-start]");
    const cards = Array.from(document.querySelectorAll(".qa-card"));
    if (!startButton || !cards.length) {
      return;
    }

    const answerPattern = /(?:^|[，,、\s：:])([A-D])(?=（|\(|$|[，,、\s])/g;
    const normalizeAnswer = (value) => {
      return String(value)
        .trim()
        .replace(/[，,、；;]+/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase();
    };
    const uniqueSorted = (values) => {
      return values.filter((value, index, all) => value && all.indexOf(value) === index).sort();
    };
    const sameOptions = (left, right) => {
      return left.length === right.length && left.every((value, index) => value === right[index]);
    };
    const splitFillAnswers = (answerText, blankCount) => {
      const tokens = answerText.split(/\s+/).map((item) => item.trim()).filter(Boolean);
      if (blankCount > 1 && tokens.length === blankCount) {
        return tokens;
      }
      if (tokens.length > 1 && tokens.every((token) => token.length <= 2)) {
        return tokens;
      }
      return [answerText.trim()];
    };
    const challengePromptHtml = (card) => {
      const clone = card.cloneNode(true);
      clone.querySelector(".question-title")?.remove();
      clone.querySelector(".quiz-controls")?.remove();
      clone.querySelector(".qa-answer-stack")?.remove();
      clone.querySelector("[data-knowledge-card]")?.remove();
      for (const option of clone.querySelectorAll("[data-option]")) {
        const list = option.closest(".option-list");
        if (list) {
          list.remove();
        }
      }
      return clone.innerHTML.trim();
    };
    const typesetChallenge = () => {
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([overlay]).catch(() => {});
      }
    };

    const questions = cards.map((card, index) => {
      const answerLine = card.querySelector(".qa-answer-stack .answer-line")
        || (card.nextElementSibling?.classList.contains("answer-line") ? card.nextElementSibling : null);
      const answerText = answerLine ? answerLine.textContent.replace(/^答案[:：]\s*/, "").trim() : "";
      const options = Array.from(card.querySelectorAll("[data-option]")).map((option) => ({
        key: option.dataset.option,
        text: option.textContent.trim()
      }));
      const correctOptions = uniqueSorted([...answerText.matchAll(answerPattern)].map((match) => match[1]));
      const title = card.querySelector(".question-title")?.textContent.trim() || `题目 ${index + 1}`;
      const promptHtml = challengePromptHtml(card);
      const blankCount = Math.max(1, card.querySelectorAll(".blank-line").length || (promptHtml.match(/_{2,}/g) || []).length);
      return {
        answerText,
        blankCount,
        correctOptions,
        fillAnswers: splitFillAnswers(answerText, blankCount),
        index,
        options,
        promptHtml,
        title,
        type: options.length ? "choice" : "fill"
      };
    });

    let order = [];
    let currentIndex = 0;
    let score = 0;
    let wrongCount = 0;
    let answered = false;
    let currentQuestion = null;
    let selected = [];

    const overlay = document.createElement("div");
    overlay.className = "challenge-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="challenge-panel" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
        <button class="challenge-close" data-challenge-close type="button" aria-label="关闭">×</button>
        <div class="challenge-head">
          <div>
            <span class="challenge-kicker">一站到底</span>
            <h2 id="challenge-title">随机刷题</h2>
          </div>
          <div class="challenge-meta" aria-live="polite">
            <span class="challenge-progress" data-challenge-progress></span>
            <span class="challenge-score" data-challenge-score></span>
          </div>
        </div>
        <div class="challenge-body" data-challenge-body></div>
        <div class="challenge-result" data-challenge-result aria-live="polite"></div>
        <div class="challenge-actions">
          <button class="quiz-button" data-challenge-confirm type="button">确认</button>
          <button class="quiz-button quiz-button-secondary" data-challenge-next type="button" hidden>下一题</button>
          <button class="quiz-button quiz-button-secondary" data-challenge-restart type="button" hidden>重新开始</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    const body = overlay.querySelector("[data-challenge-body]");
    const result = overlay.querySelector("[data-challenge-result]");
    const progress = overlay.querySelector("[data-challenge-progress]");
    const scoreBoard = overlay.querySelector("[data-challenge-score]");
    const confirmButton = overlay.querySelector("[data-challenge-confirm]");
    const nextButton = overlay.querySelector("[data-challenge-next]");
    const restartButton = overlay.querySelector("[data-challenge-restart]");
    const closeButton = overlay.querySelector("[data-challenge-close]");

    const shuffle = (items) => {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
      }
      return copy;
    };

    const open = () => {
      order = shuffle(questions);
      currentIndex = 0;
      score = 0;
      wrongCount = 0;
      overlay.hidden = false;
      document.body.classList.add("challenge-open");
      renderQuestion();
    };

    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove("challenge-open");
    };

    const optionButton = (option) => {
      return `<button class="challenge-option" data-challenge-option="${option.key}" type="button"><strong>${option.key}.</strong> ${option.text}</button>`;
    };

    const fillInput = (_answer, index) => {
      return `<label class="challenge-fill"><span>第 ${index + 1} 空</span><input data-challenge-fill="${index}" type="text" autocomplete="off"></label>`;
    };

    const updateScoreBoard = () => {
      scoreBoard.textContent = `答对 ${score} 题 · 答错 ${wrongCount} 题`;
    };

    const renderQuestion = () => {
      answered = false;
      selected = [];
      currentQuestion = order[currentIndex];
      progress.textContent = `${currentIndex + 1} / ${order.length}`;
      updateScoreBoard();
      result.textContent = "";
      result.className = "challenge-result";
      confirmButton.hidden = false;
      nextButton.hidden = true;
      restartButton.hidden = true;
      confirmButton.textContent = "确认";

      if (currentQuestion.type === "choice") {
        const multiple = currentQuestion.correctOptions.length > 1;
        body.innerHTML = `
          <p class="challenge-question-title">${currentQuestion.title}</p>
          <div class="challenge-question">${currentQuestion.promptHtml}</div>
          <p class="challenge-hint">${multiple ? "多选题：可选择多个选项" : "选择一个选项"}</p>
          <div class="challenge-options">${currentQuestion.options.map(optionButton).join("")}</div>
        `;
      } else {
        body.innerHTML = `
          <p class="challenge-question-title">${currentQuestion.title}</p>
          <div class="challenge-question">${currentQuestion.promptHtml}</div>
          <p class="challenge-hint">填空题：按空填写，大小写不敏感</p>
          <div class="challenge-fills">${currentQuestion.fillAnswers.map(fillInput).join("")}</div>
        `;
      }
      typesetChallenge();
    };

    const showResult = (isCorrect, detail) => {
      answered = true;
      if (isCorrect) {
        score += 1;
      } else {
        wrongCount += 1;
      }
      updateScoreBoard();
      result.className = `challenge-result ${isCorrect ? "is-correct" : "is-wrong"}`;
      result.innerHTML = `<strong>${isCorrect ? "回答正确" : "回答错误"}</strong><span>${detail}</span><span>标准答案：${currentQuestion.answerText}</span>`;
      confirmButton.hidden = true;
      nextButton.hidden = false;
      nextButton.textContent = currentIndex + 1 >= order.length ? "查看成绩" : "下一题";
      typesetChallenge();
    };

    const confirmChoice = () => {
      if (!selected.length) {
        result.className = "challenge-result is-wrong";
        result.textContent = "请选择选项";
        return;
      }
      const userAnswer = uniqueSorted(selected);
      const isCorrect = sameOptions(userAnswer, currentQuestion.correctOptions);
      showResult(isCorrect, `你的答案：${userAnswer.join("、")}`);
      for (const option of overlay.querySelectorAll("[data-challenge-option]")) {
        const key = option.dataset.challengeOption;
        option.classList.toggle("is-correct-option", currentQuestion.correctOptions.includes(key));
        option.classList.toggle("is-wrong-option", userAnswer.includes(key) && !currentQuestion.correctOptions.includes(key));
      }
    };

    const confirmFill = () => {
      const inputs = Array.from(overlay.querySelectorAll("[data-challenge-fill]"));
      const userAnswers = inputs.map((input) => input.value.trim());
      if (userAnswers.some((value) => !value)) {
        result.className = "challenge-result is-wrong";
        result.textContent = "请先填完所有空";
        return;
      }
      const expected = currentQuestion.fillAnswers.map(normalizeAnswer);
      const actual = userAnswers.map(normalizeAnswer);
      const isCorrect = sameOptions(actual, expected);
      showResult(isCorrect, `你的答案：${userAnswers.join(" / ")}`);
      inputs.forEach((input, index) => {
        input.classList.toggle("is-correct-fill", normalizeAnswer(input.value) === expected[index]);
        input.classList.toggle("is-wrong-fill", normalizeAnswer(input.value) !== expected[index]);
      });
    };

    const showScore = () => {
      currentQuestion = null;
      progress.textContent = `${order.length} / ${order.length}`;
      updateScoreBoard();
      body.innerHTML = `<div class="challenge-finish"><strong>完成！</strong><span>本轮一共答对 ${score} 题，答错 ${wrongCount} 题</span><span>总题数：${order.length} 题</span></div>`;
      result.textContent = "";
      result.className = "challenge-result";
      confirmButton.hidden = true;
      nextButton.hidden = true;
      restartButton.hidden = false;
    };

    startButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        close();
      }
    });
    body.addEventListener("click", (event) => {
      const option = event.target.closest("[data-challenge-option]");
      if (!option || answered || currentQuestion?.type !== "choice") {
        return;
      }
      const key = option.dataset.challengeOption;
      const multiple = currentQuestion.correctOptions.length > 1;
      if (!multiple) {
        for (const button of body.querySelectorAll("[data-challenge-option]")) {
          button.classList.remove("is-selected");
        }
        selected = [key];
        option.classList.add("is-selected");
        return;
      }
      option.classList.toggle("is-selected");
      selected = Array.from(body.querySelectorAll(".is-selected")).map((button) => button.dataset.challengeOption);
    });
    confirmButton.addEventListener("click", () => {
      if (!currentQuestion || answered) {
        return;
      }
      if (currentQuestion.type === "choice") {
        confirmChoice();
      } else {
        confirmFill();
      }
    });
    nextButton.addEventListener("click", () => {
      currentIndex += 1;
      if (currentIndex >= order.length) {
        showScore();
      } else {
        renderQuestion();
      }
    });
    restartButton.addEventListener("click", open);
  }

  function setupClickWords() {
    if (prefersReducedMotion) {
      return;
    }

    const words = ["课程", "知识", "LaTeX", "数学", "算法", "复习", "思考"];
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
    if (!title || title.dataset.typed === "true" || title.children.length) {
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
  setupInlineAnswerInteractions();
  setupChallengeMode();
  setupClickWords();
  setupTypewriter();
  setupParticleLines();
})();
