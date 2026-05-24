export function htmlToMarkdown(html: string): string {
	if (!html.trim()) {
		return "";
	}

	if (typeof DOMParser === "undefined") {
		return stripHtml(html);
	}

	const document = new DOMParser().parseFromString(html, "text/html");
	removeUnsafeNodes(document);

	return blockMarkdown(document.body)
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
			return inlineMarkdown(element).trim();
		case "div":
		case "section":
		case "article":
		case "header":
		case "footer":
		case "main":
		case "figure":
		case "figcaption":
			return blockMarkdown(element);
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6":
			return `${"#".repeat(Number(tagName.slice(1)))} ${inlineMarkdown(element).trim()}`;
		case "strong":
		case "b":
			return wrapInline("**", inlineMarkdown(element));
		case "em":
		case "i":
			return wrapInline("*", inlineMarkdown(element));
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
			return blockMarkdown(element);
		case "blockquote":
			return blockMarkdown(element)
				.split("\n")
				.map((line) => (line ? `> ${line}` : ">"))
				.join("\n");
		case "hr":
			return "---";
		default:
			return isBlockElement(element) ? blockMarkdown(element) : inlineMarkdown(element);
	}
}

function blockMarkdown(element: Element): string {
	const parts: string[] = [];
	let inline = "";

	const flushInline = () => {
		const value = inline.replace(/[ \t]{2,}/g, " ").trim();

		if (value) {
			parts.push(value);
		}

		inline = "";
	};

	for (const node of Array.from(element.childNodes)) {
		if (isBlockNode(node)) {
			flushInline();

			const value = nodeToMarkdown(node).trim();

			if (value) {
				parts.push(value);
			}

			continue;
		}

		inline += nodeToMarkdown(node);
	}

	flushInline();
	return parts.join("\n\n");
}

function inlineMarkdown(element: Element): string {
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
			const content = blockMarkdown(child).trim().replace(/\n/g, "\n  ");
			return `${marker} ${content}`;
		})
		.join("\n");
}

function linkMarkdown(element: HTMLElement): string {
	const href = element.getAttribute("href") || "";
	const label = inlineMarkdown(element).trim() || href;

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

function isBlockNode(node: ChildNode): boolean {
	return node.nodeType === Node.ELEMENT_NODE && isBlockElement(node as HTMLElement);
}

function isBlockElement(element: HTMLElement): boolean {
	return BLOCK_ELEMENTS.has(element.tagName.toLowerCase());
}

const BLOCK_ELEMENTS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"dd",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"li",
	"main",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"ul",
]);

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
