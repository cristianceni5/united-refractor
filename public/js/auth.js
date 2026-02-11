document.addEventListener("DOMContentLoaded", async () => {
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const formLogin = document.getElementById("form-login");
  const formSignup = document.getElementById("form-signup");
  const alert = document.getElementById("alert");

  // Redirect se gia' autenticato
  if (API.isLoggedIn()) {
    window.location.href = "/dashboard.html";
    return;
  }

  // Carica lista scuole per il form di registrazione
  try {
    const { schools } = await API.getSchools();
    const select = document.getElementById("signup-school");
    schools.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} - ${s.city}`;
      select.appendChild(opt);
    });
  } catch (err) {
    // Se non ci sono scuole, il select resta vuoto
  }

  // Tab switching
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    formLogin.classList.remove("hidden");
    formSignup.classList.add("hidden");
    hideAlert();
  });

  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    formSignup.classList.remove("hidden");
    formLogin.classList.add("hidden");
    hideAlert();
  });

  // Login
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = formLogin.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Accesso in corso...";
    hideAlert();

    try {
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      await API.login(email, password);
      window.location.href = "/dashboard.html";
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Accedi";
    }
  });

  // Signup
  formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = formSignup.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Registrazione in corso...";
    hideAlert();

    try {
      const full_name = document.getElementById("signup-name").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const school_id = document.getElementById("signup-school").value;

      const result = await API.signup(email, password, full_name, school_id);

      if (result.session) {
        localStorage.setItem("access_token", result.session.access_token);
        localStorage.setItem("refresh_token", result.session.refresh_token);
        window.location.href = "/dashboard.html";
      } else {
        showAlert(result.message, "success");
      }
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Registrati";
    }
  });

  function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alert.className = "alert";
  }
});
