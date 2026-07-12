import { useCallback, useEffect, useMemo, useState } from "react";
import {
  browserName,
  deviceType,
  isAndroid,
  isIOS,
  isMobile,
  isTablet,
  osName,
} from "react-device-detect";

/** Viewport width at or below which the app is always allowed. */
export const MOBILE_MAX_WIDTH = 768;

/**
 * Returns true when the visitor is on a smartphone (Android / iPhone)
 * and not classified as a tablet by the user-agent parser.
 */
export function isMobilePhoneDevice() {
  return isMobile && !isTablet && (isAndroid || isIOS);
}

/**
 * Central access rule for the mobile-only gate.
 * Allowed when viewport is phone-sized OR the device is a mobile phone.
 */
export function evaluateMobileAccess(viewportWidth) {
  const width = Number(viewportWidth) || 0;
  const isMobileWidth = width <= MOBILE_MAX_WIDTH;
  const isMobilePhone = isMobilePhoneDevice();
  const isAllowed = isMobileWidth || isMobilePhone;

  let blockReason = null;
  if (!isAllowed) {
    if (width > MOBILE_MAX_WIDTH) {
      blockReason = `Window width (${width}px) is wider than ${MOBILE_MAX_WIDTH}px`;
    } else if (isTablet) {
      blockReason = "Tablet devices are not supported; please use a smartphone";
    } else {
      blockReason = `Desktop environment (${osName || "Unknown OS"}) is blocked`;
    }
  }

  return {
    isAllowed,
    isMobileWidth,
    isMobilePhone,
    blockReason,
    width,
    osName: osName || "Unknown",
    browserName: browserName || "Unknown",
    deviceType: deviceType || (isTablet ? "tablet" : isMobile ? "mobile" : "desktop"),
    isTablet,
    isDesktopOs: !isMobile && !isTablet,
  };
}

/**
 * Custom hook that listens to window resize events, detects device information
 * using react-device-detect, and dynamically evaluates mobile access conditions.
 */
export default function useMobileCheck() {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : MOBILE_MAX_WIDTH
  );

  const handleResize = useCallback(() => {
    setWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  const access = useMemo(() => evaluateMobileAccess(width), [width]);

  return {
    ...access,
    /** Alias for consumers that expect `isMobile` checks. */
    isMobile: access.isAllowed,
    refresh: () => window.location.reload(),
  };
}
