/**
 * ЗЕМЕЛЬНЫЙ АКТИВ 26,118 ГА — обработчик формы заявки (Land Asset 5)
 * ------------------------------------------------------------------
 * Отдельный проект Apps Script, привязанный к отдельной Google Таблице
 * "Land Asset 5 - Заявки". НЕ используется и не связан с проектом
 * Atelier Moscow — их можно развивать независимо друг от друга.
 *
 * doGet(e)  — (необязательно) отдаёт HTML-файл с именем "index" из этого
 *             же проекта Apps Script, если он туда добавлен. Основной
 *             сайт размещается на Cloudflare — see setup-instructions.md.
 * doPost(e) — принимает JSON из script.js (submitForm) и:
 *             1) добавляет строку в таблицу: Дата | Имя | Телефон |
 *                Email | Сообщение | Источник;
 *             2) параллельно отправляет письмо-уведомление на
 *                EMAIL_NOTIFY. Ошибка отправки письма НЕ считается
 *                ошибкой заявки — таблица остаётся источником истины.
 *
 * ИСПРАВЛЕНО (v2): телефон вида "+7 (999) 123-45-67" начинается с "+",
 * а Google Таблицы по умолчанию пытаются прочитать значение, начинающееся
 * с "+"/"-"/"=", как формулу — из-за этого столбец "Телефон" оставался
 * пустым, хотя данные приходили верно. Теперь перед записью столбцы
 * Имя/Телефон/Email/Сообщение/Источник принудительно форматируются как
 * "Обычный текст" (число-формат "@"), это отключает автопарсинг.
 */

var SOURCE_LABEL = 'Land Asset 5';
var SHEET_HEADERS = ['Дата', 'Имя', 'Телефон', 'Email', 'Сообщение', 'Источник'];
var EMAIL_NOTIFY = 'you@example.com';

/* ================= doGet ================= */

function doGet(e) {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Земельный актив 26,118 га')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:24px;color:#1a2332">' +
      'Веб-приложение формы работает. Страница сайта размещена отдельно ' +
      '(Cloudflare Pages) — см. setup-instructions.md.</p>'
    );
  }
}

/* ================= doPost ================= */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (lockErr) {
    return jsonResponse({ success: false, error: 'Сервер занят, попробуйте ещё раз через несколько секунд.' });
  }

  try {
    var data = parseRequest(e);

    var name = (data.name || '').toString().trim();
    var phone = (data.phone || '').toString().trim();
    var email = (data.email || '').toString().trim();
    var message = (data.message || '').toString().trim();

    if (!name || name.length < 2) {
      return jsonResponse({ success: false, error: 'Не указано имя.' });
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return jsonResponse({ success: false, error: 'Не указан телефон.' });
    }

    var sheet = getTargetSheet();
    ensureHeaderRow(sheet);
    appendLeadRow(sheet, name, phone, email, message);

    // Письмо — второй, независимый канал. Если оно не уйдёт (квота,
    // временный сбой) — заявка всё равно уже в таблице, поэтому
    // ошибку отправки письма не возвращаем как ошибку всей заявки.
    try {
      sendNotificationEmail(name, phone, email, message);
    } catch (mailErr) {
      Logger.log('Email notify failed: ' + mailErr.message);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Ошибка сервера: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ================= Запись в таблицу ================= */

function appendLeadRow(sheet, name, phone, email, message) {
  var nextRow = sheet.getLastRow() + 1;

  // Столбцы B:F (Имя, Телефон, Email, Сообщение, Источник) — принудительно
  // "Обычный текст", ДО записи значений. Иначе Таблицы попытаются
  // разобрать "+7 (999)..." как формулу и ячейка останется пустой.
  sheet.getRange(nextRow, 2, 1, 5).setNumberFormat('@');

  sheet.getRange(nextRow, 1, 1, SHEET_HEADERS.length).setValues([[
    formatDate(new Date()),
    name,
    phone,
    email,
    message,
    SOURCE_LABEL
  ]]);
}

/* ================= Письмо-уведомление ================= */

function sendNotificationEmail(name, phone, email, message) {
  var subject = 'Новая заявка — Land Asset 5 (' + name + ')';
  var body =
    'Новая заявка с сайта «Земельный актив 26,118 га»\n\n' +
    'Имя: ' + name + '\n' +
    'Телефон: ' + phone + '\n' +
    'Email: ' + (email || '—') + '\n' +
    'Сообщение: ' + (message || '—') + '\n\n' +
    'Дата: ' + formatDate(new Date()) + '\n' +
    'Источник: ' + SOURCE_LABEL;

  var options = {};
  if (email) {
    // Чтобы можно было ответить лиду прямо из письма кнопкой "Ответить"
    options.replyTo = email;
  }

  MailApp.sendEmail(EMAIL_NOTIFY, subject, body, options);
}

/* ================= Вспомогательные функции ================= */

function parseRequest(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (parseErr) {
      // не JSON — пробуем ниже как обычные параметры формы
    }
  }
  if (e && e.parameter) {
    return e.parameter;
  }
  return {};
}

function getTargetSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()[0];
}

function ensureHeaderRow(sheet) {
  var firstRow = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  var hasHeaders = firstRow.some(function (cell) { return cell !== '' && cell !== null; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function formatDate(date) {
  var tz = Session.getScriptTimeZone() || 'Europe/Moscow';
  return Utilities.formatDate(date, tz, 'dd.MM.yyyy HH:mm:ss');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ручной прогон прямо в редакторе Apps Script — выделите функцию в
 * выпадающем списке (панель инструментов) и нажмите "Выполнить".
 * Добавит тестовую строку в таблицу И отправит настоящее письмо на
 * you@example.com — используйте, чтобы:
 *  а) один раз выдать скрипту разрешение на отправку почты
 *     (Google покажет запрос доступа при первом запуске — это нужно
 *     подтвердить вручную, форма на сайте попросить это не может);
 *  б) убедиться, что и таблица, и письмо работают.
 */
function testAppendRow() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name: 'Тест Тестов',
        phone: '+7 (999) 123-45-67',
        email: 'test@example.com',
        message: 'Проверка записи в таблицу и письма',
        source: 'Land Asset 5'
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
