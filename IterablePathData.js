define(function() {

  'use strict';
  
  function quadraticToCubic(x1,y1, qx,qy, x2,y2) {
    return [
      x1 + (qx - x1) * 2 / 3,
      y1 + (qy - y1) * 2 / 3,
      x2 + (qx - x2) * 2 / 3,
      y2 + (qy - y2) * 2 / 3];
  }
  
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
    var sin_phi = Math.sin(phi * Math.PI / 180);
    var cos_phi = Math.cos(phi * Math.PI / 180);
    
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
      delta_theta -= Math.PI * 2;
    }
    if (fs === 1 && delta_theta < 0) {
      delta_theta += Math.PI * 2;
    }

    var result = [];

    // Split an arc to multiple segments, so each segment
    // will be less than 90deg
    var segments = Math.max(Math.ceil(Math.abs(delta_theta) / (Math.PI / 2)), 1);
    delta_theta /= segments;

    for (var i = 0; i < segments; i++) {
      var alpha = Math.tan(delta_theta/4) * 4 / 3;

      var ox1 = Math.cos(theta1);
      var oy1 = Math.sin(theta1);
      var ox2 = Math.cos(theta1 + delta_theta);
      var oy2 = Math.sin(theta1 + delta_theta);

      result.push(
        ox1 - oy1*alpha, oy1 + ox1*alpha,
        ox2 + oy2*alpha, oy2 - ox2*alpha,
        ox2, oy2);

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
  
  function getPointOnCubicCurve(x1,y1, c1x,c1y, c2x,c2y, x2,y2, ratio) {
    const nratio = 1 - ratio;
    
    const Ax = nratio*x1 + ratio*c1x,
          Ay = nratio*y1 + ratio*c1y,
          Bx = nratio*c1x + ratio*c2x,
          By = nratio*c1y + ratio*c2y,
          Cx = nratio*c2x + ratio*x2,
          Cy = nratio*c2y + ratio*y2;

    const Dx = nratio*Ax + ratio*Bx,
          Dy = nratio*Ay + ratio*By;

    const Ex = nratio*Bx + ratio*Cx,
          Ey = nratio*By + ratio*Cy;

    const Px = nratio*Dx + ratio*Ex,
          Py = nratio*Dy + ratio*Ey;
    
    return {x:Px, y:Py};
  }
  
  function intersectionRatios(ax1,ay1,ax2,ay2, bx1,by1,bx2,by2) {
    const denom = (by2 - by1)*(ax2 - ax1) - (bx2 - bx1)*(ay2 - ay1);
    return (denom === 0) ? null : [
      ((bx2 - bx1)*(ay1 - by1) - (by2 - by1)*(ax1 - bx1)) / denom,
      ((ax2 - ax1)*(ay1 - by1) - (ay2 - ay1)*(ax1 - bx1)) / denom,
    ];
  }
  
  function intersectionPosition(ax1,ay1,ax2,ay2, bx1,by1,bx2,by2) {
    const denom = (by2 - by1)*(ax2 - ax1) - (bx2 - bx1)*(ay2 - ay1);
    if (denom === 0) return null;
    const aRatio = (bx2 - bx1)*(ay1 - by1) - (by2 - by1)*(ax1 - bx1);
    return {
      x: ax1 + aRatio * (ax2 - ax1) / denom,
      y: ay1 + aRatio * (ay2 - ay1) / denom,
    };
  }
  
  function twoPointPerspectiveTransformFactory(
    srcX, srcY, srcWidth, srcHeight,
    // "near"/"far" relative to the two vanishing points
    nearFarX, nearFarY,
    nearNearX, nearNearY,
    farNearX, farNearY,
    farFarX, farFarY
  ) {
    const vanish1 = intersectionPosition(
      farFarX, farFarY, nearFarX, nearFarY,
      farNearX, farNearY, nearNearX, nearNearY);
    const vanish2 = intersectionPosition(
      farFarX, farFarY, farNearX, farNearY,
      nearFarX, nearFarY, nearNearX, nearNearY);
    if (!vanish1 || !vanish2) throw new Error('invalid shape for two point perspective');
    const p2x = farFarX + (vanish2.x - vanish1.x), p2y = farFarY + (vanish2.y - vanish1.y);
    const xOff = intersectionPosition(
      farFarX,farFarY, p2x,p2y,
      vanish1.x,vanish1.y, nearNearX,nearNearY);
    const yOff = intersectionPosition(
      farFarX,farFarY, p2x,p2y,
      vanish2.x,vanish2.y, nearNearX,nearNearY);
    const xox = farFarX, xoy = farFarY, yox = yOff.x, yoy = yOff.y;
    const xoxd = xOff.x - farFarX, xoyd = xOff.y - farFarY;
    const yoxd = farFarX - yOff.x, yoyd = farFarY - yOff.y;
    return function(x, y) {
      x -= srcX;
      y -= srcY;
      return intersectionPosition(
        xox + xoxd * x / srcWidth,
        xoy + xoyd * x / srcWidth,
        vanish1.x,
        vanish1.y,
        yox + yoxd * y / srcHeight,
        yoy + yoyd * y / srcHeight,
        vanish2.x,
        vanish2.y);
    };
  }
  
  // curve flattening code below adapted from
  // Anti-Grain Geometry 2.4 by Maxim Shemanarev
  // (Modified BSD License)

  function squareDistance(x1,y1, x2,y2) {
    const dx = x2-x1, dy = y2-y1;
    return dx*dx + dy*dy;
  }

  function* flattenCubic(x1,y1, x2,y2, x3,y3, x4,y4, options) {
    const curve_distance_epsilon = 1e-30;
    const curve_collinearity_epsilon = 1e-30;
    const curve_angle_tolerance_epsilon = 0.01;
    const curve_recursion_limit = 32;

    options = options || {};
    const m_distance_tolerance_square = Math.pow(0.5 / (options.approximationScale || 1), 2);
    const m_angle_tolerance = options.angleTolerance || 0;
    const m_cusp_limit = options.cuspLimit || 0;

    function* recurse(x1,y1, x2,y2, x3,y3, x4,y4, level) {
      if (level > curve_recursion_limit) return;

      // Calculate line segment mid-points
      const x12   = (x1 + x2) / 2;
      const y12   = (y1 + y2) / 2;
      const x23   = (x2 + x3) / 2;
      const y23   = (y2 + y3) / 2;
      const x34   = (x3 + x4) / 2;
      const y34   = (y3 + y4) / 2;
      const x123  = (x12 + x23) / 2;
      const y123  = (y12 + y23) / 2;
      const x234  = (x23 + x34) / 2;
      const y234  = (y23 + y34) / 2;
      const x1234 = (x123 + x234) / 2;
      const y1234 = (y123 + y234) / 2;

      // Try to approximate the full cubic curve by a single straight line
      const dx = x4 - x1;
      const dy = y4 - y1;

      const d2 = Math.abs((x2 - x4)*dy - (y2 - y4)*dx);
      const d3 = Math.abs((x3 - x4)*dy - (y3 - y4)*dx);
      var da1, da2, k;

      switch (((d2 > curve_collinearity_epsilon) << 1) | (d3 > curve_collinearity_epsilon)) {
        case 0:
          // all collinear OR p1===p4
          k = dx*dx + dy*dy;
          if (k === 0) {
            d2 = squareDistance(x1, y1, x2, y2);
            d3 = squareDistance(x4, y4, x3, y3);
          }
          else {
            k   = 1 / k;
            da1 = x2 - x1;
            da2 = y2 - y1;
            d2  = k * (da1*dx + da2*dy);
            da1 = x3 - x1;
            da2 = y3 - y1;
            d3  = k * (da1*dx + da2*dy);
            if (d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1) {
              // Simple collinear case, 1---2---3---4
              // We can leave just two endpoints
              return;
            }
            d2 = (d2 <= 0) ? squareDistance(x2, y2, x1, y1)
               : (d2 >= 1) ? squareDistance(x2, y2, x4, y4)
               : squareDistance(x2, y2, x1 + d2*dx, y1 + d2*dy);
            d3 = (d3 <= 0) ? squareDistance(x3, y3, x1, y1)
               : (d3 >= 1) ? squareDistance(x3, y3, x4, y4)
               : squareDistance(x3, y3, x1 + d3*dx, y1 + d3*dy);
          }
          if (d2 > d3) {
            if (d2 < m_distance_tolerance_square) {
              yield {type:'L', values:[x2, y2]};
              return;
            }
          }
          else if (d3 < m_distance_tolerance_square) {
            yield {type:'L', values:[x3, y3]};
            return;
          }
          break;

        case 1:
          // p1,p2,p4 are collinear, p3 is significant
          if (d3*d3 <= m_distance_tolerance_square * (dx*dx + dy*dy)) {
            if (m_angle_tolerance < curve_angle_tolerance_epsilon) {
              yield {type:'L', values:[x23, y23]};
              return;
            }

            // Angle Condition
            da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2));
            if (da1 >= Math.PI) da1 = 2*Math.PI - da1;

            if (da1 < m_angle_tolerance) {
              yield {type:'L', values:[x2, y2]};
              yield {type:'L', values:[x3, y3]};
              return;
            }

            if (m_cusp_limit !== 0 && da1 > m_cusp_limit) {
              yield {type:'L', values:[x3, y3]};
              return;
            }
          }
          break;

        case 2:
          // p1,p3,p4 are collinear, p2 is significant
          if (d2 * d2 <= m_distance_tolerance_square * (dx*dx + dy*dy)) {
            if (m_angle_tolerance < curve_angle_tolerance_epsilon) {
              yield {type:'L', values:[x23, y23]};
              return;
            }

            // Angle Condition
            da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
            if (da1 >= Math.PI) da1 = 2*Math.PI - da1;

            if (da1 < m_angle_tolerance) {
              yield {type:'L', values:[x2, y2]};
              yield {type:'L', values:[x3, y3]};
              return;
            }

            if (m_cusp_limit !== 0 && da1 > m_cusp_limit) {
              yield {type:'L', values:[x2, y2]};
              return;
            }
          }
          break;

        case 3: 
          // Regular case
          if ((d2 + d3)*(d2 + d3) <= m_distance_tolerance_square * (dx*dx + dy*dy)) {
            // If the curvature doesn't exceed the distance_tolerance value
            // we tend to finish subdivisions.
            if (m_angle_tolerance < curve_angle_tolerance_epsilon) {
              yield {type:'L', values:[x23, y23]};
              return;
            }

            // Angle & Cusp Condition
            k   = Math.atan2(y3-y2, x3-x2);
            da1 = Math.abs(k - Math.atan2(y2-y1, x2-x1));
            da2 = Math.abs(Math.atan2(y4-y3, x4-x3) - k);
            if (da1 >= Math.PI) da1 = 2*Math.PI - da1;
            if (da2 >= Math.PI) da2 = 2*Math.PI - da2;

            if (da1 + da2 < m_angle_tolerance) {
              // Finally we can stop the recursion
              yield {type:'L', values:[x23, y23]};
              return;
            }

            if (m_cusp_limit !== 0) {
              if (da1 > m_cusp_limit) {
                yield {type:'L', values:[x2, y2]};
                return;
              }
              if (da2 > m_cusp_limit) {
                yield {type:'L', values:[x3, y3]};
                return;
              }
            }
          }
          break;
      }

      // Continue subdivision
      yield* recurse(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
      yield* recurse(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
    }

    yield* recurse(x1,y1, x2,y2, x3,y3, x4,y4, 0);
    yield {type:'L', values:[x4, y4]};
  }
  
  
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
        buf.push(step.type + (step.values || []).join(' '));
      }
      return buf.join(' ');
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
        return !/[a-zHVST]/.test(this.source);
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
                newValues.push(x + x-cx, y + y-cy);
                newValues.push(
                  cx = x + step.values[i],
                  cy = y + step.values[i+1]);
                newValues.push(
                  x += step.values[i+2],
                  y += step.values[i+3]);
              }
              yield {type:'C', values:newValues};
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
                  qx = x + x-qx,
                  qy = y + y-qy);
                newValues.push(
                  x += step.values[i],
                  y += step.values[i+1]);
              }
              yield {type:'Q', values:newValues};
              break;
            case 'l':
            case 'm':
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
            case 'H':
              var y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(step.values[i], y);
              }
              yield {
                type: 'L',
                values: newValues,
              };
              break;
            case 'h':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x += step.values[i], y);
              }
              yield {
                type: 'L',
                values: newValues,
              };
              break;
            case 'V':
              var x = state.x;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x, step.values[i]);
              }
              yield {
                type: 'L',
                values: newValues,
              };
              break;
            case 'v':
              var x = state.x, y = state.y;
              var newValues = [];
              for (var i = 0; i < step.values.length; i++) {
                newValues.push(x, y += step.values[i]);
              }
              yield {
                type: 'L',
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
              yield {type:'Z', values:[]};
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
    get asNormalized() {
      return this.asSimpleParams.asAbsolute.asCubicOnly;
    },
    flatten: function(options) {
      const self = this.asNormalized;
      return new IterablePathData(function*() {
        var state = new PathState;
        for (var step of self) {
          if (step.type === 'C') {
            yield* flattenCubic(
              state.x, state.y,
              step.values[0], step.values[1],
              step.values[2], step.values[3],
              step.values[4], step.values[5],
              options);
          }
          else {
            yield step;
          }
          state.update(step);
        }
      });
    },
    translated: function(x, y) {
      if (x === 0 && y === 0) return this;
      const self = this;
      return new IterablePathData(function*() {
        var firstMove = true;
        for (var step of self) switch (step.type) {
          case 'm':
            if (firstMove) {
              firstMove = false;
              var newValues = step.values.slice();
              newValues[0] += x;
              newValues[1] += y;
              yield {type:'m', values:newValues};
            }
            else {
              yield step;
            }
            continue;
          case 'M':
            firstMove = false;
            var newValues = step.values.slice();
            for (var i = 0; i < newValues.length; i += 2) {
              newValues[i] += x;
              newValues[i+1] += y;
            }
            yield {type:'M', values:newValues};
            continue;
          case 'L': case 'C': case 'S': case 'T': case 'Q':
            var newValues = step.values.slice();
            for (var i = 0; i < newValues.length; i += 2) {
              newValues[i] += x;
              newValues[i+1] += y;
            }
            yield {type:step.type, values:newValues};
            continue;
          case 'H':
            var newValues = step.values.slice();
            for (var i = 0; i < newValues.length; i++) {
              newValues[i] += x;
            }
            yield {type:'H', values:newValues};
            continue;
          case 'V':
            var newValues = step.values.slice();
            for (var i = 0; i < newValues.length; i++) {
              newValues[i] += y;
            }
            yield {type:'V', values:newValues};
            continue;
          case 'A':
            var newValues = step.values.slice();
            for (var i = 0; i < newValues.length; i += 7) {
              newValues[i+5] += x;
              newValues[i+6] += y;
            }
            yield {type:'A', values:newValues};
            continue;
          default:
            yield step;
            continue;
        }
      });
    },
    scaled: function(x, y) {
      return this.transformed(x, 0, 0, y, 0, 0);
    },
    skewedX: function(deg) {
      return this.transformed(1, 0, Math.tan(deg * Math.PI / 180), 1, 0, 0);
    },
    skewedY: function(deg) {
      return this.transformed(1, Math.tan(deg * Math.PI / 180), 0, 1, 0, 0);
    },
    rotated: function(deg, x, y) {
      x = x || 0;
      y = y || 0;
      const rad = deg * Math.PI / 180;
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      if (x === 0 && y === 0) {
        return this.transformed(cos, sin, -sin, cos, 0, 0);
      }
      return this.transformed(cos, sin, -sin, cos, -x*cos + x + y*sin, -x*sin - y*cos + y);
    },
    transformed: function(a, b, c, d, e, f) {
      if (a === 1 && b === 0 && c === 0 && d === 1) {
        return this.translated(e, f);
      }
      const self = this.asAbsolute.asCubicOnly;
      return new IterablePathData(function*() {
        for (var step of self) switch (step.type) {
          case 'M': case 'L': case 'C':
            var newValues = [];
            for (var i = 0; i < step.values.length; i += 2) {
              newValues.push(
                a*step.values[i] + c*step.values[i+1] + e,
                b*step.values[i] + d*step.values[i+1] + f);
            }
            yield {type:step.type, values:newValues};
            continue;
          case 'Z':
            yield step;
            continue;
          default:
            throw new Error('unexpected step type: ' + step.type);
        }
      });
    },
  };
  
  const RADIUS_RATIO = 0.552284749831;
  const RADIUS_RATIO_INV = 1 - RADIUS_RATIO;
  
  function Ellipse(cx,cy, rx,ry) {
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = isNaN(ry) ? rx : ry;
  }
  Ellipse.prototype = Object.create(IterablePathData.prototype, {
    guaranteesOneSegment: {value:true},
    guaranteesCubicOnly: {value:true},
    guaranteesAbsolute: {value:true},
    guaranteesSimpleParams: {value:true},
    source: PROP_SELF,
    r: {
      get: function() {
        return this.rx === this.ry ? this.rx : NaN;
      },
      set: function(v) {
        this.rx = this.ry = v;
      },
    },
  });
  Object.assign(Ellipse.prototype, {
    cx: 0,
    cy: 0,
    rx: 0,
    ry: 0,
    [Symbol.iterator]: function*() {
      yield {type:'M', values:[this.cx, this.cy - this.ry]};
      yield {type:'C', values:[
        this.cx + RADIUS_RATIO * this.rx, this.cy - this.ry,
        this.cx + this.rx, this.cy - RADIUS_RATIO * this.ry,
        this.cx + this.rx, this.cy]};
      yield {type:'C', values:[
        this.cx + this.rx, this.cy + RADIUS_RATIO * this.ry,
        this.cx + RADIUS_RATIO * this.rx, this.cy + this.ry,
        this.cx, this.cy + this.ry]};
      yield {type:'C', values:[
        this.cx - RADIUS_RATIO * this.rx, this.cy + this.ry,
        this.cx - this.rx, this.cy + RADIUS_RATIO * this.ry,
        this.cx - this.rx, this.cy]};
      yield {type:'C', values:[
        this.cx - this.rx, this.cy - RADIUS_RATIO * this.ry,
        this.cx - RADIUS_RATIO * this.rx, this.cy - this.ry,
        this.cx, this.cy - this.ry]};
      yield {type:'Z', values:[]};
    },
  });
  
  function Rect(x,y,width,height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  Rect.prototype = Object.create(IterablePathData.prototype, {
    guaranteesOneSegment: {value:true},
    guaranteesCubicOnly: {value:true},
    guaranteesAbsolute: {value:true},
    guaranteesSimpleParams: {value:true},
    source: PROP_SELF,
  });
  Object.assign(Rect.prototype, {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rx: 0,
    ry: 0,
    [Symbol.iterator]: function*() {
      if (this.rx === 0 && this.ry === 0) {
        yield {type:'M', values:[this.x, this.y]};
        yield {type:'L', values:[this.x + this.width, this.y]};
        yield {type:'L', values:[this.x + this.width, this.y + this.height]};
        yield {type:'L', values:[this.x, this.y + this.height]};
        yield {type:'Z', values:[]};
      }
      else {
        yield {type:'M', values:[this.x, this.y + this.ry]};
        yield {type:'C', values:[
          this.x, this.y + RADIUS_RATIO_INV * this.ry,
          this.x + RADIUS_RATIO_INV * this.rx, this.y,
          this.x + this.rx, this.y]};
        yield {type:'L', values:[this.x + this.width - this.rx, this.y]};
        yield {type:'C', values:[
          this.x + this.width - RADIUS_RATIO_INV * this.rx, this.y,
          this.x + this.width, this.y + RADIUS_RATIO_INV * this.ry,
          this.x + this.width, this.y + this.ry]};
        yield {type:'L', values:[this.x + this.width, this.y + this.height - this.ry]};
        yield {type:'C', values:[
          this.x + this.width, this.y + this.height - RADIUS_RATIO_INV * this.ry,
          this.x + this.width - RADIUS_RATIO_INV * this.rx, this.y + this.height,
          this.x + this.width - this.rx, this.y + this.height]};
        yield {type:'L', values:[this.x + this.rx, this.y + this.height]};
        yield {type:'C', values:[
          this.x + this.rx * RADIUS_RATIO_INV, this.y + this.height,
          this.x, this.y + this.height - RADIUS_RATIO_INV * this.ry,
          this.x, this.y + this.height - this.ry]};
        yield {type:'Z', values:[]};
      }
    },
  });
  
  IterablePathData.Rect = Rect;
  IterablePathData.Ellipse = Ellipse;
  
  return IterablePathData;

});
