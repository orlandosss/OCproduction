/* ==========================================================================
   Orlando Costi Visuals - Interactive Scripts
   Shared: nav, header, lightbox, tilt, reveal, contact form.
   index.html: Cinema Stage (sipario che si apre/chiude al cambio corto).
   photography.html: selezione progetti + galleria spaziale 3D.
   Each module guards on its own DOM so the file is safe on both pages.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const pad2 = (n) => String(n).padStart(2, '0');

    /* ----------------------------------------------------------------------
       1. Mobile Navigation
    ---------------------------------------------------------------------- */
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', () => {
                mobileMenuToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    /* ----------------------------------------------------------------------
       2. Header Scroll State
    ---------------------------------------------------------------------- */
    const header = document.querySelector('.main-header');
    if (header) {
        const onHeaderScroll = () => header.classList.toggle('scrolled', window.scrollY > 50);
        window.addEventListener('scroll', onHeaderScroll, { passive: true });
        onHeaderScroll();
    }

    /* ----------------------------------------------------------------------
       3. Lightbox (shared) — photos with prev/next, YouTube videos
    ---------------------------------------------------------------------- */
    const lightbox = (() => {
        const modal = document.getElementById('lightbox-modal');
        if (!modal) return null;

        const closeBtn = document.getElementById('lightbox-close');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');
        const img = document.getElementById('lightbox-img');
        const videoContainer = document.getElementById('lightbox-video-container');
        const iframe = document.getElementById('lightbox-iframe');
        const caption = document.getElementById('lightbox-caption');

        let items = [];
        let index = 0;

        const showItem = (i) => {
            index = (i + items.length) % items.length;
            const item = items[index];
            img.src = item.src;
            img.alt = item.alt;
            caption.textContent = item.caption;
        };

        const open = (isPhoto) => {
            img.classList.toggle('active', isPhoto);
            videoContainer.classList.toggle('active', !isPhoto);
            prevBtn.style.display = isPhoto && items.length > 1 ? 'block' : 'none';
            nextBtn.style.display = isPhoto && items.length > 1 ? 'block' : 'none';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        const close = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            iframe.src = ''; // stops YouTube playback
        };

        closeBtn.addEventListener('click', close);
        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(index - 1); });
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); showItem(index + 1); });

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('lightbox-content')) close();
        });

        document.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowLeft' && img.classList.contains('active')) showItem(index - 1);
            else if (e.key === 'ArrowRight' && img.classList.contains('active')) showItem(index + 1);
        });

        return {
            openPhotos(list, startIndex = 0) {
                items = list;
                showItem(startIndex);
                open(true);
            },
            openVideo(videoId, title) {
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                caption.textContent = title;
                open(false);
            },
        };
    })();

    /* Helper: click + keyboard activation for card-like elements */
    const onActivate = (el, handler) => {
        el.addEventListener('click', handler);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    };

    /* ----------------------------------------------------------------------
       4. Cinema Stage — sipario funzionale sul cambio corto (index.html)
    ---------------------------------------------------------------------- */
    (() => {
        const stage = document.querySelector('.cinema-stage');
        if (!stage) return;

        const curtains = document.getElementById('stage-curtains');
        const slides = Array.from(stage.querySelectorAll('.stage-slide'));
        const prevBtn = document.getElementById('stage-prev');
        const nextBtn = document.getElementById('stage-next');
        const counterCurrent = document.getElementById('stage-current');
        const counterTotal = document.getElementById('stage-total');

        /* Tempi allineati alle transition CSS del sipario (0.95s + sfasamento) */
        const CLOSE_MS = 1020; // chiusura (0.95s) + sfasamento destra + margine
        const HOLD_MS = 260;   // pausa a sipario chiuso: cambio pellicola
        const OPEN_MS = 1020;  // riapertura

        let current = 0;
        let switching = false;

        if (counterTotal) counterTotal.textContent = pad2(slides.length);

        const updateCounter = () => {
            if (counterCurrent) counterCurrent.textContent = pad2(current + 1);
        };

        const swapSlides = (from, to) => {
            from.classList.remove('active');
            to.classList.add('active');
            updateCounter();
        };

        const switchTo = (nextIndex) => {
            const target = (nextIndex + slides.length) % slides.length;
            if (switching || target === current || slides.length < 2) return;

            const cur = slides[current];
            const next = slides[target];
            current = target;

            if (REDUCED_MOTION || !curtains) {
                swapSlides(cur, next);
                return;
            }

            switching = true;
            curtains.classList.add('closed');           // il sipario si chiude
            setTimeout(() => {
                swapSlides(cur, next);                  // cambio a sipario chiuso
                setTimeout(() => {
                    curtains.classList.remove('closed'); // e si riapre
                    setTimeout(() => { switching = false; }, OPEN_MS);
                }, HOLD_MS);
            }, CLOSE_MS);
        };

        if (prevBtn) prevBtn.addEventListener('click', () => switchTo(current - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => switchTo(current + 1));

        /* Open film in the lightbox */
        slides.forEach((slide) => {
            onActivate(slide, () => {
                if (lightbox) {
                    lightbox.openVideo(
                        slide.dataset.videoId,
                        slide.querySelector('.project-name').textContent
                    );
                }
            });
        });
    })();

    /* ----------------------------------------------------------------------
       5. Multi-Project Photography Gallery (photography.html)
          View 1: folder selection → View 2: spatial 3D gallery per project
    ---------------------------------------------------------------------- */
    (() => {
        const scene = document.getElementById('tunnel-scene');
        if (!scene) return;

        const world = document.getElementById('tunnel-world');
        const track = document.getElementById('tunnel-track');
        const select = document.getElementById('project-select');
        const backBtn = document.getElementById('tunnel-back');
        const titleEl = document.getElementById('tunnel-title');

        const PROJECTS = {
            p1: {
                title: 'Progetto Fotografico #1',
                photos: Array.from({ length: 10 }, (_, i) => `assets/photography/${i + 1}.webp`),
            },
            p2: {
                title: 'Progetto Fotografico #2',
                photos: Array.from({ length: 6 }, (_, i) => `assets/photography/p2/${i + 1}.webp`),
            },
        };
        /* Zig-zag corridor template, cycled over however many photos exist */
        const ZIGZAG = [[-12, 4], [13, -5], [-14, 6], [12, -7], [-11, 5],
                        [14, -4], [-13, -6], [12, 6], [-12, -5], [13, 5]];

        /* 3D flight only with a fine pointer, wide viewport and motion allowed;
           otherwise both views degrade to readable grids via default CSS */
        const CAPABLE_3D = FINE_POINTER && !REDUCED_MOTION && window.innerWidth >= 900;

        const SPACING = 540;       // depth distance between photos (px of translateZ)
        const CAM_START = -450;    // camera starts slightly behind the first photo
        const TAIL = 650;          // flight continues a bit past the last photo
        const FOCAL_Z = -300;      // depth at which a photo is "in focus" (large, centered)
        const FOCAL_RANGE = 300;   // spread of the focal zone

        let cards = [];
        let offsets = [];
        let camEnd = TAIL;
        let cam = CAM_START;
        let camTarget = CAM_START;
        let lastCam = cam;
        let mx = 0, my = 0, mxT = 0, myT = 0; // mouse, -1 … 1
        let galleryOpen = false;

        const buildGallery = (project) => {
            world.innerHTML = '';
            const items = project.photos.map((src, i) => ({
                src,
                alt: `${project.title} - Scatto ${i + 1}`,
                caption: `${project.title} — Scatto #${i + 1}`,
            }));

            cards = project.photos.map((src, i) => {
                const fig = document.createElement('figure');
                fig.className = 'tunnel-card';
                fig.tabIndex = 0;
                fig.setAttribute('role', 'button');
                fig.setAttribute('aria-label', `Apri scatto ${i + 1}`);

                const img = document.createElement('img');
                img.src = src;
                img.alt = items[i].alt;
                img.loading = 'lazy';

                const cap = document.createElement('figcaption');
                cap.textContent = `Scatto #${i + 1}`;

                fig.append(img, cap);
                onActivate(fig, () => lightbox && lightbox.openPhotos(items, i));
                world.appendChild(fig);
                return fig;
            });

            offsets = cards.map((_, i) => {
                const [tx, ty] = ZIGZAG[i % ZIGZAG.length];
                return { fx: tx / 100, fy: ty / 100 };
            });
            camEnd = (cards.length - 1) * SPACING + TAIL;
            titleEl.textContent = project.title;
        };

        const readScroll = () => {
            const max = Math.max(1, track.offsetHeight - window.innerHeight);
            const progress = clamp(window.scrollY / max, 0, 1);
            camTarget = CAM_START + progress * (camEnd - CAM_START);
        };
        window.addEventListener('scroll', () => {
            if (galleryOpen && CAPABLE_3D) readScroll();
        }, { passive: true });

        scene.addEventListener('pointermove', (e) => {
            mxT = (e.clientX / window.innerWidth) * 2 - 1;
            myT = (e.clientY / window.innerHeight) * 2 - 1;
        });
        scene.addEventListener('pointerleave', () => {
            mxT = 0;
            myT = 0;
        });

        /* --- Multi-plane dust particles: 3 layered canvases --- */
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const planes = [
            { id: 'dust-bg',  count: 60, rMin: 0.4, rMax: 1.2, alpha: 0.30, flight: 0.06, mouse: 8,  drift: 0.05, blur: 0 },
            { id: 'dust-mid', count: 42, rMin: 0.9, rMax: 2.0, alpha: 0.42, flight: 0.22, mouse: 18, drift: 0.09, blur: 0 },
            { id: 'dust-fg',  count: 16, rMin: 2.2, rMax: 4.5, alpha: 0.5,  flight: 0.55, mouse: 34, drift: 0.14, blur: 9 },
        ].map((cfg) => {
            const canvas = document.getElementById(cfg.id);
            return { ...cfg, canvas, ctx: canvas.getContext('2d'), particles: [] };
        });

        let vw = 0, vh = 0;

        const spawnPlane = (plane) => {
            plane.particles = Array.from({ length: plane.count }, () => ({
                x: Math.random() * vw,
                y: Math.random() * vh,
                r: plane.rMin + Math.random() * (plane.rMax - plane.rMin),
                vx: (Math.random() - 0.5) * plane.drift * 2,
                vy: (Math.random() - 0.5) * plane.drift,
                tw: Math.random() * Math.PI * 2,
            }));
        };

        const resize = () => {
            vw = window.innerWidth;
            vh = window.innerHeight;
            planes.forEach((plane) => {
                plane.canvas.width = Math.floor(vw * DPR);
                plane.canvas.height = Math.floor(vh * DPR);
                plane.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                spawnPlane(plane);
            });
            readScroll();
        };
        window.addEventListener('resize', resize);

        const drawPlanes = (flightVel) => {
            planes.forEach((plane) => {
                const { ctx } = plane;
                ctx.clearRect(0, 0, vw, vh);
                if (plane.blur) {
                    ctx.shadowBlur = plane.blur;
                    ctx.shadowColor = 'rgba(240, 240, 244, 0.7)';
                }
                for (const p of plane.particles) {
                    p.tw += 0.02;
                    p.x += p.vx;
                    p.y += p.vy + flightVel * plane.flight;

                    if (p.x < -12) p.x = vw + 12;
                    else if (p.x > vw + 12) p.x = -12;
                    if (p.y < -12) p.y = vh + 12;
                    else if (p.y > vh + 12) p.y = -12;

                    const alpha = plane.alpha * (0.65 + 0.35 * Math.sin(p.tw));
                    ctx.beginPath();
                    /* Layers shift in opposition to the cursor for depth feel */
                    ctx.arc(p.x - mx * plane.mouse, p.y - my * plane.mouse, p.r, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(216, 218, 224, ${alpha.toFixed(3)})`; /* polvere argento */
                    ctx.fill();
                }
                if (plane.blur) ctx.shadowBlur = 0;
            });
        };

        /* --- HUD --- */
        const hint = document.getElementById('tunnel-hint');
        const counter = document.getElementById('tunnel-counter');
        const progressFill = document.getElementById('tunnel-progress-fill');
        let hintHidden = false;

        const updateHud = () => {
            const progress = (cam - CAM_START) / (camEnd - CAM_START);
            progressFill.style.width = `${(progress * 100).toFixed(2)}%`;
            const nearest = clamp(Math.round(cam / SPACING) + 1, 1, cards.length);
            counter.textContent = `${pad2(nearest)} / ${pad2(cards.length)}`;
            if (!hintHidden && progress > 0.02) {
                hintHidden = true;
                hint.classList.add('hidden');
            }
        };

        /* --- Render pass: world tilt, card depths, dust, HUD --- */
        const render = (flightVel) => {
            /* World tilts in opposition to the cursor */
            world.style.transform = `rotateX(${(my * 2.6).toFixed(2)}deg) rotateY(${(-mx * 3.4).toFixed(2)}deg)`;

            cards.forEach((card, i) => {
                const z = cam - i * SPACING; // <0 ahead of camera, >0 passed it
                const depthRatio = clamp(1 + z / 1600, 0.15, 1); // near layers move more

                /* Focal prominence: 1 at the focal plane, → 0 for neighbours.
                   The focused photo pulls to the center and scales up;
                   adjacent photos keep/exaggerate their zig-zag side offset. */
                const focus = Math.exp(-((z - FOCAL_Z) ** 2) / (2 * FOCAL_RANGE * FOCAL_RANGE));
                const spread = 1 + (1 - focus) * 0.35;
                const x = offsets[i].fx * vw * (1 - focus * 0.8) * spread - mx * 46 * depthRatio;
                const y = offsets[i].fy * vh * (1 - focus * 0.65) * spread - my * 34 * depthRatio;
                const scale = 1 + focus * 0.16;

                let alpha = clamp((z + 4800) / 1600, 0, 1); // fade-in from the far dark
                let blur = 0;
                if (z > 0) { // flying past the photo: quick scale-up + defocus
                    alpha *= clamp(1 - z / 300, 0, 1);
                    blur = z / 45;
                }

                card.style.transform =
                    `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) ` +
                    `scale(${scale.toFixed(3)})`;
                card.style.opacity = alpha.toFixed(3);
                card.style.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : '';
                card.style.pointerEvents = (z > -1900 && z < 140 && alpha > 0.25) ? 'auto' : 'none';
            });

            drawPlanes(flightVel);
            updateHud();
        };

        /* --- Main flight loop (runs only while a gallery is open in 3D) --- */
        let rafId = null;

        const frame = () => {
            cam = lerp(cam, camTarget, 0.085);
            mx = lerp(mx, mxT, 0.06);
            my = lerp(my, myT, 0.06);
            const flightVel = cam - lastCam;
            lastCam = cam;
            render(flightVel);
            rafId = galleryOpen ? requestAnimationFrame(frame) : null;
        };

        const startLoop = () => {
            if (rafId === null) rafId = requestAnimationFrame(frame);
        };
        const stopLoop = () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        /* --- View switching: folder selection ⇄ immersive gallery --- */
        const openProject = (id) => {
            const project = PROJECTS[id];
            if (!project || galleryOpen) return;

            select.classList.add('zoom-out');
            setTimeout(() => {
                select.classList.remove('zoom-out');
                select.classList.add('view-hidden');

                buildGallery(project);
                scene.classList.remove('view-hidden');
                scene.classList.add('view-enter');
                setTimeout(() => scene.classList.remove('view-enter'), 700);

                galleryOpen = true;
                hintHidden = false;
                hint.classList.remove('hidden');
                window.scrollTo(0, 0);

                if (CAPABLE_3D) {
                    document.body.classList.add('tunnel-3d');
                    track.style.height = `${80 + cards.length * 62}vh`;
                    cam = camTarget = lastCam = CAM_START;
                    resize();   // canvases sized + particles spawned
                    render(0);  // synchronous first paint
                    startLoop();
                }
            }, REDUCED_MOTION ? 0 : 430);
        };

        const closeGallery = () => {
            if (!galleryOpen) return;
            galleryOpen = false;
            stopLoop();
            document.body.classList.remove('tunnel-3d');
            scene.classList.add('view-hidden');
            select.classList.remove('view-hidden');
            select.classList.add('view-enter');
            setTimeout(() => select.classList.remove('view-enter'), 700);
            window.scrollTo(0, 0);
        };

        document.querySelectorAll('.folder-card').forEach((folder) => {
            onActivate(folder, () => openProject(folder.dataset.project));
        });
        if (backBtn) backBtn.addEventListener('click', closeGallery);
    })();

    /* ----------------------------------------------------------------------
       6. 3D Tilt (skill cards) — [data-tilt="maxDeg"]
    ---------------------------------------------------------------------- */
    if (FINE_POINTER && !REDUCED_MOTION) {
        document.querySelectorAll('[data-tilt]').forEach((el) => {
            const maxTilt = parseFloat(el.dataset.tilt) || 8;

            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform =
                    `perspective(900px) rotateX(${(-py * maxTilt).toFixed(2)}deg) ` +
                    `rotateY(${(px * maxTilt).toFixed(2)}deg) translateZ(10px)`;
            });

            el.addEventListener('pointerleave', () => {
                el.style.transform = '';
            });
        });
    }

    /* ----------------------------------------------------------------------
       7. Contact Form (simulated — plug in Formspree/Netlify Forms for real)
    ---------------------------------------------------------------------- */
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Invio in corso…';

            setTimeout(() => {
                submitBtn.textContent = 'Messaggio Inviato ✓';
                if (formStatus) {
                    formStatus.textContent =
                        `Grazie ${name}! (Demo: collega Formspree o un servizio simile per ricevere i messaggi.)`;
                }
                contactForm.reset();

                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    if (formStatus) formStatus.textContent = '';
                }, 4000);
            }, 1000);
        });
    }

    /* ----------------------------------------------------------------------
       8. Scroll Reveal (index sections)
    ---------------------------------------------------------------------- */
    const revealSections = document.querySelectorAll('main > section:not(#hero):not(.tunnel-scene)');
    if (revealSections.length && 'IntersectionObserver' in window && !REDUCED_MOTION) {
        revealSections.forEach((s) => s.classList.add('reveal'));
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        revealSections.forEach((s) => revealObserver.observe(s));
    }
});
