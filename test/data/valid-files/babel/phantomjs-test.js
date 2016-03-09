import * as otherModule from './es2015-module-multiple-exports';
import {sum} from './es2015-module-multiple-exports';
import defaultExport from './es2015-module-multiple-exports';

var square = require('./commonjs-module-square.js');
var cubedModule = require('./commonjs-module-cubed.js');
console.log([
  defaultExport,
  sum(1, 2, 3),
  otherModule.plusOne(1),
  square(2),
  cubedModule.cubed(2)
]);
