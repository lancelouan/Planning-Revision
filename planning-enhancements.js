/* ============================================================
   PLANNING RÉVISION — VERSION 6
   ============================================================
   Architecture :

   Matière
      ↓
   Cours
      ↓
   Chapitres
      ↓
   Révisions
      ↓
   Calendrier
      ↓
   Révision terminée
      ↓
   Statistiques

   LocalStorage uniquement.
   Aucun Supabase.
   Aucun compte.
   ============================================================ */

(() => {
'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */

const STORAGE = {
  subjects: 'pr_v2_subjects',
  courses: 'pr_v2_courses',
  revisions: 'pr_v2_revisions',
  placements: 'pr_v2_placements',
  todos: 'pr_v2_todos',
  blocks: 'pr_v2_blocks',
  theme: 'pr_theme',
  pomodoro: 'pr_v2_pomodoro'
};

const DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche'
];

const REVISION_TYPES = [
  { key:'j0', label:'J-0', offset:0 },
  { key:'j1', label:'J-1', offset:1 },
  { key:'j3', label:'J-3', offset:3 },
  { key:'j5', label:'J-5', offset:5 },
  { key:'j7', label:'J-7', offset:7 }
];

const FREE_REVISION_COUNT = 4;

const QUOTES = [
  'La régularité compte davantage que les journées parfaites.',
  'Une petite session aujourd’hui vaut mieux qu’une grande session repoussée.',
  'Comprendre une notion est plus utile que simplement la relire.',
  'Chaque révision rend la suivante plus facile.',
  'Travaille à ton rythme, mais avance.',
  'Le but n’est pas de tout savoir immédiatement, mais de construire progressivement.'
];

/* ============================================================
   ÉTAT
   ============================================================ */

let subjects = [];
let courses = [];
let revisions = [];
let placements = [];
let todos = [];
let blocks = [];

let currentWeekStart = getMonday(new Date());
let mobileDayIndex = Math.max(0, (new Date().getDay() + 6) % 7);

let draggedPlacementId = null;
let currentlyDragging = false;

let timerSeconds = 25 * 60;
let timerRunning = false;
let timerInterval = null;

/* ============================================================
   UTILITAIRES
   ============================================================ */

function uid(prefix='id'){
  return prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2,8);
}

function save(key,value){
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key,fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}

function escapeHTML(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function formatDate(date){
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR',{
    day:'2-digit',
    month:'2-digit',
    year:'numeric'
  });
}

