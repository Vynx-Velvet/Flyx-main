# PlayerJS Decoding Analysis Summary

## Objective
Analyze the PlayerJS script and `JoAHUMCLXV` variable to understand the decoding logic.

## Findings

1.  **`JoAHUMCLXV` Variable:**
    *   Located in `prorcp_page.html` as a `div` with `id="JoAHUMCLXV"`.
    *   Content is a long string starting with `7gnNw...`.
    *   This variable is passed to `Playerjs` as the `file` parameter.

2.  **`extra_script.js` Analysis:**
    *   Fetched from `https://cloudnestra.com/sV05kUlNvOdOxvtC/a6a95bb5246c6a03e4978992dcd1e03c.js`.
    *   Contains a function `LXVUMCoAHJ` (obfuscated).
    *   **Logic:** The script executes `window["JoAHUMCLXV"] = LXVUMCoAHJ(document.getElementById("JoAHUMCLXV").innerHTML)`.
    *   **`LXVUMCoAHJ` Function:** Splits the input string into chunks of 3 characters, reverses the order of chunks, and joins them.
    *   **Result:** `7gnNw...` becomes `a3d3...`.

3.  **Decoding Path:**
    *   **Step 1:** Chunk Reverse (3 chars). Input: `7gnNw...` -> Output: `a3d3...`.
    *   **Step 2:** Standard Base64 Decode. Input: `a3d3...` -> Output: `kwwcw...`.
    *   **Step 3:** Custom Shift/Map. Input: `kwwcw...` -> Output: `https://...`.

4.  **Custom Shift Analysis:**
    *   `kwwcw` maps to `https`.
    *   `k` -> `h` (-3)
    *   `w` -> `t` (-3)
    *   `w` -> `t` (-3)
    *   `c` -> `p` (+13, or ROT13)
    *   `w` -> `s` (-4)
    *   The shift pattern is complex (polyalphabetic or custom mapping), but the `kww` -> `htt` correlation is very strong.

5.  **Relevance of `bk` Values:**
    *   `bk` values are used in `NHstzFhZ` function in `pjs_drv_cast_unpacked.js`.
    *   `NHstzFhZ` is only called if the string starts with `#2`.
    *   `JoAHUMCLXV` (and its decoded forms) does NOT start with `#2`.
    *   Therefore, `bk` values are **not required** for decoding `JoAHUMCLXV`.

## Next Steps
1.  Implement the full decoding logic in Node.js.
2.  Reverse-engineer the final "Custom Shift" step by analyzing more characters or the obfuscated code in `extra_script.js` (specifically looking for the shift logic).
3.  Verify the final URL.
