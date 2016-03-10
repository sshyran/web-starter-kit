/*
  Copyright 2016 Google Inc. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

'use strict';

/* eslint-disable max-len, no-console, padded-blocks, no-multiple-empty-lines */
/* eslint-env node,mocha */

// These tests make use of selenium-webdriver. You can find the relevant
// documentation here: http://selenium.googlecode.com/git/docs/api/javascript/index.html

require('chai').should();
const webdriver = require('selenium-webdriver');
const chromeOptions = require('selenium-webdriver/chrome');
const firefoxOptions = require('selenium-webdriver/firefox');
const which = require('which');
const del = require('del');
const testServerHelper = require('./server/server');


// Before the tests start, we must build the current files
GLOBAL.config = {
  env: 'prod',
  src: 'test/data/valid-files',
  dest: 'test/output'
};

describe('Test WSK in browser', function() {
  this.timeout(60000);

  // Skip if we are APPVEYOR since we have travis to automate these tests
  if (process.env.APPVEYOR) {
    console.log('Skipping WSK browser tests on AppVeyor.');
    return;
  }

  // Driver is initialised to null to handle scenarios
  // where the desired browser isn't installed / fails to load
  // Null allows afterEach a safe way to skip quiting the driver
  let globalDriverReference = null;
  let testServer;

  before(function(done) {
    // 0 for port will pick a random port number
    testServerHelper.startServer(0, function(portNumber) {
      testServer = `http://localhost:${portNumber}`;
      done();
    });
  });

  after(function() {
    testServerHelper.killServer();
  });

  afterEach(function(done) {
    this.timeout(10000);

    // Suggested as fix to 'chrome not reachable'
    // http://stackoverflow.com/questions/23014220/webdriver-randomly-produces-chrome-not-reachable-on-linux-tests
    const timeoutGapCb = function() {
      setTimeout(done, 2000);
    };

    if (globalDriverReference === null) {
      return timeoutGapCb();
    }

    globalDriverReference.quit()
    .then(() => {
      globalDriverReference = null;
      timeoutGapCb();
    })
    .thenCatch(() => {
      globalDriverReference = null;
      timeoutGapCb();
    });
  });

  const performTests = (browserName, driver) => {
    // The driver methods are wrapped in a new promise because the
    // selenium-webdriver API seems to using some custom promise
    // implementation that has slight behaviour differences.
    return new Promise((resolve, reject) => {
      driver.get(`${testServer}/test/browser-tests/`)
      .then(() => {
        return driver.executeScript('return window.navigator.userAgent;');
      })
      .then(userAgent => {
        // This is just to help with debugging so we can get the browser version
        console.log('        [' + browserName + ' UA]: ' + userAgent);
      })
      .then(() => {
        // We get webdriver to wait until window.testsuite.testResults is defined.
        // This is set in the in browser mocha tests when the tests have finished
        // successfully
        return driver.wait(function() {
          return driver.executeScript('return ((typeof window.testsuite !== \'undefined\') && window.testsuite.testResults !== \'undefined\');');
        });
      })
      .then(() => {
        // This simply retrieves the test results from the inbrowser mocha tests
        return driver.executeScript('return window.testsuite.testResults;');
      })
      .then(testResults => {
        // Resolve the outer promise to get out of the webdriver promise chain
        resolve(testResults);
      })
      .thenCatch(reject);
    })
    .then(testResults => {
      if (testResults.failed.length > 0) {
        const failedTests = testResults.failed;
        let errorMessage = 'Issues in ' + browserName + '.\n\n' + browserName + ' had ' + testResults.failed.length + ' test failures.\n';
        errorMessage += '------------------------------------------------\n';
        errorMessage += failedTests.map((failedTest, i) => {
          return `[Failed Test ${i + 1}]\n    ${failedTest.title}\n`;
        }).join('\n');
        errorMessage += '------------------------------------------------\n';
        throw new Error(errorMessage);
      }
    });
  };

  const queueUnitTest = (browserName, browserPath, seleniumBrowserID, options) => {
    if (!browserPath) {
      console.warn(`${browserName} path wasn\'t found so skipping`);
      return;
    }

    it(`should pass all tests in ${browserName}`, () => {
      globalDriverReference = new webdriver
        .Builder()
        .forBrowser(seleniumBrowserID)
        .setChromeOptions(options)
        .setFirefoxOptions(options)
        .build();

      return performTests(browserName, globalDriverReference);
    });
  };

  function configureBrowserTests() {
    // Chrome Stable
    const CHROME_PATH = which.sync('google-chrome');
    const chromeStableOpts = new chromeOptions.Options();
    chromeStableOpts.setChromeBinaryPath(CHROME_PATH);
    queueUnitTest('Chrome Stable', CHROME_PATH, 'chrome', chromeStableOpts);

    // Chrome Beta
    const CHROME_BETA_PATH = which.sync('google-chrome-beta');
    const chromeBetaOpts = new chromeOptions.Options();
    chromeBetaOpts.setChromeBinaryPath(CHROME_BETA_PATH);
    queueUnitTest('Chrome Beta', CHROME_BETA_PATH, 'chrome', chromeBetaOpts);

    // Firefox Default Install
    const FIREFOX_PATH = which.sync('firefox');
    const ffStableOpts = new firefoxOptions.Options();
    ffStableOpts.setBinary(FIREFOX_PATH);
    queueUnitTest('Firefox Stable', FIREFOX_PATH, 'firefox', ffStableOpts);


    // Firefox Beta in specific path on Travis
    if (process.env.TRAVIS) {
      const FIREFOX_BETA_PATH_FOR_TRAVIS = './firefox/firefox';
      const ffBetaOpts = new firefoxOptions.Options();
      ffBetaOpts.setBinary(FIREFOX_BETA_PATH_FOR_TRAVIS);
      queueUnitTest('Firefox Beta', FIREFOX_BETA_PATH_FOR_TRAVIS, 'firefox', ffStableOpts);
    }
  }

  function buildTestData() {
    this.timeout(60000);

    const taskHelper = require('../src/wsk-tasks/task-helper');
    const promises = taskHelper.getTasks().map(taskObject => {
      var task = require(taskObject.path);
      if (task.build) {
        return new Promise(resolve => {
          const result = task.build();
          if (result instanceof Promise) {
            result.then(() => resolve());
          } else {
            result.on('end', () => {
              resolve();
            });
          }
        });
      }

      return Promise.resolve();
    });
    return Promise.all(promises);
  }

  function clearTestDataBuild(done) {
    del(GLOBAL.config.dest + '/**').then(() => done(), done);
  }

  describe('Test Dev Environment', function() {
    GLOBAL.config.env = 'dev';

    before(buildTestData);
    after(clearTestDataBuild);

    configureBrowserTests();
  });

  describe('Test Prod Environment', function() {
    GLOBAL.config.env = 'prod';

    before(buildTestData);
    after(clearTestDataBuild);

    configureBrowserTests();
  });

});
