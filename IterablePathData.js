define(function() {

  'use strict';
  
  function quadraticToCubic(x0,y0, qx,qy, x1,y1) {
    return [
      x0 + 2 * (qx - x0) / 3,
      y0 + 2 * (qy - y0) / 3,
      x1 + 2 * (qx - x1) / 3,
      y1 + 2 * (qy - y1) / 3];
  }
  
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
  
  const PROP_SELF = {
    get: function(){ return this; },
  };
  
  function IterablePathData(source) {
    if (typeof source === 'function') {
      this[Symbol.iterator] = source;
      Object.defineProperty(this, 'source', PROP_SELF);
    }
    else if (Symbol.iterator in source) {
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
    get guaranteesUnreflected() {
      if (typeof this.source === 'string') {
        return !/[st]/i.test(this.source);
      }
      return false;
    },
    get asUnreflected() {
      if (this.guaranteesUnreflected) return this;
      const source = this;
      var iter = new IterablePathData(function*() {
        var x=0,y=0, x0=0,y0=0, cx=0,cy=0, qx=0,qy=0;
        for (var step of source) {
          switch (step.type) {
            case 'S':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                newValues.push(x + x - cx, y + y - cy);
                newValues.push(
                  cx = step.values[i],
                  cy = step.values[i+1],
                  x = step.values[i+2],
                  y = step.values[i+3]);
              }
              qx = x;
              qy = y;
              yield {type:'C', values:newValues};
              continue;
            case 's':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                newValues.push(
                  x - cx,
                  y - cy,
                  step.values[i],
                  step.values[i+1],
                  step.values[i+2],
                  step.values[i+3]);
                cx = x + step.values[i];
                cy = y + step.values[i+1];
                x += step.values[i+2];
                y += step.values[i+3];
              }
              qx = x;
              qy = y;
              yield {type:'c', values:newValues};
              continue;
            case 'T':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  qx = x + x - qx,
                  qy = y + y - qy);
                newValues.push(
                  x = step.values[i],
                  y = step.values[i+1]);
              }
              cx = x;
              cy = y;
              yield {type:'Q', values:newValues};
              continue;
            case 't':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  x - qx,
                  y - qy,
                  step.values[i],
                  step.values[i+1]);
                qx = x + x - qx;
                qy = y + y - qy;
                x += step.values[0];
                y += step.values[1];
              }
              cx = x;
              cy = y;
              yield {type:'q', values:newValues};
              continue;
              
            case 'C':
              cx = step.values[step.values.length-4];
              cy = step.values[step.values.length-3];
              qx = x = step.values[step.values.length-2];
              qy = y = step.values[step.values.length-1];
              break;
            case 'c':
              for (var i = 0; i < step.values.length; i += 6) {
                cx = x + step.values[i+2];
                cy = y + step.values[i+3];
                x += step.values[i+4];
                y += step.values[i+5];
              }
              qx = x;
              qy = y;
              break;
            case 'Q':
              qx = step.values[step.values.length-4];
              qy = step.values[step.values.length-3];
              cx = x = step.values[step.values.length-2];
              cy = y = step.values[step.values.length-1];
              break;
            case 'q':
              for (var i = 0; i < step.values.length; i += 4) {
                qx = x + step.values[i];
                qy = y + step.values[i+1];
                x += step.values[i+2];
                y += step.values[i+3];
              }
              cx = x;
              cy = y;
              break;
            
            case 'M':
              x0 = step.values[0];
              y0 = step.values[1];
              qx = cx = x = step.values[step.values.length-2];
              qy = cy = y = step.values[step.values.length-1];
              break;
            case 'm':
              x0 = x += step.values[0];
              y0 = y += step.values[1];
              for (var i = 2; i < step.values.length; i += 2) {
                x += step.values[i];
                y += step.values[i+1];
              }
              qx = cx = x;
              qy = cy = y;
              break;
            case 'Z':
            case 'z':
              qx = cx = x = x0;
              qy = cy = y = y0;
              break;
            case 'L':
              qx = cx = x = step.values[step.values.length-2];
              qy = cy = y = step.values[step.values.length-1];
              break;
            case 'l':
              for (var i = 0; i < step.values.length; i += 2) {
                x += step.values[i];
                y += step.values[i+1];
              }
              qx = cx = x;
              qy = cy = y;
              break;
            case 'H':
              qx = cx = x = step.values[step.values.length-1];
              qy = cy = y;
              break;
            case 'h':
              for (var i = 0; i < step.values.length; i++) {
                x += step.values[i];
              }
              qx = cx = x;
              qy = cy = y;
              break;
            case 'V':
              qx = cx = x;
              qy = cy = y = step.values[step.values.length-1];
              break;
            case 'v':
              for (var i = 0; i < step.values.length; i++) {
                y += step.values[i];
              }
              qx = cx = x;
              qy = cy = y;
              break;
          }
          yield step;
        }
      });
      Object.defineProperty(this, 'asUnreflected', {
        value: iter,
      });
      return iter;
    },
    get guaranteesCubicOnly() {
      if (typeof this.source === 'string') {
        return !/[aqt]/i.test(this.source);
      }
      return false;
    },
    get asCubicOnly() {
      if (this.guaranteesCubicOnly) return this;
      const self = this;
      var iter = new IterablePathData(function*() {
        for (var step of self) {
          switch (step.type) {
            case 'M':
              break;
            case 'm':
              break;
            case 'L':
              break;
            case 'l':
              break;
            case 'C':
              break;
            case 'c':
              break;
            case 'S':
              break;
            case 's':
              break;
            case 'z':
            case 'Z':
              break;
            case 'Q':
              continue;
            case 'q':
              continue;
          }
          yield step;
        }
      });
      Object.defineProperty(this, 'asCubicOnly', {
        value: iter,
      });
      Object.defineProperty(iter, 'guaranteesCubicOnly', {
        value: true,
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
        var x=0,y=0, x0=0,y0=0, cx=0,cy=0, qx=0,qy=0;
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
      Object.defineProperty(this, 'asAbsolute', {
        value: iter,
      });
      return iter;
    },
  };
  
  return IterablePathData;

});
