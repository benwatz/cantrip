# Tests de non-régression — Cantrip

Ce fichier liste des scénarios de test, écrits pour être **exécutés par Claude** via le
navigateur intégré (Browser pane), pas par un framework de test (cohérent avec le choix du
projet : pas de build step, pas de dépendance de test). Tous les scénarios sont exécutables sans
intervention humaine — aucun ne dépend d'un compte externe ou d'une action manuelle.

## Comment ça marche

Quand on demande "passe les tests de non-régression" (ou une sélection de sections précises) :

1. Claude ouvre `index.html` dans le Browser pane (`preview_start`/`navigate`), en général en
   viewport mobile (375×812, cf. `resize_window`).
2. Pour chaque scénario : exécute les étapes (clics via `javascript_tool` sur les éléments
   `[data-action="..."]`, ou `computer`/`read_page` quand une interaction visuelle réelle est
   nécessaire), puis vérifie le résultat attendu via `get_page_text` / `read_page` /
   `javascript_tool` (lecture directe du DOM) et `read_console_messages` (aucune erreur JS
   pendant tout le run).
3. Un scénario est **PASS** si le résultat observé correspond au résultat attendu et qu'aucune
   erreur console n'est apparue ; **FAIL** sinon (avec le détail de l'écart).
4. À la fin, Claude fournit un tableau récapitulatif (section / scénario / personnage / statut)
   plutôt qu'un simple "tout est bon".

**Chaque scénario doit être rejoué pour les deux personnages (Calix et Deneor)**, via l'astuce
de bascule ci-dessous, sauf mention contraire explicite dans le scénario (ex. 1.1/1.2, qui portent
sur l'état vierge par défaut, toujours Calix). Les deux profils divergent assez (types de
ressource de classe — badges chez Calix, counter chez Deneor —, contenu du grimoire, thème
visuel) pour que passer un scénario sur un seul personnage ne couvre pas l'autre chemin de code.

Pour rejouer un test depuis un état propre, recharger la page vide le state en mémoire mais
**pas** `localStorage` — pour repartir d'un profil vierge, effacer la clé `jdr_character_tracker_state`
avant de recharger (`localStorage.removeItem('jdr_character_tracker_state')`).

### Astuce : changer de personnage actif sans Google Drive

Le seul chemin normal pour charger Deneor passe par une synchro Google Drive (compte réel,
hors de portée de Claude). Pour les tests qui ont besoin du profil/thème Deneor, contourner via
`localStorage` puis recharger :

```js
var raw = localStorage.getItem('jdr_character_tracker_state');
var parsed = raw ? JSON.parse(raw) : null;
if (parsed) { parsed.activeCharacterId = 'deneor'; localStorage.setItem('jdr_character_tracker_state', JSON.stringify(parsed)); }
```

(Si `raw` est `null`, provoquer d'abord une sauvegarde — n'importe quelle mutation dans l'app,
ex. un tap sur +1 PV — pour forcer un premier `saveState()`, puis relire.)

---

## 1. Démarrage / état initial

**1.1 — Chargement sans erreur**
- Étapes : charger `index.html` (state vierge, `localStorage` vide).
- Attendu : page "Suivi — Calix Noctavel", aucune erreur dans la console (les warnings Tailwind
  CDN sont normaux et à ignorer), thème Calix (`data-theme` absent ou `"calix"` sur `<html>`).

**1.2 — Persistance après rechargement**
- Étapes : depuis le Tracker, taper `+` sur les PV une fois ; noter la valeur ; recharger la page.
- Attendu : la valeur de PV modifiée est conservée après rechargement (lue depuis `localStorage`).

---

## 2. Tracker

**2.1 — Dégâts / soins**
- Étapes : noter `hp.current` ; cliquer `[data-action="damage"]` une fois ; cliquer
  `[data-action="heal"]` une fois.
- Attendu : PV décrémenté de 1 puis re-incrémenté de 1 (retour à la valeur initiale), jamais en
  dessous de 0 ni au-dessus du max.

**2.2 — Bouclier temporaire**
- Étapes : cliquer sur la valeur de bouclier temporaire pour l'éditer, saisir une valeur, valider
  (Entrée ou blur).
- Attendu : la valeur affichée sur le Tracker reflète le nouveau bouclier temporaire.

**2.3 — Emplacements de sorts (badges)**
- Étapes : sur une rangée de niveau à ≥3 emplacements, cliquer le bouton `−` de la rangée deux
  fois, puis `+` une fois.
- Attendu : consommation démarre par le badge le plus à droite (`used.lastIndexOf(false)`),
  restauration reprend le badge le plus à gauche parmi les utilisés (dernier consommé) ; le
  compteur "x/x" reflète l'état à chaque étape.

