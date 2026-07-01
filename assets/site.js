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

    const knowledgeFor = (card, answerText) => {
      const title = card.querySelector(".question-title")?.textContent.trim() || "这道题";
      const optionText = Array.from(card.querySelectorAll("[data-option]")).map((option) => option.textContent.trim()).join(" ");
      const text = `${title} ${optionText} ${answerText}`;
      const rules = [
        [/set|list|tuple|dict|数据结构|重复元素|可变的数据类型/i, ["Python 数据结构", "set 用来表示无重复集合；list 保持顺序且可重复；tuple 通常不可变；dict 通过键值对保存数据，键不能重复。"]],
        [/PWM|占空比|频率|高电平|低电平/i, ["PWM 参数", "PWM 重点看周期、频率和占空比。占空比是高电平时间占整个周期的比例，频率是周期的倒数。"]],
        [/I2C|SDA|SCL|PCF8591|A\/D|D\/A|总线/i, ["I2C 与模数转换", "I2C 常用 SDA 传数据、SCL 传时钟。PCF8591 通过 I2C 完成 A/D、D/A 转换，地址和控制字是常考点。"]],
        [/GPIO|树莓派|BOARD|BCM|40Pin|PUD|TTL/i, ["树莓派 GPIO", "GPIO 是通用输入输出接口。树莓派常见编码有 BOARD 和 BCM，设置输入、输出、上下拉时要注意参数含义。"]],
        [/DHT11|1-Wire|单总线/i, ["传感器接口", "DHT11 使用单总线类数据接口。传感器题通常先判断接口类型，再看数据方向和电平特点。"]],
        [/MPU6050|Gyroscope|Accelerator|姿态|陀螺仪/i, ["姿态传感器", "MPU6050 中陀螺仪用于角速度，加速度计用于线加速度；姿态解算通常要融合多类传感数据。"]],
        [/OpenCV|cv2|imutils|图像|rotate|translate|人脸检测/i, ["图像处理", "OpenCV 和 imutils 题要抓函数名语义：translate 是平移，rotate/rotate_bound 是旋转，inRange 常用于阈值筛选。"]],
        [/return|函数|class|range|标识符|注释|argparse|numpy|Python/i, ["Python 基础", "Python 题通常考语法边界和内置规则。遇到代码题时先看表达式求值顺序，再看返回值或对象类型。"]],
        [/焊|SMT|回流焊|润湿|刮板|AOI|贴片|电烙铁/i, ["电子工艺", "焊接与 SMT 题常围绕工艺流程、温度、润湿角和检测流程。记流程顺序比死记单个词更稳。"]],
        [/电阻|电容|二极管|LED|肖特基|电感/i, ["基础元器件", "元器件题先判断单位、极性、作用和典型应用。二极管与 LED 还要注意导通条件和限流保护。"]],
        [/传感器|压电|热敏|光敏|湿度|超声波/i, ["传感器原理", "传感器题要把被测物理量、转换效应和输出信号对应起来，例如压电效应用于力或振动到电信号的转换。"]],
        [/MQTT|阿里云|物联网|三元组|网络模型/i, ["物联网通信", "物联网题常考层次模型、设备三元组和通信协议。MQTT 采用发布/订阅机制，适合轻量级消息传输。"]]
      ];
      const matched = rules.find(([pattern]) => pattern.test(text));
      if (matched) {
        return matched[1];
      }
      return ["知识点提示", "这题的核心是把题干关键词和标准答案建立对应关系。复盘时可以把易混概念单独整理成一行对照。"];
    };

    const removeKnowledge = (card) => {
      card.querySelector("[data-knowledge-card]")?.remove();
      card.classList.remove("has-knowledge-card");
    };

    const showKnowledge = (card, answerText, explanationText = "") => {
      removeKnowledge(card);
      const [heading, description] = explanationText ? ["题目解析", explanationText] : knowledgeFor(card, answerText);
      const note = document.createElement("aside");
      note.className = "knowledge-card";
      note.dataset.knowledgeCard = "true";
      note.innerHTML = `<span>知识点</span><strong>${heading}</strong><p>${description}</p>`;
      card.appendChild(note);
      card.classList.add("has-knowledge-card");
    };

    for (const card of cards) {
      const answerLine = card.nextElementSibling?.classList.contains("answer-line") ? card.nextElementSibling : null;
      if (!answerLine) {
        continue;
      }

      const answerText = answerLine.textContent.replace(/^答案[:：]\s*/, "").trim();
      const explanationLine = answerLine.nextElementSibling?.classList.contains("explanation-line") ? answerLine.nextElementSibling : null;
      const explanationText = explanationLine ? explanationLine.textContent.replace(/^解析[:：]\s*/, "").trim() : "";
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
      if (explanationLine) {
        explanationLine.hidden = true;
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
      card.appendChild(controls);

      const clearResult = () => {
        card.classList.remove("quiz-correct", "quiz-wrong", "answer-revealed");
        answerLine.hidden = true;
        if (explanationLine) {
          explanationLine.hidden = true;
        }
        status.textContent = "";
        removeKnowledge(card);
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
        showKnowledge(card, answerText, explanationText);
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
            removeKnowledge(card);
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

    const questions = cards.map((card, index) => {
      const answerLine = card.nextElementSibling?.classList.contains("answer-line") ? card.nextElementSibling : null;
      const answerText = answerLine ? answerLine.textContent.replace(/^答案[:：]\s*/, "").trim() : "";
      const options = Array.from(card.querySelectorAll("[data-option]")).map((option) => ({
        key: option.dataset.option,
        text: option.textContent.trim()
      }));
      const correctOptions = uniqueSorted([...answerText.matchAll(answerPattern)].map((match) => match[1]));
      const title = card.querySelector(".question-title")?.textContent.trim() || `题目 ${index + 1}`;
      const blankCount = Math.max(1, (title.match(/_{2,}/g) || []).length);
      return {
        answerText,
        blankCount,
        correctOptions,
        fillAnswers: splitFillAnswers(answerText, blankCount),
        index,
        options,
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
          <p class="challenge-question">${currentQuestion.title}</p>
          <p class="challenge-hint">${multiple ? "多选题：可选择多个选项" : "选择一个选项"}</p>
          <div class="challenge-options">${currentQuestion.options.map(optionButton).join("")}</div>
        `;
      } else {
        body.innerHTML = `
          <p class="challenge-question">${currentQuestion.title}</p>
          <p class="challenge-hint">填空题：按空填写，大小写不敏感</p>
          <div class="challenge-fills">${currentQuestion.fillAnswers.map(fillInput).join("")}</div>
        `;
      }
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
  setupChallengeMode();
  setupClickWords();
  setupTypewriter();
  setupParticleLines();
})();
