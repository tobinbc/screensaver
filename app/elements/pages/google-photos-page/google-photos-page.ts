/**
 * Custom elements for a page in an SPA app
 *
 * @module els/pages/google_photos
 * @preferred
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import {PaperToggleButtonElement} from '../../../node_modules/@polymer/paper-toggle-button/paper-toggle-button';
import {AlbumsViewElement} from './albums-view';
import {PhotosViewElement} from './photos-view';

import {
  computed,
  customElement,
  listen,
  observe,
  property,
  query,
} from '../../../node_modules/@polymer/decorators/lib/decorators.js';
import {html} from '../../../node_modules/@polymer/polymer/polymer-element.js';

import {BasePageElement} from '../base-page/base-page.js';

import '../../../node_modules/@polymer/paper-icon-button/paper-icon-button.js';
import '../../../node_modules/@polymer/paper-material/paper-material.js';
import '../../../node_modules/@polymer/paper-toggle-button/paper-toggle-button.js';
import '../../../node_modules/@polymer/paper-tooltip/paper-tooltip.js';

import '../../../node_modules/@polymer/app-layout/app-toolbar/app-toolbar.js';
import '../../../node_modules/@polymer/app-storage/app-localstorage/app-localstorage-document.js';

import '../../../elements/my_icons.js';

import './albums-view.js';
import './photos-view.js';

import * as ChromeGA from '../../../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeLocale from '../../../node_modules/chrome-ext-utils/src/locales.js';
import * as ChromeStorage from '../../../node_modules/chrome-ext-utils/src/storage.js';

import * as MyUtils from '../../../scripts/my_utils.js';

import {Options} from '../../../scripts/options/options.js';

/** Polymer element for the Google Photos page */
@customElement('google-photos-page')
export class GooglePhotosPageElement extends BasePageElement {

  /** Select by albums or photos */
  @property({type: Boolean, notify: true})
  public isAlbumMode = true;

  /** Should we use the Google Photos in the screensaver */
  @property({type: Boolean, notify: true})
  public useGoogle = true;

  /** Should we use album photos in the screensaver */
  @property({type: Boolean, notify: true})
  public useGoogleAlbums = true;

  /** Should we use google photos in the screensaver */
  @property({type: Boolean, notify: true})
  public useGooglePhotos = false;

  /** Page title */
  @computed('isAlbumMode')
  get pageTitle() {
    return this.isAlbumMode
        ? ChromeLocale.localize('google_title')
        : ChromeLocale.localize('google_title_photos');
  }

  /** Refresh tooltip label */
  @computed('isAlbumMode')
  get refreshTooltipLabel() {
    return this.isAlbumMode
        ? ChromeLocale.localize('tooltip_refresh')
        : ChromeLocale.localize('tooltip_refresh_photos');
  }

  /** Mode tooltip label */
  @computed('isAlbumMode')
  get modeTooltipLabel() {
    return this.isAlbumMode
        ? ChromeLocale.localize('tooltip_google_mode_albums')
        : ChromeLocale.localize('tooltip_google_mode_photos');
  }

  /** Mode icon */
  @computed('isAlbumMode')
  get modeIcon() {
    return this.isAlbumMode ? 'myicons:photo-album' : 'myicons:photo';
  }

  /** Disabled state of icons used by albums */
  @computed('useGoogle', 'isAlbumMode')
  get isAlbumIconDisabled() {
    return !(this.useGoogle && this.isAlbumMode);
  }

  @query('#photosView')
  protected photosView: PhotosViewElement;

  @query('#albumsView')
  protected albumsView: AlbumsViewElement;

  @query('#googlePhotosToggle')
  protected googlePhotosToggle: PaperToggleButtonElement;

  /** We are becoming active */
  public async onEnterPage() {
    await super.onEnterPage();

    await this.loadAlbumList();
  }

