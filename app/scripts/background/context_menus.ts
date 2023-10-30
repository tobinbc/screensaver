/**
 * Manage the Context Menus for the extension
 * @link https://developer.chrome.com/extensions/contextMenus
 *
 * @module scripts/bg/context_menus
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
import * as ChromeStorage from '../../node_modules/chrome-ext-utils/src/storage.js';

import * as AppData from './data.js';
import * as SSController from './ss_controller.js';

/** Unique menu ids */
const enum MENU {
  /** Display screensaver */
  DISPLAY = 'DISPLAY_MENU',
  /** Toggle enabled state of screensaver */
  ENABLE = 'ENABLE_MENU',
  /** Separator */
  SEP = 'SEP_MENU',
}

/** Initialize the menus */
export async function initialize() {
  try {
    await chrome.contextMenus.create({
      type: 'normal',
      id: MENU.DISPLAY,
      title: ChromeLocale.localize('display_now'),
      contexts: ['browser_action'],
    });
  } catch (err) {
    if (!err.message.includes('duplicate id')) {
      ChromeGA.error(err.message, 'chrome.contextMenus.create');
    }
  }

  try {
    await chrome.contextMenus.create({
      type: 'normal',
      id: MENU.ENABLE,
      title: ChromeLocale.localize('disable'),
      contexts: ['browser_action'],
    });
  } catch (err) {
    if (!err.message.includes('duplicate id')) {
      ChromeGA.error(err.message, 'chrome.contextMenus.create');
    }
  }

  try {
    await chrome.contextMenus.create({
      type: 'separator',
      id: MENU.SEP,
      contexts: ['browser_action'],
    });
  } catch (err) {
    if (!err.message.includes('duplicate id')) {
      ChromeGA.error(err.message, 'chrome.contextMenus.create');
    }
  }
}

/** Toggle enabled state of the screen saver */
async function toggleEnabled() {
  const oldState = ChromeStorage.get('enabled', true);
  ChromeStorage.set('enabled', !oldState);

  // storage changed event not fired on same page as the change
  try {
    await AppData.processState('enabled');
  } catch (err) {
    ChromeGA.error(err.message, 'ContextMenus.toggleEnabled');
  }
}

/**
 * Fired when a context menu item is clicked.
 * @link https://developer.chrome.com/extensions/contextMenus#event-onClicked
 *
 * @param info - info on the clicked menu
 * @event
 */
async function onMenuClicked(info: chrome.contextMenus.OnClickData) {
  try {
    if (info.menuItemId === MENU.DISPLAY) {
      ChromeGA.event(ChromeGA.EVENT.MENU, `${info.menuItemId}`);
      await SSController.display(false);
    } else if (info.menuItemId === MENU.ENABLE) {
      const isEnabled = ChromeStorage.get('enabled', true);
      ChromeGA.event(ChromeGA.EVENT.MENU, `${info.menuItemId}: ${isEnabled}`);
      await toggleEnabled();
    }
  } catch (err) {
    ChromeGA.error(err.message, 'ContextMenus.onMenuClicked');
  }
}

/**
 * Fired when a registered command is activated using a keyboard shortcut.
 * @link https://developer.chrome.com/extensions/commands#event-onCommand
 *
 * @param cmd - keyboard command
 * @event
 */
async function onKeyCommand(cmd: string) {
  try {
    if (cmd === 'toggle-enabled') {
      ChromeGA.event(ChromeGA.EVENT.KEY_COMMAND, `${cmd}`);
      await toggleEnabled();
    } else if (cmd === 'show-screensaver') {
      ChromeGA.event(ChromeGA.EVENT.KEY_COMMAND, `${cmd}`);
      await SSController.display(false);
    }
  } catch (err) {
    ChromeGA.error(err.message, 'ContextMenus.onKeyCommand');
  }
}

// listen for clicks on context menus
chrome.contextMenus.onClicked.addListener(onMenuClicked);

// listen for special keyboard commands
chrome.commands.onCommand.addListener(onKeyCommand);
