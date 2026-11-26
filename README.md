# Boiler, Pufferspeicher und Zirkulation

Speicher- und Heizkreistemperaturen, Elektroheizstäbe und Warmwasserzirkulation. Die Karte erscheint in HACS als **Dashboard**.

## Voraussetzungen

- **Button Card** für die Darstellung und Bedienung, geprüft mit Version 7.0.1. [custom-cards/button-card](https://github.com/custom-cards/button-card)

Die Karte verwendet bereits vorhandene Home-Assistant-Entitäten. Übersicht und Messwerte werden im Dashboard angezeigt, sobald die Entitäten zugeordnet sind.

## Über HACS installieren

1. Öffne **HACS → ⋮ → Benutzerdefinierte Repositorys**.
2. Füge die GitHub-Adresse dieses Repositorys hinzu und wähle **Dashboard**.
3. Öffne **Boiler, Pufferspeicher und Zirkulation** in HACS und wähle **Herunterladen**. Lade das Dashboard anschließend neu.
4. Bearbeite dein Dashboard, füge eine **manuelle Karte** hinzu und übernimm [example.yaml](example.yaml). Ersetze die Beispiel-IDs durch deine Entitäts-IDs aus **Entwicklerwerkzeuge → Zustände**.

Für eine erste Anzeige kannst du die primäre Entität zuordnen.

```yaml
type: custom:boiler-puffer-dashboard-card
entitaeten:
  boiler:
    temperatur_bf1: sensor.beispiel_boiler_temperatur_bf1
```

Die übrigen Zuordnungen kannst du nach Bedarf aus [example.yaml](example.yaml) ergänzen. Ohne Zuordnung verwendet die Karte Platzhalter-IDs.

Die Schaltfläche für die Warmwasserzirkulation ruft das unter `zirkulation.startskript` zugeordnete `script.*` auf. `zirkulation.pumpe_relais` liefert den Pumpenstatus. Lege das Skript in Home Assistant an oder verwende ein bestehendes Skript, das die Pumpe wie gewünscht steuert.

## Fühlerhöhen am Boiler einstellen

Öffne im Dashboard **Dashboard bearbeiten → Karte bearbeiten**. Trage im visuellen Editor die Innenhöhe des Speichers und die Höhen von **HF2**, **BF1** und **HF1** in Millimetern ein. Miss die Fühlerhöhen ab Speicherboden. Bei **0 mm** liegt der Fühler unten, bei **Speicherhöhe** ganz oben. Die Vorschau zeigt die neuen Positionen, sobald du ein Feld verlässt oder die Eingabe bestätigst.

Dieselben Werte kannst du im YAML-Editor unter `boiler_hoehen` setzen. Bei ausgelassenen Feldern gelten die bisherigen Höhen aus diesem Beispiel.

```yaml
boiler_hoehen:
  speicher_mm: 1410
  hf2_mm: 1140
  bf1_mm: 1140
  hf1_mm: 525
```

Die Karte verschiebt die Markierungen und Temperaturfelder und berechnet die Temperaturschichtung sowie den Ladeindex mit den eingestellten Höhen. Liegen mehrere Fühler auf derselben Höhe, mittelt die Karte ihre verfügbaren Messwerte für die Berechnung. Der Ladeindex benötigt Messwerte an mindestens zwei verschiedenen Höhen.

## GitHub-Repository anlegen

Lege ein öffentliches Repository mit dem Namen `boiler-puffer-dashboard-card` an. Lade die Dateien aus dem entpackten Einzelarchiv direkt in die Wurzel des Repositorys. HACS lädt die fertige Ressource `boiler-puffer-dashboard-card.js` aus dem Standardbranch. Ein GitHub-Release ist optional.

Wenn Home Assistant meldet, dass der Kartentyp fehlt, lade die Seite neu und prüfe unter **Einstellungen → Dashboards → ⋮ → Ressourcen**, ob die Ressource als **JavaScript-Modul** eingetragen ist. Bei YAML-verwalteten Dashboard-Ressourcen ergänze die URL aus HACS in deiner YAML-Ressourcenliste.

[HACS-Dokumentation für Dashboard-Repositorys](https://www.hacs.xyz/docs/publish/plugin/) · [Benutzerdefinierte Repositorys](https://www.hacs.xyz/docs/faq/custom_repositories/)
