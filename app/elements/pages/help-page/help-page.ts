/**
 * Custom element for a page in an SPA app
 *
 * @module els/pages/help
 */

/** */

/*
 *  Copyright (c) 2015-2019, Michael A. Updike All rights reserved.
 *  Licensed under the BSD-3-Clause
 *  https://opensource.org/licenses/BSD-3-Clause
 *  https://github.com/opus1269/screensaver/blob/master/LICENSE.md
 */

import { customElement, property } from '../../../node_modules/@polymer/decorators/lib/decorators.js';
import { html } from '../../../node_modules/@polymer/polymer/polymer-element.js';

import '../../../node_modules/@polymer/paper-material/paper-material.js';

import '../../../node_modules/@polymer/app-layout/app-toolbar/app-toolbar.js';

import '../../../node_modules/common-custom-elements/src/setting-elements/setting-link/setting-link.js';

import { BasePageElement } from '../base-page/base-page.js';

import * as ChromeGA from '../../../node_modules/chrome-ext-utils/src/analytics.js';
import * as ChromeUtils from '../../../node_modules/chrome-ext-utils/src/utils.js';

import * as MyUtils from '../../../scripts/my_utils.js';

/** Polymer element for the Help page */
@customElement('help-page')
export class HelpPageElement extends BasePageElement {
  constructor() {
    super();
    MyUtils.getGithubPagesPath().then((path) => {
      this.set('githubPagesPath', path);
    })
  }

  /** Path to our Github repo */
  @property({ type: String })
  protected readonly githubPath = MyUtils.getGithubPath();

  /** Path to our Web Site */
  @property({ type: String })
  protected readonly githubPagesPath: string;

  /** Extension version */
  @property({ type: String })
  protected readonly version = encodeURIComponent(ChromeUtils.getVersion());

  /** Are we ChromeOS */
  @property({ type: Boolean })
  protected isChromeOS = false;

  /**
   * Called during Polymer-specific element initialization.
   * Called once, the first time the element is attached to the document.
   */
  public ready() {
    super.ready();

    setTimeout(async () => {
      try {
        // initialize OS
        // see: https://bugs.chromium.org/p/chromium/issues/detail?id=934022
        const isChromeOS = await ChromeUtils.isChromeOS();
        this.set('isChromeOS', isChromeOS);
      } catch (err) {
        ChromeGA.error(err.message, 'HelpPage.ready');
      }
    }, 0);
  }

  // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
  /**
   * Computed binding: Get a mailto url
   *
   * @param subject - email subject
   * @returns mailTo url
   */
  protected async computeMailToUrl(subject: string) {
    return MyUtils.getEmailUrl(subject, await MyUtils.getEmailBody());
  }

  static get template() {
    // language=HTML format=false
    return html`<style include="shared-styles iron-flex iron-flex-alignment">

  :host {
    display: block;
    position: relative;
  }

  :host hr {
    margin-left: 0;
    margin-right: 0;
  }

</style>

<paper-material elevation="1" class="page-content">

  <!-- Tool bar -->
  <paper-material elevation="1">
    <app-toolbar class="page-toolbar">
      <div>[[localize('help_title')]]</div>
    </app-toolbar>
  </paper-material>

  <!-- Content -->
  <div class="body-content">
    <setting-link section-title="[[localize('help_section_feedback')]]" name="questionMail"
                  label="[[localize('help_question')]]" icon="myicons:mail"
                  url="[[computeMailToUrl('Question')]]" disabled$="[[isChromeOS]]"></setting-link>
    <setting-link label="[[localize('help_bug')]]" name="bugMail" icon="myicons:mail"
                  url="[[computeMailToUrl('Bug report')]]" disabled$="[[isChromeOS]]"></setting-link>
    <setting-link label="[[localize('help_feature')]]" name="featureMail" icon="myicons:mail"
                  url="[[computeMailToUrl('Feature request')]]" disabled$="[[isChromeOS]]"></setting-link>
    <setting-link label="[[localize('help_feedback')]]" name="feedbackMail" icon="myicons:mail"
                  url="[[computeMailToUrl('General feedback')]]" disabled$="[[isChromeOS]]"></setting-link>
    <setting-link label="[[localize('help_issue')]]" name="submitGitHubIssue" noseparator="" icon="myicons:github"
                  url="[[githubPath]]issues/new"></setting-link>
    <hr>
    <setting-link section-title="[[localize('help')]]" name="documentation"
                  label="[[localize('help_documentation')]]" icon="myicons:info"
                  url="[[githubPagesPath]]documentation.html"></setting-link>
    <setting-link label="[[localize('help_faq')]]" name="faq" icon="myicons:help"
                  url="[[githubPagesPath]]faq.html"></setting-link>
    <setting-link label="[[localize('help_translations')]]" name="translations"
                  icon="myicons:info" url="[[githubPagesPath]]translate.html"></setting-link>
    <setting-link label="[[localize('help_release_notes')]]" name="releaseNotes" icon="myicons:github"
                  url="[[githubPath]]releases/tag/v[[version]]"></setting-link>
    <setting-link label="[[localize('help_contributors')]]" name="contributors" icon="myicons:github"
                  url="[[githubPath]]blob/master/CONTRIBUTORS.md"></setting-link>
    <setting-link label="[[localize('help_licenses')]]" name="licenses" icon="myicons:github"
                  url="[[githubPath]]blob/master/LICENSES.md"></setting-link>
    <setting-link label="[[localize('help_source_code')]]" name="sourceCode" noseparator=""
                  icon="myicons:github" url="[[githubPath]]"></setting-link>
  </div>
</paper-material>
`;
  }
}
