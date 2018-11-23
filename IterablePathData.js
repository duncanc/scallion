define(function() {

  'use strict';
  
  function splitPathSegments(str) {
    return str.match(/m[^m]*/gi);
  }
  
  function splitPathSteps(str) {
    return str
      .replace(/-\s+/g, '-')
      .match(/[a-z]\s*[^a-z]*/gi)
      .map(function(v) {
        return {
          type: v[0],
          values: v
            .slice(1)
            .trim()
            .split(/[\s,]+/g)
            .map(parseFloat),
        };
      });
  }
  
  const RX_NUM = /(?:[\+\-]?\s*(?:\d+(?:\.\d*)?|\.\d+)\s*(?:,\s*)?)/g;
  const RX_COMPLEX_PARAMS = new RegExp([
    '[mlt]\\s*' + RX_NUM.source + '{3,}',
    '[hv]\\s*' + RX_NUM.source + '{2,}',
    '[sq]\\s*' + RX_NUM.source + '{5,}',
    '[c]\\s*' + RX_NUM.source + '{7,}',
    '[a]\\s*' + RX_NUM.source + '{8,}',
  ].join('|'), 'gi');
  
  function toSimpleParams(str) {
    return str.replace(RX_COMPLEX_PARAMS, function(a) {
      var command = a[0];
      var paramCount;
      switch (command) {
        case 'm':
          command = 'l';
          paramCount = 2;
          break;
        case 'M':
          command = 'L';
          paramCount = 2;
          break;
        case 'l': case 'L': case 't': case 'T':
          paramCount = 2;
          break;
        case 'h': case 'H': case 'v': case 'V':
          paramCount = 1;
          break;
        case 's': case 'S': case 'q': case 'Q':
          paramCount = 4;
          break;
        case 'c': case 'C':
          paramCount = 6;
          break;
        case 'a': case 'A':
          paramCount = 7;
          break;
        default:
          throw new Error('unknown command: ' + command);
      }
      var p = -1;
      return a.replace(RX_NUM, function(num) {
        if (++p === paramCount) {
          num = command + num;
          p = 0;
        }
        return num;
      });
    });
  }
  
  function IterablePathData(source) {
    if (Symbol.iterator in source) {
      this.source = source;
    }
    else {
      throw new Error('invalid source');
    }
  }
  IterablePathData.prototype = {
    [Symbol.iterator]: function() {
      var source = this.source;
      if (typeof source === 'string') {
        source = splitPathSteps(source);
      }
      return source[Symbol.iterator]();
    },
    toString: function() {
      if (typeof this.source === 'string') {
        return this.source;
      }
      var buf = [];
      for (var step of this.source) {
        buf.push(step.type + step.values.join(' '));
      }
      return buf.join('');
    },
    get guaranteesOneSegment() {
      if (typeof this.source === 'string') {
        return /^\s*m[^mz]*(?:z\s*)?$/i.test(this.source);
      }
      return false;
    },
    toSegments: function() {
      if (this.guaranteesOneSegment) return [this];
      var source = this.source;
      if (typeof source === 'string') {
        return splitPathSegments(source).map(function(segment) {
          return new IterablePathData(segment);
        });
      }
      var segments = [];
      var currentSteps = null;
      for (var step of source) {
        switch (step.type) {
          case 'm': case 'M':
            if (currentSteps) {
              var segment = new IterablePathData(currentSteps);
              Object.defineProperty(segment, 'guaranteesOneSegment', {value:true});
              segments.push(segment);
            }
            currentSteps = [];
            break;
        }
        currentSteps.push(step);
      }
      return segments;
    },
    get guaranteesSimpleParams() {
      if (typeof this.source === 'string') {
        return this === this.asSimpleParams;
      }
      return false;
    },
    get asSimpleParams() {
      var iter;
      if (typeof this.source === 'string') {
        var simplified = toSimpleParams(this.source);
        if (simplified === this.source) {
          iter = this;
        }
        else {
          iter = new IterablePathData(simplified);
        }
      }
      else if (this.guaranteesSimpleParams) {
        return this;
      }
      else {
        const source = this.source;
        iter = new IterablePathData(function*() {
          var paramCount;
          for (var step of source) {
            switch (step.type) {
              case 'z': case 'Z': yield step; continue;
              case 'm': case 'M':
                if (step.values.length === 2) {
                  yield step;
                }
                else {
                  yield {type:step.type, values:step.values.slice(0, 2)};
                  var type = step.type === 'm' ? 'l' : 'L';
                  for (var i = 2; i < step.values.length; i += 2) {
                    yield {type:type, values:step.values.slice(i, i+2)};
                  }
                }
                continue;
              case 'l': case 'L': case 't': case 'T':
                paramCount = 2;
                break;
              case 'h': case 'H': case 'v': case 'V':
                paramCount = 1;
                break;
              case 's': case 'S': case 'q': case 'Q':
                paramCount = 4;
                break;
              case 'c': case 'C':
                paramCount = 6;
                break;
              case 'a': case 'A':
                paramCount = 7;
                break;
              default:
                throw new Error('unknown command: ' + step.type);
            }
            if (paramCount === step.values.length) {
              yield step;
            }
            else {
              for (var i = 0; i < step.values.length; i += paramCount) {
                yield {
                  type: step.type,
                  values: step.values.slice(i, i+paramCount),
                };
              }
            }
          }
        });
      }
      Object.defineProperty(this, 'asSimpleParams', {
        value: iter,
      });
      return iter;
    },
    get guaranteesBaseCommands() {
      if (typeof this.source === 'string') {
        return !/[ahqstv]/i.test(this.source);
      }
      return false;
    },
    get asBaseCommands() {
      if (this.guaranteesBaseCommands) {
        return this;
      }
      const self = this;
      var iter = new IterablePathData(function*() {
        var x=0, y=0, x0=0, y0=0, hx=0,hy=0;
        for (var step of self) {
          switch (step.type) {
            case 'M':
              x0 = hx = x = step.values[step.values.length-2];
              y0 = hy = y = step.values[step.values.length-1];
              yield step;
              continue;
            case 'm':
              x0 = x += step.values[0];
              y0 = y += step.values[1];
              for (var i = 2; i < step.values; i += 2) {
                x += step.values[i];
                y += step.values[i+1];
              }
              hx = x;
              hy = y;
              yield step;
              continue;
            case 'Z': case 'z':
              hx = x = x0;
              hy = y = y0;
              yield step;
              continue;
            case 'L':
              hx = x = step.values[step.values.length-2];
              hy = y = step.values[step.values.length-1];
              yield step;
              continue;
            case 'l':
              for (var i = 0; i < step.values; i += 2) {
                x += step.values[i];
                y += step.values[i+1];
              }
              hx = x;
              hy = y;
              yield step;
              continue;
            case 'H':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x = step.values[i], y);
              }
              hx = x;
              hy = y;
              yield {type:'L', values:newValues};
              break;
            case 'h':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(step.values[i], 0);
                x += step.values[i];
              }
              yield {type:'l', values:newValues};
              break;
            case 'V':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x, y = step.values[i]);
              }
              hx = x;
              hy = y;
              yield {type:'L', values:newValues};
              break;
            case 'v':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(0, step.values[i]);
                y += step.values[i];
              }
              yield {type:'l', values:newValues};
              break;
            case 'C':
              hx = step.values[step.values.length-4];
              hy = step.values[step.values.length-3];
              x = step.values[step.values.length-2];
              y = step.values[step.values.length-1];
              yield step;
              continue;
            case 'c':
              for (var i = 0; i < step.values.length; i += 6) {
                hx = x + step.values[i+2];
                hy = y + step.values[i+3];
                x += step.values[i+4];
                y += step.values[i+5];
              }
              yield step;
              continue;
            case 'A':
              throw new Error('NYI');
              break;
            case 'a':
              throw new Error('NYI');
              break;
            case 'S':
              throw new Error('NYI');
              break;
            case 's':
              throw new Error('NYI');
              break;
            case 'Q':
              throw new Error('NYI');
              break;
            case 'q':
              throw new Error('NYI');
              break;
            case 'T':
              throw new Error('NYI');
              break;
            case 't':
              throw new Error('NYI');
              break;
            default: yield step;
          }
        }
      });
      Object.defineProperty(iter, 'guaranteesBaseCommands', {
        value: true,
      });
      if (this.guaranteesOneSegment) {
        Object.defineProperty(iter, 'guaranteesOneSegment', {
          value: true,
        });
      }
      Object.defineProperty(this, 'asBaseCommands', {
        value: iter,
      });
      return iter;
    },
    get guaranteesAbsolute() {
      if (typeof this.source === 'string') {
        return !/[a-z]/.test(this.source);
      }
      return false;
    },
    get asAbsolute() {
      if (this.guaranteesAbsolute) return this;
      const self = this;
      var iter = new IterablePathData(function*() {
        var x=0, y=0, x0=0, y0=0, mx=0, my=0;
        for (var step of self) {
          switch (step.type) {
            case 'M':
              x0 = x = step.values[step.values.length-2];
              y0 = y = step.values[step.values.length-1];
              yield step;
              break;
            case 'm':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  x += step.values[step.values.length-2],
                  y += step.values[step.values.length-1]);
              }
              x0 = newValues[0];
              y0 = newValues[1];
              yield {type:'M', values:newValues};
              break;
            case 'Z': case 'z':
              x = x0;
              y = y0;
              yield step.type === 'Z' ? step : {type:'Z', values:step.values};
              break;
            case 'L': case 'C': case 'S': case 'Q': case 'T': case 'A':
              x = step.values[step.values.length-2];
              y = step.values[step.values.length-1];
              yield step;
              break;
            case 'l':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  x += step.values[i],
                  y += step.values[i+1]);
              }
              yield {type:'L', values:newValues};
              break;
            case 'c':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 6) {
                
              }
              yield {type:'C', values:newValues};
              break;
            case 's':
              throw new Error('NYI');
              break;
            case 'q':
              throw new Error('NYI');
              break;
            case 't':
              throw new Error('NYI');
              break;
            case 'a':
              throw new Error('NYI');
              break;
            case 'H':
              x = step.values[step.values.length-1];
              yield step;
              break;
            case 'V':
              x = step.values[step.values.length-1];
              yield step;
              break;
            case 'h':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x += step.values[i]);
              }
              yield {type:'H', values:newValues};
              break;
            case 'v':
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(y += step.values[i]);
              }
              yield {type:'V', values:newValues};
              break;
            default:
              throw new Error('unknown path step type: ' + step.type);
              break;
          }
        }
      });
      Object.defineProperty(iter, 'guaranteesAbsolute', {
        value: true,
      });
      if (this.guaranteesOneSegment) {
        Object.defineProperty(iter, 'guaranteesOneSegment', {
          value: true,
        });
      }
      Object.defineProperty(this, 'asAbsolute', {
        value: iter,
      });
      return iter;
    },
  };
  
  return IterablePathData;

});