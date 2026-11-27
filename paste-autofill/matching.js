const AutoFullMatching = (() => {
  const inputTypes = new Set(["text", "email", "tel", "url", "number", "date"]);
  const links = { github: "GitHub", linkedin: "LinkedIn", portfolio: "Portfolio" };
  const linkPhrases = { github: /\bgit ?hub\b/, linkedin: /\blinked ?in\b/, portfolio: /\bportfolio\b/ };
  const birthFields = new Set(["birthDate", "birthDay", "birthMonth", "birthYear"]);

  const autocompleteKeys = new Map(Object.entries({
    name: "fullName",
    "given-name": "firstName",
    "additional-name": "middleName",
    "family-name": "lastName",
    email: "email",
    tel: "phone",
    "street-address": "streetAddress",
    "address-line1": "address1",
    "address-line2": "address2",
    "address-level1": "region",
    "address-level2": "city",
    "postal-code": "postalCode",
    country: "country",
    "country-name": "country",
    bday: "birthDate",
    "bday-day": "birthDay",
    "bday-month": "birthMonth",
    "bday-year": "birthYear",
    organization: "company",
    "organization-title": "role",
    url: "website",
  }));

  const phrases = [
    ["firstName", /^(first(?: given)? name(?: given name)?|given names?|forename|fname)$/],
    ["middleName", /^(middle name|additional name|mname)$/],
    ["lastName", /^(last name(?: sur ?name| family name)?|family name|sur ?name|lname)$/],
    ["fullName", /^(name|(?:full|legal|complete|candidate|applicant|participant) name|name in full)$/],
    ["email", /^(?:(?:contact|work|personal|professional|primary) )?e ?mail(?: (?:address|id))?$/],
    ["phone", /^(?:(?:contact|work|personal|primary) )?(?:(?:mobile|cell)(?: phone)?|phone|tel(?:ephone)?|contact|whats ?app)(?: (?:number|no))?(?: with country code)?$/],
    ["address1", /^(?:street |mailing |residential )?address (?:line )?(?:1|one)$|^street(?: name)?$/],
    ["address2", /^(?:street |mailing |residential )?address (?:line )?(?:2|two)$|^(?:apt|apartment|suite|unit|flat)(?: (?:number|no))?$/],
    ["streetAddress", /^(?:(?:full|street|mailing|residential|home|current|present) )?address$/],
    ["city", /^(?:current )?(?:city|town|locality|city town|city of residence)$/],
    ["region", /^(?:current )?(?:state|province|region|state (?:or )?(?:province(?: region)?|region|u ?t))$/],
    ["postalCode", /^(?:(?:zip|pin)(?: code)?|postal code|post ?code|zip (?:postal|post) code)$/],
    ["country", /^(?:current )?country(?: name| of residence|(?: or)? region)?$/],
    ["birthDay", /^(?:birth day|(?:bday|dob) day|day of birth|date of birth day|birth date day)$/],
    ["birthMonth", /^(?:birth month|(?:bday|dob) month|month of birth|date of birth month|birth date month)$/],
    ["birthYear", /^(?:birth year|(?:bday|dob) year|year of birth|date of birth year|birth date year)$/],
    ["birthDate", /^(?:bday|birth ?date|date of birth(?: dob)?|dob(?: date of birth)?|d o b|birthday)(?: (?:[ymd]{2,4} ){2}[ymd]{2,4})?$/],
    ["company", /^(?:(?:current|present) )?(?:(?:company|organi[sz]ation|employer)(?: name| company| organi[sz]ation)?|place of work)$/],
    ["role", /^(?:(?:current|present|professional) )?(?:role(?: (?:or )?designation)?|designation(?: job title)?|job title(?: designation)?|job position|occupation|organi[sz]ation title)$|^(?:current|present) (?:title|position)$/],
    ["experience", /^(?:(?:total|overall|professional|work|relevant) )?(?:(?:years?|yrs?) (?:of )?(?:(?:total|professional|work|relevant) )?exp(?:erience)?|exp(?:erience)? (?:in )?(?:years?|yrs?))$|^how many (?:years?|yrs?) of (?:(?:work|professional|relevant) )?experience(?: do you have)?$/],
    ["skills", /^(?:(?:key|core|primary|relevant|professional|technical|top) )?skills(?: and (?:competencies|tools(?: and technologies)?|interests|technologies))?$|^skill ?set$/],
    ["website", /^(?:(?:personal|professional) )?(?:web ?site(?: (?:url|link|address))?|url|link|web address|homepage)$/],
  ];

  const otherPerson = /\b(?:references?|referrer|referral|recommender|guardian|parent|spouse|partner|dependent|teammate|team member|team lead(?:er)?|emergency contact|alternate contact|manager|supervisor|recruiter|interviewer|co founder|co applicant|secondary contact)\b/;
  const blocked = /\b(?:search|sign ?in|log ?in|password|passcode|one time code|otp|captcha|user ?name|credit card|payment|bank account|tax id|passport|aadhaar|ssn|social security|verification code|confirm(?:ation)? (?:code|password)|recovery)\b/;
  const unrelated = /\b(?:alternate email|secondary email|alternate phone|secondary phone|previous (?:company|employer|role|position|job|address)|desired (?:role|title|position)|applying for|name of (?:the )?(?:team|project|event|hackathon)|team name|project name|event name|hackathon name)\b/;
  const unrelatedLink = /\b(?:resume|cv|project|demo|submission|repository|company|team|challenge|event|hackathon|application|referral|file|document|video|handle)\b/;
  const birthHint = /\b(?:date of birth|birth ?date|birth ?day|birth month|birth year|dob|d o b|bday)\b/;

  function splitWords(text) {
    return text
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])([0-9])/g, "$1 $2");
  }

  function clean(text) {
    return splitWords(text)
      .normalize("NFKD").replace(/\p{M}/gu, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function fieldPhrase(text) {
    return text
      .replace(/^(?:please )?(?:enter|provide|type) /, "")
      .replace(/^what is /, "")
      .replace(/^(?:your|the applicant s|applicant s|candidate s|participant s) /, "")
      .replace(/\b(?:required|optional)\b/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function normalizeCustomLabel(text) {
    return fieldPhrase(text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}+#]+/gu, " ").trim());
  }

  function customValues(profile) {
    const values = new Map();
    for (const group of [profile.customFields, ...(profile.customSections ?? []).map((section) => section.fields)]) {
      for (const { label, value } of group ?? []) {
        if (typeof label === "string" && typeof value === "string" && value) {
          values.set(normalizeCustomLabel(label), value);
        }
      }
    }
    return values;
  }

  function keyFor(text, control) {
    const phrase = fieldPhrase(text);
    const socialKeys = Object.keys(links).filter((key) => linkPhrases[key].test(phrase));
    if (socialKeys.length && !unrelatedLink.test(phrase)) {
      return socialKeys.length > 1 ? "website" : socialKeys[0];
    }
    if (phrase === "contact" && control.type !== "tel") return null;
    if (/^(?:total |overall |work |professional )?experience$/.test(phrase)) {
      return control.type === "number" || control instanceof HTMLSelectElement ? "experience" : null;
    }
    return phrases.find(([, pattern]) => pattern.test(phrase))?.[0] ?? null;
  }

  function labelText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, (node) => {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      return node.matches("input, select, textarea, button, script, style, [aria-hidden='true']")
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    });
    const parts = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent);
    return parts.join(" ");
  }

  function labelHints(control) {
    const root = control.getRootNode();
    const referenced = (control.getAttribute("aria-labelledby") ?? "").split(/\s+/)
      .map((id) => root.getElementById(id)).filter(Boolean).map(labelText);
    return [
      referenced.join(" "), control.getAttribute("aria-label") ?? "",
      ...Array.from(control.labels ?? [], labelText),
    ];
  }

  function fieldHints(control) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement)) return null;
    return {
      type: control.type,
      labels: labelHints(control),
      identifiers: [control.name, control.id],
      placeholder: control.getAttribute("placeholder") ?? "",
      autocomplete: (control.getAttribute("autocomplete") ?? "").trim().toLowerCase().split(/\s+/),
      legend: control.closest("fieldset")?.querySelector(":scope > legend")?.textContent ?? "",
    };
  }

  function fieldKey(control, hints, custom) {
    if (!hints || control.type !== hints.type) return null;
    const { autocomplete } = hints;
    const labels = hints.labels.map(clean).filter(Boolean);
    const identifiers = hints.identifiers.map(clean);
    const visible = [...labels, clean(hints.placeholder)];
    const context = [...visible, ...identifiers, clean(hints.legend), clean(autocomplete.join(" "))];
    if (context.some((text) => blocked.test(text)) ||
        autocomplete.some((token) => /^cc-|^(?:new-password|current-password|one-time-code|webauthn)$/.test(token))) {
      return null;
    }

    const metadata = autocompleteKeys.get(autocomplete.at(-1));
    const nameKey = labels.map((text) => keyFor(text, control)).find(Boolean);
    const labelKey = nameKey || keyFor(visible.at(-1), control);
    const identifierKey = identifiers.map((text) => keyFor(text, control) || keyFor(
      text.replace(/^(?:applicant|candidate|participant|profile|user|personal|contact|form|input|field) /, ""), control,
    )).find(Boolean);
    const birthKey = [labelKey, metadata, identifierKey].find((key) => birthFields.has(key));
    if (birthKey) {
      if (context.some((text) => otherPerson.test(text)) || ["tel", "email", "url"].includes(control.type) ||
          (control.type === "date" && birthKey !== "birthDate")) return null;
      return birthKey;
    }

    // An explicit custom label can distinguish fields such as Work email and Project URL.
    if (nameKey !== "website") {
      const names = hints.labels.map(normalizeCustomLabel).filter(Boolean);
      const candidates = names.length ? names : [
        normalizeCustomLabel(hints.placeholder),
        ...hints.identifiers.flatMap((id) => [normalizeCustomLabel(id), normalizeCustomLabel(splitWords(id))]),
      ];
      const match = candidates.find((name) => custom.has(name));
      if (match && (names.length || (labelKey !== "website" && identifierKey !== "website"))) {
        const prefix = context.some((text) => birthHint.test(text)) ? "custom-birth:" : "custom:";
        return prefix + match;
      }
    }

    if (context.some((text) => otherPerson.test(text) || unrelated.test(text))) return null;
    if (visible.some((text) => text === "contact") && control.type === "email") return "email";
    const hintedKey = metadata === "website" && Object.hasOwn(links, identifierKey) ? identifierKey : metadata;
    const key = labelKey || hintedKey || identifierKey || { email: "email", tel: "phone", url: "website" }[control.type];
    if (key === "website" || Object.hasOwn(links, key)) {
      if (visible.some((text) => unrelatedLink.test(text)) ||
          (!labelKey && identifiers.some((text) => unrelatedLink.test(text.replace(/^application /, ""))))) return null;
      return control.type === "text" || control.type === "url" || control instanceof HTMLTextAreaElement ? key : null;
    }
    if (control.type === "email" && key !== "email") return null;
    if (control.type === "tel" && key !== "phone") return null;
    if (control.type === "url" || control.type === "date") return null;
    return key ?? null;
  }

  function isEmptyControl(control) {
    const supported = (control instanceof HTMLInputElement && inputTypes.has(control.type)) ||
      control instanceof HTMLTextAreaElement || (control instanceof HTMLSelectElement && !control.multiple);
    if (!supported || !control.isConnected || control.value !== "" || control.readOnly ||
        control.validity.badInput ||
        control.matches(":disabled, [aria-disabled='true'], [aria-readonly='true']")) return false;
    if (!control.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) {
      return false;
    }
    const { width, height, top, right, bottom, left } = control.getBoundingClientRect();
    return width > 1 && height > 1 && bottom > 0 && right > 0 && top < innerHeight && left < innerWidth;
  }

  function formatDate(value, control) {
    if (control.type === "date") return value;
    const [year, month, day] = value.split("-");
    const hints = [control.getAttribute("placeholder"), ...labelHints(control)];
    for (const hint of hints) {
      const format = hint?.match(/\b(yyyy|yy|mm|dd)\s*([/.-])\s*(yyyy|yy|mm|dd)\s*\2\s*(yyyy|yy|mm|dd)\b/i);
      if (!format) continue;
      const parts = { yyyy: year, yy: year.slice(-2), mm: month, dd: day };
      const tokens = [format[1], format[3], format[4]].map((token) => token.toLowerCase());
      if (tokens.includes("dd") && tokens.includes("mm")) return tokens.map((token) => parts[token]).join(format[2]);
    }
    return value;
  }

  function needsBirthConfirmation(key) {
    return birthFields.has(key) || key.startsWith("custom-birth:");
  }

  function savedValue(profile, key, control, custom) {
    if (key.startsWith("custom")) return custom.get(key.slice(key.indexOf(":") + 1)) ?? "";
    if (key === "skills" && control instanceof HTMLInputElement) {
      return (profile.skills ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(", ");
    }
    if (key === "fullName") return profile.fullName || [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ");
    if (key === "streetAddress") return [profile.address1, profile.address2].filter(Boolean)
      .join(control instanceof HTMLTextAreaElement ? "\n" : ", ");
    if (!birthFields.has(key)) return profile[key] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate ?? "")) return "";
    if (key === "birthDate") return formatDate(profile.birthDate, control);
    const [year, month, day] = profile.birthDate.split("-");
    const part = { birthDay: day, birthMonth: month, birthYear: year }[key];
    return control.type === "number" ? String(Number(part)) : part;
  }

  function optionValue(control, key, value) {
    const candidates = new Set([clean(value)]);
    if (key === "birthMonth") {
      const month = new Date(Date.UTC(2000, Number(value) - 1));
      for (const monthFormat of ["long", "short"]) {
        candidates.add(clean(new Intl.DateTimeFormat("en", { month: monthFormat, timeZone: "UTC" }).format(month)));
      }
    }
    if (key === "birthDay" || key === "birthMonth") candidates.add(String(Number(value)));
    const options = Array.from(control.options).filter((option) =>
      option.value && !option.disabled && !option.closest("optgroup")?.disabled,
    );
    for (const option of options) {
      if (key === "experience") {
        const years = option.label.trim().match(/^(\d+(?:\.\d+)?)\s*(?:years?|yrs?)?$/i)?.[1];
        if (years !== undefined && Number(years) === Number(value)) return option.value;
      } else if (key.startsWith("custom") ? option.label.trim().toLowerCase() === value.toLowerCase() : candidates.has(clean(option.label))) {
        return option.value;
      }
    }
    if (key === "birthDay" || key === "birthMonth") return "";
    return options.find((option) => value.toLowerCase() === option.value.toLowerCase())?.value ?? "";
  }

  return { links, fieldHints, fieldKey, isEmptyControl, savedValue, optionValue, needsBirthConfirmation, customValues, normalizeCustomLabel };
})();
