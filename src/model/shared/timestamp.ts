import { t } from 'elysia';

export const TimestampResponse = t.Object({
  createdAt: t.Date({ description: "Timestamp when the record was created" }),
  updatedAt: t.Date({ description: "Timestamp when the record was last updated" }),
});