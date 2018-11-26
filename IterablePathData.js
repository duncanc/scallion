define(function() {

  'use strict';
  
  function quadraticToCubic(x1,y1, qx,qy, x2,y2) {
    return [
      x1 + (qx - x1) * 2 / 3,
      y1 + (qy - y1) * 2 / 3,
      x2 + (qx - x2) * 2 / 3,
      y2 + (qy - y2) * 2 / 3];
  }
  
  const TAU = Math.PI * 2;

  // code below based on a2c.js from svgpath lib (MIT License)
  // <https://github.com/fontello/svgpath/blob/master/lib/a2c.js>
  
  function unitVectorAngle(ux, uy, vx, vy) {
    var sign = (ux*vy - uy*vx < 0) ? -1 : 1;
    var dot  = ux*vx + uy*vy;

    // Add this to work with arbitrary vectors:
    // dot /= Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);

    // rounding errors, e.g. -1.0000000000000002 can screw up this
    if (dot > 1) dot = 1;
    else if (dot < -1) dot = -1;

    return sign * Math.acos(dot);
  }

  function arcToCubic(x1,y1, rx,ry, phi, fa,fs, x2,y2) {
    var sin_phi = Math.sin(phi * TAU / 360);
    var cos_phi = Math.cos(phi * TAU / 360);
    
    var x1p =  cos_phi*(x1-x2)/2 + sin_phi*(y1-y2)/2;
    var y1p = -sin_phi*(x1-x2)/2 + cos_phi*(y1-y2)/2;

    if ((x1p === 0 && y1p === 0) || rx === 0 || ry === 0) {
      return [x1,y1, x2,y2, x2,y2];
    }

    rx = Math.abs(rx);
    ry = Math.abs(ry);

    var lambda = (x1p * x1p) / (rx * rx)
               + (y1p * y1p) / (ry * ry);

    if (lambda > 1) {
      lambda = Math.sqrt(lambda);
      rx *= lambda;
      ry *= lambda;
    }

    var rx_sq = rx * rx;
    var ry_sq = ry * ry;
    var x1p_sq = x1p * x1p;
    var y1p_sq = y1p * y1p;

    var radicant = ((rx_sq * ry_sq)
                  - (rx_sq * y1p_sq)
                  - (ry_sq * x1p_sq));

    if (radicant < 0) {
      // fix tiny negative rounding errors
      radicant = 0;
    }

    radicant /= (rx_sq * y1p_sq) + (ry_sq * x1p_sq);
    radicant = Math.sqrt(radicant) * (fa === fs ? -1 : 1);

    var cxp = radicant *  rx/ry * y1p;
    var cyp = radicant * -ry/rx * x1p;

    var cx = cos_phi*cxp - sin_phi*cyp + (x1+x2)/2;
    var cy = sin_phi*cxp + cos_phi*cyp + (y1+y2)/2;

    var v1x =  (x1p - cxp) / rx;
    var v1y =  (y1p - cyp) / ry;
    var v2x = (-x1p - cxp) / rx;
    var v2y = (-y1p - cyp) / ry;

    var theta1 = unitVectorAngle(1, 0, v1x, v1y);
    var delta_theta = unitVectorAngle(v1x, v1y, v2x, v2y);

    if (fs === 0 && delta_theta > 0) {
      delta_theta -= TAU;
    }
    if (fs === 1 && delta_theta < 0) {
      delta_theta += TAU;
    }

    var result = [];

    // Split an arc to multiple segments, so each segment
    // will be less than 90deg
    var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (TAU / 4)), 1);
    delta_theta /= segments;

    for (var i = 0; i < segments; i++) {
      var alpha = Math.tan(delta_theta/4) * 4 / 3;

      var x1 = Math.cos(theta1);
      var y1 = Math.sin(theta1);
      var x2 = Math.cos(theta1 + delta_theta);
      var y2 = Math.sin(theta1 + delta_theta);

      result.push(
        x1 - y1*alpha, y1 + x1*alpha,
        x2 + y2*alpha, y2 - x2*alpha,
        x2, y2);

      theta1 += delta_theta;
    }
    
    for (var i = result.length - 4; i >= 0; i -= 2) {
      var x = result[i]*rx, y = result[i+1]*ry;

      // rotate
      var xp = cos_phi*x - sin_phi*y;
      var yp = sin_phi*x + cos_phi*y;

      // translate
      result[i] = xp + cx;
      result[i+1] = yp + cy;
    }
    
    result.splice(-2, 2, x2, y2);

    return result;
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
  
  function PathState() {
  }
  PathState.prototype = {
    x0:0, y0:0,
    x:0, y:0,
    qx:0, qy:0,
    cx:0, cy:0,
    update: function(step) {
      switch (step.type) {
        case 'M':
          this.x0 = this.qx = this.cx = this.x = step.values[step.values.length - 2];
          this.y0 = this.qy = this.cy = this.y = step.values[step.values.length - 1];
          break;
        case 'm':
          var dx = 0, dy = 0;
          for (var i = 0; i < step.values.length; i += 2) {
            dx += step.values[i];
            dy += step.values[i+1];
          }
          this.x0 = this.qx = this.cx = this.x += dx;
          this.y0 = this.qy = this.cy = this.y += dy;
          break;
        case 'z': case 'Z':
          this.qx = this.cx = this.x = this.x0;
          this.qy = this.cy = this.y = this.y0;
          break;
        case 'A':
        case 'L':
          this.qx = this.cx = this.x = step.values[step.values.length - 2];
          this.qy = this.cy = this.y = step.values[step.values.length - 1];
          break;
        case 'a':
          var dx = 0, dy = 0;
          for (var i = 0; i < step.values.length; i += 7) {
            dx += step.values[i+5];
            dy += step.values[i+6];
          }
          this.qx = this.cx = this.x += dx;
          this.qy = this.cy = this.y += dy;
          break;
        case 'l':
          var dx = 0, dy = 0;
          for (var i = 0; i < step.values.length; i += 2) {
            dx += step.values[i];
            dy += step.values[i+1];
          }
          this.qx = this.cx = this.x += dx;
          this.qy = this.cy = this.y += dy;
          break;
        case 'H':
          this.qx = this.cx = this.x = step.values[step.values.length-1];
          break;
        case 'h':
          var dx = 0;
          for (var i = 0; i < step.values.length; i++) {
            dx += step.values[i];
          }
          this.qx = this.cx = this.x += dx;
          break;
        case 'V':
          this.qy = this.cy = this.y = step.values[step.values.length-1];
          break;
        case 'v':
          var dy = 0;
          for (var i = 0; i < step.values.length; i++) {
            dy += step.values[i];
          }
          this.qy = this.cy = this.y += dy;
          break;
        case 'C':
        case 'S':
          this.cx = step.values[step.values.length - 4];
          this.cy = step.values[step.values.length - 3];
          this.qx = this.x = step.values[step.values.length - 2];
          this.qy = this.y = step.values[step.values.length - 1];
          break;
        case 'c':
          var x = this.x, y = this.y, cx, cy;
          for (var i = 0; i < step.values.length; i += 6) {
            cx = x + step.values[i+2];
            cy = y + step.values[i+3];
            x += step.values[i+4];
            y += step.values[i+5];
          }
          this.cx = cx;
          this.cy = cy;
          this.qx = this.x = x;
          this.qy = this.y = y;
          break;
        case 's':
          var x = this.x, y = this.y, cx, cy;
          for (var i = 0; i < step.values.length; i += 4) {
            cx = x + step.values[i];
            cy = y + step.values[i+1];
            x += step.values[i+2];
            y += step.values[i+3];
          }
          this.cx = cx;
          this.cy = cy;
          this.qx = this.x = x;
          this.qy = this.y = y;
          break;
        case 'Q':
          this.qx = step.values[step.values.length - 4];
          this.qy = step.values[step.values.length - 3];
          this.cx = this.x = step.values[step.values.length - 2];
          this.cy = this.y = step.values[step.values.length - 1];
          break;
        case 'q':
          var x = this.x, y = this.y, qx, qy;
          for (var i = 0; i < step.values.length; i += 4) {
            qx = x + step.values[i];
            qy = y + step.values[i+1];
            x += step.values[i+2];
            y += step.values[i+3];
          }
          this.qx = qx;
          this.qy = qy;
          this.cx = this.x = x;
          this.cy = this.y = y;
          break;
        case 'T':
          var x = this.x, y = this.y, qx = this.qx, qy = this.qy;
          for (var i = 0; i < step.values.length; i += 2) {
            qx = x + x - qx;
            qy = y + y - qy;
            x = step.values[i];
            y = step.values[i+1];
          }
          this.qx = qx;
          this.qy = qy;
          this.cx = this.x = x;
          this.cy = this.y = y;
          break;
        case 't':
          var x = this.x, y = this.y, qx = this.qx, qy = this.qy;
          for (var i = 0; i < step.values.length; i += 2) {
            qx = x + x - qx;
            qy = y + y - qy;
            x += step.values[i];
            y += step.values[i+1];
          }
          this.qx = qx;
          this.qy = qy;
          this.cx = this.x = x;
          this.cy = this.y = y;
          break;
      }
    },
  };
  
  function IterablePathData(source) {
    if (typeof source === 'function') {
      this[Symbol.iterator] = source;
      Object.defineProperty(this, 'source', PROP_SELF);
    }
    else if (typeof source === 'string' || Symbol.iterator in source) {
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
        var state = new PathState;
        for (var step of source) {
          switch (step.type) {
            case 'S':
              var x=state.x, y=state.y, cx=state.cx, cy=state.cy;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                newValues.push(x + x-cx, y + y-cy);
                newValues.push(
                  cx = step.values[i],
                  cy = step.values[i+1],
                  x = step.values[i+2],
                  y = step.values[i+3]);
              }
              yield {type:'C', values:newValues};
              break;
            case 's':
              var x=state.x, y=state.y, cx=state.cx, cy=state.cy;
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
              yield {type:'c', values:newValues};
              break;
            case 'T':
              var x=state.x, y=state.y, qx=state.qx, qy=state.qy;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  qx = x + x - qx,
                  qy = y + y - qy);
                newValues.push(
                  x = step.values[i],
                  y = step.values[i+1]);
              }
              yield {type:'Q', values:newValues};
              break;
            case 't':
              var x=state.x, y=state.y, qx=state.qx, qy=state.qy;
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
              yield {type:'q', values:newValues};
              break;
            default:
              yield step;
              break;
          }
          state.update(step);
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
        var state = new PathState;
        for (var step of self) {
          switch (step.type) {
            case 'Q':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                var qx = step.values[i], qy = step.values[i+1];
                var nx = step.values[i+2], ny = step.values[i+3];
                var controls = quadraticToCubic(
                  x, y,
                  qx, qy,
                  nx, ny);
                newValues.push(
                  controls[0], controls[1],
                  controls[2], controls[3],
                  x = nx, y = ny);
              }
              yield {type:'C', values:newValues};
              break;
            case 'q':
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                var qx = step.values[i], qy = step.values[i+1];
                var nx = step.values[i+2], ny = step.values[i+3];
                var controls = quadraticToCubic(
                  0, 0,
                  qx, qy,
                  nx, ny);
                newValues.push(
                  controls[0], controls[1],
                  controls[2], controls[3],
                  nx, ny);
              }
              yield {type:'c', values:newValues};
              break;
            case 'T':
              var x = state.x, y = state.y, qx = state.qx, qy = state.qy;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                var nx = step.values[i], ny = step.values[i+1];
                qx = nx + nx - qx;
                qy = ny + ny - qx;
                var controls = quadraticToCubic(
                  x, y,
                  qx, qy,
                  nx, ny);
                newValues.push(
                  controls[0], controls[1],
                  controls[2], controls[3],
                  x = nx, y = ny);
              }
              yield {type:'C', values:newValues};
              break;
            case 't':
              var dqx = state.x - state.qx, dqy = state.y - state.qy;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                var dx = step.values[i], dy = step.values[i+1];
                var controls = quadraticToCubic(
                  0, 0,
                  dqx, dqy,
                  dx, dy);
                newValues.push(
                  controls[0], controls[1],
                  controls[2], controls[3],
                  dx, dy);
                dqx = dx - dqx;
                dqy = dy - dqy;
              }
              yield {type:'c', values:newValues};
              break;
            case 'A':
              var x = state.x, y = state.y;
              for (var i = 0; i < step.values.length; i += 7) {
                var nx = step.values[i+5], ny = step.values[i+6];
                var cubicValues = arcToCubic(
                  x, y,
                  step.values[i], step.values[i+1], step.values[i+2], step.values[i+3], step.values[i+4],
                  nx, ny);
                for (var j = 0; j < cubicValues.length; j += 6) {
                  yield {type:'C', values:cubicValues.slice(j, j+6)};
                }
                x = nx;
                y = ny;
              }
              break;
            case 'a':
              var x = state.x, y = state.y;
              for (var i = 0; i < step.values.length; i += 7) {
                var nx = step.values[i+5], ny = step.values[i+6];
                var cubicValues = arcToCubic(
                  x, y,
                  step.values[i], step.values[i+1], step.values[i+2], step.values[i+3], step.values[i+4],
                  x + nx, y + ny);
                for (var j = 0; j < cubicValues.length; j += 6) {
                  yield {type:'C', values:cubicValues.slice(j, j+6)};
                }
                x += nx;
                y += ny;
              }
              break;
            default:
              yield step;
              break;
          }
          state.update(step);
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
        var state = new PathState;
        for (var step of self) {
          switch (step.type) {
            case 'l':
            case 'm':
            case 't':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 2) {
                newValues.push(
                  x += step.values[i],
                  y += step.values[i+1]);
              }
              yield {
                type: step.type.toUpperCase(),
                values: newValues,
              };
              break;
            case 'h':
              var x = state.x;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x += step.values[i]);
              }
              yield {
                type: 'H',
                values: newValues,
              };
              break;
            case 'v':
              var y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(y += step.values[i]);
              }
              yield {
                type: 'V',
                values: newValues,
              };
              break;
            case 'q':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 4) {
                newValues.push(
                  x + step.values[i],
                  y + step.values[i+1]);
                newValues.push(
                  x += step.values[i+2],
                  y += step.values[i+3]);
              }
              yield {type:'Q', values:newValues};
              break;
            case 'c':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 6) {
                newValues.push(
                  x + step.values[i],
                  y + step.values[i+1],
                  x + step.values[i+2],
                  y + step.values[i+3]);
                newValues.push(
                  x += step.values[i+4],
                  y += step.values[i+5]);
              }
              yield {type:'C', values:newValues};
              break;
            case 'a':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i += 7) {
                newValues.push(
                  step.values[i],
                  step.values[i+1],
                  step.values[i+2],
                  step.values[i+3],
                  step.values[i+4],
                  x += step.values[i+5],
                  y += step.values[i+6]);
              }
              yield {type:'A', values:newValues};
              break;
            case 'z':
              yield {type:'Z'};
              break;
            default:
              yield step;
              break;
          }
          state.update(step);
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
