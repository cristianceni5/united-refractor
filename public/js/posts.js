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
      initImageUpload();
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

  // Image Upload
  let selectedImageFile = null;

  function initImageUpload() {
    const uploadArea = document.getElementById("image-upload-area");
    const fileInput = document.getElementById("post-image-file");
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("image-preview");
    const removeBtn = document.getElementById("image-preview-remove");

    if (!uploadArea) return;

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        handleImageSelect(files[0]);
      }
    });

    // File input change
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleImageSelect(e.target.files[0]);
      }
    });

    // Remove image
    removeBtn.addEventListener("click", () => {
      selectedImageFile = null;
      previewContainer.classList.remove("has-image");
      previewImg.src = "";
      fileInput.value = "";
      document.getElementById("post-image").value = "";
      uploadArea.style.display = "";
    });

    function handleImageSelect(file) {
      if (file.size > 5 * 1024 * 1024) {
        showAlert("Immagine troppo grande (max 5MB)", "error");
        return;
      }

      selectedImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewContainer.classList.add("has-image");
        uploadArea.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  }

  // Creazione post
  const createForm = document.getElementById("create-post-form");
  if (createForm) {
    createForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = createForm.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Pubblicazione...";

      try {
        let imageUrl = null;

        // Upload image if selected
        if (selectedImageFile) {
          const progressEl = document.getElementById("upload-progress");
          const progressFill = document.getElementById("progress-bar-fill");
          if (progressEl) {
            progressEl.classList.add("active");
            progressFill.style.width = "30%";
          }

          try {
            const uploadResult = await API.uploadImage(selectedImageFile);
            imageUrl = uploadResult.url;
            if (progressFill) progressFill.style.width = "100%";
          } catch (uploadErr) {
            showAlert("Errore upload immagine: " + uploadErr.message, "error");
            if (progressEl) progressEl.classList.remove("active");
            btn.disabled = false;
            btn.textContent = "Pubblica post";
            return;
          }

          if (progressEl) {
            setTimeout(() => progressEl.classList.remove("active"), 500);
          }
        }

        await API.createPost({
          title: document.getElementById("post-title").value,
          body: document.getElementById("post-body").value,
          category: document.getElementById("post-category").value,
          image_url: imageUrl || null,
          pinned: document.getElementById("post-pinned").checked,
        });

        createForm.reset();
        selectedImageFile = null;
        const previewContainer = document.getElementById("image-preview-container");
        const uploadArea = document.getElementById("image-upload-area");
        if (previewContainer) previewContainer.classList.remove("has-image");
        if (uploadArea) uploadArea.style.display = "";

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
              ${p.pinned ? '<span class="post-pin">📌 In evidenza</span>' : ""}
            </div>
            ${
              p.is_own || (currentProfile && currentProfile.role === "admin")
                ? `<div class="post-actions-menu">
                    <button class="btn btn-danger btn-sm" style="border-radius: 999px;" onclick="deletePost('${p.id}')">Elimina</button>
                  </div>`
                : ""
            }
          </div>
          <h3 class="post-title">${escapeHtml(p.title)}</h3>
          <p class="post-body">${escapeHtml(p.body)}</p>
          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" class="post-image" alt="Immagine post" loading="lazy">` : ""}
          <div class="post-footer">
            <span>✍️ ${escapeHtml(p.author_name)}</span>
            <span>${timeAgo(p.created_at)}</span>
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
