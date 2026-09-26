const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const UNIT_STORAGE_KEY = "yvaine-unit";

async function fetchWithTimeout(url, timeoutMessage, timeout = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error(timeoutMessage);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

const DEFAULT_LOCATION = {
  name: "Quezon City",
  country: "Philippines",
  admin1: "Metro Manila",
  latitude: 14.676,
  longitude: 121.0437,
};

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Fog with frost",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Heavy rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

const state = {
  unit: localStorage.getItem(UNIT_STORAGE_KEY) || "celsius",
  location: DEFAULT_LOCATION,
  forecast: null,
};

let suggestionTimer;
let suggestionSequence = 0;
let forecastIntentSequence = 0;

const elements = {
  dashboard: document.querySelector("#dashboard"),
  status: document.querySelector("#status-banner"),
  searchArea: document.querySelector(".search-area"),
  form: document.querySelector("#search-form"),
  search: document.querySelector("#location-search"),
  searchResults: document.querySelector("#search-results"),
  locationButton: document.querySelector("#location-button"),
  unitButton: document.querySelector("#unit-button"),
  locationName: document.querySelector("#current-location"),
  updatedTime: document.querySelector("#updated-time"),
  temperature: document.querySelector("#current-temperature"),
  condition: document.querySelector("#current-condition"),
  feelsLike: document.querySelector("#feels-like"),
  weatherScene: document.querySelector("#weather-scene"),
  rainField: document.querySelector("#rain-field"),
  adviceTitle: document.querySelector("#advice-title"),
  adviceCopy: document.querySelector("#advice-copy"),
  peakRain: document.querySelector("#peak-rain"),
  rainProgress: document.querySelector("#rain-progress"),
  rainProgressFill: document.querySelector("#rain-progress-fill"),
  rainExplanation: document.querySelector("#rain-explanation"),
  hourly: document.querySelector("#hourly-forecast"),
  hourlyScrollbar: document.querySelector("#hourly-scrollbar"),
  hourlyScrollbarThumb: document.querySelector("#hourly-scrollbar-thumb"),
  hourlyPrevious: document.querySelector("#hourly-previous"),
  hourlyNext: document.querySelector("#hourly-next"),
  daily: document.querySelector("#daily-forecast"),
  precipitation: document.querySelector("#precipitation-value"),
  precipitationCopy: document.querySelector("#precipitation-copy"),
  humidity: document.querySelector("#humidity-value"),
  humidityCopy: document.querySelector("#humidity-copy"),
  wind: document.querySelector("#wind-value"),
  windCopy: document.querySelector("#wind-copy"),
  uv: document.querySelector("#uv-value"),
  uvCopy: document.querySelector("#uv-copy"),
  temperatureRange: document.querySelector("#temperature-range"),
  temperatureCopy: document.querySelector("#temperature-copy"),
  todayTab: document.querySelector("#today-tab"),
  daysTab: document.querySelector("#days-tab"),
  todayPanel: document.querySelector("#today-panel"),
  daysPanel: document.querySelector("#days-panel"),
};

function createRainDrops() {
  elements.rainField.replaceChildren();
  for (let index = 0; index < 9; index += 1) {
    const drop = document.createElement("span");
    drop.className = "rain-drop";
    drop.style.left = `${7 + index * 11}%`;
    drop.style.animationDelay = `${-0.13 * index}s`;
    elements.rainField.append(drop);
  }
}

function formatTemperature(value) {
  if (!Number.isFinite(value)) return "--°";
  return `${Math.round(value)}°`;
}

function formatWind(value) {
  if (!Number.isFinite(value)) return "--";
  return Math.round(value);
}

function weatherIconClass(code, isDay = 1) {
  if (code === 0) return isDay ? "ph-fill ph-sun" : "ph-fill ph-moon-stars";
  if (code <= 2) return isDay ? "ph-fill ph-cloud-sun" : "ph-fill ph-cloud-moon";
  if (code === 3 || code === 45 || code === 48) return "ph-fill ph-cloud";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "ph-fill ph-cloud-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "ph-fill ph-cloud-snow";
  if (code >= 95) return "ph-fill ph-cloud-lightning";
  return "ph-fill ph-cloud";
}

function sceneClass(code) {
  if (code === 0) return "is-clear";
  if (code <= 2) return "is-partly-cloudy";
  if (code >= 95) return "is-stormy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "is-rainy";
  return "is-cloudy";
}

function windDirection(degrees) {
  if (!Number.isFinite(degrees)) return "unknown direction";
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round(degrees / 45) % 8];
}

