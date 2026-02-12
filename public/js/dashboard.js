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
    document.getElementById("nav-user-name").textContent = profile.nickname || profile.full_name;
    const roleEl = document.getElementById("nav-user-role");
    const roleLabel = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.textContent = roleLabel;
    roleEl.classList.add(`role-${profile.role}`);

    // Hero section
    const heroRole = document.getElementById("profile-role");
    heroRole.textContent = roleLabel;
    heroRole.classList.add(`role-${profile.role}`);

    document.getElementById("profile-classe").textContent =
      ['admin', 'co_admin'].includes(profile.role) ? 'Onnipresente' :
      profile.classe ? `${profile.classe} ${profile.sezione || ""}`.trim() : "Non impostata";

    // Avatar
    const avatarEl = document.getElementById("profile-avatar");
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else if (profile.full_name) {
      avatarEl.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

    // Welcome greeting
    document.getElementById("welcome-text").textContent =
      `Ciao, ${(profile.full_name || profile.nickname).split(" ")[0]}!`;

    // Banner nickname mancante
    if (!profile.nickname) {
      document.getElementById("no-nickname-banner").classList.remove("hidden");
    }

    // Stats e lista per admin/co_admin/rappresentante
    if (["admin", "co_admin", "rappresentante"].includes(profile.role)) {
      document.getElementById("add-school-section").classList.remove("hidden");
      initAddSchool();

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
          users.filter((u) => ["admin", "co_admin"].includes(u.role)).length;

        // Recent users (card-based)
        document.getElementById("recent-users-section").classList.remove("hidden");
        const listContainer = document.getElementById("recent-users-list");
        const recent = users.slice(0, 10);
        listContainer.innerHTML = recent.map(u => {
          const initials = (u.full_name || u.nickname || "?")
            .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
          const avatarHtml = u.avatar_url
            ? `<img src="${escapeHtml(u.avatar_url)}" alt="Avatar">`
            : initials;
          const classeText = u.classe ? `${u.classe}${u.sezione || ""}` : "";
          const displayRole = u.role === 'co_admin' ? 'Co-Admin' : u.role;

          return `
            <a href="/view-profile.html?id=${u.id}" class="recent-user-item">
              <div class="recent-user-avatar">${avatarHtml}</div>
              <div class="recent-user-info">
                <div class="recent-user-name">${escapeHtml(u.full_name || u.nickname)}</div>
                <div class="recent-user-meta">
                  <span class="user-role role-${u.role}" style="font-size:0.62rem;padding:1px 8px;">${displayRole}</span>
                  ${classeText ? `<span class="recent-user-classe">${escapeHtml(classeText)}</span>` : ''}
                </div>
              </div>
            </a>
          `;
        }).join("");
      } catch (err) {
        // L'utente potrebbe non avere i permessi
      }
    }

    // Home feeds per tutti gli utenti con scuola (admin e co_admin vedono tutto)
    if (profile.school_id || ['admin', 'co_admin'].includes(profile.role)) {
      loadHomeFeeds();
    } else {
      // Utente senza scuola: mostra banner appropriato
      if (profile.pending_school_request) {
        const banner = document.getElementById("pending-school-banner");
        document.getElementById("pending-school-name").textContent =
          `${profile.pending_school_request.name} (${profile.pending_school_request.city})`;
        banner.classList.remove("hidden");
      } else {
        document.getElementById("no-school-banner").classList.remove("hidden");
      }
    }

    // Admin e co_admin: mostra tabs e carica dati
    if (["admin", "co_admin"].includes(profile.role)) {
      document.getElementById("admin-tabs").classList.remove("hidden");
      initTabs();
      await loadPendingSpotted();
      await loadSchoolRequests();
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
  // Home Feeds
  // ========================
  async function loadHomeFeeds() {
    const feedsEl = document.getElementById("home-feeds");
    if (!feedsEl) return;
    feedsEl.classList.remove("hidden");

    // Load posts
    try {
      const { posts } = await API.getPosts();
      const recentPosts = posts.slice(0, 5);

      renderFeedPosts(recentPosts);
    } catch (e) { /* ignore */ }

    // Load spotted
    try {
      const { spotted } = await API.getSpotted();
      const recentSpotted = spotted.slice(0, 5);
      renderFeedSpotted(recentSpotted);
    } catch (e) { /* ignore */ }
  }

  function renderFeedPosts(posts) {
    const container = document.getElementById("feed-posts");
    if (!posts.length) return;
    container.innerHTML = posts.map(p => {
      const authorInitials = (p.author_name || "?")
        .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      return `
        <a href="/posts.html" class="home-feed-item">
          <div class="home-feed-item-avatar">${
            p.author_avatar_url
              ? `<img src="${escapeHtml(p.author_avatar_url)}" alt="">`
              : authorInitials
          }</div>
          <div class="home-feed-item-content">
            <span class="home-feed-item-title">${escapeHtml(p.title)}</span>
            <span class="home-feed-item-meta">${escapeHtml(p.author_name || '')} · ${timeAgo(p.created_at)}</span>
          </div>
        </a>
      `;
    }).join("");
  }

  function renderFeedSpotted(spotted) {
    const container = document.getElementById("feed-spotted");
    if (!spotted.length) return;
    container.innerHTML = spotted.map(s => {
      const preview = s.body.length > 80 ? s.body.substring(0, 80) + "…" : s.body;
      return `
        <a href="/spotted.html" class="home-feed-item">
          <div class="home-feed-item-content" style="flex:1;">
            <span class="home-feed-item-title">${escapeHtml(preview)}</span>
            <span class="home-feed-item-meta">
              <span class="home-feed-spotted-stats">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${s.likes_count}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:8px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${s.comments_count || 0}
              </span>
              · ${timeAgo(s.created_at)}
            </span>
          </div>
        </a>
      `;
    }).join("");
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "ora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  }

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
        const isCoAdmin = currentProfile.role === 'co_admin';
        const targetIsAdmin = u.role === 'admin';
        const targetIsCoAdmin = u.role === 'co_admin';
        const canManage = !isMe && !(isCoAdmin && (targetIsAdmin || targetIsCoAdmin));

        let statusHtml = '';
        if (isPermanent) {
          statusHtml = '<span class="user-status status-banned">Bannato</span>';
        } else if (isBanned) {
          statusHtml = `<span class="user-status status-suspended">Sospeso fino al ${new Date(u.banned_until).toLocaleDateString("it-IT")}</span>`;
        } else {
          statusHtml = '<span class="user-status status-active">Attivo</span>';
        }

        const initials = (u.full_name || u.nickname || "?")
          .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

        const avatarHtml = u.avatar_url
          ? `<img src="${u.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : initials;

        const roleDisplayLabel = u.role === 'co_admin' ? 'Co-Admin' : u.role;

        const roleOptions = isCoAdmin
          ? `<option value="studente" ${u.role === "studente" ? "selected" : ""}>Studente</option>
             <option value="rappresentante" ${u.role === "rappresentante" ? "selected" : ""}>Rappresentante</option>
             <option value="co_admin" ${u.role === "co_admin" ? "selected" : ""}>Co-Admin</option>`
          : `<option value="studente" ${u.role === "studente" ? "selected" : ""}>Studente</option>
             <option value="rappresentante" ${u.role === "rappresentante" ? "selected" : ""}>Rappresentante</option>
             <option value="co_admin" ${u.role === "co_admin" ? "selected" : ""}>Co-Admin</option>
             <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>`;

        return `
          <div class="user-card${isBanned ? ' user-banned' : ''}${isMe ? ' user-me' : ''}">
            <div class="user-card-left">
              <a href="/view-profile.html?id=${u.id}" class="user-avatar" style="text-decoration:none;color:white;">${avatarHtml}</a>
              <div class="user-info-block">
                <div class="user-name"><a href="/view-profile.html?id=${u.id}" style="color:inherit;text-decoration:none;">${escapeHtml(u.full_name || "-")}</a>${isMe ? ' <span class="you-badge">Tu</span>' : ''}</div>
                <div class="user-email">${u.nickname ? '@' + escapeHtml(u.nickname) : escapeHtml(u.email)}</div>
                <div class="user-meta">
                  <span class="user-role role-${u.role}">${roleDisplayLabel}</span>
                  ${u.classe ? `<span class="user-classe">${escapeHtml(`${u.classe}${u.sezione || ''}`)}</span>` : ''}
                  ${statusHtml}
                </div>
              </div>
            </div>
            ${canManage ? `
            <div class="user-card-actions">
              <div class="role-switch">
                <select class="role-select" data-user-id="${u.id}">
                  ${roleOptions}
                </select>
                <button class="btn btn-primary btn-sm btn-save-role" data-user-id="${u.id}">Salva ruolo</button>
              </div>
              <div class="ban-actions">
                ${isBanned
                  ? `<button class="btn btn-sm btn-unban" data-user-id="${u.id}">Rimuovi ban</button>`
                  : `<button class="btn btn-sm btn-ban" data-user-id="${u.id}" data-user-name="${escapeHtml(u.full_name || u.nickname)}">Ban / Sospendi</button>`
                }
                ${currentProfile.role === 'admin' ? `<button class="btn btn-sm btn-delete-user" data-user-id="${u.id}" data-user-name="${escapeHtml(u.full_name || u.nickname)}" style="background:var(--danger);color:#fff;">Elimina</button>` : ''}
              </div>
            </div>` : isMe ? '' : `<div class="user-card-actions"><span style="color: var(--text-muted); font-size: 0.8rem;">Protetto</span></div>`}
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

      // Event: delete user (solo admin)
      container.querySelectorAll(".btn-delete-user").forEach(btn => {
        btn.addEventListener("click", async () => {
          const name = btn.dataset.userName;
          if (!confirm(`Sei sicuro di voler ELIMINARE definitivamente l'utente "${name}"? Questa azione è irreversibile.`)) return;
          if (!confirm(`Conferma eliminazione di "${name}". Verranno eliminati profilo, dati e account di autenticazione.`)) return;
          btn.disabled = true;
          btn.textContent = "...";
          try {
            const result = await API.deleteUser(btn.dataset.userId);
            showAlert(result.message, "success");
            await loadUsers();
          } catch (err) {
            showAlert(err.message, "error");
            btn.disabled = false;
            btn.textContent = "Elimina";
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
              Approva
            </button>
            <button class="btn btn-sm btn-reject" data-id="${s.id}">
              Rifiuta
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
  // School Requests
  // ========================
  async function loadSchoolRequests() {
    try {
      const { requests } = await API.getSchoolRequests("pending");
      const badge = document.getElementById("school-req-badge");
      const countLabel = document.getElementById("school-req-count-label");
      const container = document.getElementById("school-requests-list");
      const noMsg = document.getElementById("no-school-requests");

      if (badge) {
        badge.textContent = requests.length;
        badge.classList.toggle("hidden", requests.length === 0);
      }
      if (countLabel) {
        countLabel.textContent = `${requests.length} in attesa`;
      }

      if (requests.length === 0) {
        if (container) container.innerHTML = "";
        if (noMsg) noMsg.classList.remove("hidden");
        return;
      }

      if (noMsg) noMsg.classList.add("hidden");
      if (!container) return;

      container.innerHTML = requests.map(r => {
        const requesterName = r.requester?.full_name || r.requester?.nickname || "Utente sconosciuto";
        const locationParts = [r.city, r.province].filter(Boolean);
        const location = locationParts.join(" (") + (r.province ? ")" : "");
        const date = new Date(r.created_at).toLocaleString("it-IT");

        return `
          <div class="mod-card" data-id="${r.id}">
            <div class="mod-card-body">
              <p class="mod-text" style="font-weight:700;font-size:1.05rem;">${escapeHtml(r.name)}</p>
              <p style="margin:4px 0;color:var(--text-muted);">${escapeHtml(location)}</p>
              ${r.address ? `<p style="margin:2px 0;color:var(--text-muted);font-size:0.85rem;">${escapeHtml(r.address)}</p>` : ''}
              <p style="margin:6px 0;font-size:0.85rem;color:var(--text-muted);">
                Richiesta da <strong>${escapeHtml(requesterName)}</strong> il ${date}
              </p>
            </div>
            <div class="mod-card-actions">
              <button class="btn btn-sm btn-approve" data-id="${r.id}">
                Approva
              </button>
              <button class="btn btn-sm btn-reject" data-id="${r.id}">
                Rifiuta
              </button>
            </div>
          </div>
        `;
      }).join("");

      container.querySelectorAll(".btn-approve").forEach(btn => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            await API.moderateSchoolRequest(btn.dataset.id, "approved");
            showAlert("Scuola approvata e creata!", "success");
            await loadSchoolRequests();
            await loadSchools();
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
            await API.moderateSchoolRequest(btn.dataset.id, "rejected");
            showAlert("Richiesta rifiutata.", "success");
            await loadSchoolRequests();
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
  // School Management
  // ========================
  function initAddSchool() {
    const form = document.getElementById("form-add-school");
    const formWrapper = document.getElementById("school-form-wrapper");
    const toggleBtn = document.getElementById("btn-toggle-school-form");
    const cancelBtn = document.getElementById("btn-cancel-school");
    const logoInput = document.getElementById("school-logo");
    const logoPreview = document.getElementById("school-logo-preview");
    const logoImg = document.getElementById("school-logo-img");

    if (!form) return;

    loadSchools();

    toggleBtn.addEventListener("click", () => {
      resetSchoolForm();
      formWrapper.classList.toggle("hidden");
    });

    cancelBtn.addEventListener("click", () => {
      resetSchoolForm();
      formWrapper.classList.add("hidden");
    });

    logoInput.addEventListener("input", () => {
      const url = logoInput.value.trim();
      if (url) {
        logoImg.src = url;
        logoImg.onload = () => logoPreview.classList.remove("hidden");
        logoImg.onerror = () => logoPreview.classList.add("hidden");
      } else {
        logoPreview.classList.add("hidden");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      const editId = document.getElementById("school-edit-id").value;
      const isEditing = !!editId;

      btn.disabled = true;
      btn.textContent = isEditing ? "Salvataggio..." : "Aggiunta in corso...";

      const schoolData = {
        name: document.getElementById("school-name").value.trim(),
        city: document.getElementById("school-city").value.trim(),
        province: document.getElementById("school-province").value.trim().toUpperCase() || null,
        address: document.getElementById("school-address").value.trim() || null,
        logo_url: document.getElementById("school-logo").value.trim() || null,
        description: document.getElementById("school-description").value.trim() || null,
      };

      try {
        if (isEditing) {
          schoolData.school_id = editId;
          await API.updateSchool(schoolData);
          showAlert("Scuola aggiornata!", "success");
        } else {
          await API.createSchool(schoolData);
          showAlert("Scuola aggiunta!", "success");
        }
        resetSchoolForm();
        formWrapper.classList.add("hidden");
        await loadSchools();
      } catch (err) {
        showAlert(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Salva scuola";
      }
    });
  }

  function resetSchoolForm() {
    const form = document.getElementById("form-add-school");
    form.reset();
    document.getElementById("school-edit-id").value = "";
    document.getElementById("school-form-title").textContent = "Aggiungi scuola";
    document.getElementById("school-logo-preview").classList.add("hidden");
  }

  function editSchool(school) {
    document.getElementById("school-edit-id").value = school.id;
    document.getElementById("school-name").value = school.name || "";
    document.getElementById("school-city").value = school.city || "";
    document.getElementById("school-province").value = school.province || "";
    document.getElementById("school-address").value = school.address || "";
    document.getElementById("school-logo").value = school.logo_url || "";
    document.getElementById("school-description").value = school.description || "";
    document.getElementById("school-form-title").textContent = "Modifica scuola";

    const logoPreview = document.getElementById("school-logo-preview");
    const logoImg = document.getElementById("school-logo-img");
    if (school.logo_url) {
      logoImg.src = school.logo_url;
      logoPreview.classList.remove("hidden");
    } else {
      logoPreview.classList.add("hidden");
    }

    document.getElementById("school-form-wrapper").classList.remove("hidden");
    document.getElementById("school-form-wrapper").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadSchools() {
    try {
      const { schools } = await API.getSchools();
      const container = document.getElementById("schools-list");
      const noSchools = document.getElementById("no-schools");

      if (!schools || schools.length === 0) {
        container.innerHTML = "";
        noSchools.classList.remove("hidden");
        return;
      }

      noSchools.classList.add("hidden");
      container.innerHTML = schools.map(s => {
        const logoHtml = s.logo_url
          ? `<img src="${escapeHtml(s.logo_url)}" alt="${escapeHtml(s.name)}" class="school-card-logo">`
          : `<div class="school-card-logo-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;

        const locationParts = [s.city, s.province].filter(Boolean);
        const location = locationParts.join(" (") + (s.province ? ")" : "");

        return `
          <a href="/view-school.html?id=${s.id}" class="school-card" style="text-decoration:none;color:inherit;">
            <div class="school-card-left">
              ${logoHtml}
              <div class="school-card-info">
                <div class="school-card-name">${escapeHtml(s.name)}</div>
                <div class="school-card-location">${escapeHtml(location)}</div>
                ${s.address ? `<div class="school-card-address">${escapeHtml(s.address)}</div>` : ""}
                ${s.description ? `<div class="school-card-desc">${escapeHtml(s.description)}</div>` : ""}
              </div>
            </div>
            <button class="btn btn-sm btn-edit-school" data-school='${JSON.stringify(s).replace(/'/g, "&#39;")}'>Modifica</button>
          </a>
        `;
      }).join("");

      container.querySelectorAll(".btn-edit-school").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            const school = JSON.parse(btn.dataset.school);
            editSchool(school);
          } catch (parseErr) {
            console.error("Errore parsing dati scuola:", parseErr);
          }
        });
      });
    } catch (err) {
      // non bloccare
    }
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
