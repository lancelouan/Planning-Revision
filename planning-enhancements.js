/* ============================================================
   Planning Révision — V2
   Gestion des cours, chapitres, révisions, suggestions,
   statistiques et Pomodoro.

   Fonctionne avec l'architecture actuelle :
   - LocalStorage uniquement
   - Aucun Supabase
   - Aucun compte
   - Aucun serveur nécessaire
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
    { id: 'j0', label: 'J-0', offset: 0, automatic: true },
    { id: 'j1', label: 'J-1', offset: 1, automatic: true },
    { id: 'j3', label: 'J-3', offset: 3, automatic: true },
    { id: 'j5', label: 'J-5', offset: 5, automatic: true, optional: true },
    { id: 'j7', label: 'J-7', offset: 7, automatic: true },
    { id: 'free1', label: 'Libre 1', offset: null, automatic: false },
    { id: 'free2', label: 'Libre 2', offset: null, automatic: false },
    { id: 'free3', label: 'Libre 3', offset: null, automatic: false },
    { id: 'free4', label: 'Libre 4', offset: null, automatic: false }
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
     OUTILS
  ========================================================== */

  function courseUid() {
    return 'crs_' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  function revisionUid() {
    return 'rev_' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  function saveCourses() {
    localStorage.setItem(COURSE_KEY, JSON.stringify(courses));
  }

  function saveCourseRevisions() {
    localStorage.setItem(REVISION_KEY, JSON.stringify(courseRevisions));
  }

  function loadV2Data() {
    try {
      courses = JSON.parse(localStorage.getItem(COURSE_KEY)) || [];
    } catch {
      courses = [];
    }

    try {
      courseRevisions =
        JSON.parse(localStorage.getItem(REVISION_KEY)) || [];
    } catch {
      courseRevisions = [];
    }

    try {
      const savedPomodoro =
        JSON.parse(localStorage.getItem(POMODORO_KEY));

      if (savedPomodoro) {
        pomodoro = {
          ...pomodoro,
          ...savedPomodoro,
          running: false
        };
      }
    } catch {}
  }

  function savePomodoro() {
    localStorage.setItem(
      POMODORO_KEY,
      JSON.stringify({
        duration: pomodoro.duration,
        remaining: pomodoro.remaining,
        mode: pomodoro.mode
      })
    );
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseDate(value) {
    if (!value) return null;

    const d = new Date(value + 'T12:00:00');

    if (Number.isNaN(d.getTime())) return null;

    return d;
  }

  function dateToKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDaysToKey(dateKeyValue, amount) {
    const d = parseDate(dateKeyValue);

    if (!d) return '';

    d.setDate(d.getDate() + amount);

    return dateToKey(d);
  }

  function formatDateFR(value) {
    const d = parseDate(value);

    if (!d) return '—';

    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function escape(value) {
    if (window.escapeHtml) {
      return escapeHtml(String(value || ''));
    }

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCourse(id) {
    return courses.find(c => c.id === id);
  }

  function getCourseRevision(courseId, type) {
    return courseRevisions.find(
      r => r.courseId === courseId && r.type === type
    );
  }

  function getCourseRevisions(courseId) {
    return courseRevisions.filter(
      r => r.courseId === courseId
    );
  }

  function getMatiere(course) {
    if (!course) return null;

    return typeof findMatiere === 'function'
      ? findMatiere(course.matiereId)
      : matieres.find(m => m.id === course.matiereId);
  }

  /* ==========================================================
     STRUCTURE D'UN COURS
  ========================================================== */

  function createCourse(data) {
    const course = {
      id: courseUid(),
      matiereId: data.matiereId || '',
      name: data.name || 'Nouveau cours',
      date: data.date || todayKey(),
      chapters: Array.isArray(data.chapters)
        ? data.chapters.filter(Boolean)
        : [],
      color: data.color || '',
      createdAt: new Date().toISOString()
    };

    courses.push(course);

    /* Création automatique des 9 révisions */
    REVISION_TYPES.forEach(type => {
      courseRevisions.push({
        id: revisionUid(),
        courseId: course.id,
        type: type.id,
        label: type.label,
        date: type.offset === null
          ? ''
          : addDaysToKey(course.date, type.offset),
        planned: type.offset !== null,
        done: false,
        note: '',
        mastery: 0,
        dismissed: false,
        completedAt: ''
      });
    });

    saveCourses();
    saveCourseRevisions();

    return course;
  }

  function deleteCourse(courseId) {
    courses = courses.filter(c => c.id !== courseId);

    courseRevisions =
      courseRevisions.filter(r => r.courseId !== courseId);

    /* Supprime également les blocs calendrier liés au cours */
    if (Array.isArray(window.placements)) {
      window.placements =
        placements.filter(p => {
          return !(p.type === 'course' && p.refId === courseId);
        });

      if (typeof savePlacements === 'function') {
        savePlacements();
      }
    }

    saveCourses();
    saveCourseRevisions();
  }

  /* ==========================================================
     MAÎTRISE
  ========================================================== */

  function masteryDots(course) {
    const values = [];

    for (let i = 1; i <= 5; i++) {
      values.push(
        `<button
          class="v2-mastery-dot ${i <= (course.mastery || 0) ? 'active' : ''}"
          data-course-mastery="${course.id}"
          data-level="${i}"
          title="${i}/5"
        ></button>`
      );
    }

    return values.join('');
  }

  function setCourseMastery(courseId, value) {
    const course = getCourse(courseId);

    if (!course) return;

    course.mastery = Number(value);

    saveCourses();

    renderCourses();
  }

  /* ==========================================================
     SUGGESTIONS DE RÉVISION
  ========================================================== */

  function revisionIsLate(revision) {
    if (!revision.date) return false;
    if (revision.done) return false;
    if (revision.dismissed) return false;

    return revision.date < todayKey();
  }

  function daysLate(revision) {
    const d1 = parseDate(revision.date);
    const d2 = parseDate(todayKey());

    if (!d1 || !d2) return 0;

    return Math.max(
      0,
      Math.floor((d2 - d1) / 86400000)
    );
  }

  function isSuggestionEligible(revision) {
    if (!revision) return false;
    if (revision.done) return false;
    if (revision.dismissed) return false;
    if (!revision.date) return false;

    const late = daysLate(revision);

    /* Une suggestion disparaît automatiquement après 7 jours */
    if (late > 7) return false;

    return true;
  }

  function dismissRevision(revisionId) {
    const revision =
      courseRevisions.find(r => r.id === revisionId);

    if (!revision) return;

    revision.dismissed = true;

    saveCourseRevisions();

    renderSuggestions();
    renderCourses();
  }

  function restoreRevisionSuggestion(revisionId) {
    const revision =
      courseRevisions.find(r => r.id === revisionId);

    if (!revision) return;

    revision.dismissed = false;

    saveCourseRevisions();

    renderSuggestions();
    renderCourses();
  }

  function completeRevision(revisionId) {
    const revision =
      courseRevisions.find(r => r.id === revisionId);

    if (!revision) return;

    revision.done = !revision.done;

    revision.completedAt =
      revision.done ? todayKey() : '';

    saveCourseRevisions();

    renderSuggestions();
    renderCourses();
    renderStats();
  }

  /* ==========================================================
     PLANIFICATION D'UNE RÉVISION
  ========================================================== */

  function setRevisionDate(revisionId, date) {
    const revision =
      courseRevisions.find(r => r.id === revisionId);

    if (!revision) return;

    revision.date = date;
    revision.planned = !!date;

    /*
      Si l'utilisateur replanifie une révision précédemment
      retirée des suggestions, elle redevient éligible.
    */
    if (date) {
      revision.dismissed = false;
    }

    saveCourseRevisions();

    renderCourses();
    renderSuggestions();
  }

  function setRevisionNote(revisionId, note) {
    const revision =
      courseRevisions.find(r => r.id === revisionId);

    if (!revision) return;

    revision.note = note;

    saveCourseRevisions();
  }

  /* ==========================================================
     AJOUT D'UN COURS
  ========================================================== */

  function showCourseForm(matiereId) {
    const existing =
      document.getElementById('v2-course-form');

    if (existing) {
      existing.remove();
      return;
    }

    const matiere = matieres.find(m => m.id === matiereId);

    if (!matiere) return;

    const form = document.createElement('div');

    form.id = 'v2-course-form';

    form.className = 'v2-course-form';

    form.innerHTML = `
      <div class="v2-form-title">
        Ajouter un cours à
        <strong>${escape(matiere.name)}</strong>
      </div>

      <input
        id="v2-course-name"
        type="text"
        placeholder="Nom du cours"
        autocomplete="off"
      >

      <input
        id="v2-course-date"
        type="date"
        value="${todayKey()}"
      >

      <input
        id="v2-course-chapters"
        type="text"
        placeholder="Chapitres abordés, séparés par des virgules"
      >

      <div class="v2-form-actions">
        <button id="v2-course-cancel">
          Annuler
        </button>

        <button id="v2-course-save">
          Ajouter le cours
        </button>
      </div>
    `;

    const details =
      document.querySelector(
        `details.matiere-block[data-id="${matiereId}"]`
      );

    if (details) {
      details.appendChild(form);
    } else {
      document
        .getElementById('v2-courses-card')
        ?.appendChild(form);
    }

    document
      .getElementById('v2-course-cancel')
      ?.addEventListener('click', () => {
        form.remove();
      });

    document
      .getElementById('v2-course-save')
      ?.addEventListener('click', () => {
        const name =
          document.getElementById('v2-course-name')
            ?.value.trim();

        const date =
          document.getElementById('v2-course-date')
            ?.value || todayKey();

        const chapters =
          document.getElementById('v2-course-chapters')
            ?.value
            .split(',')
            .map(x => x.trim())
            .filter(Boolean);

        if (!name) {
          alert('Indique le nom du cours.');
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
        renderStats();
      });

    document
      .getElementById('v2-course-name')
      ?.focus();
  }

  /* ==========================================================
     MODIFICATION D'UN COURS
  ========================================================== */

  function editCourse(courseId) {
    const course = getCourse(courseId);

    if (!course) return;

    const newName =
      prompt('Nom du cours :', course.name);

    if (newName === null) return;

    const trimmed = newName.trim();

    if (!trimmed) return;

    course.name = trimmed;

    const newChapters =
      prompt(
        'Chapitres abordés, séparés par des virgules :',
        course.chapters.join(', ')
      );

    if (newChapters !== null) {
      course.chapters =
        newChapters
          .split(',')
          .map(x => x.trim())
          .filter(Boolean);
    }

    saveCourses();

    renderCourses();
    renderSuggestions();

    if (typeof renderCalendar === 'function') {
      renderCalendar();
    }
  }

  /* ==========================================================
     RENDU DES COURS
  ========================================================== */

  function renderCourseRevisionRows(course) {
    const revisions =
      getCourseRevisions(course.id);

    return revisions.map(revision => {
      const late =
        revisionIsLate(revision);

      const optional =
        revision.type === 'j5';

      const disabled =
        !revision.date &&
        !revision.done;

      return `
        <div class="v2-revision-row
          ${revision.done ? 'done' : ''}
          ${late ? 'late' : ''}"
        >

          <div class="v2-revision-label">
            <strong>${revision.label}</strong>

            ${optional
              ? '<span class="v2-optional">optionnel</span>'
              : ''
            }
          </div>

          <input
            type="date"
            value="${revision.date || ''}"
            data-revision-date="${revision.id}"
          >

          <button
            class="v2-revision-check"
            data-revision-done="${revision.id}"
            title="Marquer comme faite"
          >
            ${revision.done ? '✓' : '○'}
          </button>

          <input
            class="v2-revision-note"
            type="text"
            placeholder="Note"
            value="${escape(revision.note || '')}"
            ${disabled ? 'disabled' : ''}
            data-revision-note="${revision.id}"
          >

          <button
            class="v2-dismiss-revision"
            data-dismiss-revision="${revision.id}"
            title="Ne plus suggérer cette révision"
          >
            ×
          </button>

        </div>
      `;
    }).join('');
  }

  function renderCourse(course) {
    const matiere =
      getMatiere(course);

    const revisions =
      getCourseRevisions(course.id);

    const done =
      revisions.filter(r => r.done).length;

    const total =
      revisions.length;

    const chapters =
      course.chapters.length
        ? course.chapters.map(
            chapter =>
              `<span class="v2-chapter">
                ${escape(chapter)}
              </span>`
          ).join('')
        : `<span class="v2-no-chapter">
            Aucun chapitre renseigné
          </span>`;

    return `
      <div
        class="v2-course"
        data-course="${course.id}"
      >

        <div class="v2-course-header">

          <div class="v2-course-title">

            <span
              class="v2-course-color"
              style="background:${matiere?.color || 'var(--accent)'}"
            ></span>

            <div>
              <strong>${escape(course.name)}</strong>

              <div class="v2-course-meta">
                ${matiere
                  ? escape(matiere.name)
                  : 'Matière inconnue'
                }
                · ${formatDateFR(course.date)}
              </div>
            </div>

          </div>

          <div class="v2-course-actions">

            <span class="v2-progress">
              ${done}/${total}
            </span>

            <button
              data-edit-course="${course.id}"
              title="Modifier"
            >
              ✎
            </button>

            <button
              data-delete-course="${course.id}"
              title="Supprimer"
              class="danger"
            >
              🗑
            </button>

          </div>

        </div>

        <div class="v2-chapters">
          ${chapters}
        </div>

        <div class="v2-mastery">
          <span>Maîtrise</span>

          <div class="v2-mastery-dots">
            ${masteryDots(course)}
          </div>

          <span class="v2-mastery-value">
            ${course.mastery || 0}/5
          </span>
        </div>

        <div class="v2-revisions">

          <div class="v2-revisions-title">
            <span>Révisions</span>
            <span>date</span>
            <span>état</span>
            <span>note</span>
            <span></span>
          </div>

          ${renderCourseRevisionRows(course)}

        </div>

      </div>
    `;
  }

  function renderCourses() {
    const container =
      document.getElementById('v2-courses-list');

    if (!container) return;

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

    matieres.forEach(m => {
      grouped[m.id] = [];
    });

    courses.forEach(course => {
      if (!grouped[course.matiereId]) {
        grouped[course.matiereId] = [];
      }

      grouped[course.matiereId].push(course);
    });

    let html = '';

    matieres.forEach(matiere => {
      const list =
        grouped[matiere.id] || [];

      html += `
        <details
          class="v2-matiere"
          data-v2-matiere="${matiere.id}"
          open
        >

          <summary>

            <span
              class="v2-matiere-dot"
              style="background:${matiere.color}"
            ></span>

            <strong>
              ${escape(matiere.name)}
            </strong>

            <span class="v2-matiere-count">
              ${list.length}
              cours
            </span>

            <button
              data-add-course="${matiere.id}"
              class="v2-add-course"
            >
              + Ajouter un cours
            </button>

          </summary>

          <div class="v2-matiere-courses">

            ${
              list.length
                ? list
                    .sort((a,b) =>
                      a.date.localeCompare(b.date)
                    )
                    .map(renderCourse)
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
    });

    container.innerHTML = html;

    bindCourseEvents();
  }

  function bindCourseEvents() {
    const container =
      document.getElementById('v2-courses-list');

    if (!container) return;

    container
      .querySelectorAll('[data-add-course]')
      .forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();

          showCourseForm(
            button.dataset.addCourse
          );
        });
      });

    container
      .querySelectorAll('[data-delete-course]')
      .forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();

          const course =
            getCourse(button.dataset.deleteCourse);

          if (!course) return;

          if (
            confirm(
              `Supprimer le cours « ${course.name} » ?`
            )
          ) {
            deleteCourse(course.id);

            renderCourses();
            renderSuggestions();
            renderStats();

            if (
              typeof renderCalendar === 'function'
            ) {
              renderCalendar();
            }
          }
        });
      });

    container
      .querySelectorAll('[data-edit-course]')
      .forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();

          editCourse(
            button.dataset.editCourse
          );
        });
      });

    container
      .querySelectorAll('[data-course-mastery]')
      .forEach(button => {
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();

          setCourseMastery(
            button.dataset.courseMastery,
            button.dataset.level
          );
        });
      });

    container
      .querySelectorAll('[data-revision-date]')
      .forEach(input => {
        input.addEventListener('change', () => {
          setRevisionDate(
            input.dataset.revisionDate,
            input.value
          );
        });
      });

    container
      .querySelectorAll('[data-revision-done]')
      .forEach(button => {
        button.addEventListener('click', () => {
          completeRevision(
            button.dataset.revisionDone
          );
        });
      });

    container
      .querySelectorAll('[data-revision-note]')
      .forEach(input => {
        input.addEventListener('change', () => {
          setRevisionNote(
            input.dataset.revisionNote,
            input.value
          );
        });
      });

    container
      .querySelectorAll('[data-dismiss-revision]')
      .forEach(button => {
        button.addEventListener('click', () => {
          dismissRevision(
            button.dataset.dismissRevision
          );
        });
      });
  }

  /* ==========================================================
     SUGGESTIONS
  ========================================================== */

  function renderSuggestions() {
    const container =
      document.getElementById('v2-suggestions');

    if (!container) return;

    const suggestions =
      courseRevisions
        .filter(isSuggestionEligible)
        .sort((a,b) =>
          a.date.localeCompare(b.date)
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
      suggestions.map(revision => {
        const course =
          getCourse(revision.courseId);

        if (!course) return '';

        const matiere =
          getMatiere(course);

        const late =
          revisionIsLate(revision);

        const delay =
          daysLate(revision);

        return `
          <div class="v2-suggestion">

            <div class="v2-suggestion-main">

              <span
                class="v2-suggestion-color"
                style="background:${matiere?.color || 'var(--accent)'}"
              ></span>

              <div>

                <strong>
                  ${escape(course.name)}
                </strong>

                <div class="v2-suggestion-sub">
                  ${escape(revision.label)}

                  ·

                  ${
                    late
                      ? `en retard de ${delay} jour${delay > 1 ? 's' : ''}`
                      : `prévue le ${formatDateFR(revision.date)}`
                  }
                </div>

                ${
                  course.chapters.length
                    ? `
                      <div class="v2-suggestion-chapters">
                        ${course.chapters
                          .map(c => escape(c))
                          .join(' · ')}
                      </div>
                    `
                    : ''
                }

              </div>

            </div>

            <div class="v2-suggestion-actions">

              <button
                data-plan-revision="${revision.id}"
              >
                Replanifier
              </button>

              <button
                data-do-revision="${revision.id}"
                class="primary"
              >
                Faire
              </button>

              <button
                data-remove-suggestion="${revision.id}"
                class="quiet"
              >
                Ne plus suggérer
              </button>

            </div>

          </div>
        `;
      }).join('');

    container
      .querySelectorAll('[data-do-revision]')
      .forEach(button => {
        button.addEventListener('click', () => {
          completeRevision(
            button.dataset.doRevision
          );
        });
      });

    container
      .querySelectorAll('[data-remove-suggestion]')
      .forEach(button => {
        button.addEventListener('click', () => {
          dismissRevision(
            button.dataset.removeSuggestion
          );
        });
      });

    container
      .querySelectorAll('[data-plan-revision]')
      .forEach(button => {
        button.addEventListener('click', () => {
          const revision =
            courseRevisions.find(
              r =>
                r.id ===
                button.dataset.planRevision
            );

          if (!revision) return;

          const date =
            prompt(
              'Nouvelle date (AAAA-MM-JJ) :',
              todayKey()
            );

          if (!date) return;

          setRevisionDate(
            revision.id,
            date
          );
        });
      });
  }

  /* ==========================================================
     STATISTIQUES
  ========================================================== */

  function renderStats() {
    const container =
      document.getElementById('v2-stats');

    if (!container) return;

    const today =
      parseDate(todayKey());

    let totalMinutes = 0;
    let todayMinutes = 0;

    const daily = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);

      d.setDate(
        today.getDate() - (6 - i)
      );

      daily[dateToKey(d)] = 0;
    }

    /* Blocs calendrier */
    if (Array.isArray(placements)) {
      placements.forEach(p => {
        if (!p) return;

        const date =
          p.date ||
          (
            p.week &&
            typeof p.day === 'number'
              ? addDaysToKey(
                  p.week,
                  p.day
                )
              : ''
          );

        if (!date) return;

        const duration =
          Number(p.durMin) || 0;

        if (date === todayKey()) {
          todayMinutes += duration;
        }

        totalMinutes += duration;

        if (daily[date] !== undefined) {
          daily[date] += duration;
        }
      });
    }

    const weekMinutes =
      Object.values(daily)
        .reduce((sum, x) => sum + x, 0);

    const max =
      Math.max(
        1,
        ...Object.values(daily)
      );

    const bars =
      Object.entries(daily)
        .map(([date, minutes]) => {
          const d =
            parseDate(date);

          const height =
            Math.max(
              4,
              Math.round(
                minutes / max * 100
              )
            );

          return `
            <div class="v2-stat-day">

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
                ${d.toLocaleDateString(
                  'fr-FR',
                  { weekday: 'short' }
                ).slice(0,2)}
              </span>

            </div>
          `;
        })
        .join('');

    const hours =
      Math.floor(weekMinutes / 60);

    const minutes =
      weekMinutes % 60;

    container.innerHTML = `
      <div class="v2-stat-cards">

        <div class="v2-stat-card">
          <span>Cette semaine</span>
          <strong>
            ${hours}h${String(minutes).padStart(2,'0')}
          </strong>
        </div>

        <div class="v2-stat-card">
          <span>Aujourd'hui</span>
          <strong>
            ${Math.floor(todayMinutes / 60)}h${String(todayMinutes % 60).padStart(2,'0')}
          </strong>
        </div>

        <div class="v2-stat-card">
          <span>Cours</span>
          <strong>
            ${courses.length}
          </strong>
        </div>

        <div class="v2-stat-card">
          <span>Révisions faites</span>
          <strong>
            ${courseRevisions.filter(r => r.done).length}
          </strong>
        </div>

      </div>

      <div class="v2-chart">
        ${bars}
      </div>
    `;
  }

  /* ==========================================================
     POMODORO
  ========================================================== */

  function renderPomodoro() {
    const container =
      document.getElementById('v2-pomodoro');

    if (!container) return;

    const total =
      pomodoro.duration * 60;

    const remaining =
      Math.max(
        0,
        pomodoro.remaining
      );

    const minutes =
      Math.floor(remaining / 60);

    const seconds =
      remaining % 60;

    const progress =
      total
        ? ((total - remaining) / total) * 100
        : 0;

    container.innerHTML = `
      <div class="v2-pomodoro-inner">

        <div class="v2-pomodoro-mode">
          ${pomodoro.mode === 'travail'
            ? 'Session de travail'
            : 'Pause'}
        </div>

        <div class="v2-pomodoro-time">
          ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}
        </div>

        <div class="v2-pomodoro-progress">
          <div
            style="width:${progress}%"
          ></div>
        </div>

        <div class="v2-pomodoro-controls">

          <button
            id="v2-pomodoro-start"
            class="primary"
          >
            ${pomodoro.running
              ? 'Pause'
              : 'Démarrer'}
          </button>

          <button
            id="v2-pomodoro-reset"
          >
            Réinitialiser
          </button>

        </div>

        <div class="v2-pomodoro-duration">

          <label>
            Durée
          </label>

          <select id="v2-pomodoro-duration">

            <option value="15"
              ${pomodoro.duration === 15 ? 'selected' : ''}>
              15 min
            </option>

            <option value="20"
              ${pomodoro.duration === 20 ? 'selected' : ''}>
              20 min
            </option>

            <option value="25"
              ${pomodoro.duration === 25 ? 'selected' : ''}>
              25 min
            </option>

            <option value="30"
              ${pomodoro.duration === 30 ? 'selected' : ''}>
              30 min
            </option>

            <option value="45"
              ${pomodoro.duration === 45 ? 'selected' : ''}>
              45 min
            </option>

            <option value="60"
              ${pomodoro.duration === 60 ? 'selected' : ''}>
              60 min
            </option>

          </select>

        </div>

      </div>
    `;

    document
      .getElementById('v2-pomodoro-start')
      ?.addEventListener(
        'click',
        togglePomodoro
      );

    document
      .getElementById('v2-pomodoro-reset')
      ?.addEventListener(
        'click',
        resetPomodoro
      );

    document
      .getElementById('v2-pomodoro-duration')
      ?.addEventListener(
        'change',
        event => {
          const duration =
            Number(event.target.value);

          pomodoro.duration =
            duration;

          pomodoro.remaining =
            duration * 60;

          savePomodoro();
          renderPomodoro();
        }
      );
  }

  function togglePomodoro() {
    if (pomodoro.running) {
      stopPomodoro();
    } else {
      startPomodoro();
    }
  }

  function startPomodoro() {
    if (pomodoroInterval) return;

    pomodoro.running = true;

    renderPomodoro();

    pomodoroInterval =
      setInterval(() => {

        if (pomodoro.remaining <= 0) {
          stopPomodoro();

          if (
            pomodoro.mode === 'travail'
          ) {
            pomodoro.mode = 'pause';
            pomodoro.remaining = 5 * 60;
          } else {
            pomodoro.mode = 'travail';
            pomodoro.remaining =
              pomodoro.duration * 60;
          }

          savePomodoro();
          renderPomodoro();

          return;
        }

        pomodoro.remaining--;

        if (
          pomodoro.remaining % 5 === 0
        ) {
          savePomodoro();
        }

        renderPomodoro();

      }, 1000);
  }

  function stopPomodoro() {
    pomodoro.running = false;

    if (pomodoroInterval) {
      clearInterval(
        pomodoroInterval
      );

      pomodoroInterval = null;
    }

    savePomodoro();
    renderPomodoro();
  }

  function resetPomodoro() {
    stopPomodoro();

    pomodoro.mode = 'travail';
    pomodoro.remaining =
      pomodoro.duration * 60;

    savePomodoro();
    renderPomodoro();
  }

  /* ==========================================================
     CALENDRIER — SUPPORT DES COURS
  ========================================================== */

  function getCalendarCourse(id) {
    return courses.find(
      c => c.id === id
    );
  }

  /*
    On étend la fonction refFor existante pour que les blocs
    "course" soient compris par le calendrier actuel.
  */
  const originalRefFor =
    window.refFor;

  window.refFor = function(p) {
    if (
      p &&
      p.type === 'course'
    ) {
      return getCalendarCourse(
        p.refId
      );
    }

    if (
      typeof originalRefFor === 'function'
    ) {
      return originalRefFor(p);
    }

    return null;
  };

  /*
    Modification de l'affichage du nom dans le calendrier.
    Le cours est maintenant l'élément principal.
  */
  function patchCalendarCourseDisplay() {
    if (!Array.isArray(placements)) return;

    placements
      .filter(
        p => p.type === 'course'
      )
      .forEach(p => {
        const element =
          document.querySelector(
            `.cal-block[data-pid="${p.id}"]`
          );

        if (!element) return;

        const course =
          getCalendarCourse(
            p.refId
          );

        if (!course) return;

        const title =
          element.querySelector('.n');

        const detail =
          element.querySelector('.d');

        if (title) {
          title.textContent =
            course.name;
        }

        if (
          detail &&
          course.chapters.length
        ) {
          detail.textContent =
            course.chapters.join(' · ');
        }
      });
  }

  /* ==========================================================
     POPOVER CALENDRIER POUR LES COURS
  ========================================================== */

  const originalOpenAddPopover =
    window.openAddPopover;

  window.openAddPopover =
    function(e, day, startMin) {

      if (
        typeof originalOpenAddPopover ===
        'function'
      ) {
        originalOpenAddPopover(
          e,
          day,
          startMin
        );
      }

      setTimeout(() => {

        const pop =
          document.getElementById('pop');

        if (!pop) return;

        if (!courses.length) return;

        const group =
          document.createElement('div');

        group.className =
          'v2-calendar-course-group';

        group.innerHTML = `
          <div class="grouplabel">
            Cours
          </div>
        `;

        courses
          .sort((a,b) =>
            a.date.localeCompare(b.date)
          )
          .forEach(course => {

            const row =
              document.createElement('div');

            row.className =
              'pop-row v2-calendar-course-row';

            const matiere =
              getMatiere(course);

            row.innerHTML = `
              <span
                class="v2-calendar-course-dot"
                style="background:${matiere?.color || 'var(--accent)'}"
              ></span>

              <span class="pop-name">
                ${escape(course.name)}
              </span>

              <input
                type="number"
                min="20"
                step="5"
                value="60"
                class="pop-num"
                data-course-duration="${course.id}"
              >

              <button
                class="pop-place"
                data-place-course="${course.id}"
              >
                ${typeof icon === 'function'
                  ? icon('check')
                  : '✓'}
              </button>
            `;

            group.appendChild(row);
          });

        pop.appendChild(group);

        group
          .querySelectorAll(
            '[data-place-course]'
          )
          .forEach(button => {

            button.addEventListener(
              'click',
              event => {

                event.stopPropagation();

                const courseId =
                  button.dataset.placeCourse;

                const input =
                  group.querySelector(
                    `[data-course-duration="${courseId}"]`
                  );

                const duration =
                  Math.max(
                    20,
                    Number(
                      input?.value || 60
                    )
                  );

                const placement = {
                  id:
                    typeof uid === 'function'
                      ? uid('pl')
                      : courseUid(),

                  type: 'course',

                  refId:
                    courseId,

                  day,

                  startMin,

                  durMin:
                    duration,

                  week:
                    typeof currentWeekKey ===
                    'function'
                      ? currentWeekKey()
                      : ''
                };

                if (
                  typeof clearOverlaps ===
                  'function'
                ) {
                  clearOverlaps(
                    placement
                  );
                }

                placements.push(
                  placement
                );

                if (
                  typeof savePlacements ===
                  'function'
                ) {
                  savePlacements();
                }

                if (
                  typeof closePopover ===
                  'function'
                ) {
                  closePopover();
                }

                if (
                  typeof renderCalendar ===
                  'function'
                ) {
                  renderCalendar();
                }
              }
            );
          });

      }, 0);
    };

  /* ==========================================================
     INJECTION DE L'INTERFACE V2
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
      document.createElement('style');

    style.id =
      'planning-v2-styles';

    style.textContent = `

      /* ==========================================
         COURS
      ========================================== */

      #v2-courses-card,
      #v2-suggestions-card,
      #v2-stats-card,
      #v2-pomodoro-card {
        background:var(--paper);
        border:1px solid var(--line);
        border-radius:14px;
        padding:18px 20px 22px;
        margin-bottom:22px;
      }

      .v2-course {
        border:1px solid var(--line);
        border-radius:12px;
        margin:12px 0;
        overflow:hidden;
        background:var(--paper);
      }

      .v2-course-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px 14px;
        background:var(--paper-soft);
      }

      .v2-course-title {
        display:flex;
        align-items:center;
        gap:10px;
        min-width:0;
      }

      .v2-course-color {
        width:10px;
        height:10px;
        border-radius:50%;
        flex:none;
      }

      .v2-course-title strong {
        font-size:14px;
      }

      .v2-course-meta {
        font-size:11px;
        color:var(--ink-soft);
        margin-top:3px;
      }

      .v2-course-actions {
        display:flex;
        align-items:center;
        gap:5px;
        flex:none;
      }

      .v2-course-actions button,
      .v2-matiere summary button,
      .v2-suggestion-actions button,
      .v2-pomodoro-controls button,
      .v2-form-actions button {
        border:1px solid var(--line-strong);
        background:var(--paper);
        color:var(--ink);
        border-radius:7px;
        padding:6px 9px;
        cursor:pointer;
        font-family:inherit;
        font-size:12px;
      }

      .v2-course-actions button:hover,
      .v2-suggestion-actions button:hover,
      .v2-pomodoro-controls button:hover,
      .v2-form-actions button:hover {
        background:var(--paper-soft);
      }

      .v2-course-actions .danger {
        color:var(--danger);
      }

      .v2-progress {
        color:var(--accent);
        font-size:11px;
        font-weight:500;
        margin-right:4px;
      }

      .v2-chapters {
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        padding:10px 14px;
      }

      .v2-chapter {
        padding:4px 8px;
        border-radius:999px;
        background:var(--accent-soft);
        color:var(--accent);
        font-size:11px;
      }

      .v2-no-chapter {
        font-size:11px;
        color:var(--ink-soft);
      }

      .v2-mastery {
        display:flex;
        align-items:center;
        gap:9px;
        padding:8px 14px;
        border-top:1px solid var(--line);
        border-bottom:1px solid var(--line);
        font-size:11.5px;
        color:var(--ink-soft);
      }

      .v2-mastery-dots {
        display:flex;
        gap:5px;
      }

      .v2-mastery-dot {
        width:14px;
        height:14px;
        border-radius:50%;
        border:1px solid var(--line-strong);
        background:transparent;
        cursor:pointer;
        padding:0;
      }

      .v2-mastery-dot.active {
        background:var(--accent);
        border-color:var(--accent);
      }

      .v2-mastery-value {
        color:var(--ink);
      }

      .v2-revisions {
        padding:8px 10px 12px;
      }

      .v2-revisions-title,
      .v2-revision-row {
        display:grid;
        grid-template-columns:
          90px
          130px
          45px
          minmax(100px,1fr)
          30px;
        gap:7px;
        align-items:center;
      }

      .v2-revisions-title {
        color:var(--ink-soft);
        font-size:10px;
        text-transform:uppercase;
        padding:4px 5px;
      }

      .v2-revision-row {
        padding:5px;
        border-top:1px solid var(--line);
      }

      .v2-revision-row.late {
        background:rgba(224,100,95,.06);
      }

      .v2-revision-row.done {
        opacity:.62;
      }

      .v2-revision-label {
        font-size:12px;
      }

      .v2-optional {
        display:block;
        color:var(--ink-soft);
        font-size:9px;
        margin-top:2px;
      }

      .v2-revision-row input {
        width:100%;
        min-width:0;
        border:1px solid transparent;
        background:transparent;
        color:var(--ink);
        border-radius:6px;
        padding:5px 6px;
        font-family:inherit;
        font-size:11.5px;
      }

      .v2-revision-row input:hover {
        border-color:var(--line-strong);
      }

      .v2-revision-row input:focus {
        outline:none;
        border-color:var(--accent);
        background:var(--paper-soft);
      }

      .v2-revision-row input:disabled {
        opacity:.4;
        cursor:not-allowed;
      }

      .v2-revision-check {
        width:28px;
        height:28px;
        border-radius:7px;
        border:1px solid var(--line-strong);
        background:var(--paper);
        color:var(--accent);
        cursor:pointer;
        font-size:16px;
      }

      .v2-revision-check:hover {
        background:var(--accent-soft);
      }

      .v2-dismiss-revision {
        border:none;
        background:none;
        color:var(--ink-soft);
        cursor:pointer;
        font-size:17px;
        padding:4px;
      }

      .v2-dismiss-revision:hover {
        color:var(--danger);
      }

      /* ==========================================
         MATIÈRES
      ========================================== */

      .v2-matiere {
        border-bottom:1px solid var(--line);
        padding:5px 0;
      }

      .v2-matiere:last-child {
        border-bottom:none;
      }

      .v2-matiere summary {
        display:flex;
        align-items:center;
        gap:9px;
        cursor:pointer;
        padding:9px 3px;
        list-style:none;
      }

      .v2-matiere summary::-webkit-details-marker {
        display:none;
      }

      .v2-matiere-dot {
        width:9px;
        height:9px;
        border-radius:50%;
        flex:none;
      }

      .v2-matiere-count {
        color:var(--ink-soft);
        font-size:10.5px;
      }

      .v2-add-course {
        margin-left:auto;
      }

      .v2-matiere-courses {
        padding:0 2px 8px;
      }

      .v2-empty,
      .v2-empty-small {
        color:var(--ink-soft);
        font-size:12px;
        line-height:1.6;
        padding:12px 4px;
      }

      .v2-empty-small {
        padding:8px 4px 12px;
      }

      /* ==========================================
         FORMULAIRE
      ========================================== */

      .v2-course-form {
        border:1px solid var(--line-strong);
        border-radius:10px;
        padding:12px;
        margin:8px 0 10px;
        background:var(--paper-soft);
      }

      .v2-form-title {
        font-size:12px;
        margin-bottom:9px;
      }

      .v2-course-form input {
        width:100%;
        margin-bottom:7px;
        border:1px solid var(--line-strong);
        border-radius:7px;
        background:var(--paper);
        color:var(--ink);
        padding:8px;
        font-family:inherit;
        font-size:12px;
      }

      .v2-form-actions {
        display:flex;
        justify-content:flex-end;
        gap:7px;
        margin-top:5px;
      }

      .v2-form-actions button:last-child {
        background:var(--accent);
        border-color:var(--accent);
        color:#08130F;
      }

      /* ==========================================
         SUGGESTIONS
      ========================================== */

      .v2-suggestion {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        border-bottom:1px solid var(--line);
        padding:11px 3px;
      }

      .v2-suggestion:last-child {
        border-bottom:none;
      }

      .v2-suggestion-main {
        display:flex;
        align-items:flex-start;
        gap:9px;
        min-width:0;
      }

      .v2-suggestion-color {
        width:9px;
        height:9px;
        border-radius:50%;
        margin-top:5px;
        flex:none;
      }

      .v2-suggestion-main strong {
        font-size:12.5px;
      }

      .v2-suggestion-sub {
        color:var(--ink-soft);
        font-size:10.5px;
        margin-top:2px;
      }

      .v2-suggestion-chapters {
        color:var(--ink-soft);
        font-size:10px;
        margin-top:3px;
      }

      .v2-suggestion-actions {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .v2-suggestion-actions .primary,
      .v2-pomodoro-controls .primary {
        background:var(--accent);
        border-color:var(--accent);
        color:#08130F;
      }

      .v2-suggestion-actions .quiet {
        color:var(--ink-soft);
      }

      /* ==========================================
         STATISTIQUES
      ========================================== */

      .v2-stat-cards {
        display:grid;
        grid-template-columns:
          repeat(4, minmax(0,1fr));
        gap:9px;
      }

      .v2-stat-card {
        border:1px solid var(--line);
        border-radius:10px;
        padding:11px;
        background:var(--paper-soft);
      }

      .v2-stat-card span {
        display:block;
        font-size:10px;
        color:var(--ink-soft);
        margin-bottom:5px;
      }

      .v2-stat-card strong {
        font-family:"Fraunces",serif;
        font-size:18px;
      }

      .v2-chart {
        height:150px;
        display:flex;
        align-items:stretch;
        gap:8px;
        margin-top:16px;
        border-bottom:1px solid var(--line-strong);
        padding:0 5px;
      }

      .v2-stat-day {
        flex:1;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        align-items:center;
        gap:5px;
        min-width:0;
      }

      .v2-stat-bar-wrap {
        height:125px;
        width:100%;
        display:flex;
        align-items:flex-end;
      }

      .v2-stat-bar {
        width:100%;
        min-height:4px;
        border-radius:5px 5px 0 0;
        background:var(--accent);
        opacity:.75;
      }

      .v2-stat-day span {
        font-size:9px;
        color:var(--ink-soft);
      }

      /* ==========================================
         POMODORO
      ========================================== */

      .v2-pomodoro-inner {
        max-width:460px;
      }

      .v2-pomodoro-mode {
        color:var(--ink-soft);
        font-size:11px;
      }

      .v2-pomodoro-time {
        font-family:"Fraunces",serif;
        font-size:42px;
        margin:7px 0;
      }

      .v2-pomodoro-progress {
        height:5px;
        border-radius:999px;
        background:var(--paper-soft);
        overflow:hidden;
      }

      .v2-pomodoro-progress div {
        height:100%;
        background:var(--accent);
      }

      .v2-pomodoro-controls {
        display:flex;
        gap:7px;
        margin-top:12px;
      }

      .v2-pomodoro-duration {
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:12px;
        font-size:11px;
        color:var(--ink-soft);
      }

      .v2-pomodoro-duration select {
        border:1px solid var(--line-strong);
        background:var(--paper);
        color:var(--ink);
        border-radius:7px;
        padding:5px 8px;
      }

      /* ==========================================
         CALENDRIER
      ========================================== */

      .v2-calendar-course-group {
        margin-top:8px;
        border-top:1px solid var(--line);
        padding-top:4px;
      }

      .v2-calendar-course-row {
        padding:5px 6px;
      }

      .v2-calendar-course-dot {
        width:8px;
        height:8px;
        border-radius:50%;
        flex:none;
      }

      /* ==========================================
         MOBILE
      ========================================== */

      @media(max-width:700px) {

        .v2-revisions-title {
          display:none;
        }

        .v2-revision-row {
          grid-template-columns:
            70px
            1fr
            34px
            1fr
            28px;
        }

        .v2-stat-cards {
          grid-template-columns:
            repeat(2,minmax(0,1fr));
        }

        .v2-suggestion {
          flex-direction:column;
          align-items:stretch;
        }

        .v2-suggestion-actions {
          justify-content:flex-start;
        }

        .v2-course-header {
          align-items:flex-start;
        }

        .v2-course-actions {
          flex-wrap:wrap;
          justify-content:flex-end;
        }
      }

    `;

    document.head.appendChild(style);
  }

  /* ==========================================================
     INJECTION DES CARTES
  ========================================================== */

  function injectCards() {
    if (
      document.getElementById(
        'v2-courses-card'
      )
    ) {
      return;
    }

    const matieresCard =
      document
        .getElementById('matieresList')
        ?.closest('.card');

    if (!matieresCard) {
      return;
    }

    /*
      On remplace visuellement l'ancien suivi par matière
      par notre nouvelle structure, tout en laissant l'ancien
      HTML intact dans le document.
    */

    matieresCard.style.display = 'none';

    const coursesCard =
      document.createElement('div');

    coursesCard.id =
      'v2-courses-card';

    coursesCard.innerHTML = `
      <h2>📚 Mes cours</h2>

      <p class="hint">
        Chaque cours correspond à une heure de cours.
        Tu peux lui associer plusieurs chapitres et suivre
        toutes ses révisions J-0, J-1, J-3, J-5 et J-7.
      </p>

      <div id="v2-courses-list"></div>
    `;

    matieresCard.parentNode.insertBefore(
      coursesCard,
      matieresCard
    );

    /* Suggestions */
    const suggestionsCard =
      document.createElement('div');

    suggestionsCard.id =
      'v2-suggestions-card';

    suggestionsCard.innerHTML = `
      <h2>🔄 À revoir prochainement</h2>

      <p class="hint">
        Ces révisions sont proposées automatiquement.
        Tu peux les faire, les replanifier ou choisir de
        ne plus les suggérer.
      </p>

      <div id="v2-suggestions"></div>
    `;

    coursesCard.parentNode.insertBefore(
      suggestionsCard,
      matieresCard
    );

    /* Statistiques */
    const statsCard =
      document.createElement('div');

    statsCard.id =
      'v2-stats-card';

    statsCard.innerHTML = `
      <h2>📊 Statistiques</h2>

      <p class="hint">
        Temps de travail enregistré dans le planning
        au cours des sept derniers jours.
      </p>

      <div id="v2-stats"></div>
    `;

    coursesCard.parentNode.insertBefore(
      statsCard,
      matieresCard
    );

    /* Pomodoro */
    const pomodoroCard =
      document.createElement('div');

    pomodoroCard.id =
      'v2-pomodoro-card';

    pomodoroCard.innerHTML = `
      <h2>🍅 Pomodoro</h2>

      <p class="hint">
        Minuteur indépendant du planning.
        Il ne modifie pas tes blocs.
      </p>

      <div id="v2-pomodoro"></div>
    `;

    coursesCard.parentNode.insertBefore(
      pomodoroCard,
      matieresCard
    );
  }

  /* ==========================================================
     EXPORT / IMPORT V2
  ========================================================== */

  function patchExportImport() {
    const exportButton =
      document.getElementById(
        'exportBtn'
      );

    if (
      exportButton &&
      !exportButton.dataset.v2Patched
    ) {
      exportButton.dataset.v2Patched =
        'true';

      exportButton.addEventListener(
        'click',
        () => {
          /*
            Le système existant exporte déjà les clés
            principales. Nous ajoutons les données V2
            dans le même fichier juste avant le téléchargement.
          */

          const payload = {};

          [
            'pr_matieres',
            'pr_blocks',
            'pr_placements',
            'pr_revisions',
            'pr_annales',
            'pr_todos',
            'pr_theme',
            COURSE_KEY,
            REVISION_KEY,
            POMODORO_KEY
          ].forEach(key => {
            const value =
              localStorage.getItem(key);

            if (value !== null) {
              payload[key] = value;
            }
          });

          /*
            L'ancien bouton peut avoir déjà généré un fichier.
            Nous créons également notre sauvegarde V2 avec
            toutes les données.
          */

          setTimeout(() => {

            const blob =
              new Blob(
                [
                  JSON.stringify(
                    payload,
                    null,
                    2
                  )
                ],
                {
                  type:
                    'application/json'
                }
              );

            const url =
              URL.createObjectURL(
                blob
              );

            const a =
              document.createElement(
                'a'
              );

            a.href = url;

            a.download =
              'sauvegarde-planning-pass.json';

            document.body.appendChild(
              a
            );

            a.click();

            a.remove();

            URL.revokeObjectURL(
              url
            );

          }, 50);
        }
      );
    }

    const importButton =
      document.getElementById(
        'importBtn'
      );

    if (
      importButton &&
      !importButton.dataset.v2Patched
    ) {
      importButton.dataset.v2Patched =
        'true';

      /*
        Le système d'import existant remet déjà
        toutes les clés présentes dans le JSON.
        Les nouvelles clés V2 sont donc automatiquement
        restaurées.
      */
    }
  }

  /* ==========================================================
     OBSERVATION DES MODIFICATIONS
  ========================================================== */

  function refreshAfterCalendarChange() {
    setTimeout(() => {
      renderStats();
      patchCalendarCourseDisplay();
    }, 100);
  }

  function observeCalendar() {
    const calendar =
      document.getElementById(
        'calDays'
      );

    if (!calendar) return;

    const observer =
      new MutationObserver(() => {
        patchCalendarCourseDisplay();
        renderStats();
      });

    observer.observe(
      calendar,
      {
        childList: true,
        subtree: true
      }
    );
  }

  /* ==========================================================
     INITIALISATION
  ========================================================== */

  function initV2() {
    loadV2Data();

    injectStyles();
    injectCards();

    renderCourses();
    renderSuggestions();
    renderStats();
    renderPomodoro();

    patchExportImport();

    observeCalendar();

    patchCalendarCourseDisplay();

    /*
      Rafraîchissement léger pour que les statistiques
      suivent les changements du planning existant.
    */
    setInterval(() => {
      renderStats();
      renderSuggestions();
    }, 5000);
  }

  /*
    Le script est chargé après le script principal,
    donc le DOM et les variables principales existent déjà.
  */
  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initV2
    );
  } else {
    initV2();
  }

})();
