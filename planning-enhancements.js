/* ============================================================
   Planning Révision — V2
   ------------------------------------------------------------
   Fonctionnalités :
   - Matière → Cours → Chapitres
   - Révisions J-0 / J-1 / J-3 / J-5 / J-7
   - 4 révisions libres
   - Notes par révision
   - Maîtrise 0 à 5
   - Suggestions de révisions
   - Possibilité de ne plus suggérer une révision
   - Replanification
   - Statistiques de travail
   - Tableau de suivi
   - Pomodoro indépendant du planning
   - Intégration des cours au calendrier
   - Fonctionnement LocalStorage / hors-ligne
   - Aucun Supabase
   - Aucun compte
   - Aucun module Annales / QCM
============================================================ */

(() => {
  'use strict';

  /* ==========================================================
     CONFIGURATION
  ========================================================== */

  const COURSE_KEY = 'pr_courses';
  const REVISION_KEY = 'pr_course_revisions';
  const POMODORO_KEY = 'pr_pomodoro';

  const REVISION_TYPES = [
    {
      id: 'j0',
      label: 'J-0',
      offset: 0,
      automatic: true
    },
    {
      id: 'j1',
      label: 'J-1',
      offset: 1,
      automatic: true
    },
    {
      id: 'j3',
      label: 'J-3',
      offset: 3,
      automatic: true
    },
    {
      id: 'j5',
      label: 'J-5',
      offset: 5,
      automatic: true,
      optional: true
    },
    {
      id: 'j7',
      label: 'J-7',
      offset: 7,
      automatic: true
    },
    {
      id: 'free1',
      label: 'Libre 1',
      offset: null,
      automatic: false
    },
    {
      id: 'free2',
      label: 'Libre 2',
      offset: null,
      automatic: false
    },
    {
      id: 'free3',
      label: 'Libre 3',
      offset: null,
      automatic: false
    },
    {
      id: 'free4',
      label: 'Libre 4',
      offset: null,
      automatic: false
    }
  ];

  let courses = [];
  let courseRevisions = [];

  let pomodoro = {
    duration: 25,
    remaining: 25 * 60,
    running: false,
    mode: 'travail'
  };

  let pomodoroInterval = null;

  /* ==========================================================
     OUTILS GÉNÉRAUX
  ========================================================== */

  function courseUid() {
    return (
      'crs_' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function revisionUid() {
    return (
      'rev_' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function saveCourses() {
    try {
      localStorage.setItem(
        COURSE_KEY,
        JSON.stringify(courses)
      );
    } catch (error) {
      console.error(
        'Impossible de sauvegarder les cours :',
        error
      );
    }
  }

  function saveCourseRevisions() {
    try {
      localStorage.setItem(
        REVISION_KEY,
        JSON.stringify(courseRevisions)
      );
    } catch (error) {
      console.error(
        'Impossible de sauvegarder les révisions :',
        error
      );
    }
  }

  function savePomodoro() {
    try {
      localStorage.setItem(
        POMODORO_KEY,
        JSON.stringify({
          duration: pomodoro.duration,
          remaining: pomodoro.remaining,
          mode: pomodoro.mode
        })
      );
    } catch (error) {
      console.error(
        'Impossible de sauvegarder le Pomodoro :',
        error
      );
    }
  }

  function loadV2Data() {
    try {
      const savedCourses =
        localStorage.getItem(COURSE_KEY);

      courses =
        savedCourses
          ? JSON.parse(savedCourses)
          : [];

      if (!Array.isArray(courses)) {
        courses = [];
      }
    } catch (error) {
      console.error(
        'Erreur chargement cours :',
        error
      );

      courses = [];
    }

    try {
      const savedRevisions =
        localStorage.getItem(REVISION_KEY);

      courseRevisions =
        savedRevisions
          ? JSON.parse(savedRevisions)
          : [];

      if (!Array.isArray(courseRevisions)) {
        courseRevisions = [];
      }
    } catch (error) {
      console.error(
        'Erreur chargement révisions :',
        error
      );

      courseRevisions = [];
    }

    try {
      const savedPomodoro =
        localStorage.getItem(POMODORO_KEY);

      if (savedPomodoro) {
        const parsed =
          JSON.parse(savedPomodoro);

        if (parsed && typeof parsed === 'object') {
          pomodoro = {
            ...pomodoro,
            ...parsed,
            running: false
          };
        }
      }
    } catch (error) {
      console.error(
        'Erreur chargement Pomodoro :',
        error
      );
    }

    normalizeData();
  }

  /*
    Sécurise les anciennes données si une propriété manque.
  */
  function normalizeData() {
    courses = courses.map(course => ({
      ...course,

      id:
        course.id ||
        courseUid(),

      matiereId:
        course.matiereId ||
        '',

      name:
        course.name ||
        'Cours sans nom',

      date:
        course.date ||
        todayKey(),

      chapters:
        Array.isArray(course.chapters)
          ? course.chapters
          : [],

      mastery:
        Number.isFinite(Number(course.mastery))
          ? Math.min(
              5,
              Math.max(
                0,
                Number(course.mastery)
              )
            )
          : 0,

      createdAt:
        course.createdAt ||
        new Date().toISOString()
    }));

    courseRevisions =
      courseRevisions.map(revision => ({
        ...revision,

        id:
          revision.id ||
          revisionUid(),

        courseId:
          revision.courseId ||
          '',

        type:
          revision.type ||
          'free1',

        label:
          revision.label ||
          'Libre',

        date:
          revision.date ||
          '',

        planned:
          !!revision.planned,

        done:
          !!revision.done,

        note:
          revision.note ||
          '',

        dismissed:
          !!revision.dismissed,

        completedAt:
          revision.completedAt ||
          ''
      }));

    /*
      Nettoyage des révisions qui ne correspondent plus
      à aucun cours.
    */
    const validCourseIds =
      new Set(
        courses.map(course => course.id)
      );

    courseRevisions =
      courseRevisions.filter(
        revision =>
          validCourseIds.has(
            revision.courseId
          )
      );

    saveCourses();
    saveCourseRevisions();
  }

  function todayKey() {
    const now = new Date();

    return (
      now.getFullYear() +
      '-' +
      String(
        now.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        now.getDate()
      ).padStart(2, '0')
    );
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }

    const date =
      new Date(
        String(value) +
        'T12:00:00'
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date;
  }

  function dateToKey(date) {
    if (!date) {
      return '';
    }

    return (
      date.getFullYear() +
      '-' +
      String(
        date.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        date.getDate()
      ).padStart(2, '0')
    );
  }

  function addDaysToKey(
    dateKeyValue,
    amount
  ) {
    const date =
      parseDate(dateKeyValue);

    if (!date) {
      return '';
    }

    date.setDate(
      date.getDate() + amount
    );

    return dateToKey(date);
  }

  function formatDateFR(value) {
    const date =
      parseDate(value);

    if (!date) {
      return '—';
    }

    return date.toLocaleDateString(
      'fr-FR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );
  }

  function escape(value) {
    const string =
      String(
        value == null
          ? ''
          : value
      );

    return string
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCourse(id) {
    return courses.find(
      course =>
        course.id === id
    );
  }

  function getCourseRevision(
    courseId,
    type
  ) {
    return courseRevisions.find(
      revision =>
        revision.courseId === courseId &&
        revision.type === type
    );
  }

  function getCourseRevisions(
    courseId
  ) {
    return courseRevisions.filter(
      revision =>
        revision.courseId === courseId
    );
  }

  function getMatiere(course) {
    if (!course) {
      return null;
    }

    try {
      if (
        typeof window.findMatiere ===
        'function'
      ) {
        return window.findMatiere(
          course.matiereId
        );
      }

      if (
        Array.isArray(window.matieres)
      ) {
        return window.matieres.find(
          matiere =>
            matiere.id ===
            course.matiereId
        );
      }
    } catch (error) {
      console.warn(
        'Impossible de récupérer la matière :',
        error
      );
    }

    return null;
  }

  function getMatieres() {
    if (
      Array.isArray(window.matieres)
    ) {
      return window.matieres;
    }

    return [];
  }

  /* ==========================================================
     COURS
  ========================================================== */

  function createCourse(data) {
    const course = {
      id: courseUid(),

      matiereId:
        data.matiereId ||
        '',

      name:
        data.name ||
        'Nouveau cours',

      date:
        data.date ||
        todayKey(),

      chapters:
        Array.isArray(data.chapters)
          ? data.chapters
              .map(
                chapter =>
                  String(chapter).trim()
              )
              .filter(Boolean)
          : [],

      mastery: 0,

      color:
        data.color ||
        '',

      createdAt:
        new Date().toISOString()
    };

    courses.push(course);

    REVISION_TYPES.forEach(
      type => {
        courseRevisions.push({
          id: revisionUid(),

          courseId:
            course.id,

          type:
            type.id,

          label:
            type.label,

          date:
            type.offset === null
              ? ''
              : addDaysToKey(
                  course.date,
                  type.offset
                ),

          planned:
            type.offset !== null,

          done: false,

          note: '',

          mastery: 0,

          dismissed: false,

          completedAt: ''
        });
      }
    );

    saveCourses();
    saveCourseRevisions();

    return course;
  }

  function deleteCourse(
    courseId
  ) {
    courses =
      courses.filter(
        course =>
          course.id !== courseId
      );

    courseRevisions =
      courseRevisions.filter(
        revision =>
          revision.courseId !==
          courseId
      );

    /*
      Supprime également les blocs calendrier
      liés à ce cours.
    */
    if (
      Array.isArray(window.placements)
    ) {
      window.placements =
        window.placements.filter(
          placement =>
            !(
              placement &&
              placement.type === 'course' &&
              placement.refId === courseId
            )
        );

      if (
        typeof window.savePlacements ===
        'function'
      ) {
        window.savePlacements();
      }
    }

    saveCourses();
    saveCourseRevisions();
  }

  function editCourse(
    courseId
  ) {
    const course =
      getCourse(courseId);

    if (!course) {
      return;
    }

    const newName =
      prompt(
        'Nom du cours :',
        course.name
      );

    if (newName === null) {
      return;
    }

    const trimmedName =
      newName.trim();

    if (!trimmedName) {
      alert(
        'Le nom du cours ne peut pas être vide.'
      );

      return;
    }

    course.name =
      trimmedName;

    const newDate =
      prompt(
        'Date du cours (AAAA-MM-JJ) :',
        course.date
      );

    if (
      newDate !== null &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        newDate.trim()
      )
    ) {
      course.date =
        newDate.trim();
    }

    const newChapters =
      prompt(
        'Chapitres abordés, séparés par des virgules :',
        course.chapters.join(', ')
      );

    if (newChapters !== null) {
      course.chapters =
        newChapters
          .split(',')
          .map(
            chapter =>
              chapter.trim()
          )
          .filter(Boolean);
    }

    saveCourses();

    renderCourses();
    renderSuggestions();
    renderTracking();
    renderStats();

    if (
      typeof window.renderCalendar ===
      'function'
    ) {
      window.renderCalendar();
    }
  }

  /* ==========================================================
     MAÎTRISE
  ========================================================== */

  function setCourseMastery(
    courseId,
    value
  ) {
    const course =
      getCourse(courseId);

    if (!course) {
      return;
    }

    course.mastery =
      Math.min(
        5,
        Math.max(
          0,
          Number(value)
        )
      );

    saveCourses();

    renderCourses();
    renderTracking();
  }

  function masteryDots(course) {
    let html = '';

    for (
      let level = 1;
      level <= 5;
      level++
    ) {
      html += `
        <button
          type="button"
          class="v2-mastery-dot ${
            level <=
            Number(course.mastery || 0)
              ? 'active'
              : ''
          }"
          data-course-mastery="${
            course.id
          }"
          data-level="${level}"
          title="${level}/5"
          aria-label="Maîtrise ${level}/5"
        ></button>
      `;
    }

    return html;
  }

  /* ==========================================================
     RÉVISIONS
  ========================================================== */

  function revisionIsLate(
    revision
  ) {
    if (!revision) {
      return false;
    }

    if (!revision.date) {
      return false;
    }

    if (revision.done) {
      return false;
    }

    if (revision.dismissed) {
      return false;
    }

    return (
      revision.date <
      todayKey()
    );
  }

  function daysLate(
    revision
  ) {
    if (
      !revision ||
      !revision.date
    ) {
      return 0;
    }

    const revisionDate =
      parseDate(
        revision.date
      );

    const today =
      parseDate(
        todayKey()
      );

    if (
      !revisionDate ||
      !today
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.floor(
        (
          today -
          revisionDate
        ) /
          86400000
      )
    );
  }

  function isSuggestionEligible(
    revision
  ) {
    if (!revision) {
      return false;
    }

    if (revision.done) {
      return false;
    }

    if (revision.dismissed) {
      return false;
    }

    if (!revision.date) {
      return false;
    }

    /*
      Une révision future est également affichée
      dans "À revoir prochainement".
    */
    const delay =
      daysLate(revision);

    /*
      Les révisions en retard de plus de 7 jours
      disparaissent automatiquement des suggestions.
      Elles restent cependant dans le suivi.
    */
    if (delay > 7) {
      return false;
    }

    return true;
  }

  function setRevisionDate(
    revisionId,
    date
  ) {
    const revision =
      courseRevisions.find(
        item =>
          item.id === revisionId
      );

    if (!revision) {
      return;
    }

    revision.date =
      date || '';

    revision.planned =
      !!date;

    /*
      Replanifier une révision la rend de nouveau
      éligible aux suggestions.
    */
    if (date) {
      revision.dismissed =
        false;
    }

    saveCourseRevisions();

    renderCourses();
    renderSuggestions();
    renderTracking();
  }

  function setRevisionNote(
    revisionId,
    note
  ) {
    const revision =
      courseRevisions.find(
        item =>
          item.id === revisionId
      );

    if (!revision) {
      return;
    }

    revision.note =
      String(note || '');

    saveCourseRevisions();
  }

  function completeRevision(
    revisionId
  ) {
    const revision =
      courseRevisions.find(
        item =>
          item.id === revisionId
      );

    if (!revision) {
      return;
    }

    revision.done =
      !revision.done;

    revision.completedAt =
      revision.done
        ? todayKey()
        : '';

    /*
      Une révision réalisée ne doit plus apparaître
      dans les suggestions.
    */
    if (revision.done) {
      revision.dismissed =
        false;
    }

    saveCourseRevisions();

    renderCourses();
    renderSuggestions();
    renderTracking();
    renderStats();
  }

  function dismissRevision(
    revisionId
  ) {
    const revision =
      courseRevisions.find(
        item =>
          item.id === revisionId
      );

    if (!revision) {
      return;
    }

    revision.dismissed =
      true;

    saveCourseRevisions();

    renderCourses();
    renderSuggestions();
    renderTracking();
  }

  function restoreRevisionSuggestion(
    revisionId
  ) {
    const revision =
      courseRevisions.find(
        item =>
          item.id === revisionId
      );

    if (!revision) {
      return;
    }

    revision.dismissed =
      false;

    saveCourseRevisions();

    renderCourses();
    renderSuggestions();
    renderTracking();
  }

  /* ==========================================================
     FORMULAIRE AJOUT COURS
  ========================================================== */

  function showCourseForm(
    matiereId
  ) {
    const existing =
      document.getElementById(
        'v2-course-form'
      );

    if (existing) {
      existing.remove();
      return;
    }

    const matiere =
      getMatieres().find(
        item =>
          item.id === matiereId
      );

    if (!matiere) {
      alert(
        'Impossible de trouver cette matière.'
      );

      return;
    }

    const form =
      document.createElement(
        'div'
      );

    form.id =
      'v2-course-form';

    form.className =
      'v2-course-form';

    form.innerHTML = `
      <div class="v2-form-title">
        Ajouter un cours à
        <strong>
          ${escape(matiere.name)}
        </strong>
      </div>

      <label>
        Nom du cours
      </label>

      <input
        id="v2-course-name"
        type="text"
        placeholder="Ex. Ostéologie du membre supérieur"
        autocomplete="off"
      >

      <label>
        Date du cours
      </label>

      <input
        id="v2-course-date"
        type="date"
        value="${todayKey()}"
      >

      <label>
        Chapitres abordés
      </label>

      <input
        id="v2-course-chapters"
        type="text"
        placeholder="Ex. Clavicule, Scapula, Humérus"
      >

      <div class="v2-form-help">
        Tu peux laisser les chapitres vides.
      </div>

      <div class="v2-form-actions">
        <button
          type="button"
          id="v2-course-cancel"
        >
          Annuler
        </button>

        <button
          type="button"
          id="v2-course-save"
          class="primary"
        >
          Ajouter le cours
        </button>
      </div>
    `;

    const possibleDetails =
      document.querySelector(
        `[data-v2-matiere="${CSS.escape(
          String(matiereId)
        )}"]`
      );

    if (possibleDetails) {
      possibleDetails
        .appendChild(form);
    } else {
      document
        .getElementById(
          'v2-courses-list'
        )
        ?.prepend(form);
    }

    const cancel =
      document.getElementById(
        'v2-course-cancel'
      );

    const save =
      document.getElementById(
        'v2-course-save'
      );

    cancel?.addEventListener(
      'click',
      () => {
        form.remove();
      }
    );

    save?.addEventListener(
      'click',
      () => {
        const name =
          document
            .getElementById(
              'v2-course-name'
            )
            ?.value
            .trim();

        const date =
          document
            .getElementById(
              'v2-course-date'
            )
            ?.value ||
          todayKey();

        const chaptersValue =
          document
            .getElementById(
              'v2-course-chapters'
            )
            ?.value ||
          '';

        const chapters =
          chaptersValue
            .split(',')
            .map(
              chapter =>
                chapter.trim()
            )
            .filter(Boolean);

        if (!name) {
          alert(
            'Indique le nom du cours.'
          );

          return;
        }

        createCourse({
          matiereId,
          name,
          date,
          chapters
        });

        form.remove();

        renderCourses();
        renderSuggestions();
        renderTracking();
        renderStats();
      }
    );

    document
      .getElementById(
        'v2-course-name'
      )
      ?.focus();
  }

  /* ==========================================================
     AFFICHAGE DES COURS
  ========================================================== */

  function renderCourseRevisionRows(
    course
  ) {
    const revisions =
      getCourseRevisions(
        course.id
      );

    return revisions
      .map(revision => {
        const late =
          revisionIsLate(
            revision
          );

        const optional =
          revision.type ===
          'j5';

        const noDate =
          !revision.date;

        return `
          <div
            class="
              v2-revision-row
              ${
                revision.done
                  ? 'done'
                  : ''
              }
              ${
                late
                  ? 'late'
                  : ''
              }
            "
          >

            <div
              class="v2-revision-label"
            >
              <strong>
                ${escape(
                  revision.label
                )}
              </strong>

              ${
                optional
                  ? `
                    <span class="v2-optional">
                      optionnel
                    </span>
                  `
                  : ''
              }
            </div>

            <input
              type="date"
              value="${escape(
                revision.date
              )}"
              data-revision-date="${
                revision.id
              }"
              aria-label="Date ${
                revision.label
              }"
            >

            <button
              type="button"
              class="v2-revision-check"
              data-revision-done="${
                revision.id
              }"
              title="${
                revision.done
                  ? 'Marquer comme non faite'
                  : 'Marquer comme faite'
              }"
            >
              ${
                revision.done
                  ? '✓'
                  : '○'
              }
            </button>

            <input
              class="v2-revision-note"
              type="number"
              min="0"
              max="20"
              step="0.5"
              placeholder="Note /20"
              value="${escape(
                revision.note
              )}"
              ${
                noDate &&
                !revision.done
                  ? 'disabled'
                  : ''
              }
              data-revision-note="${
                revision.id
              }"
              title="${
                noDate
                  ? 'Planifie d’abord cette révision'
                  : 'Note obtenue à cette révision'
              }"
            >

            ${
              revision.dismissed
                ? `
                  <button
                    type="button"
                    class="v2-dismiss-revision restored"
                    data-restore-revision="${
                      revision.id
                    }"
                    title="Réactiver la suggestion"
                  >
                    ↺
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="v2-dismiss-revision"
                    data-dismiss-revision="${
                      revision.id
                    }"
                    title="Ne plus suggérer cette révision"
                  >
                    ×
                  </button>
                `
            }

          </div>
        `;
      })
      .join('');
  }

  function renderCourse(
    course
  ) {
    const matiere =
      getMatiere(course);

    const revisions =
      getCourseRevisions(
        course.id
      );

    const done =
      revisions.filter(
        revision =>
          revision.done
      ).length;

    const total =
      revisions.length;

    const chapters =
      course.chapters.length
        ? course.chapters
            .map(
              chapter => `
                <span class="v2-chapter">
                  ${escape(
                    chapter
                  )}
                </span>
              `
            )
            .join('')
        : `
            <span class="v2-no-chapter">
              Aucun chapitre renseigné
            </span>
          `;

    const color =
      matiere?.color ||
      'var(--accent)';

    return `
      <div
        class="v2-course"
        data-course="${course.id}"
      >

        <div
          class="v2-course-header"
        >

          <div
            class="v2-course-title"
          >

            <span
              class="v2-course-color"
              style="background:${escape(
                color
              )}"
            ></span>

            <div>
              <strong>
                ${escape(
                  course.name
                )}
              </strong>

              <div
                class="v2-course-meta"
              >
                ${
                  matiere
                    ? escape(
                        matiere.name
                      )
                    : 'Matière inconnue'
                }

                ·

                ${formatDateFR(
                  course.date
                )}
              </div>
            </div>

          </div>

          <div
            class="v2-course-actions"
          >

            <span
              class="v2-progress"
            >
              ${done}/${total}
            </span>

            <button
              type="button"
              data-edit-course="${
                course.id
              }"
              title="Modifier le cours"
            >
              ✎
            </button>

            <button
              type="button"
              data-delete-course="${
                course.id
              }"
              title="Supprimer le cours"
              class="danger"
            >
              🗑
            </button>

          </div>

        </div>

        <div
          class="v2-chapters"
        >
          ${chapters}
        </div>

        <div
          class="v2-mastery"
        >

          <span>
            Maîtrise
          </span>

          <div
            class="v2-mastery-dots"
          >
            ${masteryDots(
              course
            )}
          </div>

          <span
            class="v2-mastery-value"
          >
            ${course.mastery || 0}/5
          </span>

        </div>

        <div
          class="v2-revisions"
        >

          <div
            class="v2-revisions-title"
          >
            <span>
              Révision
            </span>

            <span>
              Date
            </span>

            <span>
              État
            </span>

            <span>
              Note
            </span>

            <span></span>
          </div>

          ${renderCourseRevisionRows(
            course
          )}

        </div>

      </div>
    `;
  }

  function renderCourses() {
    const container =
      document.getElementById(
        'v2-courses-list'
      );

    if (!container) {
      return;
    }

    const matieres =
      getMatieres();

    if (!courses.length) {
      container.innerHTML = `
        <div class="v2-empty">
          Aucun cours pour l'instant.
          <br>
          Ajoute ton premier cours dans une matière.
        </div>
      `;

      return;
    }

    const grouped = {};

    matieres.forEach(
      matiere => {
        grouped[
          matiere.id
        ] = [];
      }
    );

    courses.forEach(
      course => {
        if (
          !grouped[
            course.matiereId
          ]
        ) {
          grouped[
            course.matiereId
          ] = [];
        }

        grouped[
          course.matiereId
        ].push(course);
      }
    );

    let html = '';

    matieres.forEach(
      matiere => {
        const list =
          grouped[
            matiere.id
          ] || [];

        list.sort(
          (a, b) =>
            String(
              a.date
            ).localeCompare(
              String(
                b.date
              )
            )
        );

        html += `
          <details
            class="v2-matiere"
            data-v2-matiere="${
              escape(
                matiere.id
              )
            }"
            open
          >

            <summary>

              <span
                class="v2-matiere-dot"
                style="background:${escape(
                  matiere.color ||
                  'var(--accent)'
                )}"
              ></span>

              <strong>
                ${escape(
                  matiere.name
                )}
              </strong>

              <span
                class="v2-matiere-count"
              >
                ${list.length}
                cours
              </span>

              <button
                type="button"
                data-add-course="${
                  escape(
                    matiere.id
                  )
                }"
                class="v2-add-course"
              >
                + Ajouter un cours
              </button>

            </summary>

            <div
              class="v2-matiere-courses"
            >

              ${
                list.length
                  ? list
                      .map(
                        renderCourse
                      )
                      .join('')
                  : `
                    <div class="v2-empty-small">
                      Aucun cours dans cette matière.
                    </div>
                  `
              }

            </div>

          </details>
        `;
      }
    );

    /*
      Si certaines matières ont disparu mais que des cours
      existent encore, on les affiche quand même.
    */
    const knownMatiereIds =
      new Set(
        matieres.map(
          matiere =>
            matiere.id
        )
      );

    const orphanCourses =
      courses.filter(
        course =>
          !knownMatiereIds.has(
            course.matiereId
          )
      );

    if (orphanCourses.length) {
      html += `
        <details
          class="v2-matiere"
          open
        >

          <summary>
            <strong>
              Matières supprimées
            </strong>

            <span
              class="v2-matiere-count"
            >
              ${orphanCourses.length}
              cours
            </span>
          </summary>

          <div
            class="v2-matiere-courses"
          >
            ${orphanCourses
              .map(
                renderCourse
              )
              .join('')}
          </div>

        </details>
      `;
    }

    container.innerHTML =
      html;

    bindCourseEvents();
  }

  function bindCourseEvents() {
    const container =
      document.getElementById(
        'v2-courses-list'
      );

    if (!container) {
      return;
    }

    container
      .querySelectorAll(
        '[data-add-course]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            event => {
              event.preventDefault();
              event.stopPropagation();

              showCourseForm(
                button.dataset
                  .addCourse
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-delete-course]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            event => {
              event.preventDefault();
              event.stopPropagation();

              const course =
                getCourse(
                  button.dataset
                    .deleteCourse
                );

              if (!course) {
                return;
              }

              const confirmed =
                confirm(
                  `Supprimer le cours « ${course.name} » ?\n\nToutes ses révisions seront également supprimées.`
                );

              if (!confirmed) {
                return;
              }

              deleteCourse(
                course.id
              );

              renderCourses();
              renderSuggestions();
              renderTracking();
              renderStats();

              if (
                typeof window.renderCalendar ===
                'function'
              ) {
                window.renderCalendar();
              }
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-edit-course]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            event => {
              event.preventDefault();
              event.stopPropagation();

              editCourse(
                button.dataset
                  .editCourse
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-course-mastery]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            event => {
              event.preventDefault();
              event.stopPropagation();

              setCourseMastery(
                button.dataset
                  .courseMastery,
                button.dataset
                  .level
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-revision-date]'
      )
      .forEach(
        input => {
          input.addEventListener(
            'change',
            () => {
              setRevisionDate(
                input.dataset
                  .revisionDate,
                input.value
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-revision-done]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              completeRevision(
                button.dataset
                  .revisionDone
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-revision-note]'
      )
      .forEach(
        input => {
          input.addEventListener(
            'change',
            () => {
              setRevisionNote(
                input.dataset
                  .revisionNote,
                input.value
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-dismiss-revision]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              dismissRevision(
                button.dataset
                  .dismissRevision
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-restore-revision]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              restoreRevisionSuggestion(
                button.dataset
                  .restoreRevision
              );
            }
          );
        }
      );
  }

  /* ==========================================================
     SUGGESTIONS
  ========================================================== */

  function renderSuggestions() {
    const container =
      document.getElementById(
        'v2-suggestions'
      );

    if (!container) {
      return;
    }

    const suggestions =
      courseRevisions
        .filter(
          isSuggestionEligible
        )
        .filter(
          revision =>
            !!getCourse(
              revision.courseId
            )
        )
        .sort(
          (a, b) =>
            String(
              a.date
            ).localeCompare(
              String(
                b.date
              )
            )
        );

    if (!suggestions.length) {
      container.innerHTML = `
        <div class="v2-empty">
          Rien à revoir prochainement.
          <br>
          Ton planning est à jour.
        </div>
      `;

      return;
    }

    container.innerHTML =
      suggestions
        .map(
          revision => {
            const course =
              getCourse(
                revision.courseId
              );

            if (!course) {
              return '';
            }

            const matiere =
              getMatiere(
                course
              );

            const late =
              revisionIsLate(
                revision
              );

            const delay =
              daysLate(
                revision
              );

            return `
              <div
                class="v2-suggestion"
              >

                <div
                  class="v2-suggestion-main"
                >

                  <span
                    class="v2-suggestion-color"
                    style="background:${escape(
                      matiere?.color ||
                      'var(--accent)'
                    )}"
                  ></span>

                  <div>

                    <strong>
                      ${escape(
                        course.name
                      )}
                    </strong>

                    <div
                      class="v2-suggestion-sub"
                    >

                      ${escape(
                        revision.label
                      )}

                      ·

                      ${
                        late
                          ? `
                            en retard de
                            ${delay}
                            jour${
                              delay > 1
                                ? 's'
                                : ''
                            }
                          `
                          : `
                            prévue le
                            ${formatDateFR(
                              revision.date
                            )}
                          `
                      }

                    </div>

                    ${
                      course.chapters
                        .length
                        ? `
                          <div
                            class="v2-suggestion-chapters"
                          >
                            ${course.chapters
                              .map(
                                chapter =>
                                  escape(
                                    chapter
                                  )
                              )
                              .join(
                                ' · '
                              )}
                          </div>
                        `
                        : ''
                    }

                  </div>

                </div>

                <div
                  class="v2-suggestion-actions"
                >

                  <button
                    type="button"
                    data-plan-revision="${
                      revision.id
                    }"
                  >
                    Replanifier
                  </button>

                  <button
                    type="button"
                    data-do-revision="${
                      revision.id
                    }"
                    class="primary"
                  >
                    Faire
                  </button>

                  <button
                    type="button"
                    data-remove-suggestion="${
                      revision.id
                    }"
                    class="quiet"
                  >
                    Ne plus suggérer
                  </button>

                </div>

              </div>
            `;
          }
        )
        .join('');

    container
      .querySelectorAll(
        '[data-do-revision]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              completeRevision(
                button.dataset
                  .doRevision
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-remove-suggestion]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              dismissRevision(
                button.dataset
                  .removeSuggestion
              );
            }
          );
        }
      );

    container
      .querySelectorAll(
        '[data-plan-revision]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              const revision =
                courseRevisions.find(
                  item =>
                    item.id ===
                    button.dataset
                      .planRevision
                );

              if (!revision) {
                return;
              }

              const newDate =
                prompt(
                  'Nouvelle date (AAAA-MM-JJ) :',
                  revision.date ||
                    todayKey()
                );

              if (
                newDate === null ||
                !newDate.trim()
              ) {
                return;
              }

              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(
                  newDate.trim()
                )
              ) {
                alert(
                  'Format attendu : AAAA-MM-JJ'
                );

                return;
              }

              setRevisionDate(
                revision.id,
                newDate.trim()
              );
            }
          );
        }
      );
  }

  /* ==========================================================
     TABLEAU DE SUIVI
  ========================================================== */

  function renderTracking() {
    const container =
      document.getElementById(
        'v2-tracking'
      );

    if (!container) {
      return;
    }

    if (!courses.length) {
      container.innerHTML = `
        <div class="v2-empty">
          Aucun cours à suivre pour l'instant.
        </div>
      `;

      return;
    }

    const rows =
      courses
        .slice()
        .sort(
          (a, b) =>
            String(
              a.date
            ).localeCompare(
              String(
                b.date
              )
            )
        )
        .map(
          course => {
            const revisions =
              getCourseRevisions(
                course.id
              );

            const done =
              revisions.filter(
                revision =>
                  revision.done
              ).length;

            const total =
              revisions.length;

            const mastery =
              Number(
                course.mastery || 0
              );

            const lastDone =
              revisions
                .filter(
                  revision =>
                    revision.done &&
                    revision.completedAt
                )
                .sort(
                  (a, b) =>
                    String(
                      b.completedAt
                    ).localeCompare(
                      String(
                        a.completedAt
                      )
                    )
                )[0];

            const nextRevision =
              revisions
                .filter(
                  revision =>
                    !revision.done &&
                    revision.date
                )
                .sort(
                  (a, b) =>
                    String(
                      a.date
                    ).localeCompare(
                      String(
                        b.date
                      )
                    )
                )[0];

            return `
              <tr>

                <td>
                  <strong>
                    ${escape(
                      course.name
                    )}
                  </strong>

                  ${
                    course.chapters
                      .length
                      ? `
                        <small>
                          ${course.chapters
                            .map(
                              chapter =>
                                escape(
                                  chapter
                                )
                            )
                            .join(
                              ' · '
                            )}
                        </small>
                      `
                      : ''
                  }
                </td>

                <td>
                  ${escape(
                    getMatiere(
                      course
                    )?.name ||
                      '—'
                  )}
                </td>

                <td>
                  ${formatDateFR(
                    course.date
                  )}
                </td>

                <td>
                  ${done}/${total}
                </td>

                <td>
                  <span
                    class="v2-tracking-mastery"
                  >
                    ${'●'.repeat(
                      mastery
                    )}${'○'.repeat(
                      5 - mastery
                    )}
                  </span>
                </td>

                <td>
                  ${
                    lastDone
                      ? formatDateFR(
                          lastDone.completedAt
                        )
                      : '—'
                  }
                </td>

                <td>
                  ${
                    nextRevision
                      ? `
                        <strong>
                          ${escape(
                            nextRevision.label
                          )}
                        </strong>
                        <br>
                        <small>
                          ${formatDateFR(
                            nextRevision.date
                          )}
                        </small>
                      `
                      : '—'
                  }
                </td>

              </tr>
            `;
          }
        )
        .join('');

    container.innerHTML = `
      <div
        class="v2-table-wrapper"
      >

        <table
          class="v2-tracking-table"
        >

          <thead>
            <tr>
              <th>Cours</th>
              <th>Matière</th>
              <th>Date</th>
              <th>Révisions</th>
              <th>Maîtrise</th>
              <th>Dernière révision</th>
              <th>Prochaine révision</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>
    `;
  }

  /* ==========================================================
     STATISTIQUES
  ========================================================== */

  function getPlacementDate(
    placement
  ) {
    if (!placement) {
      return '';
    }

    if (placement.date) {
      return placement.date;
    }

    if (
      placement.week &&
      typeof placement.day ===
        'number'
    ) {
      return addDaysToKey(
        placement.week,
        placement.day
      );
    }

    return '';
  }

  function renderStats() {
    const container =
      document.getElementById(
        'v2-stats'
      );

    if (!container) {
      return;
    }

    const today =
      todayKey();

    const daily = {};

    for (
      let index = 6;
      index >= 0;
      index--
    ) {
      const date =
        parseDate(today);

      date.setDate(
        date.getDate() -
        index
      );

      daily[
        dateToKey(date)
      ] = 0;
    }

    let todayMinutes = 0;

    if (
      Array.isArray(
        window.placements
      )
    ) {
      window.placements.forEach(
        placement => {
          const date =
            getPlacementDate(
              placement
            );

          if (!date) {
            return;
          }

          const duration =
            Math.max(
              0,
              Number(
                placement.durMin
              ) || 0
            );

          if (
            date === today
          ) {
            todayMinutes +=
              duration;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              daily,
              date
            )
          ) {
            daily[date] +=
              duration;
          }
        }
      );
    }

    const weekMinutes =
      Object.values(
        daily
      ).reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const max =
      Math.max(
        1,
        ...Object.values(
          daily
        )
      );

    const bars =
      Object.entries(
        daily
      )
        .map(
          ([date, minutes]) => {
            const parsed =
              parseDate(
                date
              );

            const height =
              Math.max(
                4,
                Math.round(
                  (
                    minutes /
                    max
                  ) * 100
                )
              );

            return `
              <div
                class="v2-stat-day"
              >

                <div
                  class="v2-stat-bar-wrap"
                  title="${minutes} min"
                >
                  <div
                    class="v2-stat-bar"
                    style="height:${height}%"
                  ></div>
                </div>

                <span>
                  ${parsed
                    .toLocaleDateString(
                      'fr-FR',
                      {
                        weekday:
                          'short'
                      }
                    )
                    .slice(
                      0,
                      2
                    )}
                </span>

              </div>
            `;
          }
        )
        .join('');

    const weekHours =
      Math.floor(
        weekMinutes / 60
      );

    const weekRemaining =
      weekMinutes % 60;

    const todayHours =
      Math.floor(
        todayMinutes / 60
      );

    const todayRemaining =
      todayMinutes % 60;

    const completed =
      courseRevisions.filter(
        revision =>
          revision.done
      ).length;

    const late =
      courseRevisions.filter(
        revision =>
          revisionIsLate(
            revision
          )
      ).length;

    container.innerHTML = `
      <div
        class="v2-stat-cards"
      >

        <div
          class="v2-stat-card"
        >
          <span>
            Cette semaine
          </span>

          <strong>
            ${weekHours}h${String(
              weekRemaining
            ).padStart(
              2,
              '0'
            )}
          </strong>
        </div>

        <div
          class="v2-stat-card"
        >
          <span>
            Aujourd'hui
          </span>

          <strong>
            ${todayHours}h${String(
              todayRemaining
            ).padStart(
              2,
              '0'
            )}
          </strong>
        </div>

        <div
          class="v2-stat-card"
        >
          <span>
            Cours
          </span>

          <strong>
            ${courses.length}
          </strong>
        </div>

        <div
          class="v2-stat-card"
        >
          <span>
            Révisions faites
          </span>

          <strong>
            ${completed}
          </strong>
        </div>

      </div>

      ${
        late
          ? `
            <div
              class="v2-stats-note"
            >
              ${late}
              révision${
                late > 1
                  ? 's'
                  : ''
              }
              en retard actuellement.
            </div>
          `
          : `
            <div
              class="v2-stats-note"
            >
              Aucune révision en retard.
            </div>
          `
      }

      <div
        class="v2-chart"
      >
        ${bars}
      </div>
    `;
  }

  /* ==========================================================
     POMODORO
  ========================================================== */

  function setPomodoroDuration(
    duration
  ) {
    const value =
      Math.round(
        Number(duration)
      );

    if (
      !Number.isFinite(value) ||
      value < 1 ||
      value > 240
    ) {
      return false;
    }

    pomodoro.duration =
      value;

    pomodoro.remaining =
      value * 60;

    pomodoro.mode =
      'travail';

    if (
      pomodoro.running
    ) {
      stopPomodoro();
    }

    savePomodoro();

    renderPomodoro();

    return true;
  }

  function renderPomodoro() {
    const container =
      document.getElementById(
        'v2-pomodoro'
      );

    if (!container) {
      return;
    }

    const total =
      Math.max(
        1,
        pomodoro.duration * 60
      );

    const remaining =
      Math.max(
        0,
        pomodoro.remaining
      );

    const minutes =
      Math.floor(
        remaining / 60
      );

    const seconds =
      remaining % 60;

    const progress =
      Math.min(
        100,
        Math.max(
          0,
          (
            (
              total -
              remaining
            ) /
            total
          ) * 100
        )
      );

    container.innerHTML = `
      <div
        class="v2-pomodoro-inner"
      >

        <div
          class="v2-pomodoro-mode"
        >
          ${
            pomodoro.mode ===
            'travail'
              ? 'Session de travail'
              : 'Pause'
          }
        </div>

        <div
          class="v2-pomodoro-time"
        >
          ${String(
            minutes
          ).padStart(
            2,
            '0'
          )}:${String(
            seconds
          ).padStart(
            2,
            '0'
          )}
        </div>

        <div
          class="v2-pomodoro-progress"
        >
          <div
            style="width:${progress}%"
          ></div>
        </div>

        <div
          class="v2-pomodoro-controls"
        >

          <button
            type="button"
            id="v2-pomodoro-start"
            class="primary"
          >
            ${
              pomodoro.running
                ? 'Pause'
                : 'Démarrer'
            }
          </button>

          <button
            type="button"
            id="v2-pomodoro-reset"
          >
            Réinitialiser
          </button>

        </div>

        <div
          class="v2-pomodoro-presets"
        >

          <span>
            Durée rapide
          </span>

          <button
            type="button"
            class="v2-pomodoro-preset ${
              pomodoro.duration ===
              25
                ? 'active'
                : ''
            }"
            data-pomodoro-preset="25"
          >
            25 min
          </button>

          <button
            type="button"
            class="v2-pomodoro-preset ${
              pomodoro.duration ===
              50
                ? 'active'
                : ''
            }"
            data-pomodoro-preset="50"
          >
            50 min
          </button>

        </div>

        <div
          class="v2-pomodoro-custom"
        >

          <label
            for="v2-pomodoro-custom-input"
          >
            Durée personnalisée
          </label>

          <div
            class="v2-pomodoro-custom-row"
          >

            <input
              id="v2-pomodoro-custom-input"
              type="number"
              min="1"
              max="240"
              step="1"
              value="${escape(
                pomodoro.duration
              )}"
              placeholder="Ex. 45"
            >

            <span>
              min
            </span>

            <button
              type="button"
              id="v2-pomodoro-custom-ok"
            >
              OK
            </button>

          </div>

          <small>
            Entre 1 et 240 minutes.
          </small>

        </div>

      </div>
    `;

    document
      .getElementById(
        'v2-pomodoro-start'
      )
      ?.addEventListener(
        'click',
        togglePomodoro
      );

    document
      .getElementById(
        'v2-pomodoro-reset'
      )
      ?.addEventListener(
        'click',
        resetPomodoro
      );

    container
      .querySelectorAll(
        '[data-pomodoro-preset]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            () => {
              setPomodoroDuration(
                button.dataset
                  .pomodoroPreset
              );
            }
          );
        }
      );

    const customInput =
      document.getElementById(
        'v2-pomodoro-custom-input'
      );

    const customButton =
      document.getElementById(
        'v2-pomodoro-custom-ok'
      );

    const applyCustom =
      () => {
        const value =
          Number(
            customInput?.value
          );

        if (
          !Number.isFinite(
            value
          ) ||
          value < 1 ||
          value > 240
        ) {
          alert(
            'La durée doit être comprise entre 1 et 240 minutes.'
          );

          return;
        }

        setPomodoroDuration(
          value
        );
      };

    customButton?.addEventListener(
      'click',
      applyCustom
    );

    customInput?.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
          'Enter'
        ) {
          event.preventDefault();
          applyCustom();
        }
      }
    );
  }

  function togglePomodoro() {
    if (
      pomodoro.running
    ) {
      stopPomodoro();
    } else {
      startPomodoro();
    }
  }

  function startPomodoro() {
    if (
      pomodoroInterval
    ) {
      return;
    }

    if (
      pomodoro.remaining <= 0
    ) {
      pomodoro.remaining =
        pomodoro.duration *
        60;

      pomodoro.mode =
        'travail';
    }

    pomodoro.running =
      true;

    savePomodoro();

    renderPomodoro();

    pomodoroInterval =
      setInterval(
        () => {
          if (
            pomodoro.remaining <=
            0
          ) {
            clearInterval(
              pomodoroInterval
            );

            pomodoroInterval =
              null;

            pomodoro.running =
              false;

            if (
              pomodoro.mode ===
              'travail'
            ) {
              pomodoro.mode =
                'pause';

              pomodoro.remaining =
                5 * 60;
            } else {
              pomodoro.mode =
                'travail';

              pomodoro.remaining =
                pomodoro.duration *
                60;
            }

            savePomodoro();
            renderPomodoro();

            return;
          }

          pomodoro.remaining--;

          if (
            pomodoro.remaining %
              5 ===
            0
          ) {
            savePomodoro();
          }

          renderPomodoro();
        },
        1000
      );
  }

  function stopPomodoro() {
    pomodoro.running =
      false;

    if (
      pomodoroInterval
    ) {
      clearInterval(
        pomodoroInterval
      );

      pomodoroInterval =
        null;
    }

    savePomodoro();

    renderPomodoro();
  }

  function resetPomodoro() {
    if (
      pomodoroInterval
    ) {
      clearInterval(
        pomodoroInterval
      );

      pomodoroInterval =
        null;
    }

    pomodoro.running =
      false;

    pomodoro.mode =
      'travail';

    pomodoro.remaining =
      pomodoro.duration *
      60;

    savePomodoro();

    renderPomodoro();
  }

  /* ==========================================================
     CALENDRIER
  ========================================================== */

  function getCalendarCourse(
    id
  ) {
    return getCourse(id);
  }

  const originalRefFor =
    window.refFor;

  if (
    !window.__planningV2RefForPatched
  ) {
    window.__planningV2RefForPatched =
      true;

    window.refFor =
      function (placement) {
        if (
          placement &&
          placement.type ===
            'course'
        ) {
          return getCalendarCourse(
            placement.refId
          );
        }

        if (
          typeof originalRefFor ===
          'function'
        ) {
          return originalRefFor(
            placement
          );
        }

        return null;
      };
  }

  function patchCalendarCourseDisplay() {
    if (
      !Array.isArray(
        window.placements
      )
    ) {
      return;
    }

    window.placements
      .filter(
        placement =>
          placement &&
          placement.type ===
            'course'
      )
      .forEach(
        placement => {
          const element =
            document.querySelector(
              `.cal-block[data-pid="${CSS.escape(
                String(
                  placement.id
                )
              )}"]`
            );

          if (!element) {
            return;
          }

          const course =
            getCalendarCourse(
              placement.refId
            );

          if (!course) {
            return;
          }

          const title =
            element.querySelector(
              '.n'
            );

          const detail =
            element.querySelector(
              '.d'
            );

          if (title) {
            title.textContent =
              course.name;
          }

          if (detail) {
            detail.textContent =
              course.chapters
                .length
                ? course.chapters.join(
                    ' · '
                  )
                : '';
          }
        }
      );
  }

  /* ==========================================================
     POPOVER CALENDRIER
  ========================================================== */

  const originalOpenAddPopover =
    window.openAddPopover;

  if (
    !window.__planningV2PopoverPatched
  ) {
    window.__planningV2PopoverPatched =
      true;

    window.openAddPopover =
      function (
        event,
        day,
        startMin
      ) {
        if (
          typeof originalOpenAddPopover ===
          'function'
        ) {
          originalOpenAddPopover(
            event,
            day,
            startMin
          );
        }

        setTimeout(
          () => {
            const pop =
              document.getElementById(
                'pop'
              );

            if (!pop) {
              return;
            }

            /*
              Évite d'ajouter plusieurs fois
              le groupe de cours.
            */
            if (
              pop.querySelector(
                '.v2-calendar-course-group'
              )
            ) {
              return;
            }

            if (
              !courses.length
            ) {
              return;
            }

            const group =
              document.createElement(
                'div'
              );

            group.className =
              'v2-calendar-course-group';

            group.innerHTML = `
              <div
                class="grouplabel"
              >
                Cours
              </div>
            `;

            courses
              .slice()
              .sort(
                (a, b) =>
                  String(
                    a.date
                  ).localeCompare(
                    String(
                      b.date
                    )
                  )
              )
              .forEach(
                course => {
                  const row =
                    document.createElement(
                      'div'
                    );

                  row.className =
                    'pop-row v2-calendar-course-row';

                  const matiere =
                    getMatiere(
                      course
                    );

                  row.innerHTML = `
                    <span
                      class="v2-calendar-course-dot"
                      style="background:${escape(
                        matiere?.color ||
                        'var(--accent)'
                      )}"
                    ></span>

                    <span
                      class="pop-name"
                      title="${escape(
                        course.name
                      )}"
                    >
                      ${escape(
                        course.name
                      )}
                    </span>

                    <input
                      type="number"
                      min="20"
                      step="5"
                      value="60"
                      class="pop-num"
                      data-course-duration="${
                        course.id
                      }"
                    >

                    <button
                      type="button"
                      class="pop-place"
                      data-place-course="${
                        course.id
                      }"
                      title="Ajouter ce cours au planning"
                    >
                      ${
                        typeof window.icon ===
                        'function'
                          ? window.icon(
                              'check'
                            )
                          : '✓'
                      }
                    </button>
                  `;

                  group.appendChild(
                    row
                  );
                }
              );

            pop.appendChild(
              group
            );

            group
              .querySelectorAll(
                '[data-place-course]'
              )
              .forEach(
                button => {
                  button.addEventListener(
                    'click',
                    event => {
                      event.preventDefault();
                      event.stopPropagation();

                      const courseId =
                        button.dataset
                          .placeCourse;

                      const input =
                        group.querySelector(
                          `[data-course-duration="${CSS.escape(
                            courseId
                          )}"]`
                        );

                      let duration =
                        Number(
                          input?.value ||
                            60
                        );

                      if (
                        !Number.isFinite(
                          duration
                        )
                      ) {
                        duration =
                          60;
                      }

                      duration =
                        Math.max(
                          20,
                          Math.round(
                            duration
                          )
                        );

                      const placement = {
                        id:
                          typeof window.uid ===
                          'function'
                            ? window.uid(
                                'pl'
                              )
                            : courseUid(),

                        type:
                          'course',

                        refId:
                          courseId,

                        day,

                        startMin,

                        durMin:
                          duration,

                        week:
                          typeof window.currentWeekKey ===
                          'function'
                            ? window.currentWeekKey()
                            : ''
                      };

                      if (
                        typeof window.clearOverlaps ===
                        'function'
                      ) {
                        window.clearOverlaps(
                          placement
                        );
                      }

                      if (
                        Array.isArray(
                          window.placements
                        )
                      ) {
                        window.placements.push(
                          placement
                        );
                      } else {
                        window.placements = [
                          placement
                        ];
                      }

                      if (
                        typeof window.savePlacements ===
                        'function'
                      ) {
                        window.savePlacements();
                      }

                      if (
                        typeof window.closePopover ===
                        'function'
                      ) {
                        window.closePopover();
                      }

                      if (
                        typeof window.renderCalendar ===
                        'function'
                      ) {
                        window.renderCalendar();
                      }

                      setTimeout(
                        () => {
                          patchCalendarCourseDisplay();
                          renderStats();
                        },
                        50
                      );
                    }
                  );
                }
              );
          },
          0
        );
      };
  }

  /* ==========================================================
     STYLES
  ========================================================== */

  function injectStyles() {
    if (
      document.getElementById(
        'planning-v2-styles'
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      'planning-v2-styles';

    style.textContent = `

      /* ======================================================
         CARTES PRINCIPALES
      ====================================================== */

      #v2-courses-card,
      #v2-suggestions-card,
      #v2-tracking-card,
      #v2-stats-card,
      #v2-pomodoro-card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 18px 20px 22px;
        margin-bottom: 22px;
      }

      #v2-courses-card h2,
      #v2-suggestions-card h2,
      #v2-tracking-card h2,
      #v2-stats-card h2,
      #v2-pomodoro-card h2 {
        margin-top: 0;
      }

      /* ======================================================
         COURS
      ====================================================== */

      .v2-course {
        border: 1px solid var(--line);
        border-radius: 12px;
        margin: 12px 0;
        overflow: hidden;
        background: var(--paper);
      }

      .v2-course-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        background: var(--paper-soft);
      }

      .v2-course-title {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .v2-course-color {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex: none;
      }

      .v2-course-title strong {
        font-size: 14px;
      }

      .v2-course-meta {
        font-size: 11px;
        color: var(--ink-soft);
        margin-top: 3px;
      }

      .v2-course-actions {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: none;
      }

      .v2-course-actions button,
      .v2-matiere summary button,
      .v2-suggestion-actions button,
      .v2-pomodoro-controls button,
      .v2-form-actions button,
      .v2-pomodoro-custom-row button {
        border: 1px solid var(--line-strong);
        background: var(--paper);
        color: var(--ink);
        border-radius: 7px;
        padding: 6px 9px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
      }

      .v2-course-actions button:hover,
      .v2-suggestion-actions button:hover,
      .v2-pomodoro-controls button:hover,
      .v2-form-actions button:hover,
      .v2-pomodoro-custom-row button:hover {
        background: var(--paper-soft);
      }

      .v2-course-actions .danger {
        color: var(--danger);
      }

      .v2-progress {
        color: var(--accent);
        font-size: 11px;
        font-weight: 500;
        margin-right: 4px;
      }

      /* ======================================================
         CHAPITRES
      ====================================================== */

      .v2-chapters {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding: 10px 14px;
      }

      .v2-chapter {
        padding: 4px 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 11px;
      }

      .v2-no-chapter {
        font-size: 11px;
        color: var(--ink-soft);
      }

      /* ======================================================
         MAÎTRISE
      ====================================================== */

      .v2-mastery {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 14px;
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        font-size: 11.5px;
        color: var(--ink-soft);
      }

      .v2-mastery-dots {
        display: flex;
        gap: 5px;
      }

      .v2-mastery-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid var(--line-strong);
        background: transparent;
        cursor: pointer;
        padding: 0;
      }

      .v2-mastery-dot.active {
        background: var(--accent);
        border-color: var(--accent);
      }

      .v2-mastery-value {
        color: var(--ink);
      }

      /* ======================================================
         RÉVISIONS
      ====================================================== */

      .v2-revisions {
        padding: 8px 10px 12px;
      }

      .v2-revisions-title,
      .v2-revision-row {
        display: grid;
        grid-template-columns:
          90px
          130px
          45px
          minmax(100px, 1fr)
          30px;
        gap: 7px;
        align-items: center;
      }

      .v2-revisions-title {
        color: var(--ink-soft);
        font-size: 10px;
        text-transform: uppercase;
        padding: 4px 5px;
      }

      .v2-revision-row {
        padding: 5px;
        border-top: 1px solid var(--line);
      }

      .v2-revision-row.late {
        background: rgba(224, 100, 95, .06);
      }

      .v2-revision-row.done {
        opacity: .62;
      }

      .v2-revision-label {
        font-size: 12px;
      }

      .v2-optional {
        display: block;
        color: var(--ink-soft);
        font-size: 9px;
        margin-top: 2px;
      }

      .v2-revision-row input {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        border: 1px solid transparent;
        background: transparent;
        color: var(--ink);
        border-radius: 6px;
        padding: 5px 6px;
        font-family: inherit;
        font-size: 11.5px;
      }

      .v2-revision-row input:hover {
        border-color: var(--line-strong);
      }

      .v2-revision-row input:focus {
        outline: none;
        border-color: var(--accent);
        background: var(--paper-soft);
      }

      .v2-revision-row input:disabled {
        opacity: .4;
        cursor: not-allowed;
      }

      .v2-revision-check {
        width: 28px;
        height: 28px;
        border-radius: 7px;
        border: 1px solid var(--line-strong);
        background: var(--paper);
        color: var(--accent);
        cursor: pointer;
        font-size: 16px;
      }

      .v2-revision-check:hover {
        background: var(--accent-soft);
      }

      .v2-dismiss-revision {
        border: none;
        background: none;
        color: var(--ink-soft);
        cursor: pointer;
        font-size: 17px;
        padding: 4px;
      }

      .v2-dismiss-revision:hover {
        color: var(--danger);
      }

      .v2-dismiss-revision.restored {
        color: var(--accent);
      }

      /* ======================================================
         MATIÈRES
      ====================================================== */

      .v2-matiere {
        border-bottom: 1px solid var(--line);
        padding: 5px 0;
      }

      .v2-matiere:last-child {
        border-bottom: none;
      }

      .v2-matiere summary {
        display: flex;
        align-items: center;
        gap: 9px;
        cursor: pointer;
        padding: 9px 3px;
        list-style: none;
      }

      .v2-matiere summary::-webkit-details-marker {
        display: none;
      }

      .v2-matiere-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        flex: none;
      }

      .v2-matiere-count {
        color: var(--ink-soft);
        font-size: 10.5px;
      }

      .v2-add-course {
        margin-left: auto;
      }

      .v2-matiere-courses {
        padding: 0 2px 8px;
      }

      .v2-empty,
      .v2-empty-small {
        color: var(--ink-soft);
        font-size: 12px;
        line-height: 1.6;
        padding: 12px 4px;
      }

      .v2-empty-small {
        padding: 8px 4px 12px;
      }

      /* ======================================================
         FORMULAIRE
      ====================================================== */

      .v2-course-form {
        border: 1px solid var(--line-strong);
        border-radius: 10px;
        padding: 12px;
        margin: 8px 0 10px;
        background: var(--paper-soft);
      }

      .v2-form-title {
        font-size: 12px;
        margin-bottom: 10px;
      }

      .v2-course-form label {
        display: block;
        font-size: 10px;
        color: var(--ink-soft);
        margin: 7px 0 4px;
      }

      .v2-course-form input {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 3px;
        border: 1px solid var(--line-strong);
        border-radius: 7px;
        background: var(--paper);
        color: var(--ink);
        padding: 8px;
        font-family: inherit;
        font-size: 12px;
      }

      .v2-form-help {
        color: var(--ink-soft);
        font-size: 10px;
        margin-top: 5px;
      }

      .v2-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 7px;
        margin-top: 10px;
      }

      .v2-form-actions .primary,
      .v2-suggestion-actions .primary,
      .v2-pomodoro-controls .primary,
      .v2-pomodoro-custom-row button {
        background: var(--accent);
        border-color: var(--accent);
        color: #08130F;
      }

      /* ======================================================
         SUGGESTIONS
      ====================================================== */

      .v2-suggestion {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--line);
        padding: 11px 3px;
      }

      .v2-suggestion:last-child {
        border-bottom: none;
      }

      .v2-suggestion-main {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        min-width: 0;
      }

      .v2-suggestion-color {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        margin-top: 5px;
        flex: none;
      }

      .v2-suggestion-main strong {
        font-size: 12.5px;
      }

      .v2-suggestion-sub {
        color: var(--ink-soft);
        font-size: 10.5px;
        margin-top: 2px;
      }

      .v2-suggestion-chapters {
        color: var(--ink-soft);
        font-size: 10px;
        margin-top: 3px;
      }

      .v2-suggestion-actions {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .v2-suggestion-actions .quiet {
        color: var(--ink-soft);
      }

      /* ======================================================
         TABLEAU DE SUIVI
      ====================================================== */

      .v2-table-wrapper {
        overflow-x: auto;
        width: 100%;
      }

      .v2-tracking-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        min-width: 850px;
      }

      .v2-tracking-table th {
        text-align: left;
        color: var(--ink-soft);
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 500;
        padding: 8px;
        border-bottom: 1px solid var(--line-strong);
        white-space: nowrap;
      }

      .v2-tracking-table td {
        padding: 9px 8px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      .v2-tracking-table td strong {
        font-size: 11.5px;
      }

      .v2-tracking-table td small {
        display: block;
        color: var(--ink-soft);
        margin-top: 3px;
      }

      .v2-tracking-mastery {
        letter-spacing: 2px;
        white-space: nowrap;
        color: var(--accent);
      }

      /* ======================================================
         STATISTIQUES
      ====================================================== */

      .v2-stat-cards {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 9px;
      }

      .v2-stat-card {
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 11px;
        background: var(--paper-soft);
      }

      .v2-stat-card span {
        display: block;
        font-size: 10px;
        color: var(--ink-soft);
        margin-bottom: 5px;
      }

      .v2-stat-card strong {
        font-family: "Fraunces", serif;
        font-size: 18px;
      }

      .v2-stats-note {
        font-size: 11px;
        color: var(--ink-soft);
        margin-top: 12px;
      }

      .v2-chart {
        height: 150px;
        display: flex;
        align-items: stretch;
        gap: 8px;
        margin-top: 16px;
        border-bottom: 1px solid var(--line-strong);
        padding: 0 5px;
      }

      .v2-stat-day {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        gap: 5px;
        min-width: 0;
      }

      .v2-stat-bar-wrap {
        height: 125px;
        width: 100%;
        display: flex;
        align-items: flex-end;
      }

      .v2-stat-bar {
        width: 100%;
        min-height: 4px;
        border-radius: 5px 5px 0 0;
        background: var(--accent);
        opacity: .75;
      }

      .v2-stat-day span {
        font-size: 9px;
        color: var(--ink-soft);
      }

      /* ======================================================
         POMODORO
      ====================================================== */

      .v2-pomodoro-inner {
        max-width: 460px;
      }

      .v2-pomodoro-mode {
        color: var(--ink-soft);
        font-size: 11px;
      }

      .v2-pomodoro-time {
        font-family: "Fraunces", serif;
        font-size: 42px;
        margin: 7px 0;
      }

      .v2-pomodoro-progress {
        height: 5px;
        border-radius: 999px;
        background: var(--paper-soft);
        overflow: hidden;
      }

      .v2-pomodoro-progress div {
        height: 100%;
        background: var(--accent);
      }

      .v2-pomodoro-controls {
        display: flex;
        gap: 7px;
        margin-top: 12px;
      }

      .v2-pomodoro-presets {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 14px;
        font-size: 10px;
        color: var(--ink-soft);
      }

      .v2-pomodoro-preset {
        border: 1px solid var(--line-strong);
        background: var(--paper);
        color: var(--ink);
        border-radius: 7px;
        padding: 6px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
      }

      .v2-pomodoro-preset.active {
        background: var(--accent-soft);
        border-color: var(--accent);
        color: var(--accent);
      }

      .v2-pomodoro-custom {
        margin-top: 12px;
      }

      .v2-pomodoro-custom label {
        display: block;
        color: var(--ink-soft);
        font-size: 10px;
        margin-bottom: 5px;
      }

      .v2-pomodoro-custom-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .v2-pomodoro-custom-row input {
        width: 90px;
        border: 1px solid var(--line-strong);
        background: var(--paper);
        color: var(--ink);
        border-radius: 7px;
        padding: 7px 8px;
        font-family: inherit;
        font-size: 12px;
      }

      .v2-pomodoro-custom-row input:focus {
        outline: none;
        border-color: var(--accent);
      }

      .v2-pomodoro-custom-row span {
        font-size: 11px;
        color: var(--ink-soft);
      }

      .v2-pomodoro-custom small {
        display: block;
        margin-top: 5px;
        font-size: 9px;
        color: var(--ink-soft);
      }

      /* ======================================================
         CALENDRIER
      ====================================================== */

      .v2-calendar-course-group {
        margin-top: 8px;
        border-top: 1px solid var(--line);
        padding-top: 4px;
      }

      .v2-calendar-course-row {
        padding: 5px 6px;
      }

      .v2-calendar-course-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }

      /* ======================================================
         MOBILE
      ====================================================== */

      @media(max-width: 700px) {

        #v2-courses-card,
        #v2-suggestions-card,
        #v2-tracking-card,
        #v2-stats-card,
        #v2-pomodoro-card {
          padding: 14px;
        }

        .v2-revisions-title {
          display: none;
        }

        .v2-revision-row {
          grid-template-columns:
            65px
            minmax(100px, 1fr)
            34px
            minmax(70px, 1fr)
            28px;
        }

        .v2-stat-cards {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .v2-suggestion {
          flex-direction: column;
          align-items: stretch;
        }

        .v2-suggestion-actions {
          justify-content: flex-start;
        }

        .v2-course-header {
          align-items: flex-start;
        }

        .v2-course-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .v2-pomodoro-time {
          font-size: 36px;
        }

      }

    `;

    document.head.appendChild(
      style
    );
  }

  /* ==========================================================
     INJECTION DES CARTES
  ========================================================== */

  function findMainCardsContainer() {
    /*
      Première priorité :
      la carte qui contient la liste des matières.
    */
    const matieresList =
      document.getElementById(
        'matieresList'
      );

    if (matieresList) {
      const card =
        matieresList.closest(
          '.card'
        );

      if (card) {
        return card;
      }

      return matieresList.parentElement;
    }

    /*
      Fallback :
      cherche une carte contenant un titre lié aux matières.
    */
    const cards =
      Array.from(
        document.querySelectorAll(
          '.card'
        )
      );

    const candidate =
      cards.find(
        card => {
          const text =
            (
              card.textContent ||
              ''
            ).toLowerCase();

          return (
            text.includes(
              'matière'
            ) ||
            text.includes(
              'matières'
            )
          );
        }
      );

    return (
      candidate ||
      document.querySelector(
        'main'
      ) ||
      document.body
    );
  }

  function createCard(
    id,
    title,
    description,
    contentId
  ) {
    const card =
      document.createElement(
        'div'
      );

    card.id = id;
    card.className =
      'card v2-generated-card';

    card.innerHTML = `
      <h2>
        ${title}
      </h2>

      <p class="hint">
        ${description}
      </p>

      <div id="${contentId}"></div>
    `;

    return card;
  }

  function injectCards() {
    if (
      document.getElementById(
        'v2-courses-card'
      )
    ) {
      return true;
    }

    const anchor =
      findMainCardsContainer();

    if (!anchor) {
      return false;
    }

    /*
      On ne cache plus brutalement la carte originale
      si elle ne correspond pas exactement à la structure
      attendue.
    */
    const parent =
      anchor.parentNode ||
      document.body;

    const coursesCard =
      createCard(
        'v2-courses-card',
        '📚 Mes cours',
        'Chaque cours correspond à une heure de cours. Associe-lui plusieurs chapitres et suis ses révisions.',
        'v2-courses-list'
      );

    const suggestionsCard =
      createCard(
        'v2-suggestions-card',
        '🔄 À revoir prochainement',
        'Les révisions à venir et les révisions récentes en retard sont proposées ici. Tu peux les faire, les replanifier ou choisir de ne plus les suggérer.',
        'v2-suggestions'
      );

    const trackingCard =
      createCard(
        'v2-tracking-card',
        '📋 Tableau de suivi',
        'Vue d’ensemble de tes cours, de leur progression et de leurs prochaines révisions.',
        'v2-tracking'
      );

    const statsCard =
      createCard(
        'v2-stats-card',
        '📊 Statistiques',
        'Temps de travail enregistré dans le planning au cours des sept derniers jours.',
        'v2-stats'
      );

    const pomodoroCard =
      createCard(
        'v2-pomodoro-card',
        '🍅 Pomodoro',
        'Minuteur indépendant du planning. Il ne modifie pas tes blocs de travail.',
        'v2-pomodoro'
      );

    parent.insertBefore(
      coursesCard,
      anchor
    );

    parent.insertBefore(
      suggestionsCard,
      anchor
    );

    parent.insertBefore(
      trackingCard,
      anchor
    );

    parent.insertBefore(
      statsCard,
      anchor
    );

    parent.insertBefore(
      pomodoroCard,
      anchor
    );

    return true;
  }

  /* ==========================================================
     EXPORT
  ========================================================== */

  function patchExportImport() {
    /*
      On ne crée PAS un deuxième téléchargement.
      On laisse le système existant gérer l'export principal.

      Si l'export existant expose une fonction ou un bouton,
      on ajoute simplement les données V2 au moment du clic
      lorsque cela est possible.
    */

    const exportButton =
      document.getElementById(
        'exportBtn'
      );

    if (
      !exportButton ||
      exportButton.dataset
        .v2Patched
    ) {
      return;
    }

    /*
      Important :
      ne pas créer un second fichier JSON.
      L'ancien système reste responsable du téléchargement.
    */
    exportButton.dataset
      .v2Patched = 'true';

    exportButton.addEventListener(
      'click',
      () => {
        /*
          Les données V2 sont déjà enregistrées
          dans LocalStorage.

          Elles peuvent donc être récupérées manuellement
          par le système d'import/export existant.
        */
        saveCourses();
        saveCourseRevisions();
        savePomodoro();
      },
      true
    );
  }

  /* ==========================================================
     OBSERVATION DU CALENDRIER
  ========================================================== */

  function observeCalendar() {
    const calendar =
      document.getElementById(
        'calDays'
      );

    if (
      !calendar ||
      calendar.dataset
        .v2Observer
    ) {
      return;
    }

    calendar.dataset
      .v2Observer = 'true';

    const observer =
      new MutationObserver(
        () => {
          patchCalendarCourseDisplay();
          renderStats();
        }
      );

    observer.observe(
      calendar,
      {
        childList: true,
        subtree: true
      }
    );
  }

  /* ==========================================================
     RAFRAÎCHISSEMENT
  ========================================================== */

  function refreshV2() {
    renderCourses();
    renderSuggestions();
    renderTracking();
    renderStats();
    renderPomodoro();
    patchCalendarCourseDisplay();
  }

  /* ==========================================================
     INITIALISATION
  ========================================================== */

  function initV2() {
    /*
      Évite une double initialisation.
    */
    if (
      window.__planningV2Initialized
    ) {
      return;
    }

    window.__planningV2Initialized =
      true;

    loadV2Data();

    injectStyles();

    const cardsReady =
      injectCards();

    if (!cardsReady) {
      /*
        Le script principal peut parfois créer le DOM
        légèrement après ce fichier.
      */
      window.__planningV2Initialized =
        false;

      setTimeout(
        initV2,
        300
      );

      return;
    }

    refreshV2();

    patchExportImport();

    observeCalendar();

    /*
      Synchronisation légère avec le planning existant.
      Aucun serveur et aucune donnée distante.
    */
    setInterval(
      () => {
        renderStats();
        renderSuggestions();
        patchCalendarCourseDisplay();
      },
      5000
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initV2,
      {
        once: true
      }
    );
  } else {
    initV2();
  }

})();
