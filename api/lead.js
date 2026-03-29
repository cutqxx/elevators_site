const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const ADDRESS_MIN_LENGTH = 5;
const ADDRESS_MAX_LENGTH = 120;
const ISSUE_MIN_LENGTH = 5;
const ISSUE_MAX_LENGTH = 200;
const PHONE_PATTERN = /^79\d{9}$/;

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

async function sendLeadEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO_EMAIL;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    throw new Error("SERVER_ENV_MISSING");
  }

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Новая заявка с сайта",
      html,
      reply_to: process.env.LEAD_REPLY_TO_EMAIL || undefined
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EMAIL_SEND_FAILED:${errorText}`);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Метод не поддерживается" });
  }

  const { isValid, errors, data } = validateLead(request.body);

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
    if (error instanceof Error && error.message === "SERVER_ENV_MISSING") {
      return response.status(500).json({
        message: "Сервис временно недоступен. Попробуйте отправить заявку позже."
      });
    }

    const providerMessage = getProviderMessage(error);

    if (providerMessage) {
      return response.status(providerMessage.status).json({
        message: providerMessage.message
      });
    }

    console.error("Lead email send failed", error);

    return response.status(502).json({
      message: "Не удалось отправить заявку. Попробуйте ещё раз немного позже."
    });
  }
}

function getProviderMessage(error) {
  if (!(error instanceof Error) || !error.message.startsWith("EMAIL_SEND_FAILED:")) {
    return null;
  }

  const rawMessage = error.message.replace("EMAIL_SEND_FAILED:", "");

  try {
    const parsed = JSON.parse(rawMessage);
    const providerText = typeof parsed.message === "string" ? parsed.message : "";

    if (providerText.includes("testing emails to your own email address")) {
      return {
        status: 502,
        message:
          "Для тестового адреса отправителя Resend можно отправлять письма только на email владельца аккаунта. Укажите основной email аккаунта в LEAD_TO_EMAIL или подключите свой домен."
      };
    }

    if (providerText.includes("API key is invalid")) {
      return {
        status: 500,
        message: "Указан неверный ключ RESEND_API_KEY. Проверьте значение в файле .env."
      };
    }

    if (providerText.includes("verify a domain")) {
      return {
        status: 502,
        message:
          "Resend требует подтверждённый домен отправителя. Подключите домен в Resend и используйте адрес вида name@your-domain.ru."
      };
    }
  } catch (parseError) {
    console.error("Failed to parse email provider error", parseError);
  }

  return null;
}
