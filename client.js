// represents the haste-application
var haste = function() {
    this.config = {baseURL: defaultURL(), highlight: undefined, html: false};
	this.ui = new HasteUI(this.config);
    this.view = {
        set: function(val, mode) { this.val = val; },
        get: function() { return this.val || ''; }
    };
};

const isHTTP = typeof window !== 'undefined' && window.location.protocol.match(/^https?:/);

function defaultURL() {
	return isHTTP ? '' : 'http://localhost:7777';
}

class HasteUI {
	constructor(config) {
		this.baseTitle = "Hastebin Plus";
		this.config = config;
	}

	enterDocument(key) {
		if (key !== this._key) {
			this.setTitle(key);
            if (isHTTP)
                window.history.pushState(null,
                    this.mkTitle(key), `${this.config.baseURL}/${key || ''}`);
		}
		this._key = key;
	}
	
	setTitle(ext) {
		document.title = this.mkTitle(ext);	
	}

	mkTitle(ext) {
		return ext ? `${this.baseTitle} - ${ext}` : this.baseTitle;
	}

	configureButtons(container, actions) {
		this.buttons = [
			{
				$where: container.find('.save'),
				shortcut: function(evt) {
					return evt.ctrlKey && evt.keyCode === 83;
				},
				action: actions.save
			},
			{
				$where: container.find('.new'),
				shortcut: function(evt) {
					return evt.ctrlKey && evt.keyCode === 32;
				},
				action: actions.new
			},
			{
				$where: container.find('.duplicate'),
				shortcut: function(evt) {
					return evt.ctrlKey && evt.keyCode === 68;
				},
				action: actions.duplicate
			},
			{
				$where: container.find('.raw'),
				shortcut: function(evt) {
					return evt.ctrlKey && evt.shiftKey && evt.keyCode === 82;
				},
				action: actions.raw
			}
		];
		for (var i = 0; i < this.buttons.length; i++) {
			this.configureButton(this.buttons[i]);
		}
	}

	configureButton(options) {
		options.$where.click(function(evt) {
			evt.preventDefault();
			if (!options.clickDisabled && $(this).hasClass('enabled')) {
				options.action();
			}
		});
	}

	/** registers the configured shortcuts */
	configureShortcuts() {
		var _this = this;
		$(document.body).on('keydown', function(evt) {
			var button;
			for (var i = 0; i < _this.buttons.length; i++) {
				button = _this.buttons[i];
				if (button.shortcut && button.shortcut(evt)) {
					evt.preventDefault();
					button.action();
					return;
				}
			}
		});
	}

	/** show the light key */
	lightKey = function() { this.configureKey(['new', 'save']); }

	/** show the full key */
	fullKey = function() { this.configureKey(['new', 'duplicate', 'raw']); }

	/** set the enabled buttons */
	configureKey(enable) {
		for (let [k, v] of Object.entries(this.buttons || {})) {
			v.$where.toggleClass('enabled', k in enable);
		}
	}

	/**
	 * Embeds the toolbar in an existing document.
	 */
	embed(container = document.body) {
		$('<div>').addClass('haste--embedded').html(`
			<div id="haste--tools">
				<div class="save function" title="Save [Ctrl + S]"></div>
				<div class="new function" title="New [Ctrl + Space]"></div>
				<div class="duplicate function" title="Duplicate [Ctrl + D]"></div>
				<div class="raw function" title="Raw [Ctrl + Shift + R]"></div>
			</div>`)
		.appendTo(container);
	}
}


// setup a new, blank document
haste.prototype.newDocument = function() {
	this.doc = new haste_document(this.config);
	this.ui.enterDocument(undefined);
	this.ui.lightKey();
    this.view.set('', 'w');
};

// load an existing document
haste.prototype.loadDocument = function(key) {
	var _this = this;
	_this.doc = new haste_document(this.config);
	_this.doc.load(key, function(ret) {
		if (ret) {
			_this.ui.enterDocument(ret.key);
			_this.ui.fullKey();
            _this.view.set(ret.value, 'r');
		} else {
			_this.newDocument();
		}
	});
};

// saves the current document (without locking it)
haste.prototype.saveDocument = function(cb) {
	this.doc.save(this.view.get(), cb);
};

// duplicate the current document
haste.prototype.duplicateDocument = function() {
	if (this.doc.locked) {
		var currentData = this.doc.data;
		this.newDocument();
        this.view.set(currentData, 'w');
	}
};

// save and lock the current document
haste.prototype.lockDocument = function(cb) {
	var _this = this;
	this.doc.save(this.view.get(), function(err, res) {
		if (!err && res) {
			_this.loadDocument(res.key);
		}
        if (cb) cb(err, res);
	});
};

// Low-level api to manipulate documents
haste.prototype.getDocument = function(key, cb) {
    var doc = new haste_document(this.config);
    cb = cb || function() { };
    if (key) {
        doc.load(key, function(ret) { ret ? cb(doc) : cb(ret); });
    }
    else {
        cb(doc);
    }
    return doc;
};

// configure buttons and their shortcuts
haste.prototype.configureButtons = function(container) {
	var _this = this;
	container = container || $('#haste--tools');
	this.ui.configureButtons(container, {
		save: function() {
			if (!_this.view.get().match(/^\s+$/)) {
				_this.lockDocument();
			}
		},
		new: function() {
			_this.newDocument(!_this.doc.key);
		},
		duplicate: function() {
			_this.duplicateDocument();
		},
		raw: function() {
			window.location.href = '/raw/' + _this.doc.key;
		}
	});
};


// enables the configured shortcuts
haste.prototype.configureShortcuts = function() {
	this.ui.configureShortcuts();
};

// represents a single document
var haste_document = function(config) {
    this.config = config;
	this.locked = false;
};

// load a document from the server
haste_document.prototype.load = function(key, callback) {
	var _this = this;
	$.ajax(this.config.baseURL + '/documents/' + key, {
		type: 'get',
		dataType: 'json',
		success: function(res) {
			_this.locked = true;
			_this.key = key;
			_this.data = res.data;
			var value = res.data;
            if (_this.config.highlight === 'js')
                value = hljs.highlightAuto(value).value;
            if (_this.config.html)
                value = value.replace(/.+/g, "<span class=\"line\">$&</span>")
                             .replace(/^\s*[\r\n]/gm, "<span class=\"line\"></span>\n");

			callback({value: value, key: key});
		},
		error: function(err) {
			callback(false);
		}
	});
};

// sends the document to the server
haste_document.prototype.save = function(data, callback) {
	if (this.locked) return;

	this.data = data;
	$.ajax(this.config.baseURL + '/documents', {
		type: 'post',
		data: this.config.trim ? data.trim() : data,
		dataType: 'json',
		contentType: 'application/json; charset=utf-8',
		success: function(res) {
            callback(null, res);
		},
		error: function(res) {
			try {
				callback($.parseJSON(res.responseText));
			} catch (e) {
				callback({message: 'Something went wrong!', error: e});
			}
		}
	});
};

if (typeof module !== 'undefined') {
    module.exports = {haste, haste_document, HasteUI};
}
