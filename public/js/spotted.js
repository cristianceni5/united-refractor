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
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    await loadSpotted();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
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
      showAlert(result.message || "Spotted inviato!", "success");
      await loadSpotted();
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Invia spotted";
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
      container.innerHTML = spotted
        .map(
          (s) => `
        <div class="spotted-card" data-id="${s.id}">
          ${s.status === "pending" ? '<div class="spotted-pending-badge">In attesa di approvazione</div>' : ""}
          <p class="spotted-body">${escapeHtml(s.body)}</p>
          <div class="spotted-footer">
            <div class="spotted-actions">
              <button class="btn-like ${s.liked ? "liked" : ""}" onclick="toggleLike('${s.id}', this)">
                ${s.liked ? "&#9829;" : "&#9825;"} <span class="like-count">${s.likes_count}</span>
              </button>
              <button class="btn-comment" onclick="toggleComments('${s.id}', this)">
                &#128172; Commenti
              </button>
            </div>
            <div class="spotted-meta-right">
              <span class="spotted-date">${new Date(s.created_at).toLocaleString("it-IT")}</span>
              ${
                s.is_own || (currentProfile && currentProfile.role === "admin")
                  ? `<button class="btn btn-danger btn-sm" onclick="deleteSpotted('${s.id}')">Elimina</button>`
                  : ""
              }
            </div>
          </div>
          <div class="comments-section hidden" id="comments-${s.id}">
            <div class="comments-list" id="comments-list-${s.id}"></div>
            <form class="comment-form" onsubmit="submitComment(event, '${s.id}')">
              <input type="text" placeholder="Scrivi un commento anonimo..." required class="comment-input">
              <button type="submit" class="btn btn-primary btn-sm">Invia</button>
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
      btn.innerHTML = `${liked ? "&#9829;" : "&#9825;"} <span class="like-count">${likes_count}</span>`;
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
              c.is_own || (currentProfile && currentProfile.role === "admin")
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
});
