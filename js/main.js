/* ============================================================
   Portfolio front-end
   Renders window.PORTFOLIO_DATA (from data.js) and wires up the
   carousels, lightbox, theme toggle, sticky header and nav.
   ============================================================ */
(function () {
  "use strict";

  var DATA = window.PORTFOLIO_DATA || { categories: [], cover: null };
  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var refreshScrollFX = null; // set by initScrollFX; lets the theme toggle recolour the bg

  /* -------------------------------------------------- utilities --- */
  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function shortLabel(name) {
    return name.replace(/\s*projects\s*/i, "").trim() || name;
  }

  /* ------------------------------------------------ theme toggle --- */
  function initTheme() {
    var root = document.documentElement;
    var toggle = document.getElementById("themeToggle");
    var stored = null;
    try {
      stored = localStorage.getItem("theme");
    } catch (e) {}

    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    apply(theme);

    if (toggle) {
      toggle.addEventListener("click", function () {
        theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        apply(theme);
        try {
          localStorage.setItem("theme", theme);
        } catch (e) {}
      });
    }

    function apply(t) {
      root.setAttribute("data-theme", t);
      if (toggle) {
        toggle.setAttribute(
          "aria-label",
          t === "dark" ? "Switch to light mode" : "Switch to dark mode"
        );
      }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t === "dark" ? "#111111" : "#f1f1f2");
      if (refreshScrollFX) refreshScrollFX(); // recolour the gradient for the new theme
    }
  }

  /* ----------------------------------------------- sticky header --- */
  function initHeader() {
    var header = document.getElementById("siteHeader");
    var hero = document.getElementById("top");
    if (!header || !hero) return;
    if (!("IntersectionObserver" in window)) {
      header.classList.add("is-visible");
      header.setAttribute("aria-hidden", "false");
      header.removeAttribute("inert");
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        var heroVisible = entries[0].isIntersecting;
        header.classList.toggle("is-visible", !heroVisible);
        header.setAttribute("aria-hidden", heroVisible ? "true" : "false");
        header.toggleAttribute("inert", heroVisible);
      },
      { threshold: 0, rootMargin: "-60px 0px 0px 0px" }
    );
    io.observe(hero);
  }

  /* --------------------------------------------------- lightbox --- */
  var Lightbox = (function () {
    var box = document.getElementById("lightbox");
    var imgEl = document.getElementById("lbImg");
    var capEl = document.getElementById("lbCaption");
    var closeBtn = document.getElementById("lbClose");
    var prevBtn = document.getElementById("lbPrev");
    var nextBtn = document.getElementById("lbNext");
    var images = [];
    var index = 0;
    var lastFocus = null;
    var isOpen = false;
    var inerted = [];

    // Hide everything except the dialog from tab order AND screen readers.
    function setBackgroundInert(on) {
      if (!box) return;
      if (on) {
        inerted = [];
        Array.prototype.forEach.call(document.body.children, function (child) {
          if (child === box || child.tagName === "SCRIPT") return;
          inerted.push({ el: child, hadInert: child.hasAttribute("inert"), hadAria: child.getAttribute("aria-hidden") });
          child.setAttribute("inert", "");
          child.setAttribute("aria-hidden", "true");
        });
      } else {
        inerted.forEach(function (rec) {
          if (!rec.hadInert) rec.el.removeAttribute("inert");
          if (rec.hadAria === null) rec.el.removeAttribute("aria-hidden");
          else rec.el.setAttribute("aria-hidden", rec.hadAria);
        });
        inerted = [];
      }
    }

    function open(imgList, startIndex) {
      if (!box) return;
      images = imgList;
      index = startIndex;
      lastFocus = document.activeElement;
      render();
      setBackgroundInert(true);
      box.hidden = false;
      void box.offsetWidth; // force reflow so the opacity transition runs
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
      isOpen = true;
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      if (!box || !isOpen) return;
      isOpen = false; // synchronously stop key/step handling during the fade
      box.classList.remove("is-open");
      document.body.style.overflow = "";
      var finished = false;
      var done = function () {
        if (finished) return;
        finished = true;
        box.hidden = true;
        box.removeEventListener("transitionend", onEnd);
        setBackgroundInert(false);
        if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === "function") {
          lastFocus.focus();
        }
      };
      var onEnd = function (e) { if (e.target === box) done(); };
      if (prefersReduced) {
        done();
      } else {
        box.addEventListener("transitionend", onEnd);
        setTimeout(done, 400); // fallback if transitionend never fires
      }
    }

    // Keep Tab focus among the visible dialog controls.
    function trapTab(e) {
      var focusables = [closeBtn, prevBtn, nextBtn].filter(function (b) {
        return b && b.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      var active = document.activeElement;
      if (focusables.indexOf(active) === -1) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }

    function render() {
      var item = images[index];
      if (!item) return;
      imgEl.setAttribute("src", item.src);
      imgEl.setAttribute("alt", item.alt || "");
      capEl.textContent = item.caption || "";
      var many = images.length > 1;
      prevBtn.style.display = many ? "" : "none";
      nextBtn.style.display = many ? "" : "none";
    }

    function step(delta) {
      if (!isOpen || !images.length) return;
      index = (index + delta + images.length) % images.length;
      render();
    }

    if (box) {
      closeBtn.addEventListener("click", close);
      prevBtn.addEventListener("click", function () { step(-1); });
      nextBtn.addEventListener("click", function () { step(1); });
      box.addEventListener("click", function (e) {
        if (e.target === box) close();
      });
      document.addEventListener("keydown", function (e) {
        if (!isOpen) return;
        if (e.key === "Escape") close();
        else if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "ArrowRight") step(1);
        else if (e.key === "Tab") trapTab(e);
      });
    }

    return { open: open };
  })();

  /* ---------------------------------------------------- carousel --- */
  function buildCarousel(images) {
    var carousel = el("div", "carousel");
    // role=group (not a tab stop); arrow-key handler lives here and receives
    // key events bubbling up from a focused slide button.
    var track = el("div", "carousel__track", { role: "group", "aria-label": "Image gallery" });

    images.forEach(function (img, i) {
      var slide = el("figure", i === 0 ? "slide is-current" : "slide");

      // A native <button> gives free Enter/Space activation and focusability.
      var frame = el("button", "slide__frame", { type: "button", "aria-label": "View image" + (img.caption ? ": " + img.caption : "") });
      var image = el("img", "slide__img", {
        src: img.src,
        alt: img.alt || "",
        loading: i === 0 ? "eager" : "lazy",
        decoding: "async",
        draggable: "false",
      });
      frame.appendChild(image);

      frame.addEventListener("click", function () {
        frame.focus(); // ensure focus returns here when the lightbox closes
        Lightbox.open(images, i);
      });
      slide.appendChild(frame);

      if (img.caption) {
        var cap = el("figcaption", "slide__caption");
        cap.textContent = img.caption;
        slide.appendChild(cap);
      }
      track.appendChild(slide);
    });

    var prev = el("button", "carousel__btn carousel__btn--prev", { type: "button", "aria-label": "Previous image" });
    prev.innerHTML = "&#8249;";
    var next = el("button", "carousel__btn carousel__btn--next", { type: "button", "aria-label": "Next image" });
    next.innerHTML = "&#8250;";

    var dots = el("div", "carousel__dots", { role: "tablist", "aria-label": "Choose image" });
    var dotEls = images.map(function (_, i) {
      var d = el("button", "dot", { type: "button", "aria-label": "Go to image " + (i + 1) });
      dots.appendChild(d);
      return d;
    });

    carousel.appendChild(prev);
    carousel.appendChild(track);
    carousel.appendChild(next);
    carousel.appendChild(dots);
    if (images.length <= 1) carousel.classList.add("is-single");

    wireCarousel(track, prev, next, dotEls);
    return carousel;
  }

  function wireCarousel(track, prev, next, dotEls) {
    function slideEls() { return track.querySelectorAll(".slide"); }

    function currentIndex() {
      var w = track.clientWidth || 1;
      return Math.max(0, Math.min(dotEls.length - 1, Math.round(track.scrollLeft / w)));
    }

    function goTo(index, smooth) {
      var sl = slideEls();
      if (!sl.length) return;
      var i = Math.max(0, Math.min(sl.length - 1, index));
      var w = track.clientWidth;
      track.scrollTo({
        left: i * w,
        behavior: smooth && !prefersReduced ? "smooth" : "auto"
      });
      update(i);
    }

    function update(forcedIndex) {
      var count = dotEls.length;
      var w = track.clientWidth || 1;
      var i = (typeof forcedIndex === "number")
        ? forcedIndex
        : Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / w)));

      prev.disabled = (i <= 0);
      next.disabled = (i >= count - 1);
      dotEls.forEach(function (d, di) {
        d.classList.toggle("is-active", di === i);
      });
      var sl = slideEls();
      for (var s = 0; s < sl.length; s++) {
        sl[s].classList.toggle("is-current", s === i);
      }
    }

    prev.addEventListener("click", function (e) {
      e.preventDefault();
      var i = currentIndex();
      if (i > 0) goTo(i - 1, true);
    });

    next.addEventListener("click", function (e) {
      e.preventDefault();
      var i = currentIndex();
      if (i < dotEls.length - 1) goTo(i + 1, true);
    });

    dotEls.forEach(function (d, di) {
      d.addEventListener("click", function (e) {
        e.preventDefault();
        goTo(di, true);
      });
    });

    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        var i = currentIndex();
        if (i > 0) goTo(i - 1, true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        var i = currentIndex();
        if (i < dotEls.length - 1) goTo(i + 1, true);
      }
    });

    var raf = null;
    track.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        update();
      });
    }, { passive: true });

    window.addEventListener("resize", function () {
      goTo(currentIndex(), false);
    });

    enableDrag(track, function () {
      goTo(currentIndex(), true);
    });

    requestAnimationFrame(function () {
      update(0);
    });
  }

  /* drag-to-scroll for mouse / trackpad (pointer events) */
  function enableDrag(track, snap) {
    var down = false, startX = 0, startScroll = 0, moved = 0;

    track.addEventListener("pointerdown", function (e) {
      moved = 0; // reset for ALL pointer types so stale drags don't block taps
      if (e.pointerType === "touch") return; // native touch scroll handles it
      down = true;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      track.classList.add("is-dragging");
    });

    track.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4 && track.hasPointerCapture && !track.hasPointerCapture(e.pointerId)) {
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
      }
      track.scrollLeft = startScroll - dx;
    });

    function end() {
      if (!down) return;
      down = false;
      track.classList.remove("is-dragging");
      if (snap) snap(); // centre the nearest slide (handles variable widths)
    }
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    // Don't end on pointerleave (kills the drag before capture is acquired);
    // instead catch a release that happens outside the track pre-capture.
    window.addEventListener("pointerup", function () { if (down) end(); });

    // prevent click-through opening the lightbox right after a drag
    track.addEventListener("click", function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* ---------------------------------------------------- rendering --- */
  function render() {
    var root = document.getElementById("projects");
    var nav = document.getElementById("navLinks");
    if (!root) return;

    var cats = (DATA.categories || []).filter(function (c) {
      return c.projects && c.projects.length;
    });

    if (!cats.length) {
      root.appendChild(renderEmptyState());
    }

    cats.forEach(function (cat) {
      var id = slugify(cat.name) || "section-" + Math.random().toString(36).slice(2);

      var section = el("section", "category", { id: id });
      var head = el("div", "category__head reveal");
      var h2 = el("h2", "category__title", { "data-parallax": "-55" });
      h2.textContent = cat.name;
      head.appendChild(h2);
      section.appendChild(head);

      var list = el("div", "projects");
      cat.projects.forEach(function (project) {
        list.appendChild(renderProject(project));
      });
      section.appendChild(list);
      root.appendChild(section);

      if (nav) {
        var link = el("a", null, { href: "#" + id });
        link.textContent = shortLabel(cat.name);
        link.dataset.target = id;
        nav.appendChild(link);
      }
    });

    // contact link in nav
    if (nav) {
      var contact = el("a", null, { href: "#contact" });
      contact.textContent = "Contact";
      nav.appendChild(contact);
    }

    initReveal();
    initScrollSpy(cats);
  }

  // Build a row of small tags. kind: "skills" | "links" | "achievements".
  function renderTags(items, kind) {
    if (!items || !items.length) return null;
    var wrap = el("div", "tags tags--" + kind);
    items.forEach(function (it) {
      var node;
      if (kind === "links") {
        if (!it || !it.url) return;
        node = el("a", "tag tag--link", { href: it.url, target: "_blank", rel: "noopener noreferrer" });
        node.textContent = it.label || it.url;
      } else {
        node = el("span", "tag " + (kind === "achievements" ? "tag--award" : "tag--skill"));
        node.textContent = it;
      }
      wrap.appendChild(node);
    });
    return wrap.children.length ? wrap : null;
  }

  function renderProject(project) {
    var article = el("article", "project reveal");

    // Left column: Project info (title, links, achievements, description, skills)
    var info = el("div", "project__info");

    var head = el("div", "project__head");
    var title = el("h3", "project__title");
    title.textContent = project.title;
    head.appendChild(title);
    if (project.company) {
      var comp = el("span", "project__company");
      comp.textContent = project.company;
      head.appendChild(comp);
    }
    info.appendChild(head);

    // Links (boxed buttons right below title)
    var links = renderTags(project.links, "links");
    if (links) info.appendChild(links);

    if (project.description) {
      var desc = el("p", "project__desc");
      desc.textContent = project.description;
      info.appendChild(desc);
    }

    // Achievements below the description, above skills
    var achievements = renderTags(project.achievements, "achievements");
    if (achievements) info.appendChild(achievements);

    // Skills below achievements
    var skills = renderTags(project.skills, "skills");
    if (skills) info.appendChild(skills);

    article.appendChild(info);

    // Right column: Images carousel
    var media = el("div", "project__media");
    media.appendChild(buildCarousel(project.images));
    article.appendChild(media);

    return article;
  }

  function renderEmptyState() {
    var wrap = el("div", "empty-state reveal");
    var h = el("h2");
    h.textContent = "No projects yet";
    var p = el("p");
    p.innerHTML =
      "Drop photos into <code>projects/&lt;Category&gt;/&lt;Project&gt;/</code> " +
      "named like <code>1_caption.jpg</code>, then run " +
      "<code>python generate_manifest.py</code> (or just push to GitHub).";
    wrap.appendChild(h);
    wrap.appendChild(p);
    return wrap;
  }

  /* --------------------------------------------- reveal on scroll --- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || prefersReduced) {
      items.forEach(function (it) { it.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach(function (it) { io.observe(it); });
  }

  /* ------------------------------------------------- nav highlight --- */
  function initScrollSpy(cats) {
    if (!("IntersectionObserver" in window) || !cats.length) return;
    var links = {};
    document.querySelectorAll("#navLinks a[data-target]").forEach(function (a) {
      links[a.dataset.target] = a;
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = links[entry.target.id];
          if (link && entry.isIntersecting) {
            Object.keys(links).forEach(function (k) {
              links[k].classList.toggle("is-active", k === entry.target.id);
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    cats.forEach(function (cat) {
      var node = document.getElementById(slugify(cat.name));
      if (node) io.observe(node);
    });
  }

  /* ------------------------------------------------- scroll FX --- */
  /* One throttled scroll handler drives:
       - the scroll-reactive grey gradient + grain (always, even reduced-motion)
       - the [data-parallax] text layers (motion only) */
  function initScrollFX() {
    var bgEl = document.querySelector(".site-bg");
    var grainEl = document.querySelector(".grain");
    var layers = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));

    var vh = window.innerHeight;
    var ticking = false;
    var lastP = -1, lastTheme = "";

    // Grey ramps: [g1, g2] gradient stops at the top vs. bottom of the page.
    var RAMP = {
      light: { top: [[244, 244, 245], [227, 227, 231]], bot: [[216, 217, 223], [196, 197, 205]] },
      dark:  { top: [[26, 26, 29], [15, 15, 17]],        bot: [[11, 11, 14], [3, 3, 5]] },
    };
    function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
    function mix(c1, c2, t) {
      return "rgb(" + lerp(c1[0], c2[0], t) + "," + lerp(c1[1], c2[1], t) + "," + lerp(c1[2], c2[2], t) + ")";
    }
    function updateBg(scrollY) {
      if (!bgEl) return;
      var docH = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      var p = Math.min(1, Math.max(0, scrollY / docH));
      var theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      if (Math.abs(p - lastP) < 0.004 && theme === lastTheme) return; // skip imperceptible changes
      lastP = p; lastTheme = theme;
      var r = RAMP[theme];
      bgEl.style.setProperty("--g1", mix(r.top[0], r.bot[0], p));
      bgEl.style.setProperty("--g2", mix(r.top[1], r.bot[1], p));
      if (grainEl) grainEl.style.opacity = (0.05 + p * 0.06).toFixed(3);
    }

    function apply() {
      ticking = false;
      var scrollY = window.scrollY || window.pageYOffset;
      updateBg(scrollY); // background colour/texture — always

      if (prefersReduced) return; // skip parallax motion
      for (var i = 0; i < layers.length; i++) {
        var node = layers[i];
        var rect = node.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue; // skip off-screen
        var speed = parseFloat(node.getAttribute("data-parallax")) || 0;
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -0.5..0.5
        node.style.transform = "translateY(" + progress * speed + "px)";
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }

    refreshScrollFX = function () { lastP = -1; apply(); }; // force recompute (theme toggle)

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      vh = window.innerHeight;
      lastP = -1;
      apply();
    }, { passive: true });
    apply();
  }

  /* ------------------------------------------- smooth scrolling --- */
  /* Lerp-based momentum scrolling for mouse/trackpad: each wheel tick adds to
     a target; the page eases toward it every frame (smooth accel/decel).
     Skipped on touch (already has native momentum) and reduced-motion. */
  function initSmoothScroll() {
    if (prefersReduced) return;
    if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;

    var doc = document.documentElement;
    doc.style.scrollBehavior = "auto"; // we drive smoothness ourselves
    var headerH = parseInt(getComputedStyle(doc).getPropertyValue("--header-h"), 10) || 64;

    var target = window.scrollY || 0;
    var current = target;
    var running = false;
    var EASE = 0.072; // lower = smoother, longer glide

    function maxScroll() { return Math.max(0, doc.scrollHeight - window.innerHeight); }
    function clamp(v) { return Math.max(0, Math.min(v, maxScroll())); }

    function frame() {
      var diff = target - current;
      if (Math.abs(diff) < 0.4) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        return;
      }
      current += diff * EASE;
      window.scrollTo(0, current);
      requestAnimationFrame(frame);
    }
    function run() { if (!running) { running = true; requestAnimationFrame(frame); } }

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return; // pinch-zoom
      if (document.body.style.overflow === "hidden") return; // modal open
      var track = e.target.closest && e.target.closest(".carousel__track");
      if (track && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // horizontal carousel scroll

      var expList = e.target.closest && e.target.closest(".exp-list");
      if (expList) {
        var canScrollUp = expList.scrollTop > 0 && e.deltaY < 0;
        var canScrollDown = expList.scrollTop + expList.clientHeight < expList.scrollHeight - 1 && e.deltaY > 0;
        if (canScrollUp || canScrollDown) return; // scroll experience list natively
      }
      e.preventDefault();
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;            // lines -> px
      else if (e.deltaMode === 2) dy *= window.innerHeight; // pages -> px
      target = clamp((running ? target : (window.scrollY || 0)) + dy);
      run();
    }, { passive: false });

    // Smooth in-page anchor links through the same engine
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href === "#") return;
      var node = document.getElementById(href.slice(1));
      if (!node) return;
      e.preventDefault();
      target = clamp(node.getBoundingClientRect().top + (window.scrollY || 0) - (headerH + 16));
      run();
    });

    // Resync if the page is scrolled by other means (keys, scrollbar) while idle
    window.addEventListener("scroll", function () {
      if (!running) { current = target = window.scrollY || 0; }
    }, { passive: true });
    window.addEventListener("resize", function () { target = clamp(target); });
  }

  /* ----------------------------------------------- intro & exp sync --- */
  function initIntro() {
    var about = document.querySelector(".intro__about");
    var exp = document.querySelector(".intro__experience");
    var text = document.getElementById("introText");
    var btn = document.getElementById("introMore");
    if (!about || !exp) return;

    var collapsedAboutHeight = 0;

    function sync(targetHeight) {
      if (window.innerWidth <= 860) {
        exp.style.height = "";
        return;
      }
      if (typeof targetHeight === "number") {
        exp.style.height = Math.round(targetHeight) + "px";
      } else {
        var h = about.offsetHeight;
        if (!text || !text.classList.contains("is-expanded")) {
          collapsedAboutHeight = h;
        }
        exp.style.height = Math.round(h) + "px";
      }
    }

    // Initial sync
    sync();
    window.addEventListener("resize", function () {
      sync();
    }, { passive: true });

    if (window.ResizeObserver) {
      var ro = new window.ResizeObserver(function () {
        if (!text || !text.classList.contains("is-expanded")) {
          sync();
        }
      });
      ro.observe(about);
    }

    if (!text || !btn) return;

    // Only collapse if the full text is actually taller than the clamp.
    text.classList.add("is-collapsible");
    var overflows = text.scrollHeight - text.clientHeight > 4;
    if (!overflows) {
      text.classList.remove("is-collapsible");
      return; // short bio — no toggle needed
    }
    btn.hidden = false;

    // Record the natural collapsed height
    collapsedAboutHeight = about.offsetHeight;
    sync();

    function expand() {
      var baseH = collapsedAboutHeight || about.offsetHeight;
      var curTextH = text.clientHeight;
      var fullTextH = text.scrollHeight;
      var delta = Math.max(0, fullTextH - curTextH);

      text.classList.add("is-expanded");
      text.style.maxHeight = fullTextH + "px";
      sync(baseH + delta);

      text.addEventListener("transitionend", function done(e) {
        if (e.propertyName !== "max-height") return;
        text.removeEventListener("transitionend", done);
        if (text.classList.contains("is-expanded")) {
          text.style.maxHeight = "none";
          sync(); // exact final measurement
        }
      });
    }

    function collapse() {
      // First cap at current scrollHeight so transition can start from it
      text.style.maxHeight = text.scrollHeight + "px";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          text.classList.remove("is-expanded");
          text.style.maxHeight = ""; // reverts to CSS max-height clamp

          // Immediately animate exp.style.height back down in sync with text!
          var targetH = collapsedAboutHeight;
          if (!targetH || targetH <= 0) {
            var lineHeight = parseFloat(window.getComputedStyle(text).lineHeight) || 24;
            var clampH = lineHeight * 5;
            targetH = Math.max(120, about.offsetHeight - (text.scrollHeight - clampH));
          }
          sync(targetH);
        });
      });

      text.addEventListener("transitionend", function done(e) {
        if (e.propertyName !== "max-height") return;
        text.removeEventListener("transitionend", done);
        if (!text.classList.contains("is-expanded")) {
          sync(); // exact final measurement once collapsed
        }
      });
    }

    function setLabel(str) {
      // keep the CSS ::after arrow intact — only swap the leading text node
      if (btn.childNodes.length && btn.childNodes[0].nodeType === 3) {
        btn.childNodes[0].nodeValue = str;
      } else {
        btn.textContent = str;
      }
    }

    btn.addEventListener("click", function () {
      if (text.classList.contains("is-expanded")) {
        collapse();
        btn.setAttribute("aria-expanded", "false");
        setLabel("Read more");
      } else {
        expand();
        btn.setAttribute("aria-expanded", "true");
        setLabel("Read less");
      }
    });
  }

  function renderExperience(items) {
    if (!items || !items.length) return;
    var list = document.querySelector(".exp-list");
    if (!list) return;

    list.innerHTML = "";
    items.forEach(function (it) {
      var item = el("div", "exp-item");
      var top = el("div", "exp-item__top");
      var name = el("span", "exp-item__name");
      name.textContent = it.company;
      top.appendChild(name);

      if (it.date) {
        var date = el("span", "exp-item__date");
        date.textContent = it.date;
        top.appendChild(date);
      }
      item.appendChild(top);

      if (it.role) {
        var role = el("div", "exp-item__role");
        role.textContent = it.role;
        item.appendChild(role);
      }

      if (it.description) {
        var desc = el("p", "exp-item__desc");
        desc.textContent = it.description;
        item.appendChild(desc);
      }

      list.appendChild(item);
    });
  }

  /* ------------------------------------------------------- start --- */
  function start() {
    var yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();

    // optional: use generated cover if present and the file exists
    if (DATA.cover) {
      var heroImg = document.querySelector(".hero__img");
      if (heroImg) heroImg.setAttribute("src", DATA.cover);
    }

    initTheme();
    initHeader();
    if (DATA.experience && DATA.experience.length) {
      renderExperience(DATA.experience);
    }
    render();
    initIntro();
    initScrollFX(); // after render so dynamically-built [data-parallax] titles are picked up
    initSmoothScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
