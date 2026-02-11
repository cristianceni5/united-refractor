document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("posts-content");
  const alert = document.getElementById("alert");
  let currentProfile = null;
  let currentFilter = "";

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.full_name || profile.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    // Mostra form creazione solo per admin/rappresentante
    if (["admin", "rappresentante"].includes(profile.role)) {
      document.getElementById("create-post-section").classList.remove("hidden");
    }

    await loadPosts();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Filtri categoria
  document.querySelectorAll(".filter-cat").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-cat").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.cat;
      loadPosts();
    });
  });

  // Creazione post
  const createForm = document.getElementById("create-post-form");
  if (createForm) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = createForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Pubblicazione...";

      try {
        await API.createPost({
          title: document.getElementById("post-title").value,
          body: document.getElementById("post-body").value,
          category: document.getElementById("post-category").value,
          image_url: document.getElementById("post-image").value || null,
          pinned: document.getElementById("post-pinned").checked,
        });

        createForm.reset();
        showAlert("Post pubblicato!", "success");
        await loadPosts();
      } catch (err) {
        showAlert(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Pubblica post";
      }
    });
  }

  // Logout
  document.getElementById("btn-logout").addEventListener("click", () => {
    API.logout();
  });

  async function loadPosts() {
    const filters = {};
    if (currentFilter) filters.category = currentFilter;

    try {
      const { posts } = await API.getPosts(filters);
      const container = document.getElementById("posts-list");
      const noMsg = document.getElementById("no-posts");

      if (posts.length === 0) {
        container.innerHTML = "";
        noMsg.classList.remove("hidden");
        return;
      }

      noMsg.classList.add("hidden");
      container.innerHTML = posts
        .map(
          (p) => `
        <div class="post-card ${p.pinned ? "post-pinned" : ""}">
          <div class="post-header">
            <div>
              <span class="post-category cat-${p.category}">${p.category}</span>
              ${p.pinned ? '<span class="post-pin">In evidenza</span>' : ""}
            </div>
            ${
              p.is_own || (currentProfile && currentProfile.role === "admin")
                ? `<div class="post-actions-menu">
                    <button class="btn btn-danger btn-sm" onclick="deletePost('${p.id}')">Elimina</button>
                  </div>`
                : ""
            }
          </div>
          <h3 class="post-title">${escapeHtml(p.title)}</h3>
          <p class="post-body">${escapeHtml(p.body)}</p>
          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" class="post-image" alt="Immagine post">` : ""}
          <div class="post-footer">
            <span>Pubblicato da ${escapeHtml(p.author_name)}</span>
            <span>${new Date(p.created_at).toLocaleString("it-IT")}</span>
          </div>
        </div>
      `
        )
        .join("");
    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  window.deletePost = async (id) => {
    if (!confirm("Sei sicuro di voler eliminare questo post?")) return;
    try {
      await API.deletePost(id);
      showAlert("Post eliminato.", "success");
      await loadPosts();
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