  /**
   * Fetch Google Photos albums, optionally fetching the photos too
   *
   * @param doPhotos - if true, reload each album
   */
  public async loadAlbumList(doPhotos: boolean = false) {
    try {
      if (this.isAlbumMode) {
        await this.albumsView.loadAlbumList(doPhotos);
      }
    } catch (err) {
      // ignore - handled by albumsView
    }
  }

  /**
   * Handle tap on mode icon
   *
   * @event
   */
  @listen('tap', 'mode')
  public onModeTapped() {
    // show a confirm dialog and pass in a callback that will be called
    // if the user confirms the action
    const text = ChromeLocale.localize('desc_mode_switch');
    const title = ChromeLocale.localize('title_mode_switch');
    const button = ChromeLocale.localize('button_mode_switch');
    Options.showConfirmDialog(text, title, button, this.changeMode.bind(this));
    ChromeGA.event(ChromeGA.EVENT.ICON, 'changeGooglePhotosMode');
  }

  /**
   * Handle tap on refresh album list icon
   *
   * @event
   */
  @listen('tap', 'refresh')
  public onRefreshTapped() {
    if (this.isAlbumMode) {
      this.loadAlbumList().catch(() => {});
    } else {
      this.loadPhotos().catch(() => {});
    }
    const lbl = this.isAlbumMode ? 'refreshGoogleAlbums' : 'refreshGooglePhotos';
    ChromeGA.event(ChromeGA.EVENT.ICON, lbl);
  }

  /**
   * Handle tap on help icon
   *
   * @event
   */
  @listen('tap', 'help')
  public async onHelpTapped() {
    ChromeGA.event(ChromeGA.EVENT.ICON, 'googlePhotosHelp');
    const anchor = this.isAlbumMode ? 'albums' : 'photos';
    const url = `${await MyUtils.getGithubPagesPath()}help/google_photos.html#${anchor}`;
    chrome.tabs.create({url: url});
  }

  /**
   * Handle tap on deselect all albums icon
   *
   * @event
   */
  @listen('tap', 'deselect')
  public onDeselectAllTapped() {
    this.albumsView.removeSelectedAlbums();
    ChromeGA.event(ChromeGA.EVENT.ICON, 'deselectAllGoogleAlbums');
  }

  /**
   * Handle tap on select all albums icon
   *
   * @event
   */
  @listen('tap', 'select')
  public onSelectAllTapped() {
    this.albumsView.selectAllAlbums().catch(() => {});
    ChromeGA.event(ChromeGA.EVENT.ICON, 'selectAllGoogleAlbums');
  }

  /**
   * checked state changed on main toggle changed
   *
   * @event
   */
  @listen('change', 'googlePhotosToggle')
  public onUseGoogleChanged() {
    const useGoogle = this.googlePhotosToggle.checked;
    if (useGoogle) {
      // Switching to enabled, refresh photos from web
      if (this.isAlbumMode) {
        this.loadAlbumList(true).catch(() => {});
      } else {
        this.loadPhotos().catch(() => {});
      }
    }
    ChromeGA.event(ChromeGA.EVENT.TOGGLE, `useGoogle: ${useGoogle}`);
  }

  /**
   * Handle event indicating the user has no albums
   *
   * @event
   */
  @listen('no-albums', 'albumsView')
  public onNoAlbums() {
    // force change to photos mode
    this.changeMode();
  }

  /**
   * UI state
   *
   * @param isAlbumMode - true if album mode
   * @param useGoogle - true if using Google Photos
   */
  @observe('isAlbumMode', 'useGoogle')
  protected uiStateChanged(isAlbumMode: boolean, useGoogle: boolean) {
    if ((isAlbumMode === undefined) || (useGoogle === undefined)) {
      return;
    }
    const useAlbums = (useGoogle && isAlbumMode);
    const usePhotos = (useGoogle && !isAlbumMode);
    this.set('useGoogleAlbums', useAlbums);
    this.set('useGooglePhotos', usePhotos);
  }

