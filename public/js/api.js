const API = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("access_token");
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    };

    const res = await fetch(`/api/${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Errore nella richiesta");
    }

    return data;
  },

  // Auth
  async signup(email, password, full_name, school_id) {
    return this.request("auth-signup", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name, school_id }),
    });
  },

  async login(email, password) {
    const data = await this.request("auth-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data;
  },

  async logout() {
    try {
      await this.request("auth-logout", { method: "POST" });
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/";
    }
  },

  async oauthLogin(provider) {
    const data = await this.request("auth-oauth", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
    return data;
  },

  async verifyOtp(email, otp, type = "signup") {
    return this.request("auth-verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp, type }),
    });
  },

  async forgotPassword(email) {
    return this.request("auth-forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(email, otp, new_password) {
    return this.request("auth-reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
    });
  },

  // Profile
  async getProfile() {
    return this.request("get-profile", { method: "GET" });
  },

  async updateProfile(data) {
    return this.request("update-profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Users
  async getUsers(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params ? `get-users?${params}` : "get-users";
    return this.request(endpoint, { method: "GET" });
  },

  async updateRole(user_id, role) {
    return this.request("update-role", {
      method: "PUT",
      body: JSON.stringify({ user_id, role }),
    });
  },

  // Schools
  async getSchools() {
    return this.request("get-schools", { method: "GET" });
  },

  async createSchool(data) {
    return this.request("create-school", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSchool(data) {
    return this.request("update-school", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Posts
  async getPosts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params ? `get-posts?${params}` : "get-posts";
    return this.request(endpoint, { method: "GET" });
  },

  async createPost(data) {
    return this.request("create-post", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updatePost(data) {
    return this.request("update-post", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deletePost(post_id) {
    return this.request("delete-post", {
      method: "DELETE",
      body: JSON.stringify({ post_id }),
    });
  },

  // Spotted
  async getSpotted(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const endpoint = params ? `get-spotted?${params}` : "get-spotted";
    return this.request(endpoint, { method: "GET" });
  },

  async createSpotted(body) {
    return this.request("create-spotted", {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  async deleteSpotted(spotted_id) {
    return this.request("delete-spotted", {
      method: "DELETE",
      body: JSON.stringify({ spotted_id }),
    });
  },

  async moderateSpotted(spotted_id, status) {
    return this.request("moderate-spotted", {
      method: "PUT",
      body: JSON.stringify({ spotted_id, status }),
    });
  },

  async toggleLikeSpotted(spotted_id) {
    return this.request("toggle-like-spotted", {
      method: "POST",
      body: JSON.stringify({ spotted_id }),
    });
  },

  // Spotted Comments
  async getSpottedComments(spotted_id) {
    return this.request(`get-spotted-comments?spotted_id=${spotted_id}`, { method: "GET" });
  },

  async createSpottedComment(spotted_id, body) {
    return this.request("create-spotted-comment", {
      method: "POST",
      body: JSON.stringify({ spotted_id, body }),
    });
  },

  async deleteSpottedComment(comment_id) {
    return this.request("delete-spotted-comment", {
      method: "DELETE",
      body: JSON.stringify({ comment_id }),
    });
  },

  async banUser(user_id, action, duration_hours, reason) {
    return this.request("ban-user", {
      method: "PUT",
      body: JSON.stringify({ user_id, action, duration_hours, reason }),
    });
  },

  async uploadImage(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("Immagine troppo grande (max 8MB)"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await this.request("upload-image", {
            method: "POST",
            body: JSON.stringify({
              image: reader.result,
              filename: file.name,
              contentType: file.type,
            }),
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Errore nella lettura del file"));
      reader.readAsDataURL(file);
    });
  },

  async uploadAvatar(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("Immagine troppo grande (max 8MB)"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await this.request("upload-image", {
            method: "POST",
            body: JSON.stringify({
              image: reader.result,
              filename: file.name,
              contentType: file.type,
              folder: "avatars",
            }),
          });
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Errore nella lettura del file"));
      reader.readAsDataURL(file);
    });
  },

  isLoggedIn() {
    return !!localStorage.getItem("access_token");
  },
};
