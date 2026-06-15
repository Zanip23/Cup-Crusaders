# Glossar — einheitliche Begriffe

Damit Doku, Code und Gespräche dieselbe Sprache sprechen.

| Begriff | Bedeutung |
|---|---|
| **Run** | Ein Durchlauf vom Start bis zum Tod/Abbruch. Run-Scope-State verfällt danach. |
| **Level / Welt** | Eine Gruppe von Wellen, endet mit einem Boss. (`LevelDef`) |
| **Welle (Wave)** | Eine Gruppe gleichzeitig/gestaffelt spawnender Gegner. (`WaveDef`) |
| **Phase** | Einer der drei Loop-Abschnitte: Kampf, Drop, Shop. |
| **Rundenbasiert / Turn** | Kampfmodell mit getakteten Zügen (Held-Zug → Auflösung → Gegner-Zug → Status), kein Echtzeit (ADR-005). |
| **Hero** | Spielbarer Held als Daten-Entity (`HeroDef`); MVP = einer (ADR-006). |
| **Ball** | Die universelle Ressource: Loot (Kampf) → Munition (Drop) → Währung (Shop). |
| **Cup / Becher** | UI-Zähler im Kampf; beweglicher Munitionsbehälter im Drop. |
| **Peg** | Statisches Hindernis im Pachinko-Brett (Matter-Body). |
| **Gate / Tor** | Durchlässige Zone im Drop, die Ball-`value` modifiziert (x2, +5, −5, x0.5). |
| **Bin** | Auffangbehälter am Brettboden mit eigenem Multiplikator. |
| **Near-Miss** | Layout-Design, das "fast gewonnen" suggeriert (Wahrnehmung, nicht Mathe-Trick). |
| **Upgrade** | Run-Scope-Verbesserung aus dem Shop. (`UpgradeDef`) |
| **Item** | Meta-Scope-Ausrüstung mit Rarität/Level/Affixen. (`ItemBaseDef` / `ItemInstance`) |
| **Affix** | Einzelner Stat-Bonus auf einem Item. |
| **Merge** | 3 gleiche Items → 1 Item höherer Rarität. |
| **Rarity** | Common → Rare → Epic → Legendary → Mythic (5 Stufen, ADR-013). |
| **Ability** | Aktive, cooldown-basierte Fähigkeit im Active Ability Deck. (`AbilityDef`) |
| **Active Ability Deck** | Untere Bildschirmzone im Kampf für aktive Eingriffe. |
| **Stat** | Numerischer Spielwert (z. B. AttackDamage). (`StatKey`) |
| **Modifier** | Ein Bonus auf einen Stat mit Operation + Scope + Quelle. |
| **Scope** | Lebensdauer eines Modifiers/States: `meta` (permanent), `run`, `buff`. |
| **Effect** | Datengetriebene Verhaltens-Komponente (Composition over Inheritance). |
| **StatEngine** | Berechnet finale Stats aus Basis + Modifikatoren. |
| **EffectSystem** | Führt Effekt-Komponenten an Hook-Punkten aus. |
| **Resolver (DropResolver)** | Berechnet die finale Ballzahl aus den Drop-Ergebnissen. |
| **transfer** | Expliziter State-Kanal für die Ball-Übergabe zwischen Phasen. |
| **Registry** | Typisierte Sammlung aller Content-Defs eines Typs, per ID referenziert. |
| **Def vs. Instance** | Statischer Content (`Def`) vs. veränderlicher Spielerbesitz (`Instance`). |
| **Scaling-Profil** | Daten-beschriebene Kurve, wie Werte mit Welle/Level wachsen. |
| **Blessing** | Run-lokales Upgrade aus dem Shop-Draft (Synonym zu Upgrade in der Content-Bibliothek). |
| **Gear-Set** | Familie zusammengehöriger Items mit Setboni (Bulwark, Berserker, Shadow, Tinkerer, Hoarder). |
| **Balance-Cap** | Harte Obergrenze für einen Stat (`StatCaps`), erzwungen in der StatEngine (ADR-010). |
| **physik-autoritativ** | Drop-Ergebnis kommt allein aus der Matter.js-Simulation, ohne Steering (ADR-009). |
| **PWA** | Installierbare, offline-fähige Web-App (Manifest + Service Worker + IndexedDB, ADR-008). |
| **Seed / Rng** | Seedbarer Zufallsgenerator für Shop-/Loot-/Spawn-Zufall (testbar). Das Drop-Board ist davon ausgenommen (physik-autoritativ). |
