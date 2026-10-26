/* =========================================================
   Земельный актив 26,118 га — инвестиционный лендинг
   Скролл-эффекты, мобильное меню, счётчики, форма
   ========================================================= */

/* URL веб-приложения Google Apps Script для формы заявки.
   Взять после развёртывания (см. setup-instructions.md, ШАГ 2–3):
   Расширения → Apps Script → Развернуть → Новое развёртывание → Веб-приложение. */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDRBzhov3By7jHntpEQOSn2I_ew7K5oN9eTjQtlVn6KuPfj7PnftNsWaJUTcNPpgUYaQ/exec';

(function () {
  'use strict';

  /* ---------- Включаем scroll-анимации только если браузер их поддерживает.
     По умолчанию (без этого класса) весь контент .reveal виден сразу —
     страница не должна зависеть от того, сработает ли IntersectionObserver. ---------- */
  var supportsIO = 'IntersectionObserver' in window;
  if (supportsIO) {
    document.documentElement.classList.add('js-anim');
  }

  /* ---------- Header: фон при скролле ---------- */
  var header = document.getElementById('siteHeader');
  function onScrollHeader() {
    if (window.scrollY > 40) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ---------- Мобильное меню ---------- */
  var burger = document.getElementById('burgerBtn');
  var nav = document.getElementById('mainNav');

  function closeNav() {
    nav.classList.remove('is-open');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---------- Плавный скролл для якорных ссылок ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href');
      if (targetId.length < 2) return;
      var target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      var headerOffset = 76;
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  /* ---------- Появление блоков при скролле ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (entry.isIntersecting) {
            setTimeout(function () {
              entry.target.classList.add('is-visible');
            }, (i % 4) * 90);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '0px 0px -5% 0px' }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });

    /* Страховка: если по какой-то причине наблюдатель не сработал или
       не успел среагировать (очень быстрый скролл, нестандартный браузер,
       инструмент рендеринга и т.п.) — принудительно показываем контент. */
    setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }, 1800);
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Счётчики цифр (hero + stats) ---------- */
  var counters = document.querySelectorAll('[data-count]');
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var duration = 1400;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = target * eased;
      el.textContent = value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString('ru-RU', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      }
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) { counterObserver.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* ---------- Активная ссылка навигации при скролле ---------- */
  var sections = document.querySelectorAll('main, section[id]');
  var navLinks = document.querySelectorAll('.nav-link');
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var id = entry.target.getAttribute('id');
          var link = document.querySelector('.nav-link[href="#' + id + '"]');
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.classList.remove('is-active'); });
            link.classList.add('is-active');
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------- Маска телефона: +7 (___) ___-__-__ ---------- */
  var phoneInput = document.getElementById('fieldPhone');

  function formatPhone(rawDigits) {
    // rawDigits — только цифры, без первой "7"/"8", максимум 10 цифр
    var d = rawDigits;
    var out = '+7';
    if (d.length > 0) out += ' (' + d.substring(0, 3);
    if (d.length >= 3) out += ')';
    if (d.length > 3) out += ' ' + d.substring(3, 6);
    if (d.length > 6) out += '-' + d.substring(6, 8);
    if (d.length > 8) out += '-' + d.substring(8, 10);
    return out;
  }

  if (phoneInput) {
    phoneInput.addEventListener('focus', function () {
      if (!phoneInput.value) phoneInput.value = '+7 (';
    });
    phoneInput.addEventListener('input', function () {
      var digits = phoneInput.value.replace(/\D/g, '');
      // отбрасываем ведущую 7 или 8 (код страны уже подставлен как "+7")
      if (digits.charAt(0) === '7' || digits.charAt(0) === '8') {
        digits = digits.substring(1);
      }
      digits = digits.substring(0, 10);
      phoneInput.value = digits.length ? formatPhone(digits) : '';
    });
    phoneInput.addEventListener('blur', function () {
      if (phoneInput.value === '+7 (' ) phoneInput.value = '';
    });
  }

  /* ---------- Валидация и отправка формы через Google Apps Script ---------- */
  var form = document.getElementById('contactForm');
  var successMsg = document.getElementById('formSuccess');
  var formErrorEl = document.getElementById('formError');
  var submitBtn = document.getElementById('submitBtn');
  var submitBtnDefaultText = submitBtn ? submitBtn.textContent : '';

  var validators = {
    // Имя и телефон обязательны, email — опционален (но если заполнен, должен быть валиден)
    fieldName: function (v) { return v.trim().length >= 2; },
    fieldPhone: function (v) {
      var digits = v.replace(/\D/g, '');
      return digits.length === 11; // +7 и 10 цифр номера
    },
    fieldEmail: function (v) {
      if (!v.trim()) return true; // необязательное поле
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    }
  };
  var errorMessages = {
    fieldName: 'Укажите имя (минимум 2 символа)',
    fieldPhone: 'Укажите телефон полностью — +7 (___) ___-__-__',
    fieldEmail: 'Проверьте формат email'
  };

  function validateField(id) {
    var input = document.getElementById(id);
    var errorEl = document.getElementById('error' + id.replace('field', ''));
    var valid = validators[id](input.value);
    input.closest('.form-field').classList.toggle('has-error', !valid);
    if (errorEl) errorEl.textContent = valid ? '' : errorMessages[id];
    return valid;
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Отправляем…' : submitBtnDefaultText;
  }

  if (form) {
    ['fieldName', 'fieldPhone', 'fieldEmail'].forEach(function (id) {
      var input = document.getElementById(id);
      input.addEventListener('blur', function () { validateField(id); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (formErrorEl) formErrorEl.textContent = '';

      var validName = validateField('fieldName');
      var validPhone = validateField('fieldPhone');
      var validEmail = validateField('fieldEmail');

      if (!(validName && validPhone && validEmail)) {
        var firstInvalid = form.querySelector('.has-error input');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('ВСТАВЬ_СЮДА_URL') !== -1) {
        if (formErrorEl) {
          formErrorEl.textContent = 'Форма ещё не подключена: не задан APPS_SCRIPT_URL в script.js (см. setup-instructions.md).';
        }
        return;
      }

      var payload = {
        name: document.getElementById('fieldName').value.trim(),
        phone: document.getElementById('fieldPhone').value.trim(),
        email: document.getElementById('fieldEmail').value.trim(),
        message: document.getElementById('fieldMessage').value.trim(),
        source: 'Land Asset 5'
      };

      setLoading(true);
      submitForm(payload)
        .then(function (result) {
          setLoading(false);
          if (result && result.success) {
            form.reset();
            successMsg.classList.add('is-visible');
            setTimeout(function () {
              successMsg.classList.remove('is-visible');
            }, 8000);
          } else {
            var msg = (result && result.error) ? result.error : 'Не удалось отправить заявку. Попробуйте ещё раз.';
            if (formErrorEl) formErrorEl.textContent = msg;
          }
        })
        .catch(function () {
          setLoading(false);
          if (formErrorEl) {
            formErrorEl.textContent = 'Ошибка соединения. Проверьте интернет и попробуйте ещё раз, либо свяжитесь напрямую.';
          }
        });
    });
  }

  /**
   * Отправляет данные формы в Google Apps Script веб-приложение.
   * Content-Type: text/plain — намеренно, чтобы избежать CORS-preflight
   * (Apps Script Web Apps не обрабатывают OPTIONS-запросы). На стороне
   * doPost(e) тело читается как JSON через JSON.parse(e.postData.contents).
   */
  function submitForm(payload) {
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }
})();
