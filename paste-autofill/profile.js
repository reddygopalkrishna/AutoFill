const form = document.querySelector("#profile-form");
const fields = document.querySelector("#profile-fields");
const submit = document.querySelector("#save-profile");
const status = document.querySelector("#save-status");
const inputs = [...fields.querySelectorAll("input[name], textarea[name]")];
const customFields = document.querySelector("#custom-fields");
const customSections = document.querySelector("#custom-sections");
const addFieldButton = document.querySelector("#add-field");
const addSectionButton = document.querySelector("#add-section");
const fieldTemplate = document.querySelector("#field-template");
const sectionTemplate = document.querySelector("#section-template");
const { normalizeCustomLabel } = PasteMatching;
let customError;

function showStatus(message, error = false) {
  status.textContent = message;
  status.toggleAttribute("data-error", error);
}

function markUnsaved() {
  customError?.setCustomValidity("");
  customError = undefined;
  showStatus("Unsaved changes");
}

function customProblem(input, message) {
  customError = input;
  input.setCustomValidity(message);
  showStatus(message, true);
  input.reportValidity();
  return null;
}

function appendField(container, addButton, entry) {
  const row = fieldTemplate.content.firstElementChild.cloneNode(true);
  const label = row.querySelector("[data-label]");
  label.value = entry?.label ?? "";
  row.querySelector("[data-value]").value = entry?.value ?? "";
  row.querySelector("[data-remove]").addEventListener("click", () => {
    (row.nextElementSibling?.querySelector("[data-label]") ?? addButton).focus();
    row.remove();
    markUnsaved();
  });
  container.append(row);
  return label;
}

function appendSection(entry) {
  const section = sectionTemplate.content.firstElementChild.cloneNode(true);
  const title = section.querySelector("[data-title]");
  const container = section.querySelector("[data-fields]");
  const addButton = section.querySelector("[data-add-field]");
  title.value = entry?.title ?? "";
  for (const field of entry?.fields ?? []) appendField(container, addButton, field);
  addButton.addEventListener("click", () => {
    appendField(container, addButton).focus();
    markUnsaved();
  });
  section.querySelector("[data-remove-section]").addEventListener("click", () => {
    (section.nextElementSibling?.querySelector("[data-title]") ?? addSectionButton).focus();
    section.remove();
    markUnsaved();
  });
  customSections.append(section);
  return title;
}

function readCustomFields(container, usedLabels) {
  const entries = [];
  for (const row of container.children) {
    const input = row.querySelector("[data-label]");
    const label = input.value.trim();
    const value = row.querySelector("[data-value]").value.trim();
    if (!label && !value) continue;
    const normalized = normalizeCustomLabel(label);
    if (!normalized) return customProblem(input, "Enter a label for this field.");
    if (usedLabels.has(normalized)) return customProblem(input, "Use a different label for each custom field.");
    usedLabels.add(normalized);
    entries.push({ label, value });
  }
  return entries;
}

addFieldButton.addEventListener("click", () => {
  appendField(customFields, addFieldButton).focus();
  markUnsaved();
});

addSectionButton.addEventListener("click", () => {
  appendSection().focus();
  markUnsaved();
});

function linkValue(value) {
  const address = /^(?:[a-z][a-z\d+.-]*:\/\/|(?:javascript|mailto|data|file):)/i.test(value) ? value : `https://${value}`;
  const url = new URL(address);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Expected an HTTP or HTTPS link without credentials.");
  }
  return url.href;
}

chrome.storage.local.get("profile").then(({ profile = {} }) => {
  for (const input of inputs) input.value = profile[input.name] ?? "";
  for (const field of profile.customFields ?? []) appendField(customFields, addFieldButton, field);
  for (const section of profile.customSections ?? []) appendSection(section);
  fields.disabled = false;
  submit.disabled = false;
}, () => showStatus("Couldn’t load the profile. Reload this tab to try again.", true));

form.addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
  event.target.setCustomValidity("");
  markUnsaved();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const profile = {};
  for (const input of inputs) {
    let value = input.value.trim();
    if (!value) continue;
    if (input.hasAttribute("data-link")) {
      try {
        value = linkValue(value);
      } catch {
        input.setCustomValidity("Enter a valid website address.");
        input.reportValidity();
        return;
      }
    }
    profile[input.name] = value;
  }

  const usedLabels = new Set();
  const standalone = readCustomFields(customFields, usedLabels);
  if (!standalone) return;
  if (standalone.length) profile.customFields = standalone;
  for (const section of customSections.children) {
    const entries = readCustomFields(section.querySelector("[data-fields]"), usedLabels);
    if (!entries) return;
    const input = section.querySelector("[data-title]");
    const title = input.value.trim();
    if (!title && !entries.length) continue;
    if (!title) {
      customProblem(input, "Enter a name for this section.");
      return;
    }
    (profile.customSections ??= []).push({ title, fields: entries });
  }

  fields.disabled = true;
  submit.disabled = true;
  try {
    await chrome.storage.local.set({ profile });
    for (const input of inputs) input.value = profile[input.name] ?? "";
    showStatus("Profile saved");
  } catch {
    showStatus("Couldn’t save the profile. Try again.", true);
  } finally {
    fields.disabled = false;
    submit.disabled = false;
  }
});