function isoDate(date){
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function parseDate(value){
  const d = new Date(value + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function addDays(date,n){
  const d = new Date(date);
  d.setDate(d.getDate()+n);
  return d;
}

function daysBetween(a,b){
  const da = new Date(a);
  const db = new Date(b);

  da.setHours(0,0,0,0);
  db.setHours(0,0,0,0);

  return Math.round((db-da)/86400000);
}

function getMonday(date){
  const d = new Date(date);
  d.setHours(12,0,0,0);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1-day;

  d.setDate(d.getDate()+diff);
  return d;
}

function weekKey(date){
  return isoDate(getMonday(date));
}

function sameWeek(a,b){
  return weekKey(a) === weekKey(b);
}

function minutesToTime(min){
  const h = Math.floor(min/60);
  const m = min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function clamp(value,min,max){
  return Math.min(Math.max(value,min),max);
}

function getSubject(id){
  return subjects.find(s => s.id === id);
}

function getCourse(id){
  return courses.find(c => c.id === id);
}

function getRevision(id){
  return revisions.find(r => r.id === id);
}

function getBlock(id){
  return blocks.find(b => b.id === id);
}

function saveAll(){
  save(STORAGE.subjects,subjects);
  save(STORAGE.courses,courses);
  save(STORAGE.revisions,revisions);
  save(STORAGE.placements,placements);
  save(STORAGE.todos,todos);
  save(STORAGE.blocks,blocks);
}

/* ============================================================
   INITIALISATION
   ============================================================ */

function loadData(){

  subjects = loadJSON(STORAGE.subjects,[]);
  courses = loadJSON(STORAGE.courses,[]);
  revisions = loadJSON(STORAGE.revisions,[]);
  placements = loadJSON(STORAGE.placements,[]);
  todos = loadJSON(STORAGE.todos,[]);
  blocks = loadJSON(STORAGE.blocks,[]);

  /*
    Migration propre :
    si aucune matière V2 n'existe, on crée les matières de base.
  */

  if(!Array.isArray(subjects) || subjects.length === 0){
    subjects = [
      {id:uid('sub_'),name:'Chimie-Biochimie',color:'#7c3aed'},
      {id:uid('sub_'),name:'Chimie',color:'#2563eb'},
      {id:uid('sub_'),name:'Biologie Cellulaire',color:'#059669'},
      {id:uid('sub_'),name:'Physique-Biophysique',color:'#0891b2'},
      {id:uid('sub_'),name:'Anatomie OS',color:'#dc2626'},
      {id:uid('sub_'),name:'Anatomie TC',color:'#ea580c'},
      {id:uid('sub_'),name:'Bio. moléculaire-Génétique',color:'#db2777'},
      {id:uid('sub_'),name:'Histologie-Embryologie',color:'#9333ea'},
      {id:uid('sub_'),name:'Physiologie',color:'#16a34a'},
      {id:uid('sub_'),name:'Sciences Humaines et Sociales',color:'#ca8a04'}
    ];

    save(STORAGE.subjects,subjects);
  }

  if(!Array.isArray(blocks) || blocks.length === 0){
    blocks = [
      {id:uid('blk_'),name:'Pause',color:'#d1d5db',work:false},
      {id:uid('blk_'),name:'Repas',color:'#fde68a',work:false},
      {id:uid('blk_'),name:'Cours',color:'#bfdbfe',work:true},
      {id:uid('blk_'),name:'Sport',color:'#bbf7d0',work:false},
      {id:uid('blk_'),name:'Sommeil',color:'#c4b5fd',work:false},
      {id:uid('blk_'),name:'Retard',color:'#fecaca',work:true},
      {id:uid('blk_'),name:'Entraînement',color:'#fed7aa',work:true}
    ];

    save(STORAGE.blocks,blocks);
  }

  /*
    Repartir proprement si une ancienne version utilisait
    les anciens noms de propriétés.
  */

  courses = Array.isArray(courses) ? courses : [];
  revisions = Array.isArray(revisions) ? revisions : [];
  placements = Array.isArray(placements) ? placements : [];
  todos = Array.isArray(todos) ? todos : [];
}

/* ============================================================
   STRUCTURE DE L'INTERFACE
   ============================================================ */

function buildInterface(){

  const root = document.getElementById('appContent');

  root.innerHTML = `

    <!-- =====================================================
         COURS
         ===================================================== -->

    <section class="card" id="coursesCard">

      <div class="section-actions">
        <div>
          <h2>Cours</h2>
          <p class="hint">
            Organise tes matières, tes cours et leurs chapitres.
          </p>
        </div>

        <button class="btn primary" id="addSubjectBtn">
          + Ajouter une matière
        </button>
      </div>

      <div id="subjectFormContainer"></div>

      <div class="subject-list" id="subjectList"></div>

    </section>


    <!-- =====================================================
         SUIVI
         ===================================================== -->

    <section class="card" id="trackingCard">

      <h2>Suivi des révisions</h2>

      <p class="hint">
        Chaque cours possède ses révisions J-0, J-1, J-3, J-5 et J-7.
        Tu peux également ajouter jusqu'à 4 révisions libres.
      </p>

      <div id="trackingSummary"></div>

      <div id="trackingList"></div>

    </section>


    <!-- =====================================================
         SUGGESTIONS
         ===================================================== -->

    <section class="card" id="suggestionsCard">

      <h2>Révisions à revoir</h2>

      <p class="hint">
        Les révisions en retard sont proposées ici sans système de
        notification ou de culpabilisation.
      </p>

      <div id="suggestionsList"></div>

    </section>


    <!-- =====================================================
         CALENDRIER
         ===================================================== -->

    <section class="card" id="calendarCard">

      <div class="week-nav">

        <button class="navbtn" id="prevWeek">‹</button>

        <div class="week-label" id="weekLabel"></div>

        <button class="navbtn" id="nextWeek">›</button>

        <button class="today-btn" id="todayBtn">
          Cette semaine
        </button>

      </div>

      <div class="day-picker" id="dayPickerCal"></div>

      <h2>Planning</h2>

      <p class="hint">
        Clique dans une case vide pour ajouter un cours, une révision,
        un QCM, une annale ou un bloc. Tu peux également déplacer les
        éléments par glisser-déposer.
      </p>

      <div class="calendar-scroll">
        <div class="cal-wrap">

          <div class="time-gutter" id="timeGutter"></div>

          <div class="cal-days" id="calDays"></div>

        </div>
      </div>

    </section>


    <!-- =====================================================
         TO-DO
         ===================================================== -->

    <section class="card" id="todoCard">

      <div class="week-nav">

        <button class="navbtn" id="prevWeekTodo">‹</button>

        <div class="week-label" id="weekLabelTodo"></div>

        <button class="navbtn" id="nextWeekTodo">›</button>

        <button class="today-btn" id="todayBtnTodo">
          Cette semaine
        </button>

      </div>

      <h2>To-do de la semaine</h2>

      <p class="hint">
        Une liste indépendante pour noter ce que tu dois faire chaque jour.
      </p>

      <div class="day-picker" id="dayPickerTodo"></div>

      <div class="todo-grid" id="todoDays"></div>

    </section>


    <!-- =====================================================
         STATISTIQUES
         ===================================================== -->

    <section class="card" id="statsCard">

      <h2>Statistiques</h2>

      <p class="hint">
        Les heures travaillées correspondent aux éléments du planning
        marqués comme terminés.
      </p>

      <div class="stats-cards" id="statsCards"></div>

      <h3>Temps de travail cette semaine</h3>

      <div class="chart" id="hoursChart"></div>

    </section>


    <!-- =====================================================
         POMODORO
         ===================================================== -->

    <section class="card pomodoro" id="pomodoroCard">

      <h2>Pomodoro</h2>

      <p class="hint">
        Le minuteur est totalement indépendant du planning.
      </p>

      <div class="pomo-presets">

        <button data-pomo="25">25 min</button>
        <button data-pomo="50">50 min</button>

      </div>

      <div class="custom-duration">

        <div class="field">
          <label>Durée personnalisée (minutes)</label>

          <input
            id="pomoCustom"
            type="number"
            min="1"
            max="240"
            placeholder="Ex : 35"
          >
        </div>

      </div>

      <div class="timer" id="timerDisplay">
        25:00
      </div>

      <div class="pomodoro-actions">

        <button class="btn primary" id="timerStart">
          Démarrer
        </button>

        <button class="btn" id="timerPause">
          Pause
        </button>

        <button class="btn" id="timerReset">
          Réinitialiser
        </button>

      </div>

    </section>


    <!-- =====================================================
         BLOCS PERSONNALISÉS
         ===================================================== -->

    <section class="card" id="blocksCard">

      <div class="section-actions">

        <div>
          <h2>Blocs personnalisés</h2>

          <p class="hint">
            Crée des blocs comme travail, pause, sport, etc.
          </p>
        </div>

        <button class="btn primary" id="addBlockBtn">
          + Ajouter un bloc
        </button>

      </div>

      <div id="blockFormContainer"></div>

      <div id="blocksList"></div>

    </section>

  `;

  bindInterfaceEvents();
}

/* ============================================================
   ÉVÉNEMENTS PRINCIPAUX
   ============================================================ */

function bindInterfaceEvents(){

  document.getElementById('addSubjectBtn')
    .addEventListener('click',showSubjectForm);

  document.getElementById('prevWeek')
    .addEventListener('click',()=>{
      currentWeekStart = addDays(currentWeekStart,-7);
      renderCalendar();
      renderTodo();
    });

  document.getElementById('nextWeek')
    .addEventListener('click',()=>{
      currentWeekStart = addDays(currentWeekStart,7);
      renderCalendar();
      renderTodo();
    });

  document.getElementById('todayBtn')
    .addEventListener('click',()=>{
      currentWeekStart = getMonday(new Date());
      renderCalendar();
      renderTodo();
    });

  document.getElementById('prevWeekTodo')
    .addEventListener('click',()=>{
      currentWeekStart = addDays(currentWeekStart,-7);
      renderCalendar();
      renderTodo();
    });

  document.getElementById('nextWeekTodo')
    .addEventListener('click',()=>{
      currentWeekStart = addDays(currentWeekStart,7);
      renderCalendar();
      renderTodo();
    });

  document.getElementById('todayBtnTodo')
    .addEventListener('click',()=>{
      currentWeekStart = getMonday(new Date());
      renderCalendar();
      renderTodo();
    });

  document.getElementById('addBlockBtn')
    .addEventListener('click',showBlockForm);

  document.getElementById('exportBtn')
    .addEventListener('click',exportData);

  document.getElementById('importBtn')
    .addEventListener('click',()=>{
      document.getElementById('importFile').click();
    });

  document.getElementById('importFile')
    .addEventListener('change',handleImport);

  document.getElementById('themeBtn')
    .addEventListener('click',cycleTheme);

  document.getElementById('quoteRefresh')
    .addEventListener('click',renderQuote);

  document.querySelectorAll('[data-pomo]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        setTimer(Number(button.dataset.pomo));
      });
    });

  document.getElementById('pomoCustom')
    .addEventListener('change',()=>{
      const value = clamp(
        Number(document.getElementById('pomoCustom').value) || 25,
        1,
        240
      );

      setTimer(value);
    });

  document.getElementById('timerStart')
    .addEventListener('click',startTimer);

  document.getElementById('timerPause')
    .addEventListener('click',pauseTimer);

  document.getElementById('timerReset')
    .addEventListener('click',resetTimer);
}

/* ============================================================
   ACCUEIL
   ============================================================ */

function renderGreeting(){

  const hour = new Date().getHours();

  let greeting = 'Bonjour';

  if(hour >= 12 && hour < 18){
    greeting = 'Bon après-midi';
  }else if(hour >= 18){
    greeting = 'Bonsoir';
  }

  document.getElementById('greetingTitle').textContent =
    `${greeting} 👋`;

  document.getElementById('greetingText').textContent =
    `${courses.length} cours · ${revisions.length} révisions enregistrées`;
}

function renderQuote(){

  const quote =
    QUOTES[Math.floor(Math.random()*QUOTES.length)];

  document.getElementById('quoteText').textContent =
    `« ${quote} »`;
}

/* ============================================================
   MATIÈRES
   ============================================================ */

function showSubjectForm(){

  const container =
    document.getElementById('subjectFormContainer');

  container.innerHTML = `

    <div class="card" style="margin:0 0 14px;background:#fafafa">

      <div class="form-row">

        <div class="field">
          <label>Nom de la matière</label>
          <input id="newSubjectName" placeholder="Ex : Anatomie">
        </div>

        <div class="field">
          <label>Couleur</label>
          <input id="newSubjectColor" type="color" value="#111111">
        </div>

      </div>

      <div class="section-actions">

        <button class="btn primary" id="saveSubjectBtn">
          Ajouter
        </button>

        <button class="btn" id="cancelSubjectBtn">
          Annuler
        </button>

      </div>

    </div>
  `;

  document.getElementById('saveSubjectBtn')
    .addEventListener('click',addSubject);

  document.getElementById('cancelSubjectBtn')
    .addEventListener('click',()=>{
      container.innerHTML='';
    });
}

function addSubject(){

  const name =
    document.getElementById('newSubjectName').value.trim();

  const color =
    document.getElementById('newSubjectColor').value;

  if(!name){
    alert('Entre un nom de matière.');
    return;
  }

  subjects.push({
    id:uid('sub_'),
    name,
    color
  });

  save(STORAGE.subjects,subjects);

  document.getElementById('subjectFormContainer').innerHTML='';

  renderSubjects();
  renderTracking();
  renderGreeting();
}

function renderSubjects(){

  const container =
    document.getElementById('subjectList');

  if(subjects.length === 0){
    container.innerHTML =
      `<div class="empty">Aucune matière.</div>`;
    return;
  }

  container.innerHTML = subjects.map(subject=>{

    const subjectCourses =
      courses.filter(c=>c.subjectId===subject.id);

    return `

      <div class="subject" data-subject="${subject.id}">

        <button class="subject-header">

          <div class="subject-left">

            <span
              class="subject-dot"
              style="background:${escapeHTML(subject.color || '#111')}"
            ></span>

            <div>

              <div class="subject-name">
                ${escapeHTML(subject.name)}
              </div>

              <div class="subject-count">
                ${subjectCourses.length}
                ${subjectCourses.length > 1 ? 'cours' : 'cours'}
              </div>

            </div>

          </div>

          <span class="subject-chevron">⌄</span>

        </button>

        <div class="subject-content">

          <div class="section-actions" style="margin-bottom:10px">

            <strong>Cours</strong>

            <button
              class="btn small primary"
              data-action="add-course"
              data-subject="${subject.id}"
            >
              + Ajouter un cours
            </button>

          </div>

          <div class="course-list">

            ${
              subjectCourses.length
              ? subjectCourses.map(renderCourseHTML).join('')
              : `<div class="empty">Aucun cours dans cette matière.</div>`
            }

          </div>

        </div>

      </div>
    `;
  }).join('');

  container.querySelectorAll('.subject-header')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        button.parentElement.classList.toggle('open');
      });
    });

  container.querySelectorAll('[data-action="add-course"]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        showCourseForm(button.dataset.subject);
      });
    });

  container.querySelectorAll('[data-action="edit-course"]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        showCourseForm(
          button.dataset.subject,
          button.dataset.course
        );
      });
    });

  container.querySelectorAll('[data-action="delete-course"]')
    .forEach(button=>{
      button.addEventListener('click',()=>{
        deleteCourse(button.dataset.course);
      });
    });
}

function renderCourseHTML(course){

  const subject =
    getSubject(course.subjectId);

  const courseRevisions =
    revisions.filter(r=>r.courseId===course.id);

  const done =
    courseRevisions.filter(r=>r.done).length;

  const total =
    courseRevisions.length;

  const progress =
    total ? Math.round(done/total*100) : 0;

  const chapters =
    Array.isArray(course.chapters)
      ? course.chapters
      : [];

  return `

    <div class="course">

      <div class="course-header">

        <div>

          <div class="course-title">
            ${escapeHTML(course.name)}
          </div>

          <div class="course-meta">
            Cours créé le ${formatDate(course.createdAt)}
          </div>

          ${
            chapters.length
            ? `
              <div class="chapter-list">
                ${
                  chapters.map(chapter=>`
                    <span class="chapter-tag">
                      ${escapeHTML(chapter)}
                    </span>
                  `).join('')
                }
              </div>
            `
            : ''
          }

        </div>

        <div style="display:flex;gap:5px">

          <button
            class="btn small"
            data-action="edit-course"
            data-subject="${course.subjectId}"
            data-course="${course.id}"
          >
            Modifier
          </button>

          <button
            class="btn small danger"
            data-action="delete-course"
            data-course="${course.id}"
          >
            Supprimer
          </button>

        </div>

      </div>

      <div class="course-progress">

        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width:${progress}%"
          ></div>
        </div>

        <div class="progress-text">
          ${done}/${total} révisions terminées · ${progress} %
        </div>

      </div>

    </div>
  `;
}

