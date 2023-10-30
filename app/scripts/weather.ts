/**
 * Manage weather information
 *
 * @module scripts/weather
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import * as ChromeGA from '../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeHttp from '../node_modules/chrome-ext-utils/src/http.js';
import * as ChromeJSON from '../node_modules/chrome-ext-utils/src/json.js';
import * as ChromeLocale from '../node_modules/chrome-ext-utils/src/locales.js';
import * as ChromeLog from '../node_modules/chrome-ext-utils/src/log.js';
import * as ChromeStorage from '../node_modules/chrome-ext-utils/src/storage.js';
import {ChromeTime} from '../node_modules/chrome-ext-utils/src/time.js';
import * as ChromeUtils from '../node_modules/chrome-ext-utils/src/utils.js';

import * as MyGA from '../scripts/my_analytics.js';

/** A geo location */
export interface IWeatherLocation {
  /** latitude */
  lat: number;
  /** longitude */
  lon: number;
}

/** Current weather conditions */
export interface ICurrentWeather {
  /** call time UTC milli sec */
  time: number;
  /** weather type id */
  id: number;
  /** day night prefix ('', 'day-', 'night-") */
  dayNight: string;
  /** temperature value in K */
  tempValue: number;
  /** temperature string */
  temp: string;
  /** city name */
  city: string;
  /** weather description */
  description: string;
}

/** Default weather */
export const DEF_WEATHER: ICurrentWeather = {
  time: 0,
  id: 0,
  dayNight: '',
  tempValue: 0.0,
  temp: '',
  description: '',
  city: '',
};

/** Default geolocation permission options */
export const DEF_LOC_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 60000,
  maximumAge: 0,
};

/** Default geolocation options */
export const DEF_LOC: IWeatherLocation = {
  lat: 0.0,
  lon: 0.0,
};

/** Temperature units */
export const enum TEMP_UNIT {
  C = 0,
  F,
}

/** The most frequently we will call the API */
const MIN_CALL_FREQ = ChromeTime.MSEC_IN_HOUR;

/** API key */
const KEY = 'KEY_WEATHER';

/** Base url of weather API */
const URL_BASE = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * Update the weather
 *
 * @param  force if true, force update
 * @throws An error if update failed
 */
export async function update(force = false) {
  const METHOD = 'Weather.update';
  const ERR_TITLE = ChromeLocale.localize('err_weather_update');

  const showWeather = await ChromeStorage.asyncGet('showCurrentWeather', false);
  const tempUnit = await ChromeStorage.asyncGet('weatherTempUnit', 0);

  if (!showWeather) {
    return;
  }

  if (!force) {
    const curWeather = await ChromeStorage.asyncGet('currentWeather', DEF_WEATHER);
    const lastTime = curWeather.time;
    const time = Date.now();
    if ((time - lastTime) < MIN_CALL_FREQ) {
      // don't update faster than this
      return;
    }
  }

  // first, try to update location
  let location;
  try {
    location = await getLocation();
  } catch (err) {
    if (err.message.match(/User denied Geolocation/)) {
      // no longer have permission
      const msg = ChromeLocale.localize('err_geolocation_perm');
      ChromeLog.error(msg, METHOD, ERR_TITLE);
      await ChromeStorage.asyncSet('showCurrentWeather', false);
      return;
    }
    // use last location
    location = await ChromeStorage.asyncGet('location', DEF_LOC);
  }

  // now, try to update weather
  try {
    const conf: ChromeHttp.IConfig = ChromeJSON.shallowCopy(ChromeHttp.CONFIG);
    conf.maxRetries = 3;
    let url = URL_BASE;
    url += `?lat=${location.lat}&lon=${location.lon}&APPID=${KEY}`;

    const response = await ChromeHttp.doGet(url, conf);

    if (response.cod !== 200) {
      const msg = `${ChromeLocale.localize('err_status')}: ${response.cod}`;
      ChromeLog.error(msg, METHOD, ERR_TITLE);
      return;
    }

    const curWeather = ChromeJSON.shallowCopy(DEF_WEATHER);
    curWeather.time = Date.now();

    if (response.name) {
      curWeather.city = response.name;
    }

    const sys = response.sys;
    if (sys && sys.sunrise && sys.sunset) {
      // sys time is UTC in seconds
      const time = curWeather.time / 1000;
      if ((time > sys.sunrise) && (time < sys.sunset)) {
        curWeather.dayNight = 'day-';
      } else {
        curWeather.dayNight = 'night-';
      }
    }

    const main = response.main;
    if (main && main.temp) {
      curWeather.tempValue = main.temp;
      if (tempUnit === 1) {
        curWeather.temp = kToF(curWeather.tempValue);
      } else {
        curWeather.temp = kToC(curWeather.tempValue);
      }
    }

    const weather = response.weather || [];
    if (weather[0].description) {
      curWeather.description = weather[0].description;
    }
    if (weather[0].id) {
      curWeather.id = weather[0].id;
    }

    await ChromeStorage.asyncSet('currentWeather', curWeather);

    ChromeGA.event(MyGA.EVENT.WEATHER_UPDATED);
  } catch (err) {
    ChromeLog.error(err.message, METHOD, ERR_TITLE);
    throw err;
  }
}

/** Update the display units */
export async function updateUnits() {
  const curWeather = await ChromeStorage.asyncGet('currentWeather', DEF_WEATHER);
  const tempUnit = await ChromeStorage.asyncGet('weatherTempUnit', 0);
  if (tempUnit === 1) {
    curWeather.temp = kToF(curWeather.tempValue);
  } else {
    curWeather.temp = kToC(curWeather.tempValue);
  }
  await ChromeStorage.asyncSet('currentWeather', curWeather);
}

/**
 * Get the current geo location. Will prompt if needed
 *
 * @param options - api options
 * @throws An error if we failed to get location
 * @returns current location
 */
export async function getLocation(options = DEF_LOC_OPTIONS) {
  const METHOD = 'Weather.getLocation';
  const ERR_TITLE = ChromeLocale.localize('err_geolocation_title');

  ChromeUtils.checkNetworkConnection();

  let position: any;
  try {
    position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  } catch (err) {
    // log and rethrow
    ChromeLog.error(err.message, METHOD, ERR_TITLE);
    throw err;
  }

  const ret = {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
  await ChromeStorage.asyncSet('location', ret);
  return ret;
}

/** Convert Kelvin to degrees F */
function kToF(temp: number) {
  const value = (temp - 273.17) * 9.0 / 5.0 + 32.0;
  return `${value.toFixed(0)} \u00b0F`;
}

/** Convert Kelvin to degrees C */
function kToC(temp: number) {
  const value = temp - 273.17;
  return `${value.toFixed(0)} \u00b0C`;
}
