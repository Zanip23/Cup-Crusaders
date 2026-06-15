# 01 – Tech-Stack

## Entscheidung (TL;DR)

| Bereich | Wahl | Version (Ziel) |
|---|---|---|
| Renderer / Engine | **Phaser 3** | ^3.80 |
| Physik (nur Drop-Phase) | **Matter.js** (Phasers integriertes Plugin) | mit Phaser gebündelt |
| Physik (Kampf-Phase) | **Phaser Arcade** | mit Phaser gebündelt |
| Sprache | **TypeScript** | ^5.x |
| Build/Dev | **Vite** | ^5.x |
| UI-Overlays (Shop/HUD) | **HTML/CSS-DOM** über dem Canvas | nativ |
| Auslieferung | **PWA** (Web App Manifest) — installierbar, offline-first | nativ |
| Persistenz | **IndexedDB** (gekapselt hinter `SaveRepository`) | nativ |
| Offline/Cache | **Service Worker + CacheStorage** (App-Shell & Assets) | nativ |
| Input | **Pointer Events** (Touch/Maus/Pen einheitlich) | nativ |
| Tests | **Vitest** (Logik/Reducer), evtl. Playwright (E2E) später | ^2.x |
| Lint/Format | **ESLint + Prettier** | aktuell |

---

## Begründungen

### Warum Phaser 3 (statt reines Canvas oder React)
- Speziell für 2D-Web-Games: Szenen-System, Asset-Loader, Touch-Input,
  Sprite-/Tween-System, Kamera, Game-Loop — alles vorhanden.
- **Pixel-Art-Support:** `pixelArt: true` + `roundPixels` für scharfes
  Nearest-Neighbor-Scaling.
- Reines Canvas würde 80 % dieser Infrastruktur nachbauen → schlechtes
  Aufwand/Nutzen-Verhältnis.
- React's Render-Zyklus konkurriert mit dem 60-FPS-Loop. Phaser besitzt den Loop;
  DOM/CSS übernimmt nur statische UI billiger als React.

### Warum Matter.js nur in der Drop-Phase
Phaser bietet zwei Physik-Engines:
- **Arcade:** schnell, AABB, kein echter Bounce → ideal für Kampf (Bewegung,
  Overlap-Trefferprüfung).
- **Matter.js:** echte Restitution/Reibung/runde Collider → **zwingend** für
  glaubwürdiges Pachinko-Abprallen an runden Pegs.

Wir aktivieren Matter **nur** in der `DropScene`, um Mobile-Performance im Kampf
nicht zu belasten.

### Warum TypeScript
Bei zustandslastigem Loop mit hunderten Content-Einträgen sind getypte Schemas
und Reducer essenziell. Verhindert eine ganze Klasse von Bugs bei
Phasenübergängen und Modifier-Stacking.

### Warum Vite
Schneller Dev-Server, HMR, schlankes Production-Bundle. De-facto-Standard für
Phaser + TS.

### Warum DOM für UI-Overlays
Shop-Karten, HUD, Lebensbalken-Overlays und der Ability-Deck sind als DOM/CSS
responsiver, einfacher zu stylen/lokalisieren und barriereärmer als Canvas-UI.
Strikte Kapselung: DOM kommuniziert mit Phaser **nur** über den EventBus.

---

## Wichtige Phaser-Game-Config (Zielwerte)

```ts
{
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,         // skaliert auf Portrait-Viewport
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,                      // interne Auflösung (Design-Referenz)
    height: 1280,                    // 9:16 Portrait
  },
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#1a1a2e',
  physics: { default: 'arcade' },    // Matter wird pro-Scene aktiviert
}
```

Interne Referenzauflösung **720×1280 (9:16)**. Begründung & Safe-Areas siehe
[03 – Portrait-Layout & UX](03-portrait-layout-and-ux.md).

---

## PWA & Offline-First ([ADR-008](decisions.md))
- **Installierbar** über ein **Web App Manifest** (Name, Icons, Portrait-Orientation,
  `display: standalone`) → „Zum Homescreen hinzufügen".
- **Service Worker** cached App-Shell, Core-Assets und einen Offline-Fallback →
  schnelle Warmstarts und Spielbarkeit ohne Netz.
- **IndexedDB** als lokaler Speicher (statt localStorage), weil das wachsende
  Inventar (hunderte `ItemInstance`, siehe [09](09-game-state.md)) strukturierte,
  größere Clientdaten braucht.
- Vollständig kompatibel mit **ADR-004** (Single-Player, kein Backend): kein Server,
  kein Account, kein Cloud-Sync nötig.
- **WebGL-Context-Loss** robust behandeln (mobile Tabs verlieren GPU-Kontexte).

## Abhängigkeits-Philosophie
- **Wenige Dependencies.** Game-Engine + Build-Tool + Test-Runner. Keine schweren
  UI-Frameworks.
- **Persistenz hinter einem Interface** (`SaveRepository`), Default-Impl. IndexedDB
  — austauschbar, ohne Spielcode anzufassen.
- **Feature Detection statt User-Agent-Sniffing** (Vibration, ScreenOrientation,
  Audio-Latenz sind nicht überall verfügbar).
- Alle Content-Daten als **typisierte Config-Module/JSON**, nie hartcodiert in
  Logik.
