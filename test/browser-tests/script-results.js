/**
 *
 *  Web Starter Kit
 *  Copyright 2016 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */

/* eslint-env mocha, browser */

describe('Test final script output', function() {
  it('should be able to eval the final dev output from babel', function() {
    return fetch('/test/output/babel/phantomjs-test.js')
    .then(function(response) {
      response.status.should.equal(200);
      return response.text();
    })
    .then(function(response) {
      console.log(response);
      chai.expect(function() {
        eval(response);
      }).to.not.throw();
    });
  });
});
