document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("profile-content");
  const alert = document.getElementById("alert");
  let currentAvatarUrl = null;

  try {
    const { profile } = await API.getProfile();

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.nickname || profile.full_name;
    const roleEl = document.getElementById("nav-user-role");
    const roleLabel = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.textContent = roleLabel;
    roleEl.classList.add(`role-${profile.role}`);

    // Popola form
    document.getElementById("profile-name").value = profile.full_name || "";
    document.getElementById("profile-nickname").value = profile.nickname || "";
    document.getElementById("profile-email").value = profile.email;
    document.getElementById("profile-role").value = roleLabel;
    document.getElementById("profile-classe").value = profile.classe || "";
    document.getElementById("profile-sezione").value = profile.sezione || "";
    document.getElementById("profile-bio").value = profile.bio || "";
    updateBioCount();

    // Avatar
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

    // Mostra banner se utente non ha scuola (e non è admin)
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

  // Bio char count
  const bioInput = document.getElementById("profile-bio");
  bioInput.addEventListener("input", updateBioCount);

  function updateBioCount() {
    const count = document.getElementById("profile-bio").value.length;
    document.getElementById("bio-char-count").textContent = `${count}/300`;
  }

  // Avatar upload
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

      // Salva subito l'avatar url nel profilo
      await API.updateProfile({ avatar_url: result.url });
      showAlert("Foto profilo aggiornata!", "success");
    } catch (err) {
      showAlert(err.message, "error");
      // Ripristina preview
      avatarPreview.textContent = "?";
    }
  });

  // Submit
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
      showAlert("Profilo aggiornato con successo!", "success");

      // Aggiorna la navbar
      document.getElementById("nav-user-name").textContent = data.full_name;
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
