import { useState, useEffect } from "react";

const MOBILE_QUERY = "(max-width: 768px)";
const TABLET_QUERY = "(max-width: 1024px)";
const TOUCH_QUERY = "(pointer: coarse)";

/**
 * Detects mobile and tablet devices via viewport width + pointer type.
 * Updates on resize (e.g. orientation change).
 *
 * - `isMobile`  → phones (≤768px)
 * - `isTablet`  → phones + tablets (≤1024px)
 * - `isTouch`   → coarse pointer (touch screens)
 * - `isLowPower` → tablet OR touch — used to gate heavy animations
 */
export function useIsMobile() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") {
      return { isMobile: false, isTablet: false, isTouch: false, isLowPower: false };
    }
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const isTablet = window.matchMedia(TABLET_QUERY).matches;
    const isTouch = window.matchMedia(TOUCH_QUERY).matches;
    return { isMobile, isTablet, isTouch, isLowPower: isTablet || isTouch };
  });

  useEffect(() => {
    const mqlMobile = window.matchMedia(MOBILE_QUERY);
    const mqlTablet = window.matchMedia(TABLET_QUERY);
    const mqlTouch = window.matchMedia(TOUCH_QUERY);

    function update() {
      const isMobile = mqlMobile.matches;
      const isTablet = mqlTablet.matches;
      const isTouch = mqlTouch.matches;
      setState({ isMobile, isTablet, isTouch, isLowPower: isTablet || isTouch });
    }

    mqlMobile.addEventListener("change", update);
    mqlTablet.addEventListener("change", update);
    mqlTouch.addEventListener("change", update);
    return () => {
      mqlMobile.removeEventListener("change", update);
      mqlTablet.removeEventListener("change", update);
      mqlTouch.removeEventListener("change", update);
    };
  }, []);

  return state;
}
