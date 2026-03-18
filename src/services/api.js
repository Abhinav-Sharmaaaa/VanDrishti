import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:9999/api/dummy",
});

export const fetchLevels = () => API.get("/data/FIIRM");