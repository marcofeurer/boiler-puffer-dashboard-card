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

  setConfig(config) {
    const buttonConfig = structuredClone(BUTTON_CONFIG);
    applyEntityOverrides(buttonConfig.variables.entitaeten, config.entitaeten);
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
      if (typeof entityId !== "string" || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) {
        throw new Error(`Ungültige Entitäts-ID für „${group}.${key}“.`);
      }
      entities[group][key] = entityId;
    }
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
  "entity": "[[[ return variables.entitaeten.boiler.temperatur_bf1; ]]]",
  "triggers_update": [
    "[[[ return variables.entitaeten.boiler.temperatur_hf1; ]]]",
    "[[[ return variables.entitaeten.puffer.temperatur_pf2_oben; ]]]",
    "[[[ return variables.entitaeten.puffer.temperatur_pf1_unten; ]]]",
    "[[[ return variables.entitaeten.boiler.heizstab_leistung; ]]]",
    "[[[ return variables.entitaeten.puffer.heizanforderung; ]]]",
    "[[[ return variables.entitaeten.puffer.ueberschussbetrieb; ]]]",
    "[[[ return variables.entitaeten.heizung.waermepumpe_vorlauf; ]]]",
    "[[[ return variables.entitaeten.heizung.waermepumpe_ruecklauf; ]]]",
    "[[[ return variables.entitaeten.boiler.heizanforderung; ]]]",
    "[[[ return variables.entitaeten.boiler.ueberschussbetrieb; ]]]",
    "[[[ return variables.entitaeten.boiler.temperatur_bf1; ]]]",
    "[[[ return variables.entitaeten.boiler.heizstab_status; ]]]",
    "[[[ return variables.entitaeten.boiler.temperatur_hf2; ]]]",
    "[[[ return variables.entitaeten.puffer.temperatur_hf2; ]]]",
    "[[[ return variables.entitaeten.puffer.temperatur_hf1; ]]]",
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
      "const themedSvg = (()=>{",
      "",
      "",
      "const gradients = [",
      "",
      "(()=>{",
      "  // =====================================================",
      "  // BOILER – PCHIP V2.0 / STUFENLOSER GLT-VERLAUF",
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
      "  // SENSOREN",
      "  // =====================================================",
      "",
      "  const TOP = states[",
      "    ids.boiler.temperatur_hf2",
      "  ]?.state;",
      "",
      "  const MID = states[",
      "    ids.boiler.temperatur_bf1",
      "  ]?.state;",
      "",
      "  const BOTTOM_ELWA = states[",
      "    ids.boiler.temperatur_hf1",
      "  ]?.state;",
      "",
      "",
      "  // =====================================================",
      "  // POSITIONEN DER FÜHLER IM SPEICHER",
      "  // =====================================================",
      "",
      "  // CSS-Verlauf \"to top\": 0 = unten, 1 = oben.",
      "  // HF1: 885 mm von oben = 525 mm von unten bei 1410 mm Speicherhöhe.",
      "  const tankHeight = 1410;",
      "  const posElwaBottom = 525 / tankHeight;",
      "  const posTop = 1140 / tankHeight;",
      "",
      "  // =====================================================",
      "  // HILFSFUNKTIONEN",
      "  // =====================================================",
      "",
      "  const toNum = (value) => {",
      "    if (",
      "      value === null ||",
      "      value === undefined ||",
      "      value === '' ||",
      "      value === 'unknown' ||",
      "      value === 'unavailable' ||",
      "      value === 'none'",
      "    ) {",
      "      return null;",
      "    }",
      "",
      "    const cleaned = String(value)",
      "      .trim()",
      "      .replace(',', '.')",
      "      .replace(/[^\\d.-]/g, '');",
      "",
      "    const number = parseFloat(cleaned);",
      "",
      "    return Number.isFinite(number)",
      "      ? number",
      "      : null;",
      "  };",
      "",
      "  const clamp = (value, min, max) => {",
      "    return Math.min(Math.max(value, min), max);",
      "  };",
      "",
      "  const lerp = (start, end, factor) => {",
      "    return start + (end - start) * factor;",
      "  };",
      "",
      "  const fallbackTemperature = (position) => {",
      "    return lerp(tMin, tMax, clamp(position, 0, 1));",
      "  };",
      "",
      "",
      "  const tElwaBottom =",
      "    toNum(BOTTOM_ELWA) ??",
      "    fallbackTemperature(posElwaBottom);",
      "",
      "  // HF2 und BF1 sitzen gemeinsam am oberen e-Anschluss.",
      "  // Für den Verlauf wird aus allen verfügbaren Werten an",
      "  // diesem Messpunkt der Mittelwert gebildet.",
      "  const topValues = [",
      "    addOffset(toNum(TOP), offsetBoilerHF2),",
      "    toNum(MID)",
      "  ].filter(value => Number.isFinite(value));",
      "",
      "  const tTop = topValues.length > 0",
      "    ? topValues.reduce((sum, value) => sum + value, 0) /",
      "      topValues.length",
      "    : fallbackTemperature(posTop);",
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
      "  const sensorPoints = [",
      "    { position: 0.00,          temperature: tElwaBottom },",
      "    { position: posElwaBottom, temperature: tElwaBottom },",
      "    { position: posTop,        temperature: tTop },",
      "    { position: 1.00,          temperature: tTop }",
      "  ];",
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
      "})(),",
      "",
      "(()=>{",
      "  // =====================================================",
      "  // PUFFER – PCHIP V2.0 / STUFENLOSER GLT-VERLAUF",
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
      "  // SENSOREN",
      "  // =====================================================",
      "",
      "  const PF2 = states[",
      "    ids.puffer.temperatur_pf2_oben",
      "  ]?.state;",
      "",
      "  const HF2 = states[",
      "    ids.puffer.temperatur_hf2",
      "  ]?.state;",
      "",
      "  const HF1 = states[",
      "    ids.puffer.temperatur_hf1",
      "  ]?.state;",
      "",
      "  const PF1 = states[",
      "    ids.puffer.temperatur_pf1_unten",
      "  ]?.state;",
      "",
      "  // =====================================================",
      "  // REALE POSITIONEN DER FÜHLER",
      "  // =====================================================",
      "",
      "  const posPF1 = 0.10;",
      "  const posHF1 = 0.36446280991735536;",
      "  const posHF2 = 0.6311294765840221;",
      "  const posPF2 = 0.90;",
      "",
      "  // =====================================================",
      "  // HILFSFUNKTIONEN",
      "  // =====================================================",
      "",
      "  const toNum = (value) => {",
      "    if (",
      "      value === null ||",
      "      value === undefined ||",
      "      value === '' ||",
      "      value === 'unknown' ||",
      "      value === 'unavailable' ||",
      "      value === 'none'",
      "    ) {",
      "      return null;",
      "    }",
      "",
      "    const cleaned = String(value)",
      "      .trim()",
      "      .replace(',', '.')",
      "      .replace(/[^\\d.-]/g, '');",
      "",
      "    const number = parseFloat(cleaned);",
      "",
      "    return Number.isFinite(number)",
      "      ? number",
      "      : null;",
      "  };",
      "",
      "  const clamp = (value, min, max) => {",
      "    return Math.min(Math.max(value, min), max);",
      "  };",
      "",
      "  const lerp = (start, end, factor) => {",
      "    return start + (end - start) * factor;",
      "  };",
      "",
      "  const fallbackTemperature = (position) => {",
      "    return lerp(tMin, tMax, clamp(position, 0, 1));",
      "  };",
      "",
      "  const tPF1 =",
      "    toNum(PF1) ??",
      "    fallbackTemperature(posPF1);",
      "",
      "  const tHF1 =",
      "    toNum(HF1) ??",
      "    fallbackTemperature(posHF1);",
      "",
      "  const tHF2 =",
      "    addOffset(toNum(HF2), offsetPufferHF2) ??",
      "    fallbackTemperature(posHF2);",
      "",
      "  const tPF2 =",
      "    toNum(PF2) ??",
      "    fallbackTemperature(posPF2);",
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
      "  const sensorPoints = [",
      "    { position: 0.00,   temperature: tPF1 },",
      "    { position: posPF1, temperature: tPF1 },",
      "    { position: posHF1, temperature: tHF1 },",
      "    { position: posHF2, temperature: tHF2 },",
      "    { position: posPF2, temperature: tPF2 },",
      "    { position: 1.00,   temperature: tPF2 }",
      "  ];",
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
      "})()];",
      "",
      "const indices = [",
      "",
      "(()=>{",
      "  const hf2 = addOffset(",
      "    Number.parseFloat(states[ids.boiler.temperatur_hf2]?.state),",
      "    offsetBoilerHF2",
      "  );",
      "  const bf1 = Number.parseFloat(",
      "    states[ids.boiler.temperatur_bf1]?.state",
      "  );",
      "  const hf1 = Number.parseFloat(",
      "    states[ids.boiler.temperatur_hf1]?.state",
      "  );",
      "",
      "  const topValues = [hf2, bf1].filter(Number.isFinite);",
      "",
      "  if (",
      "    topValues.length === 0 ||",
      "    !Number.isFinite(hf1)",
      "  ) {",
      "    return '—';",
      "  }",
      "",
      "  // HF2 und BF1 liegen gemeinsam am oberen e-Anschluss.",
      "  const oben =",
      "    topValues.reduce((sum, value) => sum + value, 0) /",
      "    topValues.length;",
      "",
      "  // Messpunkte von oben: HF2/BF1 bei 270 mm und HF1 bei 885 mm",
      "  // im 1410-mm-Speicher.",
      "  const posOben = 270 / 1410;",
      "  const posHF1 = 885 / 1410;",
      "",
      "  // Flächengewichte aus den halben Abständen zwischen den",
      "  // Messpunkten; oberhalb/unterhalb gilt der nächste Fühlerwert.",
      "  const gewichtOben = (posOben + posHF1) / 2;",
      "  const gewichtHF1 = 1 - gewichtOben;",
      "",
      "  const t_eff =",
      "    (oben * gewichtOben) +",
      "    (hf1 * gewichtHF1);",
      "",
      "  let pct = (t_eff - 25) / (55 - 25) * 100;",
      "  pct = Math.min(100, Math.max(0, pct));",
      "",
      "  return Math.round(pct) + ' %';",
      "})(),",
      "",
      "(()=>{",
      "  const oben     = parseFloat(states[ids.puffer.temperatur_pf2_oben]?.state);",
      "  const boiler2 = addOffset(",
      "    parseFloat(states[ids.puffer.temperatur_hf2]?.state),",
      "    offsetPufferHF2",
      "  );",
      "  const mitte    = parseFloat(states[ids.puffer.temperatur_hf1]?.state);",
      "  const unten    = parseFloat(states[ids.puffer.temperatur_pf1_unten]?.state);",
      "  const soll     = parseFloat(states[ids.heizung.heizkreis_vorlauf_soll]?.state);",
      "",
      "  const voll = 55;",
      "if (!Number.isFinite(soll) || soll >= voll) return \"—\";",
      "",
      "  if (isNaN(oben) || isNaN(boiler2) || isNaN(mitte) || isNaN(unten) || isNaN(soll))",
      "    return '—';",
      "",
      "  const t_eff =",
      "    (oben * 0.25) +",
      "    (boiler2 * 0.25) +",
      "    (mitte * 0.25) +",
      "    (unten * 0.25);",
      "",
      "  let pct = (t_eff - soll) / (voll - soll) * 100;",
      "  pct = Math.min(100, Math.max(0, pct));",
      "",
      "  return Math.round(pct) + ' %';",
      "})()];",
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
      " const offsets = {",
      "   [ids.boiler.temperatur_hf2]: offsetBoilerHF2,",
      "   [ids.puffer.temperatur_hf2]: offsetPufferHF2",
      " };",
      " const num = id => valid(raw(id))",
      "   ? addOffset(Number(String(raw(id)).replace(',', '.')), offsets[id] ?? 0)",
      "   : NaN;",
      " const fmt=n=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';",
      " const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&apos;'}[c]));",
      " const text=(x,y,v,size=14,color='#243C4A',weight=400,anchor='start')=>`<text x=\"${x}\" y=\"${y}\" font-size=\"${size <= 14 ? size + 1.5 : size <= 16 ? size + 1 : size}\" fill=\"${color}\" font-weight=\"${weight}\" text-anchor=\"${anchor}\">${esc(v)}</text>`;",
      " const box=(x,y,w,ht,fill='#FFFFFF',radius=18)=>`<rect x=\"${x}\" y=\"${y}\" width=\"${w}\" height=\"${ht}\" rx=\"${radius}\" fill=\"${fill}\" stroke=\"#DCE5EB\"/>`;",
      " const cfg=[",
      " {x:24,name:'WARMWASSER',sub:'Boiler · Trinkwarmwasser',key:'boiler',rows:[['HF2 · oben',ids.boiler.temperatur_hf2,270/1410],['BF1 · oben',ids.boiler.temperatur_bf1,270/1410],['HF1',ids.boiler.temperatur_hf1,885/1410]]},",
      " {x:512,name:'HEIZPUFFER',sub:'Pufferspeicher · Heizungswasser',key:'puffer',rows:[['PF2 · oben',ids.puffer.temperatur_pf2_oben,.1],['HF2',ids.puffer.temperatur_hf2,0.1+(47.9-35.7)/(72-35.7)*0.8],['HF1',ids.puffer.temperatur_hf1,0.1+(60-35.7)/(72-35.7)*0.8],['PF1 · unten',ids.puffer.temperatur_pf1_unten,.9]]}",
      " ];",
      " const colorStops=css=>[...css.matchAll(/(rgb\\([^)]+\\))\\s+([\\d.]+)%/g)].map(m=>`<stop offset=\"${m[2]}%\" stop-color=\"${m[1]}\"/>`).join('');",
      " let defs='';",
      " cfg.forEach((c,i)=>{const available=c.rows.some(r=>Number.isFinite(num(r[1])));defs+=`<linearGradient id=\"storage-modern-${i}\" x1=\"0\" y1=\"1\" x2=\"0\" y2=\"0\">${available?colorStops(gradients[i]):'<stop offset=\"0%\" stop-color=\"#A4AFB8\"/><stop offset=\"100%\" stop-color=\"#C9D1D7\"/>'}</linearGradient>`;});",
      " defs+='<linearGradient id=\"storage-scale\"><stop offset=\"0%\" stop-color=\"#0046C8\"/><stop offset=\"25%\" stop-color=\"#00B4AB\"/><stop offset=\"45%\" stop-color=\"#48BE34\"/><stop offset=\"65%\" stop-color=\"#EADB00\"/><stop offset=\"82%\" stop-color=\"#FF7D00\"/><stop offset=\"100%\" stop-color=\"#E81414\"/></linearGradient>';",
      " let svg=`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"1080\" viewBox=\"0 0 1000 1080\" style=\"display:block;width:100%;height:auto\" role=\"img\" aria-label=\"Warmwasser und Heizpuffer\"><defs>${defs}</defs><rect width=\"1000\" height=\"1080\" rx=\"24\" fill=\"#EFF4F7\"/><g font-family=\"Arial, sans-serif\">`;",
      " svg+=text(26,40,'SPEICHER & WARMWASSER',25,'#243C4A',700)+text(26,64,'Temperaturen · Ladezustand · Zirkulation',13,'#738897');",
      " const statusCodes={'0':['Bereitschaft','#188E65'],'1':['Heizen','#D88337'],'2':['Backup-Heizen','#D88337'],'3':['Temperatur erreicht','#188E65'],'4':['Kein Signal','#C23B4F'],'6':['Gesperrt / Pause','#738897']};",
      " cfg.forEach((c,i)=>{",
      "  const tank = ids[c.key];",
      "  const x=c.x,req=raw(tank.heizanforderung),pv=raw(tank.ueberschussbetrieb);",
      " const surplus=['heating','cooling'].includes(pv)?'on':pv==='off'?'off':undefined;",
      "  const charging=req==='on'||surplus==='on';",
      "  const mode=charging?(req==='on'&&surplus==='on'?'Anforderung + Überschuss':surplus==='on'?'Überschussbetrieb':'Heizanforderung'):req==='off'&&surplus==='off'?'Keine Ladeanforderung':'Status nicht verfügbar';",
      "  svg+=box(x,92,464,640)+text(x+22,124,c.name,17,'#243C4A',700)+text(x+22,146,c.sub,12,'#738897');",
      "  svg+=box(x+20,163,424,38,charging?'#EAF7F0':'#F5F8FA',10)+text(x+35,188,mode,14,charging?'#188E65':'#738897',600);",
      "  svg+=text(x+22,226,'TEMPERATURSCHICHTUNG',10,'#83939F',700)+text(x+424,226,'LADEINDEX  '+indices[i],17,'#426E86',700,'end');",
      "  const tx=x+35,ty=247,tw=156,th=310;",
      "  svg+=`<rect x=\"${tx}\" y=\"${ty}\" width=\"${tw}\" height=\"${th}\" rx=\"48\" fill=\"url(#storage-modern-${i})\" stroke=\"#8195A3\" stroke-width=\"2\"/><path d=\"M${tx+12} ${ty+48} V${ty+th-48}\" stroke=\"#FFFFFF\" stroke-opacity=\"0.4\" stroke-width=\"4\" stroke-linecap=\"round\"/><ellipse cx=\"${tx+tw/2}\" cy=\"${ty+30}\" rx=\"67\" ry=\"19\" fill=\"#FFFFFF\" fill-opacity=\"0.17\"/><path d=\"M${tx+15} ${ty+th-28} Q${tx+tw/2} ${ty+th-3} ${tx+tw-15} ${ty+th-28}\" fill=\"none\" stroke=\"#243C4A\" stroke-opacity=\"0.14\" stroke-width=\"2\"/>`;",
      "  const rowsY=i===0?[284,342,ty+th*(885/1410)]:c.rows.map(row=>ty+th*row[2]);",
      "  c.rows.forEach(([label,id,pos],j)=>{",
      "   const sy=ty+th*pos,cy=rowsY[j];",
      "   svg+=`<path d=\"M${tx+tw-4} ${sy} H${x+209} L${x+224} ${cy}\" fill=\"none\" stroke=\"#B8C7D1\" stroke-width=\"1.3\"/><circle cx=\"${tx+tw-4}\" cy=\"${sy}\" r=\"3\" fill=\"#FFFFFF\" stroke=\"#8399A8\"/>`;",
      "   svg+=box(x+224,cy-25,215,47,'#F7FAFC',10)+text(x+236,cy-7,label,10,'#738897',600)+text(x+424,cy+11,fmt(num(id))+' °C',21,'#243C4A',700,'end');",
      "  });",
      "  svg+=text(x+113,582,'25 °C  →  55 °C',11,'#83939F',400,'middle');",
      "  svg+=box(x+20,593,424,36,'#F5F8FA',9);",
      "  const vl=charging?fmt(num(ids.heizung.waermepumpe_vorlauf))+' °C':'—',rl=charging?fmt(num(ids.heizung.waermepumpe_ruecklauf))+' °C':'—';",
      "  svg+=text(x+34,616,'WP-Vorlauf  '+vl,13,'#B15662',600)+text(x+427,616,'Rücklauf  '+rl,13,'#387EA6',600,'end');",
      "  const status=raw(tank.heizstab_status),[desc,col]=statusCodes[status]||[valid(status)?'Status '+status:'Nicht verfügbar','#738897'];",
      "  const powerId=tank.heizstab_leistung,power=valid(raw(powerId))?String(raw(powerId))+' '+(states[powerId]?.attributes?.unit_of_measurement||'W'):'—';",
      "  svg+=box(x+20,643,424,65,'#F7FAFC',12)+text(x+35,665,'ELEKTROHEIZSTAB',10,'#738897',700)+text(x+35,690,desc,16,col,600)+text(x+424,686,power,21,'#243C4A',700,'end');",
      " });",
      " svg+=box(24,750,584,302)+text(46,781,'BWW-ZIRKULATION',15,'#526978',700);",
      " const nested=pumpSvg.replace(/<svg\\b/,'<svg x=\"42\" y=\"799\" width=\"144\" height=\"221\"').replace(/style=\"display:block;width:100%;height:auto\"/,'');",
      " svg+=nested+text(216,832,'Warmwasser auf Abruf',20,'#243C4A',700)+text(216,860,'Zirkulationspumpe bei Bedarf',14,'#738897')+text(216,883,'für 10 Minuten einschalten.',14,'#738897');",
      " svg+=box(628,750,348,302)+text(650,781,'TEMPERATUR & LADEINDEX',13,'#526978',700);",
      " svg+='<rect x=\"650\" y=\"808\" width=\"304\" height=\"15\" rx=\"7\" fill=\"url(#storage-scale)\"/>';",
      " svg+=text(650,842,'25 °C',12,'#738897')+text(954,842,'55 °C',12,'#738897',400,'end');",
      " svg+=text(650,882,'Der Verlauf zeigt die berechnete',13,'#526978')+text(650,904,'Temperaturverteilung im Speicher.',13,'#526978');",
      " svg+=text(650,943,'Der Ladeindex ist temperaturbasiert.',13,'#526978')+text(650,965,'Er beschreibt keinen Wasserfüllstand.',13,'#526978');",
      " svg+=text(650,1007,'Fehlende Werte werden als „—“ gezeigt.',11,'#83939F');",
      " return svg+'</g></svg>';",
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
    "sensor_0": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.boiler.temperatur_hf2; ]]]",
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
    "sensor_1": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.boiler.temperatur_bf1; ]]]",
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
    "sensor_3": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.boiler.temperatur_hf1; ]]]",
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
    "sensor_4": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.temperatur_pf2_oben; ]]]",
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
    "sensor_5": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.temperatur_hf2; ]]]",
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
    "sensor_6": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.temperatur_hf1; ]]]",
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
    "sensor_7": {
      "card": {
        "type": "custom:button-card",
        "entity": "[[[ return variables.entitaeten.puffer.temperatur_pf1_unten; ]]]",
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
      "sensor_0": [
        {
          "position": "absolute"
        },
        {
          "left": "35.55%"
        },
        {
          "top": "26.15740740740741%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_1": [
        {
          "position": "absolute"
        },
        {
          "left": "35.55%"
        },
        {
          "top": "31.52777777777778%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_3": [
        {
          "position": "absolute"
        },
        {
          "left": "35.55%"
        },
        {
          "top": "40.88652482269503%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_4": [
        {
          "position": "absolute"
        },
        {
          "left": "84.35%"
        },
        {
          "top": "25.601851851851855%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_5": [
        {
          "position": "absolute"
        },
        {
          "left": "84.35%"
        },
        {
          "top": "33.31943169064381%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_6": [
        {
          "position": "absolute"
        },
        {
          "left": "84.35%"
        },
        {
          "top": "40.97375267829813%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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
      "sensor_7": [
        {
          "position": "absolute"
        },
        {
          "left": "84.35%"
        },
        {
          "top": "48.56481481481482%"
        },
        {
          "width": "21.5%"
        },
        {
          "height": "4.351851851851852%"
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

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, DashboardCard);
  window.customCards ??= [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Boiler, Pufferspeicher und Zirkulation",
    description: "Speicher- und Heizkreistemperaturen, Elektroheizstäbe und Warmwasserzirkulation.",
  });
}
