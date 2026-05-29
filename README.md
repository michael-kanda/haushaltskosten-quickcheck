# Haushaltskosten Quickcheck

Finanz-Quickcheck Wizard für WordPress: Erfasst Haushaltskosten, Einkommen, Versicherungen und Sparpläne in einem geführten Mehrschritt-Formular und versendet eine strukturierte HTML-Zusammenfassung an den zuständigen Berater.

## Features

- **Haushaltskosten-Analyse** — Kategorisierte Einnahmen/Ausgaben mit Soll/Ist-Vergleich
- **Single oder Paar** — Person A & B getrennt erfassbar (inkl. Kinder)
- **Versicherungs-Audit** — Alle Sparten je Person (Eigenheim, Haftpflicht, BU, KFZ, etc.)
- **Sparplan-Übersicht** — Giro, Sparkonto, Bausparer, Fonds/ETF, LV, Gold mit mtl. Rate & Bestand
- **Partner-Routing** — Pro Berater eigene Empfänger-Mail via `[quickcheck partner="rh"]`
- **HTML-E-Mail-Bericht** — Strukturierte Auswertung an den Berater (optional Admin-Kopie)
- **React-Frontend** — Performante Wizard-UI mit Recharts-Visualisierung

## Installation

1. Plugin-Ordner nach `/wp-content/plugins/` hochladen
2. Plugin im WordPress-Admin aktivieren
3. Unter **Quickcheck → Partner** Berater & deren E-Mail-Adressen anlegen

## Verwendung

Shortcode auf einer beliebigen Seite einfügen:

```text
[quickcheck]
```

Mit fixem Partner:

```text
[quickcheck partner="rh"]
```

Per URL-Parameter:

```text
https://deine-seite.at/quickcheck/?partner=rh
```

## Anforderungen

- WordPress 5.0+
- PHP 7.4+

## Lizenz

GPL-2.0+

---

Entwickelt von **Michael Kanda** · [designare.at](https://designare.at)
