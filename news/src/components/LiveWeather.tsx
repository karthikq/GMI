"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/api";

type Current = Pick<Weather, "city" | "temperature" | "summary">;

const CONDITIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

// Uses the visitor's IP-based location for live conditions; falls back to the server value when location is unavailable.
export default function LiveWeather({ fallback }: { fallback: Weather | null }) {
  const [live, setLive] = useState<Current | null>(null);

  useEffect(() => {
    let cancelled = false;
    const show = async (latitude: number, longitude: number, city: string) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code`;
        const { current } = await (await fetch(url)).json();
        if (cancelled) return;
        const direction = COMPASS[Math.round(current.wind_direction_10m / 45) % 8];
        setLive({
          city,
          temperature: `${Math.round(current.temperature_2m)}°C`,
          summary: `${CONDITIONS[current.weather_code] ?? "Conditions"}, wind ${direction} ${Math.round(current.wind_speed_10m)} km/h`,
        });
      } catch {}
    };
    const byIp = async () => {
      try {
        const { latitude, longitude, city } = await (await fetch("https://geolocation-db.com/json/")).json();
        if (typeof latitude === "number" && typeof longitude === "number") await show(latitude, longitude, city || "Your location");
      } catch {}
    };
    byIp();
    return () => {
      cancelled = true;
    };
  }, []);
 
  const weather = live ?? fallback;
  if (!weather) return null;
  return (
    <>
      <strong>
        {weather.city} · {weather.temperature}
      </strong>
      <span>{weather.summary}</span>
    </>
  );
}
