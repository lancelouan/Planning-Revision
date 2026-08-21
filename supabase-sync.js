// ============================================================
// Planning Révisions — Supabase
// Module de connexion
// ============================================================

const SUPABASE_URL = 'https://lnumasxxapoqldslgizg.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_X1_rdT7gsNbxhs4RJst7QQ_B1XuuclE';

// ------------------------------------------------------------
// Chargement de Supabase JS
// ------------------------------------------------------------

let supabaseClient = null;

async function initSupabase() {
  try {
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');

        script.src =
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

        script.onload = resolve;
        script.onerror = () =>
          reject(new Error('Impossible de charger Supabase JS'));

        document.head.appendChild(script);
      });
    }

    if (
      !SUPABASE_PUBLISHABLE_KEY ||
      SUPABASE_PUBLISHABLE_KEY === 'REMPLACE_PAR_TA_CLE_PUBLISHABLE'
    ) {
      console.warn(
        '[Supabase] Clé publishable non configurée.'
      );
      return null;
    }

    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

    console.log('[Supabase] Client initialisé.');

    return supabaseClient;
  } catch (error) {
    console.error(
      '[Supabase] Erreur d’initialisation :',
      error
    );

    return null;
  }
}

// ------------------------------------------------------------
// État de connexion
// ------------------------------------------------------------

async function getSupabaseUser() {
  if (!supabaseClient) {
    await initSupabase();
  }

  if (!supabaseClient) return null;

  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser();

  if (error) {
    console.warn(
      '[Supabase] Impossible de récupérer l’utilisateur :',
      error
    );

    return null;
  }

  return user || null;
}

// ------------------------------------------------------------
// Connexion
// ------------------------------------------------------------

async function signInSupabase(email, password) {
  if (!supabaseClient) {
    await initSupabase();
  }

  if (!supabaseClient) {
    throw new Error('Supabase n’est pas initialisé.');
  }

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw error;
  }

  return data.user;
}

// ------------------------------------------------------------
// Déconnexion
// ------------------------------------------------------------

async function signOutSupabase() {
  if (!supabaseClient) return;

  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    throw error;
  }
}

// ------------------------------------------------------------
// Écoute des changements d’authentification
// ------------------------------------------------------------

async function watchSupabaseAuth(callback) {
  if (!supabaseClient) {
    await initSupabase();
  }

  if (!supabaseClient) return null;

  return supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      if (typeof callback === 'function') {
        callback(event, session);
      }
    }
  );
}

// ------------------------------------------------------------
// Initialisation automatique
// ------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
