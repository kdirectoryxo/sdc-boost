/**
 * SDC API Note Utility Functions
 * Helper functions for working with notes and summaries
 */

/**
 * Check if a note contains a "Samenvatting:" section
 * @param note The note text to check
 * @returns true if note contains "Samenvatting:"
 */
export function noteContainsSummary(note: string): boolean {
    return note.includes('Samenvatting:');
}

/**
 * Extract the summary part from a note (everything between the separators after "Samenvatting:")
 * @param note The note text
 * @returns The summary text, or empty string if no summary exists
 */
export function extractSummaryFromNote(note: string): string {
    const summaryIndex = note.indexOf('Samenvatting:');
    if (summaryIndex === -1) {
        return '';
    }

    // Get everything after "Samenvatting:"
    let summary = note.substring(summaryIndex + 'Samenvatting:'.length);
    
    // Remove leading/trailing whitespace and line breaks
    summary = summary.trim();
    
    // If there's a closing separator (--------), extract only the content before it
    const closingSeparatorIndex = summary.indexOf('--------');
    if (closingSeparatorIndex !== -1) {
        summary = summary.substring(0, closingSeparatorIndex).trim();
    }
    
    // Remove any leading separators (--------) at the start
    if (summary.startsWith('--------')) {
        summary = summary.substring(8).trim();
    }
    
    return summary;
}

/**
 * Get the note content before the summary section (if it exists)
 * Extracts everything before the opening "--------" separator that precedes "Samenvatting:"
 * @param note The note text
 * @returns The note content before summary, or the full note if no summary exists
 */
export function getNoteBeforeSummary(note: string): string {
    if (!noteContainsSummary(note)) {
        return note;
    }

    // Find the start of the summary section
    // Look for the pattern: "--------" followed by "Samenvatting:"
    const summaryIndex = note.indexOf('Samenvatting:');
    
    // Look backwards from "Samenvatting:" to find the opening separator
    // Check if there's a "--------" before "Samenvatting:"
    const beforeSummary = note.substring(0, summaryIndex);
    const separatorIndex = beforeSummary.lastIndexOf('--------');
    
    if (separatorIndex !== -1) {
        // Extract everything before the opening separator
        const beforeSeparator = note.substring(0, separatorIndex).trim();
        return beforeSeparator;
    } else {
        // No opening separator found, just get everything before "Samenvatting:"
        return note.substring(0, summaryIndex).trim();
    }
}

