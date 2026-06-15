# 07 – Meta-Progression & Ausrüstung

Dies ist die **Langzeit-Progression** *zwischen* Runs (im `MetaScene`/Hauptmenü).
Sie unterscheidet sich von den **Run-Upgrades** der Shop-Phase (die mit dem Run
enden).

> **Trennung wichtig:**
> - **Run-Scope** (verfällt): Shop-Upgrades, `run.playerStats`, gesammelte Bälle.
> - **Meta-Scope** (permanent, gespeichert): Ausrüstung, Item-Level, freigeschaltete
>   Abilities, permanente Stat-Boni, Währungen (Gold/Baupläne).

---

## Ausrüstungs-Slots
Der Held hat **6 Slots**:

| Slot | Primär-Boni (Beispiel) |
|---|---|
| Waffe | viel Angriff |
| Helm | HP |
| Rüstung | HP + Abwehr/Armor |
| Handschuhe | Angriff |
| Schuhe | HP (+Move/Attack-Speed-Flavor) |
| Ring | Spezial-Stats (z. B. Krit-Chance) |

Items liefern Boni als **Modifikatoren** über die
[StatEngine](08-data-schemas.md) — keine Sonderlogik pro Item.

---

## Seltenheit (Rarity)
```
Grau (Common) → Grün (Uncommon) → Blau (Rare) → Lila (Epic) → Rot (Legendary)
```
- Rarität bestimmt Anzahl/Stärke der Affixe und die Farbkodierung in der UI.
- Definiert als geordnete Enum mit Farbwerten in den Content-Daten.

---

## Merge-System (fairer Loot-Grind)
- **3 identische Items** derselben Rarität → **1 Item** nächsthöherer Rarität.
  ```
  3× graues Schwert  → 1× grünes Schwert
  3× grünes Schwert  → 1× blaues Schwert
  ...
  ```
- **Fairness-Designentscheidung (Anti-P2W):** Merge-Material wird **ausschließlich
  durch Gameplay** verdient, nie durch Echtgeld:
  - Jeder besiegte **Boss** (z. B. Welle 15) droppt **garantiert** ein Item.
  - Reguläre Runs droppen Items nach definierten Tabellen.
- Merge-Regeln (was mit was mergebar ist: gleicher Item-Typ? gleiches Level?)
  sind **Daten-/Regel-getrieben** und in [08](08-data-schemas.md) spezifiziert.

---

## Item-Level (Basis-Stats hochleveln)
- Zusätzlich zur Rarität hat jedes Item ein **Level** (1, 2, 3, …).
- Im Hauptmenü mit **Gold** + **Baupläne** (während Runs verdient) verbesserbar
  (z. B. Waffe Lv1 → Lv5).
- Finaler Item-Stat = `baseStat(rarity) × levelMultiplier(level) + affixe`.

---

## Meta-Währungen
| Währung | Quelle | Verwendung |
|---|---|---|
| **Bälle** | innerhalb eines Runs | Shop-Upgrades (verfällt mit Run) |
| **Gold** | Run-Belohnungen, Verkauf | Item-Leveling |
| **Baupläne** | Run-Belohnungen, Bosse | Item-Leveling (höhere Stufen) |

> Genaues Belohnungs-/Drop-Balancing in
> [10 – Content-Pipeline & Balancing](10-content-pipeline-and-balancing.md).

---

## Permanente Passiv-Skills (Meta)
- Erhöhung der **Basis-Angriffskraft**, **Max-HP**, **Armor** etc.
- Schaltbar über einen Meta-Skilltree/Upgrade-Bildschirm (Gold/Baupläne).
- Fließen als **permanente Modifikatoren** in die StatEngine ein und gelten ab
  Run-Start.

---

## Verhältnis zur StatEngine
Sowohl Run-Upgrades als auch Meta-Items/-Skills sind nur **Quellen von
Modifikatoren** mit unterschiedlicher **Lebensdauer (Scope)**:

```
finaler Stat = base
             + Σ Meta-Modifier (permanent: Items, Meta-Skills)
             + Σ Run-Modifier  (temporär: Shop-Upgrades, Buffs)
```
Die StatEngine kennt nur "Modifier + Scope", nicht deren Herkunft → das hält das
System für hunderte Items/Upgrades offen. Details in
[08 – Daten-Schemas](08-data-schemas.md).
