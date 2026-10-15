/**
 * SafeCrossing AI - App Shell Controller
 * Handles sidebar navigation, mobile drawer, scroll-spy, "Volver" button, and live UI widgets.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initScrollSpy();
    initBackToTop();
    initClock();
    initQuickActions();
  });

  // --- 1. Sidebar & Mobile Drawer Controller ---
  function initSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const toggleBtn = document.getElementById('btnSidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!sidebar) return;

    const openSidebar = () => {
      sidebar.classList.add('open');
      backdrop?.classList.add('active');
      document.body.style.overflow = window.innerWidth < 960 ? 'hidden' : '';
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      backdrop?.classList.remove('active');
      document.body.style.overflow = '';
      // Trigger map resize if Leaflet is initialized
      if (window.map && typeof window.map.invalidateSize === 'function') {
        setTimeout(() => window.map.invalidateSize(), 300);
      }
    };

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    backdrop?.addEventListener('click', closeSidebar);

    // Close mobile sidebar when clicking a nav link
    const navLinks = sidebar.querySelectorAll('.sidebar-nav-item a');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 960) {
          closeSidebar();
        }
      });
    });

    // Resize listener for map reflow
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 960) {
        sidebar.classList.remove('open');
        backdrop?.classList.remove('active');
        document.body.style.overflow = '';
      }
      if (window.map && typeof window.map.invalidateSize === 'function') {
        window.map.invalidateSize();
      }
    });
  }

  // --- 2. Scroll Spy: Highlight active section in sidebar ---
  function initScrollSpy() {
    const sections = document.querySelectorAll('section[id], div[id^="sec-"]');
    const navItems = document.querySelectorAll('.sidebar-nav-item');

    if (!sections.length || !navItems.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navItems.forEach((item) => {
              const link = item.querySelector('a');
              if (link && link.getAttribute('href') === `#${id}`) {
                item.classList.add('active');
              } else {
                item.classList.remove('active');
              }
            });
          }
        });
      },
      {
        rootMargin: '-20% 0px -65% 0px',
        threshold: 0
      }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  // --- 3. Back to Top / "Volver Arriba" Controller ---
  function initBackToTop() {
    const floatingBtn = document.getElementById('btnBackToTop');
    const sidebarBackTop = document.getElementById('btnSidebarBackTop');

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    floatingBtn?.addEventListener('click', scrollToTop);
    sidebarBackTop?.addEventListener('click', scrollToTop);

    // Section inline back buttons
    const sectionBackBtns = document.querySelectorAll('.btn-section-back');
    sectionBackBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToTop();
      });
    });

    // Show/hide floating button on scroll
    window.addEventListener('scroll', () => {
      if (!floatingBtn) return;
      if (window.scrollY > 300) {
        floatingBtn.classList.add('visible');
      } else {
        floatingBtn.classList.remove('visible');
      }
    }, { passive: true });
  }

  // --- 4. Live Clock in Sidebar ---
  function initClock() {
    const clockEl = document.getElementById('sidebarClockTime');
    if (!clockEl) return;

    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-CO', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      clockEl.textContent = timeStr;
    };

    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- 5. Sidebar Quick Actions Bridge ---
  function initQuickActions() {
    // Demo Offline shortcut
    document.getElementById('btnSidebarDemo')?.addEventListener('click', () => {
      document.getElementById('btnOfflineMode')?.click();
    });

    // PDF Report shortcut
    document.getElementById('btnSidebarPdf')?.addEventListener('click', () => {
      document.getElementById('btnPdf')?.click();
    });

    // Mobile QR shortcut
    document.getElementById('btnSidebarQr')?.addEventListener('click', () => {
      const qrBtn = document.getElementById('btnShowQrLink');
      if (qrBtn) {
        qrBtn.click();
        const qrBox = document.getElementById('qrLinkBox');
        if (qrBox) {
          qrBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }
})();
