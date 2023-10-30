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

import { PhotoCatElement } from './photo_cat';

import {
  computed,
  customElement,
  listen,
  observe,
  property,
} from '../../../node_modules/@polymer/decorators/lib/decorators.js';
import { html } from '../../../node_modules/@polymer/polymer/polymer-element.js';

import '../../../node_modules/@polymer/paper-button/paper-button.js';
import '../../../node_modules/@polymer/paper-item/paper-item-body.js';
import '../../../node_modules/@polymer/paper-item/paper-item.js';
import '../../../node_modules/@polymer/paper-ripple/paper-ripple.js';
import '../../../node_modules/@polymer/paper-spinner/paper-spinner.js';

import '../../../node_modules/@polymer/app-storage/app-localstorage/app-localstorage-document.js';

import { BaseElement } from '../../../node_modules/common-custom-elements/src/base-element/base-element.js';

import '../../../node_modules/common-custom-elements/src/setting-elements/setting-toggle/setting-toggle.js';
import '../../../node_modules/common-custom-elements/src/waiter-element/waiter-element.js';

import './photo_cat.js';

import * as ChromeGA from '../../../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeLocale from '../../../node_modules/chrome-ext-utils/src/locales.js';
import * as ChromeMsg from '../../../node_modules/chrome-ext-utils/src/msg.js';
import * as ChromeStorage from '../../../node_modules/chrome-ext-utils/src/storage.js';

import * as MyMsg from '../../../scripts/my_msg.js';
import * as Permissions from '../../../scripts/permissions.js';

import { Options } from '../../../scripts/options/options.js';
import { GoogleSource } from '../../../scripts/sources/photo_source_google.js';

/** Polymer element for the Google Photos page photos view UI */
@customElement('photos-view')
export class PhotosViewElement extends BaseElement {

  /** Do we need to reload the photos */
  @property({ type: Boolean, notify: true })
  public needsPhotoRefresh = true;

  /** Flag to indicate if we should not filter photos */
  @property({ type: Boolean, notify: true, observer: 'noFilterChanged' })
  public noFilter = true;

  /** Status of the option permission for the Google Photos API */
  @property({ type: String, notify: true })
  public permPicasa: string = Permissions.STATE.notSet;

  /** Flag to indicate if UI is disabled */
  @property({ type: Boolean })
  public disabled = false;

  /** Flag to display the loading... UI */
  @property({ type: Boolean })
  public waitForLoad = false;

  /** Array of photo categories */
  @property({ type: Array })
  protected readonly cats = [
    { name: 'LANDSCAPES', label: ChromeLocale.localize('photo_cat_landscapes') },
    { name: 'CITYSCAPES', label: ChromeLocale.localize('photo_cat_cityscapes') },
    { name: 'LANDMARKS', label: ChromeLocale.localize('photo_cat_landmarks') },
    { name: 'PEOPLE', label: ChromeLocale.localize('photo_cat_people') },
    { name: 'ANIMALS', label: ChromeLocale.localize('photo_cat_animals') },
    { name: 'PETS', label: ChromeLocale.localize('photo_cat_pets') },
    { name: 'PERFORMANCES', label: ChromeLocale.localize('photo_cat_performances') },
    { name: 'SPORT', label: ChromeLocale.localize('photo_cat_sport') },
    { name: 'FOOD', label: ChromeLocale.localize('photo_cat_food') },
    { name: 'SELFIES', label: ChromeLocale.localize('photo_cat_selfies') },
  ];

  /** Count for photo mode */
  @property({ type: Number, notify: true })
  protected photoCount = 0;

  /** Status label for waiter */
  @property({ type: Boolean })
  protected waiterStatus = '';

  /** Hidden state of the main ui */
  @computed('waitForLoad', 'permPicasa')
  get isHidden() {
    let ret = true;
    if (!this.waitForLoad && (this.permPicasa === 'allowed')) {
      ret = false;
    }
    return ret;
  }

  /** Disabled state of filter ui elements */
  @computed('disabled', 'noFilter')
  get isFilterDisabled() {
    return this.disabled || this.noFilter;
  }

  /** Disabled state of refresh button */
  @computed('disabled', 'needsPhotoRefresh')
  get isRefreshDisabled() {
    return this.disabled || !this.needsPhotoRefresh;
  }

