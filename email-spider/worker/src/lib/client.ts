import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
export const client = axios.create({
  baseURL: process.env.STRAPI_URL,
  headers: {
    Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
  },
});