/* ============================================================
   AJOUT / MODIFICATION COURS
   ============================================================ */

function showCourseForm(subjectId,courseId=null){

  const subject = getSubject(subjectId);
  const existing = courseId ? getCourse(courseId) : null;

  const container =
    document.getElementById('subjectFormContainer');

  const chapters =
    existing && Array.isArray(existing.chapters)
      ? existing.chapters.join('\n')
      : '';

  container.innerHTML = `

    <div class="card" style="margin:0 0 14px;background:#fafafa">

      <h3>
        ${existing ? 'Modifier le cours' : 'Ajouter un cours'}
      </h3>

      <p class="hint">
        Les chapitres seront associés à ce cours.
        Les révisions J-0/J-1/J-3/J-5/J-7 seront créées automatiquement.
      </p>

      <div class="form-row">

        <div class="field">
          <label>Matière</label>

          <select id="courseSubject">

            ${
              subjects.map(s=>`
                <option
                  value="${s.id}"
                  ${s.id===subjectId?'selected':''}
                >
                  ${escapeHTML(s.name)}
                </option>
              `).join('')
            }

          </select>

        </div>

        <div class="field">

          <label>Nom du cours</label>

          <input
            id="courseName"
            value="${escapeHTML(existing?.name || '')}"
            placeholder="Ex : Ostéologie du membre supérieur"
          >

        </div>

      </div>

      <div class="field" style="margin-bottom:10px">

        <label>Chapitres — un par ligne</label>

        <textarea
          id="courseChapters"
          placeholder="Clavicule
Scapula
Humérus"
        >${escapeHTML(chapters)}</textarea>

      </div>

      <div class="form-row">

        <div class="field">

          <label>Date du cours</label>

          <input
            id="courseDate"
            type="date"
            value="${existing?.courseDate || isoDate(new Date())}"
          >

        </div>

        <div class="field">

          <label>Durée prévue des révisions (minutes)</label>

          <input
            id="courseRevisionDuration"
            type="number"
            min="20"
            value="${existing?.revisionDuration || 60}"
          >

        </div>

      </div>

      <div class="section-actions">

        <button class="btn primary" id="saveCourseBtn">
          ${existing ? 'Enregistrer' : 'Créer le cours'}
        </button>

        <button class="btn" id="cancelCourseBtn">
          Annuler
        </button>

      </div>

    </div>
  `;

  document.getElementById('saveCourseBtn')
    .addEventListener('click',()=>{
      saveCourse(subjectId,courseId);
    });

  document.getElementById('cancelCourseBtn')
    .addEventListener('click',()=>{
      container.innerHTML='';
    });
}

function saveCourse(originalSubjectId,courseId){

  const subjectId =
    document.getElementById('courseSubject').value;

  const name =
    document.getElementById('courseName').value.trim();

  const chapters =
    document.getElementById('courseChapters').value
      .split('\n')
      .map(x=>x.trim())
      .filter(Boolean);

  const courseDate =
    document.getElementById('courseDate').value;

  const revisionDuration =
    Math.max(
      20,
      Number(
        document.getElementById('courseRevisionDuration').value
      ) || 60
    );

  if(!name){
    alert('Entre un nom de cours.');
    return;
  }

  if(!courseDate){
    alert('Choisis une date.');
    return;
  }

  if(courseId){

    const course = getCourse(courseId);

    if(!course) return;

    course.subjectId = subjectId;
    course.name = name;
    course.chapters = chapters;
    course.courseDate = courseDate;
    course.revisionDuration = revisionDuration;

    /*
      Si le cours est modifié, les dates des révisions
      automatiques suivent la nouvelle date uniquement si
      elles n'ont pas été modifiées manuellement.
    */

    revisions
      .filter(r=>r.courseId===courseId && r.automatic)
      .forEach(r=>{

        const type =
          REVISION_TYPES.find(t=>t.key===r.type);

        if(type && !r.manuallyRescheduled && !r.done){
          r.date =
            isoDate(addDays(parseDate(courseDate),type.offset));
        }

        r.duration = revisionDuration;
      });

  }else{

    const course = {
      id:uid('course_'),
      subjectId,
      name,
      chapters,
      courseDate,
      revisionDuration,
      createdAt:isoDate(new Date())
    };

    courses.push(course);

    REVISION_TYPES.forEach(type=>{

      revisions.push({
        id:uid('rev_'),
        courseId:course.id,
        type:type.key,
        label:type.label,
        date:isoDate(
          addDays(parseDate(courseDate),type.offset)
        ),
        duration:revisionDuration,
        note:'',
        mastery:0,
        done:false,
        automatic:true,
        manuallyRescheduled:false,
        lateDismissed:false,
        createdAt:isoDate(new Date())
      });

    });

  }

  saveAll();

  document.getElementById('subjectFormContainer').innerHTML='';

  renderSubjects();
  renderTracking();
  renderSuggestions();
  renderCalendar();
  renderStats();
  renderGreeting();
}

/* ============================================================
   SUPPRESSION COURS
   ============================================================ */

function deleteCourse(courseId){

  const course = getCourse(courseId);

  if(!course) return;

  if(!confirm(
    `Supprimer le cours "${course.name}" et toutes ses révisions ?`
  )){
    return;
  }

  courses =
    courses.filter(c=>c.id!==courseId);

  revisions =
    revisions.filter(r=>r.courseId!==courseId);

  placements =
    placements.filter(
      p=>p.type!=='course' &&
         p.type!=='revision' ||
         (
           p.type==='course' &&
           p.refId!==courseId
         )
    );

  saveAll();

  renderSubjects();
  renderTracking();
  renderSuggestions();
  renderCalendar();
  renderStats();
  renderGreeting();
}

/* ============================================================
   SUIVI
   ============================================================ */

function renderTracking(){

  const container =
    document.getElementById('trackingList');

  const summary =
    document.getElementById('trackingSummary');

  const total = revisions.length;
  const done = revisions.filter(r=>r.done).length;
  const planned = revisions.filter(r=>r.date && !r.done).length;

  summary.innerHTML = `

    <div class="stats-cards">

      <div class="stat">
        <div class="stat-label">Révisions totales</div>
        <div class="stat-value">${total}</div>
      </div>

      <div class="stat">
        <div class="stat-label">Terminées</div>
        <div class="stat-value">${done}</div>
      </div>

      <div class="stat">
        <div class="stat-label">Planifiées</div>
        <div class="stat-value">${planned}</div>
      </div>

      <div class="stat">
        <div class="stat-label">Progression</div>
        <div class="stat-value">
          ${total ? Math.round(done/total*100) : 0}%
        </div>
      </div>

    </div>
  `;

  if(subjects.length===0){
    container.innerHTML =
      `<div class="empty">Ajoute une matière pour commencer.</div>`;
    return;
  }

  container.innerHTML =
    subjects.map(subject=>{

      const subjectCourses =
        courses.filter(c=>c.subjectId===subject.id);

      if(!subjectCourses.length){
        return '';
      }

      return `

        <details class="tracking-subject">

          <summary>

            <span
              class="subject-dot"
              style="background:${escapeHTML(subject.color || '#111')}"
            ></span>

            ${escapeHTML(subject.name)}

          </summary>

          ${
            subjectCourses
              .map(renderTrackingCourse)
              .join('')
          }

        </details>

      `;

    }).join('');

  bindTrackingEvents();
}

function renderTrackingCourse(course){

  const subject =
    getSubject(course.subjectId);

  const courseRevisions =
    revisions
      .filter(r=>r.courseId===course.id)
      .sort((a,b)=>{
        const da = new Date(a.date);
        const db = new Date(b.date);
        return da-db;
      });

  return `

    <div class="tracking-course">

      <div class="tracking-course-head">

        <div>

          <div class="tracking-course-title">
            ${escapeHTML(course.name)}
          </div>

          <div class="tracking-course-chapters">

            ${
              course.chapters?.length
              ? 'Chapitres : ' +
                course.chapters
                  .map(escapeHTML)
                  .join(' · ')
              : 'Aucun chapitre renseigné'
            }

          </div>

        </div>

        <button
          class="btn small primary"
          data-action="add-free-revision"
          data-course="${course.id}"
        >
          + Révision libre
        </button>

      </div>

      <div class="tracking-table-wrap">

        <table class="tracking-table">

          <thead>

            <tr>
              <th>Révision</th>
              <th>Date</th>
              <th>Durée</th>
              <th>Statut</th>
              <th>Note</th>
              <th>Maîtrise</th>
              <th>Actions</th>
            </tr>

          </thead>

          <tbody>

            ${
              courseRevisions
                .map(r=>renderRevisionRow(r,course))
                .join('')
            }

          </tbody>

        </table>

      </div>

    </div>
  `;
}

