import { t } from 'elysia';

export const TimestampResponse = t.Object({
  createdAt: t.Optional(
    t.Date({ description: "Timestamp when the record was created" })
  ),
  updatedAt: t.Optional(
    t.Date({ description: "Timestamp when the record was last updated" })
  ),
});