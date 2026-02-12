document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const loading = document.getElementById("loading");
  const content = document.getElementById("view-profile-content");
  const errorContent = document.getElementById("error-content");

  // Get user ID from URL
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("id");

  if (!userId) {
    loading.classList.add("hidden");
    errorContent.classList.remove("hidden");
    return;
  }

  try {
    // Load current user for navbar
    const { profile: me } = await API.getProfile();
    document.getElementById("nav-user-name").textContent = me.nickname || me.full_name;
    const roleEl = document.getElementById("nav-user-role");
    roleEl.textContent = me.role === "co_admin" ? "Co-Admin" : me.role;
    roleEl.classList.add(`role-${me.role}`);

    // If it's the user's own profile, redirect to profile page
    if (userId === me.id) {
      window.location.href = "/profile.html";
      return;
    }

    // Load public profile
    const { profile } = await API.getPublicProfile(userId);

    // Page subtitle
    document.getElementById("page-subtitle").textContent = `Profilo di ${profile.full_name || "utente"}`;
    document.title = `${profile.full_name || "Utente"} - Project Gauss`;

    // Avatar
    const avatarEl = document.getElementById("vp-avatar");
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else if (profile.full_name) {
      avatarEl.textContent = profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }

    // Name
    document.getElementById("vp-name").textContent = profile.full_name || "Utente senza nome";

    // Role
    const vpRole = document.getElementById("vp-role");
    const roleLabel = profile.role === "co_admin" ? "Co-Admin" : profile.role;
    vpRole.textContent = roleLabel;
    vpRole.classList.add(`role-${profile.role}`);

    // Classe
    const classeEl = document.getElementById("vp-classe");
    if (["admin", "co_admin"].includes(profile.role)) {
      classeEl.textContent = "";
    } else if (profile.classe) {
      classeEl.textContent = `${profile.classe}${profile.sezione ? " " + profile.sezione : ""}`;
    }

    // Nickname
    document.getElementById("vp-nickname").textContent = profile.nickname ? '@' + profile.nickname : '';

    // Bio
    const bioEl = document.getElementById("vp-bio");
    if (profile.bio) {
      bioEl.textContent = profile.bio;
    } else {
      bioEl.textContent = "Nessuna bio impostata";
      bioEl.classList.add("text-muted");
    }

    // School
    const schoolEl = document.getElementById("vp-school");
    if (profile.school) {
      schoolEl.textContent = profile.school.name;
      schoolEl.href = `/view-school.html?id=${profile.school.id}`;
    } else {
      schoolEl.textContent = "Nessuna scuola";
      schoolEl.removeAttribute("href");
      schoolEl.style.pointerEvents = "none";
    }

    // Posts count
    document.getElementById("vp-posts-count").textContent = profile.posts_count;

    // Joined date
    document.getElementById("vp-joined").textContent =
      new Date(profile.created_at).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

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
