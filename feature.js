var EventEmitter = require('events').EventEmitter;
var Browser = require('./Browser');
var Waiter = require('./waiter').Waiter;
var config = require('./environment').config;

var FeatureManager = exports.FeatureManager = function FeatureManager(rootSuite) {
  this.rootSuite = rootSuite;
  this.features = {};
  this.length = 0;
  this.loaded = [];
};

FeatureManager.prototype.addFeature = function(feature) {
  if (feature.title in this.features) {
    throw Error("There is more than one feature named " + feature.title);
  }
  
  this.features[feature.title] = feature;
  this.length += 1;
};

FeatureManager.prototype._canLoad = function(feature) {
  for (var i in feature.dependencies) {
    if (this.loaded.indexOf(feature.dependencies[i]) === -1) {
      return false;
    }
  }
  return true;
};

FeatureManager.prototype.loadFeatures = function() {
  var i, title, feature, prevFeature, prevLoadedLength;
  
  // load all the features
  while (this.loaded.length < this.length) {
    prevLoadedLength = this.loaded.length;
    for (title in this.features) {
      var feature = this.features[title];
      
      if (this._canLoad(feature) && this.loaded.indexOf(title) === -1) {
        if (prevFeature) {
          // add page to the chain-loading
          prevFeature.on('pageLoaded', feature.loadPage.bind(feature));
        } else {
          feature.loadPage();
        }
        feature.load(this.rootSuite);
        this.loaded.unshift(title);
        prevFeature = feature;
      }
    };
    
    if (this.loaded.length === prevLoadedLength) {
      throw Error("Can't load features because of circular dependencies!");
    }
  }
};

var Feature = exports.Feature = function Feature(suite, options, fn) {
  if (!fn) {
    fn = options;
    options = {};
  }
  this.suite = suite;
  this.title = suite.title;
  this.url = options.url || '';
  if (!this.url.match(/^\w+:\/\//))
    this.url = config.baseUrl + this.url;
  this.dependencies = options.dependsOn || [];
  this.fn = fn;
  this.browser = new Browser;
  this.wait = new Waiter(this.browser);
};

Feature.prototype = new EventEmitter;

Feature.prototype.load = function(rootSuite) {
  rootSuite.addSuite(this.suite);
  var self = this;
  this.suite.emit('pre-require', global);
  this.suite.beforeAll(function(done) {
    global.browser = self.browser;
    global.$ = self.browser.query.bind(self.browser);
    global.wait = self.wait;
    browser.onLoaded(done);
  });
  
  this.fn();
  this.suite.emit('post-require', global);  
};

Feature.prototype.loadPage = function() {
  this.browser.get(this.url);
  this.browser.onLoaded(function() {
    this.emit('pageLoaded');
  }.bind(this));
};

