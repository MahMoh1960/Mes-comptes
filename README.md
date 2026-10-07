# Mes Comptes — حساباتي

Application de gestion financière personnelle en **dirham marocain (MAD)**, en **français et en arabe** (affichage de droite à gauche inclus).

## Fonctions
- **Comptes** : personnes, sociétés, banques. Solde positif = il vous doit, solde négatif = vous lui devez.
- **Argent** : opérations « donné / reçu », mode (espèces, chèque, virement, effet), n° de chèque, banque, échéance, photo du reçu, solde cumulé ligne par ligne.
- **Nature (troc)** : orge, blé, lentilles, paille (produits modifiables). Unités kg, quintal, tonne, sac (poids réglable), botte. Troc produit contre produit ou produit contre argent, valeur en DH facultative.
- **Bilan par compte** : totaux donné/reçu, solde, détail par produit, par campagne agricole et par mode de paiement.
- **Échéances** avec compteur de retards, **campagne agricole** (septembre à août) en filtre global.
- **Relevé PDF** (bouton « Relevé PDF » → « Enregistrer au format PDF »), partage **WhatsApp**.
- **Historique des modifications** : on annule ou corrige sans rien perdre.
- **Code PIN**, **sauvegarde / restauration JSON**, **export CSV** (Excel).
- Fonctionne **hors connexion**, installable comme une application.

## Important : où sont les données ?
Les données sont stockées **sur le téléphone** (IndexedDB), pas sur GitHub. Utilisez régulièrement
*Réglages → Exporter la sauvegarde* (et envoyez le fichier sur WhatsApp ou Drive).
Désinstaller l'application ou vider les données du navigateur efface tout.

## Étape 1 — Publier sur GitHub Pages
1. Créez un dépôt GitHub (ex. `mes-comptes`) et déposez **tous les fichiers de ce dossier** à la racine.
2. *Settings → Pages → Source : Deploy from a branch → `main` / `(root)` → Save*.
3. Après une minute, l'application est en ligne : `https://VOTRE-NOM.github.io/mes-comptes/`.
4. Ouvrez ce lien dans Chrome sur Android : menu ⋮ → **Installer l'application**.

## Étape 2 — Obtenir un APK
- **PWABuilder** (le plus simple) : allez sur https://www.pwabuilder.com, collez l'adresse GitHub Pages,
  choisissez *Package for stores → Android*, téléchargez l'APK/AAB.
  Gardez précieusement la clé de signature fournie : elle est nécessaire pour toute mise à jour.
- Alternative : **Bubblewrap** (`npm i -g @bubblewrap/cli`, puis `bubblewrap init --manifest=URL/manifest.webmanifest`).

## Mettre à jour l'application
Modifiez les fichiers, puis changez `VERSION` dans `sw.js` (ex. `mescomptes-v2`) pour que les téléphones rechargent la nouvelle version.

## Fichiers
`index.html` · `style.css` · `app.js` (logique) · `i18n.js` (textes FR/AR) · `sw.js` (hors connexion) · `manifest.webmanifest` · `icons/`

## Pistes pour la suite
Empreinte digitale (WebAuthn), graphiques, synchronisation entre appareils (nécessite un serveur), rappels par notification, import Excel.
