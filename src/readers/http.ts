import { requestUrl } from "obsidian";

type RequestParams = Parameters<typeof requestUrl>[0];
type QueryValue = string | number | boolean | null | undefined;

export async function requestJson<T>(params: RequestParams): Promise<T> {
	const response = await requestUrl(params);
	return response.json as T;
}

export async function requestText(params: RequestParams): Promise<string> {
	const response = await requestUrl(params);
	return response.text;
}

export function joinUrl(baseUrl: string, path: string): string {
	const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
	const normalizedPath = path.replace(/^\/+/, "");

	if (!normalizedBase) {
		throw new Error("API URL is required.");
	}

	return `${normalizedBase}/${normalizedPath}`;
}

export function withQuery(url: string, params: Record<string, QueryValue>): string {
	const query = Object.entries(params)
		.filter((entry): entry is [string, Exclude<QueryValue, undefined>] => entry[1] !== undefined)
		.map(([key, value]) => {
			if (value === null) {
				return encodeURIComponent(key);
			}

			return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
		})
		.join("&");

	if (!query) {
		return url;
	}

	return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

export function formBody(params: Record<string, string | number | boolean>): string {
	const body = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		body.set(key, String(value));
	}

	return body.toString();
}

export function requireSetting(value: string, message: string): string {
	const trimmed = value.trim();

	if (!trimmed) {
		throw new Error(message);
	}

	return trimmed;
}

export function epochToIso(value: number | string | undefined): string | undefined {
	if (value === undefined || value === "") {
		return undefined;
	}

	const numericValue = typeof value === "string" ? Number(value) : value;

	if (!Number.isFinite(numericValue) || numericValue <= 0) {
		return undefined;
	}

	let milliseconds = numericValue;

	if (numericValue < 10_000_000_000) {
		milliseconds = numericValue * 1000;
	} else if (numericValue > 10_000_000_000_000) {
		milliseconds = Math.floor(numericValue / 1000);
	}

	return new Date(milliseconds).toISOString();
}
