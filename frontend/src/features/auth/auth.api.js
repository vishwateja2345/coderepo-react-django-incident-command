import { get, post } from "../../shared/api/client.js";

export const authApi = {
    login: (email, password) => post("/auth/login", { email, password }),
    session: () => get("/auth/session"),
    logout: () => post("/auth/logout"),
};
