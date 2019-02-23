/**
 * @license
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/**
 * @fileoverview The entry point for rendering the Lighthouse report based on the JSON output.
 *    This file is injected into the report HTML along with the JSON report.
 *
 * Dummy text for ensuring report robustness: </script> pre$`post %%LIGHTHOUSE_JSON%%
 */

/** @typedef {import('./dom.js')} DOM */

/* globals self, Util, DetailsRenderer, CategoryRenderer, PerformanceCategoryRenderer, PwaCategoryRenderer */

class ReportRenderer {
  /**
   * @param {DOM} dom
   */
  constructor(dom) {
    /** @type {DOM} */
    this._dom = dom;
    /** @type {ParentNode} */
    this._templateContext = this._dom.document();
  }

  /**
   * @param {LH.Result | LH.Result[]} results
   * @param {Element} container Parent element to render the report into.
   * @return {Element}
   */
  render(results, container) {
    if (Array.isArray(results)) {
      return this.renderReportDiff(results, container);
    } else {
      return this.renderReport(results, container);
    }
  }

  /**
   * @param {LH.Result} results
   * @param {Element} container Parent element to render the report into.
   * @return {Element}
   */
  renderReport(results, container) {
    // Mutate the UIStrings if necessary (while saving originals)
    const originalUIStrings = JSON.parse(JSON.stringify(Util.UIStrings));

    const report = Util.prepareReportResult(results);

    container.textContent = ''; // Remove previous report.
    container.appendChild(this._renderReport(report));

    // put the UIStrings back into original state
    Util.updateAllUIStrings(originalUIStrings);

    return container;
  }

  /**
   * @param {LH.Result[]} results
   * @param {Element} container Parent element to render the report into.
   * @return {Element}
   */
  renderReportDiff(results, container) {
    // Mutate the UIStrings if necessary (while saving originals)
    const originalUIStrings = JSON.parse(JSON.stringify(Util.UIStrings));

    const reports = results.map(Util.prepareReportResult);

    container.textContent = ''; // Remove previous report.
    container.appendChild(this._renderReportDiff(reports));

    // put the UIStrings back into original state
    Util.updateAllUIStrings(originalUIStrings);

    return container;
  }

  /**
   * Define a custom element for <templates> to be extracted from. For example:
   *     this.setTemplateContext(new DOMParser().parseFromString(htmlStr, 'text/html'))
   * @param {ParentNode} context
   */
  setTemplateContext(context) {
    this._templateContext = context;
  }

  /**
   * @param {LH.ReportResult} report
   * @return {DocumentFragment}
   */
  _renderReportHeader(report) {
    const el = this._dom.cloneTemplate('#tmpl-lh-heading', this._templateContext);
    const domFragment = this._dom.cloneTemplate('#tmpl-lh-scores-wrapper', this._templateContext);
    const placeholder = this._dom.find('.lh-scores-wrapper-placeholder', el);
    /** @type {HTMLDivElement} */ (placeholder.parentNode).replaceChild(domFragment, placeholder);

    this._dom.find('.lh-config__timestamp', el).textContent =
        Util.formatDateTime(report.fetchTime);
    this._dom.find('.lh-product-info__version', el).textContent = report.lighthouseVersion;
    const metadataUrl = /** @type {HTMLAnchorElement} */ (this._dom.find('.lh-metadata__url', el));
    const toolbarUrl = /** @type {HTMLAnchorElement}*/ (this._dom.find('.lh-toolbar__url', el));
    metadataUrl.href = metadataUrl.textContent = report.finalUrl;
    toolbarUrl.href = toolbarUrl.textContent = report.finalUrl;

    const emulationDescriptions = Util.getEmulationDescriptions(report.configSettings || {});
    this._dom.find('.lh-config__emulation', el).textContent = emulationDescriptions.summary;
    return el;
  }