function renderRevisionRow(revision,course){

  const today =
    isoDate(new Date());

  const late =
    revision.date &&
    revision.date < today &&
    !revision.done;

  let status = 'planned';
  let statusText = 'Planifiée';

  if(revision.done){
    status='done';
    statusText='Terminée';
  }else if(late){
    status='late';
    statusText='En retard';
  }

  return `

    <tr data-revision="${revision.id}">

      <td>

        <strong>
          ${escapeHTML(revision.label)}
        </strong>

      </td>

      <td>

        <input
          type="date"
          value="${revision.date || ''}"
          data-field="date"
        >

      </td>

      <td>

        <input
          type="number"
          min="20"
          value="${revision.duration || 60}"
          data-field="duration"
          style="width:75px"
        >

      </td>

      <td>

        <span class="status ${status}">
          ${statusText}
        </span>

      </td>

      <td>

        <input
          type="number"
          min="0"
          max="20"
          step="0.25"
          placeholder="/20"
          value="${revision.grade ?? ''}"
          data-field="grade"
          ${
            (!revision.done && !revision.date)
              ? 'disabled'
              : ''
          }
          style="width:75px"
        >

      </td>

      <td>

        <div class="mastery">

          ${
            [1,2,3,4,5].map(level=>`

              <button
                class="mastery-dot ${
                  revision.mastery >= level
                    ? 'active'
                    : ''
                }"
                title="${level}/5"
                data-action="mastery"
                data-level="${level}"
              ></button>

            `).join('')
          }

        </div>

      </td>

      <td>

        <div class="revision-actions">

          <button
            class="btn small ${
              revision.done ? '' : 'success'
            }"
            data-action="toggle-done"
          >
            ${
              revision.done
                ? '↩ À refaire'
                : '✓ Terminée'
            }
          </button>

          <button
            class="btn small"
            data-action="note"
          >
            ${revision.note ? 'Modifier note' : 'Note'}
          </button>

          ${
            revision.type==='free'
            ? `
              <button
                class="btn small danger"
                data-action="delete-revision"
              >
                Supprimer
              </button>
            `
            : ''
          }

        </div>

      </td>

    </tr>

  `;
}

function bindTrackingEvents(){

  document.querySelectorAll(
    '#trackingList [data-action="toggle-done"]'
  ).forEach(button=>{

    button.addEventListener('click',()=>{
      const row =
        button.closest('[data-revision]');

      toggleRevisionDone(row.dataset.revision);
    });

  });

  document.querySelectorAll(
    '#trackingList [data-action="mastery"]'
  ).forEach(button=>{

    button.addEventListener('click',()=>{

      const row =
        button.closest('[data-revision]');

      const revision =
        getRevision(row.dataset.revision);

      revision.mastery =
        Number(button.dataset.level);

      save(STORAGE.revisions,revisions);

      renderTracking();
      renderSubjects();

    });

  });

  document.querySelectorAll(
    '#trackingList [data-action="note"]'
  ).forEach(button=>{

    button.addEventListener('click',()=>{

      const row =
        button.closest('[data-revision]');

      const revision =
        getRevision(row.dataset.revision);

      const note =
        prompt(
          'Note / commentaire pour cette révision :',
          revision.note || ''
        );

      if(note === null) return;

      revision.note = note;

      save(STORAGE.revisions,revisions);

      renderTracking();

    });

  });

  document.querySelectorAll(
    '#trackingList [data-action="delete-revision"]'
  ).forEach(button=>{

    button.addEventListener('click',()=>{

      const row =
        button.closest('[data-revision]');

      const id =
        row.dataset.revision;

      revisions =
        revisions.filter(r=>r.id!==id);

      placements =
        placements.filter(
          p=>!(p.type==='revision' && p.refId===id)
        );

      saveAll();

      renderTracking();
      renderSubjects();
      renderSuggestions();
      renderCalendar();
      renderStats();

    });

  });

  document.querySelectorAll(
    '#trackingList tr[data-revision] input[data-field="date"]'
  ).forEach(input=>{

    input.addEventListener('change',()=>{

      const id =
        input.closest('[data-revision]').dataset.revision;

      const revision =
        getRevision(id);

      revision.date = input.value;
      revision.manuallyRescheduled = true;
      revision.lateDismissed = false;

      save(STORAGE.revisions,revisions);

      renderTracking();
      renderSuggestions();

    });

  });

  document.querySelectorAll(
    '#trackingList tr[data-revision] input[data-field="duration"]'
  ).forEach(input=>{

    input.addEventListener('change',()=>{

      const id =
        input.closest('[data-revision]').dataset.revision;

      const revision =
        getRevision(id);

      revision.duration =
        Math.max(20,Number(input.value)||20);

      save(STORAGE.revisions,revisions);

      renderTracking();

    });

  });

  document.querySelectorAll(
    '#trackingList tr[data-revision] input[data-field="grade"]'
  ).forEach(input=>{

    input.addEventListener('change',()=>{

      const id =
        input.closest('[data-revision]').dataset.revision;

      const revision =
        getRevision(id);

      revision.grade =
        input.value === ''
          ? null
          : Number(input.value);

      save(STORAGE.revisions,revisions);

    });

  });

  document.querySelectorAll(
    '#trackingList [data-action="add-free-revision"]'
  ).forEach(button=>{

    button.addEventListener('click',()=>{

      showFreeRevisionForm(
        button.dataset.course
      );

    });

  });
}

/* ============================================================
   RÉVISIONS
   ============================================================ */

function toggleRevisionDone(revisionId){

  const revision =
    getRevision(revisionId);

  if(!revision) return;

  revision.done = !revision.done;

  if(revision.done){
    revision.completedAt =
      isoDate(new Date());

    revision.lateDismissed = false;
  }else{
    revision.completedAt = null;
  }

  const placement =
    placements.find(
      p=>p.type==='revision' &&
         p.refId===revisionId
    );

  if(placement){
    placement.done = revision.done;
  }

  saveAll();

  renderTracking();
  renderSubjects();
  renderSuggestions();
  renderCalendar();
  renderStats();
  renderGreeting();
}

/* ============================================================
   RÉVISION LIBRE
   ============================================================ */

