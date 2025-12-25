import { Elysia, t } from "elysia";
import { PaginationRequest, PaginationResponse } from "./shared/pagination";

export const UserRole = t.Union([
  t.Literal("ADMIN"),
  t.Literal("INSTRUCTOR"),
  t.Literal("STUDENT")
], { description: "Role of the user in the system" });

export const getMeResponse = t.Object({
  id: t.Number({ description: "Unique identifier for the user" }),
  name: t.String({ description: "Full name of the user" }),
  email: t.String({ description: "Email address of the user" }),
  role: UserRole,
});

export const getSSHKeyData = t.Object({
  id: t.Number({ description: "Unique identifier for the SSH key" }),
  name: t.String({ description: "Name of the SSH key" }),
  publicKey: t.String({ description: "Public key string" }),
  createdAt: t.Date({ description: "Timestamp when the SSH key was created" }),
  updatedAt: t.Date({ description: "Timestamp when the SSH key was last updated" }),
});

export const getSSHKeyResponse = t.Object({
  values: t.Array(getSSHKeyData, { description: "List of SSH keys" }),
  ...PaginationResponse.properties
});

export const getSSHKeyRequestQuery = t.Object({
  ...PaginationRequest.properties
});

export const addSSHKeyRequestBody = t.Object({
  name: t.String({ description: "Name of the SSH key" }),
  publicKey: t.String({ description: "Public key string" }),
});

export const removeSSHKeyRequestBody = t.Object({
  keyIds: t.Array(t.Number(), { description: "Unique identifiers for the SSH keys to be removed" }),
});

export const userModel = new Elysia({ name: "user.model" })
  .model("GetMeResponse", getMeResponse)
  .model("GetSSHKeyData", getSSHKeyData)
  .model("GetSSHKeyResponse", getSSHKeyResponse)
  .model("GetSSHKeyRequestQuery", getSSHKeyRequestQuery)
  .model("AddSSHKeyRequestBody", addSSHKeyRequestBody)
  .model("RemoveSSHKeyRequestBody", removeSSHKeyRequestBody);
