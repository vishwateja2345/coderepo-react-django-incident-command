import { get } from "../../shared/api/client.js";

export const statuspageApi = {
    overview: () => get("/statuspage"),
};