function humidityMessage(humidity) {
  if (humidity >= 80) return "Very humid. The air may feel heavy.";
  if (humidity >= 65) return "Humid enough to make it feel warmer.";
  if (humidity >= 40) return "A comfortable humidity level for most people.";
  return "Dry air. Consider staying hydrated.";
}

function uvMessage(index, isDay) {
  if (!Number.isFinite(index)) return "Sun exposure data is unavailable.";
  if (!isDay || index < 0.05) return "Low. No meaningful UV right now.";
  if (index >= 11) return "Extreme exposure. Seek shade.";
  if (index >= 8) return "Very high. Limit direct sun.";
  if (index >= 6) return "High. Use sun protection.";
  if (index >= 3) return "Moderate. Protection helps.";
  return "Low sun exposure today.";
}

function windMessage(speed, direction) {
  const from = windDirection(direction);
  if (speed >= 50) return `Strong wind from the ${from}. Use extra caution outdoors.`;
  if (speed >= 30) return `A brisk wind from the ${from}.`;
  if (speed >= 12) return `A gentle breeze from the ${from}.`;
  return `Light wind from the ${from}.`;
}

function getAdvice({ chance, rainStart, peakTime, temperature, wind, windDisplay, windUnit }) {
  if (chance >= 70) {
    return {
      title: rainStart ? `Take an umbrella after ${rainStart}.` : "Take an umbrella if you head out.",
      copy: `The wettest hour is expected around ${peakTime}, with winds near ${Math.round(windDisplay)} ${windUnit}.`,
    };
  }
  if (wind >= 40) {
    return { title: "Expect strong wind outdoors.", copy: "Secure loose items and take care when walking, cycling, or driving." };
  }
  if (temperature >= 33) {
    return { title: "Plan for a hot afternoon.", copy: "Choose light clothing, drink water regularly, and limit long periods in direct sun." };
  }
  if (chance >= 40) {
    return { title: "Keep a compact umbrella nearby.", copy: `The wettest hour is expected around ${peakTime}, with winds near ${Math.round(windDisplay)} ${windUnit}.` };
  }
  return {
    title: chance < 20 ? "Rain is unlikely for the rest of today." : "Only a slight chance of rain ahead.",
    copy: `Winds are expected to stay near ${Math.round(windDisplay)} ${windUnit}.`,
  };
}

function temperatureInCelsius(value) {
  return state.unit === "celsius" ? value : (value - 32) * (5 / 9);
}

function windInKilometresPerHour(value) {
  return state.unit === "celsius" ? value : value * 1.609344;
}

function isDayAt(time, data) {
  const date = time.slice(0, 10);
  const dayIndex = data.daily.time.indexOf(date);
  if (dayIndex < 0) return 1;
  return time >= data.daily.sunrise[dayIndex] && time < data.daily.sunset[dayIndex] ? 1 : 0;
}

function setLoading(isLoading) {
  const searchButton = elements.form.querySelector("button");
  elements.dashboard.classList.toggle("is-loading", isLoading);
  elements.dashboard.setAttribute("aria-busy", String(isLoading));
  searchButton.disabled = isLoading;
  elements.locationButton.disabled = isLoading;
  elements.unitButton.disabled = isLoading;
  searchButton.textContent = isLoading ? "Loading..." : "Search";
}

function updateUnitButton() {
  elements.unitButton.textContent = state.unit === "celsius" ? "°C" : "°F";
  elements.unitButton.setAttribute("aria-label", `Switch to ${state.unit === "celsius" ? "Fahrenheit" : "Celsius"}`);
}

function beginForecastIntent() {
  forecastIntentSequence += 1;
  return forecastIntentSequence;
}

function isCurrentForecastIntent(intentId) {
  return intentId === forecastIntentSequence;
}

function showStatus(message = "") {
  elements.status.hidden = !message;
  elements.status.textContent = message;
}

function buildForecastUrl(location, unit = state.unit) {
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
    temperature_unit: unit,
    wind_speed_unit: unit === "celsius" ? "kmh" : "mph",
    precipitation_unit: unit === "celsius" ? "mm" : "inch",
    timezone: "auto",
    forecast_days: "10",
  });
  return `${WEATHER_API}?${params}`;
}

async function fetchForecast(location, { unit = state.unit, intentId = beginForecastIntent() } = {}) {
  setLoading(true);
  showStatus();
  try {
    const response = await fetchWithTimeout(buildForecastUrl(location, unit), "The forecast request took too long.");
    if (!response.ok) throw new Error("The forecast service did not respond.");
    const data = await response.json();
    if (!isCurrentForecastIntent(intentId)) return false;
    state.location = location;
    state.unit = unit;
    state.forecast = data;
    renderForecast();
    return true;
  } catch (error) {
    if (!isCurrentForecastIntent(intentId)) return false;
    showStatus(`${error.message} Please check your connection and try again.`);
    return false;
  } finally {
    if (isCurrentForecastIntent(intentId)) setLoading(false);
  }
}

function locationLabel(location) {
  return [location.name, location.admin1, location.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}

function getCurrentHourIndex(times, currentTime) {
  const exact = times.indexOf(currentTime.slice(0, 13) + ":00");
  if (exact >= 0) return exact;
  const current = new Date(currentTime).getTime();
  return times.reduce((best, time, index) => {
    const difference = Math.abs(new Date(time).getTime() - current);
    return difference < best.difference ? { index, difference } : best;
  }, { index: 0, difference: Infinity }).index;
}

function renderForecast() {
  const data = state.forecast;
  const current = data.current;
  const currentIndex = getCurrentHourIndex(data.hourly.time, current.time);
  const today = current.time.slice(0, 10);
  const todayHourlyIndexes = data.hourly.time
    .map((time, index) => ({ time, index }))
    .filter((item) => item.time.startsWith(today));
  const remainingTodayIndexes = todayHourlyIndexes.filter(({ index }) => index >= currentIndex);
  const peakRain = Math.max(0, ...remainingTodayIndexes.map(({ index }) => data.hourly.precipitation_probability[index] ?? 0));
  const peakRainItem = remainingTodayIndexes.find(({ index }) => (data.hourly.precipitation_probability[index] ?? 0) === peakRain);
  const peakTime = peakRainItem
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(peakRainItem.time))
    : "later today";
  const rainStartItem = remainingTodayIndexes.find(({ index }) => (data.hourly.precipitation_probability[index] ?? 0) >= 55);
  const rainStart = rainStartItem
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(rainStartItem.time))
    : null;
  const temperatureUnit = data.current_units.temperature_2m;
  const windUnit = state.unit === "celsius" ? "km/h" : "mph";
  const precipitationUnit = data.current_units.precipitation;
  const advice = getAdvice({
    chance: peakRain,
    rainStart,
    peakTime,
    temperature: temperatureInCelsius(current.temperature_2m),
    wind: windInKilometresPerHour(current.wind_speed_10m),
    windDisplay: current.wind_speed_10m,
    windUnit,
  });

  document.title = `${Math.round(current.temperature_2m)}${temperatureUnit} in ${state.location.name} | Yvaine`;
  elements.locationName.textContent = locationLabel(state.location);
  elements.updatedTime.textContent = `Updated ${new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(current.time))}`;
  elements.temperature.textContent = formatTemperature(current.temperature_2m);
  elements.condition.textContent = weatherDescriptions[current.weather_code] || "Current conditions";
  elements.feelsLike.textContent = `Feels like ${formatTemperature(current.apparent_temperature)}  |  High ${formatTemperature(data.daily.temperature_2m_max[0])}  |  Low ${formatTemperature(data.daily.temperature_2m_min[0])}`;

  const currentScene = sceneClass(current.weather_code);
  elements.weatherScene.className = `weather-scene ${currentScene} ${current.is_day ? "is-day" : "is-night"}`;
  elements.rainField.hidden = !["is-rainy", "is-stormy"].includes(currentScene);
  document.body.dataset.weather = currentScene.replace("is-", "");
  elements.adviceTitle.textContent = advice.title;
  elements.adviceCopy.textContent = advice.copy;
  elements.peakRain.textContent = `${peakRain}%`;
  elements.rainProgress.setAttribute("aria-valuenow", String(peakRain));
  elements.rainProgressFill.style.width = `${peakRain}%`;
  elements.rainExplanation.textContent = "Highest hourly probability from now until midnight.";

  elements.precipitation.textContent = `${current.precipitation.toFixed(state.unit === "celsius" ? 1 : 2)} ${precipitationUnit}`;
  elements.precipitationCopy.textContent = current.precipitation > 0 ? "Precipitation is occurring now." : "No measurable precipitation right now.";
  elements.humidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
  elements.humidityCopy.textContent = humidityMessage(current.relative_humidity_2m);
  elements.wind.textContent = `${formatWind(current.wind_speed_10m)} ${windUnit}`;
  elements.windCopy.textContent = windMessage(windInKilometresPerHour(current.wind_speed_10m), current.wind_direction_10m);
  const hourlyUvIndex = data.hourly.uv_index?.[currentIndex];
  const uvIndex = current.is_day && Number.isFinite(hourlyUvIndex) ? Math.max(0, hourlyUvIndex) : 0;
  elements.uv.textContent = uvIndex === 0 ? "0" : uvIndex.toFixed(1);
  elements.uvCopy.textContent = uvMessage(uvIndex, current.is_day);
  elements.temperatureRange.textContent = `${formatTemperature(data.daily.temperature_2m_min[0])} to ${formatTemperature(data.daily.temperature_2m_max[0])}`;
  elements.temperatureCopy.textContent = `${Math.round(data.daily.temperature_2m_max[0] - data.daily.temperature_2m_min[0])}° between today's low and high.`;

  renderHourly(data, currentIndex);
  renderDaily(data);
}

function renderHourly(data, startIndex) {
  const endIndex = Math.min(startIndex + 12, data.hourly.time.length);
  const fragment = document.createDocumentFragment();
  for (let index = startIndex; index < endIndex; index += 1) {
    const card = document.createElement("article");
    const rainChance = data.hourly.precipitation_probability[index] ?? 0;
    const time = index === startIndex
      ? "Now"
      : new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(data.hourly.time[index]));
    card.className = `hour-card${index === startIndex ? " is-now" : ""}`;
    card.innerHTML = `
      <div class="hour-time">${time}</div>
      <div class="hour-symbol" aria-hidden="true"><i class="${weatherIconClass(data.hourly.weather_code[index], isDayAt(data.hourly.time[index], data))}"></i></div>
      <div class="hour-temp">${formatTemperature(data.hourly.temperature_2m[index])}</div>
      <div class="hour-rain">${rainChance}% rain</div>
    `;
    card.setAttribute("aria-label", `${time}: ${weatherDescriptions[data.hourly.weather_code[index]] || "weather"}, ${formatTemperature(data.hourly.temperature_2m[index])}, ${rainChance}% chance of rain`);
    fragment.append(card);
  }
  elements.hourly.replaceChildren(fragment);
  elements.hourly.scrollLeft = 0;
  requestAnimationFrame(updateHourlyNavigation);
}

function updateHourlyNavigation() {
  const maxScroll = Math.max(0, elements.hourly.scrollWidth - elements.hourly.clientWidth);
  elements.hourlyPrevious.disabled = elements.hourly.scrollLeft <= 2;
  elements.hourlyNext.disabled = elements.hourly.scrollLeft >= maxScroll - 2;
  const visibleRatio = elements.hourly.scrollWidth > 0 ? elements.hourly.clientWidth / elements.hourly.scrollWidth : 1;
  const thumbWidth = Math.max(18, Math.min(100, visibleRatio * 100));
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, elements.hourly.scrollLeft / maxScroll)) : 0;
  elements.hourlyScrollbar.hidden = maxScroll <= 2;
  elements.hourlyScrollbarThumb.style.width = `${thumbWidth}%`;
  elements.hourlyScrollbarThumb.style.left = `${progress * (100 - thumbWidth)}%`;
}

function scrollHourly(direction) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const distance = Math.max(1, elements.hourly.clientWidth);
  elements.hourly.scrollBy({
    left: direction * distance,
    behavior: reduceMotion ? "instant" : "smooth",
  });
}

function renderDaily(data) {
  const fragment = document.createDocumentFragment();
  data.daily.time.forEach((time, index) => {
    const row = document.createElement("article");
    const date = new Date(`${time}T12:00`);
    const dayName = index === 0 ? "Today" : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
    const code = data.daily.weather_code[index];
    const rainChance = data.daily.precipitation_probability_max[index] ?? 0;
    row.className = "day-row";
    row.innerHTML = `
      <div class="day-name">${dayName}</div>
      <div class="day-condition"><span class="day-symbol" aria-hidden="true"><i class="${weatherIconClass(code, 1)}"></i></span><span>${weatherDescriptions[code] || "Forecast"}</span></div>
      <div class="day-rain">${rainChance}% rain</div>
      <div class="day-temp"><strong>${formatTemperature(data.daily.temperature_2m_max[index])}</strong><span class="day-low">${formatTemperature(data.daily.temperature_2m_min[index])}</span></div>
    `;
    fragment.append(row);
  });
  elements.daily.replaceChildren(fragment);
}

async function searchLocation(query) {
  const params = new URLSearchParams({ name: query.trim(), count: "5", language: navigator.language?.slice(0, 2) || "en", format: "json" });
  const response = await fetchWithTimeout(`${GEOCODING_API}?${params}`, "Location search took too long. Please try again.", 10000);
  if (!response.ok) throw new Error("Location search failed.");
  const data = await response.json();
  if (!data.results?.length) throw new Error("No matching place was found. Try a nearby city or region.");
  return data.results;
}

function clearLocationChoices() {
  window.clearTimeout(suggestionTimer);
  suggestionSequence += 1;
  elements.searchResults.replaceChildren();
  elements.searchResults.hidden = true;
  elements.searchResults.removeAttribute("aria-busy");
  elements.search.setAttribute("aria-expanded", "false");
}

function renderSearchMessage(message, isError = false) {
  const status = document.createElement("p");
  status.className = `search-results-status${isError ? " is-error" : ""}`;
  status.textContent = message;
  elements.searchResults.replaceChildren(status);
  elements.searchResults.hidden = false;
  elements.search.setAttribute("aria-expanded", "true");
}

function renderLocationChoices(locations, { focusFirst = false, labelText = "Place suggestions" } = {}) {
  const fragment = document.createDocumentFragment();
  const label = document.createElement("p");
  label.className = "search-results-label";
  label.textContent = labelText;
  fragment.append(label);
  locations.forEach((location, index) => {
    const button = document.createElement("button");
    const primary = document.createElement("span");
    const secondary = document.createElement("span");
    const arrow = document.createElement("i");
    const details = [location.admin1, location.country].filter((part, index, parts) => part && part !== location.name && parts.indexOf(part) === index);
    button.className = "search-result";
    button.type = "button";
    primary.textContent = location.name;
    secondary.textContent = details.join(", ");
    arrow.className = "ph ph-arrow-right";
    arrow.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-label", [location.name, ...details].join(", "));
    button.append(primary, secondary, arrow);
    button.addEventListener("click", async () => {
      const intentId = beginForecastIntent();
      clearLocationChoices();
      elements.search.value = "";
      await fetchForecast(location, { intentId });
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const choices = [...elements.searchResults.querySelectorAll(".search-result")];
        const offset = event.key === "ArrowDown" ? 1 : -1;
        choices[(index + offset + choices.length) % choices.length]?.focus();
      }
      if (event.key === "Escape") {
        elements.search.focus();
        clearLocationChoices();
      }
    });
    fragment.append(button);
  });
  elements.searchResults.replaceChildren(fragment);
  elements.searchResults.hidden = false;
  elements.searchResults.removeAttribute("aria-busy");
  elements.search.setAttribute("aria-expanded", "true");
  if (focusFirst) elements.searchResults.querySelector("button")?.focus();
}

function scheduleLocationSuggestions() {
  const query = elements.search.value.trim();
  clearLocationChoices();
  if (query.length < 2) return;

  const requestId = suggestionSequence;
  suggestionTimer = window.setTimeout(async () => {
    renderSearchMessage("Looking for places...");
    elements.searchResults.setAttribute("aria-busy", "true");
    try {
      const locations = await searchLocation(query);
      if (requestId !== suggestionSequence || elements.search.value.trim() !== query) return;
      renderLocationChoices(locations);
    } catch (error) {
      if (requestId !== suggestionSequence || elements.search.value.trim() !== query) return;
      renderSearchMessage(error.message, true);
      elements.searchResults.removeAttribute("aria-busy");
    }
  }, 350);
}

