import { Elysia, t } from "elysia";

export const AutocompleteQuery = t.Object(
	{
		search: t.Optional(
			t.String({ description: "Search term to filter options" }),
		),
		limit: t.Optional(
			t.Number({
				minimum: 1,
				maximum: 50,
				default: 10,
				description: "Maximum number of options to return",
			}),
		),
	},
	{ description: "Query parameters for autocomplete endpoints" },
);

export const AutocompleteOption = t.Object(
	{
		id: t.Number({ description: "Unique identifier for the option" }),
		label: t.String({ description: "Display label for the option" }),
		isProjectBased: t.Optional(
			t.Boolean({ description: "Whether the course offering is project-based" }),
		),
	},
	{ description: "A single autocomplete option" },
);

export const AutocompleteResponse = t.Array(AutocompleteOption, {
	description: "List of autocomplete options",
});

export const autocompleteModel = new Elysia({ name: "autocomplete.model" })
	.model("AutocompleteQuery", AutocompleteQuery)
	.model("AutocompleteOption", AutocompleteOption)
	.model("AutocompleteResponse", AutocompleteResponse);