**2.4 — Ressource de classe (badges) sans les boutons −/+ dédiés (<3 emplacements)**
- Étapes : sur une ressource de classe à 1 ou 2 emplacements, taper directement sur un badge.
- Attendu : le badge togglé change d'état ; aucun bouton `−`/`+` dédié n'est affiché pour cette
  rangée.

**2.5 — Ressource de classe (counter)**
- Étapes : sur une ressource de type `counter`, cliquer `[data-action="counter-dec"]` puis
  `[data-action="counter-inc"]`.
- Attendu : la valeur `current` diminue puis remonte, sans jamais sortir de `[0, max]`.

**2.6 — Blocs pliables (Attaque / Ressources / Emplacements de sorts)**
- Étapes : cliquer le chevron d'un bloc pour le replier, puis le redéplier
  (`[data-action="toggle-tracker-block"]`).
- Attendu : le contenu du bloc disparaît entièrement (pas de carte vide) quand replié, réapparaît
  identique une fois redéplié.

**2.7 — Édition inline des tuiles de combat**
- Étapes : taper sur la valeur d'une tuile (ex. CA), saisir une nouvelle valeur, valider.
- Attendu : la tuile affiche la nouvelle valeur ; `initiative`/`spellAttackBonus` acceptent un
  signe (`+`/`−`) et l'affichent via un format signé ; `hitDice` accepte du texte libre (ex.
  "5d8") sans être transformé en nombre.

**2.8 — Repos**
- Étapes : ouvrir la modale Repos (`[data-action="open-rest"]`), cocher "Restaurer les points de
  vie", cliquer "Se reposer".
- Attendu : PV remis au max, modale fermée, toast de confirmation affiché ; aucun bouton
  "Se reposer et préparer des sorts" n'existe (fonctionnalité retirée).

**2.9 — Concentration**
- Étapes : activer `[data-action="toggle-concentration"]` (ou action équivalente), puis infliger
  des dégâts (`[data-action="damage"]`).
- Attendu : liseret violet animé autour du bloc PV pendant que la concentration est active ; un
  toast d'alerte concentration apparaît après les dégâts (au maximum une fois par fenêtre de 30s).

---

## 3. Personnage (Stats/Skills)

**3.1 — Recherche de compétence : tri par pertinence**
- Étapes : taper "H" dans le champ de recherche compétences.
- Attendu : "Histoire" apparaît avant "Athlétisme" dans les résultats (correspondance en début de
  nom prioritaire sur "contient").

**3.2 — Masquage du bloc Caractéristiques au focus**
- Étapes : focus sur le champ de recherche (`#statsSearchInput`).
- Attendu : `#statsAbilitiesBlock` passe à `display:none` ; une croix de reset apparaît
  (`#statsResetBtn`) sans qu'un `render()` complet ne soit déclenché (pas de perte de focus).

**3.3 — Reset de la vue**
- Étapes : avec une recherche active, cliquer la croix de reset.
- Attendu : `ui.statsSearch` vidé, champ perd le focus, bloc Caractéristiques réapparaît.

---

## 4. Grimoire (V2)

**4.1 — Pas de résidu de la fonctionnalité de préparation**
- Étapes : ouvrir le Grimoire sur Calix, puis (via l'astuce localStorage) sur Deneor.
- Attendu : aucun bouton "Préparer mes sorts", aucune route `grimoire-prepare` accessible ;
  Deneor affiche l'intégralité de son grimoire comme Calix (aucun sort masqué faute d'être
  "préparé").

**4.2 — Recherche**
- Étapes : taper le nom (ou un préfixe) d'un sort existant dans `#grimoireSearchInput`.
- Attendu : seules les sections contenant des correspondances s'affichent, triées par pertinence
  (exact > préfixe > contient) ; la barre de niveau (`#grimoireChromeBlock`) est masquée pendant
  la recherche.

**4.3 — Sélecteur de niveau, avec Tous/Favoris en bornes de la chaîne**
- Étapes : depuis le mode "Tous", vérifier que la flèche gauche est désactivée et que la flèche
  droite est active ; cliquer la flèche droite plusieurs fois de suite.
- Attendu : la flèche droite depuis "Tous" mène au premier niveau (0 ou 1 selon si le personnage a
  des sorts mineurs) ; le niveau affiché avance ensuite à chaque clic jusqu'à "Classe", puis un
  clic de plus mène à "Favoris" (flèche droite désactivée une fois sur "Favoris"). Depuis
  "Favoris", la flèche gauche est active et ramène à "Classe" ; la flèche droite y est désactivée.

**4.4 — Mode "Tous" et "Favoris"**
- Étapes : cliquer `[data-action="grimoire-tab"][data-tab="tous"]`, puis
  `[data-action="grimoire-tab"][data-tab="favoris"]`.
