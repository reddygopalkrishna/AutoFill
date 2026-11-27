(() => {
  const { links, fieldHints, fieldKey, isEmptyControl, savedValue, optionValue, needsBirthConfirmation, customValues } = PasteMatching;
  const setters = [HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement].map((type) => [
    type, Object.getOwnPropertyDescriptor(type.prototype, "value").set,
  ]);
  let profile;
  let custom;
  let pointer;
  let tab;
  let activity = 0;
  let closePrompt;
  let promptStyles;

  function useProfile(value) {
    profile = value ?? {};
    custom = customValues(profile);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.profile) {
      useProfile(changes.profile.newValue);
      closePrompt?.();
    }
  });
  const profileReady = chrome.storage.local.get("profile").then((saved) => {
    if (!profile) useProfile(saved.profile);
  }, () => { if (!profile) useProfile(); });

  function activeControl() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  function controlAtPointer(event) {
    for (const node of event.composedPath()) {
      if (!(node instanceof Element)) continue;
      if (node.matches("input, textarea, select")) return node;
      if (node.matches("a[href], button, [role='button']")) return null;
      if (node instanceof HTMLLabelElement) return node.control;
    }
    return null;
  }

  function setValue(control, key, value) {
    if (!isEmptyControl(control) || !value) return;
    if (control instanceof HTMLSelectElement) value = optionValue(control, key, value);
    if (!value || (control.maxLength >= 0 && value.length > control.maxLength)) return;

    // The native setter lets libraries that track assignments observe the input event.
    const setter = setters.find(([type]) => control instanceof type)[1];
    const previous = control.value;
    const previousIndex = control.selectedIndex;
    setter.call(control, value);
    if (control.value !== value || !control.validity.valid) {
      if (control instanceof HTMLSelectElement) control.selectedIndex = previousIndex;
      else setter.call(control, previous);
      return;
    }
    control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  function showPrompt(title, choices, onChoose) {
    const host = document.createElement("div");
    host.style.setProperty("display", "contents", "important");
    const shadow = host.attachShadow({ mode: "closed" });
    const dialog = document.createElement("dialog");
    const heading = document.createElement("h2");
    const actions = document.createElement("div");
    heading.id = "paste-dialog-title";
    heading.textContent = title;
    dialog.setAttribute("aria-labelledby", heading.id);
    actions.className = "actions";
    dialog.append(heading, actions);
    shadow.append(dialog);

    promptStyles ??= new CSSStyleSheet();
    if (!promptStyles.cssRules.length) promptStyles.replaceSync(`
      dialog {
        color: #1d2939; background: #fff; border: 1px solid #cfd9e4; border-radius: 16px;
        box-shadow: 0 20px 60px #14233530; box-sizing: border-box;
        font: 15px/1.4 system-ui, sans-serif; padding: 20px;
        width: max-content; max-width: calc(100vw - 24px); max-height: calc(100% - 24px);
        overflow: auto;
      }
      dialog::backdrop { background: #1018284d; }
      h2 { margin: 0 0 16px; font-size: 17px; }
      .actions { display: flex; flex-wrap: wrap; justify-content: end; gap: 8px; }
      button {
        appearance: none; background: #edf3f8; border: 1px solid transparent;
        border-radius: 8px; color: #163556; cursor: pointer; font: inherit;
        font-weight: 600; min-height: 36px; padding: 5px 12px;
      }
      button:hover { background: #dceaf6; }
      button:focus-visible { outline: 2px solid #1865b7; outline-offset: 2px; }
      .cancel { background: #fff; border-color: #cfd9e4; }
    `);
    shadow.adoptedStyleSheets = [promptStyles];

    function close() {
      if (closePrompt !== close) return;
      closePrompt = undefined;
      if (dialog.open) dialog.close();
      host.remove();
    }

    for (const [key, label] of [...choices, [null, "Cancel"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (!key) {
        button.className = "cancel";
        button.autofocus = true;
      }
      button.addEventListener("click", (event) => {
        if (!event.isTrusted || closePrompt !== close || !dialog.open) return;
        close();
        if (key) onChoose(key);
      });
      actions.append(button);
    }

    closePrompt = close;
    dialog.addEventListener("close", close, { once: true });
    (document.body ?? document.documentElement).append(host);
    try {
      dialog.showModal();
    } catch {
      close();
    }
  }

  function fill(control, hints, gesture) {
    if (activity !== gesture || closePrompt || activeControl() !== control ||
        !document.hasFocus() || !isEmptyControl(control)) return;
    const currentKey = () => fieldKey(control, fieldHints(control), custom);
    const key = fieldKey(control, hints, custom);
    if (!key || currentKey() !== key) return;
    const value = savedValue(profile, key, control, custom);

    function onChoose(choice) {
      if (activeControl() === control && isEmptyControl(control) && currentKey() === key) {
        setValue(control, choice, savedValue(profile, choice, control, custom));
      }
    }

    if (key === "website") {
      const choices = Object.entries(links).filter(([name]) => profile[name]);
      if (choices.length) showPrompt("Choose a saved link", choices, onChoose);
    } else if (needsBirthConfirmation(key)) {
      if (value) showPrompt("Fill your saved date of birth?", [[key, "Fill date of birth"]], onChoose);
    } else {
      setValue(control, key, value);
    }
  }

  function fillWhenReady(control, hints, gesture) {
    if (!hints) return;
    if (profile) fill(control, hints, gesture);
    else void profileReady.then(() => fill(control, hints, gesture));
  }

  window.addEventListener("pointerdown", (event) => {
    if (!event.isTrusted || !event.isPrimary || event.button !== 0) return;
    const gesture = ++activity;
    const control = controlAtPointer(event);
    const hints = isEmptyControl(control) ? fieldHints(control) : null;
    pointer = hints ? { control, hints, gesture, id: event.pointerId, released: false } : undefined;
  }, true);

  window.addEventListener("pointerup", (event) => {
    if (!event.isTrusted || !pointer || event.pointerId !== pointer.id) return;
    if (controlAtPointer(event) === pointer.control) pointer.released = true;
    else pointer = undefined;
  }, true);

  window.addEventListener("pointercancel", (event) => {
    if (event.isTrusted) pointer = undefined;
  }, true);

  window.addEventListener("click", (event) => {
    if (!event.isTrusted || event.button !== 0 || !pointer?.released) return;
    const intent = pointer;
    pointer = undefined;
    if (event.pointerId !== intent.id || controlAtPointer(event) !== intent.control) return;
    setTimeout(() => {
      if (!event.defaultPrevented) fillWhenReady(intent.control, intent.hints, intent.gesture);
    }, 0);
  }, true);

  window.addEventListener("keydown", (event) => {
    if (!event.isTrusted) return;
    const gesture = ++activity;
    pointer = undefined;
    if (closePrompt || event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const intent = { event, start: activeControl(), target: null, hints: null, valid: true, departure: null };
    tab = intent;
    setTimeout(() => {
      if (tab !== intent) return;
      tab = undefined;
      if (intent.valid && !event.defaultPrevented) fillWhenReady(intent.target, intent.hints, gesture);
    }, 0);
  }, true);

  function recordDeparture(event) {
    if (!event.isTrusted) return;
    if (event.target === window) {
      activity += 1;
      pointer = undefined;
    } else if (tab) {
      tab.departure = event;
      if (tab.event.eventPhase !== Event.NONE) tab.valid = false;
    }
  }

  window.addEventListener("blur", recordDeparture, true);
  window.addEventListener("focusout", recordDeparture, true);
  window.addEventListener("focus", (event) => {
    if (!event.isTrusted || !tab || event.target === window) return;
    const target = event.composedPath()[0];
    // A nested .focus() during keydown or blur has an event still dispatching.
    if (tab.target || target === tab.start || tab.event.eventPhase !== Event.NONE ||
        (tab.departure && tab.departure.eventPhase !== Event.NONE)) {
      tab.valid = false;
    }
    tab.target = target;
    if (tab.valid) tab.hints = fieldHints(target);
  }, true);
})();
