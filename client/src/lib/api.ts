import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export interface ApiErrorPayload {
  message: string;
  errors?: { path: string; message: string }[];
}

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload | undefined;
    if (data?.errors?.length) {
      return data.errors.map((e) => e.message).join(", ");
    }
    if (data?.message) return data.message;
    if (err.message) return err.message;
  }
  return "Что-то пошло не так";
}
