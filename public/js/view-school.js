document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("view-school-content");
  const errorContent = document.getElementById("error-content");

  // Get school ID from URL
  const params = new URLSearchParams(window.location.search);
  const schoolId = params.get("id");

  if (!schoolId) {
    loading.classList.add("hidden");
    errorContent.classList.remove("hidden");
    return;
  }

  try {
    // Load current user for navbar
    const { profile: me } = await API.getProfile();
    document.getElementById("nav-user-name").textContent = me.full_name || me.email;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = me.role === "co_admin" ? "Co-Admin" : me.role;
    roleEl.classList.add(`role-${me.role}`);

    // Load school
    const { school } = await API.getSchool(schoolId);

    // Page
    document.getElementById("page-subtitle").textContent = school.name;
    document.title = `${school.name} - Project Gauss`;

    // Logo
    const logoEl = document.getElementById("vs-logo");
    if (school.logo_url) {
      logoEl.innerHTML = `<img src="${school.logo_url}" alt="${escapeHtml(school.name)}" style="width:100%;height:100%;object-fit:contain;border-radius:16px;">`;
    }

    // Name & location
    document.getElementById("vs-name").textContent = school.name;
    const locationParts = [school.city, school.province].filter(Boolean);
    document.getElementById("vs-location").textContent =
      "📍 " + locationParts.join(" (") + (school.province ? ")" : "");

    if (school.address) {
      document.getElementById("vs-address").textContent = school.address;
    }

    // Description
    const descSection = document.getElementById("vs-description-section");
    if (school.description) {
      document.getElementById("vs-description").textContent = school.description;
    } else {
      descSection.style.display = "none";
    }

    // Stats
    document.getElementById("vs-students-count").textContent = school.students_count;
    document.getElementById("vs-posts-count").textContent = school.posts_count;

    // Members grid
    const membersGrid = document.getElementById("vs-members-grid");
    const noMembers = document.getElementById("vs-no-members");
    const membersBadge = document.getElementById("vs-members-badge");

    membersBadge.textContent = school.students_count;

    if (school.members && school.members.length > 0) {
      membersGrid.innerHTML = school.members
        .map((m) => {
          const initials = (m.full_name || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          const avatarHtml = m.avatar_url
            ? `<img src="${m.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : initials;

          const roleLabel = m.role === "co_admin" ? "Co-Admin" : m.role;
          const classeStr = m.classe ? `${m.classe}${m.sezione ? " " + m.sezione : ""}` : "";

          return `
            <a href="/view-profile.html?id=${m.id}" class="vs-member-card">
              <div class="vs-member-avatar">${avatarHtml}</div>
              <div class="vs-member-info">
                <span class="vs-member-name">${escapeHtml(m.full_name || "Utente")}</span>
                <span class="vs-member-meta">
                  <span class="user-role role-${m.role}" style="font-size: 0.6rem; padding: 1px 8px;">${roleLabel}</span>
                  ${classeStr ? `<span class="vs-member-classe">${escapeHtml(classeStr)}</span>` : ""}
                </span>
              </div>
            </a>
          `;
        })
        .join("");
    } else {
      membersGrid.innerHTML = "";
      noMembers.classList.remove("hidden");
    }

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    loading.classList.add("hidden");
    errorContent.classList.remove("hidden");
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
