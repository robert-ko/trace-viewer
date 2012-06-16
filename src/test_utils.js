// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Helper functions for use in tracing tests.
 */
base.define('test_utils', function() {
  function getAsync(url, cb) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.onreadystatechange = function(aEvt) {
      if (req.readyState == 4) {
        window.setTimeout(function() {
          if (req.status == 200) {
            cb(req.responseText);
          } else {
            console.log('Failed to load ' + url);
          }
        }, 0);
      }
    };
    req.send(null);
  }

  function newAsyncSlice(start, duration, startThread, endThread) {
    return newAsyncSliceNamed('a', start, duration, startThread, endThread);
  }

  function newAsyncSliceNamed(name, start, duration, startThread, endThread) {
    var s = new tracing.TimelineAsyncSlice(name, 0, start);
    s.duration = duration;
    s.startThread = startThread;
    s.endThread = endThread;
    var subSlice = new tracing.TimelineAsyncSlice(name, 0, start);
    subSlice.duration = duration;
    subSlice.startThread = startThread;
    subSlice.endThread = endThread;
    s.subSlices = [subSlice];
    return s;
  }

  function assertArrayishEquals(ref, val) {
    assertEquals(ref.length, val.length);
    for (var i = 0; i < ref.length; i++)
      assertEquals(ref[i], val[i]);
  }

  return {
    getAsync: getAsync,
    newAsyncSlice: newAsyncSlice,
    newAsyncSliceNamed: newAsyncSliceNamed,
    assertArrayishEquals: assertArrayishEquals
  };
});