/* ============================================================
   Planning Révision — améliorations complémentaires
   Version 2
   ============================================================ */

(function () {
  'use strict';

  const MIN_DURATION = 20;

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[Planning] Sauvegarde impossible', error);
    }
  }

  function getPlacements() {
    return Array.isArray(window.placements)
      ? window.placements
      : null;
  }

  /*
   * Protection générale :
   * aucune durée inférieure à 20 minutes.
   */
  function enforceMinimumDuration() {
    const placements = getPlacements();

    if (!placements) return;

    let changed = false;

    placements.forEach(placement => {
      const duration = Number(placement.durMin);

      if (
        Number.isFinite(duration) &&
        duration > 0 &&
        duration < MIN_DURATION
      ) {
        placement.durMin = MIN_DURATION;
        changed = true;
      }
    });

    if (changed) {
      save('pr_placements', placements);

      if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
      }
    }
  }

  /*
   * Sécurité supplémentaire pour les popovers :
   * ils ne doivent jamais sortir du viewport.
   */
  function fixPopoverOverflow() {
    const popovers = document.querySelectorAll(
      '.popover,.pop,.block-popover,.cal-popover'
    );

    popovers.forEach(pop => {
      if (
        getComputedStyle(pop).display === 'none' &&
        !pop.classList.contains('show')
      ) {
        return;
      }

      const rect = pop.getBoundingClientRect();
      const margin = 8;

      let left = rect.left;
      let top = rect.top;

      if (rect.right > window.innerWidth - margin) {
        left -= rect.right - (window.innerWidth - margin);
      }

      if (rect.bottom > window.innerHeight - margin) {
        top -= rect.bottom - (window.innerHeight - margin);
      }

      left = Math.max(margin, left);
      top = Math.max(margin, top);

      if (Number.isFinite(left)) {
        pop.style.left = left + 'px';
      }

      if (Number.isFinite(top)) {
        pop.style.top = top + 'px';
      }
    });
  }

  /*
   * Ferme proprement les popovers quand la fenêtre change de taille.
   */
  function handleResize() {
    fixPopoverOverflow();
  }

  /*
   * Empêche certaines interactions de formulaire de provoquer
   * des comportements indésirables avec les détails/accordéons.
   */
  function protectFormInputs() {
    document.addEventListener(
      'click',
      event => {
        const input = event.target.closest(
          'input,textarea,select,button'
        );

        if (!input) return;

        if (
          input.closest('.tracking') ||
          input.closest('.subject') ||
          input.closest('.todo-item')
        ) {
          event.stopPropagation();
        }
      },
      true
    );
  }

  /*
   * Le vrai drag & drop principal est géré par index.html.
   * Cette partie ajoute seulement une compatibilité avec les
   * navigateurs qui fournissent un dataTransfer incomplet.
   */
  function improveDragDrop() {
    document.addEventListener(
      'dragover',
      event => {
        const body = event.target.closest('.day-body');

        if (!body) return;

        event.preventDefault();

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
      },
      true
    );
  }

  /*
   * Ajoute une classe aux blocs terminés.
   */
  function refreshCompletedClasses() {
    document.querySelectorAll('.cal-block').forEach(block => {
      const placementId = block.dataset.id;

      if (!placementId) return;

      const placements = getPlacements();
      if (!placements) return;

      const placement =
        placements.find(item => item.id === placementId);

      if (!placement) return;

      block.classList.toggle(
        'completed',
        Boolean(placement.completed)
      );
    });
  }

  /*
   * Observation légère :
   * quand le calendrier est reconstruit, on remet les classes.
   */
  function observeCalendar() {
    const calendar = document.getElementById('calendarDays');

    if (!calendar) return;

    const observer = new MutationObserver(() => {
      refreshCompletedClasses();
      fixPopoverOverflow();
    });

    observer.observe(calendar, {
      childList: true,
      subtree: true
    });
  }

  /*
   * Vérification périodique volontairement légère.
   * Elle ne modifie jamais les données de révision.
   */
  function maintenance() {
    enforceMinimumDuration();
    refreshCompletedClasses();
    fixPopoverOverflow();
  }

  function init() {
    protectFormInputs();
    improveDragDrop();
    observeCalendar();

    window.addEventListener('resize', handleResize);

    document.addEventListener(
      'click',
      () => {
        setTimeout(fixPopoverOverflow, 0);
      },
      true
    );

    setTimeout(maintenance, 200);
    setTimeout(maintenance, 800);

    console.log(
      '[Planning Révision] Améliorations V2 chargées.'
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once:true }
    );
  } else {
    init();
  }

})();