  /**
   * Fetch Google Photos for the array of user's photos
   */
  protected async loadPhotos() {
    try {
      if (!this.isAlbumMode && this.useGoogle) {
        await this.photosView.loadPhotos();
      }
    } catch (err) {
      // ignore - handled in photosView
    }
  }

  /**
   * Toggle between album and photo mode
   */
  protected changeMode() {
    this.set('isAlbumMode', !this.isAlbumMode);
    if (this.isAlbumMode) {
      ChromeStorage.asyncSet('googleImages', []).catch(() => {});
      this.loadAlbumList().catch(() => {});
    } else {
      this.albumsView.removeSelectedAlbums();
      this.photosView.setPhotoCount().catch(() => {});
    }
  }

  static get template() {
    // language=HTML format=false
    return html`<style include="shared-styles iron-flex iron-flex-alignment">
  :host {
    display: block;
    position: relative;
  }

  :host .page-toolbar {
    margin: 0;
  }

  :host .page-content {
    margin-bottom: 0;
  }

  :host .body-content {
    min-height: calc(100vh - 128px);
    margin: 0;
  }

</style>

<paper-material elevation="1" class="page-content">

  <!-- Tool bar -->
  <paper-material elevation="1">
    <app-toolbar class="page-toolbar">
      <div class="flex">[[pageTitle]]</div>
      <paper-icon-button
          id="mode"
          icon="[[modeIcon]]"
          disabled$="[[!useGoogle]]"></paper-icon-button>
      <paper-tooltip for="mode" position="left" offset="0">
        [[modeTooltipLabel]]
      </paper-tooltip>
      <paper-icon-button id="select" icon="myicons:check-box""
                         disabled$="[[isAlbumIconDisabled]]"></paper-icon-button>
      <paper-tooltip for="select" position="left" offset="0">
        [[localize('tooltip_select')]]
      </paper-tooltip>
      <paper-icon-button id="deselect" icon="myicons:check-box-outline-blank"
                         disabled$="[[isAlbumIconDisabled]]"></paper-icon-button>
      <paper-tooltip for="deselect" position="left" offset="0">
        [[localize('tooltip_deselect')]]
      </paper-tooltip>
      <paper-icon-button id="refresh" icon="myicons:refresh"
                         disabled$="[[!useGoogle]]"></paper-icon-button>
      <paper-tooltip for="refresh" position="left" offset="0">
        [[refreshTooltipLabel]]
      </paper-tooltip>
      <paper-icon-button id="help" icon="myicons:help"></paper-icon-button>
      <paper-tooltip for="help" position="left" offset="0">
        [[localize('help')]]
      </paper-tooltip>
      <paper-toggle-button id="googlePhotosToggle"
                           checked="{{useGoogle}}"></paper-toggle-button>
      <paper-tooltip for="googlePhotosToggle" position="left" offset="0">
        [[localize('tooltip_google_toggle')]]
      </paper-tooltip>
    </app-toolbar>
  </paper-material>

  <!-- Content -->
  <div class="body-content">

    <!-- Albums UI -->
    <div hidden$="[[!isAlbumMode]]">
      <albums-view id="albumsView" disabled$="[[!useGoogle]]"></albums-view>
    </div>

    <!-- Photos UI -->
    <div hidden$="[[isAlbumMode]]">
      <photos-view id="photosView" disabled$="[[!useGoogle]]"></photos-view>
    </div>

  </div>

  <slot></slot>

</paper-material>

<app-localstorage-document key="isAlbumMode" data="{{isAlbumMode}}" storage="window.localStorage">
</app-localstorage-document>
<app-localstorage-document key="useGoogle" data="{{useGoogle}}" storage="window.localStorage">
</app-localstorage-document>
<app-localstorage-document key="useGoogleAlbums" data="{{useGoogleAlbums}}" storage="window.localStorage">
</app-localstorage-document>
<app-localstorage-document key="useGooglePhotos" data="{{useGooglePhotos}}" storage="window.localStorage">
</app-localstorage-document>

`;
  }
}
