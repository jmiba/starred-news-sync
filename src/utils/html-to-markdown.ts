export function htmlToMarkdown(html: string): string {
	if (!html.trim()) {
		return "";
	}

	if (typeof DOMParser === "undefined") {
		return stripHtml(html);
	}

	const document = new DOMParser().parseFromString(html, "text/html");
	removeUnsafeNodes(document);

	return Array.from(document.body.childNodes)
		.map((node) => nodeToMarkdown(node).trim())
		.filter(Boolean)
		.join("\n\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function nodeToMarkdown(node: ChildNode): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return normalizeText(node.textContent || "");
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}

	const element = node as HTMLElement;
	const tagName = element.tagName.toLowerCase();

	switch (tagName) {
		case "br":
			return "\n";
		case "p":
		case "div":
		case "section":
		case "article":
		case "header":
		case "footer":
			return childMarkdown(element);
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return `${"#".repeat(Number(tagName.slice(1)))} ${childMarkdown(element).trim()}`;
		case "strong":
		case "b":
			return wrapInline("**", childMarkdown(element));
		case "em":
		case "i":
			return wrapInline("*", childMarkdown(element));
		case "code":
			if (element.parentElement?.tagName.toLowerCase() === "pre") {
				return element.textContent || "";
			}
			return `\`${(element.textContent || "").replace(/`/g, "\\`")}\``;
		case "pre":
			return `\`\`\`\n${element.textContent || ""}\n\`\`\``;
		case "a":
			return linkMarkdown(element);
		case "img":
			return imageMarkdown(element);
		case "ul":
			return listMarkdown(element, false);
		case "ol":
			return listMarkdown(element, true);
		case "li":
			return childMarkdown(element);
		case "blockquote":
			return childMarkdown(element)
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n");
		default:
			return childMarkdown(element);
	}
}

function childMarkdown(element: Element): string {
	return Array.from(element.childNodes)
		.map((node) => nodeToMarkdown(node))
		.join("")
		.replace(/[ \t]{2,}/g, " ");
}

function listMarkdown(element: Element, ordered: boolean): string {
	return Array.from(element.children)
		.filter((child) => child.tagName.toLowerCase() === "li")
		.map((child, index) => {
			const marker = ordered ? `${index + 1}.` : "-";
			const content = childMarkdown(child).trim().replace(/\n/g, "\n  ");
			return `${marker} ${content}`;
		})
		.join("\n");
}

function linkMarkdown(element: HTMLElement): string {
	const href = element.getAttribute("href") || "";
	const label = childMarkdown(element).trim() || href;

	if (!href || isUnsafeUrl(href)) {
		return label;
	}

	return `[${label}](${href})`;
}

function imageMarkdown(element: HTMLElement): string {
	const src = element.getAttribute("src") || "";

	if (!src || isUnsafeUrl(src)) {
		return "";
	}

	return `![${element.getAttribute("alt") || ""}](${src})`;
}

function wrapInline(marker: string, value: string): string {
	const trimmed = value.trim();

	if (!trimmed) {
		return "";
	}

	return `${marker}${trimmed}${marker}`;
}

function normalizeText(value: string): string {
	return value.replace(/\s+/g, " ");
}

function removeUnsafeNodes(document: Document): void {
	for (const element of Array.from(
		document.querySelectorAll("script, style, iframe, object, embed, form, input, button")
	)) {
		element.remove();
	}

	for (const element of Array.from(document.querySelectorAll("*"))) {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();

			if (name.startsWith("on") || (["href", "src"].includes(name) && isUnsafeUrl(attribute.value))) {
				element.removeAttribute(attribute.name);
			}
		}
	}
}

function isUnsafeUrl(value: string): boolean {
	return /^\s*(javascript|data):/i.test(value);
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
