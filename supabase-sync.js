// ============================================================
// Planning Révisions — Supabase
// Authentification
// ============================================================

const SUPABASE_URL =
  'https://lnumasxxapoqldslgizg.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_X1_rdT7gsNbxhs4RJst7QQ_B1XuuclE';

let supabaseClient = null;

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
// Récupérer l'utilisateur connecté
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
  // Vérification de la session existante
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

  } else {

    loginScreen.style.display =
      'flex';

    console.log(
      '[Supabase] Aucun utilisateur connecté.'
    );
  }

  // ----------------------------------------------------------
  // Formulaire de connexion
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
