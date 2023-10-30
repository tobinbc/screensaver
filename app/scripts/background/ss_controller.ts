/**
 * Controller for the screensaver
 *
 * @module scripts/bg/ss_controller
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import * as ChromeGA from '../../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeHttp from '../../node_modules/chrome-ext-utils/src/http.js';
import * as ChromeLocale from '../../node_modules/chrome-ext-utils/src/locales.js';
import * as ChromeLog from '../../node_modules/chrome-ext-utils/src/log.js';
import * as ChromeMsg from '../../node_modules/chrome-ext-utils/src/msg.js';
import * as ChromeStorage from '../../node_modules/chrome-ext-utils/src/storage.js';
import {ChromeTime} from '../../node_modules/chrome-ext-utils/src/time.js';
import * as ChromeUtils from '../../node_modules/chrome-ext-utils/src/utils.js';

import * as MyMsg from '../../scripts/my_msg.js';

import * as AppData from './data.js';

/** Screensaver URL */
const SS_URL = '/html/screensaver.html';

/** Error showing Screensaver */
const ERR_SHOW = ChromeLocale.localize('err_show_ss');

/**
 * Determine if the screensaver can be displayed
 *
 * @returns true if we should display the screensaver
 */
export async function isActive() {
  const enabled = await ChromeStorage.asyncGet('enabled', AppData.DEFS.enabled);
  const keepAwake = await ChromeStorage.asyncGet('keepAwake', AppData.DEFS.keepAwake);
  const aStart = await ChromeStorage.asyncGet('activeStart', AppData.DEFS.activeStart);
  const aStop = await ChromeStorage.asyncGet('activeStop', AppData.DEFS.activeStop);
  const inRange = ChromeTime.isInRange(aStart, aStop);

  // do not display if screen saver is not enabled or
  // keepAwake scheduler is enabled and is in the inactive range
  return !(!enabled || (keepAwake && !inRange));
}

/**
 * Display the screensaver(s)
 *
 * @remarks
 *
 * Important: Always request screensaver through this call
 *
 * @param single - if true, only show on main display
 */
export async function display(single: boolean) {
  const hasWakeLockResult = await hasWakeLock();
  if (hasWakeLockResult) {
    return;
  }

  try {
    const all = await ChromeStorage.asyncGet('allDisplays', AppData.DEFS.allDisplays);
    if (!single && all) {
      await openOnAllDisplays();
    } else {
      await open();
    }
  } catch (err) {
    ChromeLog.error(err.message, 'SSControl.display');
  }
}

/** Close all the screen saver windows */
export function close() {
  // send message to the screensavers to close themselves
  ChromeMsg.send(MyMsg.TYPE.SS_CLOSE).catch(() => {});
}

/**
 * Determine if there is an active display wakelock on the system
 * by calling the Companion application.
 */
async function hasWakeLock() {
  try {
    const url = 'http://localhost:32123/check-wake-locks';
    const response = await ChromeHttp.doGet(url);
    return !!response.hasWakeLocks;
  } catch (e) {
    ChromeLog.error(e.message, 'SSController.hasWakeLock()', 'Error with Companion app');
  }
}

/**
 * Request placing the screensaver window on top from the Companion application.
 */
async function placeWindowOnTop() {
  try {
    const url = 'http://localhost:32123/place-window';
    await ChromeHttp.doGet(url);
  } catch (e) {
    ChromeLog.error(e.message, 'SSController.placeWindowOnTop()', 'Error with Companion app');
  }
}

/**
 * Determine if there is a full screen chrome window running on a display
 *
 * @param disp - an optional connected display, otherwise the main display
 * @returns true if there is a full screen window on the display
 */
async function hasFullscreen(disp?: chrome.system.display.DisplayInfo) {
  let ret = false;
  const fullScreen = await ChromeStorage.asyncGet('chromeFullscreen', AppData.DEFS.chromeFullscreen);

  try {
    if (fullScreen) {
      // see if there is a Chrome window that is in full screen mode
      const wins = await chrome.windows.getAll({populate: false});
      const left = disp ? disp.bounds.left : 0;
      const top = disp ? disp.bounds.top : 0;
      for (const win of wins) {
        if ((win.state === 'fullscreen') && (!disp || (win.top === top && win.left === left))) {
          ret = true;
          break;
        }
      }
    }
  } catch (err) {
    ChromeGA.error(err.message, 'SSController.hasFullscreen');
  }

  return ret;
}

/**
 * Determine if a screensaver is currently showing
 *
 * @returns true if showing
 */
async function isShowing() {
  // send message to the screensavers to see if any are around
  try {
    await ChromeMsg.send(MyMsg.TYPE.SS_IS_SHOWING);
    return true;
  } catch (err) {
    // no one listening
    return false;
  }
}

/**
 * Open a screensaver window on the given display
 *
 * @param disp - an optional connected display, otherwise the main display
 */
async function open(disp?: chrome.system.display.DisplayInfo) {
  // window creation options
  const winOpts: chrome.windows.CreateData = {
    url: SS_URL,
    type: 'popup',
  };

  try {
    const hasFullScreen = await hasFullscreen(disp);
    if (hasFullScreen) {
      // don't display if there is a fullscreen window
      return;
    }

    if (!disp) {
      winOpts.state = 'fullscreen';
    } else {
      winOpts.left = disp.bounds.left;
      winOpts.top = disp.bounds.top;
      winOpts.width = disp.bounds.width;
      winOpts.height = disp.bounds.height;
    }

    const win = await chrome.windows.create(winOpts);
    if (win && win.id) {
      if (disp) {
        await chrome.windows.update(win.id, {state: 'fullscreen'});
      }
      await chrome.windows.update(win.id, {focused: true});
    }

    await new Promise((r) => setTimeout(r, 1000));

    await placeWindowOnTop();

  } catch (err) {
    ChromeLog.error(err.message, 'SSControl.open', ERR_SHOW);
  }
}

/** Open a screensaver on every connected display */
async function openOnAllDisplays() {
  // TODO: Replace typecast if chrome.system.display is type added
  try {
    const displayArr: chrome.system.display.DisplayInfo[] = await (chrome as any).system.display.getInfo();
    if (displayArr.length === 1) {
      await open();
    } else {
      for (const disp of displayArr) {
        await open(disp);
      }
    }
  } catch (err) {
    ChromeLog.error(err.message, 'SSControl.openOnAllDisplays', ERR_SHOW);
  }
}

/**
 * Fired when the system changes to an active, idle or locked state.
 * The event fires with "locked" if the screen is locked or the [built in]
 * screensaver activates, "idle" if the system is unlocked and the user has not
 * generated any input for a specified number of seconds, and "active" when the
 * user generates input on an idle system.
 *
 * @link https://developer.chrome.com/extensions/idle#event-onStateChanged
 *
 * @param state - current state of computer
 * @event
 */
async function onIdleStateChanged(state: string) {
  try {
    const showing = await isShowing();
    if (state === 'idle') {
      if (await isActive() && !showing) {
        await display(false);
      }
    } else if (state === 'locked') {
      // close on screen lock
      close();
    } else {
      const isWindows = await ChromeUtils.isWindows();
      if (!isWindows) {
        // Windows 10 Creators triggers an 'active' state
        // when the window is created, so we have to skip closing here.
        // Wouldn't need this at all if ChromeOS handled keyboard (or focus?)
        // right
        close();
      }
    }
  } catch (err) {
    ChromeGA.error(err.message, 'SSControl.onIdleStateChanged');
  }
}

/**
 * Fired when a message is sent from either an extension process<br>
 * (by runtime.sendMessage) or a content script (by tabs.sendMessage).
 *
 * @link https://developer.chrome.com/extensions/runtime#event-onMessage
 *
 * @param request - details for the message
 * @param sender MessageSender object
 * @param response - function to call once after processing
 * @returns true if asynchronous
 * @event
 */
function onChromeMessage(request: ChromeMsg.IMsgType, sender: chrome.runtime.MessageSender,
                         response: ChromeMsg.ResponseCB) {
  let ret = false;
  if (request.message === MyMsg.TYPE.SS_SHOW.message) {
    ret = true; // async
    // preview the screensaver
    display(false).then(() => {
      response({message: 'OK'});
    }).catch((err) => {
      response({error: err.message});
    });
  }
  return ret;
}

// listen for changes to the idle state of the computer
chrome.idle.onStateChanged.addListener(onIdleStateChanged);

// listen for chrome messages
ChromeMsg.addListener(onChromeMessage);
