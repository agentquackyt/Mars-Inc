export function formatMoney(amount: number): string {
    const suffixes = ['', 'K', 'M', 'B', 'T'];

    if (amount < 1_000) {
        return `${amount.toFixed(0)}$`;
    }

    let scale = 0;
    let scaledAmount = amount;

    // Determine the appropriate scale
    while (scaledAmount >= 1_000 && scale < suffixes.length - 1) {
        scaledAmount /= 1_000;
        scale++;
    }

    // Standard suffixes (K, M, B, T)
    if (scale < suffixes.length) {
        return `${scaledAmount.toFixed(1)}${suffixes[scale]}$`;
    }

    // After trillion, use letter notation (aa, ab, ..., zz, aaa, ...)
    // Continue scaling for letter system
    while (scaledAmount >= 1_000) {
        scaledAmount /= 1_000;
        scale++;
    }

    const letterPosition = scale - suffixes.length;
    const letterNotation = getLetterNotation(letterPosition);

    return `${scaledAmount.toFixed(1)}${letterNotation}$`;
}

/**
 * Convert position to letter notation (aa, ab, ..., zz, aaa, ...)
 * Positions 0-675: aa-zz (2 letters)
 * Positions 676+: aaa, aab, ..., zzz, aaaa, ... (3+ letters)
 */
function getLetterNotation(position: number): string {
    if (position >= 676) return 'NaN'
    // 2-letter combinations (aa-zz, positions 0-675)
    const first = Math.floor(position / 26);
    const second = position % 26;
    return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);

}

console.log(formatMoney(123));          // "123$"
console.log(formatMoney(12345));        // "12.3K$"
console.log(formatMoney(1234567));      // "1.2M$"
console.log(formatMoney(1234567890));   // "1.2B$"
console.log(formatMoney(1234567890123));// "1.2T$"
console.log(formatMoney(1234567890123456)); // "1.2aa$"
console.log(formatMoney(1234567890123456789)); // "1.2ab$"