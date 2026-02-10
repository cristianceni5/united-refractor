document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("dashboard-content");

  try {
    const { profile } = await API.getProfile();

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    // Mostra link admin
    if (profile.role === "admin") {
      document.getElementById("nav-admin").classList.remove("hidden");
    }

    // Card profilo
    document.getElementById("profile-name").textContent = profile.full_name || "-";
    document.getElementById("profile-email").textContent = profile.email;
    document.getElementById("profile-role").textContent = profile.role;
    document.getElementById("profile-classe").textContent =
      profile.classe ? `${profile.classe} ${profile.sezione || ""}`.trim() : "Non impostata";

    // Welcome text
    document.getElementById("welcome-text").textContent =
      `Benvenuto, ${profile.full_name || profile.email}!`;

    // Stats e lista per admin/rappresentante
    if (["admin", "rappresentante"].includes(profile.role)) {
      try {
        const { users } = await API.getUsers();

        // Stats
        document.getElementById("stats-section").classList.remove("hidden");
        document.getElementById("stat-total").textContent = users.length;
        document.getElementById("stat-studenti").textContent =
          users.filter((u) => u.role === "studente").length;
        document.getElementById("stat-rappresentanti").textContent =
          users.filter((u) => u.role === "rappresentante").length;
        document.getElementById("stat-admin").textContent =
          users.filter((u) => u.role === "admin").length;

        // Tabella recenti
        document.getElementById("recent-users-section").classList.remove("hidden");
        const tbody = document.getElementById("recent-users-table");
        const recent = users.slice(0, 10);
        tbody.innerHTML = recent
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.full_name || "-")}</td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="user-role role-${u.role}">${u.role}</span></td>
            <td>${escapeHtml(u.classe ? `${u.classe} ${u.sezione || ""}`.trim() : "-")}</td>
          </tr>
        `
          )
          .join("");
      } catch (err) {
        // L'utente potrebbe non avere i permessi
      }
    }

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    // Token scaduto o non valido
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
