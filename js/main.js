/**
 * main.js
 * Main JavaScript file for Urban Heat Islands visualization website
 * Handles navigation, initialization, and general interactivity
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    initializeNavigation();
    initializeSmoothScrolling();
    initializeAccessibility();
    initializeSpaceAnimations();
    createSatelliteOrbits();
    initializeScrollAnimations();
    initializeMobileMenu();
});

/**
 * Initialize navigation functionality
 */
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    const currentPath = window.location.pathname;
    
    // Add active state to current page link
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '#overview')) {
            link.classList.add('active');
        }
        
        // Update active state on click
        link.addEventListener('click', function(e) {
            if (href.startsWith('#')) {
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Initialize accessibility features
 */
function initializeAccessibility() {
    // Add ARIA labels to interactive elements
    const selects = document.querySelectorAll('.control-select');
    selects.forEach(select => {
        const label = select.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            const labelId = label.getAttribute('for') || `label-${Math.random().toString(36).substr(2, 9)}`;
            select.setAttribute('id', labelId);
            label.setAttribute('for', labelId);
        }
    });
    
    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        // Escape key to close any open modals/dropdowns
        if (e.key === 'Escape') {
            document.querySelectorAll('.control-select').forEach(select => {
                select.blur();
            });
        }
    });
}

/**
 * Utility function to format numbers
 */
function formatNumber(num, decimals = 1) {
    return num.toFixed(decimals);
}

/**
 * Utility function to format temperature
 */
function formatTemperature(temp, unit = '°C') {
    return `${formatNumber(temp)} ${unit}`;
}

/**
 * Utility function to handle errors gracefully
 */
function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);
    // You can add user-facing error messages here
}


/**
 * Initialize scroll-triggered animations (optimized for mobile)
 */
function initializeScrollAnimations() {
    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
        // Fallback: show all elements immediately
        const sections = document.querySelectorAll('.viz-container, .methodology-subsection, .team-member');
        sections.forEach(section => {
            section.style.opacity = '1';
            section.style.transform = 'none';
        });
        return;
    }

    const observerOptions = {
        threshold: 0.1,
        rootMargin: window.innerWidth <= 768 ? '0px 0px -30px 0px' : '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                // Unobserve after animation to improve performance
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe sections for scroll animations
    const sections = document.querySelectorAll('.viz-container, .methodology-subsection, .team-member');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        observer.observe(section);
    });
}

/**
 * Add CSS animations dynamically
 */
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes orbit {
            0% { transform: translateX(-50%) rotate(0deg) translateX(75px) rotate(0deg); }
            100% { transform: translateX(-50%) rotate(360deg) translateX(75px) rotate(-360deg); }
        }
        
        .space-particle {
            will-change: transform;
        }
    `;
    document.head.appendChild(style);
}

// Add dynamic styles on load
addDynamicStyles();

/**
 * Initialize theme toggle functionality
 */
function initializeTheme() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Determine initial theme: saved preference takes priority, otherwise use system preference, default to light
    let initialTheme = 'light';
    if (savedTheme === 'dark') {
        initialTheme = 'dark';
    } else if (savedTheme === 'light') {
        initialTheme = 'light';
    } else if (prefersDark) {
        // If no saved preference and system prefers dark, use dark
        initialTheme = 'dark';
    }
    
    applyTheme(initialTheme);
    
    // Set up theme toggle button
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
}

/**
 * Apply theme to the document
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Update theme color meta tag for mobile browsers
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta');
        themeColorMeta.setAttribute('name', 'theme-color');
        document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#0f1419' : '#ffffff');
}

/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    if (!menuToggle || !navMenu) return;
    
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);
    
    // Toggle menu function
    function toggleMenu() {
        const isActive = navMenu.classList.contains('active');
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        overlay.classList.toggle('active');
        
        if (!isActive) {
            document.body.classList.add('menu-open');
        } else {
            document.body.classList.remove('menu-open');
        }
    }
    
    // Toggle menu on button click
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMenu();
    });
    
    // Close menu when clicking overlay
    overlay.addEventListener('click', function() {
        toggleMenu();
    });
    
    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Small delay to allow smooth scroll
            setTimeout(() => {
                toggleMenu();
            }, 300);
        });
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
    
    // Close menu when window is resized to desktop size
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
}

/**
 * Export functions for use in other modules
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatNumber,
        formatTemperature,
        handleError
    };
}