function showFreeRevisionForm(courseId){

  const course = getCourse(courseId);

  if(!course) return;

  const existingFree =
    revisions.filter(
      r=>r.courseId===courseId &&
         r.type==='free'
    );

  if(existingFree.length >= FREE_REVISION_COUNT){
    alert(
      `Tu as déjà atteint la limite de ${FREE_REVISION_COUNT} révisions libres pour ce cours.`
    );
    return;
  }

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>Ajouter une révision libre</h3>

    <p class="hint">
      Cours : ${escapeHTML(course.name)}
    </p>

    <div class="field" style="margin-bottom:8px">

      <label>Nom de la révision</label>

      <input
        id="freeRevisionLabel"
        value="Révision libre ${existingFree.length+1}"
      >

    </div>

    <div class="form-row">

      <div class="field">

        <label>Date</label>

        <input
          id="freeRevisionDate"
          type="date"
          value="${isoDate(new Date())}"
        >

      </div>

      <div class="field">

        <label>Durée</label>

        <input
          id="freeRevisionDuration"
          type="number"
          min="20"
          value="${course.revisionDuration || 60}"
        >

      </div>

    </div>

    <div class="pop-actions">

      <button id="saveFreeRevision">
        Ajouter la révision
      </button>

      <button class="pop-close" id="cancelFreeRevision">
        Annuler
      </button>

    </div>

  `;

  document.body.appendChild(pop);

  positionPopover(
    pop,
    window.innerWidth/2 - 190,
    window.innerHeight/2 - 180
  );

  document.getElementById('saveFreeRevision')
    .addEventListener('click',()=>{

      const label =
        document.getElementById('freeRevisionLabel')
          .value.trim();

      const date =
        document.getElementById('freeRevisionDate').value;

      const duration =
        Math.max(
          20,
          Number(
            document.getElementById('freeRevisionDuration').value
          ) || 60
        );

      if(!label || !date){
        alert('Complète les informations.');
        return;
      }

      revisions.push({
        id:uid('rev_'),
        courseId,
        type:'free',
        label,
        date,
        duration,
        note:'',
        grade:null,
        mastery:0,
        done:false,
        automatic:false,
        manuallyRescheduled:true,
        lateDismissed:false,
        createdAt:isoDate(new Date())
      });

      save(STORAGE.revisions,revisions);

      pop.remove();

      renderTracking();
      renderSubjects();
      renderSuggestions();
      renderCalendar();
      renderGreeting();

    });

  document.getElementById('cancelFreeRevision')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   SUGGESTIONS DE RETARD
   ============================================================ */

function renderSuggestions(){

  const container =
    document.getElementById('suggestionsList');

  const today =
    new Date();

  const todayIso =
    isoDate(today);

  const suggestions =
    revisions.filter(revision=>{

      if(revision.done) return false;
      if(!revision.date) return false;
      if(revision.lateDismissed) return false;

      if(revision.date >= todayIso) return false;

      const lateDays =
        daysBetween(parseDate(revision.date),today);

      /*
        Après 7 jours, on retire automatiquement la suggestion.
        La révision reste évidemment dans l'historique.
      */
      if(lateDays > 7) return false;

      return true;

    });

  if(!suggestions.length){

    container.innerHTML = `
      <div class="empty">
        Aucune révision en retard à suggérer.
      </div>
    `;

    return;
  }

  container.innerHTML =
    suggestions.map(revision=>{

      const course =
        getCourse(revision.courseId);

      const subject =
        course ? getSubject(course.subjectId) : null;

      const lateDays =
        daysBetween(
          parseDate(revision.date),
          today
        );

      return `

        <div
          class="suggestion"
          data-suggestion="${revision.id}"
        >

          <div class="suggestion-main">

            <div>

              <div class="suggestion-title">

                ${escapeHTML(
                  course?.name || 'Cours supprimé'
                )}

                ·

                ${escapeHTML(revision.label)}

              </div>

              <div class="suggestion-meta">

                ${
                  subject
                    ? escapeHTML(subject.name)
                    : ''
                }

                · prévue le
                ${formatDate(revision.date)}

                · ${lateDays}
                ${lateDays > 1 ? 'jours' : 'jour'} de retard

              </div>

            </div>

          </div>

          <div class="suggestion-actions">

            <input
              type="date"
              value="${todayIso}"
              data-suggest-date
              style="max-width:145px"
            >

            <button
              class="btn small primary"
              data-action="replan"
            >
              Replanifier
            </button>

            <button
              class="btn small"
              data-action="dismiss"
            >
              Ne plus suggérer
            </button>

            <button
              class="btn small success"
              data-action="done"
            >
              ✓ Terminée
            </button>

          </div>

        </div>
      `;

    }).join('');

  container.querySelectorAll('[data-action="replan"]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const suggestion =
          button.closest('[data-suggestion]');

        const revision =
          getRevision(suggestion.dataset.suggestion);

        const date =
          suggestion.querySelector('[data-suggest-date]').value;

        if(!date) return;

        revision.date = date;
        revision.lateDismissed = false;
        revision.manuallyRescheduled = true;

        save(STORAGE.revisions,revisions);

        renderSuggestions();
        renderTracking();
        renderCalendar();

      });

    });

  container.querySelectorAll('[data-action="dismiss"]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const suggestion =
          button.closest('[data-suggestion]');

        const revision =
          getRevision(suggestion.dataset.suggestion);

        revision.lateDismissed = true;

        save(STORAGE.revisions,revisions);

        renderSuggestions();

      });

    });

  container.querySelectorAll('[data-action="done"]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const suggestion =
          button.closest('[data-suggestion]');

        toggleRevisionDone(
          suggestion.dataset.suggestion
        );

      });

    });
}

/* ============================================================
   CALENDRIER
   ============================================================ */

function renderCalendar(){

  const label =
    document.getElementById('weekLabel');

  const monday =
    new Date(currentWeekStart);

  const sunday =
    addDays(monday,6);

  label.textContent =
    `${monday.toLocaleDateString('fr-FR',{
      day:'2-digit',
      month:'long'
    })} — ${sunday.toLocaleDateString('fr-FR',{
      day:'2-digit',
      month:'long',
      year:'numeric'
    })}`;

  renderDayPickerCalendar();

  renderTimeGutter();

  const daysContainer =
    document.getElementById('calDays');

  daysContainer.innerHTML='';

  for(let day=0;day<7;day++){

    const date =
      addDays(monday,day);

    const col =
      document.createElement('div');

    col.className='day-col';

    col.innerHTML = `

      <div class="day-header">

        ${DAYS[day]}

        <br>

        <span style="font-weight:500;color:#777">
          ${date.toLocaleDateString('fr-FR',{
            day:'2-digit',
            month:'2-digit'
          })}
        </span>

      </div>

      <div
        class="day-body"
        data-day="${day}"
      ></div>

    `;

    const body =
      col.querySelector('.day-body');

    body.addEventListener('click',event=>{

      if(event.target.closest('.cal-block')){
        return;
      }

      const rect =
        body.getBoundingClientRect();

      const y =
        event.clientY - rect.top;

      let startMin =
        Math.round((y/60*60)/20)*20;

      startMin =
        clamp(startMin,0,1420);

      openAddPopover(
        event.clientX,
        event.clientY,
        day,
        startMin
      );

    });

    body.addEventListener('dragover',event=>{

      event.preventDefault();

      body.classList.add('drop-target');

    });

    body.addEventListener('dragleave',()=>{
      body.classList.remove('drop-target');
    });

    body.addEventListener('drop',event=>{

      event.preventDefault();

      body.classList.remove('drop-target');

      if(!draggedPlacementId){
        return;
      }

      const placement =
        placements.find(
          p=>p.id===draggedPlacementId
        );

      if(!placement){
        return;
      }

      const rect =
        body.getBoundingClientRect();

      const y =
        event.clientY - rect.top;

      let startMin =
        Math.round((y/60*60)/20)*20;

      startMin =
        clamp(
          startMin,
          0,
          1440 - placement.durMin
        );

      placement.day = day;
      placement.startMin = startMin;
      placement.week = weekKey(
        addDays(currentWeekStart,day)
      );

      placement.done =
        placement.done || false;

      save(STORAGE.placements,placements);

      draggedPlacementId=null;

      renderCalendar();
      renderStats();

    });

    daysContainer.appendChild(col);

  }

  renderCalendarPlacements();
}

function renderDayPickerCalendar(){

  const container =
    document.getElementById('dayPickerCal');

  container.innerHTML =
    DAYS.map((day,index)=>`

      <button
        class="${index===mobileDayIndex?'active':''}"
        data-day-picker="${index}"
      >
        ${day.slice(0,3)}
      </button>

    `).join('');

  container.querySelectorAll('[data-day-picker]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        mobileDayIndex =
          Number(button.dataset.dayPicker);

        container.querySelectorAll('button')
          .forEach(b=>b.classList.remove('active'));

        button.classList.add('active');

        /*
          Sur mobile, on fait défiler automatiquement
          jusqu'à la colonne concernée.
        */

        const columns =
          document.querySelectorAll('.day-col');

        if(columns[mobileDayIndex]){
          columns[mobileDayIndex]
            .scrollIntoView({
              behavior:'smooth',
              inline:'center',
              block:'nearest'
            });
        }

      });

    });
}

function renderTimeGutter(){

  const gutter =
    document.getElementById('timeGutter');

  gutter.innerHTML='';

  for(let hour=0;hour<24;hour++){

    const div =
      document.createElement('div');

    div.className='time-label';

    div.textContent =
      `${String(hour).padStart(2,'0')}:00`;

    gutter.appendChild(div);

  }
}

function renderCalendarPlacements(){

  const monday =
    currentWeekStart;

  placements
    .filter(p=>p.week===weekKey(monday))
    .forEach(placement=>{

      const body =
        document.querySelector(
          `.day-body[data-day="${placement.day}"]`
        );

      if(!body) return;

      const el =
        document.createElement('div');

      el.className =
        `cal-block ${placement.done?'done':''}`;

      el.draggable=true;

      el.dataset.placement =
        placement.id;

      const info =
        getPlacementInfo(placement);

      const top =
        placement.startMin;

      el.style.top =
        `${top}px`;

      el.style.height =
        `${Math.max(20,placement.durMin)}px`;

      el.style.background =
        info.color;

      el.innerHTML = `

        <div class="cal-block-title">
          ${escapeHTML(info.title)}
        </div>

        ${
          info.subtitle
          ? `
            <div class="cal-block-sub">
              ${escapeHTML(info.subtitle)}
            </div>
          `
          : ''
        }

        <div class="cal-block-duration">
          ${minutesToTime(placement.startMin)}
          · ${placement.durMin} min
        </div>

      `;

      el.addEventListener('dragstart',event=>{

        draggedPlacementId =
          placement.id;

        currentlyDragging=true;

        event.dataTransfer.effectAllowed =
          'move';

        event.dataTransfer.setData(
          'text/plain',
          placement.id
        );

        setTimeout(()=>{
          el.style.opacity='.35';
        },0);

      });

      el.addEventListener('dragend',()=>{

        el.style.opacity='';
        draggedPlacementId=null;

        setTimeout(()=>{
          currentlyDragging=false;
        },100);

      });

      el.addEventListener('click',event=>{

        event.stopPropagation();

        if(currentlyDragging){
          return;
        }

        openPlacementPopover(
          placement,
          event.clientX,
          event.clientY
        );

      });

      body.appendChild(el);

    });
}

/* ============================================================
   INFORMATIONS D'UN ÉLÉMENT DU CALENDRIER
   ============================================================ */

function getPlacementInfo(p){

  if(p.type==='course'){

    const course =
      getCourse(p.refId);

    if(!course){
      return {
        title:'Cours supprimé',
        subtitle:'',
        color:'#ddd'
      };
    }

    const subject =
      getSubject(course.subjectId);

    return {
      title:course.name,
      subtitle:
        course.chapters?.slice(0,3).join(' · ') || '',
      color:subject?.color || '#ddd'
    };
  }

  if(p.type==='revision'){

    const revision =
      getRevision(p.refId);

    const course =
      revision
        ? getCourse(revision.courseId)
        : null;

    const subject =
      course
        ? getSubject(course.subjectId)
        : null;

    return {
      title:
        `${course?.name || 'Révision'} — ${revision?.label || ''}`,
      subtitle:
        course?.chapters?.slice(0,3).join(' · ') || '',
      color:subject?.color || '#ddd'
    };
  }

  if(p.type==='qcm'){

    return {
      title:p.name || 'QCM',
      subtitle:'Entraînement',
      color:'#bfdbfe'
    };
  }

  if(p.type==='annale'){

    return {
      title:p.name || 'Annale',
      subtitle:'Annale',
      color:'#fed7aa'
    };
  }

  if(p.type==='block'){

    const block =
      getBlock(p.refId);

    return {
      title:block?.name || 'Bloc',
      subtitle:'',
      color:block?.color || '#ddd'
    };
  }

  return {
    title:'Élément',
    subtitle:'',
    color:'#ddd'
  };
}

/* ============================================================
   AJOUT DANS LE PLANNING
   ============================================================ */

function openAddPopover(x,y,day,startMin){

  closePopovers();

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>Ajouter au planning</h3>

    <div class="pop-actions">

      <button data-add-type="course">
        📘 Ajouter un cours
      </button>

      <button data-add-type="revision">
        🔁 Ajouter une révision
      </button>

      <button data-add-type="qcm">
        📝 Ajouter un QCM
      </button>

      <button data-add-type="annale">
        📚 Ajouter une annale
      </button>

      <button data-add-type="block">
        ▪ Ajouter un bloc
      </button>

    </div>

    <button class="pop-close" id="closeAddPop">
      Annuler
    </button>

  `;

  document.body.appendChild(pop);

  positionPopover(pop,x,y);

  pop.querySelectorAll('[data-add-type]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const type =
          button.dataset.addType;

        if(type==='course'){
          showCalendarCoursePicker(
            day,startMin
          );
        }

        if(type==='revision'){
          showCalendarRevisionPicker(
            day,startMin
          );
        }

        if(type==='qcm'){
          showCalendarTextItem(
            'qcm',
            'Ajouter un QCM',
            day,
            startMin
          );
        }

        if(type==='annale'){
          showCalendarTextItem(
            'annale',
            'Ajouter une annale',
            day,
            startMin
          );
        }

        if(type==='block'){
          showCalendarBlockPicker(
            day,startMin
          );
        }

      });

    });

  document.getElementById('closeAddPop')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   SÉLECTION D'UN COURS
   ============================================================ */