- Attendu : "Tous" affiche toutes les sections concaténées. Pour "Favoris" :
  - Calix (état vierge, aucun favori) : message "Aucun sort en favori...".
  - Deneor (profil par défaut) : le profil par défaut a des favoris pré-remplis (migrés depuis
    l'ancienne liste de sorts préparés — "Bouclier de la foi", "Cérémonie", "Châtiment
    calcinant", etc.) — la liste ne doit donc **pas** être vide, ces sorts doivent apparaître.

**4.5 — Toggle favori**
- Étapes : en mode "Tous", cliquer l'étoile d'un sort (`[data-action="toggle-favorite-spell"]`),
  puis aller en mode "Favoris".
- Attendu : le sort favorité apparaît dans la liste "Favoris" ; cliquer à nouveau l'étoile le
  retire des favoris.

**4.6 — Popup de détail**
- Étapes : cliquer sur une ligne de sort (hors étoile).
- Attendu : une popup s'ouvre avec le nom complet, niveau, type, portée, description et note sans
  troncature ; se ferme au clic sur le fond ou la croix.

**4.7 — Barre Tous/Favoris : bords + taille**
- Étapes : mesurer (`getBoundingClientRect`) le bouton "Tous" et le bouton "Favoris" dans
  `#grimoireChromeBlock`.
- Attendu : "Tous" est collé au bord gauche de la carte, "Favoris" au bord droit (mêmes marges que
  le padding de la carte) ; hauteur des boutons ≈ 58px. Le bouton central affiche "-" en mode
  Tous, "Niv.N" pour un niveau, "Classe" ou "Favoris" selon le mode.

**4.8 — Menu déroulant de sélection de niveau**
- Étapes : cliquer le bouton central (`[data-action="toggle-grimoire-level-menu"]`) pour ouvrir la
  grille de niveaux.
- Attendu : la grille apparaît avec un espace visible entre elle et la barre au-dessus (pas
  collée), cellules assez grandes pour être tapées confortablement (~46px de haut) ; cliquer une
  entrée sélectionne ce niveau et referme le menu.

---

## 5. Paramètres

**5.1 — Menu Paramètres**
- Étapes : ouvrir l'onglet Paramètres.
- Attendu : exactement 3 entrées : "Paramétrer les statistiques", "Gestion des personnages",
  "Codex" — aucune entrée "Paramétrer le Grimoire".

**5.2 — Verrou d'édition (Paramétrer les statistiques)**
- Étapes : ouvrir la page ; vérifier que les champs sont désactivés ; cliquer "Modifier" ; vérifier
  qu'ils deviennent éditables ; cliquer "Annuler".
- Attendu : en lecture seule au départ ; après "Modifier", champs éditables et boutons
  "Annuler"/"Valider" visibles ; "Annuler" abandonne les changements sans `saveState()`.

**5.3 — Activation en cascade des niveaux de sorts**
- Étapes : en mode édition, tenter d'activer le niveau 3 alors que le niveau 2 est désactivé.
- Attendu : message d'erreur affiché (`ui.settingsLevelError`), niveau 3 non activé, pas
  d'auto-activation du niveau 2.

**5.4 — Désactivation en cascade avec confirmation**
- Étapes : désactiver un niveau de sorts intermédiaire alors que des niveaux supérieurs sont
  actifs.
- Attendu : une modale de confirmation apparaît, prévenant que les niveaux supérieurs seront aussi
  désactivés.

**5.5 — Ajout / suppression d'attaque**
- Étapes : cliquer "+ Ajouter une arme", remplir un nom, cliquer "Valider".
- Attendu : l'arme apparaît dans le bloc "Attaque" du Tracker avec l'icône correcte (épée si
  Mêlée, arc + portée sinon).

**5.6 — Gestion des personnages : carrousel**
- Étapes : ouvrir "Gestion des personnages", cliquer la flèche droite du carrousel.
- Attendu : passage de Calix à Deneor (ou vice-versa) avec l'animation `character-anim-next`,
  badge "Personnage chargé" affiché uniquement sur le personnage actif.

---

## 6. Thèmes

**6.1 — Thème Calix par défaut**
- Étapes : sur un state vierge, vérifier `document.documentElement.getAttribute('data-theme')`.
- Attendu : `null` ou absence de valeur "deneor" (thème Calix = valeurs par défaut de `:root`).

**6.2 — Thème Deneor**
- Étapes : basculer `activeCharacterId` sur `'deneor'` via l'astuce localStorage, recharger.
- Attendu : `data-theme="deneor"` sur `<html>`, palette sombre verte visible, `<meta
  name="theme-color">` mis à jour en conséquence.

---

## Gabarit de rapport

| Section | Scénario | Personnage | Statut | Détail si FAIL |
|---|---|---|---|---|
| 2. Tracker | 2.3 Emplacements de sorts | Calix | PASS | — |
| 2. Tracker | 2.3 Emplacements de sorts | Deneor | PASS | — |
| ... | ... | ... | ... | ... |

`PASS` / `FAIL`. Toute erreur console observée pendant le run (même hors d'un scénario précis)
doit être signalée séparément.
