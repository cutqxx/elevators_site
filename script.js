const form = document.querySelector("#lead-form");
const nameInput = document.querySelector("#name");
const addressInput = document.querySelector("#address");
const issueInput = document.querySelector("#issue");
const phoneInput = document.querySelector("#phone");
const submitButton = document.querySelector(".lead-form__submit");
const statusElement = document.querySelector("#form-status");
const defaultSubmitLabel = "Отправить";
let isSubmitting = false;

const errorElements = {
  name: document.querySelector("#name-error"),
  address: document.querySelector("#address-error"),
  issue: document.querySelector("#issue-error"),
  phone: document.querySelector("#phone-error")
};

const phoneMaskTemplate = "+7 (___) ___-__-__";

function getDigits(value) {
  return value.replace(/\D/g, "");
}

function normalizePhoneDigits(value) {
  const digits = getDigits(value);

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

  return "7";
}

function formatPhone(value) {
  const digits = normalizePhoneDigits(value);
  const rest = digits.slice(1);

  if (rest.length === 0) {
    return "+7";
  }

  let result = "+7";

  if (rest.length > 0) {
    result += ` (${rest.slice(0, 3)}`;
  }

  if (rest.length >= 4) {
    result += `) ${rest.slice(3, 6)}`;
  }

  if (rest.length >= 7) {
    result += `-${rest.slice(6, 8)}`;
  }

  if (rest.length >= 9) {
    result += `-${rest.slice(8, 10)}`;
  }

  return result;
}

function getNameError() {
  const value = nameInput.value.trim();

  if (!value) {
    return "Укажите имя";
  }

  if (value.length < 2) {
    return "Имя должно содержать минимум 2 символа";
  }

  if (value.length > 50) {
    return "Имя должно содержать не более 50 символов";
  }

  return "";
}

function getAddressError() {
  const value = addressInput.value.trim();

  if (!value) {
    return "Укажите адрес";
  }

  if (value.length < 5) {
    return "Адрес должен содержать минимум 5 символов";
  }

  if (value.length > 120) {
    return "Адрес должен содержать не более 120 символов";
  }

  return "";
}

function getPhoneError() {
  const digits = normalizePhoneDigits(phoneInput.value);
  const rawValue = phoneInput.value.trim();

  if (!rawValue || rawValue === "+7") {
    return "Укажите номер телефона";
  }

  if (!digits.startsWith("79")) {
    return "Введите корректный номер телефона в формате +7";
  }

  if (digits.length !== 11) {
    return "Введите полный номер телефона в формате +7";
  }

  return "";
}

function getIssueError() {
  const value = issueInput.value.trim();

  if (!value) {
    return "Опишите проблему";
  }

  if (value.length < 5) {
    return "Описание должно содержать минимум 5 символов";
  }

  if (value.length > 200) {
    return "Описание должно содержать не более 200 символов";
  }

  return "";
}

function setFieldError(input, key, message) {
  input.setAttribute("aria-invalid", message ? "true" : "false");
  errorElements[key].textContent = message;
}

function setStatus(message, state) {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function clearStatus() {
  setStatus("", "idle");
}

function setSubmittingState(nextState) {
  isSubmitting = nextState;
  submitButton.disabled = nextState || !validateForm();
  submitButton.classList.toggle("is-loading", nextState);
  submitButton.textContent = nextState ? "Отправляем..." : defaultSubmitLabel;
}

function validateForm() {
  const nameError = getNameError();
  const addressError = getAddressError();
  const issueError = getIssueError();
  const phoneError = getPhoneError();

  setFieldError(nameInput, "name", nameError);
  setFieldError(addressInput, "address", addressError);
  setFieldError(issueInput, "issue", issueError);
  setFieldError(phoneInput, "phone", phoneError);

  const isValid = !nameError && !addressError && !issueError && !phoneError;
  submitButton.disabled = isSubmitting || !isValid;

  return isValid;
}

function syncPhoneField() {
  const previousValue = phoneInput.value;
  phoneInput.value = formatPhone(previousValue);
}

phoneInput.addEventListener("focus", () => {
  if (!phoneInput.value.trim()) {
    phoneInput.value = "+7";
  }
});

phoneInput.addEventListener("input", () => {
  syncPhoneField();
  validateForm();
  clearStatus();
});

[nameInput, addressInput, issueInput].forEach((input) => {
  input.addEventListener("input", () => {
    validateForm();
    clearStatus();
  });
});

[nameInput, addressInput, issueInput, phoneInput].forEach((input) => {
  input.addEventListener("blur", () => {
    if (input === phoneInput) {
      syncPhoneField();
    }

    validateForm();
  });
});

phoneInput.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey) {
    return;
  }

  const allowedKeys = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Home",
    "End"
  ];

  if (allowedKeys.includes(event.key) || /^[0-9]$/.test(event.key)) {
    return;
  }

  event.preventDefault();
});

phoneInput.addEventListener("paste", (event) => {
  event.preventDefault();

  const pastedText = event.clipboardData?.getData("text") ?? "";
  phoneInput.value = formatPhone(pastedText);
  validateForm();
  clearStatus();
});

function applyServerErrors(errors) {
  if (!errors || typeof errors !== "object") {
    return;
  }

  if (typeof errors.name === "string") {
    setFieldError(nameInput, "name", errors.name);
  }

  if (typeof errors.address === "string") {
    setFieldError(addressInput, "address", errors.address);
  }

  if (typeof errors.issue === "string") {
    setFieldError(issueInput, "issue", errors.issue);
  }

  if (typeof errors.phone === "string") {
    setFieldError(phoneInput, "phone", errors.phone);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  if (!validateForm()) {
    clearStatus();
    return;
  }

  setSubmittingState(true);
  setStatus("Отправляем заявку...", "loading");

  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: nameInput.value.trim(),
        address: addressInput.value.trim(),
        issue: issueInput.value.trim(),
        phone: phoneInput.value.trim()
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      applyServerErrors(result.errors);
      setStatus(
        typeof result.message === "string"
          ? result.message
          : "Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.",
        "error"
      );
      return;
    }

    form.reset();
    phoneInput.value = "";
    validateForm();
    setStatus(
      typeof result.message === "string"
        ? result.message
        : "Заявка отправлена. Мы свяжемся с вами в ближайшее время.",
      "success"
    );
  } catch (error) {
    setStatus("Не удалось отправить заявку. Попробуйте ещё раз немного позже.", "error");
  } finally {
    setSubmittingState(false);
  }
});

phoneInput.placeholder = phoneMaskTemplate;
validateForm();
clearStatus();
