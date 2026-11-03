import QRCode from "qrcode";

const DEFAULT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Resolves the canonical public registration URL for a general attendance token.
 */
export function getPublicRegistrationUrl(
  token: string,
  configuredBaseUrl?: string,
): string {
  const fallback =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : DEFAULT_PUBLIC_BASE_URL;
  const candidate = (configuredBaseUrl || fallback).trim();
  const base = candidate.replace(/\/+$/, "");
  return `${base}/attend/${encodeURIComponent(token)}`;
}

/**
 * Resolves the canonical protocol registration URL for a protocol token.
 * Both QR codes open the SAME public check-in page structure (/attend/[token]),
 * with the protocol token indicating GPS exemption to the backend RPC.
 */
export function getProtocolRegistrationUrl(
  token: string,
  configuredBaseUrl?: string,
): string {
  const fallback =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : DEFAULT_PUBLIC_BASE_URL;
  const candidate = (configuredBaseUrl || fallback).trim();
  const base = candidate.replace(/\/+$/, "");
  return `${base}/attend/${encodeURIComponent(token)}`;
}

/**
 * Generates an ISO/IEC 18004 standards-compliant QR code boolean matrix
 * using Reed-Solomon error correction (Level H).
 */
export function generateQrMatrix(value: string): boolean[][] {
  const payload = value.trim() || DEFAULT_PUBLIC_BASE_URL;
  const qr = QRCode.create(payload, {
    errorCorrectionLevel: "H",
  });
  const size = qr.modules.size;
  const data = qr.modules.data;

  const matrix: boolean[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => Boolean(data[row * size + col])),
  );

  return matrix;
}

/**
 * Builds the SVG string for a branded QR code poster pass.
 */
export function generateQrSvgString(
  value: string,
  eventName: string,
  eventDate: string,
  badgeText = "GENERAL ATTENDANCE · GPS REQUIRED",
): string {
  const matrix = generateQrMatrix(value);
  const size = matrix.length;
  const moduleSize = 10;
  const quietZone = 40;
  const qrDimension = size * moduleSize;
  const totalWidth = qrDimension + quietZone * 2;
  const totalHeight = qrDimension + quietZone * 2 + 104;

  let rects = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = quietZone + c * moduleSize;
        const y = quietZone + r * moduleSize;
        rects += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#0F172A"/>`;
      }
    }
  }

  const escapeXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const escapedName = escapeXml(eventName);
  const escapedDate = escapeXml(eventDate);
  const escapedBadge = escapeXml(badgeText);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" shape-rendering="crispEdges">
  <rect width="${totalWidth}" height="${totalHeight}" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" shape-rendering="geometricPrecision"/>
  ${rects}
  <text x="${totalWidth / 2}" y="${qrDimension + quietZone + 24}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="13" font-weight="800" letter-spacing="0.08em" fill="#FF4500" shape-rendering="geometricPrecision">LIGHT NATION IBADAN</text>
  <text x="${totalWidth / 2}" y="${qrDimension + quietZone + 46}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="12" font-weight="700" fill="#0F172A" shape-rendering="geometricPrecision">${escapedName}</text>
  <text x="${totalWidth / 2}" y="${qrDimension + quietZone + 66}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#64748B" shape-rendering="geometricPrecision">${escapedDate}</text>
  <rect x="${quietZone}" y="${qrDimension + quietZone + 76}" width="${qrDimension}" height="18" rx="9" fill="#F1F5F9" shape-rendering="geometricPrecision"/>
  <text x="${totalWidth / 2}" y="${qrDimension + quietZone + 89}" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="9" font-weight="700" letter-spacing="0.06em" fill="#475569" shape-rendering="geometricPrecision">${escapedBadge}</text>
</svg>`;
}

export function downloadQrCodeSvg(
  value: string,
  eventName: string,
  eventDate: string,
  filename: string,
  badgeText = "GENERAL ATTENDANCE · GPS REQUIRED",
) {
  const svgContent = generateQrSvgString(value, eventName, eventDate, badgeText);
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadQrCodePng(
  value: string,
  eventName: string,
  eventDate: string,
  filename: string,
  badgeText = "GENERAL ATTENDANCE · GPS REQUIRED",
) {
  const svgContent = generateQrSvgString(value, eventName, eventDate, badgeText);
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const scale = 2; // high-res
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  canvas.toBlob((pngBlob) => {
    if (!pngBlob) return;
    const pngUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(pngUrl);
    URL.revokeObjectURL(url);
  }, "image/png");
}

/**
 * Downloads both General and Protocol QR codes sequentially as a convenience.
 */
export async function downloadBothQrCodes(
  generalValue: string,
  protocolValue: string,
  eventName: string,
  eventDate: string,
  baseFilename: string,
  format: "png" | "svg" = "png",
) {
  if (format === "png") {
    await downloadQrCodePng(
      generalValue,
      eventName,
      eventDate,
      `${baseFilename}-general-gps`,
      "GENERAL ATTENDANCE · GPS REQUIRED",
    );
    await new Promise((r) => setTimeout(r, 350));
    await downloadQrCodePng(
      protocolValue,
      eventName,
      eventDate,
      `${baseFilename}-protocol-entrance`,
      "PROTOCOL DESK · GPS NOT REQUIRED",
    );
  } else {
    downloadQrCodeSvg(
      generalValue,
      eventName,
      eventDate,
      `${baseFilename}-general-gps`,
      "GENERAL ATTENDANCE · GPS REQUIRED",
    );
    setTimeout(() => {
      downloadQrCodeSvg(
        protocolValue,
        eventName,
        eventDate,
        `${baseFilename}-protocol-entrance`,
        "PROTOCOL DESK · GPS NOT REQUIRED",
      );
    }, 350);
  }
}
