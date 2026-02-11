document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("dashboard-content");
  const alertEl = document.getElementById("alert");
  let currentProfile = null;

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    // Card profilo
    document.getElementById("profile-name").textContent = profile.full_name || "-";
    document.getElementById("profile-email").textContent = profile.email;
    document.getElementById("profile-role").textContent = profile.role;
    document.getElementById("profile-classe").textContent =
      profile.classe ? `${profile.classe} ${profile.sezione || ""}`.trim() : "Non impostata";

    // Avatar
    const avatarEl = document.getElementById("profile-avatar");
    if (profile.full_name) {
      avatarEl.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

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

    // Admin-only: mostra tabs e carica dati
    if (profile.role === "admin") {
      document.getElementById("admin-tabs").classList.remove("hidden");
      initTabs();
      await loadPendingSpotted();
      await loadUsers();
      initBanModal();
      document.getElementById("btn-filter").addEventListener("click", () => loadUsers());
    }

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });

  // ========================
  // Tab System
  // ========================
  function initTabs() {
    document.querySelectorAll(".dash-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".dash-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
      });
    });
  }

  // ========================
  // Users Management
  // ========================
  async function loadUsers() {
    const filters = {};
    const roleFilter = document.getElementById("filter-role");
    const classeFilter = document.getElementById("filter-classe");
    if (roleFilter && roleFilter.value) filters.role = roleFilter.value;
    if (classeFilter && classeFilter.value) filters.classe = classeFilter.value;

    try {
      const { users } = await API.getUsers(filters);
      const countLabel = document.getElementById("users-count-label");
      if (countLabel) countLabel.textContent = `${users.length} utent${users.length === 1 ? 'e' : 'i'}`;

      const container = document.getElementById("users-list");
      if (!container) return;

      container.innerHTML = users.map(u => {
        const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
        const isPermanent = isBanned && new Date(u.banned_until).getFullYear() >= 2099;
        const isMe = u.id === currentProfile.id;

        let statusHtml = '';
        if (isPermanent) {
          statusHtml = '<span class="user-status status-banned">Bannato</span>';
        } else if (isBanned) {
          statusHtml = `<span class="user-status status-suspended">Sospeso fino al ${new Date(u.banned_until).toLocaleDateString("it-IT")}</span>`;
        } else {
          statusHtml = '<span class="user-status status-active">Attivo</span>';
        }

        const initials = (u.full_name || u.email || "?")
          .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

        return `
          <div class="user-card${isBanned ? ' user-banned' : ''}${isMe ? ' user-me' : ''}">
            <div class="user-card-left">
              <div class="user-avatar">${initials}</div>
              <div class="user-info-block">
                <div class="user-name">${escapeHtml(u.full_name || "-")}${isMe ? ' <span class="you-badge">Tu</span>' : ''}</div>
                <div class="user-email">${escapeHtml(u.email)}</div>
                <div class="user-meta">
                  <span class="user-role role-${u.role}">${u.role}</span>
                  ${u.classe ? `<span class="user-classe">${escapeHtml(`${u.classe}${u.sezione || ''}`)}</span>` : ''}
                  ${statusHtml}
                </div>
              </div>
            </div>
            ${!isMe ? `
            <div class="user-card-actions">
              <div class="role-switch">
                <select class="role-select" data-user-id="${u.id}">
                  <option value="studente" ${u.role === "studente" ? "selected" : ""}>Studente</option>
                  <option value="rappresentante" ${u.role === "rappresentante" ? "selected" : ""}>Rappresentante</option>
                  <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
                </select>
                <button class="btn btn-primary btn-sm btn-save-role" data-user-id="${u.id}">Salva ruolo</button>
              </div>
              <div class="ban-actions">
                ${isBanned
                  ? `<button class="btn btn-sm btn-unban" data-user-id="${u.id}">✓ Rimuovi ban</button>`
                  : `<button class="btn btn-sm btn-ban" data-user-id="${u.id}" data-user-name="${escapeHtml(u.full_name || u.email)}">Ban / Sospendi</button>`
                }
              </div>
            </div>` : ''}
          </div>
        `;
      }).join("");

      // Event: save role
      container.querySelectorAll(".btn-save-role").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const userId = e.target.dataset.userId;
          const select = container.querySelector(`.role-select[data-user-id="${userId}"]`);
          const newRole = select.value;
          e.target.disabled = true;
          e.target.textContent = "...";
          try {
            await API.updateRole(userId, newRole);
            showAlert("Ruolo aggiornato!", "success");
            await loadUsers();
          } catch (err) {
            showAlert(err.message, "error");
          }
        });
      });

      // Event: ban
      container.querySelectorAll(".btn-ban").forEach(btn => {
        btn.addEventListener("click", () => {
          openBanModal(btn.dataset.userId, btn.dataset.userName);
        });
      });

      // Event: unban
      container.querySelectorAll(".btn-unban").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Sei sicuro di voler rimuovere il ban?")) return;
          try {
            const result = await API.banUser(btn.dataset.userId, "unban");
            showAlert(result.message, "success");
            await loadUsers();
          } catch (err) {
            showAlert(err.message, "error");
          }
        });
      });

    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  // ========================
  // Spotted Moderation
  // ========================
  async function loadPendingSpotted() {
    try {
      const { spotted } = await API.getSpotted({ status: "pending" });
      const pending = spotted.filter(s => s.status === "pending");

      const badge = document.getElementById("mod-badge");
      const countLabel = document.getElementById("pending-count-label");
      const container = document.getElementById("pending-spotted-list");
      const noMsg = document.getElementById("no-pending");

      if (badge) {
        badge.textContent = pending.length;
        badge.classList.toggle("hidden", pending.length === 0);
      }
      if (countLabel) {
        countLabel.textContent = `${pending.length} in attesa`;
      }

      if (pending.length === 0) {
        if (container) container.innerHTML = "";
        if (noMsg) noMsg.classList.remove("hidden");
        return;
      }

      if (noMsg) noMsg.classList.add("hidden");
      if (!container) return;

      container.innerHTML = pending.map(s => `
        <div class="mod-card" data-id="${s.id}">
          <div class="mod-card-body">
            <p class="mod-text">${escapeHtml(s.body)}</p>
            <span class="mod-date">${new Date(s.created_at).toLocaleString("it-IT")}</span>
          </div>
          <div class="mod-card-actions">
            <button class="btn btn-sm btn-approve" data-id="${s.id}">
              ✓ Approva
            </button>
            <button class="btn btn-sm btn-reject" data-id="${s.id}">
              ✕ Rifiuta
            </button>
          </div>
        </div>
      `).join("");

      container.querySelectorAll(".btn-approve").forEach(btn => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await API.moderateSpotted(btn.dataset.id, "approved");
            showAlert("Spotted approvato!", "success");
            await loadPendingSpotted();
          } catch (err) {
            showAlert(err.message, "error");
            btn.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-reject").forEach(btn => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await API.moderateSpotted(btn.dataset.id, "rejected");
            showAlert("Spotted rifiutato.", "success");
            await loadPendingSpotted();
          } catch (err) {
            showAlert(err.message, "error");
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      // non bloccare
    }
  }

  // ========================
  // Ban Modal
  // ========================
  let banTargetUserId = null;

  function initBanModal() {
    const modal = document.getElementById("ban-modal");
    const closeBtn = document.getElementById("ban-modal-close");
    const cancelBtn = document.getElementById("ban-modal-cancel");
    const confirmBtn = document.getElementById("ban-modal-confirm");
    const durationGroup = document.getElementById("kick-duration-group");

    document.querySelectorAll('input[name="ban-action"]').forEach(radio => {
      radio.addEventListener("change", () => {
        durationGroup.style.display = radio.value === "kick" ? "block" : "none";
      });
    });

    closeBtn.addEventListener("click", () => closeBanModal());
    cancelBtn.addEventListener("click", () => closeBanModal());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeBanModal();
    });

    confirmBtn.addEventListener("click", async () => {
      if (!banTargetUserId) return;
      const action = document.querySelector('input[name="ban-action"]:checked').value;
      const hours = action === "kick" ? parseInt(document.getElementById("kick-duration").value) || 24 : null;
      const reason = document.getElementById("ban-reason").value || "";

      confirmBtn.disabled = true;
      confirmBtn.textContent = "...";
      try {
        const result = await API.banUser(banTargetUserId, action, hours, reason);
        showAlert(result.message, "success");
        closeBanModal();
        await loadUsers();
      } catch (err) {
        showAlert(err.message, "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Conferma";
      }
    });
  }

  function openBanModal(userId, userName) {
    banTargetUserId = userId;
    document.getElementById("ban-user-name").textContent = userName;
    document.getElementById("ban-reason").value = "";
    document.getElementById("kick-duration").value = "24";
    document.querySelector('input[name="ban-action"][value="kick"]').checked = true;
    document.getElementById("kick-duration-group").style.display = "block";
    document.getElementById("ban-modal").classList.remove("hidden");
  }

  function closeBanModal() {
    document.getElementById("ban-modal").classList.add("hidden");
    banTargetUserId = null;
  }

  // ========================
  // Utils
  // ========================
  function showAlert(message, type) {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
    setTimeout(() => { alertEl.className = "alert"; }, 3000);
  }
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
