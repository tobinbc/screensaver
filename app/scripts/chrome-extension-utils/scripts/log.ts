/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

/**
 * Log a message. Will also store the LastError to local storage as 'lastError'
 * @module chrome/log
 */

import * as ChromeGA from './analytics.js';
import * as ChromeLocale from './locales.js';
import ChromeLastError from './last_error.js';
import * as ChromeUtils from './utils.js';
import './ex_handler.js';

/**
 * Log an error
 * @param {?string} [msg=null] - override label
 * @param {?string} [meth=null] - override action
 * @param {?string} [title=null] - a title for the error
 * @param {?string} [extra=null] - extra info. for analytics
 */
export function error(msg: string = null, meth: string = null,
                      title: string = null, extra: string = null) {
  msg = msg || ChromeLocale.localize('err_unknown', 'unknown');
  meth = meth || ChromeLocale.localize('err_unknownMethod', 'unknownMethod');
  title = title || ChromeLocale.localize('err_error', 'An error occurred');
  const gaMsg = extra ? `${msg} ${extra}` : msg;
  ChromeLastError.save(new ChromeLastError(title, msg)).catch(() => {});
  ChromeGA.error(gaMsg, meth);
}

/**
 * Log an exception
 * @param {Error} exception - the exception
 * @param {?string} [msg=null] - the error message
 * @param {boolean} [fatal=true] - true if fatal
 * @param {?string} [title=null] - a title for the exception
 */
export function exception(exception: Error, msg: string = null, fatal = false,
                          title: string = null) {
  try {
    let errMsg = msg;
    if (!errMsg && exception && exception.message) {
      errMsg = exception.message;
    }
    title = title ||
        ChromeLocale.localize('err_exception', 'An exception occurred');
    ChromeLastError.save(new ChromeLastError(title, errMsg)).catch(() => {});
    ChromeGA.exception(exception, msg, fatal);
  } catch (err) {
    ChromeUtils.noop();
  }
}