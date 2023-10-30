/**
 * @module els/pages/google_photos
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import {PaperCheckboxElement} from '../../../node_modules/@polymer/paper-checkbox/paper-checkbox';

import {customElement, listen, property} from '../../../node_modules/@polymer/decorators/lib/decorators.js';
import {html} from '../../../node_modules/@polymer/polymer/polymer-element.js';

import '../../../node_modules/@polymer/iron-label/iron-label.js';

import '../../../node_modules/@polymer/paper-button/paper-button.js';
import '../../../node_modules/@polymer/paper-checkbox/paper-checkbox.js';
import '../../../node_modules/@polymer/paper-item/paper-item-body.js';
import '../../../node_modules/@polymer/paper-item/paper-item.js';
import '../../../node_modules/@polymer/paper-ripple/paper-ripple.js';

import {BaseElement} from '../../../node_modules/common-custom-elements/src/base-element/base-element.js';

import * as ChromeGA from '../../../node_modules/chrome-ext-utils/src/analytics.js';

/**
 * Polymer element to include or exclude a Google Photos category
 */
@customElement('photo-cat')
export class PhotoCatElement extends BaseElement {

  /** Checked state */
  @property({type: Boolean, notify: true})
  protected checked = false;

  /** Descriptive label */
  @property({type: String})
  protected label = '';

  /** Optional group title */
  @property({type: String})
  protected sectionTitle = '';

  /** Disabled state of element */
  @property({type: Boolean})
  protected disabled = false;

  /**
   * checkbox tapped
   *
   * @event
   */
  @listen('change', 'checkbox')
  public onCheckedChange(ev: CustomEvent) {
    const checked = (ev.target as PaperCheckboxElement).checked;
    ChromeGA.event(ChromeGA.EVENT.CHECK, `${this.id}: ${checked}`);
    this.fireEvent('value-changed', checked);
   }

  static get template() {
    // language=HTML format=false
    return html`<style include="shared-styles iron-flex iron-flex-alignment">
  :host {
    display: block;
    position: relative;
  }

  :host([disabled]) {
    pointer-events: none;
  }

  :host iron-label {
    display: block;
    position: relative;
    cursor: pointer;
  }

</style>

<iron-label for="checkbox">
  <paper-item class="center horizontal layout" tabindex="-1">
    <paper-item class="setting-label flex">
      [[label]]
      <paper-ripple center=""></paper-ripple>
    </paper-item>
    <paper-checkbox id="checkbox" name="include" checked="{{checked}}"
                    disabled$="[[disabled]]">
      [[localize('include')]]
    </paper-checkbox>
  </paper-item>
</iron-label>
`;
  }
}
