/**
 * Tag color utilities and predefined color palette
 */

export const TAG_COLOR_PALETTE = [
	'#ef4444', // red
	'#3b82f6', // blue
	'#10b981', // green
	'#f59e0b', // yellow/amber
	'#8b5cf6', // purple
	'#f97316', // orange
	'#ec4899', // pink
	'#06b6d4', // cyan
	'#6366f1', // indigo
	'#14b8a6', // teal
	'#84cc16', // lime
	'#a855f7', // violet
] as const;

/**
 * Validate if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
	return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Normalize hex color (ensure it starts with # and is uppercase)
 */
export function normalizeHexColor(color: string): string {
	const trimmed = color.trim();
	if (!trimmed.startsWith('#')) {
		return `#${trimmed}`;
	}
	return trimmed;
}

