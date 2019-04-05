/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

/**
 * Misc. utility methods
 * @module utils
 */

import * as ChromeStorage
  from '../scripts/chrome-extension-utils/scripts/storage.js';
import * as ChromeUtils
  from '../scripts/chrome-extension-utils/scripts/utils.js';
import '../scripts/chrome-extension-utils/scripts/ex_handler.js';

/**
 * True if development build
 * @type {boolean}
 * @private
 */
const _DEBUG = false;

/**
 * True if development build
 * @type {boolean}
 */
export const DEBUG = _DEBUG;

/**
 * Get our email address
 * @returns {string} email address
 */
export function getEmail() {
  return 'photoscreensaver@gmail.com';
}

/**
 * Get body for an email with basic extension info
 * @returns {string} text
 */
export function getEmailBody() {
  return `Extension version: ${ChromeUtils.getVersion()}\n`
      + `Chrome version: ${ChromeUtils.getFullChromeVersion()}\n`
      + `OS: ${ChromeStorage.get('os')}\n\n\n`;
}

/**
 * Get encoded url for an email
 * @param {string} subject - email subject
 * @param {string} body - email body
 * @returns {string} encoded url
 */
export function getEmailUrl(subject: string, body: string) {
  const email = encodeURIComponent(getEmail());
  const sub = encodeURIComponent(subject);
  const bod = encodeURIComponent(body);
  return `mailto:${email}?subject=${sub}&body=${bod}`;
}

/**
 * Get our Github base path
 * @returns {string} path
 */
export function getGithubPath() {
  return 'https://github.com/opus1269/screensaver/';
}

/**
 * Get our Github pages base path
 * @returns {string} path
 */
export function getGithubPagesPath() {
  if (DEBUG) {
    return 'http://127.0.0.1:4000/';
  } else {
    return 'https://opus1269.github.io/screensaver/';
  }
}