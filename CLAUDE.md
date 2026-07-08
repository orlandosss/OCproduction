# Orlando Costi Visuals - Portfolio

Sito portfolio statico per il Visual Artist Orlando Costi (Direttore della Fotografia & Fotografo).
Dominio personalizzato: `orlandocostivisuals.com` (ospitato su GitHub Pages).

## Struttura del Progetto
* `index.html` - Home: Hero, Cinema Stage, Chi Sono & Skills, Contatti.
* `photography.html` - Pagina fotografia: selezione progetti a cartelle + galleria spaziale 3D.
* `alt.html` - Esperimento "organico" standalone (CSS/JS inline), non linkato dal sito.
* `style.css` - Foglio di stile unico per index+photography. Estetica **costruttivista** (nero/rosso/carta): bg `#0c0b0a`, card `#17110f`, accento rosso `#e2231a`, testo carta `#f2ede1`. Display condensato `Oswald` (maiuscolo) per titoli/etichette, geometrie (cerchi/barre rosse), spigoli netti (border-radius 0) e ombre "fuori registro". Versionato via `style.css?v=N` in `<link>` per aggirare la cache (attuale: v5).
* `script.js` - Moduli condivisi (nav, header, lightbox, tilt, reveal, form) + moduli per pagina, ognuno con guard sul proprio DOM.
* `CNAME` / `.nojekyll` - Config GitHub Pages.
* `.claudeignore` - Esclude le cartelle multimediali pesanti dalla scansione di Claude.

## Sezioni ed Effetti
1. **Sfondo globale**: `.bg-ambient` (chiaroscuro neutro che respira) + `.bg-pattern` (micro-punti argento in deriva continua, loop seamless su multipli della tile 28px) + `.film-grain` (rumore SVG animato).
2. **Cinema Stage** (`#cinema`, index): sala minimale professionale.
   - Platea `.stage-seats`: due file di sagome poltrone in CSS puro (gradienti ripetuti); una sottile linea bianca sul bordo superiore degli schienali simula la luce proiettata dallo schermo (tecnica: stessa sagoma duplicata e alzata di `--lift` in colore luce).
   - Sipario `.stage-curtains`: due pannelli plissettati grigi con filo argento sul bordo interno; a riposo incorniciano lo schermo (translateX ±92%), al cambio corto si chiudono → cambio pellicola → si riaprono (sequenza JS a timeout: 780/200/820ms).
   - Una card film alla volta (16:9, cover desaturate); click → iframe YouTube nel lightbox. Film: *A Chess Move* (`xAbP0Tb6KU0`), *Terminal Dream* (`LDUSHwS_K_g`).
3. **Fotografia** (`photography.html`): vista a cartelle → zoom/fade → galleria "tunnel" 3D (scroll = volo, corridoio zig-zag con fuoco centrale, 3 canvas di polvere argento su piani di profondità). Pulsante "Torna ai Progetti".
   - Progetti in `script.js` (oggetto `PROJECTS`): p1 = `assets/photography/1..10.webp`, p2 = `assets/photography/p2/1..6.webp`.
   - Fallback: su touch/mobile/reduced-motion griglia standard.
4. **Chi Sono** (`#about`, index): bio (Accademia di Belle Arti di Venezia — Nuove Tecnologie/Multimediale; regia, montaggio, DoP) + 6 skill card con tilt 3D.
5. **Contatti** (`#contact`, index): form simulato (serve Formspree o simile per invii reali).

## Note Tecniche
* Tutti gli effetti degradano su mobile/touch e rispettano `prefers-reduced-motion`.
* I loop canvas/rAF si fermano quando le sezioni escono dallo schermo o la galleria è chiusa.
* Il lightbox condiviso gestisce foto (frecce prev/next) e video YouTube (iframe svuotato alla chiusura).
* Nuove foto: convertire in `.webp` ~1600px q82 (Pillow) per i limiti di GitHub Pages.
* Attenzione: un reset dei file tracciati (`git checkout .`) ha già cancellato una volta il lavoro non committato — committare spesso.

## Comandi utili per lo sviluppo
* Server locale: `python -m http.server 8000` (http://localhost:8000), oppure preview Claude via `.claude/launch.json` (porta 8347).
* Deploy: `git add .` -> `git commit -m "messaggio"` -> `git push origin main` (la pubblicazione avviene automaticamente tramite GitHub Actions).
