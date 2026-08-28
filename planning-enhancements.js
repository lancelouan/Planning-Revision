// ============================================================
// Planning Révisions — Améliorations
// Version 1
// ============================================================

(function () {
  'use strict';

  console.log('[Enhancements] Module chargé.');

  // ------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------

  const MIN_DURATION = 20;

  // ------------------------------------------------------------
  // Utilitaires
  // ------------------------------------------------------------

  function getPlacements() {
    return Array.isArray(window.placements) ? window.placements : null;
  }

  function savePlacementsSafe() {
    try {
      if (typeof window.savePlacements === 'function') {
        window.savePlacements();
        return;
      }

      if (Array.isArray(window.placements)) {
        localStorage.setItem(
          'pr_placements',
          JSON.stringify(window.placements)
        );
      }
    } catch (error) {
      console.warn(
        '[Enhancements] Impossible de sauvegarder les placements.',
        error
      );
    }
  }

  function getCurrentWeekKey() {
    try {
      if (typeof window.currentWeekKey === 'function') {
        return window.currentWeekKey();
      }
    } catch (_) {}

    return null;
  }

  // ------------------------------------------------------------
  // 1. Durée minimale de 20 minutes
  // ------------------------------------------------------------

  function enforceMinimumDuration() {
    const placements = getPlacements();

    if (!placements) return;

    let changed = false;

    placements.forEach((placement) => {
      if (
        typeof placement.durMin === 'number' &&
        placement.durMin > 0 &&
        placement.durMin < MIN_DURATION
      ) {
        placement.durMin = MIN_DURATION;
        changed = true;
      }
    });

    if (changed) {
      savePlacementsSafe();

      if (typeof window.renderCalendar === 'function') {
        window.renderCalendar();
      }

      console.log(
        '[Enhancements] Durées inférieures à 20 min corrigées.'
      );
    }
  }

  // ------------------------------------------------------------
  // 2. Correction du dimanche
  //
  // Le dimanche est le dernier jour de la grille.
  // Sur les écrans étroits, on évite que les popovers sortent
  // de l'écran.
  // ------------------------------------------------------------

  function fixSundayPopoverPosition() {
    document.addEventListener(
      'click',
      function () {
        setTimeout(() => {
          const popovers = document.querySelectorAll(
            '.popover, .block-popover, .cal-popover'
          );

          popovers.forEach((popover) => {
            const rect = popover.getBoundingClientRect();

            if (rect.right > window.innerWidth - 8) {
              const overflow =
                rect.right - (window.innerWidth - 8);

              const currentLeft =
                parseFloat(popover.style.left || '0');

              if (!Number.isNaN(currentLeft)) {
                popover.style.left =
                  Math.max(8, currentLeft - overflow) + 'px';
              }
            }
          });
        }, 0);
      },
      true
    );
  }

  // ------------------------------------------------------------
  // 3. Prévisualisation lors du déplacement
  //
  // On conserve le système actuel comme sécurité.
  // La prévisualisation apparaît au survol du calendrier.
  // ------------------------------------------------------------

  let previewElement = null;

  function removeMovePreview() {
    if (previewElement) {
      previewElement.remove();
      previewElement = null;
    }
  }

  function createMovePreview(dayBody, minutes, duration) {
    removeMovePreview();

    if (!dayBody) return;

    const rect = dayBody.getBoundingClientRect();

    const pxPerMinute =
      parseFloat(
        getComputedStyle(dayBody)
          .getPropertyValue('--px-per-min')
      ) || 1.6;

    const top =
      (minutes - 480) * pxPerMinute;

    previewElement = document.createElement('div');

    previewElement.className =
      'planning-move-preview';

    previewElement.style.position = 'absolute';
    previewElement.style.left = '4px';
    previewElement.style.right = '4px';
    previewElement.style.top = Math.max(0, top) + 'px';
    previewElement.style.height =
      Math.max(20, duration * pxPerMinute) + 'px';

    previewElement.style.pointerEvents = 'none';
    previewElement.style.border = '2px dashed currentColor';
    previewElement.style.borderRadius = '7px';
    previewElement.style.opacity = '0.55';
    previewElement.style.zIndex = '100';

    dayBody.style.position = 'relative';
    dayBody.appendChild(previewElement);
  }

  function setupMovePreview() {
    document.addEventListener(
      'mousemove',
      function (event) {
        const banner =
          document.getElementById('moveBanner');

        if (
          !banner ||
          banner.style.display === 'none'
        ) {
          removeMovePreview();
          return;
        }

        const placements = getPlacements();

        if (!placements) return;

        // On récupère l'identifiant actuellement déplacé
        const moveId =
          typeof window.movePendingId !== 'undefined'
            ? window.movePendingId
            : null;

        if (!moveId) {
          removeMovePreview();
          return;
        }

        const placement =
          placements.find(
            (item) => item.id === moveId
          );

        if (!placement) {
          removeMovePreview();
          return;
        }

        const dayBody =
          event.target.closest('.day-body');

        if (!dayBody) {
          removeMovePreview();
          return;
        }

        const rect =
          dayBody.getBoundingClientRect();

        const y =
          event.clientY - rect.top;

        let minutes =
          Math.round((y / 1.6) / 30) * 30 + 480;

        minutes =
          Math.max(480, Math.min(1410, minutes));

        createMovePreview(
          dayBody,
          minutes,
          Math.max(
            MIN_DURATION,
            placement.durMin || MIN_DURATION
          )
        );
      },
      true
    );

    document.addEventListener(
      'mouseleave',
      removeMovePreview,
      true
    );
  }

  // ------------------------------------------------------------
  // 4. Nettoyage de la prévisualisation
  // ------------------------------------------------------------

  function observeMoveBanner() {
    const banner =
      document.getElementById('moveBanner');

    if (!banner) return;

    const observer =
      new MutationObserver(() => {
        if (banner.style.display === 'none') {
          removeMovePreview();
        }
      });

    observer.observe(banner, {
      attributes: true,
      attributeFilter: ['style']
    });
  }

  // ------------------------------------------------------------
  // 5. Affichage QCM / Annales
  //
  // Cette partie prépare les classes visuelles sans modifier
  // les données existantes.
  // ------------------------------------------------------------

  function addTrainingTypeClasses() {
    document
      .querySelectorAll('[data-training-type]')
      .forEach((element) => {
        const type =
          element.dataset.trainingType;

        element.classList.remove(
          'training-qcm',
          'training-annales'
        );

        if (type === 'qcm') {
          element.classList.add('training-qcm');
        }

        if (type === 'annales') {
          element.classList.add('training-annales');
        }
      });
  }

  // ------------------------------------------------------------
  // 6. Style des blocs terminés
  // ------------------------------------------------------------

  function addCompletedBlockStyle() {
    if (document.getElementById(
      'planning-enhancements-style'
    )) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'planning-enhancements-style';

    style.textContent = `
      .planning-move-preview {
        box-sizing: border-box;
        background: rgba(100, 100, 100, 0.08);
      }

      .training-qcm {
        filter: saturate(0.9);
      }

      .training-annales {
        filter: saturate(1.05);
      }

      .cal-block.is-completed {
        text-decoration: line-through;
        opacity: 0.65;
      }

      .cal-block.is-completed * {
        text-decoration: line-through;
      }
    `;

    document.head.appendChild(style);
  }

  // ------------------------------------------------------------
  // 7. Initialisation
  // ------------------------------------------------------------

  function init() {
    enforceMinimumDuration();
    fixSundayPopoverPosition();
    setupMovePreview();
    observeMoveBanner();
    addTrainingTypeClasses();
    addCompletedBlockStyle();

    console.log(
      '[Enhancements] Initialisation terminée.'
    );
  }

  // ------------------------------------------------------------
  // Attente du chargement de l'application
  // ------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
