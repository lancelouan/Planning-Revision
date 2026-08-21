// ============================================================
// Planning Révisions — Supabase
// Authentification + synchronisation du planning
// ============================================================

const SUPABASE_URL =
  'https://lnumasxxapoqldslgizg.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_X1_rdT7gsNbxhs4RJst7QQ_B1XuuclE';

let supabaseClient = null;
let supabaseSyncStarted = false;

// ============================================================
// Initialisation Supabase
// ============================================================

async function initSupabase() {
  try {

    if (!window.supabase) {
      await new Promise((resolve, reject) => {

        const script = document.createElement('script');

        script.src =
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

        script.onload = resolve;

        script.onerror = () =>
          reject(
            new Error(
              'Impossible de charger Supabase JS'
            )
          );

        document.head.appendChild(script);
      });
    }

    if (
      !SUPABASE_PUBLISHABLE_KEY ||
      SUPABASE_PUBLISHABLE_KEY ===
        'REMPLACE_PAR_TA_CLE_PUBLISHABLE'
    ) {

      console.warn(
        '[Supabase] Clé publishable non configurée.'
      );

      return null;
    }

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

    console.log(
      '[Supabase] Client initialisé.'
    );

    return supabaseClient;

  } catch (error) {

    console.error(
      '[Supabase] Erreur d’initialisation :',
      error
    );

    return null;
  }
}

// ============================================================
// Utilisateur connecté
// ============================================================

async function getSupabaseUser() {

  if (!supabaseClient) {
    await initSupabase();
  }

  if (!supabaseClient) {
    return null;
  }

  const {
    data: { user },
    error
  } =
    await supabaseClient.auth.getUser();

  if (error) {

    console.warn(
      '[Supabase] Impossible de récupérer l’utilisateur :',
      error
    );

    return null;
  }

  return user || null;
}

// ============================================================
// Connexion
// ============================================================

async function signInSupabase(
  email,
  password
) {

  if (!supabaseClient) {
    await initSupabase();
  }

  if (!supabaseClient) {
    throw new Error(
      'Supabase n’est pas initialisé.'
    );
  }

  const {
    data,
    error
  } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  return data.user;
}

// ============================================================
// Déconnexion
// ============================================================

async function signOutSupabase() {

  if (!supabaseClient) {
    return;
  }

  const {
    error
  } =
    await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }

  supabaseSyncStarted = false;
}

// ============================================================
// Conversion des données vers Supabase
// ============================================================

function convertBlocksForSupabase(userId) {

  return blocks.map(block => ({
    id: block.id,
    user_id: userId,
    name: block.name,
    color: block.color,
    duration: block.duration ?? null,
    variable: block.variable ?? false,
    duration_options:
      block.durationOptions ?? null
  }));
}

function convertMatieresForSupabase(userId) {

  return matieres.map(matiere => ({
    id: matiere.id,
    user_id: userId,
    name: matiere.name,
    color: matiere.color
  }));
}

function convertPlacementsForSupabase(userId) {

  return placements.map(placement => ({
    id: placement.id,
    user_id: userId,
    type: placement.type,
    ref_id: placement.refId ?? null,
    day: placement.day,
    start_min: placement.startMin,
    dur_min: placement.durMin,
    week: placement.week,
    note: placement.note ?? null
  }));
}

// ============================================================
// Sauvegarde complète du planning
// ============================================================

async function syncPlanningToSupabase() {

  if (!supabaseClient) {
    return;
  }

  const user =
    await getSupabaseUser();

  if (!user) {
    return;
  }

  try {

    // --------------------------------------------------------
    // Blocks
    // --------------------------------------------------------

    const blocksData =
      convertBlocksForSupabase(user.id);

    if (blocksData.length > 0) {

      const {
        error
      } =
        await supabaseClient
          .from('blocks')
          .upsert(
            blocksData,
            {
              onConflict: 'id'
            }
          );

      if (error) {
        throw error;
      }
    }

    // --------------------------------------------------------
    // Matières
    // --------------------------------------------------------

    const matieresData =
      convertMatieresForSupabase(user.id);

    if (matieresData.length > 0) {

      const {
        error
      } =
        await supabaseClient
          .from('matieres')
          .upsert(
            matieresData,
            {
              onConflict: 'id'
            }
          );

      if (error) {
        throw error;
      }
    }

    // --------------------------------------------------------
    // Placements
    // --------------------------------------------------------

    const placementsData =
      convertPlacementsForSupabase(user.id);

    if (placementsData.length > 0) {

      const {
        error
      } =
        await supabaseClient
          .from('placements')
          .upsert(
            placementsData,
            {
              onConflict: 'id'
            }
          );

      if (error) {
        throw error;
      }
    }

    console.log(
      '[Supabase] Planning synchronisé.'
    );

  } catch (error) {

    console.error(
      '[Supabase] Erreur de synchronisation :',
      error
    );
  }
}

// ============================================================
// Chargement depuis Supabase
// ============================================================

