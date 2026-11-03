/**
 * GPS Coordinate Parsing and Formatting Utilities
 *
 * Supports:
 * - Decimal Degrees (DD): e.g. 7.3775, 3.9470
 * - Decimal with Direction: e.g. 7.3775° N, 3.9470° E
 * - Degrees Minutes Seconds (DMS): e.g. 7°22'38.4"N 3°56'49.2"E
 * - Degrees Decimal Minutes (DDM): e.g. 7° 22.64' N, 3° 56.82' E
 * - Google Maps URL or Comma-separated query: https://maps.google.com/?q=7.3775,3.9470
 */

export interface ParsedCoordinates {
  lat: number;
  lng: number;
  formattedLatDms: string;
  formattedLngDms: string;
}

/**
 * Parses a single coordinate string (Latitude or Longitude).
 * Accepts DMS (7°22'38.4"N), DDM (7°22.64'N), DD with hemisphere (7.3775° N), or standard numbers (7.3775).
 */
export function parseCoordinateSingle(input: string): number | null {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();
  if (!str) return null;

  // 1. Check if simple signed decimal: "-3.947" or "+7.3775" or "7.3775"
  if (/^[+-]?\d+(?:\.\d+)?$/.test(str)) {
    const val = parseFloat(str);
    return isNaN(val) ? null : val;
  }

  // 2. Check for Decimal Degrees with optional degree sign and direction:
  // e.g. "7.3775° N", "7.3775 N", "3.9470° E", "3.9470E"
  const ddDirMatch = str.match(
    /^([+-]?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*([NSEW])?$/i,
  );
  if (ddDirMatch) {
    let val = parseFloat(ddDirMatch[1]);
    const dir = (ddDirMatch[2] || "").toUpperCase();
    if (dir === "S" || dir === "W") {
      val = -Math.abs(val);
    } else if (dir === "N" || dir === "E") {
      val = Math.abs(val);
    }
    return isNaN(val) ? null : val;
  }

  // 3. Check for DMS: 7° 22' 38.4" N or 7°22'38"N or 7d 22m 38s N
  const dmsMatch = str.match(
    /^(\d+(?:\.\d+)?)\s*(?:°|d|deg|degrees|\s+)\s*(?:(\d+(?:\.\d+)?)\s*(?:'|m|min|\s+))?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|''|s|sec)?)?\s*([NSEW])?$/i,
  );
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]) || 0;
    const min = parseFloat(dmsMatch[2]) || 0;
    const sec = parseFloat(dmsMatch[3]) || 0;
    const dir = (dmsMatch[4] || "").toUpperCase();

    let val = deg + min / 60 + sec / 3600;
    if (dir === "S" || dir === "W") {
      val = -Math.abs(val);
    }
    return isNaN(val) ? null : val;
  }

  return null;
}

/**
 * Parses a combined coordinate string or Google Maps URL.
 * Examples:
 * - "7°22'38.4\"N 3°56'49.2\"E"
 * - "7°22'38.4\"N, 3°56'49.2\"E"
 * - "7.3775° N, 3.9470° E"
 * - "7.3775, 3.9470"
 * - "https://www.google.com/maps/@7.3775,3.9470,17z"
 * - "https://maps.google.com/?q=7.3775,3.9470"
 */
export function parseCoordinatePair(input: string): ParsedCoordinates | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Check for Google Maps URL patterns
  // Pattern A: @7.3775,3.9470
  const atMatch = raw.match(/@([+-]?\d+\.\d+),([+-]?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    return buildResult(lat, lng);
  }

  // Pattern B: q=7.3775,3.9470 or ll=7.3775,3.9470
  const queryMatch = raw.match(/[?&](?:q|ll)=([+-]?\d+\.\d+),([+-]?\d+\.\d+)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    return buildResult(lat, lng);
  }

  // Check for DMS pair with N/S and E/W explicitly mentioned:
  // e.g. 7°22'38.4"N 3°56'49.2"E or 7.3775 N, 3.9470 E
  const latDmsRegex = /([0-9.]+\s*(?:°|deg|degrees)?\s*[0-9.]*'?\s*[0-9.]*"?\s*[NS])/i;
  const lngDmsRegex = /([0-9.]+\s*(?:°|deg|degrees)?\s*[0-9.]*'?\s*[0-9.]*"?\s*[EW])/i;

  const latMatch = raw.match(latDmsRegex);
  const lngMatch = raw.match(lngDmsRegex);
  if (latMatch && lngMatch) {
    const lat = parseCoordinateSingle(latMatch[1]);
    const lng = parseCoordinateSingle(lngMatch[1]);
    if (lat !== null && lng !== null) {
      return buildResult(lat, lng);
    }
  }

  // Comma or whitespace separated numbers: e.g. "7.3775, 3.9470" or "7.3775 3.9470"
  const commaSplit = raw.split(/[,;\t]/).map((s) => s.trim()).filter(Boolean);
  if (commaSplit.length === 2) {
    const lat = parseCoordinateSingle(commaSplit[0]);
    const lng = parseCoordinateSingle(commaSplit[1]);
    if (lat !== null && lng !== null) {
      return buildResult(lat, lng);
    }
  }

  // Space split if exactly two parts
  const spaceParts = raw.split(/\s+/).filter(Boolean);
  if (spaceParts.length === 2) {
    const lat = parseCoordinateSingle(spaceParts[0]);
    const lng = parseCoordinateSingle(spaceParts[1]);
    if (lat !== null && lng !== null) {
      return buildResult(lat, lng);
    }
  }

  return null;
}

/**
 * Format decimal coordinate into Degrees Minutes Seconds (DMS) format.
 * Example: 7.3775 -> 7° 22' 39.0" N
 */
export function formatCoordinateDms(decimal: number, isLatitude: boolean): string {
  if (isNaN(decimal)) return "";
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);

  let direction = "";
  if (isLatitude) {
    direction = decimal >= 0 ? "N" : "S";
  } else {
    direction = decimal >= 0 ? "E" : "W";
  }

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

/**
 * Format coordinate to standard decimal string with fixed precision.
 */
export function formatCoordinateDecimal(decimal: number, precision = 6): string {
  if (isNaN(decimal)) return "";
  return decimal.toFixed(precision);
}

function buildResult(lat: number, lng: number): ParsedCoordinates | null {
  if (isNaN(lat) || isNaN(lng)) return null;
  // Latitude must be within -90 to +90
  if (lat < -90 || lat > 90) return null;
  // Longitude must be within -180 to +180
  if (lng < -180 || lng > 180) return null;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    formattedLatDms: formatCoordinateDms(lat, true),
    formattedLngDms: formatCoordinateDms(lng, false),
  };
}
