export function md5(input: string): string {
	const bytes = utf8Bytes(input);
	const bitLength = bytes.length * 8;
	const lowBits = bitLength >>> 0;
	const highBits = Math.floor(bitLength / 0x100000000) >>> 0;
	const shifts = [
		7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
		5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
		4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
		6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
	];
	const constants = Array.from({ length: 64 }, (_, index) =>
		Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
	);

	bytes.push(0x80);

	while (bytes.length % 64 !== 56) {
		bytes.push(0);
	}

	for (let index = 0; index < 4; index++) {
		bytes.push((lowBits >>> (index * 8)) & 0xff);
	}

	for (let index = 0; index < 4; index++) {
		bytes.push((highBits >>> (index * 8)) & 0xff);
	}

	let a0 = 0x67452301;
	let b0 = 0xefcdab89;
	let c0 = 0x98badcfe;
	let d0 = 0x10325476;

	for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
		const words = new Array<number>(16);

		for (let wordIndex = 0; wordIndex < 16; wordIndex++) {
			const offset = chunkStart + wordIndex * 4;
			words[wordIndex] =
				(bytes[offset] ?? 0) |
				((bytes[offset + 1] ?? 0) << 8) |
				((bytes[offset + 2] ?? 0) << 16) |
				((bytes[offset + 3] ?? 0) << 24);
		}

		let a = a0;
		let b = b0;
		let c = c0;
		let d = d0;

		for (let index = 0; index < 64; index++) {
			let f: number;
			let g: number;

			if (index < 16) {
				f = (b & c) | (~b & d);
				g = index;
			} else if (index < 32) {
				f = (d & b) | (~d & c);
				g = (5 * index + 1) % 16;
			} else if (index < 48) {
				f = b ^ c ^ d;
				g = (3 * index + 5) % 16;
			} else {
				f = c ^ (b | ~d);
				g = (7 * index) % 16;
			}

			const previousD = d;
			d = c;
			c = b;
			b = add32(b, rotateLeft(add32(a, f, constants[index]!, words[g]!), shifts[index]!));
			a = previousD;
		}

		a0 = add32(a0, a);
		b0 = add32(b0, b);
		c0 = add32(c0, c);
		d0 = add32(d0, d);
	}

	return [a0, b0, c0, d0].map(wordToHex).join("");
}

function utf8Bytes(input: string): number[] {
	const bytes: number[] = [];

	for (let index = 0; index < input.length; index++) {
		let codePoint = input.charCodeAt(index);

		if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < input.length) {
			const next = input.charCodeAt(index + 1);

			if (next >= 0xdc00 && next <= 0xdfff) {
				codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
				index++;
			}
		}

		if (codePoint < 0x80) {
			bytes.push(codePoint);
		} else if (codePoint < 0x800) {
			bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
		} else if (codePoint < 0x10000) {
			bytes.push(
				0xe0 | (codePoint >> 12),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f)
			);
		} else {
			bytes.push(
				0xf0 | (codePoint >> 18),
				0x80 | ((codePoint >> 12) & 0x3f),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f)
			);
		}
	}

	return bytes;
}

function add32(...values: number[]): number {
	let result = 0;

	for (const value of values) {
		result = (result + value) >>> 0;
	}

	return result;
}

function rotateLeft(value: number, shift: number): number {
	return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function wordToHex(word: number): string {
	let output = "";

	for (let index = 0; index < 4; index++) {
		output += ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, "0");
	}

	return output;
}