async function loadPlanningFromSupabase() {

  if (!supabaseClient) {
    return false;
  }

  const user =
    await getSupabaseUser();

  if (!user) {
    return false;
  }

  try {

    // --------------------------------------------------------
    // Blocks
    // --------------------------------------------------------

    const {
      data: blocksData,
      error: blocksError
    } =
      await supabaseClient
        .from('blocks')
        .select('*')
        .eq('user_id', user.id);

    if (blocksError) {
      throw blocksError;
    }

    // --------------------------------------------------------
    // Matières
    // --------------------------------------------------------

    const {
      data: matieresData,
      error: matieresError
    } =
      await supabaseClient
        .from('matieres')
        .select('*')
        .eq('user_id', user.id);

    if (matieresError) {
      throw matieresError;
    }

    // --------------------------------------------------------
    // Placements
    // --------------------------------------------------------

    const {
      data: placementsData,
      error: placementsError
    } =
      await supabaseClient
        .from('placements')
        .select('*')
        .eq('user_id', user.id);

    if (placementsError) {
      throw placementsError;
    }

    // --------------------------------------------------------
    // Application des données
    // --------------------------------------------------------

    if (blocksData && blocksData.length > 0) {

      blocks = blocksData.map(block => ({
        id: block.id,
        name: block.name,
        color: block.color,
        duration: block.duration,
        variable: block.variable,
        durationOptions:
          block.duration_options || undefined
      }));

      persist(
        'pr_blocks',
        blocks
      );
    }

    if (matieresData && matieresData.length > 0) {

      matieres = matieresData.map(matiere => ({
        id: matiere.id,
        name: matiere.name,
        color: matiere.color
      }));

      persist(
        'pr_matieres',
        matieres
      );
    }

    if (placementsData) {

      placements = placementsData.map(placement => ({
        id: placement.id,
        type: placement.type,
        refId: placement.ref_id,
        day: placement.day,
        startMin: placement.start_min,
        durMin: placement.dur_min,
        week: placement.week,
        note: placement.note
      }));

      persist(
        'pr_placements',
        placements
      );
    }

    console.log(
      '[Supabase] Planning chargé depuis Supabase.'
    );

    return true;

  } catch (error) {

    console.error(
      '[Supabase] Erreur de chargement :',
      error
    );

    return false;
  }
}

// ============================================================
// Démarrage de la synchronisation
// ============================================================

async function startSupabaseSync() {

  if (supabaseSyncStarted) {
    return;
  }

  const user =
    await getSupabaseUser();

  if (!user) {
    return;
  }

  try {

    const {
      data: existingPlacements,
      error
    } =
      await supabaseClient
        .from('placements')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

    if (error) {
      throw error;
    }

    // --------------------------------------------------------
    // Si Supabase possède déjà un planning,
    // on le charge.
    // --------------------------------------------------------

    if (
      existingPlacements &&
      existingPlacements.length > 0
    ) {

      await loadPlanningFromSupabase();

      if (typeof ensureSpecialBlocks === 'function') {
        ensureSpecialBlocks();
      }

      if (typeof ensureDefaultMatieres === 'function') {
        ensureDefaultMatieres();
      }

      if (typeof renderBlocks === 'function') {
        renderBlocks();
      }

      if (typeof renderMatieres === 'function') {
        renderMatieres();
      }

      if (typeof renderCalendar === 'function') {
        renderCalendar();
      }

    }

    // --------------------------------------------------------
    // Sinon, on envoie le planning local vers Supabase.
    // --------------------------------------------------------

    else {

      await syncPlanningToSupabase();
    }

    supabaseSyncStarted = true;

    console.log(
      '[Supabase] Synchronisation prête.'
    );

  } catch (error) {

    console.error(
      '[Supabase] Erreur au démarrage de la synchronisation :',
      error
    );
  }
}

// ============================================================
// Gestion de l'écran de connexion
// ============================================================

async function setupSupabaseLogin() {

  const loginScreen =
    document.getElementById(
      'supabase-login'
    );

  const loginForm =
    document.getElementById(
      'supabase-login-form'
    );

  const message =
    document.getElementById(
      'supabase-login-message'
    );

  if (
    !loginScreen ||
    !loginForm
  ) {

    console.warn(
      '[Supabase] Écran de connexion introuvable.'
    );

    return;
  }

  // ----------------------------------------------------------
  // Session existante
  // ----------------------------------------------------------

  const user =
    await getSupabaseUser();

  if (user) {

    loginScreen.style.display =
      'none';

    console.log(
      '[Supabase] Utilisateur déjà connecté :',
      user.email
    );

    await startSupabaseSync();

  } else {

    loginScreen.style.display =
      'flex';

    console.log(
      '[Supabase] Aucun utilisateur connecté.'
    );
  }

  // ----------------------------------------------------------
  // Connexion
  // ----------------------------------------------------------

  loginForm.addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      const email =
        document.getElementById(
          'supabase-email'
        ).value.trim();

      const password =
        document.getElementById(
          'supabase-password'
        ).value;

      message.textContent =
        'Connexion en cours...';

      try {

        await signInSupabase(
          email,
          password
        );

        message.textContent = '';

        loginScreen.style.display =
          'none';

        console.log(
          '[Supabase] Connexion réussie.'
        );

        await startSupabaseSync();

      } catch (error) {

        console.error(
          '[Supabase] Erreur de connexion :',
          error
        );

        message.textContent =
          'E-mail ou mot de passe incorrect.';
      }
    }
  );
}

// ============================================================
// Initialisation
// ============================================================

window.addEventListener(
  'DOMContentLoaded',
  async () => {

    await initSupabase();

    await setupSupabaseLogin();

  }
);