function showCalendarCoursePicker(day,startMin){

  closePopovers();

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>Choisir un cours</h3>

    ${
      courses.length
      ? `
        <div class="pop-list">

          ${
            courses.map(course=>{

              const subject =
                getSubject(course.subjectId);

              return `

                <div
                  class="pop-item"
                  data-course="${course.id}"
                >

                  <div class="pop-item-title">
                    ${escapeHTML(course.name)}
                  </div>

                  <div class="pop-item-sub">

                    ${
                      subject
                        ? escapeHTML(subject.name)
                        : ''
                    }

                    ${
                      course.chapters?.length
                      ? ' · ' +
                        course.chapters
                          .slice(0,3)
                          .map(escapeHTML)
                          .join(' · ')
                      : ''
                    }

                  </div>

                </div>

              `;

            }).join('')
          }

        </div>
      `
      : `<div class="empty">Aucun cours. Crée d'abord un cours.</div>`
    }

    <button class="pop-close" id="closeCoursePicker">
      Annuler
    </button>

  `;

  document.body.appendChild(pop);

  positionPopover(
    pop,
    window.innerWidth/2-190,
    window.innerHeight/2-180
  );

  pop.querySelectorAll('[data-course]')
    .forEach(item=>{

      item.addEventListener('click',()=>{

        const course =
          getCourse(item.dataset.course);

        if(!course) return;

        const duration =
          Math.max(
            20,
            Number(course.revisionDuration)||60
          );

        addPlacement({
          type:'course',
          refId:course.id,
          day,
          startMin,
          durMin:duration
        });

        pop.remove();

      });

    });

  document.getElementById('closeCoursePicker')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   SÉLECTION D'UNE RÉVISION
   ============================================================ */

function showCalendarRevisionPicker(day,startMin){

  closePopovers();

  const pop =
    createPopover();

  const available =
    revisions
      .map(revision=>{

        const course =
          getCourse(revision.courseId);

        return {
          revision,
          course
        };

      })
      .filter(x=>x.course);

  pop.innerHTML = `

    <h3>Choisir une révision</h3>

    ${
      available.length
      ? `
        <div class="pop-list">

          ${
            available.map(x=>`

              <div
                class="pop-item"
                data-revision="${x.revision.id}"
              >

                <div class="pop-item-title">

                  ${escapeHTML(x.course.name)}

                  — ${escapeHTML(x.revision.label)}

                </div>

                <div class="pop-item-sub">

                  ${
                    x.course.chapters?.slice(0,3)
                      .map(escapeHTML)
                      .join(' · ') || ''
                  }

                  · prévue le
                  ${formatDate(x.revision.date)}

                </div>

              </div>

            `).join('')
          }

        </div>
      `
      : `<div class="empty">Aucune révision disponible.</div>`
    }

    <button class="pop-close" id="closeRevisionPicker">
      Annuler
    </button>

  `;

  document.body.appendChild(pop);

  positionPopover(
    pop,
    window.innerWidth/2-190,
    window.innerHeight/2-180
  );

  pop.querySelectorAll('[data-revision]')
    .forEach(item=>{

      item.addEventListener('click',()=>{

        const revision =
          getRevision(item.dataset.revision);

        if(!revision) return;

        addPlacement({
          type:'revision',
          refId:revision.id,
          day,
          startMin,
          durMin:Math.max(
            20,
            revision.duration || 60
          )
        });

        pop.remove();

      });

    });

  document.getElementById('closeRevisionPicker')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   QCM / ANNALE
   ============================================================ */

function showCalendarTextItem(
  type,
  title,
  day,
  startMin
){

  closePopovers();

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>${title}</h3>

    <div class="field" style="margin-bottom:9px">

      <label>Nom</label>

      <input
        id="calendarTextName"
        placeholder="${
          type==='qcm'
            ? 'Ex : QCM Anatomie'
            : 'Ex : Annale 2025'
        }"
      >

    </div>

    <div class="field" style="margin-bottom:9px">

      <label>Durée (minimum 20 minutes)</label>

      <input
        id="calendarTextDuration"
        type="number"
        min="20"
        value="30"
      >

    </div>

    <div class="pop-actions">

      <button id="saveCalendarText">
        Ajouter
      </button>

      <button id="cancelCalendarText">
        Annuler
      </button>

    </div>

  `;

  document.body.appendChild(pop);

  positionPopover(
    pop,
    window.innerWidth/2-190,
    window.innerHeight/2-150
  );

  document.getElementById('saveCalendarText')
    .addEventListener('click',()=>{

      const name =
        document.getElementById('calendarTextName')
          .value.trim();

      const duration =
        Math.max(
          20,
          Number(
            document.getElementById('calendarTextDuration').value
          ) || 20
        );

      if(!name){
        alert('Entre un nom.');
        return;
      }

      addPlacement({
        type,
        refId:null,
        name,
        day,
        startMin,
        durMin:duration
      });

      pop.remove();

    });

  document.getElementById('cancelCalendarText')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   BLOCS
   ============================================================ */

function showCalendarBlockPicker(day,startMin){

  closePopovers();

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>Choisir un bloc</h3>

    <div class="pop-list">

      ${
        blocks.map(block=>`

          <div
            class="pop-item"
            data-block="${block.id}"
          >

            <div class="pop-item-title">
              ${escapeHTML(block.name)}
            </div>

            <div class="pop-item-sub">
              Bloc personnalisé
            </div>

          </div>

        `).join('')
      }

    </div>

    <button class="pop-close" id="closeBlockPicker">
      Annuler
    </button>

  `;

  document.body.appendChild(pop);

  positionPopover(
    pop,
    window.innerWidth/2-190,
    window.innerHeight/2-180
  );

  pop.querySelectorAll('[data-block]')
    .forEach(item=>{

      item.addEventListener('click',()=>{

        const block =
          getBlock(item.dataset.block);

        if(!block) return;

        const duration =
          Number(prompt(
            'Durée en minutes (minimum 20) :',
            '60'
          ));

        if(!Number.isFinite(duration)){
          return;
        }

        addPlacement({
          type:'block',
          refId:block.id,
          day,
          startMin,
          durMin:Math.max(20,duration)
        });

        pop.remove();

      });

    });

  document.getElementById('closeBlockPicker')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   AJOUT PLACEMENT
   ============================================================ */

function addPlacement(data){

  const placement = {
    id:uid('place_'),
    week:weekKey(
      addDays(currentWeekStart,data.day)
    ),
    type:data.type,
    refId:data.refId ?? null,
    name:data.name ?? null,
    day:data.day,
    startMin:data.startMin,
    durMin:Math.max(20,data.durMin || 60),
    done:false
  };

  if(hasOverlap(placement)){

    alert(
      'Ce créneau chevauche déjà un autre élément du planning.'
    );

    return;
  }

  placements.push(placement);

  save(STORAGE.placements,placements);

  renderCalendar();
  renderStats();
}

/* ============================================================
   CHEVAUCHEMENTS
   ============================================================ */

function hasOverlap(newPlacement){

  return placements.some(p=>{

    if(p.id===newPlacement.id) return false;
    if(p.week!==newPlacement.week) return false;
    if(p.day!==newPlacement.day) return false;

    const a1 = p.startMin;
    const a2 = p.startMin+p.durMin;

    const b1 = newPlacement.startMin;
    const b2 =
      newPlacement.startMin+
      newPlacement.durMin;

    return b1<a2 && b2>a1;

  });
}

/* ============================================================
   ACTIONS D'UN ÉLÉMENT DU CALENDRIER
   ============================================================ */

function openPlacementPopover(
  placement,
  x,
  y
){

  closePopovers();

  const info =
    getPlacementInfo(placement);

  const pop =
    createPopover();

  pop.innerHTML = `

    <h3>${escapeHTML(info.title)}</h3>

    ${
      info.subtitle
      ? `<p class="hint">${escapeHTML(info.subtitle)}</p>`
      : ''
    }

    <div class="pop-actions">

      ${
        placement.type==='revision'
        ? `
          <button id="calendarDoneRevision">
            ${
              placement.done
                ? '↩ Marquer comme non terminée'
                : '✓ Révision terminée'
            }
          </button>
        `
        : `
          <button id="calendarDonePlacement">
            ${
              placement.done
                ? '↩ Marquer comme non terminé'
                : '✓ Marquer comme terminé'
            }
          </button>
        `
      }

      <button id="calendarDuration">
        Modifier la durée
      </button>

      ${
        placement.type==='revision'
        ? `
          <button id="calendarRevisionNote">
            Ajouter / modifier une note
          </button>
        `
        : ''
      }

      <button id="calendarDelete" style="color:#dc2626">
        Supprimer
      </button>

    </div>

    <button class="pop-close" id="calendarClose">
      Fermer
    </button>

  `;

  document.body.appendChild(pop);

  positionPopover(pop,x,y);

  const doneButton =
    document.getElementById(
      placement.type==='revision'
        ? 'calendarDoneRevision'
        : 'calendarDonePlacement'
    );

  doneButton.addEventListener('click',()=>{

    if(placement.type==='revision'){

      const revision =
        getRevision(placement.refId);

      if(revision){

        revision.done =
          !revision.done;

        revision.completedAt =
          revision.done
            ? isoDate(new Date())
            : null;

        placement.done =
          revision.done;

      }

    }else{

      placement.done =
        !placement.done;

    }

    saveAll();

    pop.remove();

    renderCalendar();
    renderTracking();
    renderSubjects();
    renderSuggestions();
    renderStats();

  });

  document.getElementById('calendarDuration')
    .addEventListener('click',()=>{

      const value =
        Number(prompt(
          'Nouvelle durée en minutes (minimum 20) :',
          String(placement.durMin)
        ));

      if(!Number.isFinite(value)){
        return;
      }

      const duration =
        Math.max(20,value);

      const test = {
        ...placement,
        durMin:duration
      };

      if(hasOverlap(test)){

        alert(
          'Cette durée provoquerait un chevauchement.'
        );

        return;
      }

      placement.durMin=duration;

      if(placement.type==='revision'){

        const revision =
          getRevision(placement.refId);

        if(revision){
          revision.duration=duration;
        }

      }

      saveAll();

      pop.remove();

      renderCalendar();
      renderTracking();
      renderStats();

    });

  if(placement.type==='revision'){

    document.getElementById('calendarRevisionNote')
      .addEventListener('click',()=>{

        const revision =
          getRevision(placement.refId);

        if(!revision) return;

        const note =
          prompt(
            'Note de la révision :',
            revision.note || ''
          );

        if(note===null) return;

        revision.note=note;

        save(STORAGE.revisions,revisions);

        pop.remove();

        renderTracking();

      });

  }

  document.getElementById('calendarDelete')
    .addEventListener('click',()=>{

      if(!confirm('Supprimer cet élément du planning ?')){
        return;
      }

      placements =
        placements.filter(
          p=>p.id!==placement.id
        );

      save(STORAGE.placements,placements);

      pop.remove();

      renderCalendar();
      renderStats();

    });

  document.getElementById('calendarClose')
    .addEventListener('click',()=>{
      pop.remove();
    });
}

/* ============================================================
   POSITIONNEMENT DES POPOVERS
   ============================================================ */

function createPopover(){

  closePopovers();

  const pop =
    document.createElement('div');

  pop.className='pop';

  return pop;
}

function positionPopover(pop,x,y){

  /*
    IMPORTANT :
    On mesure réellement la largeur et la hauteur du menu
    après l'avoir ajouté au DOM.

    Cela évite le problème du samedi/dimanche où le bouton
    pouvait sortir de l'écran.
  */

  if(window.innerWidth <= 600){

    pop.style.left='10px';
    pop.style.right='10px';
    pop.style.width='auto';
    pop.style.top='10px';
    pop.style.maxHeight =
      `${window.innerHeight-20}px`;
    pop.style.overflow='auto';

    return;
  }

  const rect =
    pop.getBoundingClientRect();

  const margin=10;

  let left=x;
  let top=y;

  if(left + rect.width + margin > window.innerWidth){
    left =
      window.innerWidth -
      rect.width -
      margin;
  }

  if(left < margin){
    left=margin;
  }

  if(top + rect.height + margin > window.innerHeight){

    top =
      window.innerHeight -
      rect.height -
      margin;

  }

  if(top < margin){
    top=margin;
  }

  pop.style.left =
    `${left}px`;

  pop.style.top =
    `${top}px`;
}

function closePopovers(){

  document
    .querySelectorAll('.pop')
    .forEach(pop=>pop.remove());
}

/* ============================================================
   TO-DO LIST
   ============================================================ */

function renderTodo(){

  const label =
    document.getElementById('weekLabelTodo');

  const monday =
    currentWeekStart;

  const sunday =
    addDays(monday,6);

  label.textContent =
    `${monday.toLocaleDateString('fr-FR',{
      day:'2-digit',
      month:'long'
    })} — ${sunday.toLocaleDateString('fr-FR',{
      day:'2-digit',
      month:'long',
      year:'numeric'
    })}`;

  renderTodoPicker();

  const container =
    document.getElementById('todoDays');

  container.innerHTML =
    DAYS.map((day,index)=>{

      const date =
        addDays(monday,index);

      const key =
        isoDate(date);

      const dayTodos =
        todos.filter(
          t=>t.week===weekKey(monday) &&
             t.date===key
        );

      return `

        <div class="todo-day">

          <div class="todo-day-title">

            ${day}

            <span style="color:#888;font-weight:500">
              ${date.toLocaleDateString('fr-FR',{
                day:'2-digit',
                month:'2-digit'
              })}
            </span>

          </div>

          <div class="todo-items">

            ${
              dayTodos.length
              ? dayTodos.map(todo=>`

                <div
                  class="todo-item ${
                    todo.done ? 'done' : ''
                  }"
                  data-todo="${todo.id}"
                >

                  <input
                    type="checkbox"
                    ${todo.done?'checked':''}
                    data-todo-toggle
                  >

                  <span>
                    ${escapeHTML(todo.text)}
                  </span>

                  <button
                    class="todo-delete"
                    data-todo-delete
                  >
                    ×
                  </button>

                </div>

              `).join('')
              : `<div style="font-size:11px;color:#aaa">
                  Rien pour le moment
                </div>`
            }

          </div>

          <div class="todo-add">

            <input
              placeholder="Ajouter..."
              data-todo-input
              data-date="${key}"
            >

            <button
              class="btn small"
              data-todo-add
              data-date="${key}"
            >
              +
            </button>

          </div>

        </div>
      `;

    }).join('');

  bindTodoEvents();
}

function renderTodoPicker(){

  const container =
    document.getElementById('dayPickerTodo');

  container.innerHTML =
    DAYS.map((day,index)=>`

      <button
        class="${index===mobileDayIndex?'active':''}"
        data-todo-day="${index}"
      >
        ${day.slice(0,3)}
      </button>

    `).join('');

  container.querySelectorAll('[data-todo-day]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        mobileDayIndex =
          Number(button.dataset.todoDay);

        renderTodo();

      });

    });
}

function bindTodoEvents(){

  document.querySelectorAll('[data-todo-toggle]')
    .forEach(input=>{

      input.addEventListener('change',()=>{

        const todo =
          todos.find(
            t=>t.id===
              input.closest('[data-todo]').dataset.todo
          );

        if(!todo) return;

        todo.done =
          input.checked;

        save(STORAGE.todos,todos);

        renderTodo();

      });

    });

  document.querySelectorAll('[data-todo-delete]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const id =
          button.closest('[data-todo]').dataset.todo;

        todos =
          todos.filter(t=>t.id!==id);

        save(STORAGE.todos,todos);

        renderTodo();

      });

    });

  document.querySelectorAll('[data-todo-add]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const input =
          button.parentElement
            .querySelector('[data-todo-input]');

        addTodo(
          input.dataset.date,
          input.value
        );

      });

    });

  document.querySelectorAll('[data-todo-input]')
    .forEach(input=>{

      input.addEventListener('keydown',event=>{

        if(event.key==='Enter'){

          addTodo(
            input.dataset.date,
            input.value
          );

        }

      });

    });
}

function addTodo(date,text){

  const clean =
    String(text).trim();

  if(!clean){
    return;
  }

  todos.push({
    id:uid('todo_'),
    date,
    week:weekKey(parseDate(date)),
    text:clean,
    done:false
  });

  save(STORAGE.todos,todos);

  renderTodo();
}

/* ============================================================
   STATISTIQUES
   ============================================================ */

function isWorkPlacement(placement){

  if(
    placement.type==='course' ||
    placement.type==='revision' ||
    placement.type==='qcm' ||
    placement.type==='annale'
  ){
    return true;
  }

  if(placement.type==='block'){

    const block =
      getBlock(placement.refId);

    return block?.work !== false;

  }

  return false;
}

function getWorkedMinutesForWeek(){

  return placements
    .filter(
      p=>p.week===weekKey(currentWeekStart) &&
         p.done &&
         isWorkPlacement(p)
    )
    .reduce(
      (total,p)=>total+(p.durMin||0),
      0
    );
}

function getWorkedMinutesForDay(day){

  return placements
    .filter(
      p=>p.week===weekKey(currentWeekStart) &&
         p.day===day &&
         p.done &&
         isWorkPlacement(p)
    )
    .reduce(
      (total,p)=>total+(p.durMin||0),
      0
    );
}

function renderStats(){

  const cards =
    document.getElementById('statsCards');

  const totalMinutes =
    getWorkedMinutesForWeek();

  const hours =
    totalMinutes/60;

  const doneRevisions =
    revisions.filter(r=>r.done).length;

  const thisWeekRevisions =
    revisions.filter(r=>{

      return r.done &&
        r.completedAt &&
        sameWeek(
          parseDate(r.completedAt),
          currentWeekStart
        );

    }).length;

  const todoWeek =
    todos.filter(
      t=>t.week===weekKey(currentWeekStart)
    );

  const todoDone =
    todoWeek.filter(t=>t.done).length;

  cards.innerHTML = `

    <div class="stat">

      <div class="stat-label">
        Heures travaillées
      </div>

      <div class="stat-value">
        ${hours.toFixed(1)} h
      </div>

    </div>

    <div class="stat">

      <div class="stat-label">
        Révisions terminées
      </div>

      <div class="stat-value">
        ${doneRevisions}
      </div>

    </div>

    <div class="stat">

      <div class="stat-label">
        Révisions cette semaine
      </div>

      <div class="stat-value">
        ${thisWeekRevisions}
      </div>

    </div>

    <div class="stat">

      <div class="stat-label">
        To-do terminées
      </div>

      <div class="stat-value">
        ${todoDone}/${todoWeek.length}
      </div>

    </div>

  `;

  renderHoursChart();
}

function renderHoursChart(){

  const chart =
    document.getElementById('hoursChart');

  const values =
    DAYS.map((_,index)=>{
      return getWorkedMinutesForDay(index)/60;
    });

  const max =
    Math.max(...values,1);

  chart.innerHTML =
    values.map((value,index)=>{

      const height =
        Math.max(
          2,
          value/max*100
        );

      return `

        <div class="chart-day">

          <div class="chart-bar-wrap">

            <div
              class="chart-bar"
              style="height:${height}%"
              title="${value.toFixed(1)} h"
            ></div>

          </div>

          <div class="chart-hours">
            ${value.toFixed(1)} h
          </div>

          <div class="chart-label">
            ${DAYS[index].slice(0,3)}
          </div>

        </div>

      `;

    }).join('');
}

/* ============================================================
   BLOCS PERSONNALISÉS
   ============================================================ */

function showBlockForm(){

  const container =
    document.getElementById('blockFormContainer');

  container.innerHTML = `

    <div class="card" style="margin:0 0 14px;background:#fafafa">

      <div class="form-row">

        <div class="field">

          <label>Nom du bloc</label>

          <input
            id="newBlockName"
            placeholder="Ex : Travail personnel"
          >

        </div>

        <div class="field">

          <label>Couleur</label>

          <input
            id="newBlockColor"
            type="color"
            value="#d1d5db"
          >

        </div>

      </div>

      <label style="display:flex;gap:7px;align-items:center;font-size:13px">

        <input
          id="newBlockWork"
          type="checkbox"
          checked
          style="width:auto"
        >

        Compter ce bloc comme temps de travail

      </label>

      <div class="section-actions" style="margin-top:10px">

        <button class="btn primary" id="saveBlockBtn">
          Ajouter
        </button>

        <button class="btn" id="cancelBlockBtn">
          Annuler
        </button>

      </div>

    </div>
  `;

  document.getElementById('saveBlockBtn')
    .addEventListener('click',()=>{

      const name =
        document.getElementById('newBlockName')
          .value.trim();

      if(!name){
        alert('Entre un nom.');
        return;
      }

      blocks.push({
        id:uid('blk_'),
        name,
        color:
          document.getElementById('newBlockColor').value,
        work:
          document.getElementById('newBlockWork').checked
      });

      save(STORAGE.blocks,blocks);

      container.innerHTML='';

      renderBlocks();
      renderCalendar();

    });

  document.getElementById('cancelBlockBtn')
    .addEventListener('click',()=>{
      container.innerHTML='';
    });
}

function renderBlocks(){

  const container =
    document.getElementById('blocksList');

  if(!blocks.length){

    container.innerHTML =
      `<div class="empty">Aucun bloc.</div>`;

    return;
  }

  container.innerHTML =
    blocks.map(block=>`

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          border:1px solid var(--border);
          border-radius:10px;
          padding:10px;
          margin-bottom:7px;
        "
      >

        <div style="display:flex;align-items:center;gap:9px">

          <span
            style="
              width:12px;
              height:12px;
              border-radius:50%;
              background:${escapeHTML(block.color)}
            "
          ></span>

          <strong>
            ${escapeHTML(block.name)}
          </strong>

          <span style="color:#777;font-size:11px">
            ${
              block.work
                ? 'Temps de travail'
                : 'Hors temps de travail'
            }
          </span>

        </div>

        <button
          class="btn small danger"
          data-delete-block="${block.id}"
        >
          Supprimer
        </button>

      </div>

    `).join('');

  container.querySelectorAll('[data-delete-block]')
    .forEach(button=>{

      button.addEventListener('click',()=>{

        const id =
          button.dataset.deleteBlock;

        if(!confirm('Supprimer ce bloc ?')){
          return;
        }

        blocks =
          blocks.filter(b=>b.id!==id);

        placements =
          placements.filter(
            p=>!(p.type==='block' && p.refId===id)
          );

        saveAll();

        renderBlocks();
        renderCalendar();
        renderStats();

      });

    });
}

/* ============================================================
   POMODORO
   ============================================================ */

function setTimer(minutes){

  pauseTimer();

  const value =
    clamp(
      Number(minutes)||25,
      1,
      240
    );

  timerSeconds =
    value*60;

  localStorage.setItem(
    STORAGE.pomodoro,
    String(value)
  );

  document.getElementById('pomoCustom').value =
    value;

  renderTimer();
}

function renderTimer(){

  const minutes =
    Math.floor(timerSeconds/60);

  const seconds =
    timerSeconds%60;

  document.getElementById('timerDisplay')
    .textContent =
      `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function startTimer(){

  if(timerRunning) return;

  timerRunning=true;

  timerInterval =
    setInterval(()=>{

      if(timerSeconds<=0){

        pauseTimer();

        return;

      }

      timerSeconds--;

      renderTimer();

    },1000);
}

function pauseTimer(){

  timerRunning=false;

  if(timerInterval){
    clearInterval(timerInterval);
    timerInterval=null;
  }
}

function resetTimer(){

  pauseTimer();

  const saved =
    Number(
      localStorage.getItem(STORAGE.pomodoro)
    ) || 25;

  timerSeconds =
    saved*60;

  renderTimer();
}

/* ============================================================
   THÈME
   ============================================================ */

function applyTheme(theme){

  if(theme==='noir'){

    document.documentElement.style.setProperty(
      '--bg','#f4f5f7'
    );

    document.documentElement.style.setProperty(
      '--card','#ffffff'
    );

    document.documentElement.style.setProperty(
      '--text','#171717'
    );

    document.documentElement.style.setProperty(
      '--accent','#111111'
    );

  }else if(theme==='bleu'){

    document.documentElement.style.setProperty(
      '--bg','#eef5ff'
    );

    document.documentElement.style.setProperty(
      '--card','#ffffff'
    );

    document.documentElement.style.setProperty(
      '--text','#10213b'
    );

    document.documentElement.style.setProperty(
      '--accent','#2563eb'
    );

  }else if(theme==='vert'){

    document.documentElement.style.setProperty(
      '--bg','#effaf3'
    );

    document.documentElement.style.setProperty(
      '--card','#ffffff'
    );

    document.documentElement.style.setProperty(
      '--text','#163522'
    );

    document.documentElement.style.setProperty(
      '--accent','#16a34a'
    );

  }

  localStorage.setItem(
    STORAGE.theme,
    theme
  );
}

function cycleTheme(){

  const current =
    localStorage.getItem(STORAGE.theme) || 'noir';

  const themes =
    ['noir','bleu','vert'];

  const next =
    themes[
      (themes.indexOf(current)+1)%themes.length
    ];

  applyTheme(next);
}

/* ============================================================
   EXPORT / IMPORT
   ============================================================ */

function exportData(){

  const data = {

    version:6,

    exportedAt:
      new Date().toISOString(),

    subjects,
    courses,
    revisions,
    placements,
    todos,
    blocks,

    theme:
      localStorage.getItem(STORAGE.theme) || 'noir',

    pomodoro:
      localStorage.getItem(STORAGE.pomodoro) || '25'

  };

  const blob =
    new Blob(
      [JSON.stringify(data,null,2)],
      {type:'application/json'}
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href=url;

  a.download =
    'sauvegarde-planning-pass.json';

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}

function handleImport(event){

  const file =
    event.target.files[0];

  if(!file) return;

  const reader =
    new FileReader();

  reader.onload = ()=>{

    try{

      const data =
        JSON.parse(reader.result);

      if(!data || typeof data!=='object'){
        throw new Error('Fichier invalide');
      }

      if(!confirm(
        'Importer cette sauvegarde remplacera les données actuelles. Continuer ?'
      )){
        return;
      }

      subjects =
        Array.isArray(data.subjects)
          ? data.subjects
          : [];

      courses =
        Array.isArray(data.courses)
          ? data.courses
          : [];

      revisions =
        Array.isArray(data.revisions)
          ? data.revisions
          : [];

      placements =
        Array.isArray(data.placements)
          ? data.placements
          : [];

      todos =
        Array.isArray(data.todos)
          ? data.todos
          : [];

      blocks =
        Array.isArray(data.blocks)
          ? data.blocks
          : [];

      saveAll();

      if(data.theme){
        applyTheme(data.theme);
      }

      if(data.pomodoro){
        localStorage.setItem(
          STORAGE.pomodoro,
          String(data.pomodoro)
        );
      }

      alert('Sauvegarde importée.');

      location.reload();

    }catch(error){

      console.error(error);

      alert(
        'Impossible d’importer cette sauvegarde.'
      );

    }

  };

  reader.readAsText(file);

  event.target.value='';
}

/* ============================================================
   FERMETURE POPOVER EN CLIQUANT AILLEURS
   ============================================================ */

document.addEventListener('click',event=>{

  if(!event.target.closest('.pop')){
    /*
      On ne ferme pas systématiquement les popovers
      car les clics internes sont gérés localement.
    */
  }

});

/* ============================================================
   EXPOSITION GLOBALE
   ============================================================ */

window.PlanningRevision = {

  subjects,
  courses,
  revisions,
  placements,
  todos,
  blocks,

  renderCalendar,
  renderTracking,
  renderSuggestions,
  renderStats,
  renderTodo

};

/* ============================================================
   INITIALISATION
   ============================================================ */

function init(){

  loadData();

  buildInterface();

  const savedTheme =
    localStorage.getItem(STORAGE.theme) || 'noir';

  applyTheme(savedTheme);

  const savedPomo =
    Number(
      localStorage.getItem(STORAGE.pomodoro)
    ) || 25;

  timerSeconds =
    savedPomo*60;

  document.getElementById('pomoCustom').value =
    savedPomo;

  renderTimer();

  renderGreeting();
  renderQuote();

  renderSubjects();
  renderTracking();
  renderSuggestions();

  renderCalendar();
  renderTodo();

  renderStats();
  renderBlocks();

}

/*
  Le script est placé en bas du body dans index.html,
  mais on garde cette sécurité.
*/

if(document.readyState === 'loading'){

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

}else{

  init();

}

})();
