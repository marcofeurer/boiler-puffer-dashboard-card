class DashboardCard extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; min-width: 0; }
      ::slotted(.dependency-message) { padding: 16px; }
    `;
    root.append(style, document.createElement("slot"));
  }

  static getStubConfig() {
    return {};
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  setConfig(config) {
    const buttonConfig = structuredClone(BUTTON_CONFIG);
    applyEntityOverrides(buttonConfig.variables.entitaeten, config.entitaeten);
    const tanks = Object.entries(STORAGES).map(([key, settings]) => ({
      key, ...getTankConfig(config, key, settings, buttonConfig.variables.entitaeten[key]),
    }));
    const layout = getStorageLayout(tanks);
    buttonConfig.variables.storage_layout = layout;
    const fields = buttonConfig.styles.custom_fields;
    if (layout.extraHeight) {
      resizeActionAreas(fields, layout);
    }
    const sensors = layout.tanks.flatMap(tank => tank.sensors);
    if (sensors.length) {
      buttonConfig.entity = sensors[0].entity;
      buttonConfig.triggers_update.push(...new Set(sensors.map(sensor => sensor.entity)));
    }
    const { card: detailsCard } = buttonConfig.custom_fields.sensor_8;
    for (const tank of layout.tanks) {
      for (const [index, { entity, labelY }] of tank.sensors.entries()) {
        const field = `${tank.key}_sensor_${index}`;
        buttonConfig.custom_fields[field] = { card: { ...structuredClone(detailsCard), entity } };
        const center = labelY - layout.rowOffset + layout.rowHeight / 2;
        fields[field] = [
          { position: "absolute" },
          { left: percentOf(STORAGES[tank.key].x + 331.5, 1000) },
          { width: "21.5%" },
          { top: percentOf(center, layout.cardHeight) },
          { height: percentOf(layout.rowHeight, layout.cardHeight) },
          { transform: "translate(-50%, -50%)" },
          { "pointer-events": "auto" },
          { "z-index": 5 },
        ];
      }
    }
    this._buttonConfig = buttonConfig;
    this._configureButtonCard();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._buttonCard) {
      this._buttonCard.hass = hass;
    }
  }

  set preview(preview) {
    this._preview = preview;
    if (this._buttonCard) {
      this._buttonCard.preview = preview;
    }
  }

  getCardSize() {
    return this._buttonCard?.getCardSize() ?? 3;
  }

  getGridOptions() {
    return { ...BUTTON_CONFIG.grid_options };
  }

  _configureButtonCard() {
    if (!customElements.get("button-card")) {
      if (!this._waitingForButtonCard) {
        this._waitingForButtonCard = true;
        this._showMessage("Installiere „Button Card“ in HACS und lade das Dashboard neu.");
        customElements.whenDefined("button-card").then(() => {
          try {
            this._configureButtonCard();
          } catch (error) {
            this._showMessage(error.message);
          }
        });
      }
      return;
    }

    const buttonCard = this._buttonCard ?? document.createElement("button-card");
    buttonCard.setConfig(this._buttonConfig);
    buttonCard.preview = this._preview ?? false;
    if (this._hass) {
      buttonCard.hass = this._hass;
    }
    if (!this._buttonCard) {
      this._buttonCard = buttonCard;
      this.replaceChildren(buttonCard);
    }
  }

  _showMessage(message) {
    const card = document.createElement("ha-card");
    card.className = "dependency-message";
    card.setAttribute("role", "status");
    card.textContent = message;
    this.replaceChildren(card);
  }
}

function isMapping(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function applyEntityOverrides(entities, overrides) {
  if (overrides == null) {
    return;
  }
  if (!isMapping(overrides)) {
    throw new Error("„entitaeten“ muss eine Zuordnung aus Gruppen und Entitäts-IDs sein.");
  }

  for (const [group, values] of Object.entries(overrides)) {
    if (!Object.hasOwn(entities, group)) {
      throw new Error(`Unbekannte Entitätsgruppe „${group}“.`);
    }
    if (!isMapping(values)) {
      throw new Error(`Die Entitätsgruppe „${group}“ muss eine Zuordnung sein.`);
    }
    for (const [key, entityId] of Object.entries(values)) {
      if (!Object.hasOwn(entities[group], key)) {
        throw new Error(`Unbekannte Entitätszuordnung „${group}.${key}“.`);
      }
      if (typeof entityId !== "string" || !ENTITY_ID.test(entityId)) {
        throw new Error(`Ungültige Entitäts-ID für „${group}.${key}“.`);
      }
      entities[group][key] = entityId;
    }
  }
}

const STORAGES = {
  boiler: {
    label: "Boiler",
    x: 24,
    heightMm: 1410,
    defaults: [
      { entityKey: "temperatur_hf2", name: "HF2", heightKey: "hf2_mm", heightMm: 1140 },
      { entityKey: "temperatur_bf1", name: "BF1", heightKey: "bf1_mm", heightMm: 1140 },
      { entityKey: "temperatur_hf1", name: "HF1", heightKey: "hf1_mm", heightMm: 525 },
    ],
  },
  puffer: {
    label: "Pufferspeicher",
    x: 512,
    heightMm: 1000,
    defaults: [
      { entityKey: "temperatur_pf2_oben", name: "PF2 · oben", position: 0.9 },
      { entityKey: "temperatur_hf2", name: "HF2", position: 0.6311294765840221 },
      { entityKey: "temperatur_hf1", name: "HF1", position: 0.36446280991735536 },
      { entityKey: "temperatur_pf1_unten", name: "PF1 · unten", position: 0.1 },
    ],
  },
};
const DEFAULT_LAYOUT = { tankTop: 247, tankHeight: 310, cardHeight: 1080, rowHeight: 47, rowOffset: 25 };

function getTankConfig(config, key, settings, entities) {
  const heightKey = `${key}_hoehen`;
  const listKey = `${key}_fuehler`;
  const overrides = config[heightKey] ?? {};
  if (!isMapping(overrides)) {
    throw new Error(`„${heightKey}“ muss eine Zuordnung mit Höhen in Millimetern sein.`);
  }

  const heights = { speicher_mm: settings.heightMm };
  for (const sensor of settings.defaults) {
    if (sensor.heightKey) heights[sensor.heightKey] = sensor.heightMm;
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(heights, name)) {
      throw new Error(`Unbekannte Speicherhöhe „${heightKey}.${name}“.`);
    }
    heights[name] = value;
  }
  const tankHeightMm = heights.speicher_mm;
  if (!Number.isSafeInteger(tankHeightMm) || tankHeightMm < 1) {
    throw new Error(`„${heightKey}.speicher_mm“ muss eine positive ganze Zahl sein.`);
  }
  const customSensors = Object.hasOwn(config, listKey);
  const sensors = customSensors ? config[listKey] : settings.defaults.map(sensor => ({
    entitaet: entities[sensor.entityKey],
    name: sensor.name,
    hoehe_mm: sensor.heightKey ? heights[sensor.heightKey] : Math.round(sensor.position * tankHeightMm),
  }));

  if (!Array.isArray(sensors)) {
    throw new Error(`„${listKey}“ muss eine Liste sein.`);
  }
  for (const [index, sensor] of sensors.entries()) {
    const path = customSensors ? `${listKey}[${index}]` : `${heightKey}.${settings.defaults[index].heightKey ?? "speicher_mm"}`;
    if (!isMapping(sensor) || typeof sensor.entitaet !== "string" || !ENTITY_ID.test(sensor.entitaet)) {
      throw new Error(`„${path}“ benötigt eine gültige Entitäts-ID.`);
    }
    if (sensor.name !== undefined && typeof sensor.name !== "string") {
      throw new Error(`„${path}.name“ muss ein Text sein.`);
    }
    if (!Number.isSafeInteger(sensor.hoehe_mm) || sensor.hoehe_mm < 0 || sensor.hoehe_mm > tankHeightMm) {
      throw new Error(`Die Fühlerhöhe in „${path}“ muss eine ganze Zahl zwischen 0 und ${tankHeightMm} sein.`);
    }
  }
  return { tankHeightMm, sensors, customSensors };
}

function getStorageLayout(tanks) {
  const layout = { ...DEFAULT_LAYOUT };
  const gap = layout.rowHeight + 11;
  const topMargin = 8;
  const maxSensorCount = Math.max(...tanks.map(tank => tank.sensors.length));
  layout.extraHeight = Math.max(0, topMargin + (maxSensorCount - 1) * gap - layout.tankHeight);
  layout.cardHeight += layout.extraHeight;
  const minY = layout.tankTop + topMargin;
  const bottomY = layout.tankTop + layout.tankHeight + layout.extraHeight;
  layout.tanks = tanks.map(({ key, tankHeightMm, sensors, customSensors }) => {
    const entries = sensors.map(({ entitaet, name, hoehe_mm }, index) => {
      const original = !customSensors ? STORAGES[key].defaults[index].position : undefined;
      const position = original ?? hoehe_mm / tankHeightMm;
      const tankY = layout.tankTop + layout.tankHeight * (1 - position);
      // Ein JSON-String bleibt in Button Card ein Textwert, auch bei Namen in Template-Syntax.
      return { entity: entitaet, name: JSON.stringify(name ?? ""), position, tankY };
    });
    placeSensorLabels(entries, gap, minY, bottomY);
    return { key, x: STORAGES[key].x, sensors: entries, customSensors };
  });
  return layout;
}

function placeSensorLabels(sensors, gap, minY, bottomY) {
  // Bei nahen Messpunkten die Werteboxen mit Mindestabstand um die Markierungen verteilen.
  const ordered = [...sensors].sort((a, b) => a.tankY - b.tankY);
  const groups = [];
  for (const [index, sensor] of ordered.entries()) {
    const group = { sensors: [sensor], y: sensor.tankY - index * gap };
    while (groups.length && groups.at(-1).y > group.y) {
      const previous = groups.pop();
      const total = previous.sensors.length + group.sensors.length;
      group.y = (previous.y * previous.sensors.length + group.y * group.sensors.length) / total;
      group.sensors.unshift(...previous.sensors);
    }
    groups.push(group);
  }

  const maxY = bottomY - (ordered.length - 1) * gap;
  let index = 0;
  for (const group of groups) {
    const y = Math.min(maxY, Math.max(minY, group.y));
    for (const sensor of group.sensors) {
      sensor.labelY = y + index * gap;
      index += 1;
    }
  }
}

function percentOf(pixels, total) {
  return `${pixels / total * 100}%`;
}

function resizeActionAreas(fields, layout) {
  const tankBottom = layout.tankTop + layout.tankHeight;
  for (const styles of Object.values(fields)) {
    for (const style of styles) {
      if (Object.hasOwn(style, "top")) {
        const y = parseFloat(style.top) / 100 * DEFAULT_LAYOUT.cardHeight;
        style.top = percentOf(y > tankBottom ? y + layout.extraHeight : y, layout.cardHeight);
      }
      if (Object.hasOwn(style, "height")) {
        const height = parseFloat(style.height) / 100 * DEFAULT_LAYOUT.cardHeight;
        style.height = percentOf(height, layout.cardHeight);
      }
    }
  }
}

const STORAGE_ENTITY_FIELDS = [
  { key: "heizanforderung", label: "Heizanforderung", list: "schaltzustaende" },
  { key: "ueberschussbetrieb", label: "Überschussbetrieb", list: "betriebsarten" },
  { key: "heizstab_status", label: "Heizstab-Status", list: "betriebsarten" },
  { key: "heizstab_leistung", label: "Heizstab-Leistung", list: "messwerte" },
];
const EDITOR_GROUPS = {
  boiler: { label: STORAGES.boiler.label, fields: STORAGE_ENTITY_FIELDS },
  puffer: { label: STORAGES.puffer.label, fields: STORAGE_ENTITY_FIELDS },
  heizung: {
    label: "Heizung",
    fields: [
      { key: "waermepumpe_vorlauf", label: "Wärmepumpe · Vorlauftemperatur", list: "messwerte" },
      { key: "waermepumpe_ruecklauf", label: "Wärmepumpe · Rücklauftemperatur", list: "messwerte" },
      { key: "heizkreis_vorlauf_soll", label: "Heizkreis · Vorlauf-Solltemperatur", list: "messwerte" },
    ],
  },
  zirkulation: {
    label: "Warmwasserzirkulation",
    fields: [
      { key: "ruecklauf_temperatur", label: "Rücklauftemperatur", list: "messwerte" },
      { key: "pumpe_relais", label: "Pumpenrelais", list: "schaltzustaende" },
      { key: "startskript", label: "Startskript", list: "skripte" },
    ],
  },
};
const ENTITY_LISTS = {
  temperatur: ["sensor", "number", "input_number"],
  messwerte: ["sensor", "number", "input_number"],
  schaltzustaende: ["binary_sensor", "switch", "input_boolean", "sensor"],
  betriebsarten: ["sensor", "climate", "water_heater", "select", "input_select", "number", "input_number"],
  skripte: ["script"],
};

class DashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; }
        p { margin: 0 0 16px; color: var(--secondary-text-color, currentColor); }
        fieldset { min-width: 0; margin: 0 0 16px; padding: 12px; border: 1px solid var(--divider-color, #8195a3); border-radius: 8px; }
        legend { font-weight: 600; }
        .entity-fields { display: grid; gap: 12px; }
        .storage-settings { margin-top: 12px; }
        .storage-settings[open] > summary { margin-bottom: 12px; }
        .storage-settings > p { margin: 0 0 12px; }
        .tank-height { max-width: 180px; margin-bottom: 12px; }
        .sensor { padding: 12px 0; border-top: 1px solid var(--divider-color, #8195a3); }
        .sensor-fields { display: grid; gap: 8px 12px; grid-template-columns: minmax(0, 1fr) minmax(0, 120px); }
        .entity { grid-column: 1 / -1; }
        summary { cursor: pointer; color: var(--primary-color, currentColor); }
        label { display: grid; gap: 6px; }
        input {
          box-sizing: border-box;
          width: 100%;
          min-height: 40px;
          padding: 8px 12px;
          font: inherit;
          color: inherit;
          background: var(--card-background-color, transparent);
          border: 1px solid var(--divider-color, #8195a3);
          border-radius: 8px;
        }
        input:invalid { border-color: var(--error-color, #c23b4f); }
        input:placeholder-shown { border-color: var(--divider-color, #8195a3); }
        button { margin-top: 8px; padding: 8px 12px; font: inherit; color: inherit; background: transparent; border: 1px solid var(--divider-color, #8195a3); border-radius: 8px; cursor: pointer; }
      </style>
      ${Object.keys(ENTITY_LISTS).map(key => `<datalist id="ents-${key}"></datalist>`).join("")}
      <template id="sensor-fields">
        <div class="sensor-fields">
          <label class="entity">Temperatur-Entität<input name="entitaet" list="ents-temperatur" pattern="[a-z0-9_]+[.][a-z0-9_]+" placeholder="Temperatur-Entität suchen" autocomplete="off" required></label>
          <label>Name (optional)<input name="name"></label>
          <label>Höhe (mm)<input name="hoehe_mm" type="number" min="0" step="1" placeholder="0" required></label>
        </div>
      </template>
      ${Object.entries(EDITOR_GROUPS).map(([key, { label, fields }]) => `
        <fieldset id="${key}">
          <legend>${label}</legend>
          <div class="entity-fields">
            ${fields.map(field => `
              <label>${field.label}<input name="${field.key}" list="ents-${field.list}" pattern="[a-z0-9_]+[.][a-z0-9_]+" placeholder="Entität suchen" autocomplete="off"></label>
            `).join("")}
          </div>
          ${Object.hasOwn(STORAGES, key) ? `
            <details class="storage-settings">
              <summary>Speicherhöhe und Temperaturfühler</summary>
              <p>Fühlerhöhen in Millimetern ab Speicherboden.</p>
              <label class="tank-height">Speicherhöhe (mm)<input name="speicher_mm" type="number" min="1" max="${Number.MAX_SAFE_INTEGER}" step="1" required></label>
              <p class="empty" hidden>Keine Fühler eingetragen.</p>
              <div class="sensors"></div>
              <details class="add-sensor">
                <summary>Fühler hinzufügen</summary>
                <form><button type="submit">Hinzufügen</button></form>
              </details>
            </details>
          ` : ""}
        </fieldset>
      `).join("")}
    `;
    this._fields = root.getElementById("sensor-fields");
    this._sections = Object.fromEntries(Object.keys(STORAGES).map(key => [key, root.getElementById(key)]));
    this._entityFields = Object.fromEntries(Object.keys(EDITOR_GROUPS).map(key => [
      key, [...root.querySelectorAll(`#${key} .entity-fields input`)],
    ]));
    this._suggestionSignatures = new Map();
    this._tanks = {};
    for (const [key, fields] of Object.entries(this._entityFields)) {
      for (const input of fields) {
        input.addEventListener("change", () => this._changeEntity(key, input));
      }
    }
    for (const [key, section] of Object.entries(this._sections)) {
      const height = section.querySelector('[name="speicher_mm"]');
      height.addEventListener("change", () => {
        if (!height.reportValidity() || height.valueAsNumber === this._tanks[key].tankHeightMm) return;
        const heightKey = `${key}_hoehen`;
        this._save({ [heightKey]: { ...this._config[heightKey], speicher_mm: height.valueAsNumber } });
      });
      const form = section.querySelector("form");
      form.prepend(this._fields.content.cloneNode(true));
      form.addEventListener("submit", event => {
        event.preventDefault();
        const sensor = {
          entitaet: form.elements.entitaet.value,
          name: form.elements.name.value.trim(),
          hoehe_mm: form.elements.hoehe_mm.valueAsNumber,
        };
        this._saveSensors(key, [...this._tanks[key].sensors, sensor]);
        form.reset();
        const add = form.closest("details");
        add.open = false;
        add.querySelector("summary").focus();
      });
    }
  }

  set hass(hass) {
    const entities = Object.entries(hass?.states ?? {}).map(([id, { attributes }]) => ({
      id,
      domain: id.split(".")[0],
      name: String(attributes?.friendly_name || id),
      temperature: attributes?.device_class === "temperature" || ["°C", "°F", "K"].includes(attributes?.unit_of_measurement),
    }));
    for (const [key, domains] of Object.entries(ENTITY_LISTS)) {
      const matches = entities.filter(entity => domains.includes(entity.domain) && (key !== "temperatur" || entity.temperature));
      const signature = JSON.stringify(matches.map(({ id, name }) => [id, name]));
      if (this._suggestionSignatures.get(key) === signature) continue;
      this._suggestionSignatures.set(key, signature);
      const options = document.createDocumentFragment();
      matches.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
      for (const { id, name } of matches) {
        const option = document.createElement("option");
        option.value = id;
        option.label = name;
        options.append(option);
      }
      this.shadowRoot.getElementById(`ents-${key}`).replaceChildren(options);
    }
  }

  setConfig(config) {
    const entities = structuredClone(BUTTON_CONFIG.variables.entitaeten);
    applyEntityOverrides(entities, config.entitaeten);
    this._tanks = Object.fromEntries(Object.entries(STORAGES).map(([key, settings]) => [
      key, getTankConfig(config, key, settings, entities[key]),
    ]));
    this._config = config;
    for (const [key, fields] of Object.entries(this._entityFields)) {
      for (const input of fields) {
        const value = config.entitaeten?.[key]?.[input.name] ?? "";
        if (input.value !== value) input.value = value;
      }
    }
    for (const [key, tank] of Object.entries(this._tanks)) {
      this._renderTank(key, tank);
    }
  }

  _changeEntity(group, input) {
    input.value = input.value.trim();
    if (!input.reportValidity()) return;
    const assigned = this._config.entitaeten ?? {};
    const current = assigned[group] ?? {};
    if (input.value === (current[input.name] ?? "")) return;
    const updated = { ...current };
    if (input.value) {
      updated[input.name] = input.value;
    } else {
      delete updated[input.name];
    }
    const entitaeten = { ...assigned };
    if (Object.keys(updated).length) {
      entitaeten[group] = updated;
    } else {
      delete entitaeten[group];
    }
    this._save({ entitaeten });
  }

  _renderTank(key, { tankHeightMm, sensors, customSensors }) {
    const section = this._sections[key];
    const height = section.querySelector('[name="speicher_mm"]');
    height.value = tankHeightMm;
    height.min = customSensors || key === "boiler"
      ? sensors.reduce((max, sensor) => Math.max(max, sensor.hoehe_mm), 1)
      : 1;
    section.querySelector("form").elements.hoehe_mm.max = tankHeightMm;
    section.querySelector(".empty").hidden = sensors.length > 0;
    const list = section.querySelector(".sensors");
    if (list.children.length !== sensors.length) {
      list.replaceChildren(...sensors.map((_, index) => this._createSensorRow(key, index)));
    }
    for (const [index, sensor] of sensors.entries()) {
      const row = list.children[index];
      row.querySelector('[name="entitaet"]').value = sensor.entitaet;
      row.querySelector('[name="name"]').value = sensor.name ?? "";
      const heightInput = row.querySelector('[name="hoehe_mm"]');
      heightInput.value = sensor.hoehe_mm;
      heightInput.max = tankHeightMm;
      row.querySelector("button").setAttribute("aria-label", `Fühler ${sensor.name || sensor.entitaet} entfernen`);
    }
  }

  _createSensorRow(key, index) {
    const row = document.createElement("div");
    row.className = "sensor";
    row.append(this._fields.content.cloneNode(true));
    row.addEventListener("change", ({ target: input }) => {
      if (!input.reportValidity()) return;
      const sensors = [...this._tanks[key].sensors];
      const value = input.type === "number" ? input.valueAsNumber : input.value.trim();
      if (sensors[index][input.name] === value) return;
      sensors[index] = { ...sensors[index], [input.name]: value };
      this._saveSensors(key, sensors);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Entfernen";
    remove.addEventListener("click", () => {
      this._saveSensors(key, this._tanks[key].sensors.filter((_, position) => position !== index));
      this._sections[key].querySelector(".add-sensor > summary").focus();
    });
    row.append(remove);
    return row;
  }

  _saveSensors(key, sensors) {
    this._save({ [`${key}_fuehler`]: sensors });
  }

  _save(patch) {
    const config = { ...this._config, ...patch };
    this.setConfig(config);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
}

// Lovelace-Konfiguration der zugrunde liegenden Button Card.
const BUTTON_CONFIG = {
  "type": "custom:button-card",
  "variables": {
    "entitaeten": {
      "boiler": {
        "temperatur_bf1": "sensor.beispiel_boiler_temperatur_bf1",
        "temperatur_hf1": "sensor.beispiel_boiler_temperatur_hf1",
        "temperatur_hf2": "sensor.beispiel_boiler_temperatur_hf2",
        "heizanforderung": "binary_sensor.beispiel_boiler_heizanforderung",
        "ueberschussbetrieb": "sensor.beispiel_boiler_ueberschussbetrieb",
        "heizstab_status": "sensor.beispiel_boiler_heizstab_status",
        "heizstab_leistung": "sensor.beispiel_boiler_heizstab_leistung"
      },
      "puffer": {
        "temperatur_pf2_oben": "sensor.beispiel_puffer_temperatur_pf2_oben",
        "temperatur_pf1_unten": "sensor.beispiel_puffer_temperatur_pf1_unten",
        "temperatur_hf1": "sensor.beispiel_puffer_temperatur_hf1",
        "temperatur_hf2": "sensor.beispiel_puffer_temperatur_hf2",
        "heizanforderung": "binary_sensor.beispiel_puffer_heizanforderung",
        "ueberschussbetrieb": "sensor.beispiel_puffer_ueberschussbetrieb",
        "heizstab_status": "sensor.beispiel_puffer_heizstab_status",
        "heizstab_leistung": "sensor.beispiel_puffer_heizstab_leistung"
      },
      "heizung": {
        "waermepumpe_vorlauf": "sensor.beispiel_heizung_waermepumpe_vorlauf",
        "waermepumpe_ruecklauf": "sensor.beispiel_heizung_waermepumpe_ruecklauf",
        "heizkreis_vorlauf_soll": "sensor.beispiel_heizung_heizkreis_vorlauf_soll"
      },
      "zirkulation": {
        "ruecklauf_temperatur": "sensor.beispiel_zirkulation_ruecklauf_temperatur",
        "pumpe_relais": "switch.beispiel_zirkulation_pumpe_relais",
        "startskript": "script.beispiel_zirkulation_startskript"
      }
    }
  },
  "triggers_update": [
    "[[[ return variables.entitaeten.boiler.heizstab_leistung; ]]]",
    "[[[ return variables.entitaeten.puffer.heizanforderung; ]]]",
    "[[[ return variables.entitaeten.puffer.ueberschussbetrieb; ]]]",
    "[[[ return variables.entitaeten.heizung.waermepumpe_vorlauf; ]]]",
    "[[[ return variables.entitaeten.heizung.waermepumpe_ruecklauf; ]]]",
    "[[[ return variables.entitaeten.boiler.heizanforderung; ]]]",
    "[[[ return variables.entitaeten.boiler.ueberschussbetrieb; ]]]",
    "[[[ return variables.entitaeten.boiler.heizstab_status; ]]]",
    "[[[ return variables.entitaeten.heizung.heizkreis_vorlauf_soll; ]]]",
    "[[[ return variables.entitaeten.puffer.heizstab_leistung; ]]]",
    "[[[ return variables.entitaeten.puffer.heizstab_status; ]]]",
    "[[[ return variables.entitaeten.zirkulation.ruecklauf_temperatur; ]]]",
    "[[[ return variables.entitaeten.zirkulation.pumpe_relais; ]]]"
  ],
  "show_name": false,
  "show_icon": false,
  "show_state": false,
  "grid_options": {
    "columns": "full",
    "rows": "auto"
  },
  "tap_action": {
    "action": "none"
  },
  "hold_action": {
    "action": "none"
  },
  "custom_fields": {
    "dashboard": [
      "[[[",
      "",
      "/* Temperatur-Offsets in °C – hier zentral anpassen */",
      "const offsetBoilerHF2 = 0;",
      "const offsetPufferHF2 = 0;",
      "",
      "/* Ungültige Messwerte bleiben ungültig */ const addOffset = (value, offset) =>",
      "  Number.isFinite(value) ? value + offset : value;",
      "const ids = variables.entitaeten;",
      "const storageLayout = variables.storage_layout;",
      "const readNumber = id => {",
      "  const value = String(states[id]?.state ?? '').trim();",
      "  return value ? Number(value.replace(',', '.')) : NaN;",
      "};",
      "const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;",
      "const tanks = storageLayout.tanks.map(tank => {",
      "  const offset = tank.key === 'boiler' ? offsetBoilerHF2 : offsetPufferHF2;",
      "  const grouped = new Map();",
      "  const sensors = tank.sensors.map(sensor => {",
      "    const { entity, position } = sensor;",
      "    const temperature = addOffset(readNumber(entity), entity === ids[tank.key].temperatur_hf2 ? offset : 0);",
      "    if (!grouped.has(position)) grouped.set(position, []);",
      "    if (Number.isFinite(temperature)) grouped.get(position).push(temperature);",
      "    return { ...sensor, temperature };",
      "  });",
      "  // Fühler auf derselben Höhe ergeben gemeinsam einen Messpunkt.",
      "  const points = Array.from(grouped, ([position, values]) => ({",
      "    position, temperature: values.length ? mean(values) : null",
      "  })).sort((a, b) => a.position - b.position);",
      "  return { ...tank, sensors, points };",
      "});",
      "const themedSvg = (()=>{",
      "",
      "",
      "const gradients = tanks.map(({ points, customSensors }) => {",
      "  const measured = points.filter(point => Number.isFinite(point.temperature));",
      "  if (!measured.length) return '';",
      "",
      "  // =====================================================",
      "  // PCHIP / STUFENLOSER GLT-VERLAUF",
      "  //",
      "  // Monotone kubische Interpolation (PCHIP/Fritsch-Carlson)",
      "  // für einen besonders glatten Temperaturverlauf.",
      "  //",
      "  // 31 GLT-Farbpunkte:",
      "  // Blau → Türkis → Grün → Gelbgrün →",
      "  // Gelb → Orange → Rot",
      "  // =====================================================",
      "",
      "  const tMin = 25;",
      "  const tMax = 55;",
      "",
      "  // =====================================================",
      "  // HILFSFUNKTIONEN",
      "  // =====================================================",
      "",
      "  const clamp = (value, min, max) => {",
      "    return Math.min(Math.max(value, min), max);",
      "  };",
      "",
      "  const lerp = (start, end, factor) => {",
      "    return start + (end - start) * factor;",
      "  };",
      "",
      "  // =====================================================",
      "  // 31-PUNKT-GLT-FARBPALETTE",
      "  // =====================================================",
      "",
      "  const colorAnchors = [",
      "    { temperature: 25, color: [  0,  70, 200] },",
      "    { temperature: 26, color: [  0,  81, 202] },",
      "    { temperature: 27, color: [  0, 108, 207] },",
      "    { temperature: 28, color: [  0, 142, 213] },",
      "    { temperature: 29, color: [  0, 169, 218] },",
      "    { temperature: 30, color: [  0, 180, 220] },",
      "    { temperature: 31, color: [  0, 180, 207] },",
      "    { temperature: 32, color: [  0, 180, 172] },",
      "    { temperature: 33, color: [  0, 180, 128] },",
      "    { temperature: 34, color: [  0, 180,  93] },",
      "    { temperature: 35, color: [  0, 180,  80] },",
      "    { temperature: 36, color: [ 14, 183,  72] },",
      "    { temperature: 37, color: [ 52, 190,  52] },",
      "    { temperature: 38, color: [ 98, 200,  28] },",
      "    { temperature: 39, color: [136, 207,   8] },",
      "    { temperature: 40, color: [150, 210,   0] },",
      "    { temperature: 41, color: [159, 211,   0] },",
      "    { temperature: 42, color: [183, 213,   0] },",
      "    { temperature: 43, color: [212, 217,   0] },",
      "    { temperature: 44, color: [236, 219,   0] },",
      "    { temperature: 45, color: [245, 220,   0] },",
      "    { temperature: 46, color: [246, 211,   0] },",
      "    { temperature: 47, color: [248, 187,   0] },",
      "    { temperature: 48, color: [252, 158,   0] },",
      "    { temperature: 49, color: [254, 134,   0] },",
      "    { temperature: 50, color: [255, 125,   0] },",
      "    { temperature: 51, color: [253, 115,   2] },",
      "    { temperature: 52, color: [248,  90,   7] },",
      "    { temperature: 53, color: [242,  60,  13] },",
      "    { temperature: 54, color: [237,  35,  18] },",
      "    { temperature: 55, color: [235,  25,  20] }",
      "  ];",
      "",
      "  const colorScale = (temperature) => {",
      "    const temp = clamp(temperature, tMin, tMax);",
      "",
      "    for (",
      "      let index = 0;",
      "      index < colorAnchors.length - 1;",
      "      index++",
      "    ) {",
      "      const lower = colorAnchors[index];",
      "      const upper = colorAnchors[index + 1];",
      "",
      "      if (",
      "        temp >= lower.temperature &&",
      "        temp <= upper.temperature",
      "      ) {",
      "        const factor =",
      "          (",
      "            temp - lower.temperature",
      "          ) /",
      "          (",
      "            upper.temperature -",
      "            lower.temperature",
      "          );",
      "",
      "        const red = Math.round(",
      "          lerp(lower.color[0], upper.color[0], factor)",
      "        );",
      "",
      "        const green = Math.round(",
      "          lerp(lower.color[1], upper.color[1], factor)",
      "        );",
      "",
      "        const blue = Math.round(",
      "          lerp(lower.color[2], upper.color[2], factor)",
      "        );",
      "",
      "        return `rgb(${red}, ${green}, ${blue})`;",
      "      }",
      "    }",
      "",
      "    const last =",
      "      colorAnchors[colorAnchors.length - 1].color;",
      "",
      "    return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;",
      "  };",
      "",
      "",
      "  // =====================================================",
      "  // MESSPUNKTE",
      "  //",
      "  // Die Randpunkte übernehmen die Temperatur des jeweils",
      "  // nächsten realen Fühlers.",
      "  // =====================================================",
      "",
      "  const sensorPoints = (customSensors ? measured : points).map(({ position, temperature }) => ({",
      "    position, temperature: temperature ?? lerp(tMin, tMax, position)",
      "  }));",
      "  const bottom = sensorPoints[0];",
      "  const top = sensorPoints.at(-1);",
      "  if (bottom.position > 0) sensorPoints.unshift({ ...bottom, position: 0 });",
      "  if (top.position < 1) sensorPoints.push({ ...top, position: 1 });",
      "",
      "  // =====================================================",
      "  // PCHIP / MONOTONE KUBISCHE INTERPOLATION",
      "  //",
      "  // Vorteile:",
      "  // - keine sichtbaren Knicke an den Fühlern",
      "  // - keine unkontrollierten Überschwinger",
      "  // - Schichtung bleibt formtreu",
      "  // =====================================================",
      "",
      "  const createPchip = (points) => {",
      "    const x = points.map(point => point.position);",
      "    const y = points.map(point => point.temperature);",
      "    const count = points.length;",
      "    if (count === 2) return position => clamp(lerp(y[0], y[1], position), tMin, tMax);",
      "",
      "    const h = [];",
      "    const delta = [];",
      "",
      "    for (let i = 0; i < count - 1; i++) {",
      "      h[i] = x[i + 1] - x[i];",
      "      delta[i] = (y[i + 1] - y[i]) / h[i];",
      "    }",
      "",
      "    const slope = new Array(count).fill(0);",
      "",
      "    // Innere Steigungen nach Fritsch-Carlson",
      "    for (let i = 1; i < count - 1; i++) {",
      "      if (",
      "        delta[i - 1] === 0 ||",
      "        delta[i] === 0 ||",
      "        Math.sign(delta[i - 1]) !== Math.sign(delta[i])",
      "      ) {",
      "        slope[i] = 0;",
      "      } else {",
      "        const w1 = 2 * h[i] + h[i - 1];",
      "        const w2 = h[i] + 2 * h[i - 1];",
      "",
      "        slope[i] =",
      "          (w1 + w2) /",
      "          (",
      "            w1 / delta[i - 1] +",
      "            w2 / delta[i]",
      "          );",
      "      }",
      "    }",
      "",
      "    // Randsteigung unten",
      "    slope[0] =",
      "      (",
      "        (2 * h[0] + h[1]) * delta[0] -",
      "        h[0] * delta[1]",
      "      ) /",
      "      (",
      "        h[0] + h[1]",
      "      );",
      "",
      "    if (Math.sign(slope[0]) !== Math.sign(delta[0])) {",
      "      slope[0] = 0;",
      "    } else if (",
      "      Math.sign(delta[0]) !== Math.sign(delta[1]) &&",
      "      Math.abs(slope[0]) > Math.abs(3 * delta[0])",
      "    ) {",
      "      slope[0] = 3 * delta[0];",
      "    }",
      "",
      "    // Randsteigung oben",
      "    const last = count - 1;",
      "",
      "    slope[last] =",
      "      (",
      "        (2 * h[last - 1] + h[last - 2]) *",
      "        delta[last - 1] -",
      "        h[last - 1] * delta[last - 2]",
      "      ) /",
      "      (",
      "        h[last - 1] + h[last - 2]",
      "      );",
      "",
      "    if (",
      "      Math.sign(slope[last]) !==",
      "      Math.sign(delta[last - 1])",
      "    ) {",
      "      slope[last] = 0;",
      "    } else if (",
      "      Math.sign(delta[last - 1]) !==",
      "      Math.sign(delta[last - 2]) &&",
      "      Math.abs(slope[last]) >",
      "      Math.abs(3 * delta[last - 1])",
      "    ) {",
      "      slope[last] = 3 * delta[last - 1];",
      "    }",
      "",
      "    return (position) => {",
      "      const p = clamp(position, x[0], x[last]);",
      "",
      "      let interval = last - 1;",
      "",
      "      for (let i = 0; i < last; i++) {",
      "        if (p >= x[i] && p <= x[i + 1]) {",
      "          interval = i;",
      "          break;",
      "        }",
      "      }",
      "",
      "      const width = h[interval];",
      "      const t = (p - x[interval]) / width;",
      "",
      "      const t2 = t * t;",
      "      const t3 = t2 * t;",
      "",
      "      const h00 = 2 * t3 - 3 * t2 + 1;",
      "      const h10 = t3 - 2 * t2 + t;",
      "      const h01 = -2 * t3 + 3 * t2;",
      "      const h11 = t3 - t2;",
      "",
      "      const value =",
      "        h00 * y[interval] +",
      "        h10 * width * slope[interval] +",
      "        h01 * y[interval + 1] +",
      "        h11 * width * slope[interval + 1];",
      "",
      "      // Sicherheit: keine unrealistischen Werte ausserhalb",
      "      // des Temperaturbereichs ausgeben.",
      "      return clamp(value, tMin, tMax);",
      "    };",
      "  };",
      "",
      "  const temperatureAtPosition =",
      "    createPchip(sensorPoints);",
      "",
      "",
      "  // =====================================================",
      "  // EXTREM FEINER CSS-VERLAUF",
      "  //",
      "  // 480 Stützstellen sind optisch praktisch stufenlos.",
      "  // =====================================================",
      "",
      "  const steps = 480;",
      "  const stops = [];",
      "",
      "  for (",
      "    let step = 0;",
      "    step <= steps;",
      "    step++",
      "  ) {",
      "    const position = step / steps;",
      "    const temperature =",
      "      temperatureAtPosition(position);",
      "",
      "    stops.push(",
      "      `${colorScale(temperature)} ${(position * 100).toFixed(3)}%`",
      "    );",
      "  }",
      "",
      "  return `linear-gradient(",
      "    to top,",
      "    ${stops.join(',')}",
      "  )`;",
      "});",
      "",
      "const averageOverHeight = measured => {",
      "  if (measured.length < 2) return NaN;",
      "  // Mittlere Temperatur über die Speicherhöhe. An den Rändern gilt der nächste Messwert.",
      "  let previous = measured[0];",
      "  let average = previous.position * previous.temperature;",
      "  for (const point of measured.slice(1)) {",
      "    average += (point.position - previous.position) * (point.temperature + previous.temperature) / 2;",
      "    previous = point;",
      "  }",
      "  return average + (1 - previous.position) * previous.temperature;",
      "};",
      "const indices = tanks.map(({ key, sensors, points, customSensors }) => {",
      "  const lower = key === 'boiler' ? 25 : readNumber(ids.heizung.heizkreis_vorlauf_soll);",
      "  const upper = 55;",
      "  if (!Number.isFinite(lower) || lower >= upper) return '—';",
      "  // Die bisherige Pufferkonfiguration gewichtet ihre vier Fühler gleich.",
      "  const average = key === 'puffer' && !customSensors",
      "    ? mean(sensors.map(sensor => sensor.temperature))",
      "    : averageOverHeight(points.filter(point => Number.isFinite(point.temperature)));",
      "  if (!Number.isFinite(average)) return '—';",
      "  const pct = (average - lower) / (upper - lower) * 100;",
      "  return Math.round(Math.min(100, Math.max(0, pct))) + ' %';",
      "});",
      "",
      "const pumpSvg = ((entity)=>{",
      "",
      "",
      "const relay = states[ids.zirkulation.pumpe_relais]?.state;",
      "",
      "const active = relay === 'on';",
      "",
      "const status = active ? 'Aktiv' : relay === 'off' ? 'Aus' : 'Nicht verfügbar';",
      "",
      "const raw = entity?.state;",
      "",
      "const value = raw == null || String(raw).trim() === '' ? NaN : Number(String(raw).replace(',', '.'));",
      "",
      "const temperature = Number.isFinite(value) ? value.toFixed(1).replace('.', ',') + ' °C' : '— °C';",
      "",
      "const tempColor = !Number.isFinite(value) ? '#808080' : value >= 45 ? '#E34D56' : value >= 30 ? '#D78414' : '#009BD0';",
      "",
      "const rotorColor = active ? '#00BFFF' : '#666666';",
      "",
      "const statusColor = active ? '#008EBF' : '#71808D';",
      "",
      "return `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 196\" style=\"display:block;width:100%;height:auto\" role=\"img\" aria-label=\"BWW-Zirkulationspumpe\">",
      "  <rect x=\"2\" y=\"2\" width=\"124\" height=\"192\" rx=\"17\" fill=\"#F7FAFC\" fill-opacity=\"0.95\" stroke=\"#DCE4EB\"/>",
      "  <g font-family=\"Arial, sans-serif\" text-anchor=\"middle\">",
      "    <text x=\"64\" y=\"23\" font-size=\"12\" font-weight=\"700\" letter-spacing=\"1.2\" fill=\"#526574\">BWW</text>",
      "    <text x=\"64\" y=\"37\" font-size=\"10\" fill=\"#71808D\">ZIRKULATION</text>",
      "    <svg x=\"29\" y=\"47\" width=\"70\" height=\"70\" viewBox=\"0 0 64 64\">",
      "      <path d=\"M20 48 H44 L48 58 H16 Z\" fill=\"#858D95\" stroke=\"#555D65\" stroke-width=\"1.5\"/>",
      "      <rect x=\"13\" y=\"57\" width=\"38\" height=\"4\" rx=\"2\" fill=\"#68717A\"/>",
      "      <path d=\"M32 7 H55 V21 H45 V17 H32 Z\" fill=\"#969EA6\" stroke=\"#555D65\" stroke-width=\"1.5\" stroke-linejoin=\"round\"/>",
      "      <rect x=\"53\" y=\"5\" width=\"7\" height=\"18\" rx=\"2\" fill=\"#B2B8BE\" stroke=\"#555D65\" stroke-width=\"1.5\"/>",
      "      <circle cx=\"32\" cy=\"32\" r=\"24\" fill=\"#9199A1\" stroke=\"#555D65\" stroke-width=\"2\"/>",
      "      <circle cx=\"32\" cy=\"32\" r=\"21.5\" fill=\"none\" stroke=\"#BCC2C8\" stroke-width=\"1\"/>",
      "      <path d=\"M11 31 A21 21 0 0 1 32 11\" fill=\"none\" stroke=\"#E0E4E8\" stroke-width=\"2\" stroke-linecap=\"round\"/>",
      "      <circle cx=\"32\" cy=\"32\" r=\"18\" fill=\"#282E34\" stroke=\"#59626B\" stroke-width=\"2\"/>",
      "      <g fill=\"#D0D5DA\" stroke=\"#555D65\" stroke-width=\"0.8\">",
      "        <circle cx=\"17\" cy=\"17\" r=\"2\"/><circle cx=\"47\" cy=\"17\" r=\"2\"/>",
      "        <circle cx=\"17\" cy=\"47\" r=\"2\"/><circle cx=\"47\" cy=\"47\" r=\"2\"/>",
      "      </g>",
      "      <path d=\"M16 17 H18 M46 17 H48 M16 47 H18 M46 47 H48\" fill=\"none\" stroke=\"#626A72\" stroke-width=\"1\"/>",
      "      <g class=\"bww-rotor\" fill=\"${rotorColor}\" style=\"animation:${active ? 'bww-spin 1.4s linear infinite' : 'none'};\">",
      "        <path d=\"M30 29 C20 25 20 16 28 15 C35 14 39 20 34 29 Z\"/>",
      "        <path d=\"M30 29 C20 25 20 16 28 15 C35 14 39 20 34 29 Z\" transform=\"rotate(120 32 32)\"/>",
      "        <path d=\"M30 29 C20 25 20 16 28 15 C35 14 39 20 34 29 Z\" transform=\"rotate(240 32 32)\"/>",
      "        <circle cx=\"32\" cy=\"32\" r=\"5\"/><circle cx=\"32\" cy=\"32\" r=\"2\" fill=\"#D5D9DD\"/>",
      "      </g>",
      "    </svg>",
      "    <rect x=\"12\" y=\"123\" width=\"104\" height=\"43\" rx=\"10\" fill=\"#FFFFFF\" stroke=\"#DCE4EB\"/>",
      "    <text x=\"64\" y=\"136\" font-size=\"8.5\" fill=\"#71808D\">TEMPERATUR</text>",
      "    <text x=\"64\" y=\"157\" font-size=\"20\" font-weight=\"700\" fill=\"${tempColor}\">${temperature}</text>",
      "    <text x=\"64\" y=\"183\" font-size=\"11\" fill=\"${statusColor}\">${status}</text>",
      "  </g>",
      "</svg>`;",
      "",
      "",
      "})(states[ids.zirkulation.ruecklauf_temperatur]);",
      "",
      "return (function draw(states,gradients,indices,pumpSvg){",
      " const valid=v=>v!=null&&!['','unknown','unavailable','none'].includes(String(v).trim());",
      " const raw=id=>states[id]?.state;",
      " const fmt=n=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';",
      " const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&apos;'}[c]));",
      " const text=(x,y,v,size=14,color='#243C4A',weight=400,anchor='start')=>`<text x=\"${x}\" y=\"${y}\" font-size=\"${size <= 14 ? size + 1.5 : size <= 16 ? size + 1 : size}\" fill=\"${color}\" font-weight=\"${weight}\" text-anchor=\"${anchor}\">${esc(v)}</text>`;",
      " const box=(x,y,w,ht,fill='#FFFFFF',radius=18)=>`<rect x=\"${x}\" y=\"${y}\" width=\"${w}\" height=\"${ht}\" rx=\"${radius}\" fill=\"${fill}\" stroke=\"#DCE5EB\"/>`;",
      " const colorStops=css=>[...css.matchAll(/(rgb\\([^)]+\\))\\s+([\\d.]+)%/g)].map(m=>`<stop offset=\"${m[2]}%\" stop-color=\"${m[1]}\"/>`).join('');",
      " let defs='';",
      " gradients.forEach((gradient,i)=>{defs+=`<linearGradient id=\"storage-modern-${i}\" x1=\"0\" y1=\"1\" x2=\"0\" y2=\"0\">${gradient?colorStops(gradient):'<stop offset=\"0%\" stop-color=\"#A4AFB8\"/><stop offset=\"100%\" stop-color=\"#C9D1D7\"/>'}</linearGradient>`;});",
      " defs+='<linearGradient id=\"storage-scale\"><stop offset=\"0%\" stop-color=\"#0046C8\"/><stop offset=\"25%\" stop-color=\"#00B4AB\"/><stop offset=\"45%\" stop-color=\"#48BE34\"/><stop offset=\"65%\" stop-color=\"#EADB00\"/><stop offset=\"82%\" stop-color=\"#FF7D00\"/><stop offset=\"100%\" stop-color=\"#E81414\"/></linearGradient>';",
      " const { cardHeight, extraHeight, tankTop: ty, tankHeight: th, rowHeight, rowOffset } = storageLayout;",
      " let svg=`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"${cardHeight}\" viewBox=\"0 0 1000 ${cardHeight}\" style=\"display:block;width:100%;height:auto\" role=\"img\" aria-label=\"Warmwasser und Heizpuffer\"><defs>${defs}</defs><rect width=\"1000\" height=\"${cardHeight}\" rx=\"24\" fill=\"#EFF4F7\"/><g font-family=\"Arial, sans-serif\">`;",
      " svg+=text(26,40,'SPEICHER & WARMWASSER',25,'#243C4A',700)+text(26,64,'Temperaturen · Ladezustand · Zirkulation',13,'#738897');",
      " const statusCodes={'0':['Bereitschaft','#188E65'],'1':['Heizen','#D88337'],'2':['Backup-Heizen','#D88337'],'3':['Temperatur erreicht','#188E65'],'4':['Kein Signal','#C23B4F'],'6':['Gesperrt / Pause','#738897']};",
      " tanks.forEach(({ key, x, sensors, customSensors },i)=>{",
      "  const tank = ids[key];",
      "  const name = key === 'boiler' ? 'WARMWASSER' : 'HEIZPUFFER';",
      "  const subtitle = key === 'boiler' ? 'Boiler · Trinkwarmwasser' : 'Pufferspeicher · Heizungswasser';",
      "  const req=raw(tank.heizanforderung),pv=raw(tank.ueberschussbetrieb);",
      " const surplus=['heating','cooling'].includes(pv)?'on':pv==='off'?'off':undefined;",
      "  const charging=req==='on'||surplus==='on';",
      "  const mode=charging?(req==='on'&&surplus==='on'?'Anforderung + Überschuss':surplus==='on'?'Überschussbetrieb':'Heizanforderung'):req==='off'&&surplus==='off'?'Keine Ladeanforderung':'Status nicht verfügbar';",
      "  svg+=box(x,92,464,640+extraHeight)+text(x+22,124,name,17,'#243C4A',700)+text(x+22,146,subtitle,12,'#738897');",
      "  svg+=box(x+20,163,424,38,charging?'#EAF7F0':'#F5F8FA',10)+text(x+35,188,mode,14,charging?'#188E65':'#738897',600);",
      "  svg+=text(x+22,226,'TEMPERATURSCHICHTUNG',10,'#83939F',700)+text(x+424,226,'LADEINDEX  '+indices[i],17,'#426E86',700,'end');",
      "  const tx=x+35,tw=156,radius=48;",
      "  svg+=`<rect x=\"${tx}\" y=\"${ty}\" width=\"${tw}\" height=\"${th}\" rx=\"${radius}\" fill=\"url(#storage-modern-${i})\" stroke=\"#8195A3\" stroke-width=\"2\"/><path d=\"M${tx+12} ${ty+48} V${ty+th-48}\" stroke=\"#FFFFFF\" stroke-opacity=\"0.4\" stroke-width=\"4\" stroke-linecap=\"round\"/><ellipse cx=\"${tx+tw/2}\" cy=\"${ty+30}\" rx=\"67\" ry=\"19\" fill=\"#FFFFFF\" fill-opacity=\"0.17\"/><path d=\"M${tx+15} ${ty+th-28} Q${tx+tw/2} ${ty+th-3} ${tx+tw-15} ${ty+th-28}\" fill=\"none\" stroke=\"#243C4A\" stroke-opacity=\"0.14\" stroke-width=\"2\"/>`;",
      "  if (!sensors.length) svg+=text(x+236,ty+35,'Keine Fühler eingetragen',13,'#738897');",
      "  sensors.forEach(({ entity, name, temperature, tankY: sy, labelY: cy })=>{",
      "   const glyphs = Array.from(JSON.parse(name) || states[entity]?.attributes?.friendly_name || entity);",
      "   const label = glyphs.length > 24 ? glyphs.slice(0, 23).join('') + '…' : glyphs.join('');",
      "   const cornerY = key === 'puffer' && !customSensors ? 0 : Math.max(0, radius - Math.min(sy - ty, ty + th - sy));",
      "   const markerX = tx + tw - 4 - radius + Math.sqrt(radius ** 2 - cornerY ** 2);",
      "   svg+=`<path d=\"M${markerX} ${sy} H${x+209} L${x+224} ${cy}\" fill=\"none\" stroke=\"#B8C7D1\" stroke-width=\"1.3\"/><circle cx=\"${markerX}\" cy=\"${sy}\" r=\"3\" fill=\"#FFFFFF\" stroke=\"#8399A8\"/>`;",
      "   svg+=box(x+224,cy-rowOffset,215,rowHeight,'#F7FAFC',10)+text(x+236,cy-7,label,10,'#738897',600)+text(x+424,cy+11,fmt(temperature)+' °C',21,'#243C4A',700,'end');",
      "  });",
      "  svg+=text(x+113,582,'25 °C  →  55 °C',11,'#83939F',400,'middle');",
      "  svg+=`<g transform=\"translate(0 ${extraHeight})\">`;",
      "  svg+=box(x+20,593,424,36,'#F5F8FA',9);",
      "  const vl=charging?fmt(readNumber(ids.heizung.waermepumpe_vorlauf))+' °C':'—',rl=charging?fmt(readNumber(ids.heizung.waermepumpe_ruecklauf))+' °C':'—';",
      "  svg+=text(x+34,616,'WP-Vorlauf  '+vl,13,'#B15662',600)+text(x+427,616,'Rücklauf  '+rl,13,'#387EA6',600,'end');",
      "  const status=raw(tank.heizstab_status),[desc,col]=statusCodes[status]||[valid(status)?'Status '+status:'Nicht verfügbar','#738897'];",
      "  const powerId=tank.heizstab_leistung,power=valid(raw(powerId))?String(raw(powerId))+' '+(states[powerId]?.attributes?.unit_of_measurement||'W'):'—';",
      "  svg+=box(x+20,643,424,65,'#F7FAFC',12)+text(x+35,665,'ELEKTROHEIZSTAB',10,'#738897',700)+text(x+35,690,desc,16,col,600)+text(x+424,686,power,21,'#243C4A',700,'end');",
      "  svg+='</g>';",
      " });",
      " svg+=`<g transform=\"translate(0 ${extraHeight})\">`;",
      " svg+=box(24,750,584,302)+text(46,781,'BWW-ZIRKULATION',15,'#526978',700);",
      " const nested=pumpSvg.replace(/<svg\\b/,'<svg x=\"42\" y=\"799\" width=\"144\" height=\"221\"').replace(/style=\"display:block;width:100%;height:auto\"/,'');",
      " svg+=nested+text(216,832,'Warmwasser auf Abruf',20,'#243C4A',700)+text(216,860,'Zirkulationspumpe bei Bedarf',14,'#738897')+text(216,883,'für 10 Minuten einschalten.',14,'#738897');",
      " svg+=box(628,750,348,302)+text(650,781,'TEMPERATUR & LADEINDEX',13,'#526978',700);",
      " svg+='<rect x=\"650\" y=\"808\" width=\"304\" height=\"15\" rx=\"7\" fill=\"url(#storage-scale)\"/>';",
      " svg+=text(650,842,'25 °C',12,'#738897')+text(954,842,'55 °C',12,'#738897',400,'end');",
      " svg+=text(650,882,'Der Verlauf zeigt die berechnete',13,'#526978')+text(650,904,'Temperaturverteilung im Speicher.',13,'#526978');",
      " svg+=text(650,943,'Der Ladeindex ist temperaturbasiert.',13,'#526978')+text(650,965,'Er beschreibt keinen Wasserfüllstand.',13,'#526978');",
      " svg+=text(650,1007,'Fehlende Werte werden als „—“ gezeigt.',11,'#83939F');",
      " return svg+'</g></g></svg>';",
      "})(states,gradients,indices,pumpSvg);",
      "",
      "",
      "})();",
      "",
      "if (!hass.themes?.darkMode) return themedSvg;",
      "",
      "return (function applyTheme(svg,map){",
      " return svg.replace(/<[a-zA-Z][^>]*>/g,tag=>{",
      "  const isText=/^<text\\b/.test(tag);",
      "  return tag.replace(/(fill|stroke)=\"(#[a-fA-F0-9]{6})\"/g,(match,attr,hex)=>{",
      "   const key=hex.toUpperCase();",
      "   if(isText){",
      "    if(['#188E65','#168C58'].includes(key))return attr+'=\"var(--modern-positive)\"';",
      "    if(['#C23B4F','#A23F4A','#B15662','#E34D56'].includes(key))return attr+'=\"var(--modern-hot)\"';",
      "    if(['#28749A','#387EA6','#008EBF','#009BD0'].includes(key))return attr+'=\"var(--modern-cool)\"';",
      "   }",
      "   // Keep white light reflections on pumps and storage tanks.",
      "   if(key==='#FFFFFF'&&!/^<rect\\b/.test(tag))return match;",
      "   // Keep grey hardware and coloured flow/temperature indicators intact.",
      "   const token=map[key];",
      "   return token ? attr+'=\"var('+token+')\"' : match;",
      "  });",
      " });",
      "})(themedSvg, {\"#EFF4F7\":\"--modern-bg\",\"#FFFFFF\":\"--modern-card\",\"#F7FAFC\":\"--modern-surface\",\"#F5F8FA\":\"--modern-surface\",\"#F0F6FA\":\"--modern-surface\",\"#EDF4F8\":\"--modern-surface\",\"#DCE5EB\":\"--modern-border\",\"#DCE4EB\":\"--modern-border\",\"#E4ECF1\":\"--modern-border\",\"#E7DADD\":\"--modern-border\",\"#D6E5EF\":\"--modern-border\",\"#243C4A\":\"--modern-text\",\"#243743\":\"--modern-text\",\"#283B48\":\"--modern-text\",\"#526978\":\"--modern-secondary\",\"#738897\":\"--modern-secondary\",\"#83939F\":\"--modern-secondary\",\"#526574\":\"--modern-secondary\",\"#71808D\":\"--modern-secondary\",\"#82919D\":\"--modern-secondary\",\"#657785\":\"--modern-secondary\",\"#7A8C99\":\"--modern-secondary\",\"#627987\":\"--modern-secondary\",\"#6F8493\":\"--modern-secondary\",\"#748696\":\"--modern-secondary\",\"#EAF0F4\":\"--modern-track\",\"#EAF7F0\":\"--modern-success-bg\",\"#FFF0F1\":\"--modern-error-bg\",\"#E8F5FC\":\"--modern-info-bg\",\"#C6E1F0\":\"--modern-border\",\"#426E86\":\"--modern-accent\",\"#52768C\":\"--modern-accent\",\"#247796\":\"--modern-accent\"});",
      "",
      "]]]"
    ].join("\n"),
    "start_bww": {
      "card": {
        "type": "custom:button-card",
        "name": "BWW 10 Min starten",
        "icon": "mdi:pump",
        "show_name": true,
        "show_icon": true,
        "tap_action": {
          "action": "call-service",
          "service": "[[[ return variables.entitaeten.zirkulation.startskript; ]]]"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "background": "[[[ return hass.themes?.darkMode ? \"var(--modern-info-bg)\" : \"#E8F5FC\"; ]]]"
            },
            {
              "border": "[[[ return hass.themes?.darkMode ? \"1px solid var(--modern-border)\" : \"1px solid #C6E1F0\"; ]]]"
            },
            {
              "border-radius": "12px"
            },
            {
              "padding": "5%"
            },
            {
              "box-shadow": "none"
            }
          ],
          "grid": [
            {
              "grid-template-areas": "\"i n\""
            },
            {
              "grid-template-columns": "22% 1fr"
            }
          ],
          "icon": [
            {
              "width": "75%"
            },
            {
              "color": "#008EBF"
            }
          ],
          "name": [
            {
              "font-size": "clamp(9px, 1.7vmin, 17px)"
            },
            {
              "font-weight": 600
            },
            {
              "color": "[[[ return hass.themes?.darkMode ? \"var(--modern-accent)\" : \"#247796\"; ]]]"
            }
          ]
        }
      }
    },
    "sensor_8": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.boiler.heizstab_status; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_9": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.boiler.heizstab_leistung; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_10": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.heizung.waermepumpe_vorlauf; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_11": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.heizung.waermepumpe_ruecklauf; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_12": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.heizstab_status; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_13": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.heizstab_leistung; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_14": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.heizung.waermepumpe_vorlauf; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_15": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.heizung.waermepumpe_ruecklauf; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "sensor_16": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.zirkulation.ruecklauf_temperatur; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    },
    "history_circulation": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.zirkulation.pumpe_relais; ]]]",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "tap_action": {
          "action": "more-info"
        },
        "hold_action": {
          "action": "none"
        },
        "styles": {
          "card": [
            {
              "width": "100%"
            },
            {
              "height": "100%"
            },
            {
              "background": "transparent"
            },
            {
              "border": "none"
            },
            {
              "padding": 0
            },
            {
              "box-shadow": "none"
            },
            {
              "position": "absolute"
            },
            {
              "inset": 0
            },
            {
              "pointer-events": "auto"
            },
            {
              "cursor": "pointer"
            }
          ]
        },
        "extra_styles": [
          ":host { display:block !important; position:relative; width:100% !important; max-width:none !important; height:100% !important; pointer-events:auto !important; }",
          "#aspect-ratio { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; }",
          "#card { display:block !important; position:absolute !important; inset:0; width:100% !important; height:100% !important; padding:0 !important; pointer-events:auto !important; }",
          "#container { width:100%; height:100%; }"
        ].join("\n")
      }
    }
  },
  "styles": {
    "card": [
      {
        "padding": 0
      },
      {
        "border": "[[[ return hass.themes?.darkMode ? \"1px solid var(--modern-border)\" : \"1px solid #DCE5EB\"; ]]]"
      },
      {
        "border-radius": "24px"
      },
      {
        "background": "[[[ return hass.themes?.darkMode ? \"var(--modern-bg)\" : \"#EFF4F7\"; ]]]"
      },
      {
        "box-shadow": "none"
      },
      {
        "width": "100%"
      },
      {
        "overflow": "hidden"
      }
    ],
    "grid": [
      {
        "display": "block"
      },
      {
        "width": "100%"
      },
      {
        "min-width": 0
      },
      {
        "position": "relative"
      }
    ],
    "custom_fields": {
      "dashboard": [
        {
          "display": "block"
        },
        {
          "position": "relative"
        },
        {
          "width": "100%"
        },
        {
          "min-width": 0
        },
        {
          "line-height": 0
        },
        {
          "pointer-events": "none"
        }
      ],
      "start_bww": [
        {
          "position": "absolute"
        },
        {
          "left": "40.2%"
        },
        {
          "top": "87.87037037037037%"
        },
        {
          "width": "37%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        }
      ],
      "sensor_8": [
        {
          "position": "absolute"
        },
        {
          "left": "16.65%"
        },
        {
          "top": "62.5462962962963%"
        },
        {
          "width": "24.5%"
        },
        {
          "height": "6.018518518518518%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_9": [
        {
          "position": "absolute"
        },
        {
          "left": "37.85%"
        },
        {
          "top": "62.5462962962963%"
        },
        {
          "width": "17.9%"
        },
        {
          "height": "6.018518518518518%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_10": [
        {
          "position": "absolute"
        },
        {
          "left": "15%"
        },
        {
          "top": "56.574074074074076%"
        },
        {
          "width": "21.2%"
        },
        {
          "height": "3.3333333333333335%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_11": [
        {
          "position": "absolute"
        },
        {
          "left": "36.2%"
        },
        {
          "top": "56.574074074074076%"
        },
        {
          "width": "21.2%"
        },
        {
          "height": "3.3333333333333335%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_12": [
        {
          "position": "absolute"
        },
        {
          "left": "65.45%"
        },
        {
          "top": "62.5462962962963%"
        },
        {
          "width": "24.5%"
        },
        {
          "height": "6.018518518518518%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_13": [
        {
          "position": "absolute"
        },
        {
          "left": "86.65%"
        },
        {
          "top": "62.5462962962963%"
        },
        {
          "width": "17.9%"
        },
        {
          "height": "6.018518518518518%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_14": [
        {
          "position": "absolute"
        },
        {
          "left": "63.8%"
        },
        {
          "top": "56.574074074074076%"
        },
        {
          "width": "21.2%"
        },
        {
          "height": "3.3333333333333335%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_15": [
        {
          "position": "absolute"
        },
        {
          "left": "85%"
        },
        {
          "top": "56.574074074074076%"
        },
        {
          "width": "21.2%"
        },
        {
          "height": "3.3333333333333335%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "sensor_16": [
        {
          "position": "absolute"
        },
        {
          "left": "11.4%"
        },
        {
          "top": "88.88888888888889%"
        },
        {
          "width": "12%"
        },
        {
          "height": "4.444444444444445%"
        },
        {
          "transform": "translate(-50%, -50%)"
        },
        {
          "z-index": 2
        },
        {
          "pointer-events": "auto"
        },
        {
          "z-index": 5
        }
      ],
      "history_circulation": [
        {
          "position": "absolute"
        },
        {
          "left": "5.4%"
        },
        {
          "top": "78.42592592592592%"
        },
        {
          "width": "12%"
        },
        {
          "height": "7.962962962962963%"
        },
        {
          "z-index": 5
        },
        {
          "pointer-events": "auto"
        }
      ]
    }
  },
  "extra_styles": [
    ".bww-rotor {",
    "  transform-box: view-box;",
    "  transform-origin: 32px 32px;",
    "}",
    "@keyframes bww-spin {",
    "  from { transform: rotate(0deg); }",
    "  to { transform: rotate(360deg); }",
    "}",
    "",
    ":host { display: block; width: 100%; }",
    "#container { display: block; width: 100%; min-width: 0; }",
    "#dashboard { display: block; width: 100%; line-height: 0; }",
    "#dashboard > svg { display: block; width: 100% !important; height: auto !important; max-width: none; }",
    ":host {",
    "  --modern-bg: #111820;",
    "  --modern-card: #1C2732;",
    "  --modern-surface: #253341;",
    "  --modern-border: #3B4B58;",
    "  --modern-text: #E6EDF3;",
    "  --modern-secondary: #A4B5C4;",
    "  --modern-accent: #65BDE3;",
    "  --modern-track: #3B4B58;",
    "  --modern-positive: #60AF97;",
    "  --modern-hot: #E18C94;",
    "  --modern-cool: #6BB5D7;",
    "  --modern-success-bg: #1B3B38;",
    "  --modern-error-bg: #3B2C36;",
    "  --modern-info-bg: #1A3B49;",
    "}",
    ""
  ].join("\n"),
  "update_timer": "1s"
};

const CARD_TYPE = "boiler-puffer-dashboard-card";
const EDITOR_TYPE = `${CARD_TYPE}-editor`;

if (!customElements.get(CARD_TYPE)) {
  customElements.define(EDITOR_TYPE, DashboardCardEditor);
  customElements.define(CARD_TYPE, DashboardCard);
  window.customCards ??= [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Boiler, Pufferspeicher und Zirkulation",
    description: "Speicher- und Heizkreistemperaturen, Elektroheizstäbe und Warmwasserzirkulation.",
  });
}
