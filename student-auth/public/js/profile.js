document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("profile-content");
  const alert = document.getElementById("alert");

  try {
    const { profile } = await API.getProfile();

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    if (profile.role === "admin") {
      document.getElementById("nav-admin").classList.remove("hidden");
    }

    // Popola form
    document.getElementById("profile-name").value = profile.full_name || "";
    document.getElementById("profile-email").value = profile.email;
    document.getElementById("profile-role").value = profile.role;
    document.getElementById("profile-classe").value = profile.classe || "";
    document.getElementById("profile-sezione").value = profile.sezione || "";

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

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
        classe: document.getElementById("profile-classe").value,
        sezione: document.getElementById("profile-sezione").value,
      };

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
