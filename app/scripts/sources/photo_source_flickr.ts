/**
 * A source of photos from Flickr
 * {@link https://www.flickr.com/services/api/}
 *
 * @module scripts/sources/photo_source_flickr
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import * as ChromeHttp from '../../node_modules/chrome-ext-utils/src/http.js';
import * as ChromeLocale from '../../node_modules/chrome-ext-utils/src/locales.js';

import {IPhoto, PhotoSource} from './photo_source.js';

import * as PhotoSourceFactory from '../../scripts/sources/photo_source_factory.js';

/** Flickr rest API */
const URL_BASE = 'https://api.flickr.com/services/rest/';

/** Flickr rest API authorization key */
const KEY = 'KEY_FLICKR';

/** Max photos to return */
const MAX_PHOTOS = 250;

/** A source of photos from Flickr */
export class FlickrSource extends PhotoSource {

  /**
   * Extract the photos into an Array
   *
   * @param response - server response
   * @throws An error if we failed to process photos
   * @returns Array of {@link IPhoto}
   */
  private static processPhotos(response: any) {
    if (!response.photos || !response.photos.photo) {
      throw new Error(ChromeLocale.localize('err_photo_source_title'));
    }

    const photos: IPhoto[] = [];

    for (const photo of response.photos.photo) {
      let url = null;
      let width;
      let height;
      if (photo && (photo.media === 'photo') && (photo.isfriend !== '0') &&
          (photo.isfamily !== '0')) {
        url = photo.url_k || url;
        url = photo.url_o || url;
        if (url) {
          if (photo.url_o) {
            width = parseInt(photo.width_o, 10);
            height = parseInt(photo.height_o, 10);
          } else {
            width = parseInt(photo.width_k, 10);
            height = parseInt(photo.height_k, 10);
          }
          const asp = width / height;
          let pt = '';
          if (photo.latitude && photo.longitude) {
            pt = PhotoSource.createPoint(photo.latitude, photo.longitude);
          }
          PhotoSource.addPhoto(photos, url,
              photo.ownername, asp, photo.owner, pt);
        }
      }
    }
    return photos;
  }

  public constructor(useKey: PhotoSourceFactory.UseKey, photosKey: string, type: PhotoSourceFactory.Type,
                     desc: string, isLimited: boolean, isDaily: boolean, isArray: boolean, loadArg?: any) {
    super(useKey, photosKey, type, desc, isLimited, isDaily, isArray, loadArg);
  }

  /**
   * Fetch the photos for this source
   *
   * @throws An error if fetch failed
   * @returns Array of {@link IPhoto}
   */
  public async fetchPhotos() {
    let url;
    if (this.getLoadArg()) {
      // my photos
      const userId = '86149994@N06';
      url =
          `${URL_BASE}?method=flickr.people.getPublicPhotos` +
          `&api_key=${KEY}&user_id=${userId}` +
          `&extras=owner_name,url_o,media,geo&per_page=${MAX_PHOTOS}` +
          '&format=json&nojsoncallback=1';
    } else {
      // public photos
      url =
          `${URL_BASE}?method=flickr.interestingness.getList` +
          `&api_key=${KEY}&extras=owner_name,url_k,media,geo` +
          `&per_page=${MAX_PHOTOS}` +
          '&format=json&nojsoncallback=1';
    }

    const response = await ChromeHttp.doGet(url);
    if (response.stat !== 'ok') {
      throw new Error(response.message);
    }

    // convert to our format
    return FlickrSource.processPhotos(response);
  }
}
