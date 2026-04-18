"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Eye } from "lucide-react";

interface HourlyData {
  time: string[];
  temperature_2m: number[];
  weathercode: number[];
  precipitation_probability: number[];
  windspeed_10m: number[];
}

interface WeatherPoint {
  hour: string;
  temp: number;
  code: number;
  precip: number;
  wind: number;
  isNow: boolean;
}

function codeToLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Storm";
  return "—";
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 57) return <Droplets className={className} />;
  if (code <= 67) return <CloudRain className={className} />;
  if (code <= 77) return <CloudSnow className={className} />;
  if (code <= 82) return <CloudRain className={className} />;
  return <CloudLightning className={className} />;
}

function tempColor(temp: number): string {
  if (temp >= 90) return "text-red-400";
  if (temp >= 75) return "text-orange-400";
  if (temp >= 60) return "text-yellow-400";
  if (temp >= 45) return "text-green-400";
  return "text-cyan-400";
}

export default function WeatherStrip() {
  const [hours, setHours] = useState<WeatherPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [daily, setDaily] = useState<{ high: number; low: number; label: string } | null>(null);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=35.9065&longitude=-80.0065&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FNew_York&forecast_days=2"
    )
      .then(r => r.json())
      .then(data => {
        const h: HourlyData = data.hourly;
        const now = new Date();
        const currentHour = now.getHours();

        const points: WeatherPoint[] = [];
        for (let i = 0; i < h.time.length; i++) {
          const t = new Date(h.time[i]);
          const hr = t.getHours();
          const isToday = t.getDate() === now.getDate();
          points.push({
            hour: t.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
            temp: Math.round(h.temperature_2m[i]),
            code: h.weathercode[i],
            precip: h.precipitation_probability[i],
            wind: Math.round(h.windspeed_10m[i]),
            isNow: isToday && hr === currentHour,
          });
        }

        // Show current hour + next 11 (12 total)
        const nowIdx = points.findIndex(p => p.isNow);
        const slice = nowIdx >= 0 ? points.slice(nowIdx, nowIdx + 12) : points.slice(0, 12);

        // Today high/low
        const todayTemps = points.filter((_, i) => {
          const t = new Date(h.time[i]);
          return t.getDate() === now.getDate();
        }).map(p => p.temp);
        const high = Math.max(...todayTemps);
        const low = Math.min(...todayTemps);
        const nowCode = slice[0]?.code ?? 0;

        setHours(slice);
        setDaily({ high, low, label: codeToLabel(nowCode) });
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4 mb-8">
      <div className="flex items-center gap-2">
        <Cloud className="w-4 h-4 text-green-700 animate-pulse" />
        <span className="text-xs text-green-700 font-mono">Loading weather…</span>
      </div>
    </div>
  );

  if (error || hours.length === 0) return (
    <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 p-4 mb-8">
      <div className="flex items-center gap-2">
        <Cloud className="w-4 h-4 text-green-800" />
        <span className="text-xs text-green-800 font-mono">Weather unavailable</span>
      </div>
    </div>
  );

  const current = hours[0];

  return (
    <div className="holo-card rounded-xl border border-green-500/20 bg-black/40 mb-8 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono font-bold text-green-400 uppercase tracking-wider">Weather — Archdale, NC</span>
        </div>
        {daily && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-green-700">{daily.label}</span>
            <span className="text-red-400">H:{daily.high}°</span>
            <span className="text-cyan-400">L:{daily.low}°</span>
          </div>
        )}
      </div>

      {/* Current conditions */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-green-500/20">
        <WeatherIcon code={current.code} className={`w-8 h-8 ${tempColor(current.temp)}`} />
        <div>
          <span className={`text-3xl font-black font-mono ${tempColor(current.temp)}`}>{current.temp}°F</span>
          <span className="text-green-700 text-sm font-mono ml-2">{codeToLabel(current.code)}</span>
        </div>
        <div className="ml-auto flex gap-4 text-xs font-mono text-green-700">
          <span><Droplets className="w-3 h-3 inline mr-1 text-blue-500/60" />{current.precip}% rain</span>
          <span><Wind className="w-3 h-3 inline mr-1" />{current.wind} mph</span>
        </div>
      </div>

      {/* Hourly strip */}
      <div className="flex gap-0 overflow-x-auto scrollbar-thin">
        {hours.map((h, i) => {
          const isMidnight = !h.isNow && h.hour === "12 AM";
          return (
            <div key={i} className="flex flex-col flex-shrink-0">
              {isMidnight && (
                <div className="px-2 py-1 bg-green-500/10 border-r border-green-500/20 text-center">
                  <span className="text-xs font-mono text-green-500 font-bold uppercase tracking-widest">Tomorrow</span>
                </div>
              )}
              <div
                className={`flex flex-col items-center gap-1 px-3 py-3 border-r border-green-500/10 min-w-[64px] ${
                  h.isNow ? "bg-green-500/10" : isMidnight ? "bg-green-500/5" : "hover:bg-green-500/5"
                }`}
              >
                <span className={`text-xs font-mono ${h.isNow ? "text-green-400 font-bold" : "text-green-700"}`}>
                  {h.isNow ? "NOW" : h.hour.replace(":00", "")}
                </span>
                <WeatherIcon code={h.code} className={`w-4 h-4 ${tempColor(h.temp)}`} />
                <span className={`text-sm font-black font-mono ${tempColor(h.temp)}`}>{h.temp}°</span>
                {h.precip > 20 && (
                  <span className="text-xs font-mono text-blue-400/70">{h.precip}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
