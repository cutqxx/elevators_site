import nodemailer from "nodemailer";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const ADDRESS_MIN_LENGTH = 5;
const ADDRESS_MAX_LENGTH = 120;
const ISSUE_MIN_LENGTH = 5;
const ISSUE_MAX_LENGTH = 200;
const PHONE_PATTERN = /^79\d{9}$/;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_MAX_ENTRIES = 5000;
const rateLimitStore = new Map();

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizePhone(value) {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";

  if (digits.startsWith("79")) {
    return digits.slice(0, 11);
  }

  if (digits.startsWith("89")) {
    return `79${digits.slice(2, 11)}`.slice(0, 11);
  }

  if (digits.startsWith("9")) {
    return `79${digits.slice(1, 10)}`.slice(0, 11);
  }

  if (digits.startsWith("7")) {
    return `79${digits.slice(1, 10)}`.slice(0, 11);
  }

  return "";
}

function validateLead(payload) {
  const errors = {};
  const name = normalizeText(payload?.name);
  const address = normalizeText(payload?.address);
  const issue = normalizeText(payload?.issue);
  const phone = normalizePhone(payload?.phone);

  if (!name) {
    errors.name = "Укажите имя";
  } else if (name.length < NAME_MIN_LENGTH) {
    errors.name = "Имя должно содержать минимум 2 символа";
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = "Имя должно содержать не более 50 символов";
  }

  if (!address) {
    errors.address = "Укажите адрес";
  } else if (address.length < ADDRESS_MIN_LENGTH) {
    errors.address = "Адрес должен содержать минимум 5 символов";
  } else if (address.length > ADDRESS_MAX_LENGTH) {
    errors.address = "Адрес должен содержать не более 120 символов";
  }

  if (!issue) {
    errors.issue = "Опишите проблему";
  } else if (issue.length < ISSUE_MIN_LENGTH) {
    errors.issue = "Описание должно содержать минимум 5 символов";
  } else if (issue.length > ISSUE_MAX_LENGTH) {
    errors.issue = "Описание должно содержать не более 200 символов";
  }

  if (!phone) {
    errors.phone = "Укажите номер телефона";
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.phone = "Введите корректный номер телефона в формате +79";
  }

  return {
    errors,
    data: {
      name,
      address,
      issue,
      phone
    },
    isValid: Object.keys(errors).length === 0
  };
}

// Скрытое поле-приманка для ботов: обычные пользователи его не видят и не заполняют.
function isHoneypotTriggered(payload) {
  return typeof payload?.website === "string" && payload.website.trim() !== "";
}

function getClientIp(request) {
  const trustProxy = process.env.TRUST_PROXY === "1" || Boolean(process.env.VERCEL);
  const forwardedFor = request.headers?.["x-forwarded-for"];

  if (trustProxy && typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.ip || request.socket?.remoteAddress || "unknown";
}

function pruneRateLimitStore(now) {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_ENTRIES) {
    return;
  }

  for (const [key, value] of rateLimitStore) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    pruneRateLimitStore(now);
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true };
}

function isOriginAllowed(request) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  if (!allowedOrigin) {
    return true;
  }

  const origin = request.headers?.origin;

  if (!origin) {
    return true;
  }

  return origin === allowedOrigin;
}

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return cachedTransporter;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildLeadEmail(lead) {
  const sentAt = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Europe/Moscow"
  }).format(new Date());

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d1a17; line-height: 1.6;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Новая заявка с сайта</h1>
      <p><strong>Имя:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>Адрес:</strong> ${escapeHtml(lead.address)}</p>
      <p><strong>Описание проблемы:</strong> ${escapeHtml(lead.issue)}</p>
      <p><strong>Номер телефона:</strong> ${escapeHtml(`+${lead.phone}`)}</p>
      <p><strong>Дата и время отправки:</strong> ${escapeHtml(sentAt)}</p>
    </div>
  `;

  const text = [
    "Новая заявка с сайта",
    `Имя: ${lead.name}`,
    `Адрес: ${lead.address}`,
    `Описание проблемы: ${lead.issue}`,
    `Номер телефона: +${lead.phone}`,
    `Дата и время отправки: ${sentAt}`
  ].join("\n");

  return { html, text };
}

async function sendLeadEmail(lead) {
  const to = process.env.LEAD_TO_EMAIL;
  const from = process.env.LEAD_FROM_EMAIL;
  const replyTo = process.env.LEAD_REPLY_TO_EMAIL || undefined;
  const transporter = getTransporter();

  if (!transporter || !to || !from) {
    throw new Error("SERVER_ENV_MISSING");
  }

  const { html, text } = buildLeadEmail(lead);

  await transporter.sendMail({
    from,
    to,
    replyTo,
    subject: "Новая заявка с сайта",
    html,
    text
  });
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Метод не поддерживается" });
  }

  if (!isOriginAllowed(request)) {
    return response.status(403).json({ message: "Запрос отклонён" });
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    return response.status(429).json({
      message: "Слишком много заявок с вашего адреса. Попробуйте немного позже."
    });
  }

  const { isValid, errors, data } = validateLead(request.body);

  if (isHoneypotTriggered(request.body)) {
    // Ботам возвращаем правдоподобный успех, письмо не отправляем.
    return response.status(200).json({
      message: "Заявка отправлена. Мы свяжемся с вами в ближайшее время."
    });
  }

  if (!isValid) {
    return response.status(400).json({
      message: "Проверьте корректность заполнения формы",
      errors
    });
  }

  try {
    await sendLeadEmail(data);

    return response.status(200).json({
      message: "Заявка отправлена. Мы свяжемся с вами в ближайшее время."
    });
  } catch (error) {
    console.error("Lead email send failed", error);

    if (error instanceof Error && error.message === "SERVER_ENV_MISSING") {
      return response.status(500).json({
        message: "Сервис временно недоступен. Попробуйте отправить заявку позже."
      });
    }

    return response.status(502).json({
      message: "Не удалось отправить заявку. Попробуйте ещё раз немного позже."
    });
  }
}
