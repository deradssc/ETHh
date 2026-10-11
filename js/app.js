/* ETHsliv — логика сайта (разделы, чтение, тема). Тексты лежат в index.html. */
(function () {
  'use strict';

  /* Список разделов и их порядок на главной.
     id — латиницей, он же используется в data-section в index.html. */
  var SECTIONS = [
    { id: 'instagram', title: 'Instagram' },
    { id: 'instagram-web', title: 'Instagram WEB' },
    { id: 'tiktok', title: 'TikTok' },
    { id: 'youtube', title: 'YouTube' },
    { id: 'facebook', title: 'Facebook' },
    { id: 'other', title: 'Остальное' },
    { id: 'discord', title: 'Discord' },
    { id: 'pinterest', title: 'Pinterest' },
    { id: 'bluesky', title: 'Bluesky' },
    { id: 'reddit', title: 'Reddit' },
    { id: 'xiaohongshu', title: '小红书' },
    { id: 'lendy', title: 'Ленды' }
  ];

  var root = document.documentElement;
  var body = document.body;
  var main = document.getElementById('main');
  var header = document.getElementById('site-header');
  var railWrap = document.getElementById('rail-wrap');
  var rail = document.getElementById('rail');
  var progressBar = document.getElementById('progress-bar');
  var themeBtn = document.getElementById('theme-toggle');
  var metaTheme = document.querySelector('meta[name="theme-color"]');
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var uid = 0;
  var currentSearch = null;

  /* ---------- Помощники ---------- */

  function el(tag, props, kids) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function countLabel(n) {
    return n + ' ' + plural(n, 'текст', 'текста', 'текстов');
  }

  function readMinutes(text) {
    var words = (text.match(/\S+/g) || []).length;
    var cjk = (text.match(/[㐀-鿿豈-﫿]/g) || []).length;
    return Math.max(1, Math.round((words + cjk / 2) / 190));
  }

  function load(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  /* ---------- Чтение текстов из index.html ---------- */

  function readEntries() {
    var out = {};
    var nodes = document.querySelectorAll('script.entry[data-section]');
    Array.prototype.forEach.call(nodes, function (n) {
      var id = n.getAttribute('data-section');
      var raw = (n.textContent || '').replace(/\r\n?/g, '\n').trim();
      if (!raw) return;
      var lines = raw.split('\n');
      var title = lines.shift().trim();
      var text = lines.join('\n').trim();
      if (!text) {
        text = title;
        if (title.length > 70) title = title.slice(0, 67).trim() + '…';
      }
      (out[id] = out[id] || []).push({
        title: title,
        text: text,
        min: readMinutes(text),
        hay: (title + ' ' + text).toLowerCase()
      });
    });
    return out;
  }

  var entriesBySection = readEntries();

  Object.keys(entriesBySection).forEach(function (id) {
    var known = SECTIONS.some(function (s) { return s.id === id; });
    if (!known && window.console) console.warn('ETHsliv: неизвестный раздел в data-section: "' + id + '"');
  });

  /* ---------- Размер текста для чтения ---------- */

  var SIZES = [0.95, 1.0625, 1.1875, 1.3125];
  var sizeIdx = 1;

  (function () {
    var s = parseInt(load('ethsliv-size'), 10);
    if (s >= 0 && s < SIZES.length) sizeIdx = s;
    applySize();
  })();

  function applySize() {
    root.style.setProperty('--read-size', SIZES[sizeIdx] + 'rem');
  }

  function changeSize(delta) {
    var next = Math.max(0, Math.min(SIZES.length - 1, sizeIdx + delta));
    if (next === sizeIdx) return;
    sizeIdx = next;
    applySize();
    save('ethsliv-size', String(next));
  }

  /* ---------- Отрисовка текста (абзацы + кликабельные ссылки) ---------- */

  function appendLinked(parent, line) {
    var re = /https?:\/\/[^\s<>"]+/g;
    var last = 0, m;
    while ((m = re.exec(line)) !== null) {
      var url = m[0], trail = '';
      var t = url.match(/[.,;:!?)\]»”]+$/);
      if (t) {
        trail = t[0];
        url = url.slice(0, url.length - trail.length);
      }
      if (m.index > last) parent.appendChild(document.createTextNode(line.slice(last, m.index)));
      parent.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: url }));
      if (trail) parent.appendChild(document.createTextNode(trail));
      last = m.index + m[0].length;
    }
    if (last < line.length) parent.appendChild(document.createTextNode(line.slice(last)));
  }

  function renderBody(text) {
    var wrap = el('div', { class: 'prose' });
    String(text).split(/\n{2,}/).forEach(function (block) {
      if (!block.trim()) return;
      var p = el('p');
      block.split('\n').forEach(function (line, i) {
        if (i) p.appendChild(document.createElement('br'));
        appendLinked(p, line);
      });
      wrap.appendChild(p);
    });
    return wrap;
  }

  /* ---------- Копирование ---------- */

  function fallbackCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }

  /* ---------- Запись (раскрывающаяся строка) ---------- */

  function buildEntry(e, openByDefault, onToggle) {
    var id = 'e' + (++uid);
    var timer;

    var btn = el('button', {
      class: 'entry-btn', type: 'button', id: id + '-h',
      'aria-expanded': 'false', 'aria-controls': id + '-p'
    }, [
      el('span', { class: 'entry-title', text: e.title }),
      el('span', { class: 'entry-time', text: e.min + ' мин' }),
      el('span', { class: 'pm', 'aria-hidden': 'true' })
    ]);

    var copy = el('button', { class: 'btn-quiet', type: 'button', text: 'Копировать текст' });

    var panel = el('div', {
      class: 'entry-panel', id: id + '-p', role: 'region', 'aria-labelledby': id + '-h'
    }, [
      el('div', { class: 'entry-inner' }, [
        el('div', { class: 'entry-body' }, [
          renderBody(e.text),
          el('div', { class: 'entry-actions' }, [copy])
        ])
      ])
    ]);

    var node = el('article', { class: 'entry' }, [el('h2', { class: 'entry-h' }, [btn]), panel]);

    function isOpen() { return node.classList.contains('open'); }

    function setOpen(open) {
      node.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function flash(msg, done) {
      copy.textContent = msg;
      copy.classList.toggle('done', done);
      clearTimeout(timer);
      timer = setTimeout(function () {
        copy.textContent = 'Копировать текст';
        copy.classList.remove('done');
      }, 1800);
    }

    btn.addEventListener('click', function () {
      setOpen(!isOpen());
      if (onToggle) onToggle();
    });

    copy.addEventListener('click', function () {
      copyText(e.text).then(
        function () { flash('Скопировано', true); },
        function () { flash('Не удалось скопировать', false); }
      );
    });

    if (openByDefault) setOpen(true);
    return { node: node, setOpen: setOpen, isOpen: isOpen };
  }

  /* ---------- Главная ---------- */

  function viewHome() {
    currentSearch = null;
    document.title = 'ETHsliv';
    var view = el('div', { class: 'view' });

    var tpl = document.getElementById('tpl-home');
    if (tpl) view.appendChild(tpl.content.cloneNode(true));

    var rows = Math.ceil(SECTIONS.length / 2);
    var index = el('nav', { class: 'index', 'aria-label': 'Разделы', style: '--rows:' + rows });
    SECTIONS.forEach(function (s, i) {
      var n = (entriesBySection[s.id] || []).length;
      var isEnd = i === rows - 1 || i === SECTIONS.length - 1;
      index.appendChild(el('a', { class: 'row', href: '#/' + s.id, 'data-end': isEnd }, [
        el('span', { class: 'row-name', text: s.title }),
        s.sub ? el('span', { class: 'row-sub', text: s.sub }) : null,
        el('span', { class: 'row-meta', text: n ? countLabel(n) : 'Пусто' }),
        el('span', { class: 'row-go', 'aria-hidden': 'true' })
      ]));
    });
    view.appendChild(el('div', { class: 'wrap' }, [index]));
    return view;
  }

  /* ---------- Раздел ---------- */

  function pagerLink(s, label, dir) {
    return el('a', { class: 'pager-link ' + dir, href: '#/' + s.id }, [
      el('span', { class: 'pager-label', text: label }),
      el('span', { class: 'pager-name', text: s.title })
    ]);
  }

  function viewSection(index) {
    var s = SECTIONS[index];
    var list = entriesBySection[s.id] || [];
    document.title = s.title + ' — ETHsliv';
    currentSearch = null;

    var minutes = list.reduce(function (sum, e) { return sum + e.min; }, 0);
    var meta = list.length
      ? countLabel(list.length) + ', чтение около ' + minutes + ' мин'
      : 'Пока пусто';

    var view = el('div', { class: 'view' });

    view.appendChild(el('section', { class: 'masthead compact' }, [
      el('div', { class: 'wrap' }, [
        el('a', { class: 'back', href: '#/' }, [
          el('span', { class: 'back-arrow', 'aria-hidden': 'true' }),
          'Все разделы'
        ]),
        el('h1', { class: 'sec-title', text: s.title }),
        s.sub ? el('p', { class: 'sec-sub', text: s.sub }) : null,
        el('p', { class: 'sec-meta', text: meta })
      ])
    ]));

    var content = el('div', { class: 'wrap content' });
    view.appendChild(content);

    if (!list.length) {
      content.appendChild(el('p', { class: 'empty', text: 'В этом разделе пока нет текстов. Они появятся здесь.' }));
    } else {
      var handles = [];
      var toggleAll = null;

      var syncToggle = function () {
        if (!toggleAll) return;
        var all = handles.every(function (h) { return h.isOpen(); });
        toggleAll.textContent = all ? 'Свернуть все' : 'Раскрыть все';
      };

      handles = list.map(function (e) {
        return buildEntry(e, list.length === 1, syncToggle);
      });

      /* Панель инструментов: поиск, раскрыть все, размер текста */
      var toolbar = el('div', { class: 'toolbar' });
      var items = handles.map(function (h) { return h.node; });
      var empty = el('p', { class: 'empty', text: 'Ничего не нашлось. Попробуйте другое слово.', hidden: true });

      if (list.length >= 5) {
        var input = el('input', {
          class: 'search', type: 'search', placeholder: 'Поиск по разделу',
          'aria-label': 'Поиск по разделу', autocomplete: 'off'
        });
        input.addEventListener('input', function () {
          var q = input.value.trim().toLowerCase();
          var shown = 0;
          items.forEach(function (node, i) {
            var ok = !q || list[i].hay.indexOf(q) !== -1;
            node.hidden = !ok;
            if (ok) shown++;
          });
          empty.hidden = shown !== 0;
        });
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape' && input.value) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
          }
        });
        currentSearch = input;
        toolbar.appendChild(el('div', { class: 'search-wrap' }, [input]));
      }

      var tools = el('div', { class: 'tools' });

      if (list.length >= 2) {
        toggleAll = el('button', { class: 'btn-quiet', type: 'button', text: 'Раскрыть все' });
        toggleAll.addEventListener('click', function () {
          var all = handles.every(function (h) { return h.isOpen(); });
          handles.forEach(function (h) { h.setOpen(!all); });
          syncToggle();
        });
        tools.appendChild(toggleAll);
      }

      var smaller = el('button', { type: 'button', 'aria-label': 'Уменьшить текст' }, [
        el('span', { style: 'font-size:.82rem', text: 'A' })
      ]);
      var bigger = el('button', { type: 'button', 'aria-label': 'Увеличить текст' }, [
        el('span', { style: 'font-size:1.2rem', text: 'A' })
      ]);
      var syncSize = function () {
        smaller.disabled = sizeIdx === 0;
        bigger.disabled = sizeIdx === SIZES.length - 1;
      };
      smaller.addEventListener('click', function () { changeSize(-1); syncSize(); });
      bigger.addEventListener('click', function () { changeSize(1); syncSize(); });
      syncSize();
      tools.appendChild(el('div', { class: 'seg', role: 'group', 'aria-label': 'Размер текста' }, [smaller, bigger]));

      toolbar.appendChild(tools);
      content.appendChild(toolbar);
      content.appendChild(el('div', { class: 'entries' }, items));
      content.appendChild(empty);
    }

    var pager = el('nav', { class: 'pager', 'aria-label': 'Другие разделы' });
    if (index > 0) pager.appendChild(pagerLink(SECTIONS[index - 1], 'Назад', 'prev'));
    if (index < SECTIONS.length - 1) pager.appendChild(pagerLink(SECTIONS[index + 1], 'Далее', 'next'));
    content.appendChild(pager);

    return view;
  }

  /* ---------- Полоса разделов в шапке ---------- */

  var tabs = SECTIONS.map(function (s) {
    var a = el('a', { class: 'tab', href: '#/' + s.id, text: s.title });
    rail.appendChild(a);
    return a;
  });

  function setRail(idx) {
    if (idx < 0) {
      railWrap.hidden = true;
      return;
    }
    railWrap.hidden = false;
    tabs.forEach(function (t, i) {
      if (i === idx) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    requestAnimationFrame(function () {
      var t = tabs[idx];
      var left = rail.scrollLeft;
      var visible = t.offsetLeft >= left && t.offsetLeft + t.offsetWidth <= left + rail.clientWidth;
      if (visible && left < 4) return; /* на широком экране всё помещается — не сдвигаем */
      var x = Math.max(0, t.offsetLeft - (rail.clientWidth - t.offsetWidth) / 2);
      if (rail.scrollTo) rail.scrollTo({ left: x, behavior: 'auto' });
      else rail.scrollLeft = x;
    });
  }

  /* ---------- Прокрутка: прогресс чтения, шапка ---------- */

  var lastY = 0;
  var ticking = false;

  function syncMeta() {
    if (!metaTheme) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    var solid = header.classList.contains('solid');
    metaTheme.setAttribute('content', solid ? (dark ? '#060b1f' : '#f7f9fe') : (dark ? '#1b3fe6' : '#1f47ff'));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, Math.max(0, y / max)) : 0) + ')';

      var solid = y > 12;
      if (solid !== header.classList.contains('solid')) {
        header.classList.toggle('solid', solid);
        syncMeta();
      }

      var dy = y - lastY;
      if (Math.abs(dy) >= 6) {
        if (y > 160 && dy > 0) header.classList.add('rail-away');
        else header.classList.remove('rail-away');
        lastY = y;
      }
      if (y <= 160) header.classList.remove('rail-away');
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Маршрутизация (#/раздел) ---------- */

  function currentId() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    try { return decodeURIComponent(h); } catch (e) { return h; }
  }

  function route(moveFocus) {
    var id = currentId();
    var idx = -1;
    SECTIONS.forEach(function (s, i) { if (s.id === id) idx = i; });

    body.setAttribute('data-view', idx >= 0 ? 'section' : 'home');
    setRail(idx);

    var view = idx >= 0 ? viewSection(idx) : viewHome();
    main.textContent = '';
    main.appendChild(view);

    header.classList.remove('rail-away');
    window.scrollTo(0, 0);
    lastY = 0;
    onScroll();
    if (moveFocus) main.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', function () { route(true); });

  /* Клавиша «/» — перейти к поиску по разделу */
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== '/' || !currentSearch) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    ev.preventDefault();
    currentSearch.focus();
  });

  /* ---------- Тема ---------- */

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  function syncTheme() {
    if (themeBtn) themeBtn.setAttribute('aria-pressed', isDark() ? 'true' : 'false');
    syncMeta();
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      save('ethsliv-theme', next);
      syncTheme();
    });
  }

  /* ---------- Старт ---------- */

  var toTop = document.getElementById('to-top');
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: mqReduce.matches ? 'auto' : 'smooth' });
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  route(false);
  syncTheme();
})();
