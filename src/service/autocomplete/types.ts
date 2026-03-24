import type { Static } from "elysia";

import type {
	AutocompleteOption,
	AutocompleteQuery,
} from "@momoi/model/autocomplete";
import {
	AutocompleteCacheKeys,
	DEFAULT_AUTOCOMPLETE_LIMIT,
} from "@momoi/modules/autocomplete";

// -------------------- Type exports --------------------

export type AutocompleteQueryType = Static<typeof AutocompleteQuery>;
export type AutocompleteOptionType = Static<typeof AutocompleteOption>;

export { AutocompleteCacheKeys, DEFAULT_AUTOCOMPLETE_LIMIT };
