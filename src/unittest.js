// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview A test harness loosely based on Python unittest, but that
 * installs global assert methods during the test for backward compatibility
 * with Closure tests.
 */
base.define('unittest', function() {
  function _ensureStylesheetInDocument(doc) {
    if (document.querySelector('style[unittest-stylesheet]'))
      return;
    var style = doc.createElement('style');
    style.setAttribute('unittest-stylesheet', true);

    var css = ['.unittest {',
               '  font: normal 100% monospace;',
               '}',
               '.unittest-green {',
               '  color: darkgreen;',
               '}',
               '',
               '.unittest-yellow {',
               '  color: orange;',
               '}',
               '',
               '.unittest-red {',
               '  color: darkRed;',
               '}',
               '',
               '.unittest-error {',
               '  margin-left: 20px;',
               '  font-size: 90%',
               '}',
               '',
               '.unittest-error-stack {',
               '  padding-bottom: 8px;',
               '  white-space: pre-wrap;',
               '}',
               '']
    style.textContent = css.join('\n');
    doc.head.appendChild(style);
  }

  function createTestCaseDiv(testName) {
    _ensureStylesheetInDocument(document);
    var el = document.createElement('div');

    var titleEl = document.createElement('div');
    el.appendChild(titleEl);

    el.__defineSetter__('status', function(status) {
      titleEl.textContent = testName + ': ' + status;
      titleEl.className = statusToClassName(status);
    });
    el.status = 'READY';
    return el;
  }

  function createErrorDiv(test, e) {
    _ensureStylesheetInDocument(document);
    var el = document.createElement('div');
    el.className = 'unittest-error';

    var stackEl = document.createElement('div');
    stackEl.className = 'unittest-error-stack';
    stackEl.textContent = e.stack;

    el.appendChild(stackEl);
    return el;
  }

  function statusToClassName(status) {
    if (status == 'PASSED')
      return 'unittest-green';
    else if (status == 'RUNNING' || status == 'READY')
      return 'unittest-yellow';
    else
      return 'unittest-red';
  }

  function HTMLTestRunner(opt_title) {
    // This constructs a HTMLDivElement and then adds our own runner methods to
    // it. This is usually done via ui.js' define system, but we dont want our
    // test runner to be dependent on the UI lib. :)
    var outputEl = document.createElement('div');
    outputEl.__proto__ = HTMLTestRunner.prototype;
    this.decorate.call(outputEl, opt_title);
    return outputEl;
  }

  HTMLTestRunner.prototype = {
    __proto__: HTMLDivElement.prototype,

    decorate: function(opt_title) {
      _ensureStylesheetInDocument(document);
      this.running = false;
      this.className = 'unittest-runner';

      this.currentTest_ = undefined;
      this.results = undefined;

      this.statusEl_ = document.createElement('div');
      this.appendChild(this.statusEl_);

      this.resultsEl_ = document.createElement('div');
      this.resultsEl_.style = 'unittest-results';
      this.appendChild(this.resultsEl_);

      this.title = opt_title || document.title;

      this.updateStatus();
    },

    computeResultStats: function() {
      var numTestsRun = 0;
      var numTestsPassed = 0;
      var numTestsWithErrors = 0;
      if (this.results) {
        for (var i = 0; i < this.results.length; i++) {
          numTestsRun++;
          if (this.results[i].errors.length)
            numTestsWithErrors++;
          else
            numTestsPassed++;
        }
      }
      return {
        numTestsRun: numTestsRun,
        numTestsPassed: numTestsPassed,
        numTestsWithErrors: numTestsWithErrors
      };
    },

    updateStatus: function() {
      var stats = this.computeResultStats();
      this.className = 'unittest';

      var status;
      if (!this.results) {
        status = 'READY';
      } else if (this.running) {
        status = 'RUNNING';
      } else {
        if (stats.numTestsWithErrors == 0)
          status = 'PASSED';
        else
          status = 'FAILED';
      }

      this.statusEl_.className = statusToClassName(status);
      this.statusEl_.textContent = this.title + ' [' + status + ']';
    },

    get done() {
      return this.results && this.running == false;
    },

    run: function(tests) {
      this.results = [];
      this.running = true;
      this.updateStatus();
      for (var i = 0; i < tests.length; i++) {
        tests[i].run(this);
        this.updateStatus();
      }
      this.running = false;
      this.updateStatus();
    },

    willRunTest: function(test) {
      this.currentTest_ = test;
      this.currentResults_ = {testName: test.testName,
                              errors: []};
      this.results.push(this.currentResults_);

      this.currentTestCaseEl_ = createTestCaseDiv(test.testName);
      this.currentTestCaseEl_.status = 'RUNNING';
      this.resultsEl_.appendChild(this.currentTestCaseEl_);
    },

    addError: function(e) {
      this.currentResults_.errors.push(e);
      this.currentTestCaseEl_.appendChild(createErrorDiv(this.currentTest_, e));
    },

    didRunTest: function(test) {
      if (!this.currentResults_.errors.length)
        this.currentTestCaseEl_.status = 'PASSED';
      else
        this.currentTestCaseEl_.status = 'FAILED';

      this.currentResults_ = undefined;
      this.currentTest_ = undefined;
    },
  };

  function TestError(opt_message) {
    Error.captureStackTrace(this, TestError);
    Error.call(this, opt_message);
  }

  TestError.prototype = {
    __proto__: Error.prototype
  };

  /*
   * @constructor TestCase
   */
  function TestCase(testMethod, opt_testMethodName) {
    if (!testMethod)
      throw new Error('testMethod must be provided');
    if (testMethod.name == ""  && !opt_testMethodName)
      throw new Error('testMethod must have a name, or opt_testMethodName must be provided.');

    this.testMethod_ = testMethod;
    this.testMethodName_ = opt_testMethodName || testMethod.name;
  };

  function forAllAssertAndEnsureMethodsIn_(prototype, fn) {
    for (var fieldName in prototype) {
      if (fieldName.indexOf('assert') != 0 &&
          fieldName.indexOf('ensure') != 0)
        continue;
      var fieldValue = prototype[fieldName];
      if (typeof fieldValue != 'function')
        continue;
      fn(fieldName,fieldValue);
    }
  }

  TestCase.prototype = {
    __proto__: Object.prototype,

    get testName() {
      return this.testMethodName_;
    },

    bindGlobals_: function() {
      forAllAssertAndEnsureMethodsIn_(TestCase.prototype, function(fieldName, fieldValue) {
        window[fieldName] = fieldValue.bind(this);
      });
    },

    unbindGlobals_: function() {
      forAllAssertAndEnsureMethodsIn_(TestCase.prototype, function(fieldName, fieldValue) {
        delete window[fieldName];
      });
    },

    assertTrue: function(a, opt_message) {
      if (a)
        return;
      var message = opt_message || 'Expected true, got ' + a;
      throw new TestError(message);
    },

    assertFalse: function(a, opt_message) {
      if (!a)
        return;
      var message = opt_message || 'Expected false, got ' + a;
      throw new TestError(message);
    },

    assertUndefined: function(a, opt_message) {
      if (a === undefined)
        return;
      var message = opt_message || 'Expected undefined, got ' + a;
      throw new TestError(message);
    },

    assertNotUndefined: function(a, opt_message) {
      if (a !== undefined)
        return;
      var message = opt_message || 'Expected not undefined, got ' + a;
      throw new TestError(message);
    },

    assertNull: function(a, opt_message) {
      if (a === null)
        return;
      var message = opt_message || 'Expected null, got ' + a;
      throw new TestError(message);
    },

    assertNotNull: function(a, opt_message) {
      if (a !== null)
        return;
      var message = opt_message || 'Expected non-null, got ' + a;
      throw new TestError(message);
    },

    assertEquals: function(a, b, opt_message) {
      if (a == b)
        return;
      var message = opt_message || 'Expected ' + b + ', got ' + a;
      throw new TestError(message);
    },

    assertNotEquals: function(a, b, opt_message) {
      if (a != b)
        return;
      var message = opt_message || 'Expected something not equal to ' + b;;
      throw new TestError(message);
    },

    assertArrayEquals: function(a, b, opt_message) {
      if (a.length == b.length) {
        var ok = true;
        for (var i = 0; i < a.length; i++) {
          ok &= a[i] === b[i];
        }
        if (ok)
          return;
      }

      var message = opt_message || 'Expected array ' + b + ', got array ' + a;
      throw new TestError(message);
    },

    assertAlmostEquals: function(a, b, opt_message) {
      if (Math.abs(a - b) < 0.00001)
        return;
      var message = opt_message || 'Expected almost ' + b + ', got ' + a;
      throw new TestError(message);
    },

    setUp: function() {
    },

    run: function(results) {
      this.bindGlobals_();
      try {
        results.willRunTest(this);

        // Set up.
        try {
          this.setUp();
        } catch(e) {
          results.addError(e);
          return;
        }

        // Run.
        try {
          this.testMethod_();
        } catch(e) {
          results.addError(e);
        }

        // Tear down.
        try {
          this.tearDown();
        } catch(e) {
          results.addError(e);
        }
      } finally {
        this.unbindGlobals_();
        results.didRunTest(this);
      }
    },

    tearDown: function() {
    },

  };

  /**
   * Returns an array of TestCase objects correpsonding to the tests
   * found in the given object. This considers any functions beginning with test
   * as a potential test.
   *
   * @param {RegExp} opt_filter Return only tests that match this regexp.
   * @param {object} opt_objectToEnumerate The object to enumerate, or window if
   * not specified.
   */
  function discoverTests(opt_filter, opt_objectToEnumerate) {
    var objectToEnumerate = opt_objectToEnumerate || window;

    var tests = [];
    for (var testMethodName in objectToEnumerate) {
      if (testMethodName.search(/^test.+/) != 0)
        continue;

      if (opt_filter && testMethodName.search(opt_filter) == -1)
        continue;

      var testMethod = objectToEnumerate[testMethodName];
      if (typeof testMethod != 'function')
        continue;
      var testCase = new TestCase(testMethod, testMethodName);
      tests.push(testCase);
    }
    tests.sort(function(a, b) {
      return a.testName.localeCompare(b.testName);
    });
    return tests;
  }

  /**
   * Runs all unit tests.
   */
  function runAllTests(opt_objectToEnumerate) {
    var runner = new HTMLTestRunner();
    // Stash the runner on window so that the global test runner
    // can get to it.
    window.G_testRunner = runner;
    document.addEventListener('DOMContentLoaded', function() {
      document.body.appendChild(runner);
    });
    window.addEventListener('load', function() {
      var objectToEnumerate = opt_objectToEnumerate || window;
      var tests = discoverTests(objectToEnumerate);
      runner.run(tests);
    });
  }

  return {
    HTMLTestRunner: HTMLTestRunner,
    TestError: TestError,
    TestCase: TestCase,
    discoverTests: discoverTests,
    runAllTests: runAllTests,
    createErrorDiv_: createErrorDiv,
    createTestCaseDiv_: createTestCaseDiv,
  };
});