document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("posts-content");
  const alertEl = document.getElementById("alert");
  let currentProfile = null;
  let currentFilter = "";

  try {
    const { profile } = await API.getProfile();
    currentProfile = profile;

    // Navbar
    document.getElementById("nav-user-name").textContent = profile.nickname || profile.full_name;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = profile.role === 'co_admin' ? 'Co-Admin' : profile.role;
    roleEl.classList.add(`role-${profile.role}`);

    // Mostra form creazione solo per admin/co-admin/rappresentante
    if (["admin", "co_admin", "rappresentante"].includes(profile.role)) {
      document.getElementById("create-post-section").classList.remove("hidden");
      initImageUpload();

      // Compose avatar
      const composeAvatar = document.getElementById("compose-avatar");
      if (composeAvatar) {
        if (profile.avatar_url) {
          composeAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
        } else if (profile.full_name) {
          composeAvatar.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
        }
      }
    }

    await loadPosts();

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
  }

  // Compose card toggle
  const toggleBtn = document.getElementById("toggle-create-post");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const body = document.getElementById("create-post-body");
      const card = toggleBtn.closest(".compose-card");
      card.classList.toggle("open");
      body.classList.toggle("collapsed");
    });
  }

  // Filtri categoria
  document.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.cat;
      loadPosts();
    });
  });

  // Toggle visibilità campo sconto al cambio categoria
  const categorySelect = document.getElementById("post-category");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      const discountField = document.getElementById("discount-field");
      if (e.target.value === "convenzione") {
        discountField.classList.remove("hidden");
      } else {
        discountField.classList.add("hidden");
      }
    });
  }

  // Image Upload & Reposition
  let selectedImageFile = null;
  let imgOffsetX = 0;      // current X offset (px, in display coords)
  let imgOffsetY = 0;      // current Y offset (px, in display coords)
  let imgScale = 1;        // current zoom scale
  let imgMinScale = 1;     // minimum scale to cover viewport
  let imgNaturalW = 0;
  let imgNaturalH = 0;

  function initImageUpload() {
    const uploadArea = document.getElementById("image-upload-area");
    const fileInput = document.getElementById("post-image-file");
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("image-preview");
    const removeBtn = document.getElementById("image-preview-remove");
    const hint = document.getElementById("image-preview-hint");

    if (!uploadArea) return;

    function calcMinScale() {
      // The image at scale=1 fills width via CSS width:100%.
      // We need scaled height >= container height always.
      const containerH = previewContainer.offsetHeight;
      const imgBaseH = previewImg.offsetHeight; // height at scale=1
      if (imgBaseH <= 0) return 1;
      return Math.max(1, containerH / imgBaseH);
    }

    function applyTransform() {
      previewImg.style.transform = `translate(-50%, -50%) scale(${imgScale}) translate(${imgOffsetX}px, ${imgOffsetY}px)`;
    }

    function clampOffset() {
      const containerW = previewContainer.offsetWidth;
      const containerH = previewContainer.offsetHeight;
      const scaledW = previewImg.offsetWidth * imgScale;
      const scaledH = previewImg.offsetHeight * imgScale;
      // Max pan: image can't reveal gap on any side
      const maxPanY = (scaledH - containerH) / (2 * imgScale);
      const maxPanX = (scaledW - containerW) / (2 * imgScale);
      imgOffsetY = Math.max(-maxPanY, Math.min(maxPanY, imgOffsetY));
      imgOffsetX = Math.max(-maxPanX, Math.min(maxPanX, imgOffsetX));
    }

    // --- Drag / Touch reposition ---
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;

    function pointerDown(e) {
      if (e.target === removeBtn) return;
      dragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startOffsetX = imgOffsetX;
      startOffsetY = imgOffsetY;
      if (hint) hint.classList.add("fade");
    }
    function pointerMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaX = (x - startX) / imgScale;
      const deltaY = (y - startY) / imgScale;
      imgOffsetX = startOffsetX + deltaX;
      imgOffsetY = startOffsetY + deltaY;
      clampOffset();
      applyTransform();
    }
    function pointerUp() { dragging = false; }

    // --- Scroll zoom ---
    previewContainer.addEventListener("wheel", (e) => {
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.05 : 0.05;
      imgScale = Math.max(imgMinScale, Math.min(3, imgScale + step));
      clampOffset();
      applyTransform();
      if (hint) hint.classList.add("fade");
    }, { passive: false });

    // --- Pinch zoom ---
    let lastPinchDist = 0;
    previewContainer.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    previewContainer.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = (dist - lastPinchDist) * 0.005;
        imgScale = Math.max(imgMinScale, Math.min(3, imgScale + delta));
        lastPinchDist = dist;
        clampOffset();
        applyTransform();
        if (hint) hint.classList.add("fade");
      }
    }, { passive: false });

    previewContainer.addEventListener("mousedown", pointerDown);
    previewContainer.addEventListener("mousemove", pointerMove);
    previewContainer.addEventListener("mouseup", pointerUp);
    previewContainer.addEventListener("mouseleave", pointerUp);
    previewContainer.addEventListener("touchstart", pointerDown, { passive: true });
    previewContainer.addEventListener("touchmove", pointerMove, { passive: false });
    previewContainer.addEventListener("touchend", pointerUp);

    if (!uploadArea) return;

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

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleImageSelect(e.target.files[0]);
      }
    });

    removeBtn.addEventListener("click", () => {
      selectedImageFile = null;
      imgOffsetX = 0;
      imgOffsetY = 0;
      imgScale = 1;
      imgMinScale = 1;
      imgNaturalW = 0;
      imgNaturalH = 0;
      previewImg.style.transform = "translate(-50%, -50%)";
      previewContainer.classList.remove("has-image");
      previewImg.src = "";
      fileInput.value = "";
      document.getElementById("post-image").value = "";
      uploadArea.style.display = "";
      if (hint) { hint.classList.remove("fade"); hint.textContent = "Trascina per riposizionare"; }
    });

    function initPreviewImage() {
      // Called after image loads to compute minScale, set default scale, center
      imgNaturalW = previewImg.naturalWidth;
      imgNaturalH = previewImg.naturalHeight;
      previewContainer.classList.add("has-image");
      uploadArea.style.display = "none";
      // Wait one frame for layout to settle
      requestAnimationFrame(() => {
        imgMinScale = calcMinScale();
        imgScale = imgMinScale;
        imgOffsetY = 0; // CSS centering handles default position
        applyTransform();
        if (hint) hint.classList.remove("fade");
      });
    }

    function handleImageSelect(file) {
      if (file.size > 5 * 1024 * 1024) {
        showAlert("Immagine troppo grande (max 5MB)", "error");
        return;
      }

      // Ridimensiona l'immagine a max 1080px di larghezza (risoluzione standard IG)
      resizeImage(file, 1080, 0.88).then(resizedFile => {
        selectedImageFile = resizedFile;
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewImg.onload = () => initPreviewImage();
        };
        reader.readAsDataURL(resizedFile);
      }).catch(() => {
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewImg.onload = () => initPreviewImage();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /**
   * Ritaglia l'immagine nella porzione visibile nel viewport 4:3.
   * Legge imgOffsetY e le dimensioni attuali del container per calcolare il crop.
   */
  function cropImageToViewport() {
    return new Promise((resolve) => {
      const container = document.getElementById("image-preview-container");
      const previewImg = document.getElementById("image-preview");
      if (!container || !previewImg || !imgNaturalW) { resolve(null); return; }

      const containerW = container.offsetWidth;
      const containerH = container.offsetHeight;

      // Image at scale=1: width = containerW, height follows aspect ratio
      const imgBaseH = containerW * (imgNaturalH / imgNaturalW);

      // Natural pixels per display pixel at current scale
      const natPerDisplay = imgNaturalW / (containerW * imgScale);

      // Visible crop in display coords (relative to scaled image top-left)
      const cropX = (containerW * imgScale - containerW) / 2 - imgOffsetX * imgScale;
      const cropY = (imgBaseH * imgScale - containerH) / 2 - imgOffsetY * imgScale;

      // Convert to natural pixels
      const sx = Math.round(Math.max(0, cropX * natPerDisplay));
      const sy = Math.round(Math.max(0, cropY * natPerDisplay));
      const sw = Math.round(containerW * natPerDisplay);
      const sh = Math.round(containerH * natPerDisplay);

      // Output size
      const outW = Math.min(sw, 1080);
      const outH = Math.round(outW * (containerH / containerW));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(null); return; }
          resolve(new File([blob], "post-cropped.jpg", { type: "image/jpeg" }));
        }, "image/jpeg", 0.90);
      };
      img.onerror = () => resolve(null);
      img.src = previewImg.src;
    });
  }

  /**
   * Ridimensiona un'immagine lato client a una larghezza max,
   * mantenendo l'aspect ratio. Risoluzione di riferimento: 1080px (come IG).
   */
  function resizeImage(file, maxWidth = 1080, quality = 0.88) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        // Se già sotto il max, restituisci originale
        if (w <= maxWidth) {
          resolve(file);
          return;
        }

        const ratio = maxWidth / w;
        w = maxWidth;
        h = Math.round(h * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(); return; }
            const resized = new File([blob], file.name, { type: "image/jpeg" });
            resolve(resized);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = url;
    });
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

        if (selectedImageFile) {
          // Crop dell'immagine nella posizione scelta dall'utente
          const croppedFile = await cropImageToViewport();
          const fileToUpload = croppedFile || selectedImageFile;

          const progressEl = document.getElementById("upload-progress");
          const progressFill = document.getElementById("progress-bar-fill");
          if (progressEl && progressFill) {
            progressEl.classList.add("active");
            progressFill.style.width = "30%";
          }

          try {
            const uploadResult = await API.uploadImage(fileToUpload);
            imageUrl = uploadResult.url;
            if (progressFill) progressFill.style.width = "100%";
          } catch (uploadErr) {
            showAlert("Errore upload immagine: " + uploadErr.message, "error");
            if (progressEl) progressEl.classList.remove("active");
            btn.disabled = false;
            btn.textContent = "Pubblica";
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
          discount: document.getElementById("post-discount").value || null,
        });

        createForm.reset();
        // Reset del campo sconto (visibile solo quando si seleziona "convenzione")
        document.getElementById("discount-field").classList.add("hidden");
        selectedImageFile = null;
        imgOffsetX = 0;
        imgOffsetY = 0;
        imgScale = 1;
        imgMinScale = 1;
        imgNaturalW = 0;
        imgNaturalH = 0;
        const previewContainer = document.getElementById("image-preview-container");
        const previewImgEl = document.getElementById("image-preview");
        const uploadArea = document.getElementById("image-upload-area");
        if (previewImgEl) previewImgEl.style.transform = "translate(-50%, -50%)";
        if (previewContainer) previewContainer.classList.remove("has-image");
        if (uploadArea) uploadArea.style.display = "";

        showAlert("Post pubblicato!" + (document.getElementById("post-category").value === "convenzione" && !['admin', 'co_admin'].includes(currentProfile.role) ? " In attesa di approvazione." : ""), "success");
        await loadPosts();
      } catch (err) {
        showAlert(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Pubblica";
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
        .map((p) => {
          // Author avatar
          const authorInitials = (p.author_name || "?")
            .split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
          const authorAvatarHtml = p.author_avatar_url
            ? `<img src="${escapeHtml(p.author_avatar_url)}" alt="Avatar">`
            : authorInitials;

          const canDelete = p.is_own || (currentProfile && ['admin', 'co_admin'].includes(currentProfile.role));
          const canModerate = currentProfile && ['admin', 'co_admin'].includes(currentProfile.role) && p.status === 'pending';
          const isPending = p.status === 'pending';
          const isConvenzione = p.category === 'convenzione';

          // Text truncation: collapse if > 140 chars
          const bodyText = escapeHtml(p.body);
          const isLong = p.body.length > 140;

          // Category labels
          const categoryLabels = {
            avviso: 'Avviso', evento: 'Evento', circolare: 'Circolare',
            convenzione: 'Convenzione', altro: 'Altro'
          };

          return `
            <div class="post-card ${p.pinned ? "post-pinned" : ""} ${isConvenzione ? "post-convenzione" : ""} ${isPending ? "post-pending" : ""}">
              ${isPending ? '<div class="pending-ribbon">⏳ In attesa di approvazione</div>' : ''}
              <div class="post-ig-header">
                <a href="/view-profile.html?id=${p.author_id}" class="post-ig-avatar">${authorAvatarHtml}</a>
                <div class="post-ig-header-info">
                  <a href="/view-profile.html?id=${p.author_id}" class="post-ig-author">${escapeHtml(p.author_name)}</a>
                  <div class="post-ig-meta">
                    <span class="post-ig-time">${timeAgo(p.created_at)}</span>
                  </div>
                </div>
                <div class="post-ig-header-right">
                  ${canDelete ? `
                    <div class="card-more-wrap">
                      <button class="card-more-btn" onclick="toggleMoreMenu(event)" aria-label="Opzioni">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </button>
                      <div class="card-more-dropdown">
                        <button class="card-more-item danger" onclick="deletePost('${p.id}')">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Elimina
                        </button>
                      </div>
                    </div>` : ""}
                </div>
              </div>
              ${p.image_url ? `
                <div class="post-ig-image-wrap">
                  <img src="${escapeHtml(p.image_url)}" class="post-ig-image" alt="Immagine post" loading="lazy"
                    onload="adjustImageRatio(this)">
                </div>` : ""}
              <div class="post-ig-body${!p.image_url ? ' post-ig-body-only' : ''}">
                <div class="post-ig-title">${escapeHtml(p.title)}</div>
                <div class="post-ig-text${isLong ? ' collapsed' : ''}" id="post-text-${p.id}">${bodyText}</div>
                ${isLong ? `<button class="post-ig-read-more" onclick="togglePostText('${p.id}', this)">altro</button>` : ''}
              </div>
              <div class="post-ig-footer">
                <div class="post-ig-badges">
                  <span class="post-category cat-${p.category}">${categoryLabels[p.category] || p.category}</span>
                  ${isConvenzione && p.discount ? `<span class="post-discount-pill">${escapeHtml(p.discount)}</span>` : ''}
                  ${p.pinned ? '<span class="post-pin">In evidenza</span>' : ""}
                </div>
                ${canModerate ? `
                <div class="post-moderate-actions">
                  <button class="btn btn-sm btn-approve" onclick="moderatePost('${p.id}', 'approved')">✓ Approva</button>
                  <button class="btn btn-sm btn-reject" onclick="moderatePost('${p.id}', 'rejected')">✕ Rifiuta</button>
                </div>` : ''}
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      showAlert(err.message, "error");
    }
  }

  window.deletePost = async (id) => {
    closeAllMoreMenus();
    if (!confirm("Sei sicuro di voler eliminare questo post?")) return;
    try {
      await API.deletePost(id);
      showAlert("Post eliminato.", "success");
      await loadPosts();
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

  // Toggle "altro" / "meno" per testi lunghi
  window.togglePostText = (postId, btn) => {
    const el = document.getElementById(`post-text-${postId}`);
    if (!el) return;
    el.classList.toggle("collapsed");
    btn.textContent = el.classList.contains("collapsed") ? "altro" : "meno";
  };

  // Determina aspect ratio immagine e aggiunge classe
  window.adjustImageRatio = (img) => {
    const wrap = img.parentElement;
    if (!wrap) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    // Rimuovi classi precedenti
    wrap.classList.remove("ratio-1x1", "ratio-4x5", "ratio-16x9");
    if (ratio > 1.5) {
      wrap.classList.add("ratio-16x9");       // panoramico
    } else if (ratio < 0.7) {
      wrap.classList.add("ratio-4x5");        // verticale
    } else if (ratio >= 0.95 && ratio <= 1.05) {
      wrap.classList.add("ratio-1x1");        // quadrato
    }
    // altrimenti usa il default 4:3
  };

  function showAlert(message, type) {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
    setTimeout(() => {
      alertEl.className = "alert";
    }, 3000);
  }

  async function moderatePost(postId, newStatus) {
    if (!confirm(`Sei sicuro di voler ${newStatus === 'approved' ? 'approvare' : 'rifiutare'} questo post?`)) {
      return;
    }

    try {
      await API.moderatePost(postId, newStatus);
      showAlert(
        `Post ${newStatus === 'approved' ? 'approvato' : 'rifiutato'} con successo!`,
        'success'
      );
      await loadPosts();
    } catch (err) {
      showAlert(err.message, 'error');
    }
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
