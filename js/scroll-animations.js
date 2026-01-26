/**
 * scroll-animations.js
 * Triggers animations when elements enter viewport using IntersectionObserver
 * Initializes immediately without waiting for visualizations to load
 */

(function initScrollAnimations() {
    console.log('[ScrollAnim] Script loaded, DOM state:', document.readyState);
    
    // Run as soon as DOM is interactive (before DOMContentLoaded and before TIFFs load)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        // DOM is already ready, run immediately
        requestAnimationFrame(setup);
    }
    
    function setup() {
        console.log('[ScrollAnim] Initializing animations (independent of TIFF loading)');
        
        // Track scroll direction (only animate when scrolling down)
        let lastScrollY = window.scrollY || window.pageYOffset;
        let scrollDirection = true; // true = down, false = up
        let hasScrolled = false; // Track if user has scrolled at all
        
        // Update scroll direction on scroll events
        window.addEventListener('scroll', function() {
            hasScrolled = true;
            const currentScrollY = window.scrollY || window.pageYOffset;
            scrollDirection = currentScrollY > lastScrollY;
            lastScrollY = currentScrollY;
        }, { passive: true });
        
        // Function to check if we should animate (scrolling down OR initial load)
        function shouldAnimate(entry) {
            // If user hasn't scrolled yet, allow animation (initial page load)
            if (!hasScrolled) {
                return true;
            }
            // Otherwise, only animate when scrolling down
            return scrollDirection;
        }
        
        // Configuration
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -100px 0px', // Trigger when element is 100px into viewport
            threshold: 0.1 // Trigger when 10% of element is visible
        };
        
        // Create observer for text animations
        const textObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const shouldAnimateNow = shouldAnimate(entry);
                if (entry.isIntersecting && shouldAnimateNow) {
                    // Add visible class to trigger animation (only when scrolling down or initial load)
                    entry.target.classList.add('visible');
                    // Mark as animated to prevent re-animation but keep observing
                    if (!entry.target.dataset.animated) {
                        entry.target.dataset.animated = 'true';
                    }
                    // Don't unobserve - keep the element visible when scrolling back
                } else if (entry.isIntersecting && !shouldAnimateNow) {
                    // If scrolling up and element is already animated, keep it visible
                    if (entry.target.dataset.animated) {
                        entry.target.classList.add('visible');
                    }
                }
            });
        }, observerOptions);
        
        // Observe all elements with fade-in animations
        const fadeElements = document.querySelectorAll('.story-fade-in');
        fadeElements.forEach(el => textObserver.observe(el));
        
        // Observe highlight text elements
        const highlightElements = document.querySelectorAll('.highlight-text');
        highlightElements.forEach(el => textObserver.observe(el));
        
        // Observe narrative elements with dedicated observer
        const narrativeElements = document.querySelectorAll(
            '.narrative-bridge, .human-scale-callout, .pull-quote, .story-transition, .story-pause'
        );
        
        // Create dedicated observer for narrative elements
        const narrativeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const shouldAnimateNow = shouldAnimate(entry);
                if (entry.isIntersecting && shouldAnimateNow && !entry.target.dataset.narrativeAnimated) {
                    // Only animate when scrolling down or initial load
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    entry.target.dataset.narrativeAnimated = 'true';
                    // Don't unobserve - keep elements visible when scrolling back
                } else if (entry.isIntersecting && !shouldAnimateNow && entry.target.dataset.narrativeAnimated) {
                    // If scrolling up and already animated, keep visible
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Set initial state and observe narrative elements
        narrativeElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            narrativeObserver.observe(el);
        });
        
        // Observe visualization containers - CONSOLIDATED to prevent conflicts
        const vizContainers = document.querySelectorAll('.story-viz, .story-viz-container');
        
        // Single unified observer for all viz containers
        const unifiedVizObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const shouldAnimateNow = shouldAnimate(entry);
                if (entry.isIntersecting && shouldAnimateNow && !entry.target.dataset.vizAnimated) {
                    // Only animate when scrolling down or initial load
                    // Mark as animated to prevent re-triggering
                    entry.target.dataset.vizAnimated = 'true';
                    
                    // Set visible state (these styles persist even after leaving viewport)
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    
                    // Trigger visualization-specific animations
                    triggerVizAnimation(entry.target);
                    
                    // Unobserve to prevent re-triggering when scrolling back
                    unifiedVizObserver.unobserve(entry.target);
                } else if (entry.isIntersecting && !shouldAnimateNow && entry.target.dataset.vizAnimated) {
                    // If scrolling up and already animated, keep visible
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        });
        
        // Set initial state and observe all viz containers
        vizContainers.forEach(el => {
            // Set initial hidden state
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
            
            // Observe with unified observer
            unifiedVizObserver.observe(el);
            
            // Check if element is already in viewport at page load
            // This handles the case where user refreshes with viz already visible
            const rect = el.getBoundingClientRect();
            const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (isInViewport && !el.dataset.vizAnimated) {
                // Use a longer delay and check for SVG existence before animating
                const attemptAnimation = (retries = 0) => {
                    if (el.dataset.vizAnimated) return;
                    
                    // Check if viz has been created (has SVG element)
                    const hasSVG = el.querySelector('svg') !== null;
                    
                    if (hasSVG || retries > 10) {
                        el.dataset.vizAnimated = 'true';
                        el.style.opacity = '1';
                        el.style.transform = 'translateY(0)';
                        triggerVizAnimation(el);
                        unifiedVizObserver.unobserve(el);
                    } else {
                        // Retry after a short delay
                        setTimeout(() => attemptAnimation(retries + 1), 200);
                    }
                };
                
                setTimeout(() => attemptAnimation(), 500);
            }
        });
        
        /**
         * Trigger visualization-specific animations
         * This can be expanded to trigger D3 animations when viz enters viewport
         */
        function triggerVizAnimation(container) {
            // Check if this is the Italy electricity viz (which has animated lines)
            let italyVizContainer = container.querySelector('#viz-italy-electricity');
            if (!italyVizContainer) {
                italyVizContainer = container.id === 'viz-italy-electricity' ? container : null;
            }
            
            // If container is a parent, search deeper
            if (!italyVizContainer && container.classList.contains('story-viz-container')) {
                italyVizContainer = container.querySelector('#viz-italy-electricity');
            }
            
            if (italyVizContainer && !italyVizContainer.dataset.vizAnimationTriggered) {
                // Mark as triggered to prevent duplicate animations
                italyVizContainer.dataset.vizAnimationTriggered = 'true';
                
                // Trigger line animations if functions are available
                setTimeout(() => {
                    if (italyVizContainer._animateElecLine) {
                        italyVizContainer._animateElecLine();
                    }
                    if (italyVizContainer._animateTempLine) {
                        italyVizContainer._animateTempLine();
                    }
                    
                    // Trigger circle animations
                    if (italyVizContainer._animateElecCircles) {
                        italyVizContainer._animateElecCircles();
                    }
                    if (italyVizContainer._animateTempCircles) {
                        italyVizContainer._animateTempCircles();
                    }
                    
                    // Trigger annotation animations
                    const svgElement = italyVizContainer.querySelector('svg');
                    if (svgElement) {
                        const annotations = svgElement.querySelectorAll('.annotation');
                        annotations.forEach((ann, idx) => {
                            setTimeout(() => {
                                ann.style.transition = 'opacity 0.6s ease-out';
                                ann.style.opacity = '1';
                            }, 2000 + (idx * 200));
                        });
                    }
                }, 100);
                
                console.log('[ScrollAnim] Italy electricity viz animation triggered');
            }
            
            // Add more viz-specific triggers here as needed
        }
        
        console.log('[ScrollAnim] Scroll-based animations initialized');
        console.log(`[ScrollAnim] Observing ${fadeElements.length} fade elements`);
        console.log(`[ScrollAnim] Observing ${narrativeElements.length} narrative elements`);
        console.log(`[ScrollAnim] Observing ${vizContainers.length} visualization containers`);
    }
})();