function coordinateLabel(value, positive, negative) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

async function reverseLocation(latitude, longitude) {
  const coordinates = `${coordinateLabel(latitude, "N", "S")}, ${coordinateLabel(longitude, "E", "W")}`;
  const fallback = {
    name: "Current coordinates",
    country: "",
    admin1: coordinates,
    latitude,
    longitude,
  };
  const params = new URLSearchParams({
    latitude,
    longitude,
    localityLanguage: navigator.language || "en",
  });

  try {
    const response = await fetchWithTimeout(`${REVERSE_GEOCODING_API}?${params}`, "Location lookup took too long.", 8000);
    if (!response.ok) return fallback;
    const place = await response.json();
    return {
      name: place.locality || place.city || "Current location",
      admin1: place.principalSubdivision || "",
      country: place.countryName || place.countryCode || "",
      latitude,
      longitude,
    };
  } catch {
    return fallback;
  }
}

function selectTab(tab) {
  const showToday = tab === "today";
  elements.todayTab.classList.toggle("is-active", showToday);
  elements.daysTab.classList.toggle("is-active", !showToday);
  elements.todayTab.setAttribute("aria-selected", String(showToday));
  elements.daysTab.setAttribute("aria-selected", String(!showToday));
  elements.todayPanel.hidden = !showToday;
  elements.daysPanel.hidden = showToday;
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = elements.search.value.trim();
  if (query.length < 2) return;
  const visibleChoice = elements.searchResults.hidden ? null : elements.searchResults.querySelector(".search-result");
  if (visibleChoice) {
    visibleChoice.focus();
    return;
  }
  const intentId = beginForecastIntent();
  clearLocationChoices();
  setLoading(true);
  showStatus();
  try {
    const locations = await searchLocation(query);
    if (!isCurrentForecastIntent(intentId)) return;
    if (locations.length === 1) {
      clearLocationChoices();
      elements.search.value = "";
      await fetchForecast(locations[0], { intentId });
    } else {
      renderLocationChoices(locations, { focusFirst: true, labelText: "Choose the right location" });
      setLoading(false);
    }
  } catch (error) {
    if (!isCurrentForecastIntent(intentId)) return;
    showStatus(error.message);
    setLoading(false);
  }
});

elements.search.addEventListener("input", scheduleLocationSuggestions);
elements.search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") clearLocationChoices();
  if (event.key === "ArrowDown" && !elements.searchResults.hidden) {
    const firstChoice = elements.searchResults.querySelector(".search-result");
    if (firstChoice) {
      event.preventDefault();
      firstChoice.focus();
    }
  }
});

document.addEventListener("pointerdown", (event) => {
  if (!elements.searchArea.contains(event.target)) clearLocationChoices();
});

elements.locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Location access is not supported by this browser. Search for your city instead.");
    return;
  }
  const intentId = beginForecastIntent();
  setLoading(true);
  showStatus("Requesting your location...");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      if (!isCurrentForecastIntent(intentId)) return;
      showStatus("Finding your city...");
      const location = await reverseLocation(coords.latitude, coords.longitude);
      if (!isCurrentForecastIntent(intentId)) return;
      await fetchForecast(location, { intentId });
    },
    () => {
      if (!isCurrentForecastIntent(intentId)) return;
      showStatus("We could not access your location. Search for your city instead.");
      setLoading(false);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
});

elements.unitButton.addEventListener("click", async () => {
  const intentId = beginForecastIntent();
  const requestedUnit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  const didUpdate = await fetchForecast(state.location, { unit: requestedUnit, intentId });
  if (!didUpdate) return;
  localStorage.setItem(UNIT_STORAGE_KEY, state.unit);
  updateUnitButton();
});

elements.todayTab.addEventListener("click", () => selectTab("today"));
elements.daysTab.addEventListener("click", () => selectTab("days"));
elements.hourlyPrevious.addEventListener("click", () => scrollHourly(-1));
elements.hourlyNext.addEventListener("click", () => scrollHourly(1));
elements.hourly.addEventListener("scroll", updateHourlyNavigation, { passive: true });

if ("ResizeObserver" in window) {
  new ResizeObserver(updateHourlyNavigation).observe(elements.hourly);
}

updateUnitButton();
createRainDrops();
fetchForecast(DEFAULT_LOCATION);
