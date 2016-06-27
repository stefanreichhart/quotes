QuotesFetcher = function() {
	this.initialize();
};

QuotesFetcher.prototype = {
	initialize: function() {
		this.type = 'QuotesFetcher';
		this.delayStart = 250;
		this.delayInterval = 5 * 60 * 1000; // every 5 minutes
		this._specs = [];
		this._requests = [];
		this._timerStart = null;
		this._timerInterval = null;
		this._onHandleQuote = function(quote, request, response) {};
		this._onHandleUnsafeQuote = function(quote, request, response) {};
		this._onAfterFetch = function(request, response) {};
		this._onFetchAborted = function(request) {};
		this._onBeforeFetch = function(request) {};
	},
	setUp: function() {
		var self = this;
		window.clearInterval(self._timerStart);
		self._timerStart = window.setTimeout(function() {
			self.fetchSpecs();
		}, self.delayStart);
	},
	tearDown: function() {
		this.stop();
		this.initialize();
	},
	start: function() {
		var self = this;
		if (!self._timerInterval) {		
			self._timerInterval = window.setInterval(function() {
				self.fetchSpecs();
			}, self.delayInterval);
		}
	},
	stop: function() {
		window.clearInterval(this._timerInterval);
		this._timerInterval = null;
	},
	register: function(urls, interval, callback) {
		var self = this;
		self._specs.push(function() {
			self.fetch(urls, interval, function(request, response) {
				callback(request, response, function(text, author, keywords, source, language, safe) {
					self.handle(text, author, keywords, source, language, safe, request, response);
				});
			});
		});
		self.start();
	},
	fetchSpecs: function() {
		var self = this;
		$(self._specs).each(function(index, each) {
			each();
		});
	},
	fetch: function(urlOrUrls, interval, callback) {
		if (urlOrUrls) {
			if (typeof urlOrUrls ===  'string') {
				this.fetchOne(urlOrUrls, interval, callback);
			} else {
				if (typeof urlOrUrls ===  'object') {
					this.fetchAll(urlOrUrls, interval, callback);
				} else {
					logger.log('warn', 'QuotesFetcher.fetch', { 'urlOrUrls': urlOrUrls, 'interval': interval });
				}
			}
		}
	},
	fetchOne: function(url, interval, callback) {
		var request = this.newRequest(url, interval, callback);
		if (this.canFetch(request)) {
			this._requests.push(request);
			if (this._onBeforeFetch) {
				logger.log('debug', 'QuotesFetcher.onBeforeFetch', { 'url': url, 'interval': interval });
				this._onBeforeFetch(request);
			}
		} else {
			if (this._onFetchAborted) {
				logger.log('debug', 'QuotesFetcher.onFetchAborted', { 'url': url, 'interval': interval });
				this._onFetchAborted(request);
			}
		}
	},
	newRequest: function(url, interval, callback) {
		var self = this;
		var request = new QuotesRequest(url, interval, callback);
		request.onSuccess(function() {
			if (self._onAfterFetch) {
				logger.log('debug', 'QuotesFetcher.onAfterFetch.onSuccess', { 'url': url, 'interval': interval });
				self._onAfterFetch(request, request.response);
			}
		});
		request.onError(function() {
			if (self._onAfterFetch) {
				logger.log('debug', 'QuotesFetcher.onAfterFetch.onError', { 'url': url, 'interval': interval });
				self._onAfterFetch(request, request.response);
			}
		});
		return request;
	},
	fetchAll: function(urls, interval, callback) {
		var self = this;
		$(urls).each(function(index, each) {
			self.fetchOne(each, interval, callback);
		});
	},
	canFetch: function(request) {
		if (!request.url || !request.callback) {
			return false;
		}
		if (request.interval && request.interval > 0 && this._requests && this._requests.length > 0) {
			for (i = this._requests.length - 1; i >= 0; i--) {
				var existingRequest = this._requests[i];
				if (existingRequest && existingRequest.url == request.url) {
					if (existingRequest.timestamp && existingRequest.timestamp + existingRequest.interval > $.timestamp()) {
						return false;
					}
				}
			}
		}
		return true;
	},
	onHandleQuote: function(callback) {
		this._onHandleQuote = callback;
	},
	onHandleUnsafeQuote: function(callback) {
		this._onHandleUnsafeQuote = callback;
	},
	onBeforeFetch: function(callback) {
		this._onBeforeFetch = callback;
	},
	onAfterFetch: function(callback) {
		this._onAfterFetch = callback;
	},
	onFetchAborted: function(callback) {
		this._onFetchAborted = callback;
	},
	handle: function(text, author, keywords, source, language, safe, request, response) {
		if (text) {
			var safe = safe && $.isSafeText(text) && $.isSafeText(author) && $.allSatisfy(keywords, function(index, each) { return $.isSafeText(each); }) && $.isSafeText(source) && $.isSafeText(language);
			var quote = new Quote(text, author, keywords, source, language, ((request && request.timestamp ? request.timestamp : null) || $.timestamp()), safe, request.url);;
			if (request) {
				request['quotes'].push(quote);
			}
			if (safe) {
				if (this._onHandleQuote) {
					logger.log('debug', 'QuotesFetcher.onHandleQuote', { 'text': text, 'author': author, 'keywords': keywords, 'source': source, 'language': language, 'safe': safe });
					this._onHandleQuote(quote, request, response);
				}
			} else {
				if (this._onHandleUnsafeQuote) {
					logger.log('warn', 'QuotesFetcher.onHandleUnsafeQuote', { 'text': text, 'author': author, 'keywords': keywords, 'source': source, 'language': language, 'safe': safe });
					this._onHandleUnsafeQuote(quote, request, response);
				} 
			}
		}
	},
	eachRequest: function(callback) {
		var self = this;
		$(self._requests).each(function(index, each) {
			callback(index, each);
		});
	}
};