/* ==========================================================================
   Orlando Costi Visuals - Interactive Scripts
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Navigation Toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navLinksList = document.querySelectorAll('.nav-link');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            
            // Block body scroll
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        navLinksList.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // 2. Header Scroll Effect
    const header = document.querySelector('.main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.padding = '15px 40px';
            header.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.padding = '30px 40px';
            header.style.boxShadow = 'none';
        }
    });

    // 3. Gallery Filtering
    const filterButtons = document.querySelectorAll('.filter-btn');
    const filterItems = document.querySelectorAll('.filter-item');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and add to clicked
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            filterItems.forEach(item => {
                const category = item.getAttribute('data-category');
                
                if (filterValue === 'all') {
                    item.classList.remove('hide');
                } else if (filterValue === 'photo' && category === 'photo') {
                    item.classList.remove('hide');
                } else if (filterValue === 'cinema' && category === 'cinema') {
                    item.classList.remove('hide');
                } else {
                    item.classList.add('hide');
                }
            });
        });
    });

    // 4. Lightbox Modal for Photos & Videos
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxVideoContainer = document.getElementById('lightbox-video-container');
    const lightboxVideoTitle = document.getElementById('lightbox-video-title');
    const lightboxCaption = document.getElementById('lightbox-caption');

    // Get only visible/filtered photo elements for navigation
    let photoItems = [];
    let currentPhotoIndex = 0;

    const updatePhotoItemsList = () => {
        // Collect all photo items that are currently not hidden
        photoItems = Array.from(document.querySelectorAll('.filter-item[data-category="photo"]:not(.hide)'));
    };

    const openLightbox = (type, data) => {
        // Hide all media types initially
        lightboxImg.classList.remove('active');
        lightboxVideoContainer.classList.remove('active');
        
        // Show/hide navigation arrows
        if (type === 'photo') {
            lightboxPrev.style.display = 'block';
            lightboxNext.style.display = 'block';
            
            // Set image source and caption
            lightboxImg.src = data.src;
            lightboxImg.alt = data.alt;
            lightboxImg.classList.add('active');
            lightboxCaption.textContent = data.caption;
        } else if (type === 'video') {
            lightboxPrev.style.display = 'none';
            lightboxNext.style.display = 'none';
            
            // Show video notice
            lightboxVideoTitle.textContent = data.title;
            lightboxVideoContainer.classList.add('active');
            lightboxCaption.textContent = 'Cinematografia / Cortometraggio';
        }

        lightboxModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Block background scroll
    };

    const closeLightbox = () => {
        lightboxModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    // Attach click events to project cards
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const category = card.getAttribute('data-category');
            
            if (category === 'photo') {
                updatePhotoItemsList();
                const photoVisual = card.querySelector('.photo-item');
                const photoSrc = photoVisual.getAttribute('data-src');
                const photoAlt = card.querySelector('img').alt;
                const photoTitle = card.querySelector('.project-name').textContent;
                const photoDesc = card.querySelector('.project-description').textContent;
                
                // Find index in the current filtered list
                currentPhotoIndex = photoItems.findIndex(item => item.querySelector('.photo-item').getAttribute('data-src') === photoSrc);
                
                openLightbox('photo', {
                    src: photoSrc,
                    alt: photoAlt,
                    caption: `${photoTitle} — ${photoDesc}`
                });
            } else if (category === 'cinema') {
                const videoTitle = card.querySelector('.project-name').textContent;
                openLightbox('video', {
                    title: videoTitle
                });
            }
        });
    });

    // Navigation through photos
    const showPrevPhoto = () => {
        if (photoItems.length <= 1) return;
        currentPhotoIndex = (currentPhotoIndex - 1 + photoItems.length) % photoItems.length;
        
        const prevCard = photoItems[currentPhotoIndex];
        const visual = prevCard.querySelector('.photo-item');
        const src = visual.getAttribute('data-src');
        const alt = prevCard.querySelector('img').alt;
        const title = prevCard.querySelector('.project-name').textContent;
        const desc = prevCard.querySelector('.project-description').textContent;

        lightboxImg.src = src;
        lightboxImg.alt = alt;
        lightboxCaption.textContent = `${title} — ${desc}`;
    };

    const showNextPhoto = () => {
        if (photoItems.length <= 1) return;
        currentPhotoIndex = (currentPhotoIndex + 1) % photoItems.length;
        
        const nextCard = photoItems[currentPhotoIndex];
        const visual = nextCard.querySelector('.photo-item');
        const src = visual.getAttribute('data-src');
        const alt = nextCard.querySelector('img').alt;
        const title = nextCard.querySelector('.project-name').textContent;
        const desc = nextCard.querySelector('.project-description').textContent;

        lightboxImg.src = src;
        lightboxImg.alt = alt;
        lightboxCaption.textContent = `${title} — ${desc}`;
    };

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            showPrevPhoto();
        });
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            showNextPhoto();
        });
        
        // Close on clicking the dark background
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal || e.target.classList.contains('lightbox-content')) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!lightboxModal.classList.contains('active')) return;
            
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft' && lightboxImg.classList.contains('active')) {
                showPrevPhoto();
            } else if (e.key === 'ArrowRight' && lightboxImg.classList.contains('active')) {
                showNextPhoto();
            }
        });
    }

    // 5. Contact Form Submission (Simulation)
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nameInput = document.getElementById('name').value;
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Invio in corso...';
            submitBtn.style.opacity = '0.7';

            setTimeout(() => {
                submitBtn.style.backgroundColor = '#28a745';
                submitBtn.style.borderColor = '#28a745';
                submitBtn.style.color = '#fff';
                submitBtn.textContent = 'Messaggio Inviato!';
                
                alert(`Grazie ${nameInput}! Il tuo messaggio è stato simulato correttamente. Configura un servizio come Formspree o Netlify Forms per riceverlo realmente.`);
                
                contactForm.reset();
                
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    submitBtn.style.backgroundColor = '';
                    submitBtn.style.borderColor = '';
                    submitBtn.style.color = '';
                    submitBtn.style.opacity = '';
                }, 3000);
            }, 1200);
        });
    }

    // 6. Subtle scroll reveal effect for sections
    const sections = document.querySelectorAll('section');
    const revealOnScroll = () => {
        const triggerBottom = window.innerHeight * 0.85;
        
        sections.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            if (sectionTop < triggerBottom) {
                section.style.opacity = '1';
                section.style.transform = 'translateY(0)';
            }
        });
    };
    
    sections.forEach(section => {
        if (section.id !== 'hero') {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            section.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        }
    });

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger once on load
});
