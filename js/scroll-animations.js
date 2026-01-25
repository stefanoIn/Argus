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
        
        // Configuration
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -100px 0px', // Trigger when element is 100px into viewport
            threshold: 0.1 // Trigger when 10% of element is visible
        };
        
        // Create observer for text animations
        const textObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add visible class to trigger animation
                    entry.target.classList.add('visible');
                    // Optionally unobserve after animating (remove if you want to re-animate on scroll back)
                    textObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        // Create observer for visualization containers
        const vizObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // For visualizations, we might want to trigger their internal animations
                    triggerVizAnimation(entry.target);
                    vizObserver.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.15
        });
        
        // Observe all elements with fade-in animations
        const fadeElements = document.querySelectorAll('.story-fade-in');
        fadeElements.forEach(el => textObserver.observe(el));
        
        // Observe highlight text elements
        const highlightElements = document.querySelectorAll('.highlight-text');
        highlightElements.forEach(el => textObserver.observe(el));
        
        // Observe narrative elements
        const narrativeElements = document.querySelectorAll(
            '.narrative-bridge, .human-scale-callout, .pull-quote, .story-transition, .story-pause'
        );
        narrativeElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            textObserver.observe(el);
        });
        
        // Add visible class handler for narrative elements
        const narrativeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    narrativeObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        narrativeElements.forEach(el => narrativeObserver.observe(el));
        
        // Observe visualization containers
        const vizContainers = document.querySelectorAll('.story-viz, .story-viz-container');
        vizContainers.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
            vizObserver.observe(el);
        });
        
        // Specifically observe the Italy electricity visualization container
        const italyElecContainer = document.querySelector('#viz-italy-electricity');
        if (italyElecContainer) {
            const italyVizObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !entry.target.dataset.animated) {
                        entry.target.dataset.animated = 'true';
                        // Trigger the animation after a short delay
                        setTimeout(() => {
                            const parentContainer = entry.target.closest('.story-viz-container');
                            if (parentContainer) {
                                triggerVizAnimation(parentContainer);
                            }
                        }, 300);
                        italyVizObserver.unobserve(entry.target);
                    }
                });
            }, {
                root: null,
                rootMargin: '0px',
                threshold: 0.2
            });
            
            italyVizObserver.observe(italyElecContainer);
        }
        
        // Add visible class handler for viz containers
        const vizVisibilityObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    // Unobserve after first animation to prevent re-triggering
                    vizVisibilityObserver.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        });
        
        vizContainers.forEach(el => vizVisibilityObserver.observe(el));
        
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
            
            if (italyVizContainer) {
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
