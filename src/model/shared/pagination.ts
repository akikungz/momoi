import { t } from "elysia";

export const PaginationRequest = t.Object({
  page: t.Optional(t.Number({ description: "Page number for pagination", default: 1 })),
  pageSize: t.Optional(t.Number({ description: "Number of items per page", default: 10 })),
});

export const PaginationResponse = t.Object({
  totalItems: t.Number({ description: "Total number of items available" }),
  totalPages: t.Number({ description: "Total number of pages available" }),
  currentPage: t.Number({ description: "Current page number" }),
  pageSize: t.Number({ description: "Number of items per page" }),
});