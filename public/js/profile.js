document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("profile-content");
  const profileView = document.getElementById("profile-view");
  const profileEdit = document.getElementById("profile-edit");
  const alert = document.getElementById("profile-alert");
  let currentAvatarUrl = null;
  let cachedProfile = null;

  // ========================
  // Toggle view / edit
  // ========================
  function showView() {
    profileView.classList.remove("hidden");
    profileEdit.classList.add("hidden");
  }

  function showEdit() {
    profileView.classList.add("hidden");
    profileEdit.classList.remove("hidden");
    // Se non c'è nickname, evidenzia il campo
    if (!cachedProfile.nickname) {
      const nicknameInput = document.getElementById("profile-nickname");
      nicknameInput.focus();
      nicknameInput.style.borderColor = 'var(--primary)';
      nicknameInput.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
    }
  }

  document.getElementById("btn-edit-profile").addEventListener("click", showEdit);
  document.getElementById("btn-cancel-edit").addEventListener("click", showView);

  // Il pulsante nel banner nickname porta direttamente in modifica
  document.getElementById("banner-edit-nickname").addEventListener("click", showEdit);

  // ========================
  // Popola dati
  // ========================
  function populateView(profile) {
    const roleLabel = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    const isAdmin = ['admin', 'co_admin'].includes(profile.role);

    // Avatar
    const avatarEl = document.getElementById("view-avatar");
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else if (profile.full_name) {
      avatarEl.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

    // Nome
    document.getElementById("view-name").textContent = profile.full_name || "Utente senza nome";

    // Nickname
    document.getElementById("view-nickname").textContent = profile.nickname ? '@' + profile.nickname : '';

    // Ruolo
    const roleEl = document.getElementById("view-role");
    roleEl.textContent = roleLabel;
    roleEl.className = `user-role role-${profile.role}`;

    // Classe
    const classeEl = document.getElementById("view-classe");
    if (isAdmin) {
      classeEl.textContent = '';
    } else if (profile.classe) {
      classeEl.textContent = `${profile.classe}${profile.sezione ? " " + profile.sezione : ""}`;
    } else {
      classeEl.textContent = '';
    }

    // Bio
    const bioEl = document.getElementById("view-bio");
    if (profile.bio) {
      bioEl.textContent = profile.bio;
      bioEl.classList.remove("text-muted");
    } else {
      bioEl.textContent = "Nessuna bio impostata";
      bioEl.classList.add("text-muted");
    }

    // Email
    document.getElementById("view-email").textContent = profile.email;

    // Scuola (nascosta per admin/co_admin)
    const schoolRow = document.getElementById("view-school-row");
    const schoolEl = document.getElementById("view-school");
    if (isAdmin) {
      schoolRow.style.display = 'none';
    } else if (profile.school) {
      schoolRow.style.display = '';
      schoolEl.textContent = profile.school.name;
      schoolEl.href = `/view-school.html?id=${profile.school.id}`;
    } else {
      schoolRow.style.display = '';
      schoolEl.textContent = "Nessuna scuola";
      schoolEl.removeAttribute("href");
      schoolEl.style.pointerEvents = "none";
    }

    // Post pubblicati
    document.getElementById("view-posts-count").textContent = profile.posts_count || 0;

    // Data iscrizione
    if (profile.created_at) {
      document.getElementById("view-joined").textContent =
        new Date(profile.created_at).toLocaleDateString("it-IT", {
          day: "numeric", month: "long", year: "numeric"
        });
    }
  }

  function populateForm(profile) {
    const roleLabel = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;

    document.getElementById("profile-name").value = profile.full_name || "";
    document.getElementById("profile-nickname").value = profile.nickname || "";
    document.getElementById("profile-classe").value = profile.classe || "";
    document.getElementById("profile-sezione").value = profile.sezione || "";
    document.getElementById("profile-bio").value = profile.bio || "";
    updateBioCount();

    // Avatar nel form
    const avatarPreview = document.getElementById("profile-avatar-preview");
    if (profile.avatar_url) {
      currentAvatarUrl = profile.avatar_url;
      avatarPreview.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else if (profile.full_name) {
      avatarPreview.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

    // Nascondi classe/sezione per admin e co_admin
    if (['admin', 'co_admin'].includes(profile.role)) {
      document.getElementById("classe-group").classList.add("hidden");
      document.getElementById("sezione-group").classList.add("hidden");
    }
  }

  try {
    const { profile } = await API.getProfile();
    cachedProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.nickname || profile.full_name;
    const roleEl = document.getElementById("nav-user-role");
    const roleLabel = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.textContent = roleLabel;
    roleEl.classList.add(`role-${profile.role}`);

    // Popola sia la vista che il form
    populateView(profile);
    populateForm(profile);

    // Banner nickname mancante
    if (!profile.nickname) {
      document.getElementById("no-nickname-banner").classList.remove("hidden");
    }

    // Banner scuola mancante (non per admin/co_admin)
    if (!profile.school_id && !['admin', 'co_admin'].includes(profile.role)) {
      document.getElementById("no-school-banner").classList.remove("hidden");
    }

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // ========================
  // Bio char count
  // ========================
  const bioInput = document.getElementById("profile-bio");
  bioInput.addEventListener("input", updateBioCount);

  function updateBioCount() {
    const count = document.getElementById("profile-bio").value.length;
    document.getElementById("bio-char-count").textContent = `${count}/300`;
  }

  // ========================
  // Avatar upload
  // ========================
  document.getElementById("avatar-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showAlert("Immagine troppo grande (max 8MB)", "error");
      return;
    }

    const avatarPreview = document.getElementById("profile-avatar-preview");
    avatarPreview.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:3px;"></div>';

    try {
      const result = await API.uploadAvatar(file);
      currentAvatarUrl = result.url;
      avatarPreview.innerHTML = `<img src="${result.url}" alt="Avatar">`;

      await API.updateProfile({ avatar_url: result.url });
      showAlert("Foto profilo aggiornata!", "success");

      // Aggiorna anche la vista
      cachedProfile.avatar_url = result.url;
      populateView(cachedProfile);
    } catch (err) {
      showAlert(err.message, "error");
      avatarPreview.textContent = "?";
    }
  });

  // ========================
  // Submit form
  // ========================
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Salvataggio...";
    hideAlert();

    try {
      const data = {
        full_name: document.getElementById("profile-name").value,
        nickname: document.getElementById("profile-nickname").value.trim().toLowerCase(),
        classe: document.getElementById("profile-classe").value,
        sezione: document.getElementById("profile-sezione").value,
        bio: document.getElementById("profile-bio").value,
      };

      if (currentAvatarUrl) {
        data.avatar_url = currentAvatarUrl;
      }

      await API.updateProfile(data);

      // Aggiorna cache e vista
      Object.assign(cachedProfile, data);
      populateView(cachedProfile);

      // Aggiorna la navbar
      document.getElementById("nav-user-name").textContent = data.nickname || data.full_name;

      // Nascondi banner nickname se ora è impostato
      if (data.nickname) {
        document.getElementById("no-nickname-banner").classList.add("hidden");
      }

      // Torna alla vista profilo
      showView();
      showAlert("Profilo aggiornato con successo!", "success");
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Salva modifiche";
    }
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });

  function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alert.className = "alert";
  }
});
