<?php

namespace App\Support;

/**
 * Strip brand-name fragments from product titles before they get slugged.
 *
 * The list is ordered specific → general so that "TitanPRO" is consumed before
 * "Titan" can chip away at the leftover. Each entry is matched as a whole word
 * (no partial-word matches — "Titan" won't strip from inside "TitanPRO"), with
 * any trailing ™/® and one run of surrounding whitespace folded into the match.
 */
class BrandSanitizer
{
    /**
     * Brand tokens to strip. Add more here as new brands appear in source data.
     */
    public const BRANDS = [
        'TitanPRO',
        'Titan Series',
        'Titan',
        'Zown',
    ];

    public static function clean(string $title): string
    {
        $out = $title;

        foreach (self::BRANDS as $brand) {
            $quoted = preg_quote($brand, '/');
            // (?<!\w)BRAND(?!\w) — whole-word so "Titan" misses inside "TitanPRO".
            // \s*[™®]?\s* — eat any trademark mark and surrounding whitespace.
            $out = preg_replace('/(?<!\w)'.$quoted.'(?!\w)\s*[™®]?\s*/u', ' ', $out);
        }

        // Tidy up: collapse whitespace runs, then strip leftover dangling
        // punctuation at the edges (a leading "," or "-" left after a brand
        // sat at the start) and any internal ", ," that a mid-string strip
        // could create.
        $out = preg_replace('/\s+/u', ' ', $out);
        $out = preg_replace('/,\s*,/u', ',', $out);
        $out = preg_replace('/^[\s,\-–—]+|[\s,\-–—]+$/u', '', $out);

        return $out;
    }
}
