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

    const title = document.querySelector(".intro h1");
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
  setupClickWords();
  setupTypewriter();
  setupParticleLines();
})();
