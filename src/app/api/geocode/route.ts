import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      { success: false, error: "Address is required." },
      { status: 400 },
    );
  }

  try {
    // 1. Try exact search
    let result = await fetchNominatim(query);

    // 2. If no result and user didn't mention Nigeria, append ", Nigeria" as fallback
    if (!result && !/nigeria/i.test(query)) {
      result = await fetchNominatim(`${query}, Nigeria`);
    }

    // 3. If still no result and user didn't mention Ibadan, try appending ", Ibadan, Nigeria"
    if (!result && !/ibadan/i.test(query)) {
      result = await fetchNominatim(`${query}, Ibadan, Nigeria`);
    }

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not locate this address. Please try adding city or area (e.g., 'Ring Road, Ibadan, Nigeria') or paste coordinates from Google Maps.",
        },
        { status: 404 },
      );
    }

    const lat = Number(parseFloat(result.lat).toFixed(6));
    const lon = Number(parseFloat(result.lon).toFixed(6));

    return NextResponse.json({
      success: true,
      latitude: lat,
      longitude: lon,
      displayName: result.display_name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Geocoding service unavailable";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function fetchNominatim(searchQuery: string): Promise<NominatimResult | null> {
  const endpoint = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    searchQuery,
  )}&limit=1&addressdetails=1`;

  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": "LightNationAttendanceApp/2.0 (admin@lightnation.org)",
      Accept: "application/json",
    },
    // Cache for 1 day to be fast and respectful of Nominatim limits
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NominatimResult[];
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}
