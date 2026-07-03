# Orlando Costi Visuals - Portfolio

Sito portfolio statico per il Visual Artist Orlando Costi (Direttore della Fotografia & Fotografo).
Dominio personalizzato: `orlandocostivisuals.com` (ospitato su GitHub Pages).

## Struttura del Progetto
* `index.html` - Struttura HTML5 semantica del sito (monopagina).
* `style.css` - Foglio di stile CSS personalizzato con griglie responsive.
* `script.js` - Logica per menu mobile e Lightbox dinamico (immagini + video iframe).
* `CNAME` - Configurazione dominio personalizzato.
* `.nojekyll` - Disattiva Jekyll su GitHub Pages (velocizza la pubblicazione a <20s).
* `.claudeignore` - Esclude le cartelle multimediali pesanti dalla scansione di Claude per risparmiare token.

## Organizzazione delle Sezioni
1. **Showreel** (`#showreel`): Lettore video nativo in cima alla pagina.
2. **Cinema** (`#cinema`): Griglia a 2 colonne per i cortometraggi. Carica i video YouTube in un iframe all'interno del Lightbox quando cliccati.
   - *A Chess Move*: Cover `assets/covers/chessboard_cover.png` | ID YouTube `xAbP0Tb6KU0`
   - *Terminal Dream*: Cover `assets/covers/beach_cover.png` | ID YouTube `LDUSHwS_K_g`
3. **Fotografia** (`#photography`): Griglia a 3 colonne (desktop) con 10 foto ottimizzate in formato `.webp` (`assets/photography/1.webp` ... `10.webp`).
4. **Chi Sono** (`#about`): Biografia dell'artista visivo (studente dell'Accademia di Belle Arti di Venezia) con focus su regia, montaggio, DoP, software 3D (Maya, Unreal, Gaea) ed editing (Adobe, DaVinci, Intelligenza Artificiale).
5. **Contatti** (`#contact`): Form di contatto.

## Logica Lightbox (`script.js`)
* Raccoglie dinamicamente tutti gli elementi fotografici per abilitare la navigazione avanti/indietro con le frecce.
* Se si clicca su un corto, disabilita le frecce di navigazione e inietta l'iframe di YouTube con autoplay attivo.
* Quando il Lightbox viene chiuso, l'iframe viene svuotato per interrompere immediatamente la riproduzione audio/video.

## Comandi utili per lo sviluppo
* Avviare server locale per test rapidi: `python -m http.server 8000` (visibile su http://localhost:8000)
* Aggiornare il sito online: `git add .` -> `git commit -m "messaggio"` -> `git push origin main` (la pubblicazione avviene automaticamente tramite GitHub Actions).