  /**
   * @param {LH.ReportResult[]} reports[]
   * @return {DocumentFragment}
   */
  _renderDiffReportHeader(reports) {
    const el = this._dom.cloneTemplate('#tmpl-lh-heading', this._templateContext);
    const domFragment = this._dom.cloneTemplate('#tmpl-lh-scores-wrapper', this._templateContext);
    const placeholder = this._dom.find('.lh-scores-wrapper-placeholder', el);
    /** @type {HTMLDivElement} */ (placeholder.parentNode).replaceChild(domFragment, placeholder);
    
    const minFetchTime = Math.min(...reports.map(report => new Date(report.fetchTime).getTime()));
    const maxFetchTime = Math.max(...reports.map(report => new Date(report.fetchTime).getTime()));
    const minFetchTimeFormatted = Util.formatDateTime(new Date(minFetchTime).toDateString());
    const maxFetchTimeFormatted = Util.formatDateTime(new Date(maxFetchTime).toDateString());
    this._dom.find('.lh-config__timestamp', el).textContent =
      `${minFetchTimeFormatted} - ${maxFetchTimeFormatted}`;
    
    // punt
    this._dom.find('.lh-product-info__version', el).textContent = reports[0].lighthouseVersion;

    this._dom.createChildOf(this._dom.find('.lh-metadata__results', el), 'div').textContent =
      'Diff of Multiple Lighthouse Reports';
    
    this._dom.find('.lh-metadata__url', el).remove();
    this._dom.find('.lh-toolbar__url', el).remove();
    this._dom.find('.lh-config__emulation', el).remove();
    
    return el;
  }

  /**
   * @return {Element}
   */
  _renderReportShortHeader() {
    const shortHeaderContainer = this._dom.createElement('div', 'lh-header-container');
    const wrapper = this._dom.cloneTemplate('#tmpl-lh-scores-wrapper', this._templateContext);
    shortHeaderContainer.appendChild(wrapper);
    return shortHeaderContainer;
  }


  /**
   * @param {LH.ReportResult} report
   * @return {DocumentFragment}
   */
  _renderReportFooter(report) {
    const footer = this._dom.cloneTemplate('#tmpl-lh-footer', this._templateContext);

    const env = this._dom.find('.lh-env__items', footer);
    env.id = 'runtime-settings';
    const envValues = Util.getEnvironmentDisplayValues(report.configSettings || {});
    [
      {name: 'URL', description: report.finalUrl},
      {name: 'Fetch time', description: Util.formatDateTime(report.fetchTime)},
      ...envValues,
      {name: 'User agent (host)', description: report.userAgent},
      {name: 'User agent (network)', description: report.environment &&
        report.environment.networkUserAgent},
      {name: 'CPU/Memory Power', description: report.environment &&
        report.environment.benchmarkIndex.toFixed(0)},
    ].forEach(runtime => {
      if (!runtime.description) return;

      const item = this._dom.cloneTemplate('#tmpl-lh-env__items', env);
      this._dom.find('.lh-env__name', item).textContent = `${runtime.name}:`;
      this._dom.find('.lh-env__description', item).textContent = runtime.description;
      env.appendChild(item);
    });

    this._dom.find('.lh-footer__version', footer).textContent = report.lighthouseVersion;
    return footer;
  }

  /**
   * Returns a div with a list of top-level warnings, or an empty div if no warnings.
   * @param {LH.ReportResult} report
   * @return {Node}
   */
  _renderReportWarnings(report) {
    if (!report.runWarnings || report.runWarnings.length === 0) {
      return this._dom.createElement('div');
    }

    const container = this._dom.cloneTemplate('#tmpl-lh-warnings--toplevel', this._templateContext);
    const message = this._dom.find('.lh-warnings__msg', container);
    message.textContent = Util.UIStrings.toplevelWarningsMessage;

    const warnings = this._dom.find('ul', container);
    for (const warningString of report.runWarnings) {
      const warning = warnings.appendChild(this._dom.createElement('li'));
      warning.textContent = warningString;
    }

    return container;
  }

  /**
   * @param {LH.ReportResult[]} reports
   * @return {DocumentFragment}
   */
  _renderReportDiff(reports) {
    const baseReport = reports[0];

    // some pre-conditions. Remove as tests are added to cover these cases.
    if (reports.length < 2) throw new Error();

    for (const report of reports) {
      if (report.reportCategories.length != baseReport.reportCategories.length) {
        throw new Error();
      }
    }

    let header;
    const headerContainer = this._dom.createElement('div');
    if (this._dom.isDevTools()) {
      headerContainer.classList.add('lh-header-plain');
      header = this._renderReportShortHeader();
    } else if (reports.length === 1) {
      headerContainer.classList.add('lh-header-sticky');
      header = this._renderReportHeader(baseReport);
    } else {
      header = this._renderDiffReportHeader(reports);
    }
    headerContainer.appendChild(header);

    const container = this._dom.createElement('div', 'lh-container');
    const reportSection = container.appendChild(this._dom.createElement('div', 'lh-report'));

    for (const report of reports) {
      reportSection.appendChild(this._renderReportWarnings(report));
    }

    const detailsRenderer = new DetailsRenderer(this._dom);
    const categoryRenderer = new CategoryRenderer(this._dom, detailsRenderer);
    categoryRenderer.setTemplateContext(this._templateContext);

    /** @type {Record<string, CategoryRenderer>} */
    const specificCategoryRenderers = {
      performance: new PerformanceCategoryRenderer(this._dom, detailsRenderer),
      pwa: new PwaCategoryRenderer(this._dom, detailsRenderer),
    };
    Object.values(specificCategoryRenderers).forEach(renderer => {
      renderer.setTemplateContext(this._templateContext);
    });

    const categories = reportSection.appendChild(this._dom.createElement('div', 'lh-categories'));

    for (const category of baseReport.reportCategories) {
      const renderer = specificCategoryRenderers[category.id] || categoryRenderer;
      categories.appendChild(renderer.renderDiff(
        // @ts-ignore
        reports.map(r => r.reportCategories.find(rc => rc.id === category.id)),
        reports.map(r => r.categoryGroups)
      ));
    }

    // Fireworks
    // const scoresAll100 = report.reportCategories.every(cat => cat.score === 1);
    // if (!this._dom.isDevTools() && scoresAll100) {
    //   headerContainer.classList.add('score100');
    //   this._dom.find('.lh-header', headerContainer).addEventListener('click', _ => {
    //     headerContainer.classList.toggle('fireworks-paused');
    //   });
    // }

    const isSoloCategory = baseReport.reportCategories.length === 1;
    if (isSoloCategory) {
      headerContainer.classList.add('lh-header--solo-category');
    } else {
      const scoresContainer = this._dom.find('.lh-scores-container', headerContainer);

      for (const report of reports) {
        const scoreHeader = this._dom.createElement('div', 'lh-scores-header');
        const letterNode = categoryRenderer._createLetterNode(reports.indexOf(report));
        letterNode.textContent += ' ' + report.requestedUrl;
        scoreHeader.appendChild(letterNode);

        const defaultGauges = [];
        const customGauges = [];

        for (const category of report.reportCategories) {
          const renderer = specificCategoryRenderers[category.id] || categoryRenderer;
          const categoryGauge = renderer.renderScoreGauge(category, report.categoryGroups || {});

          // Group gauges that aren't default at the end of the header
          if (renderer.renderScoreGauge === categoryRenderer.renderScoreGauge) {
            defaultGauges.push(categoryGauge);
          } else {
            customGauges.push(categoryGauge);
          }
        }

        scoreHeader.append(...defaultGauges, ...customGauges);
        scoresContainer.append(scoreHeader);
      }

      const scoreScale = this._dom.cloneTemplate('#tmpl-lh-scorescale', this._templateContext);
      this._dom.find('.lh-scorescale-label', scoreScale).textContent =
        Util.UIStrings.scorescaleLabel;
      scoresContainer.appendChild(scoreScale);
    }

    reportSection.appendChild(this._renderReportFooter(baseReport));

    const reportFragment = this._dom.createFragment();
    reportFragment.appendChild(headerContainer);
    reportFragment.appendChild(container);

    return reportFragment;
  }

  /**
   * @param {LH.ReportResult} report
   * @return {DocumentFragment}
   */
  _renderReport(report) {
    let header;
    const headerContainer = this._dom.createElement('div');
    if (this._dom.isDevTools()) {
      headerContainer.classList.add('lh-header-plain');
      header = this._renderReportShortHeader();
    } else {
      headerContainer.classList.add('lh-header-sticky');
      header = this._renderReportHeader(report);
    }
    headerContainer.appendChild(header);

    const container = this._dom.createElement('div', 'lh-container');
    const reportSection = container.appendChild(this._dom.createElement('div', 'lh-report'));

    reportSection.appendChild(this._renderReportWarnings(report));

    let scoreHeader;
    const isSoloCategory = report.reportCategories.length === 1;
    if (!isSoloCategory) {
      scoreHeader = this._dom.createElement('div', 'lh-scores-header');
    } else {
      headerContainer.classList.add('lh-header--solo-category');
    }

    const detailsRenderer = new DetailsRenderer(this._dom);
    const categoryRenderer = new CategoryRenderer(this._dom, detailsRenderer);
    categoryRenderer.setTemplateContext(this._templateContext);

    /** @type {Record<string, CategoryRenderer>} */
    const specificCategoryRenderers = {
      performance: new PerformanceCategoryRenderer(this._dom, detailsRenderer),
      pwa: new PwaCategoryRenderer(this._dom, detailsRenderer),
    };
    Object.values(specificCategoryRenderers).forEach(renderer => {
      renderer.setTemplateContext(this._templateContext);
    });

    const categories = reportSection.appendChild(this._dom.createElement('div', 'lh-categories'));

    for (const category of report.reportCategories) {
      const renderer = specificCategoryRenderers[category.id] || categoryRenderer;
      categories.appendChild(renderer.render(category, report.categoryGroups));
    }

    // Fireworks
    const scoresAll100 = report.reportCategories.every(cat => cat.score === 1);
    if (!this._dom.isDevTools() && scoresAll100) {
      headerContainer.classList.add('score100');
      this._dom.find('.lh-header', headerContainer).addEventListener('click', _ => {
        headerContainer.classList.toggle('fireworks-paused');
      });
    }

    if (scoreHeader) {
      const defaultGauges = [];
      const customGauges = [];
      for (const category of report.reportCategories) {
        const renderer = specificCategoryRenderers[category.id] || categoryRenderer;
        const categoryGauge = renderer.renderScoreGauge(category, report.categoryGroups || {});

        // Group gauges that aren't default at the end of the header
        if (renderer.renderScoreGauge === categoryRenderer.renderScoreGauge) {
          defaultGauges.push(categoryGauge);
        } else {
          customGauges.push(categoryGauge);
        }
      }
      scoreHeader.append(...defaultGauges, ...customGauges);

      const scoreScale = this._dom.cloneTemplate('#tmpl-lh-scorescale', this._templateContext);
      this._dom.find('.lh-scorescale-label', scoreScale).textContent =
        Util.UIStrings.scorescaleLabel;
      const scoresContainer = this._dom.find('.lh-scores-container', headerContainer);
      scoresContainer.appendChild(scoreHeader);
      scoresContainer.appendChild(scoreScale);
    }

    reportSection.appendChild(this._renderReportFooter(report));

    const reportFragment = this._dom.createFragment();
    reportFragment.appendChild(headerContainer);
    reportFragment.appendChild(container);

    return reportFragment;
  }
}

/** @type {LH.I18NRendererStrings} */
ReportRenderer._UIStringsStash = {};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportRenderer;
} else {
  self.ReportRenderer = ReportRenderer;
}
