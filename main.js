
require([
  'domReady!'
], function(
  domReady
) {

  'use strict';
  
  function getTemplate(selector) {
    var template = document.querySelector('#templates > ' + selector);
    if (!template) throw new Error('template not found: ' + selector);
    return template.cloneNode(true);
  }
  
  var home = getTemplate('.home');
  document.body.appendChild(home);

});