  /**
   * Called when the element is added to a document.
   * Can be called multiple times during the lifetime of an element.
   */
  public connectedCallback() {
    super.connectedCallback();

    // listen for chrome messages
    ChromeMsg.addListener(this.onChromeMessage.bind(this));

    // listen for changes to chrome.storage
    chrome.storage.onChanged.addListener(this.onChromeStorageChanged.bind(this));
  }

  /**
   * Called when the element is removed from a document.
   * Can be called multiple times during the lifetime of an element.
   */
  public disconnectedCallback() {
    super.disconnectedCallback();

    // stop listening for chrome messages
    ChromeMsg.removeListener(this.onChromeMessage.bind(this));

    // stop listening for changes to chrome.storage
    chrome.storage.onChanged.removeListener(this.onChromeStorageChanged.bind(this));
  }

  /**
   * Called during Polymer-specific element initialization.
   * Called once, the first time the element is attached to the document.
   */
  public ready() {
    super.ready();

    setTimeout(async () => {
      await this.setPhotoCount().catch(() => { });

      // set state of photo categories
      await this.setPhotoCats();

    }, 0);
  }

  /** Query Google Photos for the array of user's photos */
  public async loadPhotos() {
    const METHOD = 'PhotosView.loadPhotos';
    let error: Error | undefined;
    try {
      const granted = await Permissions.request(Permissions.GOOGLE_PHOTOS);

      if (!granted) {
        // failed to get google photos permission
        await Permissions.removeGooglePhotos();
        const title = ChromeLocale.localize('err_load_photos');
        const text = ChromeLocale.localize('err_auth_picasa');
        Options.showErrorDialog(title, text, METHOD);
        return;
      }

      this.set('waitForLoad', true);

      // send message to background page to do the work
      const json = await ChromeMsg.send(MyMsg.TYPE.LOAD_FILTERED_PHOTOS);

      if (Array.isArray(json)) {
        // photos
        const set =
          await ChromeStorage.asyncSet('googleImages', json,
            'useGooglePhotos');
        if (!set) {
          Options.showStorageErrorDialog(METHOD);
          this.set('needsPhotoRefresh', true);
        } else {
          this.set('needsPhotoRefresh', false);
        }
        await this.setPhotoCount();
      } else {
        // error
        error = new Error(json.message);
      }
    } catch (err) {
      error = err;
    } finally {
      this.set('waitForLoad', false);
    }

    if (error) {
      const title = ChromeLocale.localize('err_load_photos');
      const text = error.message;
      Options.showErrorDialog(title, text, METHOD);
    }
  }

  /** Set the photo count that is currently saved */
  public async setPhotoCount() {
    const photos = await ChromeStorage.asyncGet('googleImages', []);
    this.set('photoCount', photos.length);
  }

  /**
   * Refresh photos button clicked
   *
   * @event
   */
  @listen('click', 'refreshButton')
  public onRefreshPhotosClicked() {
    this.loadPhotos().catch(() => { });
    ChromeGA.event(ChromeGA.EVENT.BUTTON, 'refreshPhotos');
  }

