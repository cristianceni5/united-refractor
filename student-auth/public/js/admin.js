document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("admin-content");
  const alert = document.getElementById("alert");
  let currentProfile = null;

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Solo admin può accedere
    if (profile.role !== "admin") {
      window.location.href = "/dashboard.html";
      return;
    }

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    await loadUsers();
    await loadPendingSpotted();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Filtri
  document.getElementById("btn-filter").addEventListener("click", () => {
    loadUsers();
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });

  async function loadUsers() {
    const filters = {};
    const role = document.getElementById("filter-role").value;
    const classe = document.getElementById("filter-classe").value;
    if (role) filters.role = role;
    if (classe) filters.classe = classe;

    try {
      const { users } = await API.getUsers(filters);
      document.getElementById("users-count").textContent = users.length;

      const tbody = document.getElementById("users-table");
      tbody.innerHTML = users
        .map(
          (u) => `
        <tr>
          <td>${escapeHtml(u.full_name || "-")}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>
            <select class="role-select" data-user-id="${u.id}" ${u.id === currentProfile.id ? "disabled" : ""}>
              <option value="studente" ${u.role === "studente" ? "selected" : ""}>Studente</option>
              <option value="rappresentante" ${u.role === "rappresentante" ? "selected" : ""}>Rappresentante</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </td>
          <td>${escapeHtml(u.classe ? `${u.classe} ${u.sezione || ""}`.trim() : "-")}</td>
          <td>
            ${u.id !== currentProfile.id
              ? `<button class="btn btn-primary btn-sm btn-save-role" data-user-id="${u.id}">Salva</button>`
              : '<span style="color: var(--text-muted); font-size: 0.85rem;">Tu</span>'
            }
          </td>
        </tr>
      `
        )
        .join("");

      // Event listeners per i bottoni "Salva"
      document.querySelectorAll(".btn-save-role").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const userId = e.target.dataset.userId;
          const select = document.querySelector(`.role-select[data-user-id="${userId}"]`);
          const newRole = select.value;

          e.target.disabled = true;
          e.target.textContent = "...";

          try {
            await API.updateRole(userId, newRole);
            showAlert("Ruolo aggiornato con successo!", "success");
          } catch (err) {
            showAlert(err.message, "error");
          } finally {
            e.target.disabled = false;
            e.target.textContent = "Salva";
          }
        });
      });
    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    setTimeout(() => {
      alert.className = "alert";
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async function loadPendingSpotted() {
    try {
      const { spotted } = await API.getSpotted({ status: "pending" });
      const pending = spotted.filter((s) => s.status === "pending");
      document.getElementById("pending-count").textContent = pending.length;

      const container = document.getElementById("pending-spotted-list");
      const noMsg = document.getElementById("no-pending");

      if (pending.length === 0) {
        container.innerHTML = "";
        noMsg.classList.remove("hidden");
        return;
      }

      noMsg.classList.add("hidden");
      container.innerHTML = pending
        .map(
          (s) => `
        <div class="spotted-moderate-card" data-id="${s.id}">
          <p class="spotted-body">${escapeHtml(s.body)}</p>
          <div class="spotted-meta">
            <span>${new Date(s.created_at).toLocaleString("it-IT")}</span>
            <div class="spotted-actions">
              <button class="btn btn-sm" style="background: var(--success); color: white;" onclick="approveSpotted('${s.id}')">Approva</button>
              <button class="btn btn-danger btn-sm" onclick="rejectSpotted('${s.id}')">Rifiuta</button>
            </div>
          </div>
        </div>
      `
        )
        .join("");
    } catch (err) {
      // Non bloccare il caricamento
    }
  }

  window.approveSpotted = async (id) => {
    try {
      await API.moderateSpotted(id, "approved");
      showAlert("Spotted approvato!", "success");
      await loadPendingSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  window.rejectSpotted = async (id) => {
    try {
      await API.moderateSpotted(id, "rejected");
      showAlert("Spotted rifiutato.", "success");
      await loadPendingSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };
});
