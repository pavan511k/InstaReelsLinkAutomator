/**
 * Indian mobile-number helpers shared by the checkout UI (client) and the
 * create-order route (server). Cashfree requires a real `customer_phone` on
 * every order — it uses it for the payment receipt and status updates — so we
 * validate the same way on both sides: the client for a friendly prompt, the
 * server as the authoritative boundary (never trust the client).
 */

/**
 * Normalises a raw phone string to a bare 10-digit Indian mobile number.
 *
 * Accepts common input shapes and strips the country/trunk prefix by length
 * so a legitimately 9-leading 10-digit number (e.g. 9188889999) is preserved:
 *   - "+91 98765 43210" / "919876543210" (12 digits, 91-prefixed) → "9876543210"
 *   - "09876543210"                       (11 digits, 0-prefixed)  → "9876543210"
 *   - "9876543210"                        (already 10 digits)      → "9876543210"
 *
 * @param {string} raw
 * @returns {string|null} the normalised 10-digit number, or null if invalid
 */
export function normalizeIndianMobile(raw) {
    let digits = String(raw ?? '').replace(/\D/g, '');

    if (digits.length === 12 && digits.startsWith('91')) {
        digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
        digits = digits.slice(1);
    }

    // Indian mobile numbers are 10 digits and start with 6, 7, 8, or 9.
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/**
 * Collects a valid Indian mobile number using the app's confirm/prompt dialog,
 * re-prompting with an inline error until the input is valid or cancelled.
 *
 * Takes the `prompt` function from `useConfirm()` as an argument so this stays
 * a pure helper (no hook dependency) and can be reused across checkout surfaces.
 *
 * @param {(opts: object) => Promise<string|null>} prompt - useConfirm().prompt
 * @returns {Promise<string|null>} a normalised 10-digit number, or null if cancelled
 */
export async function promptForMobile(prompt) {
    let message = 'Cashfree sends your payment receipt and status updates to this number.';

    // Loops until a valid number is entered or the user dismisses the dialog.
    // The dialog is modal (blocks the page), so there is no double-submit risk.
    for (;;) {
        const raw = await prompt({
            title: 'Enter your mobile number',
            message,
            placeholder: 'e.g. 9876543210',
            confirmText: 'Continue to payment',
        });

        if (raw === null) return null; // cancelled — abort checkout

        const phone = normalizeIndianMobile(raw);
        if (phone) return phone;

        message = 'Please enter a valid 10-digit Indian mobile number (starting with 6–9).';
    }
}
