import { Elysia, t } from "elysia";

import { PaginationRequest, PaginationResponse } from "./shared/pagination";
import { TimestampResponse } from "./shared/timestamp";

export const UserRole = t.Union(
	[t.Literal("ADMIN"), t.Literal("INSTRUCTOR"), t.Literal("STUDENT")],
	{ description: "Role of the user in the system" },
);

export const getMeResponse = t.Object({
	id: t.Number({ description: "Unique identifier for the user" }),
	name: t.String({ description: "Full name of the user" }),
	email: t.String({ description: "Email address of the user" }),
	image: t.Union([
		t.String({ description: "URL of the user's profile image" }),
		t.Null({ description: "No profile image set" }),
	]),
	role: UserRole,
});

export const getSSHKeyData = t.Object({
	id: t.Number({ description: "Unique identifier for the SSH key" }),
	name: t.String({ description: "Name of the SSH key" }),
	publicKey: t.String({ description: "Public key string" }),
	...TimestampResponse.properties,
});

export const getSSHKeyResponse = t.Object({
	values: t.Array(getSSHKeyData, { description: "List of SSH keys" }),
	...PaginationResponse.properties,
});

export const getSSHKeyRequestQuery = t.Object({
	...PaginationRequest.properties,
});

export const addSSHKeyRequestBody = t.Object({
	name: t.String({ description: "Name of the SSH key" }),
	publicKey: t.String({ description: "Public key string" }),
});

export const addSSHKeyResponse = getSSHKeyData;

export const removeSSHKeyRequestBody = t.Object({
	keyIds: t.Array(t.Number(), {
		description: "Unique identifiers for the SSH keys to be removed",
	}),
});

export const userModel = new Elysia({ name: "user.model" })
	.model("GetMeResponse", getMeResponse)
	.model("GetSSHKeyData", getSSHKeyData)
	.model("GetSSHKeyResponse", getSSHKeyResponse)
	.model("GetSSHKeyRequestQuery", getSSHKeyRequestQuery)
	.model("AddSSHKeyRequestBody", addSSHKeyRequestBody)
	.model("AddSSHKeyResponse", addSSHKeyResponse)
	.model("RemoveSSHKeyRequestBody", removeSSHKeyRequestBody)
	.prefix("model", "User");
