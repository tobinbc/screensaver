/**
 * Manage alarms from the chrome.alarms API
 * @link https://developer.chrome.com/apps/alarms
 *
 * @module scripts/bg/alarm
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import * as ChromeGA from '../../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeLocale from '../../node_modules/chrome-ext-utils/src/locales.js';
import * as ChromeMsg from '../../node_modules/chrome-ext-utils/src/msg.js';
import * as ChromeStorage from '../../node_modules/chrome-ext-utils/src/storage.js';
import { ChromeTime } from '../../node_modules/chrome-ext-utils/src/time.js';

import * as MyMsg from '../../scripts/my_msg.js';
import * as PhotoSources from '../../scripts/sources/photo_sources.js';
import * as Weather from '../../scripts/weather.js';

import * as AppData from './data.js';
import * as SSController from './ss_controller.js';

/** Unique alarm ids */
const enum ALARMS {
  /** Entering active state for screensaver/keep awake */
  ACTIVATE = 'ACTIVATE',
  /** Leaving active state for screensaver/keep awake */
  DEACTIVATE = 'DEACTIVATE',
  /** Perform daily update of photo sources */
  UPDATE_PHOTOS = 'UPDATE_PHOTOS',
  /** Set the badge text of the extension icon */
  BADGE_TEXT = 'BADGE_TEXT',
  /** Update the current weather */
  WEATHER = 'WEATHER',
}

/** Set the repeating alarms for the keep awake */
export async function updateKeepAwakeAlarm() {
  const keepAwake = await ChromeStorage.asyncGet('keepAwake', AppData.DEFS.keepAwake);
  const aStart = await ChromeStorage.asyncGet('activeStart', AppData.DEFS.activeStart);
  const aStop = await ChromeStorage.asyncGet('activeStop', AppData.DEFS.activeStop);

  // create keep awake active period scheduling alarms
  if (keepAwake && (aStart !== aStop)) {
    const startDelayMin = ChromeTime.getTimeDelta(aStart);
    const stopDelayMin = ChromeTime.getTimeDelta(aStop);

    chrome.alarms.create(ALARMS.ACTIVATE, {
      delayInMinutes: startDelayMin,
      periodInMinutes: ChromeTime.MIN_IN_DAY,
    });

    chrome.alarms.create(ALARMS.DEACTIVATE, {
      delayInMinutes: stopDelayMin,
      periodInMinutes: ChromeTime.MIN_IN_DAY,
    });

    // if we are currently outside of the active range
    // then set inactive state
    if (!ChromeTime.isInRange(aStart, aStop)) {
      await setInactiveState();
    }
  } else {
    chrome.alarms.clear(ALARMS.ACTIVATE);
    chrome.alarms.clear(ALARMS.DEACTIVATE);
  }

  updateBadgeTextAlarm();
}

/** Set the repeating daily photo alarm */
export async function updatePhotoAlarm() {
  // Add daily alarm to update photo sources that request this
  try {
    const alarm = await chrome.alarms.get(ALARMS.UPDATE_PHOTOS);
    if (!alarm) {
      chrome.alarms.create(ALARMS.UPDATE_PHOTOS, {
        when: Date.now() + ChromeTime.MSEC_IN_DAY,
        periodInMinutes: ChromeTime.MIN_IN_DAY,
      });
    }
  } catch (err) {
    ChromeGA.error(err.message, 'Alarm.updatePhotoAlarm');
  }
}

/** Set the weather alarm */
export async function updateWeatherAlarm() {
  const showWeather = await ChromeStorage.asyncGet('showCurrentWeather', AppData.DEFS.showCurrentWeather);
  if (showWeather) {
    // Add repeating alarm to update current weather
    // Trigger it every ten minutes, even though weather won't
    // update that often
    try {
      const alarm = await chrome.alarms.get(ALARMS.WEATHER);
      if (!alarm) {
        // doesn't exist, create it
        chrome.alarms.create(ALARMS.WEATHER, {
          when: Date.now(),
          periodInMinutes: 10,
        });
      }
    } catch (err) {
      ChromeGA.error(err.message, 'Alarm.updateWeatherAlarm');
    }
  } else {
    chrome.alarms.clear(ALARMS.WEATHER);
  }
}