  /**
   * Item in chrome.storage changed
   *
   * @param changes - details on changes
   * @event
   */
  protected onChromeStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
    for (const key of Object.keys(changes)) {
      if (key === 'googleImages') {
        this.setPhotoCount().catch(() => { });
        this.set('needsPhotoRefresh', true);
        break;
      }
    }
  }

  /** Wait for load changed */
  @observe('waitForLoad', 'waiterStatus')
  protected waitForLoadChanged(waitForLoad: boolean, waiterStatus: string) {
    if (!waitForLoad && waiterStatus) {
      this.set('waiterStatus', '');
    }
  }

  /** Simple Observer: noFilter changed */
  protected noFilterChanged(newValue: boolean, oldValue: boolean) {
    if ((newValue !== undefined) && (oldValue !== undefined)) {
      if (newValue !== oldValue) {
        this.set('needsPhotoRefresh', true);
      }
    }
  }

  /** Set the states of the photo-cat elements */
  protected async setPhotoCats() {
    const els = (this.shadowRoot as ShadowRoot).querySelectorAll('photo-cat') as NodeListOf<PhotoCatElement>;
    const filter = await ChromeStorage.asyncGet('googlePhotosFilter', GoogleSource.DEF_FILTER);
    filter.contentFilter = filter.contentFilter || {};
    const includes = filter.contentFilter.includedContentCategories || [];

    for (const el of els) {
      const cat = el.id;
      const idx = includes.findIndex((e: string) => {
        return e === cat;
      });
      el.set('checked', (idx !== -1));
    }
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Selection of a photo-cat changed
   *
   * @event
   */
  protected async onPhotoCatChanged(ev: CustomEvent) {
    const cat = (ev.target as Element).id;
    const checked = ev.detail.value;
    const filter = await ChromeStorage.asyncGet('googlePhotosFilter', GoogleSource.DEF_FILTER);
    filter.contentFilter = filter.contentFilter || {};
    const includes = filter.contentFilter.includedContentCategories || [];
    const idx = includes.findIndex((e: string) => {
      return e === cat;
    });

    // add and remove as appropriate
    if (checked) {
      if (idx === -1) {
        includes.push(cat);
      }
    } else {
      if (idx !== -1) {
        includes.splice(idx, 1);
      }
    }

    filter.contentFilter.includedContentCategories = includes;

    this.set('needsPhotoRefresh', true);
    await ChromeStorage.asyncSet('googlePhotosFilter', filter);
  }

  /**
   * Fired when a message is sent from either an extension process<br>
   * (by runtime.sendMessage) or a content script (by tabs.sendMessage).
   *
   * {@link https://developer.chrome.com/extensions/runtime#event-onMessage}
   *
   * @param request - details for the message
   * @param sender - MessageSender object
   * @param response - function to call once after processing
   * @returns true if asynchronous
   * @event
   */
  protected onChromeMessage(
    request: ChromeMsg.IMsgType,
    sender: chrome.runtime.MessageSender,
    response: ChromeMsg.ResponseCB
  ) {
    if (request.message === MyMsg.TYPE.FILTERED_PHOTOS_COUNT.message) {
      // show user status of photo loading
      const count = request.count || 0;
      const msg = `${ChromeLocale.localize('photo_count')} ${count.toString()}`;
      this.set('waiterStatus', msg);
      response({ message: 'OK' });
    }
    return false;
  }

  static get template() {
    // language=HTML format=false
    return html`<style include="shared-styles iron-flex iron-flex-alignment">
  :host {
    display: block;
    position: relative;
  }

  :host .album-note {
    @apply --paper-font-title;
    padding: 8px 16px 8px 16px;
    margin-right: 0;
    white-space: normal;
  }

  :host .photo-count-container {
    padding: 16px 0 16px 0;
    white-space: normal;
  }

  :host .photo-count-container paper-button {
    margin: 0 8px 0 0;
    @apply --paper-font-title;
  }

  :host .photo-count-container #photoCount {
    @apply --paper-font-title;
    padding-right: 0;
  }

</style>

<waiter-element active="[[waitForLoad]]" label="[[localize('google_loading')]]"
                status-label="[[waiterStatus]]"></waiter-element>

<div class="photos-container" hidden$="[[isHidden]]">
  <div class="photo-count-container horizontal layout">
    <paper-item class="flex" id="photoCount" disabled$="[[disabled]]">
      <span>[[localize('photo_count')]]</span>&nbsp <span>[[photoCount]]</span>
    </paper-item>
    <paper-button id="refreshButton" disabled$="[[isRefreshDisabled]]">
      [[localize('button_needs_refresh')]]
    </paper-button>
  </div>
  <hr class="divider" hidden$="[[noseparator]]">

  <setting-toggle name="noFilter" main-label="[[localize('photo_no_filter')]]"
                  secondary-label="[[localize('photo_no_filter_desc')]]"
                  checked="{{noFilter}}" disabled$="[[disabled]]"></setting-toggle>

  <div class="section-title">[[localize('photo_cat_title')]]</div>

  <template id="t" is="dom-repeat" items="[[cats]]" as="cat">
    <photo-cat id="[[cat.name]]"
               label="[[cat.label]]"
               on-value-changed="onPhotoCatChanged"
               disabled$="[[isFilterDisabled]]"></photo-cat>
  </template>

  <hr class="divider" hidden$="[[noseparator]]">
  <paper-item class="album-note">
    [[localize('note_albums')]]
  </paper-item>

  <app-localstorage-document key="permPicasa" data="{{permPicasa}}" storage="window.localStorage">
  </app-localstorage-document>
  <app-localstorage-document key="googlePhotosNoFilter" data="{{noFilter}}" storage="window.localStorage">
  </app-localstorage-document>

</div>
`;
  }
}
