document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("spotted-content");
  const alertEl = document.getElementById("alert");
  let currentProfile = null;

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.nickname || profile.full_name;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    // Compose avatar
    const composeAvatar = document.getElementById("spotted-compose-avatar");
    if (composeAvatar) {
      if (profile.avatar_url) {
        composeAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
      } else if (profile.full_name) {
        composeAvatar.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      }
    }

    await loadSpotted();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Compose card toggle
  const toggleSpottedCompose = document.getElementById("toggle-spotted-compose");
  if (toggleSpottedCompose) {
    toggleSpottedCompose.addEventListener("click", () => {
      const body = document.getElementById("spotted-compose-body");
      const compose = document.getElementById("spotted-compose");
      compose.classList.toggle("open");
      body.classList.toggle("collapsed");
    });
  }

  // Char counter
  const spottedTextarea = document.getElementById("spotted-body");
  const spottedCharCount = document.getElementById("spotted-char-count");
  if (spottedTextarea && spottedCharCount) {
    spottedTextarea.addEventListener("input", () => {
      spottedCharCount.textContent = `${spottedTextarea.value.length}/500`;
    });
  }

  // Creazione spotted
  document.getElementById("create-spotted-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    const textarea = document.getElementById("spotted-body");
    btn.disabled = true;
    btn.textContent = "Invio...";

    try {
      const result = await API.createSpotted(textarea.value);
      textarea.value = "";
      if (spottedCharCount) spottedCharCount.textContent = "0/500";
      showAlert(result.message || "Spotted inviato!", "success");
      await loadSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Invia";
    }
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });

  async function loadSpotted() {
    try {
      const { spotted } = await API.getSpotted();
      const container = document.getElementById("spotted-list");
      const noMsg = document.getElementById("no-spotted");

      if (spotted.length === 0) {
        container.innerHTML = "";
        noMsg.classList.remove("hidden");
        return;
      }

      noMsg.classList.add("hidden");

      const gradients = [
        "linear-gradient(135deg, #007AFF 0%, #0051D5 100%)",
        "linear-gradient(135deg, #0051D5 0%, #0A84FF 100%)",
        "linear-gradient(135deg, #0A84FF 0%, #003CB3 100%)",
        "linear-gradient(135deg, #003CB3 0%, #007AFF 100%)",
        "linear-gradient(135deg, #0051D5 0%, #0066E6 100%)",
        "linear-gradient(135deg, #0066E6 0%, #003CB3 100%)",
        "linear-gradient(135deg, #007AFF 0%, #0A84FF 100%)",
        "linear-gradient(135deg, #003CB3 0%, #0051D5 100%)",
      ];

      function anonNumber(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash % 90) + 10;
      }

      container.innerHTML = spotted
        .map((s, i) => {
          const gradient = gradients[i % gradients.length];
          const anon = anonNumber(s.id);
          return `
            <div class="spotted-ig-card" data-id="${s.id}">
              <div class="spotted-ig-header" style="background: ${gradient}">
                ${s.status === "pending" ? '<div class="spotted-pending-badge">⏳ In attesa</div>' : ""}
                <div class="spotted-ig-avatar" style="background: rgba(255,255,255,0.2);">
                  ${anon}
                </div>
                <div class="spotted-ig-author">
                  <span class="spotted-ig-name">Anonimo ${anon}</span>
                  <span class="spotted-ig-time">${timeAgo(s.created_at)}</span>
                </div>
              </div>
              <div class="spotted-ig-body">
                <p class="spotted-ig-text">${escapeHtml(s.body)}</p>
              </div>
              <div class="spotted-ig-bar">
                <div class="spotted-ig-actions">
                  <button class="btn-like ${s.liked ? "liked" : ""}" onclick="toggleLike('${s.id}', this)">
                    <svg class="like-icon" width="18" height="18" viewBox="0 0 24 24" fill="${s.liked ? 'var(--error)' : 'none'}" stroke="${s.liked ? 'var(--error)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> <span class="like-count">${s.likes_count}</span>
                  </button>
                  <button class="btn-comment" onclick="toggleComments('${s.id}', this)">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> <span class="comment-label">Commenti</span> <span class="comment-count">${s.comments_count || 0}</span>
                  </button>
                </div>
                <div class="spotted-ig-meta">
                  ${
                    s.is_own || (currentProfile && ['admin', 'co_admin'].includes(currentProfile.role))
                      ? `<div class="card-more-wrap">
                          <button class="card-more-btn" onclick="toggleMoreMenu(event)" aria-label="Opzioni">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                          </button>
                          <div class="card-more-dropdown">
                            <button class="card-more-item danger" onclick="deleteSpotted('${s.id}')">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              Elimina
                            </button>
                          </div>
                        </div>`
                      : ""
                  }
                </div>
              </div>
              <div class="comments-section hidden" id="comments-${s.id}">
                <div class="comments-list" id="comments-list-${s.id}"></div>
                <form class="comment-form" onsubmit="submitComment(event, '${s.id}')">
                  <input type="text" placeholder="Scrivi un commento..." required class="comment-input">
                  <button type="submit" class="btn btn-primary btn-sm" style="border-radius: 999px;">Invia</button>
                </form>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  window.toggleLike = async (spottedId, btn) => {
    try {
      const { liked, likes_count } = await API.toggleLikeSpotted(spottedId);
      btn.classList.toggle("liked", liked);
      btn.innerHTML = `<svg class="like-icon" width="18" height="18" viewBox="0 0 24 24" fill="${liked ? 'var(--error)' : 'none'}" stroke="${liked ? 'var(--error)' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> <span class="like-count">${likes_count}</span>`;
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  window.toggleComments = async (spottedId, btn) => {
    const section = document.getElementById(`comments-${spottedId}`);
    const isHidden = section.classList.contains("hidden");

    if (isHidden) {
      section.classList.remove("hidden");
      await loadComments(spottedId);
    } else {
      section.classList.add("hidden");
    }
  };

  async function loadComments(spottedId) {
    const container = document.getElementById(`comments-list-${spottedId}`);
    try {
      const { comments } = await API.getSpottedComments(spottedId);

      if (comments.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">Nessun commento.</p>';
        return;
      }

      container.innerHTML = comments
        .map((c) => `
          <div class="comment">
            <div class="comment-body">
              <span class="comment-author">Anonimo</span>
              <span class="comment-text">${escapeHtml(c.body)}</span>
            </div>
            <div class="comment-meta">
              <span>${new Date(c.created_at).toLocaleString("it-IT")}</span>
              ${
                c.is_own || (currentProfile && ['admin', 'co_admin'].includes(currentProfile.role))
                  ? `<button class="btn-delete-comment" onclick="deleteComment('${c.id}', '${spottedId}')">&times;</button>`
                  : ""
              }
            </div>
          </div>
        `)
        .join("");
    } catch (err) {
      container.innerHTML = '<p style="color: var(--error); font-size: 0.85rem;">Errore nel caricamento commenti.</p>';
    }
  }

  window.submitComment = async (e, spottedId) => {
    e.preventDefault();
    const input = e.target.querySelector(".comment-input");
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;

    try {
      await API.createSpottedComment(spottedId, input.value);
      input.value = "";
      await loadComments(spottedId);
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  };

  window.deleteComment = async (commentId, spottedId) => {
    try {
      await API.deleteSpottedComment(commentId);
      await loadComments(spottedId);
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  window.deleteSpotted = async (id) => {
    closeAllMoreMenus();
    if (!confirm("Sei sicuro di voler eliminare questo spotted?")) return;
    try {
      await API.deleteSpotted(id);
      showAlert("Spotted eliminato.", "success");
      await loadSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  // Three-dots menu helpers
  window.toggleMoreMenu = (e) => {
    e.stopPropagation();
    const dropdown = e.currentTarget.nextElementSibling;
    const wasOpen = dropdown.classList.contains("open");
    closeAllMoreMenus();
    if (!wasOpen) dropdown.classList.add("open");
  };

  function closeAllMoreMenus() {
    document.querySelectorAll(".card-more-dropdown.open").forEach(d => d.classList.remove("open"));
  }

  document.addEventListener("click", () => closeAllMoreMenus());

  function showAlert(message, type) {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
    setTimeout(() => {
      alertEl.className = "alert";
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "ora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g fa`;
    return date.toLocaleDateString("it-IT");
  }
});