/** Set the icon badge text alarm */
export function updateBadgeTextAlarm() {
  // delay setting a little to make sure range check is good
  chrome.alarms.create(ALARMS.BADGE_TEXT, {
    when: Date.now() + 1000,
  });
}

/** Set state when the screensaver is in the active time range */
async function setActiveState() {
  const keepAwake = await ChromeStorage.asyncGet('keepAwake', AppData.DEFS.keepAwake);
  const enabled = await ChromeStorage.asyncGet('enabled', AppData.DEFS.enabled);
  if (keepAwake) {
    chrome.power.requestKeepAwake('display');
  }

  // determine if we should show screensaver
  const interval = await AppData.getIdleSeconds();
  try {
    // @ts-ignore - type not updated
    const state = (await chrome.idle.queryState(interval)) as string;
    // display screensaver if enabled and the idle time criteria is met
    if (enabled && (state === 'idle')) {
      await SSController.display(false);
    }
  } catch (err) {
    ChromeGA.error(err.message, 'Alarm.setActiveState');
  }

  updateBadgeTextAlarm();
}

/** Set state when the screensaver is in the inactive time range */
async function setInactiveState() {
  const allowSuspend = await ChromeStorage.asyncGet('allowSuspend', AppData.DEFS.allowSuspend);
  if (allowSuspend) {
    chrome.power.releaseKeepAwake();
  } else {
    chrome.power.requestKeepAwake('system');
  }
  SSController.close();
  updateBadgeTextAlarm();
}

/** Set the Badge text on the icon */
async function setBadgeText() {
  const enabled = await ChromeStorage.asyncGet('enabled', AppData.DEFS.enabled);
  const keepAwake = await ChromeStorage.asyncGet('keepAwake', AppData.DEFS.keepAwake);
  let text = '';
  if (enabled) {
    text = await SSController.isActive() ? '' : ChromeLocale.localize('sleep_abbrev');
  } else {
    text = keepAwake
      ? ChromeLocale.localize('power_abbrev')
      : ChromeLocale.localize('off_abbrev');
  }
  chrome.browserAction.setBadgeText({ text: text });
}

/**
 * Update the weather
 *
 * @throws An error if update failed
 */
async function updateWeather() {
  // is the screensaver running
  let response = null;
  try {
    response = await ChromeMsg.send(MyMsg.TYPE.SS_IS_SHOWING);
  } catch (err) {
    // ignore - means no screensaver around
  }

  if (response) {
    await Weather.update();
  }
}

/**
 * Fired when an alarm has triggered.
 * @link https://developer.chrome.com/apps/alarms#event-onAlarm
 *
 * @param alarm - details on the alarm
 * @event
 */
async function onAlarm(alarm: chrome.alarms.Alarm) {
  const METHOD = 'Alarm.onAlarm';
  try {
    switch (alarm.name) {
      case ALARMS.ACTIVATE:
        // entering active time range of keep awake
        await setActiveState();
        break;
      case ALARMS.DEACTIVATE:
        // leaving active time range of keep awake
        await setInactiveState();
        break;
      case ALARMS.UPDATE_PHOTOS:
        // get the latest for the daily photo streams
        try {
          await PhotoSources.processDaily();
        } catch (err) {
          ChromeGA.error(err.message, METHOD);
        }
        break;
      case ALARMS.BADGE_TEXT:
        // set the icons text
        await setBadgeText();
        break;
      case ALARMS.WEATHER:
        // try to update the weather
        try {
          await updateWeather();
        } catch (err) {
          ChromeGA.error(err.message, METHOD);
        }
        break;
      default:
        break;
    }
  } catch (err) {
    ChromeGA.error(err.message, METHOD);
  }
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(onAlarm);
