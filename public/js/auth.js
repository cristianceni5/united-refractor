document.addEventListener("DOMContentLoaded", async () => {
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const formLogin = document.getElementById("form-login");
  const formSignup = document.getElementById("form-signup");
  const otpSection = document.getElementById("otp-section");
  const forgotSection = document.getElementById("forgot-section");
  const resetSection = document.getElementById("reset-section");
  const alert = document.getElementById("alert");

  // State per OTP
  let pendingEmail = "";
  let pendingOtpType = "signup"; // "signup" o "recovery"

  // Redirect se gia' autenticato
  if (API.isLoggedIn()) {
    window.location.href = "/dashboard.html";
    return;
  }

  // Mostra messaggio se email appena verificata
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("verified") === "1") {
    showAlert("✅ Email verificata! Ora puoi accedere.", "success");
    window.history.replaceState({}, "", "/");
  }

  // ==============================
  // OTP Input Setup
  // ==============================
  function setupOtpInputs(container) {
    const inputs = container.querySelectorAll(".otp-digit");
    inputs.forEach((input, i) => {
      input.addEventListener("input", (e) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        e.target.value = val;
        if (val) {
          e.target.classList.add("filled");
          if (i < inputs.length - 1) inputs[i + 1].focus();
        } else {
          e.target.classList.remove("filled");
        }
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !e.target.value && i > 0) {
          inputs[i - 1].focus();
          inputs[i - 1].value = "";
          inputs[i - 1].classList.remove("filled");
        }
      });

      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "");
        for (let j = 0; j < Math.min(pasted.length, inputs.length); j++) {
          inputs[j].value = pasted[j];
          inputs[j].classList.add("filled");
        }
        const focusIdx = Math.min(pasted.length, inputs.length - 1);
        inputs[focusIdx].focus();
      });
    });
  }

  function getOtpValue(container) {
    const inputs = container.querySelectorAll(".otp-digit");
    return Array.from(inputs).map((i) => i.value).join("");
  }

  function clearOtpInputs(container) {
    const inputs = container.querySelectorAll(".otp-digit");
    inputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); });
    if (inputs[0]) inputs[0].focus();
  }

  setupOtpInputs(document.getElementById("otp-inputs"));
  setupOtpInputs(document.getElementById("reset-otp-inputs"));

  // ==============================
  // Section visibility helpers
  // ==============================
  function showSection(section) {
    [formLogin, formSignup, otpSection, forgotSection, resetSection].forEach((s) => {
      s.classList.add("hidden");
    });
    document.querySelector(".tabs").classList.toggle("hidden", 
      section !== formLogin && section !== formSignup
    );
    // Nascondi OAuth/divider quando si mostrano sezioni OTP/reset
    const divider = document.querySelector(".auth-divider");
    const oauth = document.querySelector(".oauth-buttons");
    const oauthSoon = document.querySelector(".oauth-soon");
    const forgotLink = document.querySelector(".forgot-password-link");
    const isMainForm = section === formLogin || section === formSignup;
    if (divider) divider.classList.toggle("hidden", !isMainForm);
    if (oauth) oauth.classList.toggle("hidden", !isMainForm);
    if (oauthSoon) oauthSoon.classList.toggle("hidden", !isMainForm);
    if (forgotLink) forgotLink.classList.toggle("hidden", section !== formLogin);

    section.classList.remove("hidden");
    hideAlert();
  }

  function backToLogin() {
    showSection(formLogin);
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
  }

  // ==============================
  // Tab switching
  // ==============================
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    showSection(formLogin);
  });

  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    showSection(formSignup);
  });

  // ==============================
  // Login
  // ==============================
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
      // Controlla se l'utente ha una scuola assegnata
      try {
        const { profile } = await API.getProfile();
        if (!profile.school_id && !['admin', 'co_admin'].includes(profile.role)) {
          window.location.href = "/select-school.html";
        } else {
          window.location.href = "/dashboard.html";
        }
      } catch (e) {
        window.location.href = "/dashboard.html";
      }
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Accedi";
    }
  });

  // ==============================
  // Signup → OTP
  // ==============================
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

      const result = await API.signup(email, password, full_name);

      if (result.session) {
        localStorage.setItem("access_token", result.session.access_token);
        localStorage.setItem("refresh_token", result.session.refresh_token);
        window.location.href = "/select-school.html";
      } else if (result.requiresConfirmation) {
        // Mostra OTP form
        pendingEmail = email;
        pendingOtpType = "signup";
        document.getElementById("otp-email-display").textContent = email;
        showSection(otpSection);
        clearOtpInputs(document.getElementById("otp-inputs"));
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

  // ==============================
  // OTP Verification
  // ==============================
  document.getElementById("form-otp").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Verifica in corso...";
    hideAlert();

    const otp = getOtpValue(document.getElementById("otp-inputs"));
    if (otp.length !== 6) {
      showAlert("Inserisci tutti i 6 numeri del codice", "error");
      btn.disabled = false;
      btn.textContent = "Verifica";
      return;
    }

    try {
      const result = await API.verifyOtp(pendingEmail, otp, pendingOtpType);
      if (result.access_token) {
        localStorage.setItem("access_token", result.access_token);
        localStorage.setItem("refresh_token", result.refresh_token);
        // Dopo verifica OTP di signup, vai a selezionare la scuola
        if (pendingOtpType === "signup") {
          window.location.href = "/select-school.html";
        } else {
          window.location.href = "/dashboard.html";
        }
      } else {
        showAlert(result.message, "success");
        backToLogin();
      }
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Verifica";
    }
  });

  // Resend OTP
  document.getElementById("link-resend-otp").addEventListener("click", async (e) => {
    e.preventDefault();
    hideAlert();
    try {
      if (pendingOtpType === "signup") {
        // Per la registrazione non possiamo re-inviare facilmente via API senza ri-fare signup
        showAlert("📧 Se non hai ricevuto il codice, controlla lo spam", "success");
      } else {
        await API.forgotPassword(pendingEmail);
        showAlert("📧 Codice re-inviato! Controlla la posta", "success");
      }
      clearOtpInputs(document.getElementById("otp-inputs"));
    } catch (err) {
      showAlert(err.message, "error");
    }
  });

  // Back to login from OTP
  document.getElementById("link-back-login").addEventListener("click", (e) => {
    e.preventDefault();
    backToLogin();
  });

  // ==============================
  // Forgot Password
  // ==============================
  document.getElementById("link-forgot").addEventListener("click", (e) => {
    e.preventDefault();
    showSection(forgotSection);
    // Pre-fill email if entered in login
    const loginEmail = document.getElementById("login-email").value;
    if (loginEmail) document.getElementById("forgot-email").value = loginEmail;
  });

  document.getElementById("form-forgot").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Invio in corso...";
    hideAlert();

    const email = document.getElementById("forgot-email").value;

    try {
      await API.forgotPassword(email);
      // Mostra sezione reset password
      pendingEmail = email;
      pendingOtpType = "recovery";
      document.getElementById("reset-email-display").textContent = email;
      showSection(resetSection);
      clearOtpInputs(document.getElementById("reset-otp-inputs"));
      showAlert("📧 Codice inviato! Controlla la tua email", "success");
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Invia codice";
    }
  });

  document.getElementById("link-back-login-2").addEventListener("click", (e) => {
    e.preventDefault();
    backToLogin();
  });

  // ==============================
  // Reset Password
  // ==============================
  document.getElementById("form-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Reimpostazione...";
    hideAlert();

    const otp = getOtpValue(document.getElementById("reset-otp-inputs"));
    const newPassword = document.getElementById("reset-password").value;
    const confirmPassword = document.getElementById("reset-password-confirm").value;

    if (otp.length !== 6) {
      showAlert("Inserisci tutti i 6 numeri del codice", "error");
      btn.disabled = false;
      btn.textContent = "Reimposta password";
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert("Le password non coincidono", "error");
      btn.disabled = false;
      btn.textContent = "Reimposta password";
      return;
    }

    if (newPassword.length < 6) {
      showAlert("La password deve essere di almeno 6 caratteri", "error");
      btn.disabled = false;
      btn.textContent = "Reimposta password";
      return;
    }

    try {
      const result = await API.resetPassword(pendingEmail, otp, newPassword);
      showAlert("✅ " + result.message, "success");
      setTimeout(() => backToLogin(), 2000);
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Reimposta password";
    }
  });

  document.getElementById("link-back-login-3").addEventListener("click", (e) => {
    e.preventDefault();
    backToLogin();
  });

  // OAuth buttons disabled - coming soon

  function showAlert(message, type) {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alert.className = "alert";
  }
});
