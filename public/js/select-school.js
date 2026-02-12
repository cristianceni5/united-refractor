document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const alertEl = document.getElementById("alert");
  const stepCity = document.getElementById("step-city");
  const stepSchool = document.getElementById("step-school");
  const stepRequest = document.getElementById("step-request");
  const stepRequestSent = document.getElementById("step-request-sent");
  const citySearch = document.getElementById("city-search");
  const cityList = document.getElementById("city-list");
  const schoolList = document.getElementById("school-list");
  const noSchoolsMsg = document.getElementById("no-schools-msg");
  const selectedCityBadge = document.getElementById("selected-city-badge");

  let allSchools = [];
  let cities = [];
  let selectedCity = "";

  // Carica tutte le scuole
  try {
    const { schools } = await API.getSchools();
    allSchools = schools || [];

    // Estrai città uniche ordinate
    const citySet = new Set();
    allSchools.forEach(s => {
      if (s.city) citySet.add(s.city);
    });
    cities = Array.from(citySet).sort((a, b) => a.localeCompare(b, "it"));

    renderCities(cities);
  } catch (err) {
    showAlert("Errore nel caricamento delle scuole", "error");
  }

  // ========================
  // Step 1: Città
  // ========================
  function renderCities(list) {
    if (list.length === 0) {
      cityList.innerHTML = `<div class="select-school-empty">Nessuna città trovata</div>`;
      return;
    }

    cityList.innerHTML = list.map(city => {
      const count = allSchools.filter(s => s.city === city).length;
      return `
        <button class="select-school-item" data-city="${escapeAttr(city)}">
          <div class="select-school-item-info">
            <span class="select-school-item-name">${escapeHtml(city)}</span>
            <span class="select-school-item-count">${count} scuol${count === 1 ? 'a' : 'e'}</span>
          </div>
          <span class="select-school-item-arrow">›</span>
        </button>
      `;
    }).join("");

    cityList.querySelectorAll(".select-school-item").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedCity = btn.dataset.city;
        showStep("school");
      });
    });
  }

  // Filtro città in tempo reale
  citySearch.addEventListener("input", () => {
    const q = citySearch.value.trim().toLowerCase();
    if (!q) {
      renderCities(cities);
      return;
    }
    const filtered = cities.filter(c => c.toLowerCase().includes(q));
    renderCities(filtered);
  });

  // ========================
  // Step 2: Scuole della città
  // ========================
  function renderSchools() {
    selectedCityBadge.textContent = selectedCity;

    const schoolsInCity = allSchools.filter(s => s.city === selectedCity);

    if (schoolsInCity.length === 0) {
      schoolList.innerHTML = "";
      noSchoolsMsg.classList.remove("hidden");
      return;
    }

    noSchoolsMsg.classList.add("hidden");
    schoolList.innerHTML = schoolsInCity.map(s => {
      const logoHtml = s.logo_url
        ? `<img src="${escapeAttr(s.logo_url)}" alt="" class="select-school-logo">`
        : `<div class="select-school-logo-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;

      return `
        <button class="select-school-item" data-school-id="${s.id}">
          <div class="select-school-item-left">
            ${logoHtml}
            <div class="select-school-item-info">
              <span class="select-school-item-name">${escapeHtml(s.name)}</span>
              ${s.address ? `<span class="select-school-item-address">${escapeHtml(s.address)}</span>` : ''}
            </div>
          </div>
          <span class="select-school-item-arrow">›</span>
        </button>
      `;
    }).join("");

    schoolList.querySelectorAll(".select-school-item").forEach(btn => {
      btn.addEventListener("click", () => selectSchool(btn.dataset.schoolId));
    });
  }

  async function selectSchool(schoolId) {
    const btns = schoolList.querySelectorAll(".select-school-item");
    btns.forEach(b => b.disabled = true);

    try {
      await API.selectSchool(schoolId);
      showAlert("Scuola selezionata! Reindirizzamento...", "success");
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 1000);
    } catch (err) {
      showAlert(err.message, "error");
      btns.forEach(b => b.disabled = false);
    }
  }

  // ========================
  // Step 3: Richiesta scuola
  // ========================
  document.getElementById("btn-request-school").addEventListener("click", () => {
    // Pre-compila la città se selezionata
    document.getElementById("req-school-city").value = selectedCity || "";
    showStep("request");
  });

  document.getElementById("form-request-school").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Invio in corso...";
    hideAlert();

    try {
      await API.requestSchool({
        name: document.getElementById("req-school-name").value,
        city: document.getElementById("req-school-city").value,
        province: document.getElementById("req-school-province").value || null,
        address: document.getElementById("req-school-address").value || null,
      });
      showStep("request-sent");
    } catch (err) {
      showAlert(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Invia richiesta";
    }
  });

  // ========================
  // Navigation
  // ========================
  document.getElementById("btn-back-city").addEventListener("click", () => {
    showStep("city");
  });

  document.getElementById("btn-back-school").addEventListener("click", () => {
    showStep("school");
  });

  function showStep(step) {
    [stepCity, stepSchool, stepRequest, stepRequestSent].forEach(s => s.classList.add("hidden"));
    hideAlert();

    switch (step) {
      case "city":
        stepCity.classList.remove("hidden");
        citySearch.value = "";
        renderCities(cities);
        break;
      case "school":
        stepSchool.classList.remove("hidden");
        renderSchools();
        break;
      case "request":
        stepRequest.classList.remove("hidden");
        break;
      case "request-sent":
        stepRequestSent.classList.remove("hidden");
        // Nasconde il link "salta"
        document.querySelector(".select-school-skip").classList.add("hidden");
        break;
    }
  }

  // ========================
  // Utils
  // ========================
  function showAlert(message, type) {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alertEl.className = "alert";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});
