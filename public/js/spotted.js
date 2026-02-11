document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("spotted-content");
  const alert = document.getElementById("alert");
  let currentProfile = null;

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    await loadSpotted();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Creazione spotted (char counter)
  const spottedTextarea = document.getElementById("spotted-body");
  const spottedCharCount = document.getElementById("spotted-char-count");
  if (spottedTextarea && spottedCharCount) {
    spottedTextarea.addEventListener("input", () => {
      spottedCharCount.textContent = `${spottedTextarea.value.length}/500`;
    });
  }

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
        "linear-gradient(135deg, #007AFF 0%, #34AADC 100%)",
        "linear-gradient(135deg, #5AC8FA 0%, #007AFF 100%)",
        "linear-gradient(135deg, #34AADC 0%, #0051D5 100%)",
        "linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)",
        "linear-gradient(135deg, #007AFF 0%, #64D2FF 100%)",
        "linear-gradient(135deg, #0051D5 0%, #34AADC 100%)",
        "linear-gradient(135deg, #30B0C7 0%, #007AFF 100%)",
        "linear-gradient(135deg, #5AC8FA 0%, #0051D5 100%)",
      ];

      // Genera un numero pseudocasuale stabile basato sull'ID dello spotted
      function anonNumber(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash) + id.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash % 90) + 10; // 10-99
      }

      container.innerHTML = spotted
        .map(
          (s, i) => `
        <div class="spotted-ig-card" data-id="${s.id}">
          <div class="spotted-ig-bubble" style="background: ${gradients[i % gradients.length]}">
            ${s.status === "pending" ? '<div class="spotted-pending-badge">⏳ In attesa</div>' : ""}
            <span class="spotted-ig-anon">Anonimo ${anonNumber(s.id)}</span>
            <p class="spotted-ig-text">${escapeHtml(s.body)}</p>
          </div>
          <div class="spotted-ig-bar">
            <div class="spotted-ig-actions">
              <button class="btn-like ${s.liked ? "liked" : ""}" onclick="toggleLike('${s.id}', this)">
                ${s.liked ? "❤️" : "🤍"} <span class="like-count">${s.likes_count}</span>
              </button>
              <button class="btn-comment" onclick="toggleComments('${s.id}', this)">
                💬 <span class="comment-label">Commenti</span>
              </button>
            </div>
            <div class="spotted-ig-meta">
              <span class="spotted-date">${timeAgo(s.created_at)}</span>
              ${
                s.is_own || (currentProfile && ['admin', 'co_admin'].includes(currentProfile.role))
                  ? `<button class="spotted-ig-delete" onclick="deleteSpotted('${s.id}')" title="Elimina">&times;</button>`
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
      `
        )
        .join("");
    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  window.toggleLike = async (spottedId, btn) => {
    try {
      const { liked, likes_count } = await API.toggleLikeSpotted(spottedId);
      btn.classList.toggle("liked", liked);
      btn.innerHTML = `${liked ? "❤️" : "🤍"} <span class="like-count">${likes_count}</span>`;
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
        .map(
          (c) => `
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
      `
        )
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
    if (!confirm("Sei sicuro di voler eliminare questo spotted?")) return;
    try {
      await API.deleteSpotted(id);
      showAlert("Spotted eliminato.", "success");
      await loadSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

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
