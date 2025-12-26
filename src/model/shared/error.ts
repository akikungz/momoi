import { t } from 'elysia';

export const ErrorResponse = t.Object({
  status: t.Number({ description: "HTTP status code" }),
  message: t.String({ description: "Error message" }),
});
