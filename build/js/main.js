(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		/**
		 * The maximum time for a tap
		 *
		 * @type number
		 */
		this.tapTimeout = options.tapTimeout || 700;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	/**
	* Windows Phone 8.1 fakes user agent string to look like Android and iPhone.
	*
	* @type boolean
	*/
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0-7.* requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none or manipulation, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// Firefox version - zero for other browsers
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (firefoxVersion >= 27) {
			// Firefox 27+ does not have tap delay if the content is not zoomable - https://bugzilla.mozilla.org/show_bug.cgi?id=922896

			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// IE11: prefixed -ms-touch-action is no longer supported and it's recomended to use non-prefixed version
		// http://msdn.microsoft.com/en-us/library/windows/apps/Hh767313.aspx
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} [options={}] The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());

},{}],2:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Burst, Swirl, Transit, bitsMap, h,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  bitsMap = require('./shapes/bitsMap');

  Transit = require('./transit');

  Swirl = require('./swirl');

  h = require('./h');

  Burst = (function(_super) {
    __extends(Burst, _super);

    function Burst() {
      return Burst.__super__.constructor.apply(this, arguments);
    }

    Burst.prototype.skipProps = {
      childOptions: 1
    };

    Burst.prototype.defaults = {
      count: 5,
      degree: 360,
      opacity: 1,
      randomAngle: 0,
      randomRadius: 0,
      x: 100,
      y: 100,
      shiftX: 0,
      shiftY: 0,
      easing: 'Linear.None',
      radius: {
        25: 75
      },
      radiusX: void 0,
      radiusY: void 0,
      angle: 0,
      size: null,
      sizeGap: 0,
      duration: 600,
      delay: 0,
      onStart: null,
      onComplete: null,
      onCompleteChain: null,
      onUpdate: null,
      isResetAngles: false
    };

    Burst.prototype.childDefaults = {
      radius: {
        7: 0
      },
      radiusX: void 0,
      radiusY: void 0,
      angle: 0,
      opacity: 1,
      onStart: null,
      onComplete: null,
      onUpdate: null,
      points: 3,
      duration: 500,
      delay: 0,
      repeat: 0,
      yoyo: false,
      easing: 'Linear.None',
      type: 'circle',
      fill: 'deeppink',
      fillOpacity: 1,
      isSwirl: false,
      swirlSize: 10,
      swirlFrequency: 3,
      stroke: 'transparent',
      strokeWidth: 0,
      strokeOpacity: 1,
      strokeDasharray: '',
      strokeDashoffset: '',
      strokeLinecap: null
    };

    Burst.prototype.optionsIntersection = {
      radius: 1,
      radiusX: 1,
      radiusY: 1,
      angle: 1,
      opacity: 1,
      onStart: 1,
      onComplete: 1,
      onUpdate: 1
    };

    Burst.prototype.run = function(o) {
      var i, key, keys, len, option, tr, _base, _i, _len, _ref, _ref1;
      if ((o != null) && Object.keys(o).length) {
        if (o.count || ((_ref = o.childOptions) != null ? _ref.count : void 0)) {
          this.h.warn('Sorry, count can not be changed on run');
        }
        this.extendDefaults(o);
        keys = Object.keys(o.childOptions || {});
        if ((_base = this.o).childOptions == null) {
          _base.childOptions = {};
        }
        for (i = _i = 0, _len = keys.length; _i < _len; i = ++_i) {
          key = keys[i];
          this.o.childOptions[key] = o.childOptions[key];
        }
        len = this.transits.length;
        while (len--) {
          option = this.getOption(len);
          if ((((_ref1 = o.childOptions) != null ? _ref1.angle : void 0) == null) && (o.angleShift == null)) {
            option.angle = this.transits[len].o.angle;
          } else if (!o.isResetAngles) {
            option.angle = this.getBitAngle(option.angle, len);
          }
          this.transits[len].tuneNewOption(option, true);
        }
        this.timeline.recalcDuration();
      }
      if (this.props.randomAngle || this.props.randomRadius) {
        len = this.transits.length;
        while (len--) {
          tr = this.transits[len];
          this.props.randomAngle && tr.setProp({
            angleShift: this.generateRandomAngle()
          });
          this.props.randomRadius && tr.setProp({
            radiusScale: this.generateRandomRadius()
          });
        }
      }
      return this.startTween();
    };

    Burst.prototype.createBit = function() {
      var i, option, _i, _ref, _results;
      this.transits = [];
      _results = [];
      for (i = _i = 0, _ref = this.props.count; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        option = this.getOption(i);
        option.ctx = this.ctx;
        option.index = i;
        option.isDrawLess = option.isRunLess = option.isTweenLess = true;
        this.props.randomAngle && (option.angleShift = this.generateRandomAngle());
        this.props.randomRadius && (option.radiusScale = this.generateRandomRadius());
        _results.push(this.transits.push(new Swirl(option)));
      }
      return _results;
    };

    Burst.prototype.addBitOptions = function() {
      var aShift, i, pointEnd, pointStart, points, step, transit, _i, _len, _ref, _results;
      points = this.props.count;
      this.degreeCnt = this.props.degree % 360 === 0 ? points : points - 1 || 1;
      step = this.props.degree / this.degreeCnt;
      _ref = this.transits;
      _results = [];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        transit = _ref[i];
        aShift = transit.props.angleShift || 0;
        pointStart = this.getSidePoint('start', i * step + aShift);
        pointEnd = this.getSidePoint('end', i * step + aShift);
        transit.o.x = this.getDeltaFromPoints('x', pointStart, pointEnd);
        transit.o.y = this.getDeltaFromPoints('y', pointStart, pointEnd);
        if (!this.props.isResetAngles) {
          transit.o.angle = this.getBitAngle(transit.o.angle, i);
        }
        _results.push(transit.extendDefaults());
      }
      return _results;
    };

    Burst.prototype.getBitAngle = function(angle, i) {
      var angleAddition, angleShift, curAngleShift, degCnt, delta, end, keys, newEnd, newStart, points, start, step;
      points = this.props.count;
      degCnt = this.props.degree % 360 === 0 ? points : points - 1 || 1;
      step = this.props.degree / degCnt;
      angleAddition = i * step + 90;
      angleShift = this.transits[i].props.angleShift || 0;
      angle = typeof angle !== 'object' ? angle + angleAddition + angleShift : (keys = Object.keys(angle), start = keys[0], end = angle[start], curAngleShift = angleAddition + angleShift, newStart = parseFloat(start) + curAngleShift, newEnd = parseFloat(end) + curAngleShift, delta = {}, delta[newStart] = newEnd, delta);
      return angle;
    };

    Burst.prototype.getSidePoint = function(side, angle) {
      var pointStart, sideRadius;
      sideRadius = this.getSideRadius(side);
      return pointStart = this.h.getRadialPoint({
        radius: sideRadius.radius,
        radiusX: sideRadius.radiusX,
        radiusY: sideRadius.radiusY,
        angle: angle,
        center: {
          x: this.props.center,
          y: this.props.center
        }
      });
    };

    Burst.prototype.getSideRadius = function(side) {
      return {
        radius: this.getRadiusByKey('radius', side),
        radiusX: this.getRadiusByKey('radiusX', side),
        radiusY: this.getRadiusByKey('radiusY', side)
      };
    };

    Burst.prototype.getRadiusByKey = function(key, side) {
      if (this.deltas[key] != null) {
        return this.deltas[key][side];
      } else if (this.props[key] != null) {
        return this.props[key];
      }
    };

    Burst.prototype.getDeltaFromPoints = function(key, pointStart, pointEnd) {
      var delta;
      delta = {};
      if (pointStart[key] === pointEnd[key]) {
        return delta = pointStart[key];
      } else {
        delta[pointStart[key]] = pointEnd[key];
        return delta;
      }
    };

    Burst.prototype.draw = function(progress) {
      return this.drawEl();
    };

    Burst.prototype.isNeedsTransform = function() {
      return this.isPropChanged('shiftX') || this.isPropChanged('shiftY') || this.isPropChanged('angle');
    };

    Burst.prototype.fillTransform = function() {
      return "rotate(" + this.props.angle + "deg) translate(" + this.props.shiftX + ", " + this.props.shiftY + ")";
    };

    Burst.prototype.createTween = function() {
      var i, _results;
      Burst.__super__.createTween.apply(this, arguments);
      i = this.transits.length;
      _results = [];
      while (i--) {
        _results.push(this.timeline.add(this.transits[i].tween));
      }
      return _results;
    };

    Burst.prototype.calcSize = function() {
      var i, largestSize, radius, transit, _i, _len, _ref;
      largestSize = -1;
      _ref = this.transits;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        transit = _ref[i];
        transit.calcSize();
        if (largestSize < transit.props.size) {
          largestSize = transit.props.size;
        }
      }
      radius = this.calcMaxRadius();
      this.props.size = largestSize + 2 * radius;
      this.props.size += 2 * this.props.sizeGap;
      this.props.center = this.props.size / 2;
      return this.addBitOptions();
    };

    Burst.prototype.getOption = function(i) {
      var key, keys, len, option;
      option = {};
      keys = Object.keys(this.childDefaults);
      len = keys.length;
      while (len--) {
        key = keys[len];
        option[key] = this.getPropByMod({
          key: key,
          i: i,
          from: this.o.childOptions
        });
        if (this.optionsIntersection[key]) {
          if (option[key] == null) {
            option[key] = this.getPropByMod({
              key: key,
              i: i,
              from: this.childDefaults
            });
          }
          continue;
        }
        if (option[key] == null) {
          option[key] = this.getPropByMod({
            key: key,
            i: i,
            from: this.o
          });
        }
        if (option[key] == null) {
          option[key] = this.getPropByMod({
            key: key,
            i: i,
            from: this.childDefaults
          });
        }
      }
      return option;
    };

    Burst.prototype.getPropByMod = function(o) {
      var prop, _ref;
      prop = (_ref = o.from || this.o.childOptions) != null ? _ref[o.key] : void 0;
      if (this.h.isArray(prop)) {
        return prop[o.i % prop.length];
      } else {
        return prop;
      }
    };

    Burst.prototype.generateRandomAngle = function(i) {
      var randdomness, randomness;
      randomness = parseFloat(this.props.randomAngle);
      randdomness = randomness > 1 ? 1 : randomness < 0 ? 0 : void 0;
      return this.h.rand(0, randomness ? randomness * 360 : 180);
    };

    Burst.prototype.generateRandomRadius = function(i) {
      var randdomness, randomness, start;
      randomness = parseFloat(this.props.randomRadius);
      randdomness = randomness > 1 ? 1 : randomness < 0 ? 0 : void 0;
      start = randomness ? (1 - randomness) * 100 : (1 - .5) * 100;
      return this.h.rand(start, 100) / 100;
    };

    Burst.prototype.then = function(o) {
      this.h.error("Burst's \"then\" method is under consideration, you can vote for it in github repo issues");
      return this;
    };

    return Burst;

  })(Transit);

  module.exports = Burst;

}).call(this);

},{"./h":7,"./shapes/bitsMap":13,"./swirl":23,"./transit":24}],3:[function(require,module,exports){
(function (global){
(function() {
  var BezierEasing, bezierEasing, h,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  h = require('../h');


  /**
   * Copyright (c) 2014 Gaëtan Renaudeau http://goo.gl/El3k7u
   * Adopted from https://github.com/gre/bezier-easing
   */

  BezierEasing = (function() {
    function BezierEasing(o) {
      this.vars();
      return this.generate;
    }

    BezierEasing.prototype.vars = function() {
      return this.generate = h.bind(this.generate, this);
    };

    BezierEasing.prototype.generate = function(mX1, mY1, mX2, mY2) {
      var A, B, C, NEWTON_ITERATIONS, NEWTON_MIN_SLOPE, SUBDIVISION_MAX_ITERATIONS, SUBDIVISION_PRECISION, arg, binarySubdivide, calcBezier, calcSampleValues, f, float32ArraySupported, getSlope, getTForX, i, kSampleStepSize, kSplineTableSize, mSampleValues, newtonRaphsonIterate, precompute, str, _i, _precomputed;
      if (arguments.length < 4) {
        return this.error('Bezier function expects 4 arguments');
      }
      for (i = _i = 0; _i < 4; i = ++_i) {
        arg = arguments[i];
        if (typeof arg !== "number" || isNaN(arg) || !isFinite(arg)) {
          return this.error('Bezier function expects 4 arguments');
        }
      }
      if (mX1 < 0 || mX1 > 1 || mX2 < 0 || mX2 > 1) {
        return this.error('Bezier x values should be > 0 and < 1');
      }
      NEWTON_ITERATIONS = 4;
      NEWTON_MIN_SLOPE = 0.001;
      SUBDIVISION_PRECISION = 0.0000001;
      SUBDIVISION_MAX_ITERATIONS = 10;
      kSplineTableSize = 11;
      kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);
      float32ArraySupported = __indexOf.call(global, 'Float32Array') >= 0;
      A = function(aA1, aA2) {
        return 1.0 - 3.0 * aA2 + 3.0 * aA1;
      };
      B = function(aA1, aA2) {
        return 3.0 * aA2 - 6.0 * aA1;
      };
      C = function(aA1) {
        return 3.0 * aA1;
      };
      calcBezier = function(aT, aA1, aA2) {
        return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
      };
      getSlope = function(aT, aA1, aA2) {
        return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
      };
      newtonRaphsonIterate = function(aX, aGuessT) {
        var currentSlope, currentX;
        i = 0;
        while (i < NEWTON_ITERATIONS) {
          currentSlope = getSlope(aGuessT, mX1, mX2);

          /* istanbul ignore if */
          if (currentSlope === 0.0) {
            return aGuessT;
          }
          currentX = calcBezier(aGuessT, mX1, mX2) - aX;
          aGuessT -= currentX / currentSlope;
          ++i;
        }
        return aGuessT;
      };
      calcSampleValues = function() {
        i = 0;
        while (i < kSplineTableSize) {
          mSampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
          ++i;
        }
      };

      /* istanbul ignore next */
      binarySubdivide = function(aX, aA, aB) {
        var currentT, currentX, isBig;
        currentX = void 0;
        currentT = void 0;
        i = 0;
        while (true) {
          currentT = aA + (aB - aA) / 2.0;
          currentX = calcBezier(currentT, mX1, mX2) - aX;
          if (currentX > 0.0) {
            aB = currentT;
          } else {
            aA = currentT;
          }
          isBig = Math.abs(currentX) > SUBDIVISION_PRECISION;
          if (!(isBig && ++i < SUBDIVISION_MAX_ITERATIONS)) {
            break;
          }
        }
        return currentT;
      };
      getTForX = function(aX) {
        var currentSample, delta, dist, guessForT, initialSlope, intervalStart, lastSample;
        intervalStart = 0.0;
        currentSample = 1;
        lastSample = kSplineTableSize - 1;
        while (currentSample !== lastSample && mSampleValues[currentSample] <= aX) {
          intervalStart += kSampleStepSize;
          ++currentSample;
        }
        --currentSample;
        delta = mSampleValues[currentSample + 1] - mSampleValues[currentSample];
        dist = (aX - mSampleValues[currentSample]) / delta;
        guessForT = intervalStart + dist * kSampleStepSize;
        initialSlope = getSlope(guessForT, mX1, mX2);
        if (initialSlope >= NEWTON_MIN_SLOPE) {
          return newtonRaphsonIterate(aX, guessForT);
        } else {

          /* istanbul ignore next */
          if (initialSlope === 0.0) {
            return guessForT;
          } else {
            return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize);
          }
        }
      };
      precompute = function() {
        var _precomputed;
        _precomputed = true;
        if (mX1 !== mY1 || mX2 !== mY2) {
          return calcSampleValues();
        }
      };
      mSampleValues = !float32ArraySupported ? new Array(kSplineTableSize) : new Float32Array(kSplineTableSize);
      _precomputed = false;
      f = function(aX) {
        if (!_precomputed) {
          precompute();
        }
        if (mX1 === mY1 && mX2 === mY2) {
          return aX;
        }
        if (aX === 0) {
          return 0;
        }
        if (aX === 1) {
          return 1;
        }
        return calcBezier(getTForX(aX), mY1, mY2);
      };
      str = "bezier(" + [mX1, mY1, mX2, mY2] + ")";
      f.toStr = function() {
        return str;
      };
      return f;
    };

    BezierEasing.prototype.error = function(msg) {
      return h.error(msg);
    };

    return BezierEasing;

  })();

  bezierEasing = new BezierEasing;

  module.exports = bezierEasing;

}).call(this);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../h":7}],4:[function(require,module,exports){
(function() {
  var Easing, PathEasing, bezier, easing, h, mix;

  bezier = require('./bezier-easing');

  PathEasing = require('./path-easing');

  mix = require('./mix');

  h = require('../h');

  Easing = (function() {
    function Easing() {}

    Easing.prototype.bezier = bezier;

    Easing.prototype.PathEasing = PathEasing;

    Easing.prototype.path = (new PathEasing('creator')).create;

    Easing.prototype.inverse = function(p) {
      return 1 - p;
    };

    Easing.prototype.linear = {
      none: function(k) {
        return k;
      }
    };

    Easing.prototype.ease = {
      "in": bezier.apply(Easing, [0.42, 0, 1, 1]),
      out: bezier.apply(Easing, [0, 0, 0.58, 1]),
      inout: bezier.apply(Easing, [0.42, 0, 0.58, 1])
    };

    Easing.prototype.quad = {
      "in": function(k) {
        return k * k;
      },
      out: function(k) {
        return k * (2 - k);
      },
      inout: function(k) {
        if ((k *= 2) < 1) {
          return 0.5 * k * k;
        }
        return -0.5 * (--k * (k - 2) - 1);
      }
    };

    Easing.prototype.cubic = {
      "in": function(k) {
        return k * k * k;
      },
      out: function(k) {
        return --k * k * k + 1;
      },
      inout: function(k) {
        if ((k *= 2) < 1) {
          return 0.5 * k * k * k;
        }
        return 0.5 * ((k -= 2) * k * k + 2);
      }
    };

    Easing.prototype.quart = {
      "in": function(k) {
        return k * k * k * k;
      },
      out: function(k) {
        return 1 - (--k * k * k * k);
      },
      inout: function(k) {
        if ((k *= 2) < 1) {
          return 0.5 * k * k * k * k;
        }
        return -0.5 * ((k -= 2) * k * k * k - 2);
      }
    };

    Easing.prototype.quint = {
      "in": function(k) {
        return k * k * k * k * k;
      },
      out: function(k) {
        return --k * k * k * k * k + 1;
      },
      inout: function(k) {
        if ((k *= 2) < 1) {
          return 0.5 * k * k * k * k * k;
        }
        return 0.5 * ((k -= 2) * k * k * k * k + 2);
      }
    };

    Easing.prototype.sin = {
      "in": function(k) {
        return 1 - Math.cos(k * Math.PI / 2);
      },
      out: function(k) {
        return Math.sin(k * Math.PI / 2);
      },
      inout: function(k) {
        return 0.5 * (1 - Math.cos(Math.PI * k));
      }
    };

    Easing.prototype.expo = {
      "in": function(k) {
        if (k === 0) {
          return 0;
        } else {
          return Math.pow(1024, k - 1);
        }
      },
      out: function(k) {
        if (k === 1) {
          return 1;
        } else {
          return 1 - Math.pow(2, -10 * k);
        }
      },
      inout: function(k) {
        if (k === 0) {
          return 0;
        }
        if (k === 1) {
          return 1;
        }
        if ((k *= 2) < 1) {
          return 0.5 * Math.pow(1024, k - 1);
        }
        return 0.5 * (-Math.pow(2, -10 * (k - 1)) + 2);
      }
    };

    Easing.prototype.circ = {
      "in": function(k) {
        return 1 - Math.sqrt(1 - k * k);
      },
      out: function(k) {
        return Math.sqrt(1 - (--k * k));
      },
      inout: function(k) {
        if ((k *= 2) < 1) {
          return -0.5 * (Math.sqrt(1 - k * k) - 1);
        }
        return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
      }
    };

    Easing.prototype.back = {
      "in": function(k) {
        var s;
        s = 1.70158;
        return k * k * ((s + 1) * k - s);
      },
      out: function(k) {
        var s;
        s = 1.70158;
        return --k * k * ((s + 1) * k + s) + 1;
      },
      inout: function(k) {
        var s;
        s = 1.70158 * 1.525;
        if ((k *= 2) < 1) {
          return 0.5 * (k * k * ((s + 1) * k - s));
        }
        return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
      }
    };

    Easing.prototype.elastic = {
      "in": function(k) {
        var a, p, s;
        s = void 0;
        p = 0.4;
        if (k === 0) {
          return 0;
        }
        if (k === 1) {
          return 1;
        }
        a = 1;
        s = p / 4;
        return -(a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
      },
      out: function(k) {
        var a, p, s;
        s = void 0;
        p = 0.4;
        if (k === 0) {
          return 0;
        }
        if (k === 1) {
          return 1;
        }
        a = 1;
        s = p / 4;
        return a * Math.pow(2, -10 * k) * Math.sin((k - s) * (2 * Math.PI) / p) + 1;
      },
      inout: function(k) {
        var a, p, s;
        s = void 0;
        p = 0.4;
        if (k === 0) {
          return 0;
        }
        if (k === 1) {
          return 1;
        }
        a = 1;
        s = p / 4;
        if ((k *= 2) < 1) {
          return -0.5 * (a * Math.pow(2, 10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p));
        }
        return a * Math.pow(2, -10 * (k -= 1)) * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;
      }
    };

    Easing.prototype.bounce = {
      "in": function(k) {
        return 1 - easing.bounce.out(1 - k);
      },
      out: function(k) {
        if (k < (1 / 2.75)) {
          return 7.5625 * k * k;
        } else if (k < (2 / 2.75)) {
          return 7.5625 * (k -= 1.5 / 2.75) * k + 0.75;
        } else if (k < (2.5 / 2.75)) {
          return 7.5625 * (k -= 2.25 / 2.75) * k + 0.9375;
        } else {
          return 7.5625 * (k -= 2.625 / 2.75) * k + 0.984375;
        }
      },
      inout: function(k) {
        if (k < 0.5) {
          return easing.bounce["in"](k * 2) * 0.5;
        }
        return easing.bounce.out(k * 2 - 1) * 0.5 + 0.5;
      }
    };

    Easing.prototype.parseEasing = function(easing) {
      var easingParent, type;
      type = typeof easing;
      if (type === 'string') {
        if (easing.charAt(0).toLowerCase() === 'm') {
          return this.path(easing);
        } else {
          easing = this._splitEasing(easing);
          easingParent = this[easing[0]];
          if (!easingParent) {
            h.error("Easing with name \"" + easing[0] + "\" was not found, fallback to \"linear.none\" instead");
            return this['linear']['none'];
          }
          return easingParent[easing[1]];
        }
      }
      if (h.isArray(easing)) {
        return this.bezier.apply(this, easing);
      }
      if ('function') {
        return easing;
      }
    };

    Easing.prototype._splitEasing = function(string) {
      var firstPart, secondPart, split;
      if (typeof string === 'function') {
        return string;
      }
      if (typeof string === 'string' && string.length) {
        split = string.split('.');
        firstPart = split[0].toLowerCase() || 'linear';
        secondPart = split[1].toLowerCase() || 'none';
        return [firstPart, secondPart];
      } else {
        return ['linear', 'none'];
      }
    };

    return Easing;

  })();

  easing = new Easing;

  easing.mix = mix(easing);

  module.exports = easing;

}).call(this);

},{"../h":7,"./bezier-easing":3,"./mix":5,"./path-easing":6}],5:[function(require,module,exports){
(function() {
  var create, easing, getNearest, mix, parseIfEasing, sort,
    __slice = [].slice;

  easing = null;

  parseIfEasing = function(item) {
    if (typeof item.value === 'number') {
      return item.value;
    } else {
      return easing.parseEasing(item.value);
    }
  };

  sort = function(a, b) {
    var returnValue;
    a.value = parseIfEasing(a);
    b.value = parseIfEasing(b);
    returnValue = 0;
    a.to < b.to && (returnValue = -1);
    a.to > b.to && (returnValue = 1);
    return returnValue;
  };

  getNearest = function(array, progress) {
    var i, index, value, _i, _len;
    index = 0;
    for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
      value = array[i];
      index = i;
      if (value.to > progress) {
        break;
      }
    }
    return index;
  };

  mix = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (args.length > 1) {
      args = args.sort(sort);
    } else {
      args[0].value = parseIfEasing(args[0]);
    }
    return function(progress) {
      var index, value;
      index = getNearest(args, progress);
      if (index !== -1) {
        value = args[index].value;
        if (index === args.length - 1 && progress > args[index].to) {
          return 1;
        }
        if (typeof value === 'function') {
          return value(progress);
        } else {
          return value;
        }
      }
    };
  };

  create = function(e) {
    easing = e;
    return mix;
  };

  module.exports = create;

}).call(this);

},{}],6:[function(require,module,exports){
(function() {
  var PathEasing, h;

  h = require('../h');

  PathEasing = (function() {
    PathEasing.prototype._vars = function() {
      this._precompute = h.clamp(this.o.precompute || 1450, 100, 10000);
      this._step = 1 / this._precompute;
      this._rect = this.o.rect || 100;
      this._approximateMax = this.o.approximateMax || 5;
      this._eps = this.o.eps || 0.001;
      return this._boundsPrevProgress = -1;
    };

    function PathEasing(path, o) {
      this.o = o != null ? o : {};
      if (path === 'creator') {
        return;
      }
      this.path = h.parsePath(path);
      if (this.path == null) {
        return h.error('Error while parsing the path');
      }
      this._vars();
      this.path.setAttribute('d', this._normalizePath(this.path.getAttribute('d')));
      this.pathLength = this.path.getTotalLength();
      this.sample = h.bind(this.sample, this);
      this._hardSample = h.bind(this._hardSample, this);
      this._preSample();
      this;
    }

    PathEasing.prototype._preSample = function() {
      var i, length, point, progress, _i, _ref, _results;
      this._samples = [];
      _results = [];
      for (i = _i = 0, _ref = this._precompute; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        progress = i * this._step;
        length = this.pathLength * progress;
        point = this.path.getPointAtLength(length);
        _results.push(this._samples[i] = {
          point: point,
          length: length,
          progress: progress
        });
      }
      return _results;
    };

    PathEasing.prototype._findBounds = function(array, p) {
      var buffer, direction, end, i, len, loopEnd, pointP, pointX, start, value, _i, _ref;
      if (p === this._boundsPrevProgress) {
        return this._prevBounds;
      }
      if (this._boundsStartIndex == null) {
        this._boundsStartIndex = 0;
      }
      len = array.length;
      if (this._boundsPrevProgress > p) {
        loopEnd = 0;
        direction = 'reverse';
      } else {
        loopEnd = len;
        direction = 'forward';
      }
      if (direction === 'forward') {
        start = array[0];
        end = array[array.length - 1];
      } else {
        start = array[array.length - 1];
        end = array[0];
      }
      for (i = _i = _ref = this._boundsStartIndex; _ref <= loopEnd ? _i < loopEnd : _i > loopEnd; i = _ref <= loopEnd ? ++_i : --_i) {
        value = array[i];
        pointX = value.point.x / this._rect;
        pointP = p;
        if (direction === 'reverse') {
          buffer = pointX;
          pointX = pointP;
          pointP = buffer;
        }
        if (pointX < pointP) {
          start = value;
          this._boundsStartIndex = i;
        } else {
          end = value;
          break;
        }
      }
      this._boundsPrevProgress = p;
      return this._prevBounds = {
        start: start,
        end: end
      };
    };

    PathEasing.prototype.sample = function(p) {
      var bounds, res;
      p = h.clamp(p, 0, 1);
      bounds = this._findBounds(this._samples, p);
      res = this._checkIfBoundsCloseEnough(p, bounds);
      if (res != null) {
        return res;
      }
      return this._findApproximate(p, bounds.start, bounds.end);
    };

    PathEasing.prototype._checkIfBoundsCloseEnough = function(p, bounds) {
      var point, y;
      point = void 0;
      y = this._checkIfPointCloseEnough(p, bounds.start.point);
      if (y != null) {
        return y;
      }
      return this._checkIfPointCloseEnough(p, bounds.end.point);
    };

    PathEasing.prototype._checkIfPointCloseEnough = function(p, point) {
      if (h.closeEnough(p, point.x / this._rect, this._eps)) {
        return this._resolveY(point);
      }
    };

    PathEasing.prototype._approximate = function(start, end, p) {
      var deltaP, percentP;
      deltaP = end.point.x - start.point.x;
      percentP = (p - (start.point.x / this._rect)) / (deltaP / this._rect);
      return start.length + percentP * (end.length - start.length);
    };

    PathEasing.prototype._findApproximate = function(p, start, end, approximateMax) {
      var approximation, args, newPoint, point, x;
      if (approximateMax == null) {
        approximateMax = this._approximateMax;
      }
      approximation = this._approximate(start, end, p);
      point = this.path.getPointAtLength(approximation);
      x = point.x / this._rect;
      if (h.closeEnough(p, x, this._eps)) {
        return this._resolveY(point);
      } else {
        if (--approximateMax < 1) {
          return this._resolveY(point);
        }
        newPoint = {
          point: point,
          length: approximation
        };
        args = p < x ? [p, start, newPoint, approximateMax] : [p, newPoint, end, approximateMax];
        return this._findApproximate.apply(this, args);
      }
    };

    PathEasing.prototype._resolveY = function(point) {
      return 1 - (point.y / this._rect);
    };

    PathEasing.prototype._normalizePath = function(path) {
      var commands, endIndex, normalizedPath, points, startIndex, svgCommandsRegexp;
      svgCommandsRegexp = /[M|L|H|V|C|S|Q|T|A]/gim;
      points = path.split(svgCommandsRegexp);
      points.shift();
      commands = path.match(svgCommandsRegexp);
      startIndex = 0;
      points[startIndex] = this._normalizeSegment(points[startIndex]);
      endIndex = points.length - 1;
      points[endIndex] = this._normalizeSegment(points[endIndex], this._rect || 100);
      return normalizedPath = this._joinNormalizedPath(commands, points);
    };

    PathEasing.prototype._joinNormalizedPath = function(commands, points) {
      var command, i, normalizedPath, space, _i, _len;
      normalizedPath = '';
      for (i = _i = 0, _len = commands.length; _i < _len; i = ++_i) {
        command = commands[i];
        space = i === 0 ? '' : ' ';
        normalizedPath += "" + space + command + (points[i].trim());
      }
      return normalizedPath;
    };

    PathEasing.prototype._normalizeSegment = function(segment, value) {
      var i, lastPoint, nRgx, pairs, parsedX, point, space, x, _i, _len;
      if (value == null) {
        value = 0;
      }
      segment = segment.trim();
      nRgx = /(-|\+)?((\d+(\.(\d|\e(-|\+)?)+)?)|(\.?(\d|\e|(\-|\+))+))/gim;
      pairs = this._getSegmentPairs(segment.match(nRgx));
      lastPoint = pairs[pairs.length - 1];
      x = lastPoint[0];
      parsedX = Number(x);
      if (parsedX !== value) {
        segment = '';
        lastPoint[0] = value;
        for (i = _i = 0, _len = pairs.length; _i < _len; i = ++_i) {
          point = pairs[i];
          space = i === 0 ? '' : ' ';
          segment += "" + space + point[0] + "," + point[1];
        }
      }
      return segment;
    };

    PathEasing.prototype._getSegmentPairs = function(array) {
      var i, newArray, pair, value, _i, _len;
      if (array.length % 2 !== 0) {
        h.error('Failed to parse the path - segment pairs are not even.', array);
      }
      newArray = [];
      for (i = _i = 0, _len = array.length; _i < _len; i = _i += 2) {
        value = array[i];
        pair = [array[i], array[i + 1]];
        newArray.push(pair);
      }
      return newArray;
    };

    PathEasing.prototype.create = function(path, o) {
      var handler;
      handler = new PathEasing(path, o);
      handler.sample.path = handler.path;
      return handler.sample;
    };

    return PathEasing;

  })();

  module.exports = PathEasing;

}).call(this);

},{"../h":7}],7:[function(require,module,exports){
(function() {
  var Helpers, h;

  Helpers = (function() {
    Helpers.prototype.NS = 'http://www.w3.org/2000/svg';

    Helpers.prototype.logBadgeCss = 'background:#3A0839;color:#FF512F;border-radius:5px; padding: 1px 5px 2px; border: 1px solid #FF512F;';

    Helpers.prototype.shortColors = {
      transparent: 'rgba(0,0,0,0)',
      none: 'rgba(0,0,0,0)',
      aqua: 'rgb(0,255,255)',
      black: 'rgb(0,0,0)',
      blue: 'rgb(0,0,255)',
      fuchsia: 'rgb(255,0,255)',
      gray: 'rgb(128,128,128)',
      green: 'rgb(0,128,0)',
      lime: 'rgb(0,255,0)',
      maroon: 'rgb(128,0,0)',
      navy: 'rgb(0,0,128)',
      olive: 'rgb(128,128,0)',
      purple: 'rgb(128,0,128)',
      red: 'rgb(255,0,0)',
      silver: 'rgb(192,192,192)',
      teal: 'rgb(0,128,128)',
      white: 'rgb(255,255,255)',
      yellow: 'rgb(255,255,0)',
      orange: 'rgb(255,128,0)'
    };

    Helpers.prototype.chainOptionMap = {
      duration: 1,
      delay: 1,
      repeat: 1,
      easing: 1,
      yoyo: 1,
      onStart: 1,
      onComplete: 1,
      onCompleteChain: 1,
      onUpdate: 1,
      points: 1
    };

    Helpers.prototype.callbacksMap = {
      onStart: 1,
      onComplete: 1,
      onCompleteChain: 1,
      onUpdate: 1
    };

    Helpers.prototype.tweenOptionMap = {
      duration: 1,
      delay: 1,
      repeat: 1,
      easing: 1,
      yoyo: 1
    };

    Helpers.prototype.posPropsMap = {
      x: 1,
      y: 1,
      shiftX: 1,
      shiftY: 1,
      burstX: 1,
      burstY: 1,
      burstShiftX: 1,
      burstShiftY: 1
    };

    Helpers.prototype.strokeDashPropsMap = {
      strokeDasharray: 1,
      strokeDashoffset: 1
    };

    Helpers.prototype.RAD_TO_DEG = 180 / Math.PI;

    function Helpers() {
      this.vars();
    }

    Helpers.prototype.vars = function() {
      var ua;
      this.prefix = this.getPrefix();
      this.getRemBase();
      this.isFF = this.prefix.lowercase === 'moz';
      this.isIE = this.prefix.lowercase === 'ms';
      ua = navigator.userAgent;
      this.isOldOpera = ua.match(/presto/gim);
      this.isSafari = ua.indexOf('Safari') > -1;
      this.isChrome = ua.indexOf('Chrome') > -1;
      this.isOpera = ua.toLowerCase().indexOf("op") > -1;
      this.isChrome && this.isSafari && (this.isSafari = false);
      (ua.match(/PhantomJS/gim)) && (this.isSafari = false);
      this.isChrome && this.isOpera && (this.isChrome = false);
      this.is3d = this.checkIf3d();
      this.uniqIDs = -1;
      this.div = document.createElement('div');
      return document.body.appendChild(this.div);
    };

    Helpers.prototype.cloneObj = function(obj, exclude) {
      var i, key, keys, newObj;
      keys = Object.keys(obj);
      newObj = {};
      i = keys.length;
      while (i--) {
        key = keys[i];
        if (exclude != null) {
          if (!exclude[key]) {
            newObj[key] = obj[key];
          }
        } else {
          newObj[key] = obj[key];
        }
      }
      return newObj;
    };

    Helpers.prototype.extend = function(objTo, objFrom) {
      var key, value;
      for (key in objFrom) {
        value = objFrom[key];
        if (objTo[key] == null) {
          objTo[key] = objFrom[key];
        }
      }
      return objTo;
    };

    Helpers.prototype.getRemBase = function() {
      var html, style;
      html = document.querySelector('html');
      style = getComputedStyle(html);
      return this.remBase = parseFloat(style.fontSize);
    };

    Helpers.prototype.clamp = function(value, min, max) {
      if (value < min) {
        return min;
      } else if (value > max) {
        return max;
      } else {
        return value;
      }
    };

    Helpers.prototype.setPrefixedStyle = function(el, name, value, isIt) {
      if (name.match(/transform/gim)) {
        el.style["" + name] = value;
        return el.style["" + this.prefix.css + name] = value;
      } else {
        return el.style[name] = value;
      }
    };

    Helpers.prototype.style = function(el, name, value) {
      var key, keys, len, _results;
      if (typeof name === 'object') {
        keys = Object.keys(name);
        len = keys.length;
        _results = [];
        while (len--) {
          key = keys[len];
          value = name[key];
          _results.push(this.setPrefixedStyle(el, key, value));
        }
        return _results;
      } else {
        return this.setPrefixedStyle(el, name, value);
      }
    };

    Helpers.prototype.prepareForLog = function(args) {
      args = Array.prototype.slice.apply(args);
      args.unshift('::');
      args.unshift(this.logBadgeCss);
      args.unshift('%cmo·js%c');
      return args;
    };

    Helpers.prototype.log = function() {
      if (mojs.isDebug === false) {
        return;
      }
      return console.log.apply(console, this.prepareForLog(arguments));
    };

    Helpers.prototype.warn = function() {
      if (mojs.isDebug === false) {
        return;
      }
      return console.warn.apply(console, this.prepareForLog(arguments));
    };

    Helpers.prototype.error = function() {
      if (mojs.isDebug === false) {
        return;
      }
      return console.error.apply(console, this.prepareForLog(arguments));
    };

    Helpers.prototype.parseUnit = function(value) {
      var amount, isStrict, regex, returnVal, unit, _ref;
      if (typeof value === 'number') {
        return returnVal = {
          unit: 'px',
          isStrict: false,
          value: value,
          string: "" + value + "px"
        };
      } else if (typeof value === 'string') {
        regex = /px|%|rem|em|ex|cm|ch|mm|in|pt|pc|vh|vw|vmin/gim;
        unit = (_ref = value.match(regex)) != null ? _ref[0] : void 0;
        isStrict = true;
        if (!unit) {
          unit = 'px';
          isStrict = false;
        }
        amount = parseFloat(value);
        return returnVal = {
          unit: unit,
          isStrict: isStrict,
          value: amount,
          string: "" + amount + unit
        };
      }
      return value;
    };

    Helpers.prototype.bind = function(func, context) {
      var bindArgs, wrapper;
      wrapper = function() {
        var args, unshiftArgs;
        args = Array.prototype.slice.call(arguments);
        unshiftArgs = bindArgs.concat(args);
        return func.apply(context, unshiftArgs);
      };
      bindArgs = Array.prototype.slice.call(arguments, 2);
      return wrapper;
    };

    Helpers.prototype.getRadialPoint = function(o) {
      var point, radAngle, radiusX, radiusY;
      if (o == null) {
        o = {};
      }
      if ((o.radius == null) || (o.angle == null) || (o.center == null)) {
        return;
      }
      radAngle = (o.angle - 90) * (Math.PI / 180);
      radiusX = o.radiusX != null ? o.radiusX : o.radius;
      radiusY = o.radiusY != null ? o.radiusY : o.radius;
      return point = {
        x: o.center.x + (Math.cos(radAngle) * radiusX),
        y: o.center.y + (Math.sin(radAngle) * radiusY)
      };
    };

    Helpers.prototype.getPrefix = function() {
      var dom, pre, styles, v;
      styles = window.getComputedStyle(document.documentElement, "");
      v = Array.prototype.slice.call(styles).join("").match(/-(moz|webkit|ms)-/);
      pre = (v || (styles.OLink === "" && ["", "o"]))[1];
      dom = "WebKit|Moz|MS|O".match(new RegExp("(" + pre + ")", "i"))[1];
      return {
        dom: dom,
        lowercase: pre,
        css: "-" + pre + "-",
        js: pre[0].toUpperCase() + pre.substr(1)
      };
    };

    Helpers.prototype.strToArr = function(string) {
      var arr;
      arr = [];
      if (typeof string === 'number' && !isNaN(string)) {
        arr.push(this.parseUnit(string));
        return arr;
      }
      string.trim().split(/\s+/gim).forEach((function(_this) {
        return function(str) {
          return arr.push(_this.parseUnit(_this.parseIfRand(str)));
        };
      })(this));
      return arr;
    };

    Helpers.prototype.calcArrDelta = function(arr1, arr2) {
      var delta, i, num, _i, _len;
      delta = [];
      for (i = _i = 0, _len = arr1.length; _i < _len; i = ++_i) {
        num = arr1[i];
        delta[i] = this.parseUnit("" + (arr2[i].value - arr1[i].value) + arr2[i].unit);
      }
      return delta;
    };

    Helpers.prototype.isArray = function(variable) {
      return variable instanceof Array;
    };

    Helpers.prototype.normDashArrays = function(arr1, arr2) {
      var arr1Len, arr2Len, currItem, i, lenDiff, startI, _i, _j;
      arr1Len = arr1.length;
      arr2Len = arr2.length;
      if (arr1Len > arr2Len) {
        lenDiff = arr1Len - arr2Len;
        startI = arr2.length;
        for (i = _i = 0; 0 <= lenDiff ? _i < lenDiff : _i > lenDiff; i = 0 <= lenDiff ? ++_i : --_i) {
          currItem = i + startI;
          arr2.push(this.parseUnit("0" + arr1[currItem].unit));
        }
      } else if (arr2Len > arr1Len) {
        lenDiff = arr2Len - arr1Len;
        startI = arr1.length;
        for (i = _j = 0; 0 <= lenDiff ? _j < lenDiff : _j > lenDiff; i = 0 <= lenDiff ? ++_j : --_j) {
          currItem = i + startI;
          arr1.push(this.parseUnit("0" + arr2[currItem].unit));
        }
      }
      return [arr1, arr2];
    };

    Helpers.prototype.makeColorObj = function(color) {
      var alpha, b, colorObj, g, isRgb, r, regexString1, regexString2, result, rgbColor;
      if (color[0] === '#') {
        result = /^#?([a-f\d]{1,2})([a-f\d]{1,2})([a-f\d]{1,2})$/i.exec(color);
        colorObj = {};
        if (result) {
          r = result[1].length === 2 ? result[1] : result[1] + result[1];
          g = result[2].length === 2 ? result[2] : result[2] + result[2];
          b = result[3].length === 2 ? result[3] : result[3] + result[3];
          colorObj = {
            r: parseInt(r, 16),
            g: parseInt(g, 16),
            b: parseInt(b, 16),
            a: 1
          };
        }
      }
      if (color[0] !== '#') {
        isRgb = color[0] === 'r' && color[1] === 'g' && color[2] === 'b';
        if (isRgb) {
          rgbColor = color;
        }
        if (!isRgb) {
          rgbColor = !this.shortColors[color] ? (this.div.style.color = color, this.computedStyle(this.div).color) : this.shortColors[color];
        }
        regexString1 = '^rgba?\\((\\d{1,3}),\\s?(\\d{1,3}),';
        regexString2 = '\\s?(\\d{1,3}),?\\s?(\\d{1}|0?\\.\\d{1,})?\\)$';
        result = new RegExp(regexString1 + regexString2, 'gi').exec(rgbColor);
        colorObj = {};
        alpha = parseFloat(result[4] || 1);
        if (result) {
          colorObj = {
            r: parseInt(result[1], 10),
            g: parseInt(result[2], 10),
            b: parseInt(result[3], 10),
            a: (alpha != null) && !isNaN(alpha) ? alpha : 1
          };
        }
      }
      return colorObj;
    };

    Helpers.prototype.computedStyle = function(el) {
      return getComputedStyle(el);
    };

    Helpers.prototype.capitalize = function(str) {
      if (typeof str !== 'string') {
        throw Error('String expected - nothing to capitalize');
      }
      return str.charAt(0).toUpperCase() + str.substring(1);
    };

    Helpers.prototype.parseRand = function(string) {
      var rand, randArr, units;
      randArr = string.split(/rand\(|\,|\)/);
      units = this.parseUnit(randArr[2]);
      rand = this.rand(parseFloat(randArr[1]), parseFloat(randArr[2]));
      if (units.unit && randArr[2].match(units.unit)) {
        return rand + units.unit;
      } else {
        return rand;
      }
    };

    Helpers.prototype.parseStagger = function(string, index) {
      var base, number, splittedValue, unit, unitValue, value;
      value = string.split(/stagger\(|\)$/)[1].toLowerCase();
      splittedValue = value.split(/(rand\(.*?\)|[^\(,\s]+)(?=\s*,|\s*$)/gim);
      value = splittedValue.length > 3 ? (base = this.parseUnit(this.parseIfRand(splittedValue[1])), splittedValue[3]) : (base = this.parseUnit(0), splittedValue[1]);
      value = this.parseIfRand(value);
      unitValue = this.parseUnit(value);
      number = index * unitValue.value + base.value;
      unit = base.isStrict ? base.unit : unitValue.isStrict ? unitValue.unit : '';
      if (unit) {
        return "" + number + unit;
      } else {
        return number;
      }
    };

    Helpers.prototype.parseIfStagger = function(value, i) {
      if (!(typeof value === 'string' && value.match(/stagger/g))) {
        return value;
      } else {
        return this.parseStagger(value, i);
      }
    };

    Helpers.prototype.parseIfRand = function(str) {
      if (typeof str === 'string' && str.match(/rand\(/)) {
        return this.parseRand(str);
      } else {
        return str;
      }
    };

    Helpers.prototype.parseDelta = function(key, value) {
      var delta, end, endArr, endColorObj, i, start, startArr, startColorObj, _i, _len;
      start = Object.keys(value)[0];
      end = value[start];
      delta = {
        start: start
      };
      if (isNaN(parseFloat(start)) && !start.match(/rand\(/)) {
        if (key === 'strokeLinecap') {
          this.warn("Sorry, stroke-linecap property is not animatable yet, using the start(" + start + ") value instead", value);
          return delta;
        }
        startColorObj = this.makeColorObj(start);
        endColorObj = this.makeColorObj(end);
        delta = {
          start: startColorObj,
          end: endColorObj,
          type: 'color',
          delta: {
            r: endColorObj.r - startColorObj.r,
            g: endColorObj.g - startColorObj.g,
            b: endColorObj.b - startColorObj.b,
            a: endColorObj.a - startColorObj.a
          }
        };
      } else if (key === 'strokeDasharray' || key === 'strokeDashoffset') {
        startArr = this.strToArr(start);
        endArr = this.strToArr(end);
        this.normDashArrays(startArr, endArr);
        for (i = _i = 0, _len = startArr.length; _i < _len; i = ++_i) {
          start = startArr[i];
          end = endArr[i];
          this.mergeUnits(start, end, key);
        }
        delta = {
          start: startArr,
          end: endArr,
          delta: this.calcArrDelta(startArr, endArr),
          type: 'array'
        };
      } else {
        if (!this.chainOptionMap[key]) {
          if (this.posPropsMap[key]) {
            end = this.parseUnit(this.parseIfRand(end));
            start = this.parseUnit(this.parseIfRand(start));
            this.mergeUnits(start, end, key);
            delta = {
              start: start,
              end: end,
              delta: end.value - start.value,
              type: 'unit'
            };
          } else {
            end = parseFloat(this.parseIfRand(end));
            start = parseFloat(this.parseIfRand(start));
            delta = {
              start: start,
              end: end,
              delta: end - start,
              type: 'number'
            };
          }
        }
      }
      return delta;
    };

    Helpers.prototype.mergeUnits = function(start, end, key) {
      if (!end.isStrict && start.isStrict) {
        end.unit = start.unit;
        return end.string = "" + end.value + end.unit;
      } else if (end.isStrict && !start.isStrict) {
        start.unit = end.unit;
        return start.string = "" + start.value + start.unit;
      } else if (end.isStrict && start.isStrict) {
        if (end.unit !== start.unit) {
          start.unit = end.unit;
          start.string = "" + start.value + start.unit;
          return this.warn("Two different units were specified on \"" + key + "\" delta property, mo · js will fallback to end \"" + end.unit + "\" unit ");
        }
      }
    };

    Helpers.prototype.rand = function(min, max) {
      return (Math.random() * (max - min)) + min;
    };

    Helpers.prototype.isDOM = function(o) {
      var isNode;
      if (o == null) {
        return false;
      }
      isNode = typeof o.nodeType === 'number' && typeof o.nodeName === 'string';
      return typeof o === 'object' && isNode;
    };

    Helpers.prototype.getChildElements = function(element) {
      var childNodes, children, i;
      childNodes = element.childNodes;
      children = [];
      i = childNodes.length;
      while (i--) {
        if (childNodes[i].nodeType === 1) {
          children.unshift(childNodes[i]);
        }
      }
      return children;
    };

    Helpers.prototype.delta = function(start, end) {
      var isType1, isType2, obj, type1, type2;
      type1 = typeof start;
      type2 = typeof end;
      isType1 = type1 === 'string' || type1 === 'number' && !isNaN(start);
      isType2 = type2 === 'string' || type2 === 'number' && !isNaN(end);
      if (!isType1 || !isType2) {
        this.error("delta method expects Strings or Numbers at input but got - " + start + ", " + end);
        return;
      }
      obj = {};
      obj[start] = end;
      return obj;
    };

    Helpers.prototype.getUniqID = function() {
      return ++this.uniqIDs;
    };

    Helpers.prototype.parsePath = function(path) {
      var domPath;
      if (typeof path === 'string') {
        if (path.charAt(0).toLowerCase() === 'm') {
          domPath = document.createElementNS(this.NS, 'path');
          domPath.setAttributeNS(null, 'd', path);
          return domPath;
        } else {
          return document.querySelector(path);
        }
      }
      if (path.style) {
        return path;
      }
    };

    Helpers.prototype.closeEnough = function(num1, num2, eps) {
      return Math.abs(num1 - num2) < eps;
    };

    Helpers.prototype.checkIf3d = function() {
      var div, prefixed, style, tr;
      div = document.createElement('div');
      this.style(div, 'transform', 'translateZ(0)');
      style = div.style;
      prefixed = "" + this.prefix.css + "transform";
      tr = style[prefixed] != null ? style[prefixed] : style.transform;
      return tr !== '';
    };

    return Helpers;

  })();

  h = new Helpers;

  module.exports = h;

}).call(this);

},{}],8:[function(require,module,exports){
(function() {
  window.mojs = {
    revision: '0.147.4',
    isDebug: true,
    helpers: require('./h'),
    Bit: require('./shapes/bit'),
    bitsMap: require('./shapes/bitsMap'),
    Circle: require('./shapes/circle'),
    Cross: require('./shapes/cross'),
    Line: require('./shapes/line'),
    Rect: require('./shapes/rect'),
    Polygon: require('./shapes/polygon'),
    Equal: require('./shapes/equal'),
    Zigzag: require('./shapes/zigzag'),
    Burst: require('./burst'),
    Transit: require('./transit'),
    Swirl: require('./swirl'),
    Stagger: require('./stagger'),
    Spriter: require('./spriter'),
    MotionPath: require('./motion-path'),
    Tween: require('./tween/tween'),
    Timeline: require('./tween/timeline'),
    tweener: require('./tween/tweener'),
    easing: require('./easing/easing')
  };

  mojs.h = mojs.helpers;

  mojs.delta = mojs.h.delta;


  /* istanbul ignore next */

  if ((typeof define === "function") && define.amd) {
    define("mojs", [], function() {
      return mojs;
    });
  }


  /* istanbul ignore next */

  if ((typeof module === "object") && (typeof module.exports === "object")) {
    module.exports = mojs;
  }

}).call(this);

},{"./burst":2,"./easing/easing":4,"./h":7,"./motion-path":9,"./shapes/bit":12,"./shapes/bitsMap":13,"./shapes/circle":14,"./shapes/cross":15,"./shapes/equal":16,"./shapes/line":17,"./shapes/polygon":18,"./shapes/rect":19,"./shapes/zigzag":20,"./spriter":21,"./stagger":22,"./swirl":23,"./transit":24,"./tween/timeline":25,"./tween/tween":26,"./tween/tweener":27}],9:[function(require,module,exports){
(function() {
  var MotionPath, Timeline, Tween, h, resize,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  h = require('./h');

  resize = require('./vendor/resize');

  Tween = require('./tween/tween');

  Timeline = require('./tween/timeline');

  MotionPath = (function() {
    MotionPath.prototype.defaults = {
      path: null,
      curvature: {
        x: '75%',
        y: '50%'
      },
      isCompositeLayer: true,
      delay: 0,
      duration: 1000,
      easing: null,
      repeat: 0,
      yoyo: false,
      offsetX: 0,
      offsetY: 0,
      angleOffset: null,
      pathStart: 0,
      pathEnd: 1,
      motionBlur: 0,
      transformOrigin: null,
      isAngle: false,
      isReverse: false,
      isRunLess: false,
      isPresetPosition: true,
      onStart: null,
      onComplete: null,
      onUpdate: null
    };

    function MotionPath(o) {
      this.o = o != null ? o : {};
      this.calcHeight = __bind(this.calcHeight, this);
      if (this.vars()) {
        return;
      }
      this.createTween();
      this;
    }

    MotionPath.prototype.vars = function() {
      this.getScaler = h.bind(this.getScaler, this);
      this.resize = resize;
      this.props = h.cloneObj(this.defaults);
      this.extendOptions(this.o);
      this.isMotionBlurReset = h.isSafari || h.isIE;
      this.isMotionBlurReset && (this.props.motionBlur = 0);
      this.history = [h.cloneObj(this.props)];
      return this.postVars();
    };

    MotionPath.prototype.curveToPath = function(o) {
      var angle, curvature, curvatureX, curvatureY, curvePoint, curveXPoint, dX, dY, endPoint, path, percent, radius, start;
      path = document.createElementNS(h.NS, 'path');
      start = o.start;
      endPoint = {
        x: start.x + o.shift.x,
        y: start.x + o.shift.y
      };
      curvature = o.curvature;
      dX = o.shift.x;
      dY = o.shift.y;
      radius = Math.sqrt(dX * dX + dY * dY);
      percent = radius / 100;
      angle = Math.atan(dY / dX) * (180 / Math.PI) + 90;
      if (o.shift.x < 0) {
        angle = angle + 180;
      }
      curvatureX = h.parseUnit(curvature.x);
      curvatureX = curvatureX.unit === '%' ? curvatureX.value * percent : curvatureX.value;
      curveXPoint = h.getRadialPoint({
        center: {
          x: start.x,
          y: start.y
        },
        radius: curvatureX,
        angle: angle
      });
      curvatureY = h.parseUnit(curvature.y);
      curvatureY = curvatureY.unit === '%' ? curvatureY.value * percent : curvatureY.value;
      curvePoint = h.getRadialPoint({
        center: {
          x: curveXPoint.x,
          y: curveXPoint.y
        },
        radius: curvatureY,
        angle: angle + 90
      });
      path.setAttribute('d', "M" + start.x + "," + start.y + " Q" + curvePoint.x + "," + curvePoint.y + " " + endPoint.x + "," + endPoint.y);
      return path;
    };

    MotionPath.prototype.postVars = function() {
      this.props.pathStart = h.clamp(this.props.pathStart, 0, 1);
      this.props.pathEnd = h.clamp(this.props.pathEnd, this.props.pathStart, 1);
      this.angle = 0;
      this.speedX = 0;
      this.speedY = 0;
      this.blurX = 0;
      this.blurY = 0;
      this.prevCoords = {};
      this.blurAmount = 20;
      this.props.motionBlur = h.clamp(this.props.motionBlur, 0, 1);
      this.onUpdate = this.props.onUpdate;
      if (!this.o.el) {
        h.error('Missed "el" option. It could be a selector, DOMNode or another module.');
        return true;
      }
      this.el = this.parseEl(this.props.el);
      this.props.motionBlur > 0 && this.createFilter();
      this.path = this.getPath();
      if (!this.path.getAttribute('d')) {
        h.error('Path has no coordinates to work with, aborting');
        return true;
      }
      this.len = this.path.getTotalLength();
      this.slicedLen = this.len * (this.props.pathEnd - this.props.pathStart);
      this.startLen = this.props.pathStart * this.len;
      this.fill = this.props.fill;
      if (this.fill != null) {
        this.container = this.parseEl(this.props.fill.container);
        this.fillRule = this.props.fill.fillRule || 'all';
        this.getScaler();
        if (this.container != null) {
          this.removeEvent(this.container, 'onresize', this.getScaler);
          return this.addEvent(this.container, 'onresize', this.getScaler);
        }
      }
    };

    MotionPath.prototype.addEvent = function(el, type, handler) {
      return el.addEventListener(type, handler, false);
    };

    MotionPath.prototype.removeEvent = function(el, type, handler) {
      return el.removeEventListener(type, handler, false);
    };

    MotionPath.prototype.createFilter = function() {
      var div, svg;
      div = document.createElement('div');
      this.filterID = "filter-" + (h.getUniqID());
      div.innerHTML = "<svg id=\"svg-" + this.filterID + "\"\n    style=\"visibility:hidden; width:0px; height:0px\">\n  <filter id=\"" + this.filterID + "\" y=\"-20\" x=\"-20\" width=\"40\" height=\"40\">\n    <feOffset\n      id=\"blur-offset\" in=\"SourceGraphic\"\n      dx=\"0\" dy=\"0\" result=\"offset2\"></feOffset>\n    <feGaussianblur\n      id=\"blur\" in=\"offset2\"\n      stdDeviation=\"0,0\" result=\"blur2\"></feGaussianblur>\n    <feMerge>\n      <feMergeNode in=\"SourceGraphic\"></feMergeNode>\n      <feMergeNode in=\"blur2\"></feMergeNode>\n    </feMerge>\n  </filter>\n</svg>";
      svg = div.querySelector("#svg-" + this.filterID);
      this.filter = svg.querySelector('#blur');
      this.filterOffset = svg.querySelector('#blur-offset');
      document.body.insertBefore(svg, document.body.firstChild);
      this.el.style['filter'] = "url(#" + this.filterID + ")";
      return this.el.style["" + h.prefix.css + "filter"] = "url(#" + this.filterID + ")";
    };

    MotionPath.prototype.parseEl = function(el) {
      if (typeof el === 'string') {
        return document.querySelector(el);
      }
      if (el instanceof HTMLElement) {
        return el;
      }
      if (el.setProp != null) {
        this.isModule = true;
        return el;
      }
    };

    MotionPath.prototype.getPath = function() {
      var path;
      path = h.parsePath(this.props.path);
      if (path) {
        return path;
      }
      if (this.props.path.x || this.props.path.y) {
        return this.curveToPath({
          start: {
            x: 0,
            y: 0
          },
          shift: {
            x: this.props.path.x || 0,
            y: this.props.path.y || 0
          },
          curvature: {
            x: this.props.curvature.x || this.defaults.curvature.x,
            y: this.props.curvature.y || this.defaults.curvature.y
          }
        });
      }
    };

    MotionPath.prototype.getScaler = function() {
      var end, size, start;
      this.cSize = {
        width: this.container.offsetWidth || 0,
        height: this.container.offsetHeight || 0
      };
      start = this.path.getPointAtLength(0);
      end = this.path.getPointAtLength(this.len);
      size = {};
      this.scaler = {};
      size.width = end.x >= start.x ? end.x - start.x : start.x - end.x;
      size.height = end.y >= start.y ? end.y - start.y : start.y - end.y;
      switch (this.fillRule) {
        case 'all':
          this.calcWidth(size);
          return this.calcHeight(size);
        case 'width':
          this.calcWidth(size);
          return this.scaler.y = this.scaler.x;
        case 'height':
          this.calcHeight(size);
          return this.scaler.x = this.scaler.y;
      }
    };

    MotionPath.prototype.calcWidth = function(size) {
      this.scaler.x = this.cSize.width / size.width;
      return !isFinite(this.scaler.x) && (this.scaler.x = 1);
    };

    MotionPath.prototype.calcHeight = function(size) {
      this.scaler.y = this.cSize.height / size.height;
      return !isFinite(this.scaler.y) && (this.scaler.y = 1);
    };

    MotionPath.prototype.run = function(o) {
      var fistItem, key, value;
      if (o) {
        fistItem = this.history[0];
        for (key in o) {
          value = o[key];
          if (h.callbacksMap[key] || h.tweenOptionMap[key]) {
            h.warn("the property \"" + key + "\" property can not be overridden on run yet");
            delete o[key];
          } else {
            this.history[0][key] = value;
          }
        }
        this.tuneOptions(o);
      }
      return this.startTween();
    };

    MotionPath.prototype.createTween = function() {
      this.tween = new Tween({
        duration: this.props.duration,
        delay: this.props.delay,
        yoyo: this.props.yoyo,
        repeat: this.props.repeat,
        easing: this.props.easing,
        onStart: (function(_this) {
          return function() {
            var _ref;
            return (_ref = _this.props.onStart) != null ? _ref.apply(_this) : void 0;
          };
        })(this),
        onComplete: (function(_this) {
          return function() {
            var _ref;
            _this.props.motionBlur && _this.setBlur({
              blur: {
                x: 0,
                y: 0
              },
              offset: {
                x: 0,
                y: 0
              }
            });
            return (_ref = _this.props.onComplete) != null ? _ref.apply(_this) : void 0;
          };
        })(this),
        onUpdate: (function(_this) {
          return function(p) {
            return _this.setProgress(p);
          };
        })(this),
        onFirstUpdateBackward: (function(_this) {
          return function() {
            return _this.history.length > 1 && _this.tuneOptions(_this.history[0]);
          };
        })(this)
      });
      this.timeline = new Timeline;
      this.timeline.add(this.tween);
      !this.props.isRunLess && this.startTween();
      return this.props.isPresetPosition && this.setProgress(0, true);
    };

    MotionPath.prototype.startTween = function() {
      return setTimeout(((function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.timeline) != null ? _ref.start() : void 0;
        };
      })(this)), 1);
    };

    MotionPath.prototype.setProgress = function(p, isInit) {
      var len, point, x, y;
      len = this.startLen + (!this.props.isReverse ? p * this.slicedLen : (1 - p) * this.slicedLen);
      point = this.path.getPointAtLength(len);
      x = point.x + this.props.offsetX;
      y = point.y + this.props.offsetY;
      this._getCurrentAngle(point, len, p);
      this._setTransformOrigin(p);
      this._setTransform(x, y, p, isInit);
      return this.props.motionBlur && this.makeMotionBlur(x, y);
    };

    MotionPath.prototype.setElPosition = function(x, y, p) {
      var composite, isComposite, rotate, transform;
      rotate = this.angle !== 0 ? "rotate(" + this.angle + "deg)" : '';
      isComposite = this.props.isCompositeLayer && h.is3d;
      composite = isComposite ? 'translateZ(0)' : '';
      transform = "translate(" + x + "px," + y + "px) " + rotate + " " + composite;
      return h.setPrefixedStyle(this.el, 'transform', transform);
    };

    MotionPath.prototype.setModulePosition = function(x, y) {
      this.el.setProp({
        shiftX: "" + x + "px",
        shiftY: "" + y + "px",
        angle: this.angle
      });
      return this.el.draw();
    };

    MotionPath.prototype._getCurrentAngle = function(point, len, p) {
      var atan, isTransformFunOrigin, prevPoint, x1, x2;
      isTransformFunOrigin = typeof this.props.transformOrigin === 'function';
      if (this.props.isAngle || (this.props.angleOffset != null) || isTransformFunOrigin) {
        prevPoint = this.path.getPointAtLength(len - 1);
        x1 = point.y - prevPoint.y;
        x2 = point.x - prevPoint.x;
        atan = Math.atan(x1 / x2);
        !isFinite(atan) && (atan = 0);
        this.angle = atan * h.RAD_TO_DEG;
        if ((typeof this.props.angleOffset) !== 'function') {
          return this.angle += this.props.angleOffset || 0;
        } else {
          return this.angle = this.props.angleOffset.call(this, this.angle, p);
        }
      } else {
        return this.angle = 0;
      }
    };

    MotionPath.prototype._setTransform = function(x, y, p, isInit) {
      var transform;
      if (this.scaler) {
        x *= this.scaler.x;
        y *= this.scaler.y;
      }
      transform = null;
      if (!isInit) {
        transform = typeof this.onUpdate === "function" ? this.onUpdate(p, {
          x: x,
          y: y,
          angle: this.angle
        }) : void 0;
      }
      if (this.isModule) {
        return this.setModulePosition(x, y);
      } else {
        if (typeof transform !== 'string') {
          return this.setElPosition(x, y, p);
        } else {
          return h.setPrefixedStyle(this.el, 'transform', transform);
        }
      }
    };

    MotionPath.prototype._setTransformOrigin = function(p) {
      var isTransformFunOrigin, tOrigin;
      if (this.props.transformOrigin) {
        isTransformFunOrigin = typeof this.props.transformOrigin === 'function';
        tOrigin = !isTransformFunOrigin ? this.props.transformOrigin : this.props.transformOrigin(this.angle, p);
        return h.setPrefixedStyle(this.el, 'transform-origin', tOrigin);
      }
    };

    MotionPath.prototype.makeMotionBlur = function(x, y) {
      var absoluteAngle, coords, dX, dY, signX, signY, tailAngle;
      tailAngle = 0;
      signX = 1;
      signY = 1;
      if ((this.prevCoords.x == null) || (this.prevCoords.y == null)) {
        this.speedX = 0;
        this.speedY = 0;
      } else {
        dX = x - this.prevCoords.x;
        dY = y - this.prevCoords.y;
        if (dX > 0) {
          signX = -1;
        }
        if (signX < 0) {
          signY = -1;
        }
        this.speedX = Math.abs(dX);
        this.speedY = Math.abs(dY);
        tailAngle = Math.atan(dY / dX) * (180 / Math.PI) + 90;
      }
      absoluteAngle = tailAngle - this.angle;
      coords = this.angToCoords(absoluteAngle);
      this.blurX = h.clamp((this.speedX / 16) * this.props.motionBlur, 0, 1);
      this.blurY = h.clamp((this.speedY / 16) * this.props.motionBlur, 0, 1);
      this.setBlur({
        blur: {
          x: 3 * this.blurX * this.blurAmount * Math.abs(coords.x),
          y: 3 * this.blurY * this.blurAmount * Math.abs(coords.y)
        },
        offset: {
          x: 3 * signX * this.blurX * coords.x * this.blurAmount,
          y: 3 * signY * this.blurY * coords.y * this.blurAmount
        }
      });
      this.prevCoords.x = x;
      return this.prevCoords.y = y;
    };

    MotionPath.prototype.setBlur = function(o) {
      if (!this.isMotionBlurReset) {
        this.filter.setAttribute('stdDeviation', "" + o.blur.x + "," + o.blur.y);
        this.filterOffset.setAttribute('dx', o.offset.x);
        return this.filterOffset.setAttribute('dy', o.offset.y);
      }
    };

    MotionPath.prototype.extendDefaults = function(o) {
      var key, value, _results;
      _results = [];
      for (key in o) {
        value = o[key];
        _results.push(this[key] = value);
      }
      return _results;
    };

    MotionPath.prototype.extendOptions = function(o) {
      var key, value, _results;
      _results = [];
      for (key in o) {
        value = o[key];
        _results.push(this.props[key] = value);
      }
      return _results;
    };

    MotionPath.prototype.then = function(o) {
      var it, key, opts, prevOptions, value;
      prevOptions = this.history[this.history.length - 1];
      opts = {};
      for (key in prevOptions) {
        value = prevOptions[key];
        if (!h.callbacksMap[key] && !h.tweenOptionMap[key] || key === 'duration') {
          if (o[key] == null) {
            o[key] = value;
          }
        } else {
          if (o[key] == null) {
            o[key] = void 0;
          }
        }
        if (h.tweenOptionMap[key]) {
          opts[key] = key !== 'duration' ? o[key] : o[key] != null ? o[key] : prevOptions[key];
        }
      }
      this.history.push(o);
      it = this;
      opts.onUpdate = (function(_this) {
        return function(p) {
          return _this.setProgress(p);
        };
      })(this);
      opts.onStart = (function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.props.onStart) != null ? _ref.apply(_this) : void 0;
        };
      })(this);
      opts.onComplete = (function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.props.onComplete) != null ? _ref.apply(_this) : void 0;
        };
      })(this);
      opts.onFirstUpdate = function() {
        return it.tuneOptions(it.history[this.index]);
      };
      opts.isChained = !o.delay;
      this.timeline.append(new Tween(opts));
      return this;
    };

    MotionPath.prototype.tuneOptions = function(o) {
      this.extendOptions(o);
      return this.postVars();
    };

    MotionPath.prototype.angToCoords = function(angle) {
      var radAngle, x, y;
      angle = angle % 360;
      radAngle = ((angle - 90) * Math.PI) / 180;
      x = Math.cos(radAngle);
      y = Math.sin(radAngle);
      x = x < 0 ? Math.max(x, -0.7) : Math.min(x, .7);
      y = y < 0 ? Math.max(y, -0.7) : Math.min(y, .7);
      return {
        x: x * 1.428571429,
        y: y * 1.428571429
      };
    };

    return MotionPath;

  })();

  module.exports = MotionPath;

}).call(this);

},{"./h":7,"./tween/timeline":25,"./tween/tween":26,"./vendor/resize":28}],10:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  (function(root) {
    var offset, _ref, _ref1;
    if (root.performance == null) {
      root.performance = {};
    }
    Date.now = Date.now || function() {
      return (new Date).getTime();
    };
    if (root.performance.now == null) {
      offset = ((_ref = root.performance) != null ? (_ref1 = _ref.timing) != null ? _ref1.navigationStart : void 0 : void 0) ? performance.timing.navigationStart : Date.now();
      return root.performance.now = function() {
        return Date.now() - offset;
      };
    }
  })(window);

}).call(this);

},{}],11:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  (function() {
    'use strict';
    var cancel, i, isOldBrowser, lastTime, vendors, vp, w;
    vendors = ['webkit', 'moz'];
    i = 0;
    w = window;
    while (i < vendors.length && !w.requestAnimationFrame) {
      vp = vendors[i];
      w.requestAnimationFrame = w[vp + 'RequestAnimationFrame'];
      cancel = w[vp + 'CancelAnimationFrame'];
      w.cancelAnimationFrame = cancel || w[vp + 'CancelRequestAnimationFrame'];
      ++i;
    }
    isOldBrowser = !w.requestAnimationFrame || !w.cancelAnimationFrame;
    if (/iP(ad|hone|od).*OS 6/.test(w.navigator.userAgent) || isOldBrowser) {
      lastTime = 0;
      w.requestAnimationFrame = function(callback) {
        var nextTime, now;
        now = Date.now();
        nextTime = Math.max(lastTime + 16, now);
        return setTimeout((function() {
          callback(lastTime = nextTime);
        }), nextTime - now);
      };
      w.cancelAnimationFrame = clearTimeout;
    }
  })();

}).call(this);

},{}],12:[function(require,module,exports){
(function() {
  var Bit, h;

  h = require('../h');

  Bit = (function() {
    Bit.prototype.ns = 'http://www.w3.org/2000/svg';

    Bit.prototype.type = 'line';

    Bit.prototype.ratio = 1;

    Bit.prototype.defaults = {
      radius: 50,
      radiusX: void 0,
      radiusY: void 0,
      points: 3,
      x: 0,
      y: 0,
      angle: 0,
      'stroke': 'hotpink',
      'stroke-width': 2,
      'stroke-opacity': 1,
      'fill': 'transparent',
      'fill-opacity': 1,
      'stroke-dasharray': '',
      'stroke-dashoffset': '',
      'stroke-linecap': ''
    };

    function Bit(o) {
      this.o = o != null ? o : {};
      this.init();
      this;
    }

    Bit.prototype.init = function() {
      this.vars();
      this.render();
      return this;
    };

    Bit.prototype.vars = function() {
      if (this.o.ctx && this.o.ctx.tagName === 'svg') {
        this.ctx = this.o.ctx;
      } else if (!this.o.el) {
        h.error('You should pass a real context(ctx) to the bit');
      }
      this.state = {};
      this.drawMapLength = this.drawMap.length;
      this.extendDefaults();
      return this.calcTransform();
    };

    Bit.prototype.calcTransform = function() {
      var rotate;
      rotate = "rotate(" + this.props.angle + ", " + this.props.x + ", " + this.props.y + ")";
      return this.props.transform = "" + rotate;
    };

    Bit.prototype.extendDefaults = function() {
      var key, value, _ref, _results;
      if (this.props == null) {
        this.props = {};
      }
      _ref = this.defaults;
      _results = [];
      for (key in _ref) {
        value = _ref[key];
        _results.push(this.props[key] = this.o[key] != null ? this.o[key] : value);
      }
      return _results;
    };

    Bit.prototype.setAttr = function(attr, value) {
      var el, key, keys, len, val, _results;
      if (typeof attr === 'object') {
        keys = Object.keys(attr);
        len = keys.length;
        el = value || this.el;
        _results = [];
        while (len--) {
          key = keys[len];
          val = attr[key];
          _results.push(el.setAttribute(key, val));
        }
        return _results;
      } else {
        return this.el.setAttribute(attr, value);
      }
    };

    Bit.prototype.setProp = function(attr, value) {
      var key, val, _results;
      if (typeof attr === 'object') {
        _results = [];
        for (key in attr) {
          val = attr[key];
          _results.push(this.props[key] = val);
        }
        return _results;
      } else {
        return this.props[attr] = value;
      }
    };

    Bit.prototype.render = function() {
      this.isRendered = true;
      if (this.o.el != null) {
        this.el = this.o.el;
        return this.isForeign = true;
      } else {
        this.el = document.createElementNS(this.ns, this.type || 'line');
        !this.o.isDrawLess && this.draw();
        return this.ctx.appendChild(this.el);
      }
    };

    Bit.prototype.drawMap = ['stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'fill', 'stroke-dashoffset', 'stroke-linecap', 'fill-opacity', 'transform'];

    Bit.prototype.draw = function() {
      var len, name;
      this.props.length = this.getLength();
      len = this.drawMapLength;
      while (len--) {
        name = this.drawMap[len];
        switch (name) {
          case 'stroke-dasharray':
          case 'stroke-dashoffset':
            this.castStrokeDash(name);
        }
        this.setAttrsIfChanged(name, this.props[name]);
      }
      return this.state.radius = this.props.radius;
    };

    Bit.prototype.castStrokeDash = function(name) {
      var cast, dash, i, stroke, _i, _len, _ref;
      if (h.isArray(this.props[name])) {
        stroke = '';
        _ref = this.props[name];
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          dash = _ref[i];
          cast = dash.unit === '%' ? this.castPercent(dash.value) : dash.value;
          stroke += "" + cast + " ";
        }
        this.props[name] = stroke === '0 ' ? stroke = '' : stroke;
        return this.props[name] = stroke;
      }
      if (typeof this.props[name] === 'object') {
        stroke = this.props[name].unit === '%' ? this.castPercent(this.props[name].value) : this.props[name].value;
        return this.props[name] = stroke === 0 ? stroke = '' : stroke;
      }
    };

    Bit.prototype.castPercent = function(percent) {
      return percent * (this.props.length / 100);
    };

    Bit.prototype.setAttrsIfChanged = function(name, value) {
      var key, keys, len, _results;
      if (typeof name === 'object') {
        keys = Object.keys(name);
        len = keys.length;
        _results = [];
        while (len--) {
          key = keys[len];
          value = name[key];
          _results.push(this.setAttrIfChanged(key, value));
        }
        return _results;
      } else {
        if (value == null) {
          value = this.props[name];
        }
        return this.setAttrIfChanged(name, value);
      }
    };

    Bit.prototype.setAttrIfChanged = function(name, value) {
      if (this.isChanged(name, value)) {
        this.el.setAttribute(name, value);
        return this.state[name] = value;
      }
    };

    Bit.prototype.isChanged = function(name, value) {
      if (value == null) {
        value = this.props[name];
      }
      return this.state[name] !== value;
    };

    Bit.prototype.getLength = function() {
      var _ref;
      if ((((_ref = this.el) != null ? _ref.getTotalLength : void 0) != null) && this.el.getAttribute('d')) {
        return this.el.getTotalLength();
      } else {
        return 2 * (this.props.radiusX != null ? this.props.radiusX : this.props.radius);
      }
    };

    return Bit;

  })();

  module.exports = Bit;

}).call(this);

},{"../h":7}],13:[function(require,module,exports){
(function() {
  var Bit, BitsMap, Circle, Cross, Equal, Line, Polygon, Rect, Zigzag, h;

  Bit = require('./bit');

  Circle = require('./circle');

  Line = require('./line');

  Zigzag = require('./zigzag');

  Rect = require('./rect');

  Polygon = require('./polygon');

  Cross = require('./cross');

  Equal = require('./equal');

  h = require('../h');

  BitsMap = (function() {
    function BitsMap() {}

    BitsMap.prototype.h = h;

    BitsMap.prototype.map = {
      bit: Bit,
      circle: Circle,
      line: Line,
      zigzag: Zigzag,
      rect: Rect,
      polygon: Polygon,
      cross: Cross,
      equal: Equal
    };

    BitsMap.prototype.getBit = function(name) {
      return this.map[name] || this.h.error("no \"" + name + "\" shape available yet, please choose from this list:", this.map);
    };

    return BitsMap;

  })();

  module.exports = new BitsMap;

}).call(this);

},{"../h":7,"./bit":12,"./circle":14,"./cross":15,"./equal":16,"./line":17,"./polygon":18,"./rect":19,"./zigzag":20}],14:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Circle,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Circle = (function(_super) {
    __extends(Circle, _super);

    function Circle() {
      return Circle.__super__.constructor.apply(this, arguments);
    }

    Circle.prototype.type = 'ellipse';

    Circle.prototype.draw = function() {
      var rx, ry;
      rx = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      ry = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      this.setAttrsIfChanged({
        rx: rx,
        ry: ry,
        cx: this.props.x,
        cy: this.props.y
      });
      return Circle.__super__.draw.apply(this, arguments);
    };

    Circle.prototype.getLength = function() {
      var radiusX, radiusY;
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      return 2 * Math.PI * Math.sqrt((Math.pow(radiusX, 2) + Math.pow(radiusY, 2)) / 2);
    };

    return Circle;

  })(Bit);

  module.exports = Circle;

}).call(this);

},{"./bit":12}],15:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Cross,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Cross = (function(_super) {
    __extends(Cross, _super);

    function Cross() {
      return Cross.__super__.constructor.apply(this, arguments);
    }

    Cross.prototype.type = 'path';

    Cross.prototype.draw = function() {
      var d, line1, line2, radiusX, radiusY, x1, x2, y1, y2;
      Cross.__super__.draw.apply(this, arguments);
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      x1 = this.props.x - radiusX;
      x2 = this.props.x + radiusX;
      line1 = "M" + x1 + "," + this.props.y + " L" + x2 + "," + this.props.y;
      y1 = this.props.y - radiusY;
      y2 = this.props.y + radiusY;
      line2 = "M" + this.props.x + "," + y1 + " L" + this.props.x + "," + y2;
      d = "" + line1 + " " + line2;
      return this.setAttr({
        d: d
      });
    };

    Cross.prototype.getLength = function() {
      var radiusX, radiusY;
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      return 2 * (radiusX + radiusY);
    };

    return Cross;

  })(Bit);

  module.exports = Cross;

}).call(this);

},{"./bit":12}],16:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Equal,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Equal = (function(_super) {
    __extends(Equal, _super);

    function Equal() {
      return Equal.__super__.constructor.apply(this, arguments);
    }

    Equal.prototype.type = 'path';

    Equal.prototype.ratio = 1.43;

    Equal.prototype.draw = function() {
      var d, i, radiusX, radiusY, x1, x2, y, yStart, yStep, _i, _ref;
      Equal.__super__.draw.apply(this, arguments);
      if (!this.props.points) {
        return;
      }
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      x1 = this.props.x - radiusX;
      x2 = this.props.x + radiusX;
      d = '';
      yStep = 2 * radiusY / (this.props.points - 1);
      yStart = this.props.y - radiusY;
      for (i = _i = 0, _ref = this.props.points; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        y = "" + (i * yStep + yStart);
        d += "M" + x1 + ", " + y + " L" + x2 + ", " + y + " ";
      }
      return this.setAttr({
        d: d
      });
    };

    Equal.prototype.getLength = function() {
      return 2 * (this.props.radiusX != null ? this.props.radiusX : this.props.radius);
    };

    return Equal;

  })(Bit);

  module.exports = Equal;

}).call(this);

},{"./bit":12}],17:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Line,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Line = (function(_super) {
    __extends(Line, _super);

    function Line() {
      return Line.__super__.constructor.apply(this, arguments);
    }

    Line.prototype.draw = function() {
      var radiusX;
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      this.setAttrsIfChanged({
        x1: this.props.x - radiusX,
        x2: this.props.x + radiusX,
        y1: this.props.y,
        y2: this.props.y
      });
      return Line.__super__.draw.apply(this, arguments);
    };

    return Line;

  })(Bit);

  module.exports = Line;

}).call(this);

},{"./bit":12}],18:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Polygon, h,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  h = require('../h');

  Polygon = (function(_super) {
    __extends(Polygon, _super);

    function Polygon() {
      return Polygon.__super__.constructor.apply(this, arguments);
    }

    Polygon.prototype.type = 'path';

    Polygon.prototype.draw = function() {
      this.drawShape();
      return Polygon.__super__.draw.apply(this, arguments);
    };

    Polygon.prototype.drawShape = function() {
      var char, d, i, point, step, _i, _j, _len, _ref, _ref1;
      step = 360 / this.props.points;
      this.radialPoints = [];
      for (i = _i = 0, _ref = this.props.points; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        this.radialPoints.push(h.getRadialPoint({
          radius: this.props.radius,
          radiusX: this.props.radiusX,
          radiusY: this.props.radiusY,
          angle: i * step,
          center: {
            x: this.props.x,
            y: this.props.y
          }
        }));
      }
      d = '';
      _ref1 = this.radialPoints;
      for (i = _j = 0, _len = _ref1.length; _j < _len; i = ++_j) {
        point = _ref1[i];
        char = i === 0 ? 'M' : 'L';
        d += "" + char + (point.x.toFixed(4)) + "," + (point.y.toFixed(4)) + " ";
      }
      return this.setAttr({
        d: d += 'z'
      });
    };

    Polygon.prototype.getLength = function() {
      return this.el.getTotalLength();
    };

    return Polygon;

  })(Bit);

  module.exports = Polygon;

}).call(this);

},{"../h":7,"./bit":12}],19:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Rect,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Rect = (function(_super) {
    __extends(Rect, _super);

    function Rect() {
      return Rect.__super__.constructor.apply(this, arguments);
    }

    Rect.prototype.type = 'rect';

    Rect.prototype.ratio = 1.43;

    Rect.prototype.draw = function() {
      var radiusX, radiusY;
      Rect.__super__.draw.apply(this, arguments);
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      return this.setAttrsIfChanged({
        width: 2 * radiusX,
        height: 2 * radiusY,
        x: this.props.x - radiusX,
        y: this.props.y - radiusY
      });
    };

    Rect.prototype.getLength = function() {
      var radiusX, radiusY;
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      return 2 * radiusX + 2 * radiusY;
    };

    return Rect;

  })(Bit);

  module.exports = Rect;

}).call(this);

},{"./bit":12}],20:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Bit, Zigzag,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Bit = require('./bit');

  Zigzag = (function(_super) {
    __extends(Zigzag, _super);

    function Zigzag() {
      return Zigzag.__super__.constructor.apply(this, arguments);
    }

    Zigzag.prototype.type = 'path';

    Zigzag.prototype.ratio = 1.43;

    Zigzag.prototype.draw = function() {
      var char, i, iX, iX2, iY, iY2, points, radiusX, radiusY, stepX, stepY, strokeWidth, xStart, yStart, _i, _ref;
      if (!this.props.points) {
        return;
      }
      radiusX = this.props.radiusX != null ? this.props.radiusX : this.props.radius;
      radiusY = this.props.radiusY != null ? this.props.radiusY : this.props.radius;
      points = '';
      stepX = 2 * radiusX / this.props.points;
      stepY = 2 * radiusY / this.props.points;
      strokeWidth = this.props['stroke-width'];
      xStart = this.props.x - radiusX;
      yStart = this.props.y - radiusY;
      for (i = _i = _ref = this.props.points; _ref <= 0 ? _i < 0 : _i > 0; i = _ref <= 0 ? ++_i : --_i) {
        iX = xStart + i * stepX + strokeWidth;
        iY = yStart + i * stepY + strokeWidth;
        iX2 = xStart + (i - 1) * stepX + strokeWidth;
        iY2 = yStart + (i - 1) * stepY + strokeWidth;
        char = i === this.props.points ? 'M' : 'L';
        points += "" + char + iX + "," + iY + " l0, -" + stepY + " l-" + stepX + ", 0";
      }
      this.setAttr({
        d: points
      });
      return Zigzag.__super__.draw.apply(this, arguments);
    };

    return Zigzag;

  })(Bit);

  module.exports = Zigzag;

}).call(this);

},{"./bit":12}],21:[function(require,module,exports){
(function() {
  var Spriter, Timeline, Tween, h;

  h = require('./h');

  Tween = require('./tween/tween');

  Timeline = require('./tween/timeline');

  Spriter = (function() {
    Spriter.prototype._defaults = {
      duration: 500,
      delay: 0,
      easing: 'linear.none',
      repeat: 0,
      yoyo: false,
      isRunLess: false,
      isShowEnd: false,
      onStart: null,
      onUpdate: null,
      onComplete: null
    };

    function Spriter(o) {
      this.o = o != null ? o : {};
      if (this.o.el == null) {
        return h.error('No "el" option specified, aborting');
      }
      this._vars();
      this._extendDefaults();
      this._parseFrames();
      if (this._frames.length <= 2) {
        h.warn("Spriter: only " + this._frames.length + " frames found");
      }
      if (this._frames.length < 1) {
        h.error("Spriter: there is no frames to animate, aborting");
      }
      this._createTween();
      this;
    }

    Spriter.prototype._vars = function() {
      this._props = h.cloneObj(this.o);
      this.el = this.o.el;
      return this._frames = [];
    };

    Spriter.prototype.run = function(o) {
      return this._timeline.start();
    };

    Spriter.prototype._extendDefaults = function() {
      return h.extend(this._props, this._defaults);
    };

    Spriter.prototype._parseFrames = function() {
      var frame, i, _i, _len, _ref;
      this._frames = Array.prototype.slice.call(this.el.children, 0);
      _ref = this._frames;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        frame = _ref[i];
        frame.style.opacity = 0;
      }
      return this._frameStep = 1 / this._frames.length;
    };

    Spriter.prototype._createTween = function() {
      this._tween = new Tween({
        duration: this._props.duration,
        delay: this._props.delay,
        yoyo: this._props.yoyo,
        repeat: this._props.repeat,
        easing: this._props.easing,
        onStart: (function(_this) {
          return function() {
            var _base;
            return typeof (_base = _this._props).onStart === "function" ? _base.onStart() : void 0;
          };
        })(this),
        onComplete: (function(_this) {
          return function() {
            var _base;
            return typeof (_base = _this._props).onComplete === "function" ? _base.onComplete() : void 0;
          };
        })(this),
        onUpdate: (function(_this) {
          return function(p) {
            return _this._setProgress(p);
          };
        })(this)
      });
      this._timeline = new Timeline;
      this._timeline.add(this._tween);
      return !this._props.isRunLess && this._startTween();
    };

    Spriter.prototype._startTween = function() {
      return setTimeout(((function(_this) {
        return function() {
          return _this._timeline.start();
        };
      })(this)), 1);
    };

    Spriter.prototype._setProgress = function(p) {
      var currentNum, proc, _base, _ref, _ref1;
      proc = Math.floor(p / this._frameStep);
      if (this._prevFrame !== this._frames[proc]) {
        if ((_ref = this._prevFrame) != null) {
          _ref.style.opacity = 0;
        }
        currentNum = p === 1 && this._props.isShowEnd ? proc - 1 : proc;
        if ((_ref1 = this._frames[currentNum]) != null) {
          _ref1.style.opacity = 1;
        }
        this._prevFrame = this._frames[proc];
      }
      return typeof (_base = this._props).onUpdate === "function" ? _base.onUpdate(p) : void 0;
    };

    return Spriter;

  })();

  module.exports = Spriter;

}).call(this);

},{"./h":7,"./tween/timeline":25,"./tween/tween":26}],22:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Stagger, StaggerWrapper, Timeline, h;

  h = require('./h');

  Timeline = require('./tween/timeline');

  Stagger = (function() {
    function Stagger(options, Module) {
      this.init(options, Module);
    }

    Stagger.prototype._getOptionByMod = function(name, i, store) {
      var props, value;
      props = store[name];
      if (props + '' === '[object NodeList]') {
        props = Array.prototype.slice.call(props, 0);
      }
      if (props + '' === '[object HTMLCollection]') {
        props = Array.prototype.slice.call(props, 0);
      }
      value = h.isArray(props) ? props[i % props.length] : props;
      return h.parseIfStagger(value, i);
    };

    Stagger.prototype._getOptionByIndex = function(i, store) {
      var key, options, value;
      options = {};
      for (key in store) {
        value = store[key];
        options[key] = this._getOptionByMod(key, i, store);
      }
      return options;
    };

    Stagger.prototype._getChildQuantity = function(name, store) {
      var ary, quantifier;
      if (typeof name === 'number') {
        return name;
      }
      quantifier = store[name];
      if (h.isArray(quantifier)) {
        return quantifier.length;
      } else if (quantifier + '' === '[object NodeList]') {
        return quantifier.length;
      } else if (quantifier + '' === '[object HTMLCollection]') {
        ary = Array.prototype.slice.call(quantifier, 0);
        return ary.length;
      } else if (quantifier instanceof HTMLElement) {
        return 1;
      } else if (typeof quantifier === 'string') {
        return 1;
      }
    };

    Stagger.prototype._createTimeline = function(options) {
      if (options == null) {
        options = {};
      }
      return this.timeline = new Timeline({
        onStart: options.onStaggerStart,
        onUpdate: options.onStaggerUpdate,
        onComplete: options.onStaggerComplete,
        onReverseComplete: options.onStaggerReverseComplete,
        delay: options.moduleDelay
      });
    };

    Stagger.prototype.init = function(options, Module) {
      var count, i, module, option, _i;
      count = this._getChildQuantity(options.quantifier || 'el', options);
      this._createTimeline(options);
      this.childModules = [];
      for (i = _i = 0; 0 <= count ? _i < count : _i > count; i = 0 <= count ? ++_i : --_i) {
        option = this._getOptionByIndex(i, options);
        option.isRunLess = true;
        module = new Module(option);
        this.childModules.push(module);
        this.timeline.add(module);
      }
      return this;
    };

    Stagger.prototype.run = function() {
      return this.timeline.start();
    };

    return Stagger;

  })();

  StaggerWrapper = (function() {
    function StaggerWrapper(Module) {
      var M;
      M = Module;
      return function(options) {
        return new Stagger(options, M);
      };
    }

    return StaggerWrapper;

  })();

  module.exports = StaggerWrapper;

}).call(this);

},{"./h":7,"./tween/timeline":25}],23:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Swirl, Transit,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Transit = require('./transit');

  Swirl = (function(_super) {
    __extends(Swirl, _super);

    function Swirl() {
      return Swirl.__super__.constructor.apply(this, arguments);
    }

    Swirl.prototype.skipPropsDelta = {
      x: 1,
      y: 1
    };

    Swirl.prototype.vars = function() {
      Swirl.__super__.vars.apply(this, arguments);
      return !this.o.isSwirlLess && this.generateSwirl();
    };

    Swirl.prototype.extendDefaults = function() {
      var angle, x, y, _base;
      Swirl.__super__.extendDefaults.apply(this, arguments);
      x = this.getPosValue('x');
      y = this.getPosValue('y');
      angle = 90 + Math.atan((y.delta / x.delta) || 0) * (180 / Math.PI);
      if (x.delta < 0) {
        angle += 180;
      }
      this.positionDelta = {
        radius: Math.sqrt(x.delta * x.delta + y.delta * y.delta),
        angle: angle,
        x: x,
        y: y
      };
      if ((_base = this.o).radiusScale == null) {
        _base.radiusScale = 1;
      }
      this.props.angleShift = this.h.parseIfRand(this.o.angleShift || 0);
      return this.props.radiusScale = this.h.parseIfRand(this.o.radiusScale);
    };

    Swirl.prototype.getPosValue = function(name) {
      var optVal, val;
      optVal = this.o[name];
      if (optVal && typeof optVal === 'object') {
        val = this.h.parseDelta(name, optVal);
        return {
          start: val.start.value,
          end: val.end.value,
          delta: val.delta,
          units: val.end.unit
        };
      } else {
        val = parseFloat(optVal || this.defaults[name]);
        return {
          start: val,
          end: val,
          delta: 0,
          units: 'px'
        };
      }
    };

    Swirl.prototype.setProgress = function(progress) {
      var angle, point, x, y;
      angle = this.positionDelta.angle;
      if (this.o.isSwirl) {
        angle += this.getSwirl(progress);
      }
      point = this.h.getRadialPoint({
        angle: angle,
        radius: this.positionDelta.radius * progress * this.props.radiusScale,
        center: {
          x: this.positionDelta.x.start,
          y: this.positionDelta.y.start
        }
      });
      x = point.x.toFixed(4);
      y = point.y.toFixed(4);
      this.props.x = this.o.ctx ? x : x + this.positionDelta.x.units;
      this.props.y = this.o.ctx ? y : y + this.positionDelta.y.units;
      return Swirl.__super__.setProgress.apply(this, arguments);
    };

    Swirl.prototype.generateSwirl = function() {
      var _base, _base1;
      this.props.signRand = Math.round(this.h.rand(0, 1)) ? -1 : 1;
      if ((_base = this.o).swirlSize == null) {
        _base.swirlSize = 10;
      }
      if ((_base1 = this.o).swirlFrequency == null) {
        _base1.swirlFrequency = 3;
      }
      this.props.swirlSize = this.h.parseIfRand(this.o.swirlSize);
      return this.props.swirlFrequency = this.h.parseIfRand(this.o.swirlFrequency);
    };

    Swirl.prototype.getSwirl = function(progress) {
      return this.props.signRand * this.props.swirlSize * Math.sin(this.props.swirlFrequency * progress);
    };

    return Swirl;

  })(Transit);

  module.exports = Swirl;

}).call(this);

},{"./transit":24}],24:[function(require,module,exports){

/* istanbul ignore next */

(function() {
  var Timeline, Transit, Tween, bitsMap, h,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  h = require('./h');

  bitsMap = require('./shapes/bitsMap');

  Tween = require('./tween/tween');

  Timeline = require('./tween/timeline');

  Transit = (function(_super) {
    __extends(Transit, _super);

    function Transit() {
      return Transit.__super__.constructor.apply(this, arguments);
    }

    Transit.prototype.progress = 0;

    Transit.prototype.defaults = {
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeDasharray: 0,
      strokeDashoffset: 0,
      stroke: 'transparent',
      fill: 'deeppink',
      fillOpacity: 'transparent',
      strokeLinecap: '',
      points: 3,
      x: 0,
      y: 0,
      shiftX: 0,
      shiftY: 0,
      opacity: 1,
      radius: {
        0: 50
      },
      radiusX: void 0,
      radiusY: void 0,
      angle: 0,
      size: null,
      sizeGap: 0,
      onStart: null,
      onComplete: null,
      onUpdate: null,
      duration: 500,
      delay: 0,
      repeat: 0,
      yoyo: false,
      easing: 'Linear.None'
    };

    Transit.prototype.vars = function() {
      var o;
      if (this.h == null) {
        this.h = h;
      }
      if (this.lastSet == null) {
        this.lastSet = {};
      }
      this.index = this.o.index || 0;
      if (this.runCount == null) {
        this.runCount = 0;
      }
      this.extendDefaults();
      o = this.h.cloneObj(this.o);
      this.h.extend(o, this.defaults);
      this.history = [o];
      this.isForeign = !!this.o.ctx;
      this.isForeignBit = !!this.o.bit;
      return this.timelines = [];
    };

    Transit.prototype.render = function() {
      if (!this.isRendered) {
        if (!this.isForeign && !this.isForeignBit) {
          this.ctx = document.createElementNS(this.ns, 'svg');
          this.ctx.style.position = 'absolute';
          this.ctx.style.width = '100%';
          this.ctx.style.height = '100%';
          this.createBit();
          this.calcSize();
          this.el = document.createElement('div');
          this.el.appendChild(this.ctx);
          (this.o.parent || document.body).appendChild(this.el);
        } else {
          this.ctx = this.o.ctx;
          this.createBit();
          this.calcSize();
        }
        this.isRendered = true;
      }
      this.setElStyles();
      this.setProgress(0, true);
      this.createTween();
      return this;
    };

    Transit.prototype.setElStyles = function() {
      var marginSize, size, _ref;
      if (!this.isForeign) {
        size = "" + this.props.size + "px";
        marginSize = "" + (-this.props.size / 2) + "px";
        this.el.style.position = 'absolute';
        this.el.style.top = this.props.y;
        this.el.style.left = this.props.x;
        this.el.style.width = size;
        this.el.style.height = size;
        this.el.style['margin-left'] = marginSize;
        this.el.style['margin-top'] = marginSize;
        this.el.style['marginLeft'] = marginSize;
        this.el.style['marginTop'] = marginSize;
      }
      if ((_ref = this.el) != null) {
        _ref.style.opacity = this.props.opacity;
      }
      if (this.o.isShowInit) {
        return this.show();
      } else {
        return this.hide();
      }
    };

    Transit.prototype.show = function() {
      if (this.isShown || (this.el == null)) {
        return;
      }
      this.el.style.display = 'block';
      return this.isShown = true;
    };

    Transit.prototype.hide = function() {
      if ((this.isShown === false) || (this.el == null)) {
        return;
      }
      this.el.style.display = 'none';
      return this.isShown = false;
    };

    Transit.prototype.draw = function() {
      this.bit.setProp({
        x: this.origin.x,
        y: this.origin.y,
        stroke: this.props.stroke,
        'stroke-width': this.props.strokeWidth,
        'stroke-opacity': this.props.strokeOpacity,
        'stroke-dasharray': this.props.strokeDasharray,
        'stroke-dashoffset': this.props.strokeDashoffset,
        'stroke-linecap': this.props.strokeLinecap,
        fill: this.props.fill,
        'fill-opacity': this.props.fillOpacity,
        radius: this.props.radius,
        radiusX: this.props.radiusX,
        radiusY: this.props.radiusY,
        points: this.props.points,
        transform: this.calcTransform()
      });
      this.bit.draw();
      return this.drawEl();
    };

    Transit.prototype.drawEl = function() {
      if (this.el == null) {
        return true;
      }
      this.isPropChanged('opacity') && (this.el.style.opacity = this.props.opacity);
      if (!this.isForeign) {
        this.isPropChanged('x') && (this.el.style.left = this.props.x);
        this.isPropChanged('y') && (this.el.style.top = this.props.y);
        if (this.isNeedsTransform()) {
          return this.h.setPrefixedStyle(this.el, 'transform', this.fillTransform());
        }
      }
    };

    Transit.prototype.fillTransform = function() {
      return "translate(" + this.props.shiftX + ", " + this.props.shiftY + ")";
    };

    Transit.prototype.isNeedsTransform = function() {
      var isX, isY;
      isX = this.isPropChanged('shiftX');
      isY = this.isPropChanged('shiftY');
      return isX || isY;
    };

    Transit.prototype.isPropChanged = function(name) {
      var _base;
      if ((_base = this.lastSet)[name] == null) {
        _base[name] = {};
      }
      if (this.lastSet[name].value !== this.props[name]) {
        this.lastSet[name].value = this.props[name];
        return true;
      } else {
        return false;
      }
    };

    Transit.prototype.calcTransform = function() {
      return this.props.transform = "rotate(" + this.props.angle + "," + this.origin.x + "," + this.origin.y + ")";
    };

    Transit.prototype.calcSize = function() {
      var dStroke, radius, stroke, _base;
      if (this.o.size) {
        return;
      }
      radius = this.calcMaxRadius();
      dStroke = this.deltas['strokeWidth'];
      stroke = dStroke != null ? Math.max(Math.abs(dStroke.start), Math.abs(dStroke.end)) : this.props.strokeWidth;
      this.props.size = 2 * radius + 2 * stroke;
      switch (typeof (_base = this.props.easing).toLowerCase === "function" ? _base.toLowerCase() : void 0) {
        case 'elastic.out':
        case 'elastic.inout':
          this.props.size *= 1.25;
          break;
        case 'back.out':
        case 'back.inout':
          this.props.size *= 1.1;
      }
      this.props.size *= this.bit.ratio;
      this.props.size += 2 * this.props.sizeGap;
      return this.props.center = this.props.size / 2;
    };

    Transit.prototype.calcMaxRadius = function() {
      var selfSize, selfSizeX, selfSizeY;
      selfSize = this.getRadiusSize({
        key: 'radius'
      });
      selfSizeX = this.getRadiusSize({
        key: 'radiusX',
        fallback: selfSize
      });
      selfSizeY = this.getRadiusSize({
        key: 'radiusY',
        fallback: selfSize
      });
      return Math.max(selfSizeX, selfSizeY);
    };

    Transit.prototype.getRadiusSize = function(o) {
      if (this.deltas[o.key] != null) {
        return Math.max(Math.abs(this.deltas[o.key].end), Math.abs(this.deltas[o.key].start));
      } else if (this.props[o.key] != null) {
        return parseFloat(this.props[o.key]);
      } else {
        return o.fallback || 0;
      }
    };

    Transit.prototype.createBit = function() {
      var bitClass;
      bitClass = bitsMap.getBit(this.o.type || this.type);
      this.bit = new bitClass({
        ctx: this.ctx,
        el: this.o.bit,
        isDrawLess: true
      });
      if (this.isForeign || this.isForeignBit) {
        return this.el = this.bit.el;
      }
    };

    Transit.prototype.setProgress = function(progress, isShow) {
      if (!isShow) {
        this.show();
        if (typeof this.onUpdate === "function") {
          this.onUpdate(progress);
        }
      }
      this.progress = progress < 0 || !progress ? 0 : progress > 1 ? 1 : progress;
      this.calcCurrentProps(progress);
      this.calcOrigin();
      this.draw(progress);
      return this;
    };

    Transit.prototype.calcCurrentProps = function(progress) {
      var a, b, dash, g, i, item, key, keys, len, r, stroke, units, value, _results;
      keys = Object.keys(this.deltas);
      len = keys.length;
      _results = [];
      while (len--) {
        key = keys[len];
        value = this.deltas[key];
        _results.push(this.props[key] = (function() {
          var _i, _len, _ref;
          switch (value.type) {
            case 'array':
              stroke = [];
              _ref = value.delta;
              for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
                item = _ref[i];
                dash = value.start[i].value + item.value * this.progress;
                stroke.push({
                  value: dash,
                  unit: item.unit
                });
              }
              return stroke;
            case 'number':
              return value.start + value.delta * progress;
            case 'unit':
              units = value.end.unit;
              return "" + (value.start.value + value.delta * progress) + units;
            case 'color':
              r = parseInt(value.start.r + value.delta.r * progress, 10);
              g = parseInt(value.start.g + value.delta.g * progress, 10);
              b = parseInt(value.start.b + value.delta.b * progress, 10);
              a = parseInt(value.start.a + value.delta.a * progress, 10);
              return "rgba(" + r + "," + g + "," + b + "," + a + ")";
          }
        }).call(this));
      }
      return _results;
    };

    Transit.prototype.calcOrigin = function() {
      return this.origin = this.o.ctx ? {
        x: parseFloat(this.props.x),
        y: parseFloat(this.props.y)
      } : {
        x: this.props.center,
        y: this.props.center
      };
    };

    Transit.prototype.extendDefaults = function(o) {
      var array, defaultsValue, fromObject, i, key, keys, len, optionsValue, property, unit, value, _i, _len, _ref;
      if (this.props == null) {
        this.props = {};
      }
      fromObject = o || this.defaults;
      (o == null) && (this.deltas = {});
      keys = Object.keys(fromObject);
      len = keys.length;
      while (len--) {
        key = keys[len];
        defaultsValue = fromObject[key];
        if ((_ref = this.skipProps) != null ? _ref[key] : void 0) {
          continue;
        }
        if (o) {
          this.o[key] = defaultsValue;
          optionsValue = defaultsValue;
          delete this.deltas[key];
        } else {
          optionsValue = this.o[key] != null ? this.o[key] : defaultsValue;
        }
        if (!this.isDelta(optionsValue)) {
          if (typeof optionsValue === 'string') {
            if (optionsValue.match(/stagger/)) {
              optionsValue = this.h.parseStagger(optionsValue, this.index);
            }
          }
          if (typeof optionsValue === 'string') {
            if (optionsValue.match(/rand/)) {
              optionsValue = this.h.parseRand(optionsValue);
            }
          }
          this.props[key] = optionsValue;
          if (key === 'radius') {
            if (this.o.radiusX == null) {
              this.props.radiusX = optionsValue;
            }
            if (this.o.radiusY == null) {
              this.props.radiusY = optionsValue;
            }
          }
          if (this.h.posPropsMap[key]) {
            this.props[key] = this.h.parseUnit(this.props[key]).string;
          }
          if (this.h.strokeDashPropsMap[key]) {
            property = this.props[key];
            value = [];
            switch (typeof property) {
              case 'number':
                value.push(this.h.parseUnit(property));
                break;
              case 'string':
                array = this.props[key].split(' ');
                for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
                  unit = array[i];
                  value.push(this.h.parseUnit(unit));
                }
            }
            this.props[key] = value;
          }
          continue;
        }
        this.isSkipDelta || this.getDelta(key, optionsValue);
      }
      return this.onUpdate = this.props.onUpdate;
    };

    Transit.prototype.isDelta = function(optionsValue) {
      var isObject;
      isObject = (optionsValue != null) && (typeof optionsValue === 'object');
      isObject = isObject && !optionsValue.unit;
      return !(!isObject || this.h.isArray(optionsValue) || h.isDOM(optionsValue));
    };

    Transit.prototype.getDelta = function(key, optionsValue) {
      var delta, _ref;
      if ((key === 'x' || key === 'y') && !this.o.ctx) {
        this.h.warn('Consider to animate shiftX/shiftY properties instead of x/y, as it would be much more performant', optionsValue);
      }
      if ((_ref = this.skipPropsDelta) != null ? _ref[key] : void 0) {
        return;
      }
      delta = this.h.parseDelta(key, optionsValue, this.defaults[key]);
      if (delta.type != null) {
        this.deltas[key] = delta;
      }
      return this.props[key] = delta.start;
    };

    Transit.prototype.mergeThenOptions = function(start, end) {
      var endValue, i, isFunction, key, keys, o, startKey, startKeys, value;
      o = {};
      for (key in start) {
        value = start[key];
        if (!this.h.tweenOptionMap[key] && !this.h.callbacksMap[key] || key === 'duration') {
          o[key] = value;
        } else {
          o[key] = key === 'easing' ? '' : void 0;
        }
      }
      keys = Object.keys(end);
      i = keys.length;
      while (i--) {
        key = keys[i];
        endValue = end[key];
        isFunction = typeof endValue === 'function';
        if (this.h.tweenOptionMap[key] || typeof endValue === 'object' || isFunction) {
          o[key] = endValue != null ? endValue : start[key];
          continue;
        }
        startKey = start[key];
        if (startKey == null) {
          startKey = this.defaults[key];
        }
        if ((key === 'radiusX' || key === 'radiusY') && (startKey == null)) {
          startKey = start.radius;
        }
        if (typeof startKey === 'object' && (startKey != null)) {
          startKeys = Object.keys(startKey);
          startKey = startKey[startKeys[0]];
        }
        if (endValue != null) {
          o[key] = {};
          o[key][startKey] = endValue;
        }
      }
      return o;
    };

    Transit.prototype.then = function(o) {
      var i, it, keys, len, merged, opts;
      if ((o == null) || !Object.keys(o)) {
        return;
      }
      merged = this.mergeThenOptions(this.history[this.history.length - 1], o);
      this.history.push(merged);
      keys = Object.keys(this.h.tweenOptionMap);
      i = keys.length;
      opts = {};
      while (i--) {
        opts[keys[i]] = merged[keys[i]];
      }
      it = this;
      len = it.history.length;
      (function(_this) {
        return (function(len) {
          opts.onUpdate = function(p) {
            return _this.setProgress(p);
          };
          opts.onStart = function() {
            var _ref;
            return (_ref = _this.props.onStart) != null ? _ref.apply(_this) : void 0;
          };
          opts.onComplete = function() {
            var _ref;
            return (_ref = _this.props.onComplete) != null ? _ref.apply(_this) : void 0;
          };
          opts.onFirstUpdate = function() {
            return it.tuneOptions(it.history[this.index]);
          };
          opts.isChained = !o.delay;
          return _this.timeline.append(new Tween(opts));
        });
      })(this)(len);
      return this;
    };

    Transit.prototype.tuneOptions = function(o) {
      this.extendDefaults(o);
      this.calcSize();
      return this.setElStyles();
    };

    Transit.prototype.createTween = function() {
      var it;
      it = this;
      this.createTimeline();
      this.timeline = new Timeline({
        onComplete: (function(_this) {
          return function() {
            var _ref;
            !_this.o.isShowEnd && _this.hide();
            return (_ref = _this.props.onComplete) != null ? _ref.apply(_this) : void 0;
          };
        })(this)
      });
      this.timeline.add(this.tween);
      return !this.o.isRunLess && this.startTween();
    };

    Transit.prototype.createTimeline = function() {
      return this.tween = new Tween({
        duration: this.props.duration,
        delay: this.props.delay,
        repeat: this.props.repeat,
        yoyo: this.props.yoyo,
        easing: this.props.easing,
        onUpdate: (function(_this) {
          return function(p) {
            return _this.setProgress(p);
          };
        })(this),
        onStart: (function(_this) {
          return function() {
            var _ref;
            _this.show();
            return (_ref = _this.props.onStart) != null ? _ref.apply(_this) : void 0;
          };
        })(this),
        onFirstUpdateBackward: (function(_this) {
          return function() {
            return _this.history.length > 1 && _this.tuneOptions(_this.history[0]);
          };
        })(this),
        onReverseComplete: (function(_this) {
          return function() {
            var _ref;
            !_this.o.isShowInit && _this.hide();
            return (_ref = _this.props.onReverseComplete) != null ? _ref.apply(_this) : void 0;
          };
        })(this)
      });
    };

    Transit.prototype.run = function(o) {
      var key, keys, len;
      this.runCount++;
      if (o && Object.keys(o).length) {
        if (this.history.length > 1) {
          keys = Object.keys(o);
          len = keys.length;
          while (len--) {
            key = keys[len];
            if (h.callbacksMap[key] || h.tweenOptionMap[key]) {
              h.warn("the property \"" + key + "\" property can not be overridden on run with \"then\" chain yet");
              delete o[key];
            }
          }
        }
        this.transformHistory(o);
        this.tuneNewOption(o);
        o = this.h.cloneObj(this.o);
        this.h.extend(o, this.defaults);
        this.history[0] = o;
        !this.o.isDrawLess && this.setProgress(0, true);
      } else {
        this.tuneNewOption(this.history[0]);
      }
      return this.startTween();
    };

    Transit.prototype.transformHistory = function(o) {
      var historyLen, i, j, key, keys, len, optionRecord, value, value2, valueKeys, valueKeys2, _results;
      keys = Object.keys(o);
      i = -1;
      len = keys.length;
      historyLen = this.history.length;
      _results = [];
      while (++i < len) {
        key = keys[i];
        j = 0;
        _results.push((function() {
          var _results1;
          _results1 = [];
          while (++j < historyLen) {
            optionRecord = this.history[j][key];
            if (typeof optionRecord === 'object') {
              valueKeys = Object.keys(optionRecord);
              value = optionRecord[valueKeys[0]];
              delete this.history[j][key][valueKeys[0]];
              if (typeof o[key] === 'object') {
                valueKeys2 = Object.keys(o[key]);
                value2 = o[key][valueKeys2[0]];
                this.history[j][key][value2] = value;
              } else {
                this.history[j][key][o[key]] = value;
              }
              break;
            } else {
              _results1.push(this.history[j][key] = o[key]);
            }
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    Transit.prototype.tuneNewOption = function(o, isForeign) {
      if ((o != null) && (o.type != null) && o.type !== (this.o.type || this.type)) {
        this.h.warn('Sorry, type can not be changed on run');
        delete o.type;
      }
      if ((o != null) && Object.keys(o).length) {
        this.extendDefaults(o);
        this.resetTimeline();
        !isForeign && this.timeline.recalcDuration();
        this.calcSize();
        return !isForeign && this.setElStyles();
      }
    };

    Transit.prototype.startTween = function() {
      return setTimeout(((function(_this) {
        return function() {
          var _ref;
          return (_ref = _this.timeline) != null ? _ref.start() : void 0;
        };
      })(this)), 1);
    };

    Transit.prototype.resetTimeline = function() {
      var i, key, timelineOptions, _i, _len, _ref;
      timelineOptions = {};
      _ref = Object.keys(this.h.tweenOptionMap);
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        key = _ref[i];
        timelineOptions[key] = this.props[key];
      }
      timelineOptions.onStart = this.props.onStart;
      timelineOptions.onComplete = this.props.onComplete;
      return this.tween.setProp(timelineOptions);
    };

    Transit.prototype.getBitLength = function() {
      this.props.bitLength = this.bit.getLength();
      return this.props.bitLength;
    };

    return Transit;

  })(bitsMap.map.bit);

  module.exports = Transit;

}).call(this);

},{"./h":7,"./shapes/bitsMap":13,"./tween/timeline":25,"./tween/tween":26}],25:[function(require,module,exports){
(function() {
  var Timeline, h, t,
    __slice = [].slice;

  h = require('../h');

  t = require('./tweener');

  Timeline = (function() {
    Timeline.prototype.state = 'stop';

    Timeline.prototype.defaults = {
      repeat: 0,
      delay: 0
    };

    function Timeline(o) {
      this.o = o != null ? o : {};
      this.vars();
      this._extendDefaults();
      this;
    }

    Timeline.prototype.vars = function() {
      this.timelines = [];
      this.props = {
        time: 0,
        repeatTime: 0,
        shiftedRepeatTime: 0
      };
      this.loop = h.bind(this.loop, this);
      return this.onUpdate = this.o.onUpdate;
    };

    Timeline.prototype.add = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this.pushTimelineArray(args);
      return this;
    };

    Timeline.prototype.pushTimelineArray = function(array) {
      var i, tm, _i, _len, _results;
      _results = [];
      for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
        tm = array[i];
        if (h.isArray(tm)) {
          _results.push(this.pushTimelineArray(tm));
        } else {
          _results.push(this.pushTimeline(tm));
        }
      }
      return _results;
    };

    Timeline.prototype._extendDefaults = function() {
      var key, value, _ref, _results;
      _ref = this.defaults;
      _results = [];
      for (key in _ref) {
        value = _ref[key];
        _results.push(this.props[key] = this.o[key] != null ? this.o[key] : value);
      }
      return _results;
    };

    Timeline.prototype.setProp = function(props) {
      var key, value;
      for (key in props) {
        value = props[key];
        this.props[key] = value;
      }
      return this.recalcDuration();
    };

    Timeline.prototype.pushTimeline = function(timeline, shift) {
      if (timeline.timeline instanceof Timeline) {
        timeline = timeline.timeline;
      }
      (shift != null) && timeline.setProp({
        'shiftTime': shift
      });
      this.timelines.push(timeline);
      return this._recalcTimelineDuration(timeline);
    };

    Timeline.prototype.remove = function(timeline) {
      var index;
      index = this.timelines.indexOf(timeline);
      if (index !== -1) {
        return this.timelines.splice(index, 1);
      }
    };

    Timeline.prototype.append = function() {
      var i, timeline, tm, _i, _len;
      timeline = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      for (i = _i = 0, _len = timeline.length; _i < _len; i = ++_i) {
        tm = timeline[i];
        if (h.isArray(tm)) {
          this._appendTimelineArray(tm);
        } else {
          this.appendTimeline(tm, this.timelines.length);
        }
      }
      return this;
    };

    Timeline.prototype._appendTimelineArray = function(timelineArray) {
      var i, len, time, _results;
      i = timelineArray.length;
      time = this.props.repeatTime - this.props.delay;
      len = this.timelines.length;
      _results = [];
      while (i--) {
        _results.push(this.appendTimeline(timelineArray[i], len, time));
      }
      return _results;
    };

    Timeline.prototype.appendTimeline = function(timeline, index, time) {
      var shift;
      shift = (time != null ? time : this.props.time);
      shift += timeline.props.shiftTime || 0;
      timeline.index = index;
      return this.pushTimeline(timeline, shift);
    };

    Timeline.prototype.recalcDuration = function() {
      var len, _results;
      len = this.timelines.length;
      this.props.time = 0;
      this.props.repeatTime = 0;
      this.props.shiftedRepeatTime = 0;
      _results = [];
      while (len--) {
        _results.push(this._recalcTimelineDuration(this.timelines[len]));
      }
      return _results;
    };

    Timeline.prototype._recalcTimelineDuration = function(timeline) {
      var timelineTime;
      timelineTime = timeline.props.repeatTime + (timeline.props.shiftTime || 0);
      this.props.time = Math.max(timelineTime, this.props.time);
      this.props.repeatTime = (this.props.time + this.props.delay) * (this.props.repeat + 1);
      this.props.shiftedRepeatTime = this.props.repeatTime + (this.props.shiftTime || 0);
      return this.props.shiftedRepeatTime -= this.props.delay;
    };

    Timeline.prototype.update = function(time, isGrow) {
      if (time > this.props.endTime) {
        time = this.props.endTime;
      }
      if (time === this.props.endTime && this.isCompleted) {
        return true;
      }
      this._updateTimelines(time, isGrow);
      return this._checkCallbacks(time);
    };

    Timeline.prototype._updateTimelines = function(time, isGrow) {
      var elapsed, i, len, startPoint, timeToTimelines;
      startPoint = this.props.startTime - this.props.delay;
      elapsed = (time - startPoint) % (this.props.delay + this.props.time);
      timeToTimelines = time === this.props.endTime ? this.props.endTime : startPoint + elapsed >= this.props.startTime ? time >= this.props.endTime ? this.props.endTime : startPoint + elapsed : time > this.props.startTime + this.props.time ? this.props.startTime + this.props.time : null;
      if (timeToTimelines != null) {
        i = -1;
        len = this.timelines.length - 1;
        while (i++ < len) {
          if (isGrow == null) {
            isGrow = time > (this._previousUpdateTime || 0);
          }
          this.timelines[i].update(timeToTimelines, isGrow);
        }
      }
      return this._previousUpdateTime = time;
    };

    Timeline.prototype._checkCallbacks = function(time) {
      var _ref, _ref1, _ref2;
      if (this.prevTime === time) {
        return;
      }
      if (!this.prevTime || this.isCompleted && !this.isStarted) {
        if ((_ref = this.o.onStart) != null) {
          _ref.apply(this);
        }
        this.isStarted = true;
        this.isCompleted = false;
      }
      if (time >= this.props.startTime && time < this.props.endTime) {
        if (typeof this.onUpdate === "function") {
          this.onUpdate((time - this.props.startTime) / this.props.repeatTime);
        }
      }
      if (this.prevTime > time && time <= this.props.startTime) {
        if ((_ref1 = this.o.onReverseComplete) != null) {
          _ref1.apply(this);
        }
      }
      this.prevTime = time;
      if (time === this.props.endTime && !this.isCompleted) {
        if (typeof this.onUpdate === "function") {
          this.onUpdate(1);
        }
        if ((_ref2 = this.o.onComplete) != null) {
          _ref2.apply(this);
        }
        this.isCompleted = true;
        this.isStarted = false;
        return true;
      }
    };

    Timeline.prototype.start = function(time) {
      this.setStartTime(time);
      !time && (t.add(this), this.state = 'play');
      return this;
    };

    Timeline.prototype.pause = function() {
      this.removeFromTweener();
      this.state = 'pause';
      return this;
    };

    Timeline.prototype.stop = function() {
      this.removeFromTweener();
      this.setProgress(0);
      this.state = 'stop';
      return this;
    };

    Timeline.prototype.restart = function() {
      this.stop();
      return this.start();
    };

    Timeline.prototype.removeFromTweener = function() {
      t.remove(this);
      return this;
    };

    Timeline.prototype.setStartTime = function(time) {
      this.getDimentions(time);
      return this.startTimelines(this.props.startTime);
    };

    Timeline.prototype.startTimelines = function(time) {
      var i, _results;
      i = this.timelines.length;
      (time == null) && (time = this.props.startTime);
      _results = [];
      while (i--) {
        _results.push(this.timelines[i].start(time));
      }
      return _results;
    };

    Timeline.prototype.setProgress = function(progress) {
      if (this.props.startTime == null) {
        this.setStartTime();
      }
      progress = h.clamp(progress, 0, 1);
      return this.update(this.props.startTime + progress * this.props.repeatTime);
    };

    Timeline.prototype.getDimentions = function(time) {
      if (time == null) {
        time = performance.now();
      }
      this.props.startTime = time + this.props.delay + (this.props.shiftTime || 0);
      this.props.endTime = this.props.startTime + this.props.shiftedRepeatTime;
      return this.props.endTime -= this.props.shiftTime || 0;
    };

    return Timeline;

  })();

  module.exports = Timeline;

}).call(this);

},{"../h":7,"./tweener":27}],26:[function(require,module,exports){
(function() {
  var Tween, easing, h, t;

  h = require('../h');

  t = require('./tweener');

  easing = require('../easing/easing');

  Tween = (function() {
    Tween.prototype.defaults = {
      duration: 600,
      delay: 0,
      repeat: 0,
      yoyo: false,
      easing: 'Linear.None',
      onStart: null,
      onComplete: null,
      onReverseComplete: null,
      onFirstUpdate: null,
      onUpdate: null,
      onFirstUpdateBackward: null,
      isChained: false
    };

    function Tween(o) {
      this.o = o != null ? o : {};
      this.extendDefaults();
      this.vars();
      this;
    }

    Tween.prototype.vars = function() {
      this.h = h;
      this.progress = 0;
      this.prevTime = 0;
      return this.calcDimentions();
    };

    Tween.prototype.calcDimentions = function() {
      this.props.time = this.props.duration + this.props.delay;
      return this.props.repeatTime = this.props.time * (this.props.repeat + 1);
    };

    Tween.prototype.extendDefaults = function() {
      var key, value, _ref;
      this.props = {};
      _ref = this.defaults;
      for (key in _ref) {
        value = _ref[key];
        this.props[key] = this.o[key] != null ? this.o[key] : value;
      }
      this.props.easing = easing.parseEasing(this.o.easing || this.defaults.easing);
      return this.onUpdate = this.props.onUpdate;
    };

    Tween.prototype.start = function(time) {
      this.isCompleted = false;
      this.isStarted = false;
      if (time == null) {
        time = performance.now();
      }
      this.props.startTime = time + this.props.delay + (this.props.shiftTime || 0);
      this.props.endTime = this.props.startTime + this.props.repeatTime - this.props.delay;
      return this;
    };

    Tween.prototype.update = function(time, isGrow) {
      var _ref, _ref1, _ref2, _ref3, _ref4;
      if ((time >= this.props.startTime) && (time < this.props.endTime)) {
        this.isOnReverseComplete = false;
        this.isCompleted = false;
        if (!this.isFirstUpdate) {
          if ((_ref = this.props.onFirstUpdate) != null) {
            _ref.apply(this);
          }
          this.isFirstUpdate = true;
        }
        if (!this.isStarted) {
          if ((_ref1 = this.props.onStart) != null) {
            _ref1.apply(this);
          }
          this.isStarted = true;
        }
        this._updateInActiveArea(time);
        if (time < this.prevTime && !this.isFirstUpdateBackward) {
          if ((_ref2 = this.props.onFirstUpdateBackward) != null) {
            _ref2.apply(this);
          }
          this.isFirstUpdateBackward = true;
        }
      } else {
        if (time >= this.props.endTime && !this.isCompleted) {
          this._complete();
        }
        if (time > this.props.endTime) {
          this.isFirstUpdate = false;
        }
        if (time > this.props.endTime) {
          this.isFirstUpdateBackward = false;
        }
      }
      if (time < this.prevTime && time <= this.props.startTime) {
        if (!this.isFirstUpdateBackward) {
          if ((_ref3 = this.props.onFirstUpdateBackward) != null) {
            _ref3.apply(this);
          }
          this.isFirstUpdateBackward = true;
        }
        if (isGrow) {
          this._complete();
        } else if (!this.isOnReverseComplete) {
          this.isOnReverseComplete = true;
          this.setProgress(0, !this.props.isChained);
          if ((_ref4 = this.props.onReverseComplete) != null) {
            _ref4.apply(this);
          }
        }
        this.isFirstUpdate = false;
      }
      this.prevTime = time;
      return this.isCompleted;
    };

    Tween.prototype._complete = function() {
      var _ref;
      this.setProgress(1);
      if ((_ref = this.props.onComplete) != null) {
        _ref.apply(this);
      }
      this.isCompleted = true;
      this.isStarted = false;
      return this.isOnReverseComplete = false;
    };

    Tween.prototype._updateInActiveArea = function(time) {
      var cnt, elapsed, elapsed2, proc, startPoint;
      startPoint = this.props.startTime - this.props.delay;
      elapsed = (time - startPoint) % (this.props.delay + this.props.duration);
      cnt = Math.floor((time - startPoint) / (this.props.delay + this.props.duration));
      if (startPoint + elapsed >= this.props.startTime) {
        elapsed2 = (time - this.props.startTime) % (this.props.delay + this.props.duration);
        proc = elapsed2 / this.props.duration;
        return this.setProgress(!this.props.yoyo ? proc : cnt % 2 === 0 ? proc : 1 - (proc === 1 ? 0 : proc));
      } else {
        return this.setProgress(this.prevTime < time ? 1 : 0);
      }
    };

    Tween.prototype.setProgress = function(p, isCallback) {
      if (isCallback == null) {
        isCallback = true;
      }
      this.progress = p;
      this.easedProgress = this.props.easing(this.progress);
      if (this.props.prevEasedProgress !== this.easedProgress && isCallback) {
        if (typeof this.onUpdate === "function") {
          this.onUpdate(this.easedProgress, this.progress);
        }
      }
      return this.props.prevEasedProgress = this.easedProgress;
    };

    Tween.prototype.setProp = function(obj, value) {
      var key, val;
      if (typeof obj === 'object') {
        for (key in obj) {
          val = obj[key];
          this.props[key] = val;
          if (key === 'easing') {
            this.props.easing = easing.parseEasing(this.props.easing);
          }
        }
      } else if (typeof obj === 'string') {
        if (obj === 'easing') {
          this.props.easing = easing.parseEasing(value);
        } else {
          this.props[obj] = value;
        }
      }
      return this.calcDimentions();
    };

    Tween.prototype.run = function(time) {
      this.start(time);
      !time && (t.add(this));
      return this;
    };

    Tween.prototype.stop = function() {
      this.pause();
      this.setProgress(0);
      return this;
    };

    Tween.prototype.pause = function() {
      this._removeFromTweener();
      return this;
    };

    Tween.prototype._removeFromTweener = function() {
      t.remove(this);
      return this;
    };

    return Tween;

  })();

  module.exports = Tween;

}).call(this);

},{"../easing/easing":4,"../h":7,"./tweener":27}],27:[function(require,module,exports){
(function() {
  var Tweener, h, i, t;

  require('../polyfills/raf');

  require('../polyfills/performance');

  h = require('../h');

  i = 0;

  Tweener = (function() {
    function Tweener() {
      this.vars();
      this;
    }

    Tweener.prototype.vars = function() {
      this.tweens = [];
      return this.loop = h.bind(this.loop, this);
    };

    Tweener.prototype.loop = function() {
      var time;
      if (!this.isRunning) {
        return false;
      }
      time = performance.now();
      this.update(time);
      if (!this.tweens.length) {
        return this.isRunning = false;
      }
      requestAnimationFrame(this.loop);
      return this;
    };

    Tweener.prototype.startLoop = function() {
      if (this.isRunning) {
        return;
      }
      this.isRunning = true;
      return requestAnimationFrame(this.loop);
    };

    Tweener.prototype.stopLoop = function() {
      return this.isRunning = false;
    };

    Tweener.prototype.update = function(time) {
      var _results;
      i = this.tweens.length;
      _results = [];
      while (i--) {
        if (this.tweens[i].update(time) === true) {
          _results.push(this.remove(i));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Tweener.prototype.add = function(tween) {
      this.tweens.push(tween);
      return this.startLoop();
    };

    Tweener.prototype.removeAll = function() {
      return this.tweens.length = 0;
    };

    Tweener.prototype.remove = function(tween) {
      var index;
      index = typeof tween === 'number' ? tween : this.tweens.indexOf(tween);
      if (index !== -1) {
        return this.tweens.splice(index, 1);
      }
    };

    return Tweener;

  })();

  t = new Tweener;

  module.exports = t;

}).call(this);

},{"../h":7,"../polyfills/performance":10,"../polyfills/raf":11}],28:[function(require,module,exports){

/*!
  LegoMushroom @legomushroom http://legomushroom.com
  MIT License 2014
 */


/* istanbul ignore next */

(function() {
  (function() {
    var Main;
    Main = (function() {
      function Main(o) {
        this.o = o != null ? o : {};
        if (window.isAnyResizeEventInited) {
          return;
        }
        this.vars();
        this.redefineProto();
      }

      Main.prototype.vars = function() {
        window.isAnyResizeEventInited = true;
        this.allowedProtos = [HTMLDivElement, HTMLFormElement, HTMLLinkElement, HTMLBodyElement, HTMLParagraphElement, HTMLFieldSetElement, HTMLLegendElement, HTMLLabelElement, HTMLButtonElement, HTMLUListElement, HTMLOListElement, HTMLLIElement, HTMLHeadingElement, HTMLQuoteElement, HTMLPreElement, HTMLBRElement, HTMLFontElement, HTMLHRElement, HTMLModElement, HTMLParamElement, HTMLMapElement, HTMLTableElement, HTMLTableCaptionElement, HTMLImageElement, HTMLTableCellElement, HTMLSelectElement, HTMLInputElement, HTMLTextAreaElement, HTMLAnchorElement, HTMLObjectElement, HTMLTableColElement, HTMLTableSectionElement, HTMLTableRowElement];
        return this.timerElements = {
          img: 1,
          textarea: 1,
          input: 1,
          embed: 1,
          object: 1,
          svg: 1,
          canvas: 1,
          tr: 1,
          tbody: 1,
          thead: 1,
          tfoot: 1,
          a: 1,
          select: 1,
          option: 1,
          optgroup: 1,
          dl: 1,
          dt: 1,
          br: 1,
          basefont: 1,
          font: 1,
          col: 1,
          iframe: 1
        };
      };

      Main.prototype.redefineProto = function() {
        var i, it, proto, t;
        it = this;
        return t = (function() {
          var _i, _len, _ref, _results;
          _ref = this.allowedProtos;
          _results = [];
          for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
            proto = _ref[i];
            if (proto.prototype == null) {
              continue;
            }
            _results.push((function(proto) {
              var listener, remover;
              listener = proto.prototype.addEventListener || proto.prototype.attachEvent;
              (function(listener) {
                var wrappedListener;
                wrappedListener = function() {
                  var option;
                  if (this !== window || this !== document) {
                    option = arguments[0] === 'onresize' && !this.isAnyResizeEventInited;
                    option && it.handleResize({
                      args: arguments,
                      that: this
                    });
                  }
                  return listener.apply(this, arguments);
                };
                if (proto.prototype.addEventListener) {
                  return proto.prototype.addEventListener = wrappedListener;
                } else if (proto.prototype.attachEvent) {
                  return proto.prototype.attachEvent = wrappedListener;
                }
              })(listener);
              remover = proto.prototype.removeEventListener || proto.prototype.detachEvent;
              return (function(remover) {
                var wrappedRemover;
                wrappedRemover = function() {
                  this.isAnyResizeEventInited = false;
                  this.iframe && this.removeChild(this.iframe);
                  return remover.apply(this, arguments);
                };
                if (proto.prototype.removeEventListener) {
                  return proto.prototype.removeEventListener = wrappedRemover;
                } else if (proto.prototype.detachEvent) {
                  return proto.prototype.detachEvent = wrappedListener;
                }
              })(remover);
            })(proto));
          }
          return _results;
        }).call(this);
      };

      Main.prototype.handleResize = function(args) {
        var computedStyle, el, iframe, isEmpty, isNoPos, isStatic, _ref;
        el = args.that;
        if (!this.timerElements[el.tagName.toLowerCase()]) {
          iframe = document.createElement('iframe');
          el.appendChild(iframe);
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.position = 'absolute';
          iframe.style.zIndex = -999;
          iframe.style.opacity = 0;
          iframe.style.top = 0;
          iframe.style.left = 0;
          computedStyle = window.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
          isNoPos = el.style.position === '';
          isStatic = computedStyle.position === 'static' && isNoPos;
          isEmpty = computedStyle.position === '' && el.style.position === '';
          if (isStatic || isEmpty) {
            el.style.position = 'relative';
          }
          if ((_ref = iframe.contentWindow) != null) {
            _ref.onresize = (function(_this) {
              return function(e) {
                return _this.dispatchEvent(el);
              };
            })(this);
          }
          el.iframe = iframe;
        } else {
          this.initTimer(el);
        }
        return el.isAnyResizeEventInited = true;
      };

      Main.prototype.initTimer = function(el) {
        var height, width;
        width = 0;
        height = 0;
        return this.interval = setInterval((function(_this) {
          return function() {
            var newHeight, newWidth;
            newWidth = el.offsetWidth;
            newHeight = el.offsetHeight;
            if (newWidth !== width || newHeight !== height) {
              _this.dispatchEvent(el);
              width = newWidth;
              return height = newHeight;
            }
          };
        })(this), this.o.interval || 62.5);
      };

      Main.prototype.dispatchEvent = function(el) {
        var e;
        if (document.createEvent) {
          e = document.createEvent('HTMLEvents');
          e.initEvent('onresize', false, false);
          return el.dispatchEvent(e);
        } else if (document.createEventObject) {
          e = document.createEventObject();
          return el.fireEvent('onresize', e);
        } else {
          return false;
        }
      };

      Main.prototype.destroy = function() {
        var i, it, proto, _i, _len, _ref, _results;
        clearInterval(this.interval);
        this.interval = null;
        window.isAnyResizeEventInited = false;
        it = this;
        _ref = this.allowedProtos;
        _results = [];
        for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
          proto = _ref[i];
          if (proto.prototype == null) {
            continue;
          }
          _results.push((function(proto) {
            var listener;
            listener = proto.prototype.addEventListener || proto.prototype.attachEvent;
            if (proto.prototype.addEventListener) {
              proto.prototype.addEventListener = Element.prototype.addEventListener;
            } else if (proto.prototype.attachEvent) {
              proto.prototype.attachEvent = Element.prototype.attachEvent;
            }
            if (proto.prototype.removeEventListener) {
              return proto.prototype.removeEventListener = Element.prototype.removeEventListener;
            } else if (proto.prototype.detachEvent) {
              return proto.prototype.detachEvent = Element.prototype.detachEvent;
            }
          })(proto));
        }
        return _results;
      };

      return Main;

    })();
    if ((typeof define === "function") && define.amd) {
      return define("any-resize-event", [], function() {
        return new Main;
      });
    } else if ((typeof module === "object") && (typeof module.exports === "object")) {
      return module.exports = new Main;
    } else {
      if (typeof window !== "undefined" && window !== null) {
        window.AnyResizeEvent = Main;
      }
      return typeof window !== "undefined" && window !== null ? window.anyResizeEvent = new Main : void 0;
    }
  })();

}).call(this);

},{}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _moJs = require('mo-js');

var _moJs2 = _interopRequireDefault(_moJs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var iconAnimation = function iconAnimation(iconLink) {

  var scaleCurve = _moJs2.default.easing.path('M0,100 L25,99.9999983 C26.2328835,75.0708847 19.7847843,0 100,0');
  var el = iconLink,
      elSpan = el.querySelector('svg'),

  // mo.js timeline obj
  timeline = new _moJs2.default.Timeline(),


  // tweens for the animation:

  // ring animation
  tween2 = new _moJs2.default.Transit({
    parent: el,
    duration: 750,
    type: 'circle',
    radius: { 0: 30 },
    fill: 'transparent',
    stroke: 'red',
    strokeWidth: { 15: 0 },
    opacity: 0.6,
    x: '50%',
    y: '50%',
    isRunLess: true,
    easing: _moJs2.default.easing.bezier(0, 1, 0.5, 1)
  }),

  // icon scale animation
  tween3 = new _moJs2.default.Tween({
    duration: 900,
    onUpdate: function onUpdate(progress) {
      var scaleProgress = scaleCurve(progress);
      elSpan.style.WebkitTransform = elSpan.style.transform = 'scale3d(' + scaleProgress + ',' + scaleProgress + ',1)';
    }
  });

  // add tweens to timeline:
  timeline.add(tween2, tween3);

  // when clicking the button start the timeline/animation:
  el.addEventListener('mouseenter', function () {
    timeline.start();
  });
};

exports.default = iconAnimation;

},{"mo-js":8}],30:[function(require,module,exports){
'use strict';

var _fastclick = require('fastclick');

var _fastclick2 = _interopRequireDefault(_fastclick);

var _iconAnimation = require('./components/iconAnimation');

var _iconAnimation2 = _interopRequireDefault(_iconAnimation);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var links = document.getElementsByClassName('social-link');

for (var i = 0; i < links.length; i++) {
  (0, _iconAnimation2.default)(links[i]);
}

//Initiate fastclick on body
(0, _fastclick2.default)(document.body);

},{"./components/iconAnimation":29,"fastclick":1}]},{},[30])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmFzdGNsaWNrL2xpYi9mYXN0Y2xpY2suanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL2J1cnN0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9lYXNpbmcvYmV6aWVyLWVhc2luZy5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL2Vhc2luZy5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL21peC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL3BhdGgtZWFzaW5nLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9oLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9tb2pzLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9tb3Rpb24tcGF0aC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvcG9seWZpbGxzL3BlcmZvcm1hbmNlLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9wb2x5ZmlsbHMvcmFmLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvYml0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvYml0c01hcC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL2NpcmNsZS5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL2Nyb3NzLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvZXF1YWwuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3NoYXBlcy9saW5lLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvcG9seWdvbi5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL3JlY3QuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3NoYXBlcy96aWd6YWcuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3Nwcml0ZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3N0YWdnZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3N3aXJsLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi90cmFuc2l0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi90d2Vlbi90aW1lbGluZS5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvdHdlZW4vdHdlZW4uanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3R3ZWVuL3R3ZWVuZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3ZlbmRvci9yZXNpemUuanMiLCJzb3VyY2UvanMvY29tcG9uZW50cy9pY29uQW5pbWF0aW9uLmpzIiwic291cmNlL2pzL3NjcmlwdHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3owQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzVWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7QUM1TkE7Ozs7OztBQUVBLElBQU0sZ0JBQWdCLFNBQWhCLGFBQWdCLENBQUMsUUFBRCxFQUFjOztBQUVsQyxNQUFNLGFBQWEsZUFBSyxNQUFMLENBQVksSUFBWixDQUFpQixpRUFBakIsQ0FBYixDQUY0QjtBQUdsQyxNQUFNLEtBQUssUUFBTDtNQUNKLFNBQVMsR0FBRyxhQUFILENBQWlCLEtBQWpCLENBQVQ7OztBQUVBLGFBQVcsSUFBSSxlQUFLLFFBQUwsRUFBZjs7Ozs7O0FBS0EsV0FBUyxJQUFJLGVBQUssT0FBTCxDQUFhO0FBQ3hCLFlBQVEsRUFBUjtBQUNBLGNBQVUsR0FBVjtBQUNBLFVBQU0sUUFBTjtBQUNBLFlBQVEsRUFBQyxHQUFHLEVBQUgsRUFBVDtBQUNBLFVBQU0sYUFBTjtBQUNBLFlBQVEsS0FBUjtBQUNBLGlCQUFhLEVBQUMsSUFBSSxDQUFKLEVBQWQ7QUFDQSxhQUFTLEdBQVQ7QUFDQSxPQUFHLEtBQUg7QUFDQSxPQUFHLEtBQUg7QUFDQSxlQUFXLElBQVg7QUFDQSxZQUFRLGVBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsRUFBeUIsR0FBekIsRUFBOEIsQ0FBOUIsQ0FBUjtHQVpPLENBQVQ7OztBQWVBLFdBQVMsSUFBSSxlQUFLLEtBQUwsQ0FBVztBQUN0QixjQUFVLEdBQVY7QUFDQSxjQUFVLGtCQUFDLFFBQUQsRUFBYztBQUN0QixVQUFNLGdCQUFnQixXQUFXLFFBQVgsQ0FBaEIsQ0FEZ0I7QUFFdEIsYUFBTyxLQUFQLENBQWEsZUFBYixHQUErQixPQUFPLEtBQVAsQ0FBYSxTQUFiLGdCQUFvQyxzQkFBaUIscUJBQXJELENBRlQ7S0FBZDtHQUZILENBQVQ7OztBQTFCZ0MsVUFtQ2xDLENBQVMsR0FBVCxDQUFhLE1BQWIsRUFBcUIsTUFBckI7OztBQW5Da0MsSUFzQ2xDLENBQUcsZ0JBQUgsQ0FBb0IsWUFBcEIsRUFBa0MsWUFBTTtBQUN0QyxhQUFTLEtBQVQsR0FEc0M7R0FBTixDQUFsQyxDQXRDa0M7Q0FBZDs7a0JBNENQOzs7OztBQzlDZjs7OztBQUNBOzs7Ozs7QUFFQSxJQUFNLFFBQVEsU0FBUyxzQkFBVCxDQUFnQyxhQUFoQyxDQUFSOztBQUVOLEtBQUksSUFBSSxJQUFJLENBQUosRUFBTyxJQUFJLE1BQU0sTUFBTixFQUFjLEdBQWpDLEVBQXVDO0FBQ3JDLCtCQUFjLE1BQU0sQ0FBTixDQUFkLEVBRHFDO0NBQXZDOzs7QUFLQSx5QkFBZ0IsU0FBUyxJQUFULENBQWhCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24gKCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0LyoqXG5cdCAqIEBwcmVzZXJ2ZSBGYXN0Q2xpY2s6IHBvbHlmaWxsIHRvIHJlbW92ZSBjbGljayBkZWxheXMgb24gYnJvd3NlcnMgd2l0aCB0b3VjaCBVSXMuXG5cdCAqXG5cdCAqIEBjb2RpbmdzdGFuZGFyZCBmdGxhYnMtanN2MlxuXHQgKiBAY29weXJpZ2h0IFRoZSBGaW5hbmNpYWwgVGltZXMgTGltaXRlZCBbQWxsIFJpZ2h0cyBSZXNlcnZlZF1cblx0ICogQGxpY2Vuc2UgTUlUIExpY2Vuc2UgKHNlZSBMSUNFTlNFLnR4dClcblx0ICovXG5cblx0Lypqc2xpbnQgYnJvd3Nlcjp0cnVlLCBub2RlOnRydWUqL1xuXHQvKmdsb2JhbCBkZWZpbmUsIEV2ZW50LCBOb2RlKi9cblxuXG5cdC8qKlxuXHQgKiBJbnN0YW50aWF0ZSBmYXN0LWNsaWNraW5nIGxpc3RlbmVycyBvbiB0aGUgc3BlY2lmaWVkIGxheWVyLlxuXHQgKlxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtIHtFbGVtZW50fSBsYXllciBUaGUgbGF5ZXIgdG8gbGlzdGVuIG9uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gVGhlIG9wdGlvbnMgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHRzXG5cdCAqL1xuXHRmdW5jdGlvbiBGYXN0Q2xpY2sobGF5ZXIsIG9wdGlvbnMpIHtcblx0XHR2YXIgb2xkT25DbGljaztcblxuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciBhIGNsaWNrIGlzIGN1cnJlbnRseSBiZWluZyB0cmFja2VkLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUgYm9vbGVhblxuXHRcdCAqL1xuXHRcdHRoaXMudHJhY2tpbmdDbGljayA9IGZhbHNlO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaW1lc3RhbXAgZm9yIHdoZW4gY2xpY2sgdHJhY2tpbmcgc3RhcnRlZC5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIG51bWJlclxuXHRcdCAqL1xuXHRcdHRoaXMudHJhY2tpbmdDbGlja1N0YXJ0ID0gMDtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGVsZW1lbnQgYmVpbmcgdHJhY2tlZCBmb3IgYSBjbGljay5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIEV2ZW50VGFyZ2V0XG5cdFx0ICovXG5cdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblxuXG5cdFx0LyoqXG5cdFx0ICogWC1jb29yZGluYXRlIG9mIHRvdWNoIHN0YXJ0IGV2ZW50LlxuXHRcdCAqXG5cdFx0ICogQHR5cGUgbnVtYmVyXG5cdFx0ICovXG5cdFx0dGhpcy50b3VjaFN0YXJ0WCA9IDA7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFktY29vcmRpbmF0ZSBvZiB0b3VjaCBzdGFydCBldmVudC5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIG51bWJlclxuXHRcdCAqL1xuXHRcdHRoaXMudG91Y2hTdGFydFkgPSAwO1xuXG5cblx0XHQvKipcblx0XHQgKiBJRCBvZiB0aGUgbGFzdCB0b3VjaCwgcmV0cmlldmVkIGZyb20gVG91Y2guaWRlbnRpZmllci5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIG51bWJlclxuXHRcdCAqL1xuXHRcdHRoaXMubGFzdFRvdWNoSWRlbnRpZmllciA9IDA7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFRvdWNobW92ZSBib3VuZGFyeSwgYmV5b25kIHdoaWNoIGEgY2xpY2sgd2lsbCBiZSBjYW5jZWxsZWQuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBudW1iZXJcblx0XHQgKi9cblx0XHR0aGlzLnRvdWNoQm91bmRhcnkgPSBvcHRpb25zLnRvdWNoQm91bmRhcnkgfHwgMTA7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBGYXN0Q2xpY2sgbGF5ZXIuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBFbGVtZW50XG5cdFx0ICovXG5cdFx0dGhpcy5sYXllciA9IGxheWVyO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIG1pbmltdW0gdGltZSBiZXR3ZWVuIHRhcCh0b3VjaHN0YXJ0IGFuZCB0b3VjaGVuZCkgZXZlbnRzXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBudW1iZXJcblx0XHQgKi9cblx0XHR0aGlzLnRhcERlbGF5ID0gb3B0aW9ucy50YXBEZWxheSB8fCAyMDA7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgbWF4aW11bSB0aW1lIGZvciBhIHRhcFxuXHRcdCAqXG5cdFx0ICogQHR5cGUgbnVtYmVyXG5cdFx0ICovXG5cdFx0dGhpcy50YXBUaW1lb3V0ID0gb3B0aW9ucy50YXBUaW1lb3V0IHx8IDcwMDtcblxuXHRcdGlmIChGYXN0Q2xpY2subm90TmVlZGVkKGxheWVyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFNvbWUgb2xkIHZlcnNpb25zIG9mIEFuZHJvaWQgZG9uJ3QgaGF2ZSBGdW5jdGlvbi5wcm90b3R5cGUuYmluZFxuXHRcdGZ1bmN0aW9uIGJpbmQobWV0aG9kLCBjb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7IHJldHVybiBtZXRob2QuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTsgfTtcblx0XHR9XG5cblxuXHRcdHZhciBtZXRob2RzID0gWydvbk1vdXNlJywgJ29uQ2xpY2snLCAnb25Ub3VjaFN0YXJ0JywgJ29uVG91Y2hNb3ZlJywgJ29uVG91Y2hFbmQnLCAnb25Ub3VjaENhbmNlbCddO1xuXHRcdHZhciBjb250ZXh0ID0gdGhpcztcblx0XHRmb3IgKHZhciBpID0gMCwgbCA9IG1ldGhvZHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG5cdFx0XHRjb250ZXh0W21ldGhvZHNbaV1dID0gYmluZChjb250ZXh0W21ldGhvZHNbaV1dLCBjb250ZXh0KTtcblx0XHR9XG5cblx0XHQvLyBTZXQgdXAgZXZlbnQgaGFuZGxlcnMgYXMgcmVxdWlyZWRcblx0XHRpZiAoZGV2aWNlSXNBbmRyb2lkKSB7XG5cdFx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCB0aGlzLm9uTW91c2UsIHRydWUpO1xuXHRcdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlLCB0cnVlKTtcblx0XHRcdGxheWVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm9uTW91c2UsIHRydWUpO1xuXHRcdH1cblxuXHRcdGxheWVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5vbkNsaWNrLCB0cnVlKTtcblx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5vblRvdWNoU3RhcnQsIGZhbHNlKTtcblx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLm9uVG91Y2hNb3ZlLCBmYWxzZSk7XG5cdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLm9uVG91Y2hFbmQsIGZhbHNlKTtcblx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIHRoaXMub25Ub3VjaENhbmNlbCwgZmFsc2UpO1xuXG5cdFx0Ly8gSGFjayBpcyByZXF1aXJlZCBmb3IgYnJvd3NlcnMgdGhhdCBkb24ndCBzdXBwb3J0IEV2ZW50I3N0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiAoZS5nLiBBbmRyb2lkIDIpXG5cdFx0Ly8gd2hpY2ggaXMgaG93IEZhc3RDbGljayBub3JtYWxseSBzdG9wcyBjbGljayBldmVudHMgYnViYmxpbmcgdG8gY2FsbGJhY2tzIHJlZ2lzdGVyZWQgb24gdGhlIEZhc3RDbGlja1xuXHRcdC8vIGxheWVyIHdoZW4gdGhleSBhcmUgY2FuY2VsbGVkLlxuXHRcdGlmICghRXZlbnQucHJvdG90eXBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbikge1xuXHRcdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBjYXB0dXJlKSB7XG5cdFx0XHRcdHZhciBybXYgPSBOb2RlLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyO1xuXHRcdFx0XHRpZiAodHlwZSA9PT0gJ2NsaWNrJykge1xuXHRcdFx0XHRcdHJtdi5jYWxsKGxheWVyLCB0eXBlLCBjYWxsYmFjay5oaWphY2tlZCB8fCBjYWxsYmFjaywgY2FwdHVyZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cm12LmNhbGwobGF5ZXIsIHR5cGUsIGNhbGxiYWNrLCBjYXB0dXJlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBjYXB0dXJlKSB7XG5cdFx0XHRcdHZhciBhZHYgPSBOb2RlLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyO1xuXHRcdFx0XHRpZiAodHlwZSA9PT0gJ2NsaWNrJykge1xuXHRcdFx0XHRcdGFkdi5jYWxsKGxheWVyLCB0eXBlLCBjYWxsYmFjay5oaWphY2tlZCB8fCAoY2FsbGJhY2suaGlqYWNrZWQgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRcdFx0aWYgKCFldmVudC5wcm9wYWdhdGlvblN0b3BwZWQpIHtcblx0XHRcdFx0XHRcdFx0Y2FsbGJhY2soZXZlbnQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pLCBjYXB0dXJlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhZHYuY2FsbChsYXllciwgdHlwZSwgY2FsbGJhY2ssIGNhcHR1cmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIElmIGEgaGFuZGxlciBpcyBhbHJlYWR5IGRlY2xhcmVkIGluIHRoZSBlbGVtZW50J3Mgb25jbGljayBhdHRyaWJ1dGUsIGl0IHdpbGwgYmUgZmlyZWQgYmVmb3JlXG5cdFx0Ly8gRmFzdENsaWNrJ3Mgb25DbGljayBoYW5kbGVyLiBGaXggdGhpcyBieSBwdWxsaW5nIG91dCB0aGUgdXNlci1kZWZpbmVkIGhhbmRsZXIgZnVuY3Rpb24gYW5kXG5cdFx0Ly8gYWRkaW5nIGl0IGFzIGxpc3RlbmVyLlxuXHRcdGlmICh0eXBlb2YgbGF5ZXIub25jbGljayA9PT0gJ2Z1bmN0aW9uJykge1xuXG5cdFx0XHQvLyBBbmRyb2lkIGJyb3dzZXIgb24gYXQgbGVhc3QgMy4yIHJlcXVpcmVzIGEgbmV3IHJlZmVyZW5jZSB0byB0aGUgZnVuY3Rpb24gaW4gbGF5ZXIub25jbGlja1xuXHRcdFx0Ly8gLSB0aGUgb2xkIG9uZSB3b24ndCB3b3JrIGlmIHBhc3NlZCB0byBhZGRFdmVudExpc3RlbmVyIGRpcmVjdGx5LlxuXHRcdFx0b2xkT25DbGljayA9IGxheWVyLm9uY2xpY2s7XG5cdFx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdG9sZE9uQ2xpY2soZXZlbnQpO1xuXHRcdFx0fSwgZmFsc2UpO1xuXHRcdFx0bGF5ZXIub25jbGljayA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCogV2luZG93cyBQaG9uZSA4LjEgZmFrZXMgdXNlciBhZ2VudCBzdHJpbmcgdG8gbG9vayBsaWtlIEFuZHJvaWQgYW5kIGlQaG9uZS5cblx0KlxuXHQqIEB0eXBlIGJvb2xlYW5cblx0Ki9cblx0dmFyIGRldmljZUlzV2luZG93c1Bob25lID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKFwiV2luZG93cyBQaG9uZVwiKSA+PSAwO1xuXG5cdC8qKlxuXHQgKiBBbmRyb2lkIHJlcXVpcmVzIGV4Y2VwdGlvbnMuXG5cdCAqXG5cdCAqIEB0eXBlIGJvb2xlYW5cblx0ICovXG5cdHZhciBkZXZpY2VJc0FuZHJvaWQgPSBuYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoJ0FuZHJvaWQnKSA+IDAgJiYgIWRldmljZUlzV2luZG93c1Bob25lO1xuXG5cblx0LyoqXG5cdCAqIGlPUyByZXF1aXJlcyBleGNlcHRpb25zLlxuXHQgKlxuXHQgKiBAdHlwZSBib29sZWFuXG5cdCAqL1xuXHR2YXIgZGV2aWNlSXNJT1MgPSAvaVAoYWR8aG9uZXxvZCkvLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkgJiYgIWRldmljZUlzV2luZG93c1Bob25lO1xuXG5cblx0LyoqXG5cdCAqIGlPUyA0IHJlcXVpcmVzIGFuIGV4Y2VwdGlvbiBmb3Igc2VsZWN0IGVsZW1lbnRzLlxuXHQgKlxuXHQgKiBAdHlwZSBib29sZWFuXG5cdCAqL1xuXHR2YXIgZGV2aWNlSXNJT1M0ID0gZGV2aWNlSXNJT1MgJiYgKC9PUyA0X1xcZChfXFxkKT8vKS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cblx0LyoqXG5cdCAqIGlPUyA2LjAtNy4qIHJlcXVpcmVzIHRoZSB0YXJnZXQgZWxlbWVudCB0byBiZSBtYW51YWxseSBkZXJpdmVkXG5cdCAqXG5cdCAqIEB0eXBlIGJvb2xlYW5cblx0ICovXG5cdHZhciBkZXZpY2VJc0lPU1dpdGhCYWRUYXJnZXQgPSBkZXZpY2VJc0lPUyAmJiAoL09TIFs2LTddX1xcZC8pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cblx0LyoqXG5cdCAqIEJsYWNrQmVycnkgcmVxdWlyZXMgZXhjZXB0aW9ucy5cblx0ICpcblx0ICogQHR5cGUgYm9vbGVhblxuXHQgKi9cblx0dmFyIGRldmljZUlzQmxhY2tCZXJyeTEwID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdCQjEwJykgPiAwO1xuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIGdpdmVuIGVsZW1lbnQgcmVxdWlyZXMgYSBuYXRpdmUgY2xpY2suXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR8RWxlbWVudH0gdGFyZ2V0IFRhcmdldCBET00gZWxlbWVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBlbGVtZW50IG5lZWRzIGEgbmF0aXZlIGNsaWNrXG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm5lZWRzQ2xpY2sgPSBmdW5jdGlvbih0YXJnZXQpIHtcblx0XHRzd2l0Y2ggKHRhcmdldC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG5cblx0XHQvLyBEb24ndCBzZW5kIGEgc3ludGhldGljIGNsaWNrIHRvIGRpc2FibGVkIGlucHV0cyAoaXNzdWUgIzYyKVxuXHRcdGNhc2UgJ2J1dHRvbic6XG5cdFx0Y2FzZSAnc2VsZWN0Jzpcblx0XHRjYXNlICd0ZXh0YXJlYSc6XG5cdFx0XHRpZiAodGFyZ2V0LmRpc2FibGVkKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRicmVhaztcblx0XHRjYXNlICdpbnB1dCc6XG5cblx0XHRcdC8vIEZpbGUgaW5wdXRzIG5lZWQgcmVhbCBjbGlja3Mgb24gaU9TIDYgZHVlIHRvIGEgYnJvd3NlciBidWcgKGlzc3VlICM2OClcblx0XHRcdGlmICgoZGV2aWNlSXNJT1MgJiYgdGFyZ2V0LnR5cGUgPT09ICdmaWxlJykgfHwgdGFyZ2V0LmRpc2FibGVkKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRicmVhaztcblx0XHRjYXNlICdsYWJlbCc6XG5cdFx0Y2FzZSAnaWZyYW1lJzogLy8gaU9TOCBob21lc2NyZWVuIGFwcHMgY2FuIHByZXZlbnQgZXZlbnRzIGJ1YmJsaW5nIGludG8gZnJhbWVzXG5cdFx0Y2FzZSAndmlkZW8nOlxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICgvXFxibmVlZHNjbGlja1xcYi8pLnRlc3QodGFyZ2V0LmNsYXNzTmFtZSk7XG5cdH07XG5cblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSBnaXZlbiBlbGVtZW50IHJlcXVpcmVzIGEgY2FsbCB0byBmb2N1cyB0byBzaW11bGF0ZSBjbGljayBpbnRvIGVsZW1lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR8RWxlbWVudH0gdGFyZ2V0IFRhcmdldCBET00gZWxlbWVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBlbGVtZW50IHJlcXVpcmVzIGEgY2FsbCB0byBmb2N1cyB0byBzaW11bGF0ZSBuYXRpdmUgY2xpY2suXG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm5lZWRzRm9jdXMgPSBmdW5jdGlvbih0YXJnZXQpIHtcblx0XHRzd2l0Y2ggKHRhcmdldC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0Y2FzZSAndGV4dGFyZWEnOlxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0Y2FzZSAnc2VsZWN0Jzpcblx0XHRcdHJldHVybiAhZGV2aWNlSXNBbmRyb2lkO1xuXHRcdGNhc2UgJ2lucHV0Jzpcblx0XHRcdHN3aXRjaCAodGFyZ2V0LnR5cGUpIHtcblx0XHRcdGNhc2UgJ2J1dHRvbic6XG5cdFx0XHRjYXNlICdjaGVja2JveCc6XG5cdFx0XHRjYXNlICdmaWxlJzpcblx0XHRcdGNhc2UgJ2ltYWdlJzpcblx0XHRcdGNhc2UgJ3JhZGlvJzpcblx0XHRcdGNhc2UgJ3N1Ym1pdCc6XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTm8gcG9pbnQgaW4gYXR0ZW1wdGluZyB0byBmb2N1cyBkaXNhYmxlZCBpbnB1dHNcblx0XHRcdHJldHVybiAhdGFyZ2V0LmRpc2FibGVkICYmICF0YXJnZXQucmVhZE9ubHk7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdHJldHVybiAoL1xcYm5lZWRzZm9jdXNcXGIvKS50ZXN0KHRhcmdldC5jbGFzc05hbWUpO1xuXHRcdH1cblx0fTtcblxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgY2xpY2sgZXZlbnQgdG8gdGhlIHNwZWNpZmllZCBlbGVtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fEVsZW1lbnR9IHRhcmdldEVsZW1lbnRcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUuc2VuZENsaWNrID0gZnVuY3Rpb24odGFyZ2V0RWxlbWVudCwgZXZlbnQpIHtcblx0XHR2YXIgY2xpY2tFdmVudCwgdG91Y2g7XG5cblx0XHQvLyBPbiBzb21lIEFuZHJvaWQgZGV2aWNlcyBhY3RpdmVFbGVtZW50IG5lZWRzIHRvIGJlIGJsdXJyZWQgb3RoZXJ3aXNlIHRoZSBzeW50aGV0aWMgY2xpY2sgd2lsbCBoYXZlIG5vIGVmZmVjdCAoIzI0KVxuXHRcdGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgIT09IHRhcmdldEVsZW1lbnQpIHtcblx0XHRcdGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuYmx1cigpO1xuXHRcdH1cblxuXHRcdHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF07XG5cblx0XHQvLyBTeW50aGVzaXNlIGEgY2xpY2sgZXZlbnQsIHdpdGggYW4gZXh0cmEgYXR0cmlidXRlIHNvIGl0IGNhbiBiZSB0cmFja2VkXG5cdFx0Y2xpY2tFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50cycpO1xuXHRcdGNsaWNrRXZlbnQuaW5pdE1vdXNlRXZlbnQodGhpcy5kZXRlcm1pbmVFdmVudFR5cGUodGFyZ2V0RWxlbWVudCksIHRydWUsIHRydWUsIHdpbmRvdywgMSwgdG91Y2guc2NyZWVuWCwgdG91Y2guc2NyZWVuWSwgdG91Y2guY2xpZW50WCwgdG91Y2guY2xpZW50WSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIDAsIG51bGwpO1xuXHRcdGNsaWNrRXZlbnQuZm9yd2FyZGVkVG91Y2hFdmVudCA9IHRydWU7XG5cdFx0dGFyZ2V0RWxlbWVudC5kaXNwYXRjaEV2ZW50KGNsaWNrRXZlbnQpO1xuXHR9O1xuXG5cdEZhc3RDbGljay5wcm90b3R5cGUuZGV0ZXJtaW5lRXZlbnRUeXBlID0gZnVuY3Rpb24odGFyZ2V0RWxlbWVudCkge1xuXG5cdFx0Ly9Jc3N1ZSAjMTU5OiBBbmRyb2lkIENocm9tZSBTZWxlY3QgQm94IGRvZXMgbm90IG9wZW4gd2l0aCBhIHN5bnRoZXRpYyBjbGljayBldmVudFxuXHRcdGlmIChkZXZpY2VJc0FuZHJvaWQgJiYgdGFyZ2V0RWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzZWxlY3QnKSB7XG5cdFx0XHRyZXR1cm4gJ21vdXNlZG93bic7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICdjbGljayc7XG5cdH07XG5cblxuXHQvKipcblx0ICogQHBhcmFtIHtFdmVudFRhcmdldHxFbGVtZW50fSB0YXJnZXRFbGVtZW50XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24odGFyZ2V0RWxlbWVudCkge1xuXHRcdHZhciBsZW5ndGg7XG5cblx0XHQvLyBJc3N1ZSAjMTYwOiBvbiBpT1MgNywgc29tZSBpbnB1dCBlbGVtZW50cyAoZS5nLiBkYXRlIGRhdGV0aW1lIG1vbnRoKSB0aHJvdyBhIHZhZ3VlIFR5cGVFcnJvciBvbiBzZXRTZWxlY3Rpb25SYW5nZS4gVGhlc2UgZWxlbWVudHMgZG9uJ3QgaGF2ZSBhbiBpbnRlZ2VyIHZhbHVlIGZvciB0aGUgc2VsZWN0aW9uU3RhcnQgYW5kIHNlbGVjdGlvbkVuZCBwcm9wZXJ0aWVzLCBidXQgdW5mb3J0dW5hdGVseSB0aGF0IGNhbid0IGJlIHVzZWQgZm9yIGRldGVjdGlvbiBiZWNhdXNlIGFjY2Vzc2luZyB0aGUgcHJvcGVydGllcyBhbHNvIHRocm93cyBhIFR5cGVFcnJvci4gSnVzdCBjaGVjayB0aGUgdHlwZSBpbnN0ZWFkLiBGaWxlZCBhcyBBcHBsZSBidWcgIzE1MTIyNzI0LlxuXHRcdGlmIChkZXZpY2VJc0lPUyAmJiB0YXJnZXRFbGVtZW50LnNldFNlbGVjdGlvblJhbmdlICYmIHRhcmdldEVsZW1lbnQudHlwZS5pbmRleE9mKCdkYXRlJykgIT09IDAgJiYgdGFyZ2V0RWxlbWVudC50eXBlICE9PSAndGltZScgJiYgdGFyZ2V0RWxlbWVudC50eXBlICE9PSAnbW9udGgnKSB7XG5cdFx0XHRsZW5ndGggPSB0YXJnZXRFbGVtZW50LnZhbHVlLmxlbmd0aDtcblx0XHRcdHRhcmdldEVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UobGVuZ3RoLCBsZW5ndGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0YXJnZXRFbGVtZW50LmZvY3VzKCk7XG5cdFx0fVxuXHR9O1xuXG5cblx0LyoqXG5cdCAqIENoZWNrIHdoZXRoZXIgdGhlIGdpdmVuIHRhcmdldCBlbGVtZW50IGlzIGEgY2hpbGQgb2YgYSBzY3JvbGxhYmxlIGxheWVyIGFuZCBpZiBzbywgc2V0IGEgZmxhZyBvbiBpdC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudFRhcmdldHxFbGVtZW50fSB0YXJnZXRFbGVtZW50XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLnVwZGF0ZVNjcm9sbFBhcmVudCA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQpIHtcblx0XHR2YXIgc2Nyb2xsUGFyZW50LCBwYXJlbnRFbGVtZW50O1xuXG5cdFx0c2Nyb2xsUGFyZW50ID0gdGFyZ2V0RWxlbWVudC5mYXN0Q2xpY2tTY3JvbGxQYXJlbnQ7XG5cblx0XHQvLyBBdHRlbXB0IHRvIGRpc2NvdmVyIHdoZXRoZXIgdGhlIHRhcmdldCBlbGVtZW50IGlzIGNvbnRhaW5lZCB3aXRoaW4gYSBzY3JvbGxhYmxlIGxheWVyLiBSZS1jaGVjayBpZiB0aGVcblx0XHQvLyB0YXJnZXQgZWxlbWVudCB3YXMgbW92ZWQgdG8gYW5vdGhlciBwYXJlbnQuXG5cdFx0aWYgKCFzY3JvbGxQYXJlbnQgfHwgIXNjcm9sbFBhcmVudC5jb250YWlucyh0YXJnZXRFbGVtZW50KSkge1xuXHRcdFx0cGFyZW50RWxlbWVudCA9IHRhcmdldEVsZW1lbnQ7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdGlmIChwYXJlbnRFbGVtZW50LnNjcm9sbEhlaWdodCA+IHBhcmVudEVsZW1lbnQub2Zmc2V0SGVpZ2h0KSB7XG5cdFx0XHRcdFx0c2Nyb2xsUGFyZW50ID0gcGFyZW50RWxlbWVudDtcblx0XHRcdFx0XHR0YXJnZXRFbGVtZW50LmZhc3RDbGlja1Njcm9sbFBhcmVudCA9IHBhcmVudEVsZW1lbnQ7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwYXJlbnRFbGVtZW50ID0gcGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50O1xuXHRcdFx0fSB3aGlsZSAocGFyZW50RWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0Ly8gQWx3YXlzIHVwZGF0ZSB0aGUgc2Nyb2xsIHRvcCB0cmFja2VyIGlmIHBvc3NpYmxlLlxuXHRcdGlmIChzY3JvbGxQYXJlbnQpIHtcblx0XHRcdHNjcm9sbFBhcmVudC5mYXN0Q2xpY2tMYXN0U2Nyb2xsVG9wID0gc2Nyb2xsUGFyZW50LnNjcm9sbFRvcDtcblx0XHR9XG5cdH07XG5cblxuXHQvKipcblx0ICogQHBhcmFtIHtFdmVudFRhcmdldH0gdGFyZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7RWxlbWVudHxFdmVudFRhcmdldH1cblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUuZ2V0VGFyZ2V0RWxlbWVudEZyb21FdmVudFRhcmdldCA9IGZ1bmN0aW9uKGV2ZW50VGFyZ2V0KSB7XG5cblx0XHQvLyBPbiBzb21lIG9sZGVyIGJyb3dzZXJzIChub3RhYmx5IFNhZmFyaSBvbiBpT1MgNC4xIC0gc2VlIGlzc3VlICM1NikgdGhlIGV2ZW50IHRhcmdldCBtYXkgYmUgYSB0ZXh0IG5vZGUuXG5cdFx0aWYgKGV2ZW50VGFyZ2V0Lm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuXHRcdFx0cmV0dXJuIGV2ZW50VGFyZ2V0LnBhcmVudE5vZGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV2ZW50VGFyZ2V0O1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIE9uIHRvdWNoIHN0YXJ0LCByZWNvcmQgdGhlIHBvc2l0aW9uIGFuZCBzY3JvbGwgb2Zmc2V0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUub25Ub3VjaFN0YXJ0ID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgdGFyZ2V0RWxlbWVudCwgdG91Y2gsIHNlbGVjdGlvbjtcblxuXHRcdC8vIElnbm9yZSBtdWx0aXBsZSB0b3VjaGVzLCBvdGhlcndpc2UgcGluY2gtdG8tem9vbSBpcyBwcmV2ZW50ZWQgaWYgYm90aCBmaW5nZXJzIGFyZSBvbiB0aGUgRmFzdENsaWNrIGVsZW1lbnQgKGlzc3VlICMxMTEpLlxuXHRcdGlmIChldmVudC50YXJnZXRUb3VjaGVzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHRhcmdldEVsZW1lbnQgPSB0aGlzLmdldFRhcmdldEVsZW1lbnRGcm9tRXZlbnRUYXJnZXQoZXZlbnQudGFyZ2V0KTtcblx0XHR0b3VjaCA9IGV2ZW50LnRhcmdldFRvdWNoZXNbMF07XG5cblx0XHRpZiAoZGV2aWNlSXNJT1MpIHtcblxuXHRcdFx0Ly8gT25seSB0cnVzdGVkIGV2ZW50cyB3aWxsIGRlc2VsZWN0IHRleHQgb24gaU9TIChpc3N1ZSAjNDkpXG5cdFx0XHRzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoc2VsZWN0aW9uLnJhbmdlQ291bnQgJiYgIXNlbGVjdGlvbi5pc0NvbGxhcHNlZCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFkZXZpY2VJc0lPUzQpIHtcblxuXHRcdFx0XHQvLyBXZWlyZCB0aGluZ3MgaGFwcGVuIG9uIGlPUyB3aGVuIGFuIGFsZXJ0IG9yIGNvbmZpcm0gZGlhbG9nIGlzIG9wZW5lZCBmcm9tIGEgY2xpY2sgZXZlbnQgY2FsbGJhY2sgKGlzc3VlICMyMyk6XG5cdFx0XHRcdC8vIHdoZW4gdGhlIHVzZXIgbmV4dCB0YXBzIGFueXdoZXJlIGVsc2Ugb24gdGhlIHBhZ2UsIG5ldyB0b3VjaHN0YXJ0IGFuZCB0b3VjaGVuZCBldmVudHMgYXJlIGRpc3BhdGNoZWRcblx0XHRcdFx0Ly8gd2l0aCB0aGUgc2FtZSBpZGVudGlmaWVyIGFzIHRoZSB0b3VjaCBldmVudCB0aGF0IHByZXZpb3VzbHkgdHJpZ2dlcmVkIHRoZSBjbGljayB0aGF0IHRyaWdnZXJlZCB0aGUgYWxlcnQuXG5cdFx0XHRcdC8vIFNhZGx5LCB0aGVyZSBpcyBhbiBpc3N1ZSBvbiBpT1MgNCB0aGF0IGNhdXNlcyBzb21lIG5vcm1hbCB0b3VjaCBldmVudHMgdG8gaGF2ZSB0aGUgc2FtZSBpZGVudGlmaWVyIGFzIGFuXG5cdFx0XHRcdC8vIGltbWVkaWF0ZWx5IHByZWNlZWRpbmcgdG91Y2ggZXZlbnQgKGlzc3VlICM1MiksIHNvIHRoaXMgZml4IGlzIHVuYXZhaWxhYmxlIG9uIHRoYXQgcGxhdGZvcm0uXG5cdFx0XHRcdC8vIElzc3VlIDEyMDogdG91Y2guaWRlbnRpZmllciBpcyAwIHdoZW4gQ2hyb21lIGRldiB0b29scyAnRW11bGF0ZSB0b3VjaCBldmVudHMnIGlzIHNldCB3aXRoIGFuIGlPUyBkZXZpY2UgVUEgc3RyaW5nLFxuXHRcdFx0XHQvLyB3aGljaCBjYXVzZXMgYWxsIHRvdWNoIGV2ZW50cyB0byBiZSBpZ25vcmVkLiBBcyB0aGlzIGJsb2NrIG9ubHkgYXBwbGllcyB0byBpT1MsIGFuZCBpT1MgaWRlbnRpZmllcnMgYXJlIGFsd2F5cyBsb25nLFxuXHRcdFx0XHQvLyByYW5kb20gaW50ZWdlcnMsIGl0J3Mgc2FmZSB0byB0byBjb250aW51ZSBpZiB0aGUgaWRlbnRpZmllciBpcyAwIGhlcmUuXG5cdFx0XHRcdGlmICh0b3VjaC5pZGVudGlmaWVyICYmIHRvdWNoLmlkZW50aWZpZXIgPT09IHRoaXMubGFzdFRvdWNoSWRlbnRpZmllcikge1xuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5sYXN0VG91Y2hJZGVudGlmaWVyID0gdG91Y2guaWRlbnRpZmllcjtcblxuXHRcdFx0XHQvLyBJZiB0aGUgdGFyZ2V0IGVsZW1lbnQgaXMgYSBjaGlsZCBvZiBhIHNjcm9sbGFibGUgbGF5ZXIgKHVzaW5nIC13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOiB0b3VjaCkgYW5kOlxuXHRcdFx0XHQvLyAxKSB0aGUgdXNlciBkb2VzIGEgZmxpbmcgc2Nyb2xsIG9uIHRoZSBzY3JvbGxhYmxlIGxheWVyXG5cdFx0XHRcdC8vIDIpIHRoZSB1c2VyIHN0b3BzIHRoZSBmbGluZyBzY3JvbGwgd2l0aCBhbm90aGVyIHRhcFxuXHRcdFx0XHQvLyB0aGVuIHRoZSBldmVudC50YXJnZXQgb2YgdGhlIGxhc3QgJ3RvdWNoZW5kJyBldmVudCB3aWxsIGJlIHRoZSBlbGVtZW50IHRoYXQgd2FzIHVuZGVyIHRoZSB1c2VyJ3MgZmluZ2VyXG5cdFx0XHRcdC8vIHdoZW4gdGhlIGZsaW5nIHNjcm9sbCB3YXMgc3RhcnRlZCwgY2F1c2luZyBGYXN0Q2xpY2sgdG8gc2VuZCBhIGNsaWNrIGV2ZW50IHRvIHRoYXQgbGF5ZXIgLSB1bmxlc3MgYSBjaGVja1xuXHRcdFx0XHQvLyBpcyBtYWRlIHRvIGVuc3VyZSB0aGF0IGEgcGFyZW50IGxheWVyIHdhcyBub3Qgc2Nyb2xsZWQgYmVmb3JlIHNlbmRpbmcgYSBzeW50aGV0aWMgY2xpY2sgKGlzc3VlICM0MikuXG5cdFx0XHRcdHRoaXMudXBkYXRlU2Nyb2xsUGFyZW50KHRhcmdldEVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudHJhY2tpbmdDbGljayA9IHRydWU7XG5cdFx0dGhpcy50cmFja2luZ0NsaWNrU3RhcnQgPSBldmVudC50aW1lU3RhbXA7XG5cdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gdGFyZ2V0RWxlbWVudDtcblxuXHRcdHRoaXMudG91Y2hTdGFydFggPSB0b3VjaC5wYWdlWDtcblx0XHR0aGlzLnRvdWNoU3RhcnRZID0gdG91Y2gucGFnZVk7XG5cblx0XHQvLyBQcmV2ZW50IHBoYW50b20gY2xpY2tzIG9uIGZhc3QgZG91YmxlLXRhcCAoaXNzdWUgIzM2KVxuXHRcdGlmICgoZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0Q2xpY2tUaW1lKSA8IHRoaXMudGFwRGVsYXkpIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH07XG5cblxuXHQvKipcblx0ICogQmFzZWQgb24gYSB0b3VjaG1vdmUgZXZlbnQgb2JqZWN0LCBjaGVjayB3aGV0aGVyIHRoZSB0b3VjaCBoYXMgbW92ZWQgcGFzdCBhIGJvdW5kYXJ5IHNpbmNlIGl0IHN0YXJ0ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS50b3VjaEhhc01vdmVkID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1swXSwgYm91bmRhcnkgPSB0aGlzLnRvdWNoQm91bmRhcnk7XG5cblx0XHRpZiAoTWF0aC5hYnModG91Y2gucGFnZVggLSB0aGlzLnRvdWNoU3RhcnRYKSA+IGJvdW5kYXJ5IHx8IE1hdGguYWJzKHRvdWNoLnBhZ2VZIC0gdGhpcy50b3VjaFN0YXJ0WSkgPiBib3VuZGFyeSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIFVwZGF0ZSB0aGUgbGFzdCBwb3NpdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uVG91Y2hNb3ZlID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHRpZiAoIXRoaXMudHJhY2tpbmdDbGljaykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHRvdWNoIGhhcyBtb3ZlZCwgY2FuY2VsIHRoZSBjbGljayB0cmFja2luZ1xuXHRcdGlmICh0aGlzLnRhcmdldEVsZW1lbnQgIT09IHRoaXMuZ2V0VGFyZ2V0RWxlbWVudEZyb21FdmVudFRhcmdldChldmVudC50YXJnZXQpIHx8IHRoaXMudG91Y2hIYXNNb3ZlZChldmVudCkpIHtcblx0XHRcdHRoaXMudHJhY2tpbmdDbGljayA9IGZhbHNlO1xuXHRcdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBBdHRlbXB0IHRvIGZpbmQgdGhlIGxhYmVsbGVkIGNvbnRyb2wgZm9yIHRoZSBnaXZlbiBsYWJlbCBlbGVtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fEhUTUxMYWJlbEVsZW1lbnR9IGxhYmVsRWxlbWVudFxuXHQgKiBAcmV0dXJucyB7RWxlbWVudHxudWxsfVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5maW5kQ29udHJvbCA9IGZ1bmN0aW9uKGxhYmVsRWxlbWVudCkge1xuXG5cdFx0Ly8gRmFzdCBwYXRoIGZvciBuZXdlciBicm93c2VycyBzdXBwb3J0aW5nIHRoZSBIVE1MNSBjb250cm9sIGF0dHJpYnV0ZVxuXHRcdGlmIChsYWJlbEVsZW1lbnQuY29udHJvbCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gbGFiZWxFbGVtZW50LmNvbnRyb2w7XG5cdFx0fVxuXG5cdFx0Ly8gQWxsIGJyb3dzZXJzIHVuZGVyIHRlc3QgdGhhdCBzdXBwb3J0IHRvdWNoIGV2ZW50cyBhbHNvIHN1cHBvcnQgdGhlIEhUTUw1IGh0bWxGb3IgYXR0cmlidXRlXG5cdFx0aWYgKGxhYmVsRWxlbWVudC5odG1sRm9yKSB7XG5cdFx0XHRyZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobGFiZWxFbGVtZW50Lmh0bWxGb3IpO1xuXHRcdH1cblxuXHRcdC8vIElmIG5vIGZvciBhdHRyaWJ1dGUgZXhpc3RzLCBhdHRlbXB0IHRvIHJldHJpZXZlIHRoZSBmaXJzdCBsYWJlbGxhYmxlIGRlc2NlbmRhbnQgZWxlbWVudFxuXHRcdC8vIHRoZSBsaXN0IG9mIHdoaWNoIGlzIGRlZmluZWQgaGVyZTogaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvZm9ybXMuaHRtbCNjYXRlZ29yeS1sYWJlbFxuXHRcdHJldHVybiBsYWJlbEVsZW1lbnQucXVlcnlTZWxlY3RvcignYnV0dG9uLCBpbnB1dDpub3QoW3R5cGU9aGlkZGVuXSksIGtleWdlbiwgbWV0ZXIsIG91dHB1dCwgcHJvZ3Jlc3MsIHNlbGVjdCwgdGV4dGFyZWEnKTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBPbiB0b3VjaCBlbmQsIGRldGVybWluZSB3aGV0aGVyIHRvIHNlbmQgYSBjbGljayBldmVudCBhdCBvbmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUub25Ub3VjaEVuZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0dmFyIGZvckVsZW1lbnQsIHRyYWNraW5nQ2xpY2tTdGFydCwgdGFyZ2V0VGFnTmFtZSwgc2Nyb2xsUGFyZW50LCB0b3VjaCwgdGFyZ2V0RWxlbWVudCA9IHRoaXMudGFyZ2V0RWxlbWVudDtcblxuXHRcdGlmICghdGhpcy50cmFja2luZ0NsaWNrKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBQcmV2ZW50IHBoYW50b20gY2xpY2tzIG9uIGZhc3QgZG91YmxlLXRhcCAoaXNzdWUgIzM2KVxuXHRcdGlmICgoZXZlbnQudGltZVN0YW1wIC0gdGhpcy5sYXN0Q2xpY2tUaW1lKSA8IHRoaXMudGFwRGVsYXkpIHtcblx0XHRcdHRoaXMuY2FuY2VsTmV4dENsaWNrID0gdHJ1ZTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICgoZXZlbnQudGltZVN0YW1wIC0gdGhpcy50cmFja2luZ0NsaWNrU3RhcnQpID4gdGhpcy50YXBUaW1lb3V0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBSZXNldCB0byBwcmV2ZW50IHdyb25nIGNsaWNrIGNhbmNlbCBvbiBpbnB1dCAoaXNzdWUgIzE1NikuXG5cdFx0dGhpcy5jYW5jZWxOZXh0Q2xpY2sgPSBmYWxzZTtcblxuXHRcdHRoaXMubGFzdENsaWNrVGltZSA9IGV2ZW50LnRpbWVTdGFtcDtcblxuXHRcdHRyYWNraW5nQ2xpY2tTdGFydCA9IHRoaXMudHJhY2tpbmdDbGlja1N0YXJ0O1xuXHRcdHRoaXMudHJhY2tpbmdDbGljayA9IGZhbHNlO1xuXHRcdHRoaXMudHJhY2tpbmdDbGlja1N0YXJ0ID0gMDtcblxuXHRcdC8vIE9uIHNvbWUgaU9TIGRldmljZXMsIHRoZSB0YXJnZXRFbGVtZW50IHN1cHBsaWVkIHdpdGggdGhlIGV2ZW50IGlzIGludmFsaWQgaWYgdGhlIGxheWVyXG5cdFx0Ly8gaXMgcGVyZm9ybWluZyBhIHRyYW5zaXRpb24gb3Igc2Nyb2xsLCBhbmQgaGFzIHRvIGJlIHJlLWRldGVjdGVkIG1hbnVhbGx5LiBOb3RlIHRoYXRcblx0XHQvLyBmb3IgdGhpcyB0byBmdW5jdGlvbiBjb3JyZWN0bHksIGl0IG11c3QgYmUgY2FsbGVkICphZnRlciogdGhlIGV2ZW50IHRhcmdldCBpcyBjaGVja2VkIVxuXHRcdC8vIFNlZSBpc3N1ZSAjNTc7IGFsc28gZmlsZWQgYXMgcmRhcjovLzEzMDQ4NTg5IC5cblx0XHRpZiAoZGV2aWNlSXNJT1NXaXRoQmFkVGFyZ2V0KSB7XG5cdFx0XHR0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdO1xuXG5cdFx0XHQvLyBJbiBjZXJ0YWluIGNhc2VzIGFyZ3VtZW50cyBvZiBlbGVtZW50RnJvbVBvaW50IGNhbiBiZSBuZWdhdGl2ZSwgc28gcHJldmVudCBzZXR0aW5nIHRhcmdldEVsZW1lbnQgdG8gbnVsbFxuXHRcdFx0dGFyZ2V0RWxlbWVudCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQodG91Y2gucGFnZVggLSB3aW5kb3cucGFnZVhPZmZzZXQsIHRvdWNoLnBhZ2VZIC0gd2luZG93LnBhZ2VZT2Zmc2V0KSB8fCB0YXJnZXRFbGVtZW50O1xuXHRcdFx0dGFyZ2V0RWxlbWVudC5mYXN0Q2xpY2tTY3JvbGxQYXJlbnQgPSB0aGlzLnRhcmdldEVsZW1lbnQuZmFzdENsaWNrU2Nyb2xsUGFyZW50O1xuXHRcdH1cblxuXHRcdHRhcmdldFRhZ05hbWUgPSB0YXJnZXRFbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcblx0XHRpZiAodGFyZ2V0VGFnTmFtZSA9PT0gJ2xhYmVsJykge1xuXHRcdFx0Zm9yRWxlbWVudCA9IHRoaXMuZmluZENvbnRyb2wodGFyZ2V0RWxlbWVudCk7XG5cdFx0XHRpZiAoZm9yRWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLmZvY3VzKHRhcmdldEVsZW1lbnQpO1xuXHRcdFx0XHRpZiAoZGV2aWNlSXNBbmRyb2lkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGFyZ2V0RWxlbWVudCA9IGZvckVsZW1lbnQ7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLm5lZWRzRm9jdXModGFyZ2V0RWxlbWVudCkpIHtcblxuXHRcdFx0Ly8gQ2FzZSAxOiBJZiB0aGUgdG91Y2ggc3RhcnRlZCBhIHdoaWxlIGFnbyAoYmVzdCBndWVzcyBpcyAxMDBtcyBiYXNlZCBvbiB0ZXN0cyBmb3IgaXNzdWUgIzM2KSB0aGVuIGZvY3VzIHdpbGwgYmUgdHJpZ2dlcmVkIGFueXdheS4gUmV0dXJuIGVhcmx5IGFuZCB1bnNldCB0aGUgdGFyZ2V0IGVsZW1lbnQgcmVmZXJlbmNlIHNvIHRoYXQgdGhlIHN1YnNlcXVlbnQgY2xpY2sgd2lsbCBiZSBhbGxvd2VkIHRocm91Z2guXG5cdFx0XHQvLyBDYXNlIDI6IFdpdGhvdXQgdGhpcyBleGNlcHRpb24gZm9yIGlucHV0IGVsZW1lbnRzIHRhcHBlZCB3aGVuIHRoZSBkb2N1bWVudCBpcyBjb250YWluZWQgaW4gYW4gaWZyYW1lLCB0aGVuIGFueSBpbnB1dHRlZCB0ZXh0IHdvbid0IGJlIHZpc2libGUgZXZlbiB0aG91Z2ggdGhlIHZhbHVlIGF0dHJpYnV0ZSBpcyB1cGRhdGVkIGFzIHRoZSB1c2VyIHR5cGVzIChpc3N1ZSAjMzcpLlxuXHRcdFx0aWYgKChldmVudC50aW1lU3RhbXAgLSB0cmFja2luZ0NsaWNrU3RhcnQpID4gMTAwIHx8IChkZXZpY2VJc0lPUyAmJiB3aW5kb3cudG9wICE9PSB3aW5kb3cgJiYgdGFyZ2V0VGFnTmFtZSA9PT0gJ2lucHV0JykpIHtcblx0XHRcdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmZvY3VzKHRhcmdldEVsZW1lbnQpO1xuXHRcdFx0dGhpcy5zZW5kQ2xpY2sodGFyZ2V0RWxlbWVudCwgZXZlbnQpO1xuXG5cdFx0XHQvLyBTZWxlY3QgZWxlbWVudHMgbmVlZCB0aGUgZXZlbnQgdG8gZ28gdGhyb3VnaCBvbiBpT1MgNCwgb3RoZXJ3aXNlIHRoZSBzZWxlY3RvciBtZW51IHdvbid0IG9wZW4uXG5cdFx0XHQvLyBBbHNvIHRoaXMgYnJlYWtzIG9wZW5pbmcgc2VsZWN0cyB3aGVuIFZvaWNlT3ZlciBpcyBhY3RpdmUgb24gaU9TNiwgaU9TNyAoYW5kIHBvc3NpYmx5IG90aGVycylcblx0XHRcdGlmICghZGV2aWNlSXNJT1MgfHwgdGFyZ2V0VGFnTmFtZSAhPT0gJ3NlbGVjdCcpIHtcblx0XHRcdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChkZXZpY2VJc0lPUyAmJiAhZGV2aWNlSXNJT1M0KSB7XG5cblx0XHRcdC8vIERvbid0IHNlbmQgYSBzeW50aGV0aWMgY2xpY2sgZXZlbnQgaWYgdGhlIHRhcmdldCBlbGVtZW50IGlzIGNvbnRhaW5lZCB3aXRoaW4gYSBwYXJlbnQgbGF5ZXIgdGhhdCB3YXMgc2Nyb2xsZWRcblx0XHRcdC8vIGFuZCB0aGlzIHRhcCBpcyBiZWluZyB1c2VkIHRvIHN0b3AgdGhlIHNjcm9sbGluZyAodXN1YWxseSBpbml0aWF0ZWQgYnkgYSBmbGluZyAtIGlzc3VlICM0MikuXG5cdFx0XHRzY3JvbGxQYXJlbnQgPSB0YXJnZXRFbGVtZW50LmZhc3RDbGlja1Njcm9sbFBhcmVudDtcblx0XHRcdGlmIChzY3JvbGxQYXJlbnQgJiYgc2Nyb2xsUGFyZW50LmZhc3RDbGlja0xhc3RTY3JvbGxUb3AgIT09IHNjcm9sbFBhcmVudC5zY3JvbGxUb3ApIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUHJldmVudCB0aGUgYWN0dWFsIGNsaWNrIGZyb20gZ29pbmcgdGhvdWdoIC0gdW5sZXNzIHRoZSB0YXJnZXQgbm9kZSBpcyBtYXJrZWQgYXMgcmVxdWlyaW5nXG5cdFx0Ly8gcmVhbCBjbGlja3Mgb3IgaWYgaXQgaXMgaW4gdGhlIHdoaXRlbGlzdCBpbiB3aGljaCBjYXNlIG9ubHkgbm9uLXByb2dyYW1tYXRpYyBjbGlja3MgYXJlIHBlcm1pdHRlZC5cblx0XHRpZiAoIXRoaXMubmVlZHNDbGljayh0YXJnZXRFbGVtZW50KSkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuc2VuZENsaWNrKHRhcmdldEVsZW1lbnQsIGV2ZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH07XG5cblxuXHQvKipcblx0ICogT24gdG91Y2ggY2FuY2VsLCBzdG9wIHRyYWNraW5nIHRoZSBjbGljay5cblx0ICpcblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uVG91Y2hDYW5jZWwgPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnRyYWNraW5nQ2xpY2sgPSBmYWxzZTtcblx0XHR0aGlzLnRhcmdldEVsZW1lbnQgPSBudWxsO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIERldGVybWluZSBtb3VzZSBldmVudHMgd2hpY2ggc2hvdWxkIGJlIHBlcm1pdHRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uTW91c2UgPSBmdW5jdGlvbihldmVudCkge1xuXG5cdFx0Ly8gSWYgYSB0YXJnZXQgZWxlbWVudCB3YXMgbmV2ZXIgc2V0IChiZWNhdXNlIGEgdG91Y2ggZXZlbnQgd2FzIG5ldmVyIGZpcmVkKSBhbGxvdyB0aGUgZXZlbnRcblx0XHRpZiAoIXRoaXMudGFyZ2V0RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50LmZvcndhcmRlZFRvdWNoRXZlbnQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFByb2dyYW1tYXRpY2FsbHkgZ2VuZXJhdGVkIGV2ZW50cyB0YXJnZXRpbmcgYSBzcGVjaWZpYyBlbGVtZW50IHNob3VsZCBiZSBwZXJtaXR0ZWRcblx0XHRpZiAoIWV2ZW50LmNhbmNlbGFibGUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIERlcml2ZSBhbmQgY2hlY2sgdGhlIHRhcmdldCBlbGVtZW50IHRvIHNlZSB3aGV0aGVyIHRoZSBtb3VzZSBldmVudCBuZWVkcyB0byBiZSBwZXJtaXR0ZWQ7XG5cdFx0Ly8gdW5sZXNzIGV4cGxpY2l0bHkgZW5hYmxlZCwgcHJldmVudCBub24tdG91Y2ggY2xpY2sgZXZlbnRzIGZyb20gdHJpZ2dlcmluZyBhY3Rpb25zLFxuXHRcdC8vIHRvIHByZXZlbnQgZ2hvc3QvZG91YmxlY2xpY2tzLlxuXHRcdGlmICghdGhpcy5uZWVkc0NsaWNrKHRoaXMudGFyZ2V0RWxlbWVudCkgfHwgdGhpcy5jYW5jZWxOZXh0Q2xpY2spIHtcblxuXHRcdFx0Ly8gUHJldmVudCBhbnkgdXNlci1hZGRlZCBsaXN0ZW5lcnMgZGVjbGFyZWQgb24gRmFzdENsaWNrIGVsZW1lbnQgZnJvbSBiZWluZyBmaXJlZC5cblx0XHRcdGlmIChldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24pIHtcblx0XHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vIFBhcnQgb2YgdGhlIGhhY2sgZm9yIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBFdmVudCNzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24gKGUuZy4gQW5kcm9pZCAyKVxuXHRcdFx0XHRldmVudC5wcm9wYWdhdGlvblN0b3BwZWQgPSB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDYW5jZWwgdGhlIGV2ZW50XG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGUgbW91c2UgZXZlbnQgaXMgcGVybWl0dGVkLCByZXR1cm4gdHJ1ZSBmb3IgdGhlIGFjdGlvbiB0byBnbyB0aHJvdWdoLlxuXHRcdHJldHVybiB0cnVlO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIE9uIGFjdHVhbCBjbGlja3MsIGRldGVybWluZSB3aGV0aGVyIHRoaXMgaXMgYSB0b3VjaC1nZW5lcmF0ZWQgY2xpY2ssIGEgY2xpY2sgYWN0aW9uIG9jY3VycmluZ1xuXHQgKiBuYXR1cmFsbHkgYWZ0ZXIgYSBkZWxheSBhZnRlciBhIHRvdWNoICh3aGljaCBuZWVkcyB0byBiZSBjYW5jZWxsZWQgdG8gYXZvaWQgZHVwbGljYXRpb24pLCBvclxuXHQgKiBhbiBhY3R1YWwgY2xpY2sgd2hpY2ggc2hvdWxkIGJlIHBlcm1pdHRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uQ2xpY2sgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdHZhciBwZXJtaXR0ZWQ7XG5cblx0XHQvLyBJdCdzIHBvc3NpYmxlIGZvciBhbm90aGVyIEZhc3RDbGljay1saWtlIGxpYnJhcnkgZGVsaXZlcmVkIHdpdGggdGhpcmQtcGFydHkgY29kZSB0byBmaXJlIGEgY2xpY2sgZXZlbnQgYmVmb3JlIEZhc3RDbGljayBkb2VzIChpc3N1ZSAjNDQpLiBJbiB0aGF0IGNhc2UsIHNldCB0aGUgY2xpY2stdHJhY2tpbmcgZmxhZyBiYWNrIHRvIGZhbHNlIGFuZCByZXR1cm4gZWFybHkuIFRoaXMgd2lsbCBjYXVzZSBvblRvdWNoRW5kIHRvIHJldHVybiBlYXJseS5cblx0XHRpZiAodGhpcy50cmFja2luZ0NsaWNrKSB7XG5cdFx0XHR0aGlzLnRhcmdldEVsZW1lbnQgPSBudWxsO1xuXHRcdFx0dGhpcy50cmFja2luZ0NsaWNrID0gZmFsc2U7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBWZXJ5IG9kZCBiZWhhdmlvdXIgb24gaU9TIChpc3N1ZSAjMTgpOiBpZiBhIHN1Ym1pdCBlbGVtZW50IGlzIHByZXNlbnQgaW5zaWRlIGEgZm9ybSBhbmQgdGhlIHVzZXIgaGl0cyBlbnRlciBpbiB0aGUgaU9TIHNpbXVsYXRvciBvciBjbGlja3MgdGhlIEdvIGJ1dHRvbiBvbiB0aGUgcG9wLXVwIE9TIGtleWJvYXJkIHRoZSBhIGtpbmQgb2YgJ2Zha2UnIGNsaWNrIGV2ZW50IHdpbGwgYmUgdHJpZ2dlcmVkIHdpdGggdGhlIHN1Ym1pdC10eXBlIGlucHV0IGVsZW1lbnQgYXMgdGhlIHRhcmdldC5cblx0XHRpZiAoZXZlbnQudGFyZ2V0LnR5cGUgPT09ICdzdWJtaXQnICYmIGV2ZW50LmRldGFpbCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cGVybWl0dGVkID0gdGhpcy5vbk1vdXNlKGV2ZW50KTtcblxuXHRcdC8vIE9ubHkgdW5zZXQgdGFyZ2V0RWxlbWVudCBpZiB0aGUgY2xpY2sgaXMgbm90IHBlcm1pdHRlZC4gVGhpcyB3aWxsIGVuc3VyZSB0aGF0IHRoZSBjaGVjayBmb3IgIXRhcmdldEVsZW1lbnQgaW4gb25Nb3VzZSBmYWlscyBhbmQgdGhlIGJyb3dzZXIncyBjbGljayBkb2Vzbid0IGdvIHRocm91Z2guXG5cdFx0aWYgKCFwZXJtaXR0ZWQpIHtcblx0XHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgY2xpY2tzIGFyZSBwZXJtaXR0ZWQsIHJldHVybiB0cnVlIGZvciB0aGUgYWN0aW9uIHRvIGdvIHRocm91Z2guXG5cdFx0cmV0dXJuIHBlcm1pdHRlZDtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgYWxsIEZhc3RDbGljaydzIGV2ZW50IGxpc3RlbmVycy5cblx0ICpcblx0ICogQHJldHVybnMge3ZvaWR9XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgbGF5ZXIgPSB0aGlzLmxheWVyO1xuXG5cdFx0aWYgKGRldmljZUlzQW5kcm9pZCkge1xuXHRcdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgdGhpcy5vbk1vdXNlLCB0cnVlKTtcblx0XHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZSwgdHJ1ZSk7XG5cdFx0XHRsYXllci5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5vbk1vdXNlLCB0cnVlKTtcblx0XHR9XG5cblx0XHRsYXllci5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMub25DbGljaywgdHJ1ZSk7XG5cdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMub25Ub3VjaFN0YXJ0LCBmYWxzZSk7XG5cdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5vblRvdWNoTW92ZSwgZmFsc2UpO1xuXHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy5vblRvdWNoRW5kLCBmYWxzZSk7XG5cdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCB0aGlzLm9uVG91Y2hDYW5jZWwsIGZhbHNlKTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBDaGVjayB3aGV0aGVyIEZhc3RDbGljayBpcyBuZWVkZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gbGF5ZXIgVGhlIGxheWVyIHRvIGxpc3RlbiBvblxuXHQgKi9cblx0RmFzdENsaWNrLm5vdE5lZWRlZCA9IGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0dmFyIG1ldGFWaWV3cG9ydDtcblx0XHR2YXIgY2hyb21lVmVyc2lvbjtcblx0XHR2YXIgYmxhY2tiZXJyeVZlcnNpb247XG5cdFx0dmFyIGZpcmVmb3hWZXJzaW9uO1xuXG5cdFx0Ly8gRGV2aWNlcyB0aGF0IGRvbid0IHN1cHBvcnQgdG91Y2ggZG9uJ3QgbmVlZCBGYXN0Q2xpY2tcblx0XHRpZiAodHlwZW9mIHdpbmRvdy5vbnRvdWNoc3RhcnQgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBDaHJvbWUgdmVyc2lvbiAtIHplcm8gZm9yIG90aGVyIGJyb3dzZXJzXG5cdFx0Y2hyb21lVmVyc2lvbiA9ICsoL0Nocm9tZVxcLyhbMC05XSspLy5leGVjKG5hdmlnYXRvci51c2VyQWdlbnQpIHx8IFssMF0pWzFdO1xuXG5cdFx0aWYgKGNocm9tZVZlcnNpb24pIHtcblxuXHRcdFx0aWYgKGRldmljZUlzQW5kcm9pZCkge1xuXHRcdFx0XHRtZXRhVmlld3BvcnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9dmlld3BvcnRdJyk7XG5cblx0XHRcdFx0aWYgKG1ldGFWaWV3cG9ydCkge1xuXHRcdFx0XHRcdC8vIENocm9tZSBvbiBBbmRyb2lkIHdpdGggdXNlci1zY2FsYWJsZT1cIm5vXCIgZG9lc24ndCBuZWVkIEZhc3RDbGljayAoaXNzdWUgIzg5KVxuXHRcdFx0XHRcdGlmIChtZXRhVmlld3BvcnQuY29udGVudC5pbmRleE9mKCd1c2VyLXNjYWxhYmxlPW5vJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gQ2hyb21lIDMyIGFuZCBhYm92ZSB3aXRoIHdpZHRoPWRldmljZS13aWR0aCBvciBsZXNzIGRvbid0IG5lZWQgRmFzdENsaWNrXG5cdFx0XHRcdFx0aWYgKGNocm9tZVZlcnNpb24gPiAzMSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsV2lkdGggPD0gd2luZG93Lm91dGVyV2lkdGgpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHQvLyBDaHJvbWUgZGVza3RvcCBkb2Vzbid0IG5lZWQgRmFzdENsaWNrIChpc3N1ZSAjMTUpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGV2aWNlSXNCbGFja0JlcnJ5MTApIHtcblx0XHRcdGJsYWNrYmVycnlWZXJzaW9uID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5tYXRjaCgvVmVyc2lvblxcLyhbMC05XSopXFwuKFswLTldKikvKTtcblxuXHRcdFx0Ly8gQmxhY2tCZXJyeSAxMC4zKyBkb2VzIG5vdCByZXF1aXJlIEZhc3RjbGljayBsaWJyYXJ5LlxuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2Z0bGFicy9mYXN0Y2xpY2svaXNzdWVzLzI1MVxuXHRcdFx0aWYgKGJsYWNrYmVycnlWZXJzaW9uWzFdID49IDEwICYmIGJsYWNrYmVycnlWZXJzaW9uWzJdID49IDMpIHtcblx0XHRcdFx0bWV0YVZpZXdwb3J0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPXZpZXdwb3J0XScpO1xuXG5cdFx0XHRcdGlmIChtZXRhVmlld3BvcnQpIHtcblx0XHRcdFx0XHQvLyB1c2VyLXNjYWxhYmxlPW5vIGVsaW1pbmF0ZXMgY2xpY2sgZGVsYXkuXG5cdFx0XHRcdFx0aWYgKG1ldGFWaWV3cG9ydC5jb250ZW50LmluZGV4T2YoJ3VzZXItc2NhbGFibGU9bm8nKSAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyB3aWR0aD1kZXZpY2Utd2lkdGggKG9yIGxlc3MgdGhhbiBkZXZpY2Utd2lkdGgpIGVsaW1pbmF0ZXMgY2xpY2sgZGVsYXkuXG5cdFx0XHRcdFx0aWYgKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxXaWR0aCA8PSB3aW5kb3cub3V0ZXJXaWR0aCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSUUxMCB3aXRoIC1tcy10b3VjaC1hY3Rpb246IG5vbmUgb3IgbWFuaXB1bGF0aW9uLCB3aGljaCBkaXNhYmxlcyBkb3VibGUtdGFwLXRvLXpvb20gKGlzc3VlICM5Nylcblx0XHRpZiAobGF5ZXIuc3R5bGUubXNUb3VjaEFjdGlvbiA9PT0gJ25vbmUnIHx8IGxheWVyLnN0eWxlLnRvdWNoQWN0aW9uID09PSAnbWFuaXB1bGF0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gRmlyZWZveCB2ZXJzaW9uIC0gemVybyBmb3Igb3RoZXIgYnJvd3NlcnNcblx0XHRmaXJlZm94VmVyc2lvbiA9ICsoL0ZpcmVmb3hcXC8oWzAtOV0rKS8uZXhlYyhuYXZpZ2F0b3IudXNlckFnZW50KSB8fCBbLDBdKVsxXTtcblxuXHRcdGlmIChmaXJlZm94VmVyc2lvbiA+PSAyNykge1xuXHRcdFx0Ly8gRmlyZWZveCAyNysgZG9lcyBub3QgaGF2ZSB0YXAgZGVsYXkgaWYgdGhlIGNvbnRlbnQgaXMgbm90IHpvb21hYmxlIC0gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9OTIyODk2XG5cblx0XHRcdG1ldGFWaWV3cG9ydCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT12aWV3cG9ydF0nKTtcblx0XHRcdGlmIChtZXRhVmlld3BvcnQgJiYgKG1ldGFWaWV3cG9ydC5jb250ZW50LmluZGV4T2YoJ3VzZXItc2NhbGFibGU9bm8nKSAhPT0gLTEgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFdpZHRoIDw9IHdpbmRvdy5vdXRlcldpZHRoKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJRTExOiBwcmVmaXhlZCAtbXMtdG91Y2gtYWN0aW9uIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQgYW5kIGl0J3MgcmVjb21lbmRlZCB0byB1c2Ugbm9uLXByZWZpeGVkIHZlcnNpb25cblx0XHQvLyBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvd2luZG93cy9hcHBzL0hoNzY3MzEzLmFzcHhcblx0XHRpZiAobGF5ZXIuc3R5bGUudG91Y2hBY3Rpb24gPT09ICdub25lJyB8fCBsYXllci5zdHlsZS50b3VjaEFjdGlvbiA9PT0gJ21hbmlwdWxhdGlvbicpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBGYWN0b3J5IG1ldGhvZCBmb3IgY3JlYXRpbmcgYSBGYXN0Q2xpY2sgb2JqZWN0XG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gbGF5ZXIgVGhlIGxheWVyIHRvIGxpc3RlbiBvblxuXHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIFRoZSBvcHRpb25zIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0c1xuXHQgKi9cblx0RmFzdENsaWNrLmF0dGFjaCA9IGZ1bmN0aW9uKGxheWVyLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIG5ldyBGYXN0Q2xpY2sobGF5ZXIsIG9wdGlvbnMpO1xuXHR9O1xuXG5cblx0aWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcblxuXHRcdC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gRmFzdENsaWNrO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBGYXN0Q2xpY2suYXR0YWNoO1xuXHRcdG1vZHVsZS5leHBvcnRzLkZhc3RDbGljayA9IEZhc3RDbGljaztcblx0fSBlbHNlIHtcblx0XHR3aW5kb3cuRmFzdENsaWNrID0gRmFzdENsaWNrO1xuXHR9XG59KCkpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCdXJzdCwgU3dpcmwsIFRyYW5zaXQsIGJpdHNNYXAsIGgsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgYml0c01hcCA9IHJlcXVpcmUoJy4vc2hhcGVzL2JpdHNNYXAnKTtcblxuICBUcmFuc2l0ID0gcmVxdWlyZSgnLi90cmFuc2l0Jyk7XG5cbiAgU3dpcmwgPSByZXF1aXJlKCcuL3N3aXJsJyk7XG5cbiAgaCA9IHJlcXVpcmUoJy4vaCcpO1xuXG4gIEJ1cnN0ID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhCdXJzdCwgX3N1cGVyKTtcblxuICAgIGZ1bmN0aW9uIEJ1cnN0KCkge1xuICAgICAgcmV0dXJuIEJ1cnN0Ll9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIEJ1cnN0LnByb3RvdHlwZS5za2lwUHJvcHMgPSB7XG4gICAgICBjaGlsZE9wdGlvbnM6IDFcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmRlZmF1bHRzID0ge1xuICAgICAgY291bnQ6IDUsXG4gICAgICBkZWdyZWU6IDM2MCxcbiAgICAgIG9wYWNpdHk6IDEsXG4gICAgICByYW5kb21BbmdsZTogMCxcbiAgICAgIHJhbmRvbVJhZGl1czogMCxcbiAgICAgIHg6IDEwMCxcbiAgICAgIHk6IDEwMCxcbiAgICAgIHNoaWZ0WDogMCxcbiAgICAgIHNoaWZ0WTogMCxcbiAgICAgIGVhc2luZzogJ0xpbmVhci5Ob25lJyxcbiAgICAgIHJhZGl1czoge1xuICAgICAgICAyNTogNzVcbiAgICAgIH0sXG4gICAgICByYWRpdXNYOiB2b2lkIDAsXG4gICAgICByYWRpdXNZOiB2b2lkIDAsXG4gICAgICBhbmdsZTogMCxcbiAgICAgIHNpemU6IG51bGwsXG4gICAgICBzaXplR2FwOiAwLFxuICAgICAgZHVyYXRpb246IDYwMCxcbiAgICAgIGRlbGF5OiAwLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uQ29tcGxldGU6IG51bGwsXG4gICAgICBvbkNvbXBsZXRlQ2hhaW46IG51bGwsXG4gICAgICBvblVwZGF0ZTogbnVsbCxcbiAgICAgIGlzUmVzZXRBbmdsZXM6IGZhbHNlXG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5jaGlsZERlZmF1bHRzID0ge1xuICAgICAgcmFkaXVzOiB7XG4gICAgICAgIDc6IDBcbiAgICAgIH0sXG4gICAgICByYWRpdXNYOiB2b2lkIDAsXG4gICAgICByYWRpdXNZOiB2b2lkIDAsXG4gICAgICBhbmdsZTogMCxcbiAgICAgIG9wYWNpdHk6IDEsXG4gICAgICBvblN0YXJ0OiBudWxsLFxuICAgICAgb25Db21wbGV0ZTogbnVsbCxcbiAgICAgIG9uVXBkYXRlOiBudWxsLFxuICAgICAgcG9pbnRzOiAzLFxuICAgICAgZHVyYXRpb246IDUwMCxcbiAgICAgIGRlbGF5OiAwLFxuICAgICAgcmVwZWF0OiAwLFxuICAgICAgeW95bzogZmFsc2UsXG4gICAgICBlYXNpbmc6ICdMaW5lYXIuTm9uZScsXG4gICAgICB0eXBlOiAnY2lyY2xlJyxcbiAgICAgIGZpbGw6ICdkZWVwcGluaycsXG4gICAgICBmaWxsT3BhY2l0eTogMSxcbiAgICAgIGlzU3dpcmw6IGZhbHNlLFxuICAgICAgc3dpcmxTaXplOiAxMCxcbiAgICAgIHN3aXJsRnJlcXVlbmN5OiAzLFxuICAgICAgc3Ryb2tlOiAndHJhbnNwYXJlbnQnLFxuICAgICAgc3Ryb2tlV2lkdGg6IDAsXG4gICAgICBzdHJva2VPcGFjaXR5OiAxLFxuICAgICAgc3Ryb2tlRGFzaGFycmF5OiAnJyxcbiAgICAgIHN0cm9rZURhc2hvZmZzZXQ6ICcnLFxuICAgICAgc3Ryb2tlTGluZWNhcDogbnVsbFxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUub3B0aW9uc0ludGVyc2VjdGlvbiA9IHtcbiAgICAgIHJhZGl1czogMSxcbiAgICAgIHJhZGl1c1g6IDEsXG4gICAgICByYWRpdXNZOiAxLFxuICAgICAgYW5nbGU6IDEsXG4gICAgICBvcGFjaXR5OiAxLFxuICAgICAgb25TdGFydDogMSxcbiAgICAgIG9uQ29tcGxldGU6IDEsXG4gICAgICBvblVwZGF0ZTogMVxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGksIGtleSwga2V5cywgbGVuLCBvcHRpb24sIHRyLCBfYmFzZSwgX2ksIF9sZW4sIF9yZWYsIF9yZWYxO1xuICAgICAgaWYgKChvICE9IG51bGwpICYmIE9iamVjdC5rZXlzKG8pLmxlbmd0aCkge1xuICAgICAgICBpZiAoby5jb3VudCB8fCAoKF9yZWYgPSBvLmNoaWxkT3B0aW9ucykgIT0gbnVsbCA/IF9yZWYuY291bnQgOiB2b2lkIDApKSB7XG4gICAgICAgICAgdGhpcy5oLndhcm4oJ1NvcnJ5LCBjb3VudCBjYW4gbm90IGJlIGNoYW5nZWQgb24gcnVuJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leHRlbmREZWZhdWx0cyhvKTtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKG8uY2hpbGRPcHRpb25zIHx8IHt9KTtcbiAgICAgICAgaWYgKChfYmFzZSA9IHRoaXMubykuY2hpbGRPcHRpb25zID09IG51bGwpIHtcbiAgICAgICAgICBfYmFzZS5jaGlsZE9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBrZXlzLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgICAgdGhpcy5vLmNoaWxkT3B0aW9uc1trZXldID0gby5jaGlsZE9wdGlvbnNba2V5XTtcbiAgICAgICAgfVxuICAgICAgICBsZW4gPSB0aGlzLnRyYW5zaXRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgICAgb3B0aW9uID0gdGhpcy5nZXRPcHRpb24obGVuKTtcbiAgICAgICAgICBpZiAoKCgoX3JlZjEgPSBvLmNoaWxkT3B0aW9ucykgIT0gbnVsbCA/IF9yZWYxLmFuZ2xlIDogdm9pZCAwKSA9PSBudWxsKSAmJiAoby5hbmdsZVNoaWZ0ID09IG51bGwpKSB7XG4gICAgICAgICAgICBvcHRpb24uYW5nbGUgPSB0aGlzLnRyYW5zaXRzW2xlbl0uby5hbmdsZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKCFvLmlzUmVzZXRBbmdsZXMpIHtcbiAgICAgICAgICAgIG9wdGlvbi5hbmdsZSA9IHRoaXMuZ2V0Qml0QW5nbGUob3B0aW9uLmFuZ2xlLCBsZW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnRyYW5zaXRzW2xlbl0udHVuZU5ld09wdGlvbihvcHRpb24sIHRydWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudGltZWxpbmUucmVjYWxjRHVyYXRpb24oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnByb3BzLnJhbmRvbUFuZ2xlIHx8IHRoaXMucHJvcHMucmFuZG9tUmFkaXVzKSB7XG4gICAgICAgIGxlbiA9IHRoaXMudHJhbnNpdHMubGVuZ3RoO1xuICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICB0ciA9IHRoaXMudHJhbnNpdHNbbGVuXTtcbiAgICAgICAgICB0aGlzLnByb3BzLnJhbmRvbUFuZ2xlICYmIHRyLnNldFByb3Aoe1xuICAgICAgICAgICAgYW5nbGVTaGlmdDogdGhpcy5nZW5lcmF0ZVJhbmRvbUFuZ2xlKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLnByb3BzLnJhbmRvbVJhZGl1cyAmJiB0ci5zZXRQcm9wKHtcbiAgICAgICAgICAgIHJhZGl1c1NjYWxlOiB0aGlzLmdlbmVyYXRlUmFuZG9tUmFkaXVzKClcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RhcnRUd2VlbigpO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuY3JlYXRlQml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgb3B0aW9uLCBfaSwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICB0aGlzLnRyYW5zaXRzID0gW107XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfcmVmID0gdGhpcy5wcm9wcy5jb3VudDsgMCA8PSBfcmVmID8gX2kgPCBfcmVmIDogX2kgPiBfcmVmOyBpID0gMCA8PSBfcmVmID8gKytfaSA6IC0tX2kpIHtcbiAgICAgICAgb3B0aW9uID0gdGhpcy5nZXRPcHRpb24oaSk7XG4gICAgICAgIG9wdGlvbi5jdHggPSB0aGlzLmN0eDtcbiAgICAgICAgb3B0aW9uLmluZGV4ID0gaTtcbiAgICAgICAgb3B0aW9uLmlzRHJhd0xlc3MgPSBvcHRpb24uaXNSdW5MZXNzID0gb3B0aW9uLmlzVHdlZW5MZXNzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5wcm9wcy5yYW5kb21BbmdsZSAmJiAob3B0aW9uLmFuZ2xlU2hpZnQgPSB0aGlzLmdlbmVyYXRlUmFuZG9tQW5nbGUoKSk7XG4gICAgICAgIHRoaXMucHJvcHMucmFuZG9tUmFkaXVzICYmIChvcHRpb24ucmFkaXVzU2NhbGUgPSB0aGlzLmdlbmVyYXRlUmFuZG9tUmFkaXVzKCkpO1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMudHJhbnNpdHMucHVzaChuZXcgU3dpcmwob3B0aW9uKSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuYWRkQml0T3B0aW9ucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFTaGlmdCwgaSwgcG9pbnRFbmQsIHBvaW50U3RhcnQsIHBvaW50cywgc3RlcCwgdHJhbnNpdCwgX2ksIF9sZW4sIF9yZWYsIF9yZXN1bHRzO1xuICAgICAgcG9pbnRzID0gdGhpcy5wcm9wcy5jb3VudDtcbiAgICAgIHRoaXMuZGVncmVlQ250ID0gdGhpcy5wcm9wcy5kZWdyZWUgJSAzNjAgPT09IDAgPyBwb2ludHMgOiBwb2ludHMgLSAxIHx8IDE7XG4gICAgICBzdGVwID0gdGhpcy5wcm9wcy5kZWdyZWUgLyB0aGlzLmRlZ3JlZUNudDtcbiAgICAgIF9yZWYgPSB0aGlzLnRyYW5zaXRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IF9yZWYubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgIHRyYW5zaXQgPSBfcmVmW2ldO1xuICAgICAgICBhU2hpZnQgPSB0cmFuc2l0LnByb3BzLmFuZ2xlU2hpZnQgfHwgMDtcbiAgICAgICAgcG9pbnRTdGFydCA9IHRoaXMuZ2V0U2lkZVBvaW50KCdzdGFydCcsIGkgKiBzdGVwICsgYVNoaWZ0KTtcbiAgICAgICAgcG9pbnRFbmQgPSB0aGlzLmdldFNpZGVQb2ludCgnZW5kJywgaSAqIHN0ZXAgKyBhU2hpZnQpO1xuICAgICAgICB0cmFuc2l0Lm8ueCA9IHRoaXMuZ2V0RGVsdGFGcm9tUG9pbnRzKCd4JywgcG9pbnRTdGFydCwgcG9pbnRFbmQpO1xuICAgICAgICB0cmFuc2l0Lm8ueSA9IHRoaXMuZ2V0RGVsdGFGcm9tUG9pbnRzKCd5JywgcG9pbnRTdGFydCwgcG9pbnRFbmQpO1xuICAgICAgICBpZiAoIXRoaXMucHJvcHMuaXNSZXNldEFuZ2xlcykge1xuICAgICAgICAgIHRyYW5zaXQuby5hbmdsZSA9IHRoaXMuZ2V0Qml0QW5nbGUodHJhbnNpdC5vLmFuZ2xlLCBpKTtcbiAgICAgICAgfVxuICAgICAgICBfcmVzdWx0cy5wdXNoKHRyYW5zaXQuZXh0ZW5kRGVmYXVsdHMoKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5nZXRCaXRBbmdsZSA9IGZ1bmN0aW9uKGFuZ2xlLCBpKSB7XG4gICAgICB2YXIgYW5nbGVBZGRpdGlvbiwgYW5nbGVTaGlmdCwgY3VyQW5nbGVTaGlmdCwgZGVnQ250LCBkZWx0YSwgZW5kLCBrZXlzLCBuZXdFbmQsIG5ld1N0YXJ0LCBwb2ludHMsIHN0YXJ0LCBzdGVwO1xuICAgICAgcG9pbnRzID0gdGhpcy5wcm9wcy5jb3VudDtcbiAgICAgIGRlZ0NudCA9IHRoaXMucHJvcHMuZGVncmVlICUgMzYwID09PSAwID8gcG9pbnRzIDogcG9pbnRzIC0gMSB8fCAxO1xuICAgICAgc3RlcCA9IHRoaXMucHJvcHMuZGVncmVlIC8gZGVnQ250O1xuICAgICAgYW5nbGVBZGRpdGlvbiA9IGkgKiBzdGVwICsgOTA7XG4gICAgICBhbmdsZVNoaWZ0ID0gdGhpcy50cmFuc2l0c1tpXS5wcm9wcy5hbmdsZVNoaWZ0IHx8IDA7XG4gICAgICBhbmdsZSA9IHR5cGVvZiBhbmdsZSAhPT0gJ29iamVjdCcgPyBhbmdsZSArIGFuZ2xlQWRkaXRpb24gKyBhbmdsZVNoaWZ0IDogKGtleXMgPSBPYmplY3Qua2V5cyhhbmdsZSksIHN0YXJ0ID0ga2V5c1swXSwgZW5kID0gYW5nbGVbc3RhcnRdLCBjdXJBbmdsZVNoaWZ0ID0gYW5nbGVBZGRpdGlvbiArIGFuZ2xlU2hpZnQsIG5ld1N0YXJ0ID0gcGFyc2VGbG9hdChzdGFydCkgKyBjdXJBbmdsZVNoaWZ0LCBuZXdFbmQgPSBwYXJzZUZsb2F0KGVuZCkgKyBjdXJBbmdsZVNoaWZ0LCBkZWx0YSA9IHt9LCBkZWx0YVtuZXdTdGFydF0gPSBuZXdFbmQsIGRlbHRhKTtcbiAgICAgIHJldHVybiBhbmdsZTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdldFNpZGVQb2ludCA9IGZ1bmN0aW9uKHNpZGUsIGFuZ2xlKSB7XG4gICAgICB2YXIgcG9pbnRTdGFydCwgc2lkZVJhZGl1cztcbiAgICAgIHNpZGVSYWRpdXMgPSB0aGlzLmdldFNpZGVSYWRpdXMoc2lkZSk7XG4gICAgICByZXR1cm4gcG9pbnRTdGFydCA9IHRoaXMuaC5nZXRSYWRpYWxQb2ludCh7XG4gICAgICAgIHJhZGl1czogc2lkZVJhZGl1cy5yYWRpdXMsXG4gICAgICAgIHJhZGl1c1g6IHNpZGVSYWRpdXMucmFkaXVzWCxcbiAgICAgICAgcmFkaXVzWTogc2lkZVJhZGl1cy5yYWRpdXNZLFxuICAgICAgICBhbmdsZTogYW5nbGUsXG4gICAgICAgIGNlbnRlcjoge1xuICAgICAgICAgIHg6IHRoaXMucHJvcHMuY2VudGVyLFxuICAgICAgICAgIHk6IHRoaXMucHJvcHMuY2VudGVyXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2V0U2lkZVJhZGl1cyA9IGZ1bmN0aW9uKHNpZGUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHJhZGl1czogdGhpcy5nZXRSYWRpdXNCeUtleSgncmFkaXVzJywgc2lkZSksXG4gICAgICAgIHJhZGl1c1g6IHRoaXMuZ2V0UmFkaXVzQnlLZXkoJ3JhZGl1c1gnLCBzaWRlKSxcbiAgICAgICAgcmFkaXVzWTogdGhpcy5nZXRSYWRpdXNCeUtleSgncmFkaXVzWScsIHNpZGUpXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2V0UmFkaXVzQnlLZXkgPSBmdW5jdGlvbihrZXksIHNpZGUpIHtcbiAgICAgIGlmICh0aGlzLmRlbHRhc1trZXldICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVsdGFzW2tleV1bc2lkZV07XG4gICAgICB9IGVsc2UgaWYgKHRoaXMucHJvcHNba2V5XSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzW2tleV07XG4gICAgICB9XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5nZXREZWx0YUZyb21Qb2ludHMgPSBmdW5jdGlvbihrZXksIHBvaW50U3RhcnQsIHBvaW50RW5kKSB7XG4gICAgICB2YXIgZGVsdGE7XG4gICAgICBkZWx0YSA9IHt9O1xuICAgICAgaWYgKHBvaW50U3RhcnRba2V5XSA9PT0gcG9pbnRFbmRba2V5XSkge1xuICAgICAgICByZXR1cm4gZGVsdGEgPSBwb2ludFN0YXJ0W2tleV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWx0YVtwb2ludFN0YXJ0W2tleV1dID0gcG9pbnRFbmRba2V5XTtcbiAgICAgICAgcmV0dXJuIGRlbHRhO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKHByb2dyZXNzKSB7XG4gICAgICByZXR1cm4gdGhpcy5kcmF3RWwoKTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmlzTmVlZHNUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmlzUHJvcENoYW5nZWQoJ3NoaWZ0WCcpIHx8IHRoaXMuaXNQcm9wQ2hhbmdlZCgnc2hpZnRZJykgfHwgdGhpcy5pc1Byb3BDaGFuZ2VkKCdhbmdsZScpO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZmlsbFRyYW5zZm9ybSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIFwicm90YXRlKFwiICsgdGhpcy5wcm9wcy5hbmdsZSArIFwiZGVnKSB0cmFuc2xhdGUoXCIgKyB0aGlzLnByb3BzLnNoaWZ0WCArIFwiLCBcIiArIHRoaXMucHJvcHMuc2hpZnRZICsgXCIpXCI7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5jcmVhdGVUd2VlbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIF9yZXN1bHRzO1xuICAgICAgQnVyc3QuX19zdXBlcl9fLmNyZWF0ZVR3ZWVuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICBpID0gdGhpcy50cmFuc2l0cy5sZW5ndGg7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMudGltZWxpbmUuYWRkKHRoaXMudHJhbnNpdHNbaV0udHdlZW4pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmNhbGNTaXplID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgbGFyZ2VzdFNpemUsIHJhZGl1cywgdHJhbnNpdCwgX2ksIF9sZW4sIF9yZWY7XG4gICAgICBsYXJnZXN0U2l6ZSA9IC0xO1xuICAgICAgX3JlZiA9IHRoaXMudHJhbnNpdHM7XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICB0cmFuc2l0ID0gX3JlZltpXTtcbiAgICAgICAgdHJhbnNpdC5jYWxjU2l6ZSgpO1xuICAgICAgICBpZiAobGFyZ2VzdFNpemUgPCB0cmFuc2l0LnByb3BzLnNpemUpIHtcbiAgICAgICAgICBsYXJnZXN0U2l6ZSA9IHRyYW5zaXQucHJvcHMuc2l6ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmFkaXVzID0gdGhpcy5jYWxjTWF4UmFkaXVzKCk7XG4gICAgICB0aGlzLnByb3BzLnNpemUgPSBsYXJnZXN0U2l6ZSArIDIgKiByYWRpdXM7XG4gICAgICB0aGlzLnByb3BzLnNpemUgKz0gMiAqIHRoaXMucHJvcHMuc2l6ZUdhcDtcbiAgICAgIHRoaXMucHJvcHMuY2VudGVyID0gdGhpcy5wcm9wcy5zaXplIC8gMjtcbiAgICAgIHJldHVybiB0aGlzLmFkZEJpdE9wdGlvbnMoKTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdldE9wdGlvbiA9IGZ1bmN0aW9uKGkpIHtcbiAgICAgIHZhciBrZXksIGtleXMsIGxlbiwgb3B0aW9uO1xuICAgICAgb3B0aW9uID0ge307XG4gICAgICBrZXlzID0gT2JqZWN0LmtleXModGhpcy5jaGlsZERlZmF1bHRzKTtcbiAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbbGVuXTtcbiAgICAgICAgb3B0aW9uW2tleV0gPSB0aGlzLmdldFByb3BCeU1vZCh7XG4gICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgaTogaSxcbiAgICAgICAgICBmcm9tOiB0aGlzLm8uY2hpbGRPcHRpb25zXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zSW50ZXJzZWN0aW9uW2tleV0pIHtcbiAgICAgICAgICBpZiAob3B0aW9uW2tleV0gPT0gbnVsbCkge1xuICAgICAgICAgICAgb3B0aW9uW2tleV0gPSB0aGlzLmdldFByb3BCeU1vZCh7XG4gICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICBpOiBpLFxuICAgICAgICAgICAgICBmcm9tOiB0aGlzLmNoaWxkRGVmYXVsdHNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9uW2tleV0gPT0gbnVsbCkge1xuICAgICAgICAgIG9wdGlvbltrZXldID0gdGhpcy5nZXRQcm9wQnlNb2Qoe1xuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICBpOiBpLFxuICAgICAgICAgICAgZnJvbTogdGhpcy5vXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbltrZXldID09IG51bGwpIHtcbiAgICAgICAgICBvcHRpb25ba2V5XSA9IHRoaXMuZ2V0UHJvcEJ5TW9kKHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgaTogaSxcbiAgICAgICAgICAgIGZyb206IHRoaXMuY2hpbGREZWZhdWx0c1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gb3B0aW9uO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2V0UHJvcEJ5TW9kID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIHByb3AsIF9yZWY7XG4gICAgICBwcm9wID0gKF9yZWYgPSBvLmZyb20gfHwgdGhpcy5vLmNoaWxkT3B0aW9ucykgIT0gbnVsbCA/IF9yZWZbby5rZXldIDogdm9pZCAwO1xuICAgICAgaWYgKHRoaXMuaC5pc0FycmF5KHByb3ApKSB7XG4gICAgICAgIHJldHVybiBwcm9wW28uaSAlIHByb3AubGVuZ3RoXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBwcm9wO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2VuZXJhdGVSYW5kb21BbmdsZSA9IGZ1bmN0aW9uKGkpIHtcbiAgICAgIHZhciByYW5kZG9tbmVzcywgcmFuZG9tbmVzcztcbiAgICAgIHJhbmRvbW5lc3MgPSBwYXJzZUZsb2F0KHRoaXMucHJvcHMucmFuZG9tQW5nbGUpO1xuICAgICAgcmFuZGRvbW5lc3MgPSByYW5kb21uZXNzID4gMSA/IDEgOiByYW5kb21uZXNzIDwgMCA/IDAgOiB2b2lkIDA7XG4gICAgICByZXR1cm4gdGhpcy5oLnJhbmQoMCwgcmFuZG9tbmVzcyA/IHJhbmRvbW5lc3MgKiAzNjAgOiAxODApO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2VuZXJhdGVSYW5kb21SYWRpdXMgPSBmdW5jdGlvbihpKSB7XG4gICAgICB2YXIgcmFuZGRvbW5lc3MsIHJhbmRvbW5lc3MsIHN0YXJ0O1xuICAgICAgcmFuZG9tbmVzcyA9IHBhcnNlRmxvYXQodGhpcy5wcm9wcy5yYW5kb21SYWRpdXMpO1xuICAgICAgcmFuZGRvbW5lc3MgPSByYW5kb21uZXNzID4gMSA/IDEgOiByYW5kb21uZXNzIDwgMCA/IDAgOiB2b2lkIDA7XG4gICAgICBzdGFydCA9IHJhbmRvbW5lc3MgPyAoMSAtIHJhbmRvbW5lc3MpICogMTAwIDogKDEgLSAuNSkgKiAxMDA7XG4gICAgICByZXR1cm4gdGhpcy5oLnJhbmQoc3RhcnQsIDEwMCkgLyAxMDA7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24obykge1xuICAgICAgdGhpcy5oLmVycm9yKFwiQnVyc3QncyBcXFwidGhlblxcXCIgbWV0aG9kIGlzIHVuZGVyIGNvbnNpZGVyYXRpb24sIHlvdSBjYW4gdm90ZSBmb3IgaXQgaW4gZ2l0aHViIHJlcG8gaXNzdWVzXCIpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHJldHVybiBCdXJzdDtcblxuICB9KShUcmFuc2l0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IEJ1cnN0O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgQmV6aWVyRWFzaW5nLCBiZXppZXJFYXNpbmcsIGgsXG4gICAgX19pbmRleE9mID0gW10uaW5kZXhPZiB8fCBmdW5jdGlvbihpdGVtKSB7IGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5sZW5ndGg7IGkgPCBsOyBpKyspIHsgaWYgKGkgaW4gdGhpcyAmJiB0aGlzW2ldID09PSBpdGVtKSByZXR1cm4gaTsgfSByZXR1cm4gLTE7IH07XG5cbiAgaCA9IHJlcXVpcmUoJy4uL2gnKTtcblxuXG4gIC8qKlxuICAgKiBDb3B5cmlnaHQgKGMpIDIwMTQgR2HDq3RhbiBSZW5hdWRlYXUgaHR0cDovL2dvby5nbC9FbDNrN3VcbiAgICogQWRvcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9ncmUvYmV6aWVyLWVhc2luZ1xuICAgKi9cblxuICBCZXppZXJFYXNpbmcgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gQmV6aWVyRWFzaW5nKG8pIHtcbiAgICAgIHRoaXMudmFycygpO1xuICAgICAgcmV0dXJuIHRoaXMuZ2VuZXJhdGU7XG4gICAgfVxuXG4gICAgQmV6aWVyRWFzaW5nLnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZSA9IGguYmluZCh0aGlzLmdlbmVyYXRlLCB0aGlzKTtcbiAgICB9O1xuXG4gICAgQmV6aWVyRWFzaW5nLnByb3RvdHlwZS5nZW5lcmF0ZSA9IGZ1bmN0aW9uKG1YMSwgbVkxLCBtWDIsIG1ZMikge1xuICAgICAgdmFyIEEsIEIsIEMsIE5FV1RPTl9JVEVSQVRJT05TLCBORVdUT05fTUlOX1NMT1BFLCBTVUJESVZJU0lPTl9NQVhfSVRFUkFUSU9OUywgU1VCRElWSVNJT05fUFJFQ0lTSU9OLCBhcmcsIGJpbmFyeVN1YmRpdmlkZSwgY2FsY0JlemllciwgY2FsY1NhbXBsZVZhbHVlcywgZiwgZmxvYXQzMkFycmF5U3VwcG9ydGVkLCBnZXRTbG9wZSwgZ2V0VEZvclgsIGksIGtTYW1wbGVTdGVwU2l6ZSwga1NwbGluZVRhYmxlU2l6ZSwgbVNhbXBsZVZhbHVlcywgbmV3dG9uUmFwaHNvbkl0ZXJhdGUsIHByZWNvbXB1dGUsIHN0ciwgX2ksIF9wcmVjb21wdXRlZDtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgNCkge1xuICAgICAgICByZXR1cm4gdGhpcy5lcnJvcignQmV6aWVyIGZ1bmN0aW9uIGV4cGVjdHMgNCBhcmd1bWVudHMnKTtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IF9pID0gMDsgX2kgPCA0OyBpID0gKytfaSkge1xuICAgICAgICBhcmcgPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGlmICh0eXBlb2YgYXJnICE9PSBcIm51bWJlclwiIHx8IGlzTmFOKGFyZykgfHwgIWlzRmluaXRlKGFyZykpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5lcnJvcignQmV6aWVyIGZ1bmN0aW9uIGV4cGVjdHMgNCBhcmd1bWVudHMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG1YMSA8IDAgfHwgbVgxID4gMSB8fCBtWDIgPCAwIHx8IG1YMiA+IDEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoJ0JlemllciB4IHZhbHVlcyBzaG91bGQgYmUgPiAwIGFuZCA8IDEnKTtcbiAgICAgIH1cbiAgICAgIE5FV1RPTl9JVEVSQVRJT05TID0gNDtcbiAgICAgIE5FV1RPTl9NSU5fU0xPUEUgPSAwLjAwMTtcbiAgICAgIFNVQkRJVklTSU9OX1BSRUNJU0lPTiA9IDAuMDAwMDAwMTtcbiAgICAgIFNVQkRJVklTSU9OX01BWF9JVEVSQVRJT05TID0gMTA7XG4gICAgICBrU3BsaW5lVGFibGVTaXplID0gMTE7XG4gICAgICBrU2FtcGxlU3RlcFNpemUgPSAxLjAgLyAoa1NwbGluZVRhYmxlU2l6ZSAtIDEuMCk7XG4gICAgICBmbG9hdDMyQXJyYXlTdXBwb3J0ZWQgPSBfX2luZGV4T2YuY2FsbChnbG9iYWwsICdGbG9hdDMyQXJyYXknKSA+PSAwO1xuICAgICAgQSA9IGZ1bmN0aW9uKGFBMSwgYUEyKSB7XG4gICAgICAgIHJldHVybiAxLjAgLSAzLjAgKiBhQTIgKyAzLjAgKiBhQTE7XG4gICAgICB9O1xuICAgICAgQiA9IGZ1bmN0aW9uKGFBMSwgYUEyKSB7XG4gICAgICAgIHJldHVybiAzLjAgKiBhQTIgLSA2LjAgKiBhQTE7XG4gICAgICB9O1xuICAgICAgQyA9IGZ1bmN0aW9uKGFBMSkge1xuICAgICAgICByZXR1cm4gMy4wICogYUExO1xuICAgICAgfTtcbiAgICAgIGNhbGNCZXppZXIgPSBmdW5jdGlvbihhVCwgYUExLCBhQTIpIHtcbiAgICAgICAgcmV0dXJuICgoQShhQTEsIGFBMikgKiBhVCArIEIoYUExLCBhQTIpKSAqIGFUICsgQyhhQTEpKSAqIGFUO1xuICAgICAgfTtcbiAgICAgIGdldFNsb3BlID0gZnVuY3Rpb24oYVQsIGFBMSwgYUEyKSB7XG4gICAgICAgIHJldHVybiAzLjAgKiBBKGFBMSwgYUEyKSAqIGFUICogYVQgKyAyLjAgKiBCKGFBMSwgYUEyKSAqIGFUICsgQyhhQTEpO1xuICAgICAgfTtcbiAgICAgIG5ld3RvblJhcGhzb25JdGVyYXRlID0gZnVuY3Rpb24oYVgsIGFHdWVzc1QpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRTbG9wZSwgY3VycmVudFg7XG4gICAgICAgIGkgPSAwO1xuICAgICAgICB3aGlsZSAoaSA8IE5FV1RPTl9JVEVSQVRJT05TKSB7XG4gICAgICAgICAgY3VycmVudFNsb3BlID0gZ2V0U2xvcGUoYUd1ZXNzVCwgbVgxLCBtWDIpO1xuXG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgICAgaWYgKGN1cnJlbnRTbG9wZSA9PT0gMC4wKSB7XG4gICAgICAgICAgICByZXR1cm4gYUd1ZXNzVDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3VycmVudFggPSBjYWxjQmV6aWVyKGFHdWVzc1QsIG1YMSwgbVgyKSAtIGFYO1xuICAgICAgICAgIGFHdWVzc1QgLT0gY3VycmVudFggLyBjdXJyZW50U2xvcGU7XG4gICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhR3Vlc3NUO1xuICAgICAgfTtcbiAgICAgIGNhbGNTYW1wbGVWYWx1ZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaSA9IDA7XG4gICAgICAgIHdoaWxlIChpIDwga1NwbGluZVRhYmxlU2l6ZSkge1xuICAgICAgICAgIG1TYW1wbGVWYWx1ZXNbaV0gPSBjYWxjQmV6aWVyKGkgKiBrU2FtcGxlU3RlcFNpemUsIG1YMSwgbVgyKTtcbiAgICAgICAgICArK2k7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBiaW5hcnlTdWJkaXZpZGUgPSBmdW5jdGlvbihhWCwgYUEsIGFCKSB7XG4gICAgICAgIHZhciBjdXJyZW50VCwgY3VycmVudFgsIGlzQmlnO1xuICAgICAgICBjdXJyZW50WCA9IHZvaWQgMDtcbiAgICAgICAgY3VycmVudFQgPSB2b2lkIDA7XG4gICAgICAgIGkgPSAwO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIGN1cnJlbnRUID0gYUEgKyAoYUIgLSBhQSkgLyAyLjA7XG4gICAgICAgICAgY3VycmVudFggPSBjYWxjQmV6aWVyKGN1cnJlbnRULCBtWDEsIG1YMikgLSBhWDtcbiAgICAgICAgICBpZiAoY3VycmVudFggPiAwLjApIHtcbiAgICAgICAgICAgIGFCID0gY3VycmVudFQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFBID0gY3VycmVudFQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlzQmlnID0gTWF0aC5hYnMoY3VycmVudFgpID4gU1VCRElWSVNJT05fUFJFQ0lTSU9OO1xuICAgICAgICAgIGlmICghKGlzQmlnICYmICsraSA8IFNVQkRJVklTSU9OX01BWF9JVEVSQVRJT05TKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjdXJyZW50VDtcbiAgICAgIH07XG4gICAgICBnZXRURm9yWCA9IGZ1bmN0aW9uKGFYKSB7XG4gICAgICAgIHZhciBjdXJyZW50U2FtcGxlLCBkZWx0YSwgZGlzdCwgZ3Vlc3NGb3JULCBpbml0aWFsU2xvcGUsIGludGVydmFsU3RhcnQsIGxhc3RTYW1wbGU7XG4gICAgICAgIGludGVydmFsU3RhcnQgPSAwLjA7XG4gICAgICAgIGN1cnJlbnRTYW1wbGUgPSAxO1xuICAgICAgICBsYXN0U2FtcGxlID0ga1NwbGluZVRhYmxlU2l6ZSAtIDE7XG4gICAgICAgIHdoaWxlIChjdXJyZW50U2FtcGxlICE9PSBsYXN0U2FtcGxlICYmIG1TYW1wbGVWYWx1ZXNbY3VycmVudFNhbXBsZV0gPD0gYVgpIHtcbiAgICAgICAgICBpbnRlcnZhbFN0YXJ0ICs9IGtTYW1wbGVTdGVwU2l6ZTtcbiAgICAgICAgICArK2N1cnJlbnRTYW1wbGU7XG4gICAgICAgIH1cbiAgICAgICAgLS1jdXJyZW50U2FtcGxlO1xuICAgICAgICBkZWx0YSA9IG1TYW1wbGVWYWx1ZXNbY3VycmVudFNhbXBsZSArIDFdIC0gbVNhbXBsZVZhbHVlc1tjdXJyZW50U2FtcGxlXTtcbiAgICAgICAgZGlzdCA9IChhWCAtIG1TYW1wbGVWYWx1ZXNbY3VycmVudFNhbXBsZV0pIC8gZGVsdGE7XG4gICAgICAgIGd1ZXNzRm9yVCA9IGludGVydmFsU3RhcnQgKyBkaXN0ICoga1NhbXBsZVN0ZXBTaXplO1xuICAgICAgICBpbml0aWFsU2xvcGUgPSBnZXRTbG9wZShndWVzc0ZvclQsIG1YMSwgbVgyKTtcbiAgICAgICAgaWYgKGluaXRpYWxTbG9wZSA+PSBORVdUT05fTUlOX1NMT1BFKSB7XG4gICAgICAgICAgcmV0dXJuIG5ld3RvblJhcGhzb25JdGVyYXRlKGFYLCBndWVzc0ZvclQpO1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICBpZiAoaW5pdGlhbFNsb3BlID09PSAwLjApIHtcbiAgICAgICAgICAgIHJldHVybiBndWVzc0ZvclQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBiaW5hcnlTdWJkaXZpZGUoYVgsIGludGVydmFsU3RhcnQsIGludGVydmFsU3RhcnQgKyBrU2FtcGxlU3RlcFNpemUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHByZWNvbXB1dGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIF9wcmVjb21wdXRlZDtcbiAgICAgICAgX3ByZWNvbXB1dGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKG1YMSAhPT0gbVkxIHx8IG1YMiAhPT0gbVkyKSB7XG4gICAgICAgICAgcmV0dXJuIGNhbGNTYW1wbGVWYWx1ZXMoKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIG1TYW1wbGVWYWx1ZXMgPSAhZmxvYXQzMkFycmF5U3VwcG9ydGVkID8gbmV3IEFycmF5KGtTcGxpbmVUYWJsZVNpemUpIDogbmV3IEZsb2F0MzJBcnJheShrU3BsaW5lVGFibGVTaXplKTtcbiAgICAgIF9wcmVjb21wdXRlZCA9IGZhbHNlO1xuICAgICAgZiA9IGZ1bmN0aW9uKGFYKSB7XG4gICAgICAgIGlmICghX3ByZWNvbXB1dGVkKSB7XG4gICAgICAgICAgcHJlY29tcHV0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtWDEgPT09IG1ZMSAmJiBtWDIgPT09IG1ZMikge1xuICAgICAgICAgIHJldHVybiBhWDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYVggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYVggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2FsY0JlemllcihnZXRURm9yWChhWCksIG1ZMSwgbVkyKTtcbiAgICAgIH07XG4gICAgICBzdHIgPSBcImJlemllcihcIiArIFttWDEsIG1ZMSwgbVgyLCBtWTJdICsgXCIpXCI7XG4gICAgICBmLnRvU3RyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGY7XG4gICAgfTtcblxuICAgIEJlemllckVhc2luZy5wcm90b3R5cGUuZXJyb3IgPSBmdW5jdGlvbihtc2cpIHtcbiAgICAgIHJldHVybiBoLmVycm9yKG1zZyk7XG4gICAgfTtcblxuICAgIHJldHVybiBCZXppZXJFYXNpbmc7XG5cbiAgfSkoKTtcblxuICBiZXppZXJFYXNpbmcgPSBuZXcgQmV6aWVyRWFzaW5nO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gYmV6aWVyRWFzaW5nO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgRWFzaW5nLCBQYXRoRWFzaW5nLCBiZXppZXIsIGVhc2luZywgaCwgbWl4O1xuXG4gIGJlemllciA9IHJlcXVpcmUoJy4vYmV6aWVyLWVhc2luZycpO1xuXG4gIFBhdGhFYXNpbmcgPSByZXF1aXJlKCcuL3BhdGgtZWFzaW5nJyk7XG5cbiAgbWl4ID0gcmVxdWlyZSgnLi9taXgnKTtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIEVhc2luZyA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBFYXNpbmcoKSB7fVxuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5iZXppZXIgPSBiZXppZXI7XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLlBhdGhFYXNpbmcgPSBQYXRoRWFzaW5nO1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5wYXRoID0gKG5ldyBQYXRoRWFzaW5nKCdjcmVhdG9yJykpLmNyZWF0ZTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuaW52ZXJzZSA9IGZ1bmN0aW9uKHApIHtcbiAgICAgIHJldHVybiAxIC0gcDtcbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5saW5lYXIgPSB7XG4gICAgICBub25lOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiBrO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLmVhc2UgPSB7XG4gICAgICBcImluXCI6IGJlemllci5hcHBseShFYXNpbmcsIFswLjQyLCAwLCAxLCAxXSksXG4gICAgICBvdXQ6IGJlemllci5hcHBseShFYXNpbmcsIFswLCAwLCAwLjU4LCAxXSksXG4gICAgICBpbm91dDogYmV6aWVyLmFwcGx5KEVhc2luZywgWzAuNDIsIDAsIDAuNTgsIDFdKVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLnF1YWQgPSB7XG4gICAgICBcImluXCI6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIGsgKiBrO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gayAqICgyIC0gayk7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAwLjUgKiBrICogaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTAuNSAqICgtLWsgKiAoayAtIDIpIC0gMSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuY3ViaWMgPSB7XG4gICAgICBcImluXCI6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIGsgKiBrICogaztcbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIC0tayAqIGsgKiBrICsgMTtcbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoKGsgKj0gMikgPCAxKSB7XG4gICAgICAgICAgcmV0dXJuIDAuNSAqIGsgKiBrICogaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMC41ICogKChrIC09IDIpICogayAqIGsgKyAyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5xdWFydCA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gayAqIGsgKiBrICogaztcbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIDEgLSAoLS1rICogayAqIGsgKiBrKTtcbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoKGsgKj0gMikgPCAxKSB7XG4gICAgICAgICAgcmV0dXJuIDAuNSAqIGsgKiBrICogayAqIGs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0wLjUgKiAoKGsgLT0gMikgKiBrICogayAqIGsgLSAyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5xdWludCA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gayAqIGsgKiBrICogayAqIGs7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAtLWsgKiBrICogayAqIGsgKiBrICsgMTtcbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoKGsgKj0gMikgPCAxKSB7XG4gICAgICAgICAgcmV0dXJuIDAuNSAqIGsgKiBrICogayAqIGsgKiBrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwLjUgKiAoKGsgLT0gMikgKiBrICogayAqIGsgKiBrICsgMik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuc2luID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAxIC0gTWF0aC5jb3MoayAqIE1hdGguUEkgLyAyKTtcbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc2luKGsgKiBNYXRoLlBJIC8gMik7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIDAuNSAqICgxIC0gTWF0aC5jb3MoTWF0aC5QSSAqIGspKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5leHBvID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIGlmIChrID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIE1hdGgucG93KDEwMjQsIGsgLSAxKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoayA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiAxIC0gTWF0aC5wb3coMiwgLTEwICogayk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChrID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAwLjUgKiBNYXRoLnBvdygxMDI0LCBrIC0gMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDAuNSAqICgtTWF0aC5wb3coMiwgLTEwICogKGsgLSAxKSkgKyAyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5jaXJjID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAxIC0gTWF0aC5zcXJ0KDEgLSBrICogayk7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQoMSAtICgtLWsgKiBrKSk7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAtMC41ICogKE1hdGguc3FydCgxIC0gayAqIGspIC0gMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDAuNSAqIChNYXRoLnNxcnQoMSAtIChrIC09IDIpICogaykgKyAxKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5iYWNrID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBzO1xuICAgICAgICBzID0gMS43MDE1ODtcbiAgICAgICAgcmV0dXJuIGsgKiBrICogKChzICsgMSkgKiBrIC0gcyk7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBzO1xuICAgICAgICBzID0gMS43MDE1ODtcbiAgICAgICAgcmV0dXJuIC0tayAqIGsgKiAoKHMgKyAxKSAqIGsgKyBzKSArIDE7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgdmFyIHM7XG4gICAgICAgIHMgPSAxLjcwMTU4ICogMS41MjU7XG4gICAgICAgIGlmICgoayAqPSAyKSA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gMC41ICogKGsgKiBrICogKChzICsgMSkgKiBrIC0gcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwLjUgKiAoKGsgLT0gMikgKiBrICogKChzICsgMSkgKiBrICsgcykgKyAyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5lbGFzdGljID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBhLCBwLCBzO1xuICAgICAgICBzID0gdm9pZCAwO1xuICAgICAgICBwID0gMC40O1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChrID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgYSA9IDE7XG4gICAgICAgIHMgPSBwIC8gNDtcbiAgICAgICAgcmV0dXJuIC0oYSAqIE1hdGgucG93KDIsIDEwICogKGsgLT0gMSkpICogTWF0aC5zaW4oKGsgLSBzKSAqICgyICogTWF0aC5QSSkgLyBwKSk7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBhLCBwLCBzO1xuICAgICAgICBzID0gdm9pZCAwO1xuICAgICAgICBwID0gMC40O1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChrID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgYSA9IDE7XG4gICAgICAgIHMgPSBwIC8gNDtcbiAgICAgICAgcmV0dXJuIGEgKiBNYXRoLnBvdygyLCAtMTAgKiBrKSAqIE1hdGguc2luKChrIC0gcykgKiAoMiAqIE1hdGguUEkpIC8gcCkgKyAxO1xuICAgICAgfSxcbiAgICAgIGlub3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBhLCBwLCBzO1xuICAgICAgICBzID0gdm9pZCAwO1xuICAgICAgICBwID0gMC40O1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChrID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgYSA9IDE7XG4gICAgICAgIHMgPSBwIC8gNDtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAtMC41ICogKGEgKiBNYXRoLnBvdygyLCAxMCAqIChrIC09IDEpKSAqIE1hdGguc2luKChrIC0gcykgKiAoMiAqIE1hdGguUEkpIC8gcCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhICogTWF0aC5wb3coMiwgLTEwICogKGsgLT0gMSkpICogTWF0aC5zaW4oKGsgLSBzKSAqICgyICogTWF0aC5QSSkgLyBwKSAqIDAuNSArIDE7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuYm91bmNlID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAxIC0gZWFzaW5nLmJvdW5jZS5vdXQoMSAtIGspO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoayA8ICgxIC8gMi43NSkpIHtcbiAgICAgICAgICByZXR1cm4gNy41NjI1ICogayAqIGs7XG4gICAgICAgIH0gZWxzZSBpZiAoayA8ICgyIC8gMi43NSkpIHtcbiAgICAgICAgICByZXR1cm4gNy41NjI1ICogKGsgLT0gMS41IC8gMi43NSkgKiBrICsgMC43NTtcbiAgICAgICAgfSBlbHNlIGlmIChrIDwgKDIuNSAvIDIuNzUpKSB7XG4gICAgICAgICAgcmV0dXJuIDcuNTYyNSAqIChrIC09IDIuMjUgLyAyLjc1KSAqIGsgKyAwLjkzNzU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIDcuNTYyNSAqIChrIC09IDIuNjI1IC8gMi43NSkgKiBrICsgMC45ODQzNzU7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoayA8IDAuNSkge1xuICAgICAgICAgIHJldHVybiBlYXNpbmcuYm91bmNlW1wiaW5cIl0oayAqIDIpICogMC41O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBlYXNpbmcuYm91bmNlLm91dChrICogMiAtIDEpICogMC41ICsgMC41O1xuICAgICAgfVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLnBhcnNlRWFzaW5nID0gZnVuY3Rpb24oZWFzaW5nKSB7XG4gICAgICB2YXIgZWFzaW5nUGFyZW50LCB0eXBlO1xuICAgICAgdHlwZSA9IHR5cGVvZiBlYXNpbmc7XG4gICAgICBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGVhc2luZy5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSA9PT0gJ20nKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucGF0aChlYXNpbmcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVhc2luZyA9IHRoaXMuX3NwbGl0RWFzaW5nKGVhc2luZyk7XG4gICAgICAgICAgZWFzaW5nUGFyZW50ID0gdGhpc1tlYXNpbmdbMF1dO1xuICAgICAgICAgIGlmICghZWFzaW5nUGFyZW50KSB7XG4gICAgICAgICAgICBoLmVycm9yKFwiRWFzaW5nIHdpdGggbmFtZSBcXFwiXCIgKyBlYXNpbmdbMF0gKyBcIlxcXCIgd2FzIG5vdCBmb3VuZCwgZmFsbGJhY2sgdG8gXFxcImxpbmVhci5ub25lXFxcIiBpbnN0ZWFkXCIpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbJ2xpbmVhciddWydub25lJ107XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBlYXNpbmdQYXJlbnRbZWFzaW5nWzFdXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGguaXNBcnJheShlYXNpbmcpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJlemllci5hcHBseSh0aGlzLCBlYXNpbmcpO1xuICAgICAgfVxuICAgICAgaWYgKCdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIGVhc2luZztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5fc3BsaXRFYXNpbmcgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHZhciBmaXJzdFBhcnQsIHNlY29uZFBhcnQsIHNwbGl0O1xuICAgICAgaWYgKHR5cGVvZiBzdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZztcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnc3RyaW5nJyAmJiBzdHJpbmcubGVuZ3RoKSB7XG4gICAgICAgIHNwbGl0ID0gc3RyaW5nLnNwbGl0KCcuJyk7XG4gICAgICAgIGZpcnN0UGFydCA9IHNwbGl0WzBdLnRvTG93ZXJDYXNlKCkgfHwgJ2xpbmVhcic7XG4gICAgICAgIHNlY29uZFBhcnQgPSBzcGxpdFsxXS50b0xvd2VyQ2FzZSgpIHx8ICdub25lJztcbiAgICAgICAgcmV0dXJuIFtmaXJzdFBhcnQsIHNlY29uZFBhcnRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFsnbGluZWFyJywgJ25vbmUnXTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIEVhc2luZztcblxuICB9KSgpO1xuXG4gIGVhc2luZyA9IG5ldyBFYXNpbmc7XG5cbiAgZWFzaW5nLm1peCA9IG1peChlYXNpbmcpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gZWFzaW5nO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgY3JlYXRlLCBlYXNpbmcsIGdldE5lYXJlc3QsIG1peCwgcGFyc2VJZkVhc2luZywgc29ydCxcbiAgICBfX3NsaWNlID0gW10uc2xpY2U7XG5cbiAgZWFzaW5nID0gbnVsbDtcblxuICBwYXJzZUlmRWFzaW5nID0gZnVuY3Rpb24oaXRlbSkge1xuICAgIGlmICh0eXBlb2YgaXRlbS52YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBpdGVtLnZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZWFzaW5nLnBhcnNlRWFzaW5nKGl0ZW0udmFsdWUpO1xuICAgIH1cbiAgfTtcblxuICBzb3J0ID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHZhciByZXR1cm5WYWx1ZTtcbiAgICBhLnZhbHVlID0gcGFyc2VJZkVhc2luZyhhKTtcbiAgICBiLnZhbHVlID0gcGFyc2VJZkVhc2luZyhiKTtcbiAgICByZXR1cm5WYWx1ZSA9IDA7XG4gICAgYS50byA8IGIudG8gJiYgKHJldHVyblZhbHVlID0gLTEpO1xuICAgIGEudG8gPiBiLnRvICYmIChyZXR1cm5WYWx1ZSA9IDEpO1xuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgfTtcblxuICBnZXROZWFyZXN0ID0gZnVuY3Rpb24oYXJyYXksIHByb2dyZXNzKSB7XG4gICAgdmFyIGksIGluZGV4LCB2YWx1ZSwgX2ksIF9sZW47XG4gICAgaW5kZXggPSAwO1xuICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IGFycmF5Lmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgdmFsdWUgPSBhcnJheVtpXTtcbiAgICAgIGluZGV4ID0gaTtcbiAgICAgIGlmICh2YWx1ZS50byA+IHByb2dyZXNzKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG4gIH07XG5cbiAgbWl4ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3M7XG4gICAgYXJncyA9IDEgPD0gYXJndW1lbnRzLmxlbmd0aCA/IF9fc2xpY2UuY2FsbChhcmd1bWVudHMsIDApIDogW107XG4gICAgaWYgKGFyZ3MubGVuZ3RoID4gMSkge1xuICAgICAgYXJncyA9IGFyZ3Muc29ydChzb3J0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnc1swXS52YWx1ZSA9IHBhcnNlSWZFYXNpbmcoYXJnc1swXSk7XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbihwcm9ncmVzcykge1xuICAgICAgdmFyIGluZGV4LCB2YWx1ZTtcbiAgICAgIGluZGV4ID0gZ2V0TmVhcmVzdChhcmdzLCBwcm9ncmVzcyk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIHZhbHVlID0gYXJnc1tpbmRleF0udmFsdWU7XG4gICAgICAgIGlmIChpbmRleCA9PT0gYXJncy5sZW5ndGggLSAxICYmIHByb2dyZXNzID4gYXJnc1tpbmRleF0udG8pIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlKHByb2dyZXNzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIGNyZWF0ZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICBlYXNpbmcgPSBlO1xuICAgIHJldHVybiBtaXg7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBjcmVhdGU7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBQYXRoRWFzaW5nLCBoO1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgUGF0aEVhc2luZyA9IChmdW5jdGlvbigpIHtcbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fdmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fcHJlY29tcHV0ZSA9IGguY2xhbXAodGhpcy5vLnByZWNvbXB1dGUgfHwgMTQ1MCwgMTAwLCAxMDAwMCk7XG4gICAgICB0aGlzLl9zdGVwID0gMSAvIHRoaXMuX3ByZWNvbXB1dGU7XG4gICAgICB0aGlzLl9yZWN0ID0gdGhpcy5vLnJlY3QgfHwgMTAwO1xuICAgICAgdGhpcy5fYXBwcm94aW1hdGVNYXggPSB0aGlzLm8uYXBwcm94aW1hdGVNYXggfHwgNTtcbiAgICAgIHRoaXMuX2VwcyA9IHRoaXMuby5lcHMgfHwgMC4wMDE7XG4gICAgICByZXR1cm4gdGhpcy5fYm91bmRzUHJldlByb2dyZXNzID0gLTE7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIFBhdGhFYXNpbmcocGF0aCwgbykge1xuICAgICAgdGhpcy5vID0gbyAhPSBudWxsID8gbyA6IHt9O1xuICAgICAgaWYgKHBhdGggPT09ICdjcmVhdG9yJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLnBhdGggPSBoLnBhcnNlUGF0aChwYXRoKTtcbiAgICAgIGlmICh0aGlzLnBhdGggPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaC5lcnJvcignRXJyb3Igd2hpbGUgcGFyc2luZyB0aGUgcGF0aCcpO1xuICAgICAgfVxuICAgICAgdGhpcy5fdmFycygpO1xuICAgICAgdGhpcy5wYXRoLnNldEF0dHJpYnV0ZSgnZCcsIHRoaXMuX25vcm1hbGl6ZVBhdGgodGhpcy5wYXRoLmdldEF0dHJpYnV0ZSgnZCcpKSk7XG4gICAgICB0aGlzLnBhdGhMZW5ndGggPSB0aGlzLnBhdGguZ2V0VG90YWxMZW5ndGgoKTtcbiAgICAgIHRoaXMuc2FtcGxlID0gaC5iaW5kKHRoaXMuc2FtcGxlLCB0aGlzKTtcbiAgICAgIHRoaXMuX2hhcmRTYW1wbGUgPSBoLmJpbmQodGhpcy5faGFyZFNhbXBsZSwgdGhpcyk7XG4gICAgICB0aGlzLl9wcmVTYW1wbGUoKTtcbiAgICAgIHRoaXM7XG4gICAgfVxuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX3ByZVNhbXBsZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGxlbmd0aCwgcG9pbnQsIHByb2dyZXNzLCBfaSwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICB0aGlzLl9zYW1wbGVzID0gW107XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfcmVmID0gdGhpcy5fcHJlY29tcHV0ZTsgMCA8PSBfcmVmID8gX2kgPD0gX3JlZiA6IF9pID49IF9yZWY7IGkgPSAwIDw9IF9yZWYgPyArK19pIDogLS1faSkge1xuICAgICAgICBwcm9ncmVzcyA9IGkgKiB0aGlzLl9zdGVwO1xuICAgICAgICBsZW5ndGggPSB0aGlzLnBhdGhMZW5ndGggKiBwcm9ncmVzcztcbiAgICAgICAgcG9pbnQgPSB0aGlzLnBhdGguZ2V0UG9pbnRBdExlbmd0aChsZW5ndGgpO1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMuX3NhbXBsZXNbaV0gPSB7XG4gICAgICAgICAgcG9pbnQ6IHBvaW50LFxuICAgICAgICAgIGxlbmd0aDogbGVuZ3RoLFxuICAgICAgICAgIHByb2dyZXNzOiBwcm9ncmVzc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX2ZpbmRCb3VuZHMgPSBmdW5jdGlvbihhcnJheSwgcCkge1xuICAgICAgdmFyIGJ1ZmZlciwgZGlyZWN0aW9uLCBlbmQsIGksIGxlbiwgbG9vcEVuZCwgcG9pbnRQLCBwb2ludFgsIHN0YXJ0LCB2YWx1ZSwgX2ksIF9yZWY7XG4gICAgICBpZiAocCA9PT0gdGhpcy5fYm91bmRzUHJldlByb2dyZXNzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmV2Qm91bmRzO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2JvdW5kc1N0YXJ0SW5kZXggPT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9ib3VuZHNTdGFydEluZGV4ID0gMDtcbiAgICAgIH1cbiAgICAgIGxlbiA9IGFycmF5Lmxlbmd0aDtcbiAgICAgIGlmICh0aGlzLl9ib3VuZHNQcmV2UHJvZ3Jlc3MgPiBwKSB7XG4gICAgICAgIGxvb3BFbmQgPSAwO1xuICAgICAgICBkaXJlY3Rpb24gPSAncmV2ZXJzZSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb29wRW5kID0gbGVuO1xuICAgICAgICBkaXJlY3Rpb24gPSAnZm9yd2FyZCc7XG4gICAgICB9XG4gICAgICBpZiAoZGlyZWN0aW9uID09PSAnZm9yd2FyZCcpIHtcbiAgICAgICAgc3RhcnQgPSBhcnJheVswXTtcbiAgICAgICAgZW5kID0gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydCA9IGFycmF5W2FycmF5Lmxlbmd0aCAtIDFdO1xuICAgICAgICBlbmQgPSBhcnJheVswXTtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IF9pID0gX3JlZiA9IHRoaXMuX2JvdW5kc1N0YXJ0SW5kZXg7IF9yZWYgPD0gbG9vcEVuZCA/IF9pIDwgbG9vcEVuZCA6IF9pID4gbG9vcEVuZDsgaSA9IF9yZWYgPD0gbG9vcEVuZCA/ICsrX2kgOiAtLV9pKSB7XG4gICAgICAgIHZhbHVlID0gYXJyYXlbaV07XG4gICAgICAgIHBvaW50WCA9IHZhbHVlLnBvaW50LnggLyB0aGlzLl9yZWN0O1xuICAgICAgICBwb2ludFAgPSBwO1xuICAgICAgICBpZiAoZGlyZWN0aW9uID09PSAncmV2ZXJzZScpIHtcbiAgICAgICAgICBidWZmZXIgPSBwb2ludFg7XG4gICAgICAgICAgcG9pbnRYID0gcG9pbnRQO1xuICAgICAgICAgIHBvaW50UCA9IGJ1ZmZlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocG9pbnRYIDwgcG9pbnRQKSB7XG4gICAgICAgICAgc3RhcnQgPSB2YWx1ZTtcbiAgICAgICAgICB0aGlzLl9ib3VuZHNTdGFydEluZGV4ID0gaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbmQgPSB2YWx1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fYm91bmRzUHJldlByb2dyZXNzID0gcDtcbiAgICAgIHJldHVybiB0aGlzLl9wcmV2Qm91bmRzID0ge1xuICAgICAgICBzdGFydDogc3RhcnQsXG4gICAgICAgIGVuZDogZW5kXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5zYW1wbGUgPSBmdW5jdGlvbihwKSB7XG4gICAgICB2YXIgYm91bmRzLCByZXM7XG4gICAgICBwID0gaC5jbGFtcChwLCAwLCAxKTtcbiAgICAgIGJvdW5kcyA9IHRoaXMuX2ZpbmRCb3VuZHModGhpcy5fc2FtcGxlcywgcCk7XG4gICAgICByZXMgPSB0aGlzLl9jaGVja0lmQm91bmRzQ2xvc2VFbm91Z2gocCwgYm91bmRzKTtcbiAgICAgIGlmIChyZXMgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRBcHByb3hpbWF0ZShwLCBib3VuZHMuc3RhcnQsIGJvdW5kcy5lbmQpO1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fY2hlY2tJZkJvdW5kc0Nsb3NlRW5vdWdoID0gZnVuY3Rpb24ocCwgYm91bmRzKSB7XG4gICAgICB2YXIgcG9pbnQsIHk7XG4gICAgICBwb2ludCA9IHZvaWQgMDtcbiAgICAgIHkgPSB0aGlzLl9jaGVja0lmUG9pbnRDbG9zZUVub3VnaChwLCBib3VuZHMuc3RhcnQucG9pbnQpO1xuICAgICAgaWYgKHkgIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4geTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9jaGVja0lmUG9pbnRDbG9zZUVub3VnaChwLCBib3VuZHMuZW5kLnBvaW50KTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX2NoZWNrSWZQb2ludENsb3NlRW5vdWdoID0gZnVuY3Rpb24ocCwgcG9pbnQpIHtcbiAgICAgIGlmIChoLmNsb3NlRW5vdWdoKHAsIHBvaW50LnggLyB0aGlzLl9yZWN0LCB0aGlzLl9lcHMpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNvbHZlWShwb2ludCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9hcHByb3hpbWF0ZSA9IGZ1bmN0aW9uKHN0YXJ0LCBlbmQsIHApIHtcbiAgICAgIHZhciBkZWx0YVAsIHBlcmNlbnRQO1xuICAgICAgZGVsdGFQID0gZW5kLnBvaW50LnggLSBzdGFydC5wb2ludC54O1xuICAgICAgcGVyY2VudFAgPSAocCAtIChzdGFydC5wb2ludC54IC8gdGhpcy5fcmVjdCkpIC8gKGRlbHRhUCAvIHRoaXMuX3JlY3QpO1xuICAgICAgcmV0dXJuIHN0YXJ0Lmxlbmd0aCArIHBlcmNlbnRQICogKGVuZC5sZW5ndGggLSBzdGFydC5sZW5ndGgpO1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fZmluZEFwcHJveGltYXRlID0gZnVuY3Rpb24ocCwgc3RhcnQsIGVuZCwgYXBwcm94aW1hdGVNYXgpIHtcbiAgICAgIHZhciBhcHByb3hpbWF0aW9uLCBhcmdzLCBuZXdQb2ludCwgcG9pbnQsIHg7XG4gICAgICBpZiAoYXBwcm94aW1hdGVNYXggPT0gbnVsbCkge1xuICAgICAgICBhcHByb3hpbWF0ZU1heCA9IHRoaXMuX2FwcHJveGltYXRlTWF4O1xuICAgICAgfVxuICAgICAgYXBwcm94aW1hdGlvbiA9IHRoaXMuX2FwcHJveGltYXRlKHN0YXJ0LCBlbmQsIHApO1xuICAgICAgcG9pbnQgPSB0aGlzLnBhdGguZ2V0UG9pbnRBdExlbmd0aChhcHByb3hpbWF0aW9uKTtcbiAgICAgIHggPSBwb2ludC54IC8gdGhpcy5fcmVjdDtcbiAgICAgIGlmIChoLmNsb3NlRW5vdWdoKHAsIHgsIHRoaXMuX2VwcykpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdmVZKHBvaW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICgtLWFwcHJveGltYXRlTWF4IDwgMSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLl9yZXNvbHZlWShwb2ludCk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3UG9pbnQgPSB7XG4gICAgICAgICAgcG9pbnQ6IHBvaW50LFxuICAgICAgICAgIGxlbmd0aDogYXBwcm94aW1hdGlvblxuICAgICAgICB9O1xuICAgICAgICBhcmdzID0gcCA8IHggPyBbcCwgc3RhcnQsIG5ld1BvaW50LCBhcHByb3hpbWF0ZU1heF0gOiBbcCwgbmV3UG9pbnQsIGVuZCwgYXBwcm94aW1hdGVNYXhdO1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZEFwcHJveGltYXRlLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fcmVzb2x2ZVkgPSBmdW5jdGlvbihwb2ludCkge1xuICAgICAgcmV0dXJuIDEgLSAocG9pbnQueSAvIHRoaXMuX3JlY3QpO1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fbm9ybWFsaXplUGF0aCA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgIHZhciBjb21tYW5kcywgZW5kSW5kZXgsIG5vcm1hbGl6ZWRQYXRoLCBwb2ludHMsIHN0YXJ0SW5kZXgsIHN2Z0NvbW1hbmRzUmVnZXhwO1xuICAgICAgc3ZnQ29tbWFuZHNSZWdleHAgPSAvW018THxIfFZ8Q3xTfFF8VHxBXS9naW07XG4gICAgICBwb2ludHMgPSBwYXRoLnNwbGl0KHN2Z0NvbW1hbmRzUmVnZXhwKTtcbiAgICAgIHBvaW50cy5zaGlmdCgpO1xuICAgICAgY29tbWFuZHMgPSBwYXRoLm1hdGNoKHN2Z0NvbW1hbmRzUmVnZXhwKTtcbiAgICAgIHN0YXJ0SW5kZXggPSAwO1xuICAgICAgcG9pbnRzW3N0YXJ0SW5kZXhdID0gdGhpcy5fbm9ybWFsaXplU2VnbWVudChwb2ludHNbc3RhcnRJbmRleF0pO1xuICAgICAgZW5kSW5kZXggPSBwb2ludHMubGVuZ3RoIC0gMTtcbiAgICAgIHBvaW50c1tlbmRJbmRleF0gPSB0aGlzLl9ub3JtYWxpemVTZWdtZW50KHBvaW50c1tlbmRJbmRleF0sIHRoaXMuX3JlY3QgfHwgMTAwKTtcbiAgICAgIHJldHVybiBub3JtYWxpemVkUGF0aCA9IHRoaXMuX2pvaW5Ob3JtYWxpemVkUGF0aChjb21tYW5kcywgcG9pbnRzKTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX2pvaW5Ob3JtYWxpemVkUGF0aCA9IGZ1bmN0aW9uKGNvbW1hbmRzLCBwb2ludHMpIHtcbiAgICAgIHZhciBjb21tYW5kLCBpLCBub3JtYWxpemVkUGF0aCwgc3BhY2UsIF9pLCBfbGVuO1xuICAgICAgbm9ybWFsaXplZFBhdGggPSAnJztcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IGNvbW1hbmRzLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICBjb21tYW5kID0gY29tbWFuZHNbaV07XG4gICAgICAgIHNwYWNlID0gaSA9PT0gMCA/ICcnIDogJyAnO1xuICAgICAgICBub3JtYWxpemVkUGF0aCArPSBcIlwiICsgc3BhY2UgKyBjb21tYW5kICsgKHBvaW50c1tpXS50cmltKCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5vcm1hbGl6ZWRQYXRoO1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fbm9ybWFsaXplU2VnbWVudCA9IGZ1bmN0aW9uKHNlZ21lbnQsIHZhbHVlKSB7XG4gICAgICB2YXIgaSwgbGFzdFBvaW50LCBuUmd4LCBwYWlycywgcGFyc2VkWCwgcG9pbnQsIHNwYWNlLCB4LCBfaSwgX2xlbjtcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIHZhbHVlID0gMDtcbiAgICAgIH1cbiAgICAgIHNlZ21lbnQgPSBzZWdtZW50LnRyaW0oKTtcbiAgICAgIG5SZ3ggPSAvKC18XFwrKT8oKFxcZCsoXFwuKFxcZHxcXGUoLXxcXCspPykrKT8pfChcXC4/KFxcZHxcXGV8KFxcLXxcXCspKSspKS9naW07XG4gICAgICBwYWlycyA9IHRoaXMuX2dldFNlZ21lbnRQYWlycyhzZWdtZW50Lm1hdGNoKG5SZ3gpKTtcbiAgICAgIGxhc3RQb2ludCA9IHBhaXJzW3BhaXJzLmxlbmd0aCAtIDFdO1xuICAgICAgeCA9IGxhc3RQb2ludFswXTtcbiAgICAgIHBhcnNlZFggPSBOdW1iZXIoeCk7XG4gICAgICBpZiAocGFyc2VkWCAhPT0gdmFsdWUpIHtcbiAgICAgICAgc2VnbWVudCA9ICcnO1xuICAgICAgICBsYXN0UG9pbnRbMF0gPSB2YWx1ZTtcbiAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gcGFpcnMubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgICAgcG9pbnQgPSBwYWlyc1tpXTtcbiAgICAgICAgICBzcGFjZSA9IGkgPT09IDAgPyAnJyA6ICcgJztcbiAgICAgICAgICBzZWdtZW50ICs9IFwiXCIgKyBzcGFjZSArIHBvaW50WzBdICsgXCIsXCIgKyBwb2ludFsxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHNlZ21lbnQ7XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9nZXRTZWdtZW50UGFpcnMgPSBmdW5jdGlvbihhcnJheSkge1xuICAgICAgdmFyIGksIG5ld0FycmF5LCBwYWlyLCB2YWx1ZSwgX2ksIF9sZW47XG4gICAgICBpZiAoYXJyYXkubGVuZ3RoICUgMiAhPT0gMCkge1xuICAgICAgICBoLmVycm9yKCdGYWlsZWQgdG8gcGFyc2UgdGhlIHBhdGggLSBzZWdtZW50IHBhaXJzIGFyZSBub3QgZXZlbi4nLCBhcnJheSk7XG4gICAgICB9XG4gICAgICBuZXdBcnJheSA9IFtdO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gYXJyYXkubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSBfaSArPSAyKSB7XG4gICAgICAgIHZhbHVlID0gYXJyYXlbaV07XG4gICAgICAgIHBhaXIgPSBbYXJyYXlbaV0sIGFycmF5W2kgKyAxXV07XG4gICAgICAgIG5ld0FycmF5LnB1c2gocGFpcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3QXJyYXk7XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uKHBhdGgsIG8pIHtcbiAgICAgIHZhciBoYW5kbGVyO1xuICAgICAgaGFuZGxlciA9IG5ldyBQYXRoRWFzaW5nKHBhdGgsIG8pO1xuICAgICAgaGFuZGxlci5zYW1wbGUucGF0aCA9IGhhbmRsZXIucGF0aDtcbiAgICAgIHJldHVybiBoYW5kbGVyLnNhbXBsZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBhdGhFYXNpbmc7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFBhdGhFYXNpbmc7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBIZWxwZXJzLCBoO1xuXG4gIEhlbHBlcnMgPSAoZnVuY3Rpb24oKSB7XG4gICAgSGVscGVycy5wcm90b3R5cGUuTlMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUubG9nQmFkZ2VDc3MgPSAnYmFja2dyb3VuZDojM0EwODM5O2NvbG9yOiNGRjUxMkY7Ym9yZGVyLXJhZGl1czo1cHg7IHBhZGRpbmc6IDFweCA1cHggMnB4OyBib3JkZXI6IDFweCBzb2xpZCAjRkY1MTJGOyc7XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5zaG9ydENvbG9ycyA9IHtcbiAgICAgIHRyYW5zcGFyZW50OiAncmdiYSgwLDAsMCwwKScsXG4gICAgICBub25lOiAncmdiYSgwLDAsMCwwKScsXG4gICAgICBhcXVhOiAncmdiKDAsMjU1LDI1NSknLFxuICAgICAgYmxhY2s6ICdyZ2IoMCwwLDApJyxcbiAgICAgIGJsdWU6ICdyZ2IoMCwwLDI1NSknLFxuICAgICAgZnVjaHNpYTogJ3JnYigyNTUsMCwyNTUpJyxcbiAgICAgIGdyYXk6ICdyZ2IoMTI4LDEyOCwxMjgpJyxcbiAgICAgIGdyZWVuOiAncmdiKDAsMTI4LDApJyxcbiAgICAgIGxpbWU6ICdyZ2IoMCwyNTUsMCknLFxuICAgICAgbWFyb29uOiAncmdiKDEyOCwwLDApJyxcbiAgICAgIG5hdnk6ICdyZ2IoMCwwLDEyOCknLFxuICAgICAgb2xpdmU6ICdyZ2IoMTI4LDEyOCwwKScsXG4gICAgICBwdXJwbGU6ICdyZ2IoMTI4LDAsMTI4KScsXG4gICAgICByZWQ6ICdyZ2IoMjU1LDAsMCknLFxuICAgICAgc2lsdmVyOiAncmdiKDE5MiwxOTIsMTkyKScsXG4gICAgICB0ZWFsOiAncmdiKDAsMTI4LDEyOCknLFxuICAgICAgd2hpdGU6ICdyZ2IoMjU1LDI1NSwyNTUpJyxcbiAgICAgIHllbGxvdzogJ3JnYigyNTUsMjU1LDApJyxcbiAgICAgIG9yYW5nZTogJ3JnYigyNTUsMTI4LDApJ1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jaGFpbk9wdGlvbk1hcCA9IHtcbiAgICAgIGR1cmF0aW9uOiAxLFxuICAgICAgZGVsYXk6IDEsXG4gICAgICByZXBlYXQ6IDEsXG4gICAgICBlYXNpbmc6IDEsXG4gICAgICB5b3lvOiAxLFxuICAgICAgb25TdGFydDogMSxcbiAgICAgIG9uQ29tcGxldGU6IDEsXG4gICAgICBvbkNvbXBsZXRlQ2hhaW46IDEsXG4gICAgICBvblVwZGF0ZTogMSxcbiAgICAgIHBvaW50czogMVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jYWxsYmFja3NNYXAgPSB7XG4gICAgICBvblN0YXJ0OiAxLFxuICAgICAgb25Db21wbGV0ZTogMSxcbiAgICAgIG9uQ29tcGxldGVDaGFpbjogMSxcbiAgICAgIG9uVXBkYXRlOiAxXG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnR3ZWVuT3B0aW9uTWFwID0ge1xuICAgICAgZHVyYXRpb246IDEsXG4gICAgICBkZWxheTogMSxcbiAgICAgIHJlcGVhdDogMSxcbiAgICAgIGVhc2luZzogMSxcbiAgICAgIHlveW86IDFcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUucG9zUHJvcHNNYXAgPSB7XG4gICAgICB4OiAxLFxuICAgICAgeTogMSxcbiAgICAgIHNoaWZ0WDogMSxcbiAgICAgIHNoaWZ0WTogMSxcbiAgICAgIGJ1cnN0WDogMSxcbiAgICAgIGJ1cnN0WTogMSxcbiAgICAgIGJ1cnN0U2hpZnRYOiAxLFxuICAgICAgYnVyc3RTaGlmdFk6IDFcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuc3Ryb2tlRGFzaFByb3BzTWFwID0ge1xuICAgICAgc3Ryb2tlRGFzaGFycmF5OiAxLFxuICAgICAgc3Ryb2tlRGFzaG9mZnNldDogMVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5SQURfVE9fREVHID0gMTgwIC8gTWF0aC5QSTtcblxuICAgIGZ1bmN0aW9uIEhlbHBlcnMoKSB7XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICB9XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdWE7XG4gICAgICB0aGlzLnByZWZpeCA9IHRoaXMuZ2V0UHJlZml4KCk7XG4gICAgICB0aGlzLmdldFJlbUJhc2UoKTtcbiAgICAgIHRoaXMuaXNGRiA9IHRoaXMucHJlZml4Lmxvd2VyY2FzZSA9PT0gJ21veic7XG4gICAgICB0aGlzLmlzSUUgPSB0aGlzLnByZWZpeC5sb3dlcmNhc2UgPT09ICdtcyc7XG4gICAgICB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQ7XG4gICAgICB0aGlzLmlzT2xkT3BlcmEgPSB1YS5tYXRjaCgvcHJlc3RvL2dpbSk7XG4gICAgICB0aGlzLmlzU2FmYXJpID0gdWEuaW5kZXhPZignU2FmYXJpJykgPiAtMTtcbiAgICAgIHRoaXMuaXNDaHJvbWUgPSB1YS5pbmRleE9mKCdDaHJvbWUnKSA+IC0xO1xuICAgICAgdGhpcy5pc09wZXJhID0gdWEudG9Mb3dlckNhc2UoKS5pbmRleE9mKFwib3BcIikgPiAtMTtcbiAgICAgIHRoaXMuaXNDaHJvbWUgJiYgdGhpcy5pc1NhZmFyaSAmJiAodGhpcy5pc1NhZmFyaSA9IGZhbHNlKTtcbiAgICAgICh1YS5tYXRjaCgvUGhhbnRvbUpTL2dpbSkpICYmICh0aGlzLmlzU2FmYXJpID0gZmFsc2UpO1xuICAgICAgdGhpcy5pc0Nocm9tZSAmJiB0aGlzLmlzT3BlcmEgJiYgKHRoaXMuaXNDaHJvbWUgPSBmYWxzZSk7XG4gICAgICB0aGlzLmlzM2QgPSB0aGlzLmNoZWNrSWYzZCgpO1xuICAgICAgdGhpcy51bmlxSURzID0gLTE7XG4gICAgICB0aGlzLmRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgcmV0dXJuIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5kaXYpO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jbG9uZU9iaiA9IGZ1bmN0aW9uKG9iaiwgZXhjbHVkZSkge1xuICAgICAgdmFyIGksIGtleSwga2V5cywgbmV3T2JqO1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgICBuZXdPYmogPSB7fTtcbiAgICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgaWYgKGV4Y2x1ZGUgIT0gbnVsbCkge1xuICAgICAgICAgIGlmICghZXhjbHVkZVtrZXldKSB7XG4gICAgICAgICAgICBuZXdPYmpba2V5XSA9IG9ialtrZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdPYmpba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3T2JqO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbihvYmpUbywgb2JqRnJvbSkge1xuICAgICAgdmFyIGtleSwgdmFsdWU7XG4gICAgICBmb3IgKGtleSBpbiBvYmpGcm9tKSB7XG4gICAgICAgIHZhbHVlID0gb2JqRnJvbVtrZXldO1xuICAgICAgICBpZiAob2JqVG9ba2V5XSA9PSBudWxsKSB7XG4gICAgICAgICAgb2JqVG9ba2V5XSA9IG9iakZyb21ba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9ialRvO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5nZXRSZW1CYXNlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaHRtbCwgc3R5bGU7XG4gICAgICBodG1sID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaHRtbCcpO1xuICAgICAgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGh0bWwpO1xuICAgICAgcmV0dXJuIHRoaXMucmVtQmFzZSA9IHBhcnNlRmxvYXQoc3R5bGUuZm9udFNpemUpO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jbGFtcCA9IGZ1bmN0aW9uKHZhbHVlLCBtaW4sIG1heCkge1xuICAgICAgaWYgKHZhbHVlIDwgbWluKSB7XG4gICAgICAgIHJldHVybiBtaW47XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID4gbWF4KSB7XG4gICAgICAgIHJldHVybiBtYXg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnNldFByZWZpeGVkU3R5bGUgPSBmdW5jdGlvbihlbCwgbmFtZSwgdmFsdWUsIGlzSXQpIHtcbiAgICAgIGlmIChuYW1lLm1hdGNoKC90cmFuc2Zvcm0vZ2ltKSkge1xuICAgICAgICBlbC5zdHlsZVtcIlwiICsgbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIGVsLnN0eWxlW1wiXCIgKyB0aGlzLnByZWZpeC5jc3MgKyBuYW1lXSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGVsLnN0eWxlW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnN0eWxlID0gZnVuY3Rpb24oZWwsIG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIga2V5LCBrZXlzLCBsZW4sIF9yZXN1bHRzO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMobmFtZSk7XG4gICAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgICAgdmFsdWUgPSBuYW1lW2tleV07XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnNldFByZWZpeGVkU3R5bGUoZWwsIGtleSwgdmFsdWUpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRQcmVmaXhlZFN0eWxlKGVsLCBuYW1lLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnByZXBhcmVGb3JMb2cgPSBmdW5jdGlvbihhcmdzKSB7XG4gICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmFwcGx5KGFyZ3MpO1xuICAgICAgYXJncy51bnNoaWZ0KCc6OicpO1xuICAgICAgYXJncy51bnNoaWZ0KHRoaXMubG9nQmFkZ2VDc3MpO1xuICAgICAgYXJncy51bnNoaWZ0KCclY21vwrdqcyVjJyk7XG4gICAgICByZXR1cm4gYXJncztcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUubG9nID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAobW9qcy5pc0RlYnVnID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXR1cm4gY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgdGhpcy5wcmVwYXJlRm9yTG9nKGFyZ3VtZW50cykpO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS53YXJuID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAobW9qcy5pc0RlYnVnID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXR1cm4gY29uc29sZS53YXJuLmFwcGx5KGNvbnNvbGUsIHRoaXMucHJlcGFyZUZvckxvZyhhcmd1bWVudHMpKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChtb2pzLmlzRGVidWcgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjb25zb2xlLmVycm9yLmFwcGx5KGNvbnNvbGUsIHRoaXMucHJlcGFyZUZvckxvZyhhcmd1bWVudHMpKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUucGFyc2VVbml0ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHZhciBhbW91bnQsIGlzU3RyaWN0LCByZWdleCwgcmV0dXJuVmFsLCB1bml0LCBfcmVmO1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIHJldHVyblZhbCA9IHtcbiAgICAgICAgICB1bml0OiAncHgnLFxuICAgICAgICAgIGlzU3RyaWN0OiBmYWxzZSxcbiAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgc3RyaW5nOiBcIlwiICsgdmFsdWUgKyBcInB4XCJcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZWdleCA9IC9weHwlfHJlbXxlbXxleHxjbXxjaHxtbXxpbnxwdHxwY3x2aHx2d3x2bWluL2dpbTtcbiAgICAgICAgdW5pdCA9IChfcmVmID0gdmFsdWUubWF0Y2gocmVnZXgpKSAhPSBudWxsID8gX3JlZlswXSA6IHZvaWQgMDtcbiAgICAgICAgaXNTdHJpY3QgPSB0cnVlO1xuICAgICAgICBpZiAoIXVuaXQpIHtcbiAgICAgICAgICB1bml0ID0gJ3B4JztcbiAgICAgICAgICBpc1N0cmljdCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGFtb3VudCA9IHBhcnNlRmxvYXQodmFsdWUpO1xuICAgICAgICByZXR1cm4gcmV0dXJuVmFsID0ge1xuICAgICAgICAgIHVuaXQ6IHVuaXQsXG4gICAgICAgICAgaXNTdHJpY3Q6IGlzU3RyaWN0LFxuICAgICAgICAgIHZhbHVlOiBhbW91bnQsXG4gICAgICAgICAgc3RyaW5nOiBcIlwiICsgYW1vdW50ICsgdW5pdFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24oZnVuYywgY29udGV4dCkge1xuICAgICAgdmFyIGJpbmRBcmdzLCB3cmFwcGVyO1xuICAgICAgd3JhcHBlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncywgdW5zaGlmdEFyZ3M7XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICB1bnNoaWZ0QXJncyA9IGJpbmRBcmdzLmNvbmNhdChhcmdzKTtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgdW5zaGlmdEFyZ3MpO1xuICAgICAgfTtcbiAgICAgIGJpbmRBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICAgIHJldHVybiB3cmFwcGVyO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5nZXRSYWRpYWxQb2ludCA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBwb2ludCwgcmFkQW5nbGUsIHJhZGl1c1gsIHJhZGl1c1k7XG4gICAgICBpZiAobyA9PSBudWxsKSB7XG4gICAgICAgIG8gPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICgoby5yYWRpdXMgPT0gbnVsbCkgfHwgKG8uYW5nbGUgPT0gbnVsbCkgfHwgKG8uY2VudGVyID09IG51bGwpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJhZEFuZ2xlID0gKG8uYW5nbGUgLSA5MCkgKiAoTWF0aC5QSSAvIDE4MCk7XG4gICAgICByYWRpdXNYID0gby5yYWRpdXNYICE9IG51bGwgPyBvLnJhZGl1c1ggOiBvLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSBvLnJhZGl1c1kgIT0gbnVsbCA/IG8ucmFkaXVzWSA6IG8ucmFkaXVzO1xuICAgICAgcmV0dXJuIHBvaW50ID0ge1xuICAgICAgICB4OiBvLmNlbnRlci54ICsgKE1hdGguY29zKHJhZEFuZ2xlKSAqIHJhZGl1c1gpLFxuICAgICAgICB5OiBvLmNlbnRlci55ICsgKE1hdGguc2luKHJhZEFuZ2xlKSAqIHJhZGl1c1kpXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5nZXRQcmVmaXggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkb20sIHByZSwgc3R5bGVzLCB2O1xuICAgICAgc3R5bGVzID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCBcIlwiKTtcbiAgICAgIHYgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzdHlsZXMpLmpvaW4oXCJcIikubWF0Y2goLy0obW96fHdlYmtpdHxtcyktLyk7XG4gICAgICBwcmUgPSAodiB8fCAoc3R5bGVzLk9MaW5rID09PSBcIlwiICYmIFtcIlwiLCBcIm9cIl0pKVsxXTtcbiAgICAgIGRvbSA9IFwiV2ViS2l0fE1venxNU3xPXCIubWF0Y2gobmV3IFJlZ0V4cChcIihcIiArIHByZSArIFwiKVwiLCBcImlcIikpWzFdO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZG9tOiBkb20sXG4gICAgICAgIGxvd2VyY2FzZTogcHJlLFxuICAgICAgICBjc3M6IFwiLVwiICsgcHJlICsgXCItXCIsXG4gICAgICAgIGpzOiBwcmVbMF0udG9VcHBlckNhc2UoKSArIHByZS5zdWJzdHIoMSlcbiAgICAgIH07XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnN0clRvQXJyID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICB2YXIgYXJyO1xuICAgICAgYXJyID0gW107XG4gICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHN0cmluZykpIHtcbiAgICAgICAgYXJyLnB1c2godGhpcy5wYXJzZVVuaXQoc3RyaW5nKSk7XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgICB9XG4gICAgICBzdHJpbmcudHJpbSgpLnNwbGl0KC9cXHMrL2dpbSkuZm9yRWFjaCgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHN0cikge1xuICAgICAgICAgIHJldHVybiBhcnIucHVzaChfdGhpcy5wYXJzZVVuaXQoX3RoaXMucGFyc2VJZlJhbmQoc3RyKSkpO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpO1xuICAgICAgcmV0dXJuIGFycjtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2FsY0FyckRlbHRhID0gZnVuY3Rpb24oYXJyMSwgYXJyMikge1xuICAgICAgdmFyIGRlbHRhLCBpLCBudW0sIF9pLCBfbGVuO1xuICAgICAgZGVsdGEgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IGFycjEubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgIG51bSA9IGFycjFbaV07XG4gICAgICAgIGRlbHRhW2ldID0gdGhpcy5wYXJzZVVuaXQoXCJcIiArIChhcnIyW2ldLnZhbHVlIC0gYXJyMVtpXS52YWx1ZSkgKyBhcnIyW2ldLnVuaXQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlbHRhO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5pc0FycmF5ID0gZnVuY3Rpb24odmFyaWFibGUpIHtcbiAgICAgIHJldHVybiB2YXJpYWJsZSBpbnN0YW5jZW9mIEFycmF5O1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5ub3JtRGFzaEFycmF5cyA9IGZ1bmN0aW9uKGFycjEsIGFycjIpIHtcbiAgICAgIHZhciBhcnIxTGVuLCBhcnIyTGVuLCBjdXJySXRlbSwgaSwgbGVuRGlmZiwgc3RhcnRJLCBfaSwgX2o7XG4gICAgICBhcnIxTGVuID0gYXJyMS5sZW5ndGg7XG4gICAgICBhcnIyTGVuID0gYXJyMi5sZW5ndGg7XG4gICAgICBpZiAoYXJyMUxlbiA+IGFycjJMZW4pIHtcbiAgICAgICAgbGVuRGlmZiA9IGFycjFMZW4gLSBhcnIyTGVuO1xuICAgICAgICBzdGFydEkgPSBhcnIyLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gX2kgPSAwOyAwIDw9IGxlbkRpZmYgPyBfaSA8IGxlbkRpZmYgOiBfaSA+IGxlbkRpZmY7IGkgPSAwIDw9IGxlbkRpZmYgPyArK19pIDogLS1faSkge1xuICAgICAgICAgIGN1cnJJdGVtID0gaSArIHN0YXJ0STtcbiAgICAgICAgICBhcnIyLnB1c2godGhpcy5wYXJzZVVuaXQoXCIwXCIgKyBhcnIxW2N1cnJJdGVtXS51bml0KSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYXJyMkxlbiA+IGFycjFMZW4pIHtcbiAgICAgICAgbGVuRGlmZiA9IGFycjJMZW4gLSBhcnIxTGVuO1xuICAgICAgICBzdGFydEkgPSBhcnIxLmxlbmd0aDtcbiAgICAgICAgZm9yIChpID0gX2ogPSAwOyAwIDw9IGxlbkRpZmYgPyBfaiA8IGxlbkRpZmYgOiBfaiA+IGxlbkRpZmY7IGkgPSAwIDw9IGxlbkRpZmYgPyArK19qIDogLS1faikge1xuICAgICAgICAgIGN1cnJJdGVtID0gaSArIHN0YXJ0STtcbiAgICAgICAgICBhcnIxLnB1c2godGhpcy5wYXJzZVVuaXQoXCIwXCIgKyBhcnIyW2N1cnJJdGVtXS51bml0KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBbYXJyMSwgYXJyMl07XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLm1ha2VDb2xvck9iaiA9IGZ1bmN0aW9uKGNvbG9yKSB7XG4gICAgICB2YXIgYWxwaGEsIGIsIGNvbG9yT2JqLCBnLCBpc1JnYiwgciwgcmVnZXhTdHJpbmcxLCByZWdleFN0cmluZzIsIHJlc3VsdCwgcmdiQ29sb3I7XG4gICAgICBpZiAoY29sb3JbMF0gPT09ICcjJykge1xuICAgICAgICByZXN1bHQgPSAvXiM/KFthLWZcXGRdezEsMn0pKFthLWZcXGRdezEsMn0pKFthLWZcXGRdezEsMn0pJC9pLmV4ZWMoY29sb3IpO1xuICAgICAgICBjb2xvck9iaiA9IHt9O1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgciA9IHJlc3VsdFsxXS5sZW5ndGggPT09IDIgPyByZXN1bHRbMV0gOiByZXN1bHRbMV0gKyByZXN1bHRbMV07XG4gICAgICAgICAgZyA9IHJlc3VsdFsyXS5sZW5ndGggPT09IDIgPyByZXN1bHRbMl0gOiByZXN1bHRbMl0gKyByZXN1bHRbMl07XG4gICAgICAgICAgYiA9IHJlc3VsdFszXS5sZW5ndGggPT09IDIgPyByZXN1bHRbM10gOiByZXN1bHRbM10gKyByZXN1bHRbM107XG4gICAgICAgICAgY29sb3JPYmogPSB7XG4gICAgICAgICAgICByOiBwYXJzZUludChyLCAxNiksXG4gICAgICAgICAgICBnOiBwYXJzZUludChnLCAxNiksXG4gICAgICAgICAgICBiOiBwYXJzZUludChiLCAxNiksXG4gICAgICAgICAgICBhOiAxXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGNvbG9yWzBdICE9PSAnIycpIHtcbiAgICAgICAgaXNSZ2IgPSBjb2xvclswXSA9PT0gJ3InICYmIGNvbG9yWzFdID09PSAnZycgJiYgY29sb3JbMl0gPT09ICdiJztcbiAgICAgICAgaWYgKGlzUmdiKSB7XG4gICAgICAgICAgcmdiQ29sb3IgPSBjb2xvcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWlzUmdiKSB7XG4gICAgICAgICAgcmdiQ29sb3IgPSAhdGhpcy5zaG9ydENvbG9yc1tjb2xvcl0gPyAodGhpcy5kaXYuc3R5bGUuY29sb3IgPSBjb2xvciwgdGhpcy5jb21wdXRlZFN0eWxlKHRoaXMuZGl2KS5jb2xvcikgOiB0aGlzLnNob3J0Q29sb3JzW2NvbG9yXTtcbiAgICAgICAgfVxuICAgICAgICByZWdleFN0cmluZzEgPSAnXnJnYmE/XFxcXCgoXFxcXGR7MSwzfSksXFxcXHM/KFxcXFxkezEsM30pLCc7XG4gICAgICAgIHJlZ2V4U3RyaW5nMiA9ICdcXFxccz8oXFxcXGR7MSwzfSksP1xcXFxzPyhcXFxcZHsxfXwwP1xcXFwuXFxcXGR7MSx9KT9cXFxcKSQnO1xuICAgICAgICByZXN1bHQgPSBuZXcgUmVnRXhwKHJlZ2V4U3RyaW5nMSArIHJlZ2V4U3RyaW5nMiwgJ2dpJykuZXhlYyhyZ2JDb2xvcik7XG4gICAgICAgIGNvbG9yT2JqID0ge307XG4gICAgICAgIGFscGhhID0gcGFyc2VGbG9hdChyZXN1bHRbNF0gfHwgMSk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICBjb2xvck9iaiA9IHtcbiAgICAgICAgICAgIHI6IHBhcnNlSW50KHJlc3VsdFsxXSwgMTApLFxuICAgICAgICAgICAgZzogcGFyc2VJbnQocmVzdWx0WzJdLCAxMCksXG4gICAgICAgICAgICBiOiBwYXJzZUludChyZXN1bHRbM10sIDEwKSxcbiAgICAgICAgICAgIGE6IChhbHBoYSAhPSBudWxsKSAmJiAhaXNOYU4oYWxwaGEpID8gYWxwaGEgOiAxXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbG9yT2JqO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jb21wdXRlZFN0eWxlID0gZnVuY3Rpb24oZWwpIHtcbiAgICAgIHJldHVybiBnZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2FwaXRhbGl6ZSA9IGZ1bmN0aW9uKHN0cikge1xuICAgICAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdTdHJpbmcgZXhwZWN0ZWQgLSBub3RoaW5nIHRvIGNhcGl0YWxpemUnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc3Vic3RyaW5nKDEpO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZVJhbmQgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHZhciByYW5kLCByYW5kQXJyLCB1bml0cztcbiAgICAgIHJhbmRBcnIgPSBzdHJpbmcuc3BsaXQoL3JhbmRcXCh8XFwsfFxcKS8pO1xuICAgICAgdW5pdHMgPSB0aGlzLnBhcnNlVW5pdChyYW5kQXJyWzJdKTtcbiAgICAgIHJhbmQgPSB0aGlzLnJhbmQocGFyc2VGbG9hdChyYW5kQXJyWzFdKSwgcGFyc2VGbG9hdChyYW5kQXJyWzJdKSk7XG4gICAgICBpZiAodW5pdHMudW5pdCAmJiByYW5kQXJyWzJdLm1hdGNoKHVuaXRzLnVuaXQpKSB7XG4gICAgICAgIHJldHVybiByYW5kICsgdW5pdHMudW5pdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByYW5kO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZVN0YWdnZXIgPSBmdW5jdGlvbihzdHJpbmcsIGluZGV4KSB7XG4gICAgICB2YXIgYmFzZSwgbnVtYmVyLCBzcGxpdHRlZFZhbHVlLCB1bml0LCB1bml0VmFsdWUsIHZhbHVlO1xuICAgICAgdmFsdWUgPSBzdHJpbmcuc3BsaXQoL3N0YWdnZXJcXCh8XFwpJC8pWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICBzcGxpdHRlZFZhbHVlID0gdmFsdWUuc3BsaXQoLyhyYW5kXFwoLio/XFwpfFteXFwoLFxcc10rKSg/PVxccyosfFxccyokKS9naW0pO1xuICAgICAgdmFsdWUgPSBzcGxpdHRlZFZhbHVlLmxlbmd0aCA+IDMgPyAoYmFzZSA9IHRoaXMucGFyc2VVbml0KHRoaXMucGFyc2VJZlJhbmQoc3BsaXR0ZWRWYWx1ZVsxXSkpLCBzcGxpdHRlZFZhbHVlWzNdKSA6IChiYXNlID0gdGhpcy5wYXJzZVVuaXQoMCksIHNwbGl0dGVkVmFsdWVbMV0pO1xuICAgICAgdmFsdWUgPSB0aGlzLnBhcnNlSWZSYW5kKHZhbHVlKTtcbiAgICAgIHVuaXRWYWx1ZSA9IHRoaXMucGFyc2VVbml0KHZhbHVlKTtcbiAgICAgIG51bWJlciA9IGluZGV4ICogdW5pdFZhbHVlLnZhbHVlICsgYmFzZS52YWx1ZTtcbiAgICAgIHVuaXQgPSBiYXNlLmlzU3RyaWN0ID8gYmFzZS51bml0IDogdW5pdFZhbHVlLmlzU3RyaWN0ID8gdW5pdFZhbHVlLnVuaXQgOiAnJztcbiAgICAgIGlmICh1bml0KSB7XG4gICAgICAgIHJldHVybiBcIlwiICsgbnVtYmVyICsgdW5pdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudW1iZXI7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnBhcnNlSWZTdGFnZ2VyID0gZnVuY3Rpb24odmFsdWUsIGkpIHtcbiAgICAgIGlmICghKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubWF0Y2goL3N0YWdnZXIvZykpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlU3RhZ2dlcih2YWx1ZSwgaSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnBhcnNlSWZSYW5kID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgICBpZiAodHlwZW9mIHN0ciA9PT0gJ3N0cmluZycgJiYgc3RyLm1hdGNoKC9yYW5kXFwoLykpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VSYW5kKHN0cik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZURlbHRhID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgdmFyIGRlbHRhLCBlbmQsIGVuZEFyciwgZW5kQ29sb3JPYmosIGksIHN0YXJ0LCBzdGFydEFyciwgc3RhcnRDb2xvck9iaiwgX2ksIF9sZW47XG4gICAgICBzdGFydCA9IE9iamVjdC5rZXlzKHZhbHVlKVswXTtcbiAgICAgIGVuZCA9IHZhbHVlW3N0YXJ0XTtcbiAgICAgIGRlbHRhID0ge1xuICAgICAgICBzdGFydDogc3RhcnRcbiAgICAgIH07XG4gICAgICBpZiAoaXNOYU4ocGFyc2VGbG9hdChzdGFydCkpICYmICFzdGFydC5tYXRjaCgvcmFuZFxcKC8pKSB7XG4gICAgICAgIGlmIChrZXkgPT09ICdzdHJva2VMaW5lY2FwJykge1xuICAgICAgICAgIHRoaXMud2FybihcIlNvcnJ5LCBzdHJva2UtbGluZWNhcCBwcm9wZXJ0eSBpcyBub3QgYW5pbWF0YWJsZSB5ZXQsIHVzaW5nIHRoZSBzdGFydChcIiArIHN0YXJ0ICsgXCIpIHZhbHVlIGluc3RlYWRcIiwgdmFsdWUpO1xuICAgICAgICAgIHJldHVybiBkZWx0YTtcbiAgICAgICAgfVxuICAgICAgICBzdGFydENvbG9yT2JqID0gdGhpcy5tYWtlQ29sb3JPYmooc3RhcnQpO1xuICAgICAgICBlbmRDb2xvck9iaiA9IHRoaXMubWFrZUNvbG9yT2JqKGVuZCk7XG4gICAgICAgIGRlbHRhID0ge1xuICAgICAgICAgIHN0YXJ0OiBzdGFydENvbG9yT2JqLFxuICAgICAgICAgIGVuZDogZW5kQ29sb3JPYmosXG4gICAgICAgICAgdHlwZTogJ2NvbG9yJyxcbiAgICAgICAgICBkZWx0YToge1xuICAgICAgICAgICAgcjogZW5kQ29sb3JPYmouciAtIHN0YXJ0Q29sb3JPYmoucixcbiAgICAgICAgICAgIGc6IGVuZENvbG9yT2JqLmcgLSBzdGFydENvbG9yT2JqLmcsXG4gICAgICAgICAgICBiOiBlbmRDb2xvck9iai5iIC0gc3RhcnRDb2xvck9iai5iLFxuICAgICAgICAgICAgYTogZW5kQ29sb3JPYmouYSAtIHN0YXJ0Q29sb3JPYmouYVxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSAnc3Ryb2tlRGFzaGFycmF5JyB8fCBrZXkgPT09ICdzdHJva2VEYXNob2Zmc2V0Jykge1xuICAgICAgICBzdGFydEFyciA9IHRoaXMuc3RyVG9BcnIoc3RhcnQpO1xuICAgICAgICBlbmRBcnIgPSB0aGlzLnN0clRvQXJyKGVuZCk7XG4gICAgICAgIHRoaXMubm9ybURhc2hBcnJheXMoc3RhcnRBcnIsIGVuZEFycik7XG4gICAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IHN0YXJ0QXJyLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICAgIHN0YXJ0ID0gc3RhcnRBcnJbaV07XG4gICAgICAgICAgZW5kID0gZW5kQXJyW2ldO1xuICAgICAgICAgIHRoaXMubWVyZ2VVbml0cyhzdGFydCwgZW5kLCBrZXkpO1xuICAgICAgICB9XG4gICAgICAgIGRlbHRhID0ge1xuICAgICAgICAgIHN0YXJ0OiBzdGFydEFycixcbiAgICAgICAgICBlbmQ6IGVuZEFycixcbiAgICAgICAgICBkZWx0YTogdGhpcy5jYWxjQXJyRGVsdGEoc3RhcnRBcnIsIGVuZEFyciksXG4gICAgICAgICAgdHlwZTogJ2FycmF5J1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCF0aGlzLmNoYWluT3B0aW9uTWFwW2tleV0pIHtcbiAgICAgICAgICBpZiAodGhpcy5wb3NQcm9wc01hcFtrZXldKSB7XG4gICAgICAgICAgICBlbmQgPSB0aGlzLnBhcnNlVW5pdCh0aGlzLnBhcnNlSWZSYW5kKGVuZCkpO1xuICAgICAgICAgICAgc3RhcnQgPSB0aGlzLnBhcnNlVW5pdCh0aGlzLnBhcnNlSWZSYW5kKHN0YXJ0KSk7XG4gICAgICAgICAgICB0aGlzLm1lcmdlVW5pdHMoc3RhcnQsIGVuZCwga2V5KTtcbiAgICAgICAgICAgIGRlbHRhID0ge1xuICAgICAgICAgICAgICBzdGFydDogc3RhcnQsXG4gICAgICAgICAgICAgIGVuZDogZW5kLFxuICAgICAgICAgICAgICBkZWx0YTogZW5kLnZhbHVlIC0gc3RhcnQudmFsdWUsXG4gICAgICAgICAgICAgIHR5cGU6ICd1bml0J1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW5kID0gcGFyc2VGbG9hdCh0aGlzLnBhcnNlSWZSYW5kKGVuZCkpO1xuICAgICAgICAgICAgc3RhcnQgPSBwYXJzZUZsb2F0KHRoaXMucGFyc2VJZlJhbmQoc3RhcnQpKTtcbiAgICAgICAgICAgIGRlbHRhID0ge1xuICAgICAgICAgICAgICBzdGFydDogc3RhcnQsXG4gICAgICAgICAgICAgIGVuZDogZW5kLFxuICAgICAgICAgICAgICBkZWx0YTogZW5kIC0gc3RhcnQsXG4gICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGRlbHRhO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5tZXJnZVVuaXRzID0gZnVuY3Rpb24oc3RhcnQsIGVuZCwga2V5KSB7XG4gICAgICBpZiAoIWVuZC5pc1N0cmljdCAmJiBzdGFydC5pc1N0cmljdCkge1xuICAgICAgICBlbmQudW5pdCA9IHN0YXJ0LnVuaXQ7XG4gICAgICAgIHJldHVybiBlbmQuc3RyaW5nID0gXCJcIiArIGVuZC52YWx1ZSArIGVuZC51bml0O1xuICAgICAgfSBlbHNlIGlmIChlbmQuaXNTdHJpY3QgJiYgIXN0YXJ0LmlzU3RyaWN0KSB7XG4gICAgICAgIHN0YXJ0LnVuaXQgPSBlbmQudW5pdDtcbiAgICAgICAgcmV0dXJuIHN0YXJ0LnN0cmluZyA9IFwiXCIgKyBzdGFydC52YWx1ZSArIHN0YXJ0LnVuaXQ7XG4gICAgICB9IGVsc2UgaWYgKGVuZC5pc1N0cmljdCAmJiBzdGFydC5pc1N0cmljdCkge1xuICAgICAgICBpZiAoZW5kLnVuaXQgIT09IHN0YXJ0LnVuaXQpIHtcbiAgICAgICAgICBzdGFydC51bml0ID0gZW5kLnVuaXQ7XG4gICAgICAgICAgc3RhcnQuc3RyaW5nID0gXCJcIiArIHN0YXJ0LnZhbHVlICsgc3RhcnQudW5pdDtcbiAgICAgICAgICByZXR1cm4gdGhpcy53YXJuKFwiVHdvIGRpZmZlcmVudCB1bml0cyB3ZXJlIHNwZWNpZmllZCBvbiBcXFwiXCIgKyBrZXkgKyBcIlxcXCIgZGVsdGEgcHJvcGVydHksIG1vIMK3IGpzIHdpbGwgZmFsbGJhY2sgdG8gZW5kIFxcXCJcIiArIGVuZC51bml0ICsgXCJcXFwiIHVuaXQgXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnJhbmQgPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgICAgcmV0dXJuIChNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikpICsgbWluO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5pc0RPTSA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBpc05vZGU7XG4gICAgICBpZiAobyA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlzTm9kZSA9IHR5cGVvZiBvLm5vZGVUeXBlID09PSAnbnVtYmVyJyAmJiB0eXBlb2Ygby5ub2RlTmFtZSA9PT0gJ3N0cmluZyc7XG4gICAgICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIGlzTm9kZTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZ2V0Q2hpbGRFbGVtZW50cyA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgIHZhciBjaGlsZE5vZGVzLCBjaGlsZHJlbiwgaTtcbiAgICAgIGNoaWxkTm9kZXMgPSBlbGVtZW50LmNoaWxkTm9kZXM7XG4gICAgICBjaGlsZHJlbiA9IFtdO1xuICAgICAgaSA9IGNoaWxkTm9kZXMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAoY2hpbGROb2Rlc1tpXS5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgICAgIGNoaWxkcmVuLnVuc2hpZnQoY2hpbGROb2Rlc1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZGVsdGEgPSBmdW5jdGlvbihzdGFydCwgZW5kKSB7XG4gICAgICB2YXIgaXNUeXBlMSwgaXNUeXBlMiwgb2JqLCB0eXBlMSwgdHlwZTI7XG4gICAgICB0eXBlMSA9IHR5cGVvZiBzdGFydDtcbiAgICAgIHR5cGUyID0gdHlwZW9mIGVuZDtcbiAgICAgIGlzVHlwZTEgPSB0eXBlMSA9PT0gJ3N0cmluZycgfHwgdHlwZTEgPT09ICdudW1iZXInICYmICFpc05hTihzdGFydCk7XG4gICAgICBpc1R5cGUyID0gdHlwZTIgPT09ICdzdHJpbmcnIHx8IHR5cGUyID09PSAnbnVtYmVyJyAmJiAhaXNOYU4oZW5kKTtcbiAgICAgIGlmICghaXNUeXBlMSB8fCAhaXNUeXBlMikge1xuICAgICAgICB0aGlzLmVycm9yKFwiZGVsdGEgbWV0aG9kIGV4cGVjdHMgU3RyaW5ncyBvciBOdW1iZXJzIGF0IGlucHV0IGJ1dCBnb3QgLSBcIiArIHN0YXJ0ICsgXCIsIFwiICsgZW5kKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgb2JqID0ge307XG4gICAgICBvYmpbc3RhcnRdID0gZW5kO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZ2V0VW5pcUlEID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gKyt0aGlzLnVuaXFJRHM7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnBhcnNlUGF0aCA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgICAgIHZhciBkb21QYXRoO1xuICAgICAgaWYgKHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAocGF0aC5jaGFyQXQoMCkudG9Mb3dlckNhc2UoKSA9PT0gJ20nKSB7XG4gICAgICAgICAgZG9tUGF0aCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyh0aGlzLk5TLCAncGF0aCcpO1xuICAgICAgICAgIGRvbVBhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ2QnLCBwYXRoKTtcbiAgICAgICAgICByZXR1cm4gZG9tUGF0aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihwYXRoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBhdGguc3R5bGUpIHtcbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmNsb3NlRW5vdWdoID0gZnVuY3Rpb24obnVtMSwgbnVtMiwgZXBzKSB7XG4gICAgICByZXR1cm4gTWF0aC5hYnMobnVtMSAtIG51bTIpIDwgZXBzO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jaGVja0lmM2QgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkaXYsIHByZWZpeGVkLCBzdHlsZSwgdHI7XG4gICAgICBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHRoaXMuc3R5bGUoZGl2LCAndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZVooMCknKTtcbiAgICAgIHN0eWxlID0gZGl2LnN0eWxlO1xuICAgICAgcHJlZml4ZWQgPSBcIlwiICsgdGhpcy5wcmVmaXguY3NzICsgXCJ0cmFuc2Zvcm1cIjtcbiAgICAgIHRyID0gc3R5bGVbcHJlZml4ZWRdICE9IG51bGwgPyBzdHlsZVtwcmVmaXhlZF0gOiBzdHlsZS50cmFuc2Zvcm07XG4gICAgICByZXR1cm4gdHIgIT09ICcnO1xuICAgIH07XG5cbiAgICByZXR1cm4gSGVscGVycztcblxuICB9KSgpO1xuXG4gIGggPSBuZXcgSGVscGVycztcblxuICBtb2R1bGUuZXhwb3J0cyA9IGg7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHdpbmRvdy5tb2pzID0ge1xuICAgIHJldmlzaW9uOiAnMC4xNDcuNCcsXG4gICAgaXNEZWJ1ZzogdHJ1ZSxcbiAgICBoZWxwZXJzOiByZXF1aXJlKCcuL2gnKSxcbiAgICBCaXQ6IHJlcXVpcmUoJy4vc2hhcGVzL2JpdCcpLFxuICAgIGJpdHNNYXA6IHJlcXVpcmUoJy4vc2hhcGVzL2JpdHNNYXAnKSxcbiAgICBDaXJjbGU6IHJlcXVpcmUoJy4vc2hhcGVzL2NpcmNsZScpLFxuICAgIENyb3NzOiByZXF1aXJlKCcuL3NoYXBlcy9jcm9zcycpLFxuICAgIExpbmU6IHJlcXVpcmUoJy4vc2hhcGVzL2xpbmUnKSxcbiAgICBSZWN0OiByZXF1aXJlKCcuL3NoYXBlcy9yZWN0JyksXG4gICAgUG9seWdvbjogcmVxdWlyZSgnLi9zaGFwZXMvcG9seWdvbicpLFxuICAgIEVxdWFsOiByZXF1aXJlKCcuL3NoYXBlcy9lcXVhbCcpLFxuICAgIFppZ3phZzogcmVxdWlyZSgnLi9zaGFwZXMvemlnemFnJyksXG4gICAgQnVyc3Q6IHJlcXVpcmUoJy4vYnVyc3QnKSxcbiAgICBUcmFuc2l0OiByZXF1aXJlKCcuL3RyYW5zaXQnKSxcbiAgICBTd2lybDogcmVxdWlyZSgnLi9zd2lybCcpLFxuICAgIFN0YWdnZXI6IHJlcXVpcmUoJy4vc3RhZ2dlcicpLFxuICAgIFNwcml0ZXI6IHJlcXVpcmUoJy4vc3ByaXRlcicpLFxuICAgIE1vdGlvblBhdGg6IHJlcXVpcmUoJy4vbW90aW9uLXBhdGgnKSxcbiAgICBUd2VlbjogcmVxdWlyZSgnLi90d2Vlbi90d2VlbicpLFxuICAgIFRpbWVsaW5lOiByZXF1aXJlKCcuL3R3ZWVuL3RpbWVsaW5lJyksXG4gICAgdHdlZW5lcjogcmVxdWlyZSgnLi90d2Vlbi90d2VlbmVyJyksXG4gICAgZWFzaW5nOiByZXF1aXJlKCcuL2Vhc2luZy9lYXNpbmcnKVxuICB9O1xuXG4gIG1vanMuaCA9IG1vanMuaGVscGVycztcblxuICBtb2pzLmRlbHRhID0gbW9qcy5oLmRlbHRhO1xuXG5cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuICBpZiAoKHR5cGVvZiBkZWZpbmUgPT09IFwiZnVuY3Rpb25cIikgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShcIm1vanNcIiwgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG1vanM7XG4gICAgfSk7XG4gIH1cblxuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbiAgaWYgKCh0eXBlb2YgbW9kdWxlID09PSBcIm9iamVjdFwiKSAmJiAodHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSBcIm9iamVjdFwiKSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gbW9qcztcbiAgfVxuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgTW90aW9uUGF0aCwgVGltZWxpbmUsIFR3ZWVuLCBoLCByZXNpemUsXG4gICAgX19iaW5kID0gZnVuY3Rpb24oZm4sIG1lKXsgcmV0dXJuIGZ1bmN0aW9uKCl7IHJldHVybiBmbi5hcHBseShtZSwgYXJndW1lbnRzKTsgfTsgfTtcblxuICBoID0gcmVxdWlyZSgnLi9oJyk7XG5cbiAgcmVzaXplID0gcmVxdWlyZSgnLi92ZW5kb3IvcmVzaXplJyk7XG5cbiAgVHdlZW4gPSByZXF1aXJlKCcuL3R3ZWVuL3R3ZWVuJyk7XG5cbiAgVGltZWxpbmUgPSByZXF1aXJlKCcuL3R3ZWVuL3RpbWVsaW5lJyk7XG5cbiAgTW90aW9uUGF0aCA9IChmdW5jdGlvbigpIHtcbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5kZWZhdWx0cyA9IHtcbiAgICAgIHBhdGg6IG51bGwsXG4gICAgICBjdXJ2YXR1cmU6IHtcbiAgICAgICAgeDogJzc1JScsXG4gICAgICAgIHk6ICc1MCUnXG4gICAgICB9LFxuICAgICAgaXNDb21wb3NpdGVMYXllcjogdHJ1ZSxcbiAgICAgIGRlbGF5OiAwLFxuICAgICAgZHVyYXRpb246IDEwMDAsXG4gICAgICBlYXNpbmc6IG51bGwsXG4gICAgICByZXBlYXQ6IDAsXG4gICAgICB5b3lvOiBmYWxzZSxcbiAgICAgIG9mZnNldFg6IDAsXG4gICAgICBvZmZzZXRZOiAwLFxuICAgICAgYW5nbGVPZmZzZXQ6IG51bGwsXG4gICAgICBwYXRoU3RhcnQ6IDAsXG4gICAgICBwYXRoRW5kOiAxLFxuICAgICAgbW90aW9uQmx1cjogMCxcbiAgICAgIHRyYW5zZm9ybU9yaWdpbjogbnVsbCxcbiAgICAgIGlzQW5nbGU6IGZhbHNlLFxuICAgICAgaXNSZXZlcnNlOiBmYWxzZSxcbiAgICAgIGlzUnVuTGVzczogZmFsc2UsXG4gICAgICBpc1ByZXNldFBvc2l0aW9uOiB0cnVlLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uQ29tcGxldGU6IG51bGwsXG4gICAgICBvblVwZGF0ZTogbnVsbFxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBNb3Rpb25QYXRoKG8pIHtcbiAgICAgIHRoaXMubyA9IG8gIT0gbnVsbCA/IG8gOiB7fTtcbiAgICAgIHRoaXMuY2FsY0hlaWdodCA9IF9fYmluZCh0aGlzLmNhbGNIZWlnaHQsIHRoaXMpO1xuICAgICAgaWYgKHRoaXMudmFycygpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuY3JlYXRlVHdlZW4oKTtcbiAgICAgIHRoaXM7XG4gICAgfVxuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5nZXRTY2FsZXIgPSBoLmJpbmQodGhpcy5nZXRTY2FsZXIsIHRoaXMpO1xuICAgICAgdGhpcy5yZXNpemUgPSByZXNpemU7XG4gICAgICB0aGlzLnByb3BzID0gaC5jbG9uZU9iaih0aGlzLmRlZmF1bHRzKTtcbiAgICAgIHRoaXMuZXh0ZW5kT3B0aW9ucyh0aGlzLm8pO1xuICAgICAgdGhpcy5pc01vdGlvbkJsdXJSZXNldCA9IGguaXNTYWZhcmkgfHwgaC5pc0lFO1xuICAgICAgdGhpcy5pc01vdGlvbkJsdXJSZXNldCAmJiAodGhpcy5wcm9wcy5tb3Rpb25CbHVyID0gMCk7XG4gICAgICB0aGlzLmhpc3RvcnkgPSBbaC5jbG9uZU9iaih0aGlzLnByb3BzKV07XG4gICAgICByZXR1cm4gdGhpcy5wb3N0VmFycygpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5jdXJ2ZVRvUGF0aCA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBhbmdsZSwgY3VydmF0dXJlLCBjdXJ2YXR1cmVYLCBjdXJ2YXR1cmVZLCBjdXJ2ZVBvaW50LCBjdXJ2ZVhQb2ludCwgZFgsIGRZLCBlbmRQb2ludCwgcGF0aCwgcGVyY2VudCwgcmFkaXVzLCBzdGFydDtcbiAgICAgIHBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoaC5OUywgJ3BhdGgnKTtcbiAgICAgIHN0YXJ0ID0gby5zdGFydDtcbiAgICAgIGVuZFBvaW50ID0ge1xuICAgICAgICB4OiBzdGFydC54ICsgby5zaGlmdC54LFxuICAgICAgICB5OiBzdGFydC54ICsgby5zaGlmdC55XG4gICAgICB9O1xuICAgICAgY3VydmF0dXJlID0gby5jdXJ2YXR1cmU7XG4gICAgICBkWCA9IG8uc2hpZnQueDtcbiAgICAgIGRZID0gby5zaGlmdC55O1xuICAgICAgcmFkaXVzID0gTWF0aC5zcXJ0KGRYICogZFggKyBkWSAqIGRZKTtcbiAgICAgIHBlcmNlbnQgPSByYWRpdXMgLyAxMDA7XG4gICAgICBhbmdsZSA9IE1hdGguYXRhbihkWSAvIGRYKSAqICgxODAgLyBNYXRoLlBJKSArIDkwO1xuICAgICAgaWYgKG8uc2hpZnQueCA8IDApIHtcbiAgICAgICAgYW5nbGUgPSBhbmdsZSArIDE4MDtcbiAgICAgIH1cbiAgICAgIGN1cnZhdHVyZVggPSBoLnBhcnNlVW5pdChjdXJ2YXR1cmUueCk7XG4gICAgICBjdXJ2YXR1cmVYID0gY3VydmF0dXJlWC51bml0ID09PSAnJScgPyBjdXJ2YXR1cmVYLnZhbHVlICogcGVyY2VudCA6IGN1cnZhdHVyZVgudmFsdWU7XG4gICAgICBjdXJ2ZVhQb2ludCA9IGguZ2V0UmFkaWFsUG9pbnQoe1xuICAgICAgICBjZW50ZXI6IHtcbiAgICAgICAgICB4OiBzdGFydC54LFxuICAgICAgICAgIHk6IHN0YXJ0LnlcbiAgICAgICAgfSxcbiAgICAgICAgcmFkaXVzOiBjdXJ2YXR1cmVYLFxuICAgICAgICBhbmdsZTogYW5nbGVcbiAgICAgIH0pO1xuICAgICAgY3VydmF0dXJlWSA9IGgucGFyc2VVbml0KGN1cnZhdHVyZS55KTtcbiAgICAgIGN1cnZhdHVyZVkgPSBjdXJ2YXR1cmVZLnVuaXQgPT09ICclJyA/IGN1cnZhdHVyZVkudmFsdWUgKiBwZXJjZW50IDogY3VydmF0dXJlWS52YWx1ZTtcbiAgICAgIGN1cnZlUG9pbnQgPSBoLmdldFJhZGlhbFBvaW50KHtcbiAgICAgICAgY2VudGVyOiB7XG4gICAgICAgICAgeDogY3VydmVYUG9pbnQueCxcbiAgICAgICAgICB5OiBjdXJ2ZVhQb2ludC55XG4gICAgICAgIH0sXG4gICAgICAgIHJhZGl1czogY3VydmF0dXJlWSxcbiAgICAgICAgYW5nbGU6IGFuZ2xlICsgOTBcbiAgICAgIH0pO1xuICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoJ2QnLCBcIk1cIiArIHN0YXJ0LnggKyBcIixcIiArIHN0YXJ0LnkgKyBcIiBRXCIgKyBjdXJ2ZVBvaW50LnggKyBcIixcIiArIGN1cnZlUG9pbnQueSArIFwiIFwiICsgZW5kUG9pbnQueCArIFwiLFwiICsgZW5kUG9pbnQueSk7XG4gICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUucG9zdFZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucHJvcHMucGF0aFN0YXJ0ID0gaC5jbGFtcCh0aGlzLnByb3BzLnBhdGhTdGFydCwgMCwgMSk7XG4gICAgICB0aGlzLnByb3BzLnBhdGhFbmQgPSBoLmNsYW1wKHRoaXMucHJvcHMucGF0aEVuZCwgdGhpcy5wcm9wcy5wYXRoU3RhcnQsIDEpO1xuICAgICAgdGhpcy5hbmdsZSA9IDA7XG4gICAgICB0aGlzLnNwZWVkWCA9IDA7XG4gICAgICB0aGlzLnNwZWVkWSA9IDA7XG4gICAgICB0aGlzLmJsdXJYID0gMDtcbiAgICAgIHRoaXMuYmx1clkgPSAwO1xuICAgICAgdGhpcy5wcmV2Q29vcmRzID0ge307XG4gICAgICB0aGlzLmJsdXJBbW91bnQgPSAyMDtcbiAgICAgIHRoaXMucHJvcHMubW90aW9uQmx1ciA9IGguY2xhbXAodGhpcy5wcm9wcy5tb3Rpb25CbHVyLCAwLCAxKTtcbiAgICAgIHRoaXMub25VcGRhdGUgPSB0aGlzLnByb3BzLm9uVXBkYXRlO1xuICAgICAgaWYgKCF0aGlzLm8uZWwpIHtcbiAgICAgICAgaC5lcnJvcignTWlzc2VkIFwiZWxcIiBvcHRpb24uIEl0IGNvdWxkIGJlIGEgc2VsZWN0b3IsIERPTU5vZGUgb3IgYW5vdGhlciBtb2R1bGUuJyk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5lbCA9IHRoaXMucGFyc2VFbCh0aGlzLnByb3BzLmVsKTtcbiAgICAgIHRoaXMucHJvcHMubW90aW9uQmx1ciA+IDAgJiYgdGhpcy5jcmVhdGVGaWx0ZXIoKTtcbiAgICAgIHRoaXMucGF0aCA9IHRoaXMuZ2V0UGF0aCgpO1xuICAgICAgaWYgKCF0aGlzLnBhdGguZ2V0QXR0cmlidXRlKCdkJykpIHtcbiAgICAgICAgaC5lcnJvcignUGF0aCBoYXMgbm8gY29vcmRpbmF0ZXMgdG8gd29yayB3aXRoLCBhYm9ydGluZycpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGVuID0gdGhpcy5wYXRoLmdldFRvdGFsTGVuZ3RoKCk7XG4gICAgICB0aGlzLnNsaWNlZExlbiA9IHRoaXMubGVuICogKHRoaXMucHJvcHMucGF0aEVuZCAtIHRoaXMucHJvcHMucGF0aFN0YXJ0KTtcbiAgICAgIHRoaXMuc3RhcnRMZW4gPSB0aGlzLnByb3BzLnBhdGhTdGFydCAqIHRoaXMubGVuO1xuICAgICAgdGhpcy5maWxsID0gdGhpcy5wcm9wcy5maWxsO1xuICAgICAgaWYgKHRoaXMuZmlsbCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5wYXJzZUVsKHRoaXMucHJvcHMuZmlsbC5jb250YWluZXIpO1xuICAgICAgICB0aGlzLmZpbGxSdWxlID0gdGhpcy5wcm9wcy5maWxsLmZpbGxSdWxlIHx8ICdhbGwnO1xuICAgICAgICB0aGlzLmdldFNjYWxlcigpO1xuICAgICAgICBpZiAodGhpcy5jb250YWluZXIgIT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMucmVtb3ZlRXZlbnQodGhpcy5jb250YWluZXIsICdvbnJlc2l6ZScsIHRoaXMuZ2V0U2NhbGVyKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hZGRFdmVudCh0aGlzLmNvbnRhaW5lciwgJ29ucmVzaXplJywgdGhpcy5nZXRTY2FsZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmFkZEV2ZW50ID0gZnVuY3Rpb24oZWwsIHR5cGUsIGhhbmRsZXIpIHtcbiAgICAgIHJldHVybiBlbC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUucmVtb3ZlRXZlbnQgPSBmdW5jdGlvbihlbCwgdHlwZSwgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgZmFsc2UpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5jcmVhdGVGaWx0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkaXYsIHN2ZztcbiAgICAgIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgdGhpcy5maWx0ZXJJRCA9IFwiZmlsdGVyLVwiICsgKGguZ2V0VW5pcUlEKCkpO1xuICAgICAgZGl2LmlubmVySFRNTCA9IFwiPHN2ZyBpZD1cXFwic3ZnLVwiICsgdGhpcy5maWx0ZXJJRCArIFwiXFxcIlxcbiAgICBzdHlsZT1cXFwidmlzaWJpbGl0eTpoaWRkZW47IHdpZHRoOjBweDsgaGVpZ2h0OjBweFxcXCI+XFxuICA8ZmlsdGVyIGlkPVxcXCJcIiArIHRoaXMuZmlsdGVySUQgKyBcIlxcXCIgeT1cXFwiLTIwXFxcIiB4PVxcXCItMjBcXFwiIHdpZHRoPVxcXCI0MFxcXCIgaGVpZ2h0PVxcXCI0MFxcXCI+XFxuICAgIDxmZU9mZnNldFxcbiAgICAgIGlkPVxcXCJibHVyLW9mZnNldFxcXCIgaW49XFxcIlNvdXJjZUdyYXBoaWNcXFwiXFxuICAgICAgZHg9XFxcIjBcXFwiIGR5PVxcXCIwXFxcIiByZXN1bHQ9XFxcIm9mZnNldDJcXFwiPjwvZmVPZmZzZXQ+XFxuICAgIDxmZUdhdXNzaWFuYmx1clxcbiAgICAgIGlkPVxcXCJibHVyXFxcIiBpbj1cXFwib2Zmc2V0MlxcXCJcXG4gICAgICBzdGREZXZpYXRpb249XFxcIjAsMFxcXCIgcmVzdWx0PVxcXCJibHVyMlxcXCI+PC9mZUdhdXNzaWFuYmx1cj5cXG4gICAgPGZlTWVyZ2U+XFxuICAgICAgPGZlTWVyZ2VOb2RlIGluPVxcXCJTb3VyY2VHcmFwaGljXFxcIj48L2ZlTWVyZ2VOb2RlPlxcbiAgICAgIDxmZU1lcmdlTm9kZSBpbj1cXFwiYmx1cjJcXFwiPjwvZmVNZXJnZU5vZGU+XFxuICAgIDwvZmVNZXJnZT5cXG4gIDwvZmlsdGVyPlxcbjwvc3ZnPlwiO1xuICAgICAgc3ZnID0gZGl2LnF1ZXJ5U2VsZWN0b3IoXCIjc3ZnLVwiICsgdGhpcy5maWx0ZXJJRCk7XG4gICAgICB0aGlzLmZpbHRlciA9IHN2Zy5xdWVyeVNlbGVjdG9yKCcjYmx1cicpO1xuICAgICAgdGhpcy5maWx0ZXJPZmZzZXQgPSBzdmcucXVlcnlTZWxlY3RvcignI2JsdXItb2Zmc2V0Jyk7XG4gICAgICBkb2N1bWVudC5ib2R5Lmluc2VydEJlZm9yZShzdmcsIGRvY3VtZW50LmJvZHkuZmlyc3RDaGlsZCk7XG4gICAgICB0aGlzLmVsLnN0eWxlWydmaWx0ZXInXSA9IFwidXJsKCNcIiArIHRoaXMuZmlsdGVySUQgKyBcIilcIjtcbiAgICAgIHJldHVybiB0aGlzLmVsLnN0eWxlW1wiXCIgKyBoLnByZWZpeC5jc3MgKyBcImZpbHRlclwiXSA9IFwidXJsKCNcIiArIHRoaXMuZmlsdGVySUQgKyBcIilcIjtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUucGFyc2VFbCA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgICBpZiAodHlwZW9mIGVsID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbCk7XG4gICAgICB9XG4gICAgICBpZiAoZWwgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgICB9XG4gICAgICBpZiAoZWwuc2V0UHJvcCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuaXNNb2R1bGUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmdldFBhdGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwYXRoO1xuICAgICAgcGF0aCA9IGgucGFyc2VQYXRoKHRoaXMucHJvcHMucGF0aCk7XG4gICAgICBpZiAocGF0aCkge1xuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnByb3BzLnBhdGgueCB8fCB0aGlzLnByb3BzLnBhdGgueSkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJ2ZVRvUGF0aCh7XG4gICAgICAgICAgc3RhcnQ6IHtcbiAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICB5OiAwXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzaGlmdDoge1xuICAgICAgICAgICAgeDogdGhpcy5wcm9wcy5wYXRoLnggfHwgMCxcbiAgICAgICAgICAgIHk6IHRoaXMucHJvcHMucGF0aC55IHx8IDBcbiAgICAgICAgICB9LFxuICAgICAgICAgIGN1cnZhdHVyZToge1xuICAgICAgICAgICAgeDogdGhpcy5wcm9wcy5jdXJ2YXR1cmUueCB8fCB0aGlzLmRlZmF1bHRzLmN1cnZhdHVyZS54LFxuICAgICAgICAgICAgeTogdGhpcy5wcm9wcy5jdXJ2YXR1cmUueSB8fCB0aGlzLmRlZmF1bHRzLmN1cnZhdHVyZS55XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuZ2V0U2NhbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZW5kLCBzaXplLCBzdGFydDtcbiAgICAgIHRoaXMuY1NpemUgPSB7XG4gICAgICAgIHdpZHRoOiB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aCB8fCAwLFxuICAgICAgICBoZWlnaHQ6IHRoaXMuY29udGFpbmVyLm9mZnNldEhlaWdodCB8fCAwXG4gICAgICB9O1xuICAgICAgc3RhcnQgPSB0aGlzLnBhdGguZ2V0UG9pbnRBdExlbmd0aCgwKTtcbiAgICAgIGVuZCA9IHRoaXMucGF0aC5nZXRQb2ludEF0TGVuZ3RoKHRoaXMubGVuKTtcbiAgICAgIHNpemUgPSB7fTtcbiAgICAgIHRoaXMuc2NhbGVyID0ge307XG4gICAgICBzaXplLndpZHRoID0gZW5kLnggPj0gc3RhcnQueCA/IGVuZC54IC0gc3RhcnQueCA6IHN0YXJ0LnggLSBlbmQueDtcbiAgICAgIHNpemUuaGVpZ2h0ID0gZW5kLnkgPj0gc3RhcnQueSA/IGVuZC55IC0gc3RhcnQueSA6IHN0YXJ0LnkgLSBlbmQueTtcbiAgICAgIHN3aXRjaCAodGhpcy5maWxsUnVsZSkge1xuICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgIHRoaXMuY2FsY1dpZHRoKHNpemUpO1xuICAgICAgICAgIHJldHVybiB0aGlzLmNhbGNIZWlnaHQoc2l6ZSk7XG4gICAgICAgIGNhc2UgJ3dpZHRoJzpcbiAgICAgICAgICB0aGlzLmNhbGNXaWR0aChzaXplKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zY2FsZXIueSA9IHRoaXMuc2NhbGVyLng7XG4gICAgICAgIGNhc2UgJ2hlaWdodCc6XG4gICAgICAgICAgdGhpcy5jYWxjSGVpZ2h0KHNpemUpO1xuICAgICAgICAgIHJldHVybiB0aGlzLnNjYWxlci54ID0gdGhpcy5zY2FsZXIueTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuY2FsY1dpZHRoID0gZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgdGhpcy5zY2FsZXIueCA9IHRoaXMuY1NpemUud2lkdGggLyBzaXplLndpZHRoO1xuICAgICAgcmV0dXJuICFpc0Zpbml0ZSh0aGlzLnNjYWxlci54KSAmJiAodGhpcy5zY2FsZXIueCA9IDEpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5jYWxjSGVpZ2h0ID0gZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgdGhpcy5zY2FsZXIueSA9IHRoaXMuY1NpemUuaGVpZ2h0IC8gc2l6ZS5oZWlnaHQ7XG4gICAgICByZXR1cm4gIWlzRmluaXRlKHRoaXMuc2NhbGVyLnkpICYmICh0aGlzLnNjYWxlci55ID0gMSk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBmaXN0SXRlbSwga2V5LCB2YWx1ZTtcbiAgICAgIGlmIChvKSB7XG4gICAgICAgIGZpc3RJdGVtID0gdGhpcy5oaXN0b3J5WzBdO1xuICAgICAgICBmb3IgKGtleSBpbiBvKSB7XG4gICAgICAgICAgdmFsdWUgPSBvW2tleV07XG4gICAgICAgICAgaWYgKGguY2FsbGJhY2tzTWFwW2tleV0gfHwgaC50d2Vlbk9wdGlvbk1hcFtrZXldKSB7XG4gICAgICAgICAgICBoLndhcm4oXCJ0aGUgcHJvcGVydHkgXFxcIlwiICsga2V5ICsgXCJcXFwiIHByb3BlcnR5IGNhbiBub3QgYmUgb3ZlcnJpZGRlbiBvbiBydW4geWV0XCIpO1xuICAgICAgICAgICAgZGVsZXRlIG9ba2V5XTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5oaXN0b3J5WzBdW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50dW5lT3B0aW9ucyhvKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0VHdlZW4oKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuY3JlYXRlVHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudHdlZW4gPSBuZXcgVHdlZW4oe1xuICAgICAgICBkdXJhdGlvbjogdGhpcy5wcm9wcy5kdXJhdGlvbixcbiAgICAgICAgZGVsYXk6IHRoaXMucHJvcHMuZGVsYXksXG4gICAgICAgIHlveW86IHRoaXMucHJvcHMueW95byxcbiAgICAgICAgcmVwZWF0OiB0aGlzLnByb3BzLnJlcGVhdCxcbiAgICAgICAgZWFzaW5nOiB0aGlzLnByb3BzLmVhc2luZyxcbiAgICAgICAgb25TdGFydDogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vblN0YXJ0KSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uQ29tcGxldGU6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgICAgX3RoaXMucHJvcHMubW90aW9uQmx1ciAmJiBfdGhpcy5zZXRCbHVyKHtcbiAgICAgICAgICAgICAgYmx1cjoge1xuICAgICAgICAgICAgICAgIHg6IDAsXG4gICAgICAgICAgICAgICAgeTogMFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBvZmZzZXQ6IHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IDBcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vbkNvbXBsZXRlKSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uVXBkYXRlOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLnNldFByb2dyZXNzKHApO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpLFxuICAgICAgICBvbkZpcnN0VXBkYXRlQmFja3dhcmQ6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5oaXN0b3J5Lmxlbmd0aCA+IDEgJiYgX3RoaXMudHVuZU9wdGlvbnMoX3RoaXMuaGlzdG9yeVswXSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcylcbiAgICAgIH0pO1xuICAgICAgdGhpcy50aW1lbGluZSA9IG5ldyBUaW1lbGluZTtcbiAgICAgIHRoaXMudGltZWxpbmUuYWRkKHRoaXMudHdlZW4pO1xuICAgICAgIXRoaXMucHJvcHMuaXNSdW5MZXNzICYmIHRoaXMuc3RhcnRUd2VlbigpO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuaXNQcmVzZXRQb3NpdGlvbiAmJiB0aGlzLnNldFByb2dyZXNzKDAsIHRydWUpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5zdGFydFR3ZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gc2V0VGltZW91dCgoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy50aW1lbGluZSkgIT0gbnVsbCA/IF9yZWYuc3RhcnQoKSA6IHZvaWQgMDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKSwgMSk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnNldFByb2dyZXNzID0gZnVuY3Rpb24ocCwgaXNJbml0KSB7XG4gICAgICB2YXIgbGVuLCBwb2ludCwgeCwgeTtcbiAgICAgIGxlbiA9IHRoaXMuc3RhcnRMZW4gKyAoIXRoaXMucHJvcHMuaXNSZXZlcnNlID8gcCAqIHRoaXMuc2xpY2VkTGVuIDogKDEgLSBwKSAqIHRoaXMuc2xpY2VkTGVuKTtcbiAgICAgIHBvaW50ID0gdGhpcy5wYXRoLmdldFBvaW50QXRMZW5ndGgobGVuKTtcbiAgICAgIHggPSBwb2ludC54ICsgdGhpcy5wcm9wcy5vZmZzZXRYO1xuICAgICAgeSA9IHBvaW50LnkgKyB0aGlzLnByb3BzLm9mZnNldFk7XG4gICAgICB0aGlzLl9nZXRDdXJyZW50QW5nbGUocG9pbnQsIGxlbiwgcCk7XG4gICAgICB0aGlzLl9zZXRUcmFuc2Zvcm1PcmlnaW4ocCk7XG4gICAgICB0aGlzLl9zZXRUcmFuc2Zvcm0oeCwgeSwgcCwgaXNJbml0KTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLm1vdGlvbkJsdXIgJiYgdGhpcy5tYWtlTW90aW9uQmx1cih4LCB5KTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuc2V0RWxQb3NpdGlvbiA9IGZ1bmN0aW9uKHgsIHksIHApIHtcbiAgICAgIHZhciBjb21wb3NpdGUsIGlzQ29tcG9zaXRlLCByb3RhdGUsIHRyYW5zZm9ybTtcbiAgICAgIHJvdGF0ZSA9IHRoaXMuYW5nbGUgIT09IDAgPyBcInJvdGF0ZShcIiArIHRoaXMuYW5nbGUgKyBcImRlZylcIiA6ICcnO1xuICAgICAgaXNDb21wb3NpdGUgPSB0aGlzLnByb3BzLmlzQ29tcG9zaXRlTGF5ZXIgJiYgaC5pczNkO1xuICAgICAgY29tcG9zaXRlID0gaXNDb21wb3NpdGUgPyAndHJhbnNsYXRlWigwKScgOiAnJztcbiAgICAgIHRyYW5zZm9ybSA9IFwidHJhbnNsYXRlKFwiICsgeCArIFwicHgsXCIgKyB5ICsgXCJweCkgXCIgKyByb3RhdGUgKyBcIiBcIiArIGNvbXBvc2l0ZTtcbiAgICAgIHJldHVybiBoLnNldFByZWZpeGVkU3R5bGUodGhpcy5lbCwgJ3RyYW5zZm9ybScsIHRyYW5zZm9ybSk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnNldE1vZHVsZVBvc2l0aW9uID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgdGhpcy5lbC5zZXRQcm9wKHtcbiAgICAgICAgc2hpZnRYOiBcIlwiICsgeCArIFwicHhcIixcbiAgICAgICAgc2hpZnRZOiBcIlwiICsgeSArIFwicHhcIixcbiAgICAgICAgYW5nbGU6IHRoaXMuYW5nbGVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuZWwuZHJhdygpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5fZ2V0Q3VycmVudEFuZ2xlID0gZnVuY3Rpb24ocG9pbnQsIGxlbiwgcCkge1xuICAgICAgdmFyIGF0YW4sIGlzVHJhbnNmb3JtRnVuT3JpZ2luLCBwcmV2UG9pbnQsIHgxLCB4MjtcbiAgICAgIGlzVHJhbnNmb3JtRnVuT3JpZ2luID0gdHlwZW9mIHRoaXMucHJvcHMudHJhbnNmb3JtT3JpZ2luID09PSAnZnVuY3Rpb24nO1xuICAgICAgaWYgKHRoaXMucHJvcHMuaXNBbmdsZSB8fCAodGhpcy5wcm9wcy5hbmdsZU9mZnNldCAhPSBudWxsKSB8fCBpc1RyYW5zZm9ybUZ1bk9yaWdpbikge1xuICAgICAgICBwcmV2UG9pbnQgPSB0aGlzLnBhdGguZ2V0UG9pbnRBdExlbmd0aChsZW4gLSAxKTtcbiAgICAgICAgeDEgPSBwb2ludC55IC0gcHJldlBvaW50Lnk7XG4gICAgICAgIHgyID0gcG9pbnQueCAtIHByZXZQb2ludC54O1xuICAgICAgICBhdGFuID0gTWF0aC5hdGFuKHgxIC8geDIpO1xuICAgICAgICAhaXNGaW5pdGUoYXRhbikgJiYgKGF0YW4gPSAwKTtcbiAgICAgICAgdGhpcy5hbmdsZSA9IGF0YW4gKiBoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmICgodHlwZW9mIHRoaXMucHJvcHMuYW5nbGVPZmZzZXQpICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYW5nbGUgKz0gdGhpcy5wcm9wcy5hbmdsZU9mZnNldCB8fCAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmFuZ2xlID0gdGhpcy5wcm9wcy5hbmdsZU9mZnNldC5jYWxsKHRoaXMsIHRoaXMuYW5nbGUsIHApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmdsZSA9IDA7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLl9zZXRUcmFuc2Zvcm0gPSBmdW5jdGlvbih4LCB5LCBwLCBpc0luaXQpIHtcbiAgICAgIHZhciB0cmFuc2Zvcm07XG4gICAgICBpZiAodGhpcy5zY2FsZXIpIHtcbiAgICAgICAgeCAqPSB0aGlzLnNjYWxlci54O1xuICAgICAgICB5ICo9IHRoaXMuc2NhbGVyLnk7XG4gICAgICB9XG4gICAgICB0cmFuc2Zvcm0gPSBudWxsO1xuICAgICAgaWYgKCFpc0luaXQpIHtcbiAgICAgICAgdHJhbnNmb3JtID0gdHlwZW9mIHRoaXMub25VcGRhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHRoaXMub25VcGRhdGUocCwge1xuICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgeTogeSxcbiAgICAgICAgICBhbmdsZTogdGhpcy5hbmdsZVxuICAgICAgICB9KSA6IHZvaWQgMDtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzTW9kdWxlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldE1vZHVsZVBvc2l0aW9uKHgsIHkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0cmFuc2Zvcm0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2V0RWxQb3NpdGlvbih4LCB5LCBwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gaC5zZXRQcmVmaXhlZFN0eWxlKHRoaXMuZWwsICd0cmFuc2Zvcm0nLCB0cmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLl9zZXRUcmFuc2Zvcm1PcmlnaW4gPSBmdW5jdGlvbihwKSB7XG4gICAgICB2YXIgaXNUcmFuc2Zvcm1GdW5PcmlnaW4sIHRPcmlnaW47XG4gICAgICBpZiAodGhpcy5wcm9wcy50cmFuc2Zvcm1PcmlnaW4pIHtcbiAgICAgICAgaXNUcmFuc2Zvcm1GdW5PcmlnaW4gPSB0eXBlb2YgdGhpcy5wcm9wcy50cmFuc2Zvcm1PcmlnaW4gPT09ICdmdW5jdGlvbic7XG4gICAgICAgIHRPcmlnaW4gPSAhaXNUcmFuc2Zvcm1GdW5PcmlnaW4gPyB0aGlzLnByb3BzLnRyYW5zZm9ybU9yaWdpbiA6IHRoaXMucHJvcHMudHJhbnNmb3JtT3JpZ2luKHRoaXMuYW5nbGUsIHApO1xuICAgICAgICByZXR1cm4gaC5zZXRQcmVmaXhlZFN0eWxlKHRoaXMuZWwsICd0cmFuc2Zvcm0tb3JpZ2luJywgdE9yaWdpbik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLm1ha2VNb3Rpb25CbHVyID0gZnVuY3Rpb24oeCwgeSkge1xuICAgICAgdmFyIGFic29sdXRlQW5nbGUsIGNvb3JkcywgZFgsIGRZLCBzaWduWCwgc2lnblksIHRhaWxBbmdsZTtcbiAgICAgIHRhaWxBbmdsZSA9IDA7XG4gICAgICBzaWduWCA9IDE7XG4gICAgICBzaWduWSA9IDE7XG4gICAgICBpZiAoKHRoaXMucHJldkNvb3Jkcy54ID09IG51bGwpIHx8ICh0aGlzLnByZXZDb29yZHMueSA9PSBudWxsKSkge1xuICAgICAgICB0aGlzLnNwZWVkWCA9IDA7XG4gICAgICAgIHRoaXMuc3BlZWRZID0gMDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRYID0geCAtIHRoaXMucHJldkNvb3Jkcy54O1xuICAgICAgICBkWSA9IHkgLSB0aGlzLnByZXZDb29yZHMueTtcbiAgICAgICAgaWYgKGRYID4gMCkge1xuICAgICAgICAgIHNpZ25YID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNpZ25YIDwgMCkge1xuICAgICAgICAgIHNpZ25ZID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zcGVlZFggPSBNYXRoLmFicyhkWCk7XG4gICAgICAgIHRoaXMuc3BlZWRZID0gTWF0aC5hYnMoZFkpO1xuICAgICAgICB0YWlsQW5nbGUgPSBNYXRoLmF0YW4oZFkgLyBkWCkgKiAoMTgwIC8gTWF0aC5QSSkgKyA5MDtcbiAgICAgIH1cbiAgICAgIGFic29sdXRlQW5nbGUgPSB0YWlsQW5nbGUgLSB0aGlzLmFuZ2xlO1xuICAgICAgY29vcmRzID0gdGhpcy5hbmdUb0Nvb3JkcyhhYnNvbHV0ZUFuZ2xlKTtcbiAgICAgIHRoaXMuYmx1clggPSBoLmNsYW1wKCh0aGlzLnNwZWVkWCAvIDE2KSAqIHRoaXMucHJvcHMubW90aW9uQmx1ciwgMCwgMSk7XG4gICAgICB0aGlzLmJsdXJZID0gaC5jbGFtcCgodGhpcy5zcGVlZFkgLyAxNikgKiB0aGlzLnByb3BzLm1vdGlvbkJsdXIsIDAsIDEpO1xuICAgICAgdGhpcy5zZXRCbHVyKHtcbiAgICAgICAgYmx1cjoge1xuICAgICAgICAgIHg6IDMgKiB0aGlzLmJsdXJYICogdGhpcy5ibHVyQW1vdW50ICogTWF0aC5hYnMoY29vcmRzLngpLFxuICAgICAgICAgIHk6IDMgKiB0aGlzLmJsdXJZICogdGhpcy5ibHVyQW1vdW50ICogTWF0aC5hYnMoY29vcmRzLnkpXG4gICAgICAgIH0sXG4gICAgICAgIG9mZnNldDoge1xuICAgICAgICAgIHg6IDMgKiBzaWduWCAqIHRoaXMuYmx1clggKiBjb29yZHMueCAqIHRoaXMuYmx1ckFtb3VudCxcbiAgICAgICAgICB5OiAzICogc2lnblkgKiB0aGlzLmJsdXJZICogY29vcmRzLnkgKiB0aGlzLmJsdXJBbW91bnRcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLnByZXZDb29yZHMueCA9IHg7XG4gICAgICByZXR1cm4gdGhpcy5wcmV2Q29vcmRzLnkgPSB5O1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5zZXRCbHVyID0gZnVuY3Rpb24obykge1xuICAgICAgaWYgKCF0aGlzLmlzTW90aW9uQmx1clJlc2V0KSB7XG4gICAgICAgIHRoaXMuZmlsdGVyLnNldEF0dHJpYnV0ZSgnc3RkRGV2aWF0aW9uJywgXCJcIiArIG8uYmx1ci54ICsgXCIsXCIgKyBvLmJsdXIueSk7XG4gICAgICAgIHRoaXMuZmlsdGVyT2Zmc2V0LnNldEF0dHJpYnV0ZSgnZHgnLCBvLm9mZnNldC54KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyT2Zmc2V0LnNldEF0dHJpYnV0ZSgnZHknLCBvLm9mZnNldC55KTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZSwgX3Jlc3VsdHM7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChrZXkgaW4gbykge1xuICAgICAgICB2YWx1ZSA9IG9ba2V5XTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzW2tleV0gPSB2YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmV4dGVuZE9wdGlvbnMgPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZSwgX3Jlc3VsdHM7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChrZXkgaW4gbykge1xuICAgICAgICB2YWx1ZSA9IG9ba2V5XTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnByb3BzW2tleV0gPSB2YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnRoZW4gPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIgaXQsIGtleSwgb3B0cywgcHJldk9wdGlvbnMsIHZhbHVlO1xuICAgICAgcHJldk9wdGlvbnMgPSB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5Lmxlbmd0aCAtIDFdO1xuICAgICAgb3B0cyA9IHt9O1xuICAgICAgZm9yIChrZXkgaW4gcHJldk9wdGlvbnMpIHtcbiAgICAgICAgdmFsdWUgPSBwcmV2T3B0aW9uc1trZXldO1xuICAgICAgICBpZiAoIWguY2FsbGJhY2tzTWFwW2tleV0gJiYgIWgudHdlZW5PcHRpb25NYXBba2V5XSB8fCBrZXkgPT09ICdkdXJhdGlvbicpIHtcbiAgICAgICAgICBpZiAob1trZXldID09IG51bGwpIHtcbiAgICAgICAgICAgIG9ba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAob1trZXldID09IG51bGwpIHtcbiAgICAgICAgICAgIG9ba2V5XSA9IHZvaWQgMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGgudHdlZW5PcHRpb25NYXBba2V5XSkge1xuICAgICAgICAgIG9wdHNba2V5XSA9IGtleSAhPT0gJ2R1cmF0aW9uJyA/IG9ba2V5XSA6IG9ba2V5XSAhPSBudWxsID8gb1trZXldIDogcHJldk9wdGlvbnNba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5oaXN0b3J5LnB1c2gobyk7XG4gICAgICBpdCA9IHRoaXM7XG4gICAgICBvcHRzLm9uVXBkYXRlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihwKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnNldFByb2dyZXNzKHApO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICBvcHRzLm9uU3RhcnQgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgIHJldHVybiAoX3JlZiA9IF90aGlzLnByb3BzLm9uU3RhcnQpICE9IG51bGwgPyBfcmVmLmFwcGx5KF90aGlzKSA6IHZvaWQgMDtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgb3B0cy5vbkNvbXBsZXRlID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vbkNvbXBsZXRlKSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIG9wdHMub25GaXJzdFVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaXQudHVuZU9wdGlvbnMoaXQuaGlzdG9yeVt0aGlzLmluZGV4XSk7XG4gICAgICB9O1xuICAgICAgb3B0cy5pc0NoYWluZWQgPSAhby5kZWxheTtcbiAgICAgIHRoaXMudGltZWxpbmUuYXBwZW5kKG5ldyBUd2VlbihvcHRzKSk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUudHVuZU9wdGlvbnMgPSBmdW5jdGlvbihvKSB7XG4gICAgICB0aGlzLmV4dGVuZE9wdGlvbnMobyk7XG4gICAgICByZXR1cm4gdGhpcy5wb3N0VmFycygpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5hbmdUb0Nvb3JkcyA9IGZ1bmN0aW9uKGFuZ2xlKSB7XG4gICAgICB2YXIgcmFkQW5nbGUsIHgsIHk7XG4gICAgICBhbmdsZSA9IGFuZ2xlICUgMzYwO1xuICAgICAgcmFkQW5nbGUgPSAoKGFuZ2xlIC0gOTApICogTWF0aC5QSSkgLyAxODA7XG4gICAgICB4ID0gTWF0aC5jb3MocmFkQW5nbGUpO1xuICAgICAgeSA9IE1hdGguc2luKHJhZEFuZ2xlKTtcbiAgICAgIHggPSB4IDwgMCA/IE1hdGgubWF4KHgsIC0wLjcpIDogTWF0aC5taW4oeCwgLjcpO1xuICAgICAgeSA9IHkgPCAwID8gTWF0aC5tYXgoeSwgLTAuNykgOiBNYXRoLm1pbih5LCAuNyk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiB4ICogMS40Mjg1NzE0MjksXG4gICAgICAgIHk6IHkgKiAxLjQyODU3MTQyOVxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIE1vdGlvblBhdGg7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IE1vdGlvblBhdGg7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgKGZ1bmN0aW9uKHJvb3QpIHtcbiAgICB2YXIgb2Zmc2V0LCBfcmVmLCBfcmVmMTtcbiAgICBpZiAocm9vdC5wZXJmb3JtYW5jZSA9PSBudWxsKSB7XG4gICAgICByb290LnBlcmZvcm1hbmNlID0ge307XG4gICAgfVxuICAgIERhdGUubm93ID0gRGF0ZS5ub3cgfHwgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gKG5ldyBEYXRlKS5nZXRUaW1lKCk7XG4gICAgfTtcbiAgICBpZiAocm9vdC5wZXJmb3JtYW5jZS5ub3cgPT0gbnVsbCkge1xuICAgICAgb2Zmc2V0ID0gKChfcmVmID0gcm9vdC5wZXJmb3JtYW5jZSkgIT0gbnVsbCA/IChfcmVmMSA9IF9yZWYudGltaW5nKSAhPSBudWxsID8gX3JlZjEubmF2aWdhdGlvblN0YXJ0IDogdm9pZCAwIDogdm9pZCAwKSA/IHBlcmZvcm1hbmNlLnRpbWluZy5uYXZpZ2F0aW9uU3RhcnQgOiBEYXRlLm5vdygpO1xuICAgICAgcmV0dXJuIHJvb3QucGVyZm9ybWFuY2Uubm93ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gb2Zmc2V0O1xuICAgICAgfTtcbiAgICB9XG4gIH0pKHdpbmRvdyk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICB2YXIgY2FuY2VsLCBpLCBpc09sZEJyb3dzZXIsIGxhc3RUaW1lLCB2ZW5kb3JzLCB2cCwgdztcbiAgICB2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J107XG4gICAgaSA9IDA7XG4gICAgdyA9IHdpbmRvdztcbiAgICB3aGlsZSAoaSA8IHZlbmRvcnMubGVuZ3RoICYmICF3LnJlcXVlc3RBbmltYXRpb25GcmFtZSkge1xuICAgICAgdnAgPSB2ZW5kb3JzW2ldO1xuICAgICAgdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3W3ZwICsgJ1JlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgICAgY2FuY2VsID0gd1t2cCArICdDYW5jZWxBbmltYXRpb25GcmFtZSddO1xuICAgICAgdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNhbmNlbCB8fCB3W3ZwICsgJ0NhbmNlbFJlcXVlc3RBbmltYXRpb25GcmFtZSddO1xuICAgICAgKytpO1xuICAgIH1cbiAgICBpc09sZEJyb3dzZXIgPSAhdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgIXcuY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG4gICAgaWYgKC9pUChhZHxob25lfG9kKS4qT1MgNi8udGVzdCh3Lm5hdmlnYXRvci51c2VyQWdlbnQpIHx8IGlzT2xkQnJvd3Nlcikge1xuICAgICAgbGFzdFRpbWUgPSAwO1xuICAgICAgdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmV4dFRpbWUsIG5vdztcbiAgICAgICAgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dCgoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FsbGJhY2sobGFzdFRpbWUgPSBuZXh0VGltZSk7XG4gICAgICAgIH0pLCBuZXh0VGltZSAtIG5vdyk7XG4gICAgICB9O1xuICAgICAgdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcbiAgICB9XG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIGg7XG5cbiAgaCA9IHJlcXVpcmUoJy4uL2gnKTtcblxuICBCaXQgPSAoZnVuY3Rpb24oKSB7XG4gICAgQml0LnByb3RvdHlwZS5ucyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG5cbiAgICBCaXQucHJvdG90eXBlLnR5cGUgPSAnbGluZSc7XG5cbiAgICBCaXQucHJvdG90eXBlLnJhdGlvID0gMTtcblxuICAgIEJpdC5wcm90b3R5cGUuZGVmYXVsdHMgPSB7XG4gICAgICByYWRpdXM6IDUwLFxuICAgICAgcmFkaXVzWDogdm9pZCAwLFxuICAgICAgcmFkaXVzWTogdm9pZCAwLFxuICAgICAgcG9pbnRzOiAzLFxuICAgICAgeDogMCxcbiAgICAgIHk6IDAsXG4gICAgICBhbmdsZTogMCxcbiAgICAgICdzdHJva2UnOiAnaG90cGluaycsXG4gICAgICAnc3Ryb2tlLXdpZHRoJzogMixcbiAgICAgICdzdHJva2Utb3BhY2l0eSc6IDEsXG4gICAgICAnZmlsbCc6ICd0cmFuc3BhcmVudCcsXG4gICAgICAnZmlsbC1vcGFjaXR5JzogMSxcbiAgICAgICdzdHJva2UtZGFzaGFycmF5JzogJycsXG4gICAgICAnc3Ryb2tlLWRhc2hvZmZzZXQnOiAnJyxcbiAgICAgICdzdHJva2UtbGluZWNhcCc6ICcnXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIEJpdChvKSB7XG4gICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICB0aGlzLmluaXQoKTtcbiAgICAgIHRoaXM7XG4gICAgfVxuXG4gICAgQml0LnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5vLmN0eCAmJiB0aGlzLm8uY3R4LnRhZ05hbWUgPT09ICdzdmcnKSB7XG4gICAgICAgIHRoaXMuY3R4ID0gdGhpcy5vLmN0eDtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuby5lbCkge1xuICAgICAgICBoLmVycm9yKCdZb3Ugc2hvdWxkIHBhc3MgYSByZWFsIGNvbnRleHQoY3R4KSB0byB0aGUgYml0Jyk7XG4gICAgICB9XG4gICAgICB0aGlzLnN0YXRlID0ge307XG4gICAgICB0aGlzLmRyYXdNYXBMZW5ndGggPSB0aGlzLmRyYXdNYXAubGVuZ3RoO1xuICAgICAgdGhpcy5leHRlbmREZWZhdWx0cygpO1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY1RyYW5zZm9ybSgpO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmNhbGNUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByb3RhdGU7XG4gICAgICByb3RhdGUgPSBcInJvdGF0ZShcIiArIHRoaXMucHJvcHMuYW5nbGUgKyBcIiwgXCIgKyB0aGlzLnByb3BzLnggKyBcIiwgXCIgKyB0aGlzLnByb3BzLnkgKyBcIilcIjtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnRyYW5zZm9ybSA9IFwiXCIgKyByb3RhdGU7XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUuZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBrZXksIHZhbHVlLCBfcmVmLCBfcmVzdWx0cztcbiAgICAgIGlmICh0aGlzLnByb3BzID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5wcm9wcyA9IHt9O1xuICAgICAgfVxuICAgICAgX3JlZiA9IHRoaXMuZGVmYXVsdHM7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChrZXkgaW4gX3JlZikge1xuICAgICAgICB2YWx1ZSA9IF9yZWZba2V5XTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnByb3BzW2tleV0gPSB0aGlzLm9ba2V5XSAhPSBudWxsID8gdGhpcy5vW2tleV0gOiB2YWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUuc2V0QXR0ciA9IGZ1bmN0aW9uKGF0dHIsIHZhbHVlKSB7XG4gICAgICB2YXIgZWwsIGtleSwga2V5cywgbGVuLCB2YWwsIF9yZXN1bHRzO1xuICAgICAgaWYgKHR5cGVvZiBhdHRyID09PSAnb2JqZWN0Jykge1xuICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoYXR0cik7XG4gICAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgICBlbCA9IHZhbHVlIHx8IHRoaXMuZWw7XG4gICAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICAgIGtleSA9IGtleXNbbGVuXTtcbiAgICAgICAgICB2YWwgPSBhdHRyW2tleV07XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaChlbC5zZXRBdHRyaWJ1dGUoa2V5LCB2YWwpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5lbC5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsdWUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLnNldFByb3AgPSBmdW5jdGlvbihhdHRyLCB2YWx1ZSkge1xuICAgICAgdmFyIGtleSwgdmFsLCBfcmVzdWx0cztcbiAgICAgIGlmICh0eXBlb2YgYXR0ciA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yIChrZXkgaW4gYXR0cikge1xuICAgICAgICAgIHZhbCA9IGF0dHJba2V5XTtcbiAgICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMucHJvcHNba2V5XSA9IHZhbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcHNbYXR0cl0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaXNSZW5kZXJlZCA9IHRydWU7XG4gICAgICBpZiAodGhpcy5vLmVsICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5lbCA9IHRoaXMuby5lbDtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGb3JlaWduID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlModGhpcy5ucywgdGhpcy50eXBlIHx8ICdsaW5lJyk7XG4gICAgICAgICF0aGlzLm8uaXNEcmF3TGVzcyAmJiB0aGlzLmRyYXcoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3R4LmFwcGVuZENoaWxkKHRoaXMuZWwpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmRyYXdNYXAgPSBbJ3N0cm9rZScsICdzdHJva2Utd2lkdGgnLCAnc3Ryb2tlLW9wYWNpdHknLCAnc3Ryb2tlLWRhc2hhcnJheScsICdmaWxsJywgJ3N0cm9rZS1kYXNob2Zmc2V0JywgJ3N0cm9rZS1saW5lY2FwJywgJ2ZpbGwtb3BhY2l0eScsICd0cmFuc2Zvcm0nXTtcblxuICAgIEJpdC5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxlbiwgbmFtZTtcbiAgICAgIHRoaXMucHJvcHMubGVuZ3RoID0gdGhpcy5nZXRMZW5ndGgoKTtcbiAgICAgIGxlbiA9IHRoaXMuZHJhd01hcExlbmd0aDtcbiAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICBuYW1lID0gdGhpcy5kcmF3TWFwW2xlbl07XG4gICAgICAgIHN3aXRjaCAobmFtZSkge1xuICAgICAgICAgIGNhc2UgJ3N0cm9rZS1kYXNoYXJyYXknOlxuICAgICAgICAgIGNhc2UgJ3N0cm9rZS1kYXNob2Zmc2V0JzpcbiAgICAgICAgICAgIHRoaXMuY2FzdFN0cm9rZURhc2gobmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXRBdHRyc0lmQ2hhbmdlZChuYW1lLCB0aGlzLnByb3BzW25hbWVdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXRlLnJhZGl1cyA9IHRoaXMucHJvcHMucmFkaXVzO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmNhc3RTdHJva2VEYXNoID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGNhc3QsIGRhc2gsIGksIHN0cm9rZSwgX2ksIF9sZW4sIF9yZWY7XG4gICAgICBpZiAoaC5pc0FycmF5KHRoaXMucHJvcHNbbmFtZV0pKSB7XG4gICAgICAgIHN0cm9rZSA9ICcnO1xuICAgICAgICBfcmVmID0gdGhpcy5wcm9wc1tuYW1lXTtcbiAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gX3JlZi5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICBkYXNoID0gX3JlZltpXTtcbiAgICAgICAgICBjYXN0ID0gZGFzaC51bml0ID09PSAnJScgPyB0aGlzLmNhc3RQZXJjZW50KGRhc2gudmFsdWUpIDogZGFzaC52YWx1ZTtcbiAgICAgICAgICBzdHJva2UgKz0gXCJcIiArIGNhc3QgKyBcIiBcIjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByb3BzW25hbWVdID0gc3Ryb2tlID09PSAnMCAnID8gc3Ryb2tlID0gJycgOiBzdHJva2U7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzW25hbWVdID0gc3Ryb2tlO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB0aGlzLnByb3BzW25hbWVdID09PSAnb2JqZWN0Jykge1xuICAgICAgICBzdHJva2UgPSB0aGlzLnByb3BzW25hbWVdLnVuaXQgPT09ICclJyA/IHRoaXMuY2FzdFBlcmNlbnQodGhpcy5wcm9wc1tuYW1lXS52YWx1ZSkgOiB0aGlzLnByb3BzW25hbWVdLnZhbHVlO1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1tuYW1lXSA9IHN0cm9rZSA9PT0gMCA/IHN0cm9rZSA9ICcnIDogc3Ryb2tlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmNhc3RQZXJjZW50ID0gZnVuY3Rpb24ocGVyY2VudCkge1xuICAgICAgcmV0dXJuIHBlcmNlbnQgKiAodGhpcy5wcm9wcy5sZW5ndGggLyAxMDApO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLnNldEF0dHJzSWZDaGFuZ2VkID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciBrZXksIGtleXMsIGxlbiwgX3Jlc3VsdHM7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhuYW1lKTtcbiAgICAgICAgbGVuID0ga2V5cy5sZW5ndGg7XG4gICAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICAgIGtleSA9IGtleXNbbGVuXTtcbiAgICAgICAgICB2YWx1ZSA9IG5hbWVba2V5XTtcbiAgICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMuc2V0QXR0cklmQ2hhbmdlZChrZXksIHZhbHVlKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgICB2YWx1ZSA9IHRoaXMucHJvcHNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0QXR0cklmQ2hhbmdlZChuYW1lLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUuc2V0QXR0cklmQ2hhbmdlZCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICBpZiAodGhpcy5pc0NoYW5nZWQobmFtZSwgdmFsdWUpKSB7XG4gICAgICAgIHRoaXMuZWwuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGVbbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5pc0NoYW5nZWQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgdmFsdWUgPSB0aGlzLnByb3BzW25hbWVdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RhdGVbbmFtZV0gIT09IHZhbHVlO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmdldExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIF9yZWY7XG4gICAgICBpZiAoKCgoX3JlZiA9IHRoaXMuZWwpICE9IG51bGwgPyBfcmVmLmdldFRvdGFsTGVuZ3RoIDogdm9pZCAwKSAhPSBudWxsKSAmJiB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnZCcpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVsLmdldFRvdGFsTGVuZ3RoKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gMiAqICh0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIEJpdDtcblxuICB9KSgpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gQml0O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgQml0LCBCaXRzTWFwLCBDaXJjbGUsIENyb3NzLCBFcXVhbCwgTGluZSwgUG9seWdvbiwgUmVjdCwgWmlnemFnLCBoO1xuXG4gIEJpdCA9IHJlcXVpcmUoJy4vYml0Jyk7XG5cbiAgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcblxuICBMaW5lID0gcmVxdWlyZSgnLi9saW5lJyk7XG5cbiAgWmlnemFnID0gcmVxdWlyZSgnLi96aWd6YWcnKTtcblxuICBSZWN0ID0gcmVxdWlyZSgnLi9yZWN0Jyk7XG5cbiAgUG9seWdvbiA9IHJlcXVpcmUoJy4vcG9seWdvbicpO1xuXG4gIENyb3NzID0gcmVxdWlyZSgnLi9jcm9zcycpO1xuXG4gIEVxdWFsID0gcmVxdWlyZSgnLi9lcXVhbCcpO1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgQml0c01hcCA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBCaXRzTWFwKCkge31cblxuICAgIEJpdHNNYXAucHJvdG90eXBlLmggPSBoO1xuXG4gICAgQml0c01hcC5wcm90b3R5cGUubWFwID0ge1xuICAgICAgYml0OiBCaXQsXG4gICAgICBjaXJjbGU6IENpcmNsZSxcbiAgICAgIGxpbmU6IExpbmUsXG4gICAgICB6aWd6YWc6IFppZ3phZyxcbiAgICAgIHJlY3Q6IFJlY3QsXG4gICAgICBwb2x5Z29uOiBQb2x5Z29uLFxuICAgICAgY3Jvc3M6IENyb3NzLFxuICAgICAgZXF1YWw6IEVxdWFsXG4gICAgfTtcblxuICAgIEJpdHNNYXAucHJvdG90eXBlLmdldEJpdCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiB0aGlzLm1hcFtuYW1lXSB8fCB0aGlzLmguZXJyb3IoXCJubyBcXFwiXCIgKyBuYW1lICsgXCJcXFwiIHNoYXBlIGF2YWlsYWJsZSB5ZXQsIHBsZWFzZSBjaG9vc2UgZnJvbSB0aGlzIGxpc3Q6XCIsIHRoaXMubWFwKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIEJpdHNNYXA7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IG5ldyBCaXRzTWFwO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIENpcmNsZSxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIENpcmNsZSA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoQ2lyY2xlLCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gQ2lyY2xlKCkge1xuICAgICAgcmV0dXJuIENpcmNsZS5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBDaXJjbGUucHJvdG90eXBlLnR5cGUgPSAnZWxsaXBzZSc7XG5cbiAgICBDaXJjbGUucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByeCwgcnk7XG4gICAgICByeCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByeSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICB0aGlzLnNldEF0dHJzSWZDaGFuZ2VkKHtcbiAgICAgICAgcng6IHJ4LFxuICAgICAgICByeTogcnksXG4gICAgICAgIGN4OiB0aGlzLnByb3BzLngsXG4gICAgICAgIGN5OiB0aGlzLnByb3BzLnlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIENpcmNsZS5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBDaXJjbGUucHJvdG90eXBlLmdldExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJhZGl1c1gsIHJhZGl1c1k7XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmV0dXJuIDIgKiBNYXRoLlBJICogTWF0aC5zcXJ0KChNYXRoLnBvdyhyYWRpdXNYLCAyKSArIE1hdGgucG93KHJhZGl1c1ksIDIpKSAvIDIpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQ2lyY2xlO1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBDaXJjbGU7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgQ3Jvc3MsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBDcm9zcyA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoQ3Jvc3MsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBDcm9zcygpIHtcbiAgICAgIHJldHVybiBDcm9zcy5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBDcm9zcy5wcm90b3R5cGUudHlwZSA9ICdwYXRoJztcblxuICAgIENyb3NzLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZCwgbGluZTEsIGxpbmUyLCByYWRpdXNYLCByYWRpdXNZLCB4MSwgeDIsIHkxLCB5MjtcbiAgICAgIENyb3NzLl9fc3VwZXJfXy5kcmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgeDEgPSB0aGlzLnByb3BzLnggLSByYWRpdXNYO1xuICAgICAgeDIgPSB0aGlzLnByb3BzLnggKyByYWRpdXNYO1xuICAgICAgbGluZTEgPSBcIk1cIiArIHgxICsgXCIsXCIgKyB0aGlzLnByb3BzLnkgKyBcIiBMXCIgKyB4MiArIFwiLFwiICsgdGhpcy5wcm9wcy55O1xuICAgICAgeTEgPSB0aGlzLnByb3BzLnkgLSByYWRpdXNZO1xuICAgICAgeTIgPSB0aGlzLnByb3BzLnkgKyByYWRpdXNZO1xuICAgICAgbGluZTIgPSBcIk1cIiArIHRoaXMucHJvcHMueCArIFwiLFwiICsgeTEgKyBcIiBMXCIgKyB0aGlzLnByb3BzLnggKyBcIixcIiArIHkyO1xuICAgICAgZCA9IFwiXCIgKyBsaW5lMSArIFwiIFwiICsgbGluZTI7XG4gICAgICByZXR1cm4gdGhpcy5zZXRBdHRyKHtcbiAgICAgICAgZDogZFxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIENyb3NzLnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByYWRpdXNYLCByYWRpdXNZO1xuICAgICAgcmFkaXVzWCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByYWRpdXNZID0gdGhpcy5wcm9wcy5yYWRpdXNZICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1kgOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJldHVybiAyICogKHJhZGl1c1ggKyByYWRpdXNZKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENyb3NzO1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBDcm9zcztcblxufSkuY2FsbCh0aGlzKTtcbiIsIlxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQml0LCBFcXVhbCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIEVxdWFsID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhFcXVhbCwgX3N1cGVyKTtcblxuICAgIGZ1bmN0aW9uIEVxdWFsKCkge1xuICAgICAgcmV0dXJuIEVxdWFsLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIEVxdWFsLnByb3RvdHlwZS50eXBlID0gJ3BhdGgnO1xuXG4gICAgRXF1YWwucHJvdG90eXBlLnJhdGlvID0gMS40MztcblxuICAgIEVxdWFsLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZCwgaSwgcmFkaXVzWCwgcmFkaXVzWSwgeDEsIHgyLCB5LCB5U3RhcnQsIHlTdGVwLCBfaSwgX3JlZjtcbiAgICAgIEVxdWFsLl9fc3VwZXJfXy5kcmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICBpZiAoIXRoaXMucHJvcHMucG9pbnRzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJhZGl1c1ggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmFkaXVzWSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICB4MSA9IHRoaXMucHJvcHMueCAtIHJhZGl1c1g7XG4gICAgICB4MiA9IHRoaXMucHJvcHMueCArIHJhZGl1c1g7XG4gICAgICBkID0gJyc7XG4gICAgICB5U3RlcCA9IDIgKiByYWRpdXNZIC8gKHRoaXMucHJvcHMucG9pbnRzIC0gMSk7XG4gICAgICB5U3RhcnQgPSB0aGlzLnByb3BzLnkgLSByYWRpdXNZO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfcmVmID0gdGhpcy5wcm9wcy5wb2ludHM7IDAgPD0gX3JlZiA/IF9pIDwgX3JlZiA6IF9pID4gX3JlZjsgaSA9IDAgPD0gX3JlZiA/ICsrX2kgOiAtLV9pKSB7XG4gICAgICAgIHkgPSBcIlwiICsgKGkgKiB5U3RlcCArIHlTdGFydCk7XG4gICAgICAgIGQgKz0gXCJNXCIgKyB4MSArIFwiLCBcIiArIHkgKyBcIiBMXCIgKyB4MiArIFwiLCBcIiArIHkgKyBcIiBcIjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNldEF0dHIoe1xuICAgICAgICBkOiBkXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgRXF1YWwucHJvdG90eXBlLmdldExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIDIgKiAodGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBFcXVhbDtcblxuICB9KShCaXQpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gRXF1YWw7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgTGluZSxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIExpbmUgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKExpbmUsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBMaW5lKCkge1xuICAgICAgcmV0dXJuIExpbmUuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgTGluZS5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJhZGl1c1g7XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHRoaXMuc2V0QXR0cnNJZkNoYW5nZWQoe1xuICAgICAgICB4MTogdGhpcy5wcm9wcy54IC0gcmFkaXVzWCxcbiAgICAgICAgeDI6IHRoaXMucHJvcHMueCArIHJhZGl1c1gsXG4gICAgICAgIHkxOiB0aGlzLnByb3BzLnksXG4gICAgICAgIHkyOiB0aGlzLnByb3BzLnlcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIExpbmUuX19zdXBlcl9fLmRyYXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIExpbmU7XG5cbiAgfSkoQml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IExpbmU7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgUG9seWdvbiwgaCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgUG9seWdvbiA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoUG9seWdvbiwgX3N1cGVyKTtcblxuICAgIGZ1bmN0aW9uIFBvbHlnb24oKSB7XG4gICAgICByZXR1cm4gUG9seWdvbi5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBQb2x5Z29uLnByb3RvdHlwZS50eXBlID0gJ3BhdGgnO1xuXG4gICAgUG9seWdvbi5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5kcmF3U2hhcGUoKTtcbiAgICAgIHJldHVybiBQb2x5Z29uLl9fc3VwZXJfXy5kcmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIFBvbHlnb24ucHJvdG90eXBlLmRyYXdTaGFwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNoYXIsIGQsIGksIHBvaW50LCBzdGVwLCBfaSwgX2osIF9sZW4sIF9yZWYsIF9yZWYxO1xuICAgICAgc3RlcCA9IDM2MCAvIHRoaXMucHJvcHMucG9pbnRzO1xuICAgICAgdGhpcy5yYWRpYWxQb2ludHMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX3JlZiA9IHRoaXMucHJvcHMucG9pbnRzOyAwIDw9IF9yZWYgPyBfaSA8IF9yZWYgOiBfaSA+IF9yZWY7IGkgPSAwIDw9IF9yZWYgPyArK19pIDogLS1faSkge1xuICAgICAgICB0aGlzLnJhZGlhbFBvaW50cy5wdXNoKGguZ2V0UmFkaWFsUG9pbnQoe1xuICAgICAgICAgIHJhZGl1czogdGhpcy5wcm9wcy5yYWRpdXMsXG4gICAgICAgICAgcmFkaXVzWDogdGhpcy5wcm9wcy5yYWRpdXNYLFxuICAgICAgICAgIHJhZGl1c1k6IHRoaXMucHJvcHMucmFkaXVzWSxcbiAgICAgICAgICBhbmdsZTogaSAqIHN0ZXAsXG4gICAgICAgICAgY2VudGVyOiB7XG4gICAgICAgICAgICB4OiB0aGlzLnByb3BzLngsXG4gICAgICAgICAgICB5OiB0aGlzLnByb3BzLnlcbiAgICAgICAgICB9XG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIGQgPSAnJztcbiAgICAgIF9yZWYxID0gdGhpcy5yYWRpYWxQb2ludHM7XG4gICAgICBmb3IgKGkgPSBfaiA9IDAsIF9sZW4gPSBfcmVmMS5sZW5ndGg7IF9qIDwgX2xlbjsgaSA9ICsrX2opIHtcbiAgICAgICAgcG9pbnQgPSBfcmVmMVtpXTtcbiAgICAgICAgY2hhciA9IGkgPT09IDAgPyAnTScgOiAnTCc7XG4gICAgICAgIGQgKz0gXCJcIiArIGNoYXIgKyAocG9pbnQueC50b0ZpeGVkKDQpKSArIFwiLFwiICsgKHBvaW50LnkudG9GaXhlZCg0KSkgKyBcIiBcIjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnNldEF0dHIoe1xuICAgICAgICBkOiBkICs9ICd6J1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFBvbHlnb24ucHJvdG90eXBlLmdldExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZWwuZ2V0VG90YWxMZW5ndGgoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFBvbHlnb247XG5cbiAgfSkoQml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFBvbHlnb247XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgUmVjdCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIFJlY3QgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKFJlY3QsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBSZWN0KCkge1xuICAgICAgcmV0dXJuIFJlY3QuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgUmVjdC5wcm90b3R5cGUudHlwZSA9ICdyZWN0JztcblxuICAgIFJlY3QucHJvdG90eXBlLnJhdGlvID0gMS40MztcblxuICAgIFJlY3QucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByYWRpdXNYLCByYWRpdXNZO1xuICAgICAgUmVjdC5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmFkaXVzWCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByYWRpdXNZID0gdGhpcy5wcm9wcy5yYWRpdXNZICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1kgOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJldHVybiB0aGlzLnNldEF0dHJzSWZDaGFuZ2VkKHtcbiAgICAgICAgd2lkdGg6IDIgKiByYWRpdXNYLFxuICAgICAgICBoZWlnaHQ6IDIgKiByYWRpdXNZLFxuICAgICAgICB4OiB0aGlzLnByb3BzLnggLSByYWRpdXNYLFxuICAgICAgICB5OiB0aGlzLnByb3BzLnkgLSByYWRpdXNZXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgUmVjdC5wcm90b3R5cGUuZ2V0TGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmFkaXVzWCwgcmFkaXVzWTtcbiAgICAgIHJhZGl1c1ggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmFkaXVzWSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByZXR1cm4gMiAqIHJhZGl1c1ggKyAyICogcmFkaXVzWTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFJlY3Q7XG5cbiAgfSkoQml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFJlY3Q7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgWmlnemFnLFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIF9fZXh0ZW5kcyA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoX19oYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9O1xuXG4gIEJpdCA9IHJlcXVpcmUoJy4vYml0Jyk7XG5cbiAgWmlnemFnID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhaaWd6YWcsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBaaWd6YWcoKSB7XG4gICAgICByZXR1cm4gWmlnemFnLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIFppZ3phZy5wcm90b3R5cGUudHlwZSA9ICdwYXRoJztcblxuICAgIFppZ3phZy5wcm90b3R5cGUucmF0aW8gPSAxLjQzO1xuXG4gICAgWmlnemFnLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY2hhciwgaSwgaVgsIGlYMiwgaVksIGlZMiwgcG9pbnRzLCByYWRpdXNYLCByYWRpdXNZLCBzdGVwWCwgc3RlcFksIHN0cm9rZVdpZHRoLCB4U3RhcnQsIHlTdGFydCwgX2ksIF9yZWY7XG4gICAgICBpZiAoIXRoaXMucHJvcHMucG9pbnRzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJhZGl1c1ggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmFkaXVzWSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICBwb2ludHMgPSAnJztcbiAgICAgIHN0ZXBYID0gMiAqIHJhZGl1c1ggLyB0aGlzLnByb3BzLnBvaW50cztcbiAgICAgIHN0ZXBZID0gMiAqIHJhZGl1c1kgLyB0aGlzLnByb3BzLnBvaW50cztcbiAgICAgIHN0cm9rZVdpZHRoID0gdGhpcy5wcm9wc1snc3Ryb2tlLXdpZHRoJ107XG4gICAgICB4U3RhcnQgPSB0aGlzLnByb3BzLnggLSByYWRpdXNYO1xuICAgICAgeVN0YXJ0ID0gdGhpcy5wcm9wcy55IC0gcmFkaXVzWTtcbiAgICAgIGZvciAoaSA9IF9pID0gX3JlZiA9IHRoaXMucHJvcHMucG9pbnRzOyBfcmVmIDw9IDAgPyBfaSA8IDAgOiBfaSA+IDA7IGkgPSBfcmVmIDw9IDAgPyArK19pIDogLS1faSkge1xuICAgICAgICBpWCA9IHhTdGFydCArIGkgKiBzdGVwWCArIHN0cm9rZVdpZHRoO1xuICAgICAgICBpWSA9IHlTdGFydCArIGkgKiBzdGVwWSArIHN0cm9rZVdpZHRoO1xuICAgICAgICBpWDIgPSB4U3RhcnQgKyAoaSAtIDEpICogc3RlcFggKyBzdHJva2VXaWR0aDtcbiAgICAgICAgaVkyID0geVN0YXJ0ICsgKGkgLSAxKSAqIHN0ZXBZICsgc3Ryb2tlV2lkdGg7XG4gICAgICAgIGNoYXIgPSBpID09PSB0aGlzLnByb3BzLnBvaW50cyA/ICdNJyA6ICdMJztcbiAgICAgICAgcG9pbnRzICs9IFwiXCIgKyBjaGFyICsgaVggKyBcIixcIiArIGlZICsgXCIgbDAsIC1cIiArIHN0ZXBZICsgXCIgbC1cIiArIHN0ZXBYICsgXCIsIDBcIjtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2V0QXR0cih7XG4gICAgICAgIGQ6IHBvaW50c1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gWmlnemFnLl9fc3VwZXJfXy5kcmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBaaWd6YWc7XG5cbiAgfSkoQml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFppZ3phZztcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIFNwcml0ZXIsIFRpbWVsaW5lLCBUd2VlbiwgaDtcblxuICBoID0gcmVxdWlyZSgnLi9oJyk7XG5cbiAgVHdlZW4gPSByZXF1aXJlKCcuL3R3ZWVuL3R3ZWVuJyk7XG5cbiAgVGltZWxpbmUgPSByZXF1aXJlKCcuL3R3ZWVuL3RpbWVsaW5lJyk7XG5cbiAgU3ByaXRlciA9IChmdW5jdGlvbigpIHtcbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fZGVmYXVsdHMgPSB7XG4gICAgICBkdXJhdGlvbjogNTAwLFxuICAgICAgZGVsYXk6IDAsXG4gICAgICBlYXNpbmc6ICdsaW5lYXIubm9uZScsXG4gICAgICByZXBlYXQ6IDAsXG4gICAgICB5b3lvOiBmYWxzZSxcbiAgICAgIGlzUnVuTGVzczogZmFsc2UsXG4gICAgICBpc1Nob3dFbmQ6IGZhbHNlLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uVXBkYXRlOiBudWxsLFxuICAgICAgb25Db21wbGV0ZTogbnVsbFxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBTcHJpdGVyKG8pIHtcbiAgICAgIHRoaXMubyA9IG8gIT0gbnVsbCA/IG8gOiB7fTtcbiAgICAgIGlmICh0aGlzLm8uZWwgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gaC5lcnJvcignTm8gXCJlbFwiIG9wdGlvbiBzcGVjaWZpZWQsIGFib3J0aW5nJyk7XG4gICAgICB9XG4gICAgICB0aGlzLl92YXJzKCk7XG4gICAgICB0aGlzLl9leHRlbmREZWZhdWx0cygpO1xuICAgICAgdGhpcy5fcGFyc2VGcmFtZXMoKTtcbiAgICAgIGlmICh0aGlzLl9mcmFtZXMubGVuZ3RoIDw9IDIpIHtcbiAgICAgICAgaC53YXJuKFwiU3ByaXRlcjogb25seSBcIiArIHRoaXMuX2ZyYW1lcy5sZW5ndGggKyBcIiBmcmFtZXMgZm91bmRcIik7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5fZnJhbWVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgaC5lcnJvcihcIlNwcml0ZXI6IHRoZXJlIGlzIG5vIGZyYW1lcyB0byBhbmltYXRlLCBhYm9ydGluZ1wiKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX2NyZWF0ZVR3ZWVuKCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIFNwcml0ZXIucHJvdG90eXBlLl92YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9wcm9wcyA9IGguY2xvbmVPYmoodGhpcy5vKTtcbiAgICAgIHRoaXMuZWwgPSB0aGlzLm8uZWw7XG4gICAgICByZXR1cm4gdGhpcy5fZnJhbWVzID0gW107XG4gICAgfTtcblxuICAgIFNwcml0ZXIucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHJldHVybiB0aGlzLl90aW1lbGluZS5zdGFydCgpO1xuICAgIH07XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBoLmV4dGVuZCh0aGlzLl9wcm9wcywgdGhpcy5fZGVmYXVsdHMpO1xuICAgIH07XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fcGFyc2VGcmFtZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBmcmFtZSwgaSwgX2ksIF9sZW4sIF9yZWY7XG4gICAgICB0aGlzLl9mcmFtZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLmVsLmNoaWxkcmVuLCAwKTtcbiAgICAgIF9yZWYgPSB0aGlzLl9mcmFtZXM7XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICBmcmFtZSA9IF9yZWZbaV07XG4gICAgICAgIGZyYW1lLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2ZyYW1lU3RlcCA9IDEgLyB0aGlzLl9mcmFtZXMubGVuZ3RoO1xuICAgIH07XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fY3JlYXRlVHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX3R3ZWVuID0gbmV3IFR3ZWVuKHtcbiAgICAgICAgZHVyYXRpb246IHRoaXMuX3Byb3BzLmR1cmF0aW9uLFxuICAgICAgICBkZWxheTogdGhpcy5fcHJvcHMuZGVsYXksXG4gICAgICAgIHlveW86IHRoaXMuX3Byb3BzLnlveW8sXG4gICAgICAgIHJlcGVhdDogdGhpcy5fcHJvcHMucmVwZWF0LFxuICAgICAgICBlYXNpbmc6IHRoaXMuX3Byb3BzLmVhc2luZyxcbiAgICAgICAgb25TdGFydDogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9iYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiAoX2Jhc2UgPSBfdGhpcy5fcHJvcHMpLm9uU3RhcnQgPT09IFwiZnVuY3Rpb25cIiA/IF9iYXNlLm9uU3RhcnQoKSA6IHZvaWQgMDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSxcbiAgICAgICAgb25Db21wbGV0ZTogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9iYXNlO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiAoX2Jhc2UgPSBfdGhpcy5fcHJvcHMpLm9uQ29tcGxldGUgPT09IFwiZnVuY3Rpb25cIiA/IF9iYXNlLm9uQ29tcGxldGUoKSA6IHZvaWQgMDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSxcbiAgICAgICAgb25VcGRhdGU6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihwKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuX3NldFByb2dyZXNzKHApO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpXG4gICAgICB9KTtcbiAgICAgIHRoaXMuX3RpbWVsaW5lID0gbmV3IFRpbWVsaW5lO1xuICAgICAgdGhpcy5fdGltZWxpbmUuYWRkKHRoaXMuX3R3ZWVuKTtcbiAgICAgIHJldHVybiAhdGhpcy5fcHJvcHMuaXNSdW5MZXNzICYmIHRoaXMuX3N0YXJ0VHdlZW4oKTtcbiAgICB9O1xuXG4gICAgU3ByaXRlci5wcm90b3R5cGUuX3N0YXJ0VHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzZXRUaW1lb3V0KCgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5fdGltZWxpbmUuc3RhcnQoKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKSwgMSk7XG4gICAgfTtcblxuICAgIFNwcml0ZXIucHJvdG90eXBlLl9zZXRQcm9ncmVzcyA9IGZ1bmN0aW9uKHApIHtcbiAgICAgIHZhciBjdXJyZW50TnVtLCBwcm9jLCBfYmFzZSwgX3JlZiwgX3JlZjE7XG4gICAgICBwcm9jID0gTWF0aC5mbG9vcihwIC8gdGhpcy5fZnJhbWVTdGVwKTtcbiAgICAgIGlmICh0aGlzLl9wcmV2RnJhbWUgIT09IHRoaXMuX2ZyYW1lc1twcm9jXSkge1xuICAgICAgICBpZiAoKF9yZWYgPSB0aGlzLl9wcmV2RnJhbWUpICE9IG51bGwpIHtcbiAgICAgICAgICBfcmVmLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGN1cnJlbnROdW0gPSBwID09PSAxICYmIHRoaXMuX3Byb3BzLmlzU2hvd0VuZCA/IHByb2MgLSAxIDogcHJvYztcbiAgICAgICAgaWYgKChfcmVmMSA9IHRoaXMuX2ZyYW1lc1tjdXJyZW50TnVtXSkgIT0gbnVsbCkge1xuICAgICAgICAgIF9yZWYxLnN0eWxlLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3ByZXZGcmFtZSA9IHRoaXMuX2ZyYW1lc1twcm9jXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0eXBlb2YgKF9iYXNlID0gdGhpcy5fcHJvcHMpLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIgPyBfYmFzZS5vblVwZGF0ZShwKSA6IHZvaWQgMDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFNwcml0ZXI7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFNwcml0ZXI7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIFN0YWdnZXIsIFN0YWdnZXJXcmFwcGVyLCBUaW1lbGluZSwgaDtcblxuICBoID0gcmVxdWlyZSgnLi9oJyk7XG5cbiAgVGltZWxpbmUgPSByZXF1aXJlKCcuL3R3ZWVuL3RpbWVsaW5lJyk7XG5cbiAgU3RhZ2dlciA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBTdGFnZ2VyKG9wdGlvbnMsIE1vZHVsZSkge1xuICAgICAgdGhpcy5pbml0KG9wdGlvbnMsIE1vZHVsZSk7XG4gICAgfVxuXG4gICAgU3RhZ2dlci5wcm90b3R5cGUuX2dldE9wdGlvbkJ5TW9kID0gZnVuY3Rpb24obmFtZSwgaSwgc3RvcmUpIHtcbiAgICAgIHZhciBwcm9wcywgdmFsdWU7XG4gICAgICBwcm9wcyA9IHN0b3JlW25hbWVdO1xuICAgICAgaWYgKHByb3BzICsgJycgPT09ICdbb2JqZWN0IE5vZGVMaXN0XScpIHtcbiAgICAgICAgcHJvcHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChwcm9wcywgMCk7XG4gICAgICB9XG4gICAgICBpZiAocHJvcHMgKyAnJyA9PT0gJ1tvYmplY3QgSFRNTENvbGxlY3Rpb25dJykge1xuICAgICAgICBwcm9wcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHByb3BzLCAwKTtcbiAgICAgIH1cbiAgICAgIHZhbHVlID0gaC5pc0FycmF5KHByb3BzKSA/IHByb3BzW2kgJSBwcm9wcy5sZW5ndGhdIDogcHJvcHM7XG4gICAgICByZXR1cm4gaC5wYXJzZUlmU3RhZ2dlcih2YWx1ZSwgaSk7XG4gICAgfTtcblxuICAgIFN0YWdnZXIucHJvdG90eXBlLl9nZXRPcHRpb25CeUluZGV4ID0gZnVuY3Rpb24oaSwgc3RvcmUpIHtcbiAgICAgIHZhciBrZXksIG9wdGlvbnMsIHZhbHVlO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgZm9yIChrZXkgaW4gc3RvcmUpIHtcbiAgICAgICAgdmFsdWUgPSBzdG9yZVtrZXldO1xuICAgICAgICBvcHRpb25zW2tleV0gPSB0aGlzLl9nZXRPcHRpb25CeU1vZChrZXksIGksIHN0b3JlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH07XG5cbiAgICBTdGFnZ2VyLnByb3RvdHlwZS5fZ2V0Q2hpbGRRdWFudGl0eSA9IGZ1bmN0aW9uKG5hbWUsIHN0b3JlKSB7XG4gICAgICB2YXIgYXJ5LCBxdWFudGlmaWVyO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnbnVtYmVyJykge1xuICAgICAgICByZXR1cm4gbmFtZTtcbiAgICAgIH1cbiAgICAgIHF1YW50aWZpZXIgPSBzdG9yZVtuYW1lXTtcbiAgICAgIGlmIChoLmlzQXJyYXkocXVhbnRpZmllcikpIHtcbiAgICAgICAgcmV0dXJuIHF1YW50aWZpZXIubGVuZ3RoO1xuICAgICAgfSBlbHNlIGlmIChxdWFudGlmaWVyICsgJycgPT09ICdbb2JqZWN0IE5vZGVMaXN0XScpIHtcbiAgICAgICAgcmV0dXJuIHF1YW50aWZpZXIubGVuZ3RoO1xuICAgICAgfSBlbHNlIGlmIChxdWFudGlmaWVyICsgJycgPT09ICdbb2JqZWN0IEhUTUxDb2xsZWN0aW9uXScpIHtcbiAgICAgICAgYXJ5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwocXVhbnRpZmllciwgMCk7XG4gICAgICAgIHJldHVybiBhcnkubGVuZ3RoO1xuICAgICAgfSBlbHNlIGlmIChxdWFudGlmaWVyIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBxdWFudGlmaWVyID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgU3RhZ2dlci5wcm90b3R5cGUuX2NyZWF0ZVRpbWVsaW5lID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgaWYgKG9wdGlvbnMgPT0gbnVsbCkge1xuICAgICAgICBvcHRpb25zID0ge307XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy50aW1lbGluZSA9IG5ldyBUaW1lbGluZSh7XG4gICAgICAgIG9uU3RhcnQ6IG9wdGlvbnMub25TdGFnZ2VyU3RhcnQsXG4gICAgICAgIG9uVXBkYXRlOiBvcHRpb25zLm9uU3RhZ2dlclVwZGF0ZSxcbiAgICAgICAgb25Db21wbGV0ZTogb3B0aW9ucy5vblN0YWdnZXJDb21wbGV0ZSxcbiAgICAgICAgb25SZXZlcnNlQ29tcGxldGU6IG9wdGlvbnMub25TdGFnZ2VyUmV2ZXJzZUNvbXBsZXRlLFxuICAgICAgICBkZWxheTogb3B0aW9ucy5tb2R1bGVEZWxheVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFN0YWdnZXIucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbihvcHRpb25zLCBNb2R1bGUpIHtcbiAgICAgIHZhciBjb3VudCwgaSwgbW9kdWxlLCBvcHRpb24sIF9pO1xuICAgICAgY291bnQgPSB0aGlzLl9nZXRDaGlsZFF1YW50aXR5KG9wdGlvbnMucXVhbnRpZmllciB8fCAnZWwnLCBvcHRpb25zKTtcbiAgICAgIHRoaXMuX2NyZWF0ZVRpbWVsaW5lKG9wdGlvbnMpO1xuICAgICAgdGhpcy5jaGlsZE1vZHVsZXMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMDsgMCA8PSBjb3VudCA/IF9pIDwgY291bnQgOiBfaSA+IGNvdW50OyBpID0gMCA8PSBjb3VudCA/ICsrX2kgOiAtLV9pKSB7XG4gICAgICAgIG9wdGlvbiA9IHRoaXMuX2dldE9wdGlvbkJ5SW5kZXgoaSwgb3B0aW9ucyk7XG4gICAgICAgIG9wdGlvbi5pc1J1bkxlc3MgPSB0cnVlO1xuICAgICAgICBtb2R1bGUgPSBuZXcgTW9kdWxlKG9wdGlvbik7XG4gICAgICAgIHRoaXMuY2hpbGRNb2R1bGVzLnB1c2gobW9kdWxlKTtcbiAgICAgICAgdGhpcy50aW1lbGluZS5hZGQobW9kdWxlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBTdGFnZ2VyLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnRpbWVsaW5lLnN0YXJ0KCk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdGFnZ2VyO1xuXG4gIH0pKCk7XG5cbiAgU3RhZ2dlcldyYXBwZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gU3RhZ2dlcldyYXBwZXIoTW9kdWxlKSB7XG4gICAgICB2YXIgTTtcbiAgICAgIE0gPSBNb2R1bGU7XG4gICAgICByZXR1cm4gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IFN0YWdnZXIob3B0aW9ucywgTSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBTdGFnZ2VyV3JhcHBlcjtcblxuICB9KSgpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gU3RhZ2dlcldyYXBwZXI7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIFN3aXJsLCBUcmFuc2l0LFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIF9fZXh0ZW5kcyA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoX19oYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9O1xuXG4gIFRyYW5zaXQgPSByZXF1aXJlKCcuL3RyYW5zaXQnKTtcblxuICBTd2lybCA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoU3dpcmwsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBTd2lybCgpIHtcbiAgICAgIHJldHVybiBTd2lybC5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBTd2lybC5wcm90b3R5cGUuc2tpcFByb3BzRGVsdGEgPSB7XG4gICAgICB4OiAxLFxuICAgICAgeTogMVxuICAgIH07XG5cbiAgICBTd2lybC5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgU3dpcmwuX19zdXBlcl9fLnZhcnMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiAhdGhpcy5vLmlzU3dpcmxMZXNzICYmIHRoaXMuZ2VuZXJhdGVTd2lybCgpO1xuICAgIH07XG5cbiAgICBTd2lybC5wcm90b3R5cGUuZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhbmdsZSwgeCwgeSwgX2Jhc2U7XG4gICAgICBTd2lybC5fX3N1cGVyX18uZXh0ZW5kRGVmYXVsdHMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHggPSB0aGlzLmdldFBvc1ZhbHVlKCd4Jyk7XG4gICAgICB5ID0gdGhpcy5nZXRQb3NWYWx1ZSgneScpO1xuICAgICAgYW5nbGUgPSA5MCArIE1hdGguYXRhbigoeS5kZWx0YSAvIHguZGVsdGEpIHx8IDApICogKDE4MCAvIE1hdGguUEkpO1xuICAgICAgaWYgKHguZGVsdGEgPCAwKSB7XG4gICAgICAgIGFuZ2xlICs9IDE4MDtcbiAgICAgIH1cbiAgICAgIHRoaXMucG9zaXRpb25EZWx0YSA9IHtcbiAgICAgICAgcmFkaXVzOiBNYXRoLnNxcnQoeC5kZWx0YSAqIHguZGVsdGEgKyB5LmRlbHRhICogeS5kZWx0YSksXG4gICAgICAgIGFuZ2xlOiBhbmdsZSxcbiAgICAgICAgeDogeCxcbiAgICAgICAgeTogeVxuICAgICAgfTtcbiAgICAgIGlmICgoX2Jhc2UgPSB0aGlzLm8pLnJhZGl1c1NjYWxlID09IG51bGwpIHtcbiAgICAgICAgX2Jhc2UucmFkaXVzU2NhbGUgPSAxO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9wcy5hbmdsZVNoaWZ0ID0gdGhpcy5oLnBhcnNlSWZSYW5kKHRoaXMuby5hbmdsZVNoaWZ0IHx8IDApO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMucmFkaXVzU2NhbGUgPSB0aGlzLmgucGFyc2VJZlJhbmQodGhpcy5vLnJhZGl1c1NjYWxlKTtcbiAgICB9O1xuXG4gICAgU3dpcmwucHJvdG90eXBlLmdldFBvc1ZhbHVlID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIG9wdFZhbCwgdmFsO1xuICAgICAgb3B0VmFsID0gdGhpcy5vW25hbWVdO1xuICAgICAgaWYgKG9wdFZhbCAmJiB0eXBlb2Ygb3B0VmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgICB2YWwgPSB0aGlzLmgucGFyc2VEZWx0YShuYW1lLCBvcHRWYWwpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXJ0OiB2YWwuc3RhcnQudmFsdWUsXG4gICAgICAgICAgZW5kOiB2YWwuZW5kLnZhbHVlLFxuICAgICAgICAgIGRlbHRhOiB2YWwuZGVsdGEsXG4gICAgICAgICAgdW5pdHM6IHZhbC5lbmQudW5pdFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsID0gcGFyc2VGbG9hdChvcHRWYWwgfHwgdGhpcy5kZWZhdWx0c1tuYW1lXSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhcnQ6IHZhbCxcbiAgICAgICAgICBlbmQ6IHZhbCxcbiAgICAgICAgICBkZWx0YTogMCxcbiAgICAgICAgICB1bml0czogJ3B4J1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH07XG5cbiAgICBTd2lybC5wcm90b3R5cGUuc2V0UHJvZ3Jlc3MgPSBmdW5jdGlvbihwcm9ncmVzcykge1xuICAgICAgdmFyIGFuZ2xlLCBwb2ludCwgeCwgeTtcbiAgICAgIGFuZ2xlID0gdGhpcy5wb3NpdGlvbkRlbHRhLmFuZ2xlO1xuICAgICAgaWYgKHRoaXMuby5pc1N3aXJsKSB7XG4gICAgICAgIGFuZ2xlICs9IHRoaXMuZ2V0U3dpcmwocHJvZ3Jlc3MpO1xuICAgICAgfVxuICAgICAgcG9pbnQgPSB0aGlzLmguZ2V0UmFkaWFsUG9pbnQoe1xuICAgICAgICBhbmdsZTogYW5nbGUsXG4gICAgICAgIHJhZGl1czogdGhpcy5wb3NpdGlvbkRlbHRhLnJhZGl1cyAqIHByb2dyZXNzICogdGhpcy5wcm9wcy5yYWRpdXNTY2FsZSxcbiAgICAgICAgY2VudGVyOiB7XG4gICAgICAgICAgeDogdGhpcy5wb3NpdGlvbkRlbHRhLnguc3RhcnQsXG4gICAgICAgICAgeTogdGhpcy5wb3NpdGlvbkRlbHRhLnkuc3RhcnRcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB4ID0gcG9pbnQueC50b0ZpeGVkKDQpO1xuICAgICAgeSA9IHBvaW50LnkudG9GaXhlZCg0KTtcbiAgICAgIHRoaXMucHJvcHMueCA9IHRoaXMuby5jdHggPyB4IDogeCArIHRoaXMucG9zaXRpb25EZWx0YS54LnVuaXRzO1xuICAgICAgdGhpcy5wcm9wcy55ID0gdGhpcy5vLmN0eCA/IHkgOiB5ICsgdGhpcy5wb3NpdGlvbkRlbHRhLnkudW5pdHM7XG4gICAgICByZXR1cm4gU3dpcmwuX19zdXBlcl9fLnNldFByb2dyZXNzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIFN3aXJsLnByb3RvdHlwZS5nZW5lcmF0ZVN3aXJsID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgX2Jhc2UsIF9iYXNlMTtcbiAgICAgIHRoaXMucHJvcHMuc2lnblJhbmQgPSBNYXRoLnJvdW5kKHRoaXMuaC5yYW5kKDAsIDEpKSA/IC0xIDogMTtcbiAgICAgIGlmICgoX2Jhc2UgPSB0aGlzLm8pLnN3aXJsU2l6ZSA9PSBudWxsKSB7XG4gICAgICAgIF9iYXNlLnN3aXJsU2l6ZSA9IDEwO1xuICAgICAgfVxuICAgICAgaWYgKChfYmFzZTEgPSB0aGlzLm8pLnN3aXJsRnJlcXVlbmN5ID09IG51bGwpIHtcbiAgICAgICAgX2Jhc2UxLnN3aXJsRnJlcXVlbmN5ID0gMztcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvcHMuc3dpcmxTaXplID0gdGhpcy5oLnBhcnNlSWZSYW5kKHRoaXMuby5zd2lybFNpemUpO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuc3dpcmxGcmVxdWVuY3kgPSB0aGlzLmgucGFyc2VJZlJhbmQodGhpcy5vLnN3aXJsRnJlcXVlbmN5KTtcbiAgICB9O1xuXG4gICAgU3dpcmwucHJvdG90eXBlLmdldFN3aXJsID0gZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnNpZ25SYW5kICogdGhpcy5wcm9wcy5zd2lybFNpemUgKiBNYXRoLnNpbih0aGlzLnByb3BzLnN3aXJsRnJlcXVlbmN5ICogcHJvZ3Jlc3MpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU3dpcmw7XG5cbiAgfSkoVHJhbnNpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBTd2lybDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIlxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgVGltZWxpbmUsIFRyYW5zaXQsIFR3ZWVuLCBiaXRzTWFwLCBoLFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIF9fZXh0ZW5kcyA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoX19oYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9O1xuXG4gIGggPSByZXF1aXJlKCcuL2gnKTtcblxuICBiaXRzTWFwID0gcmVxdWlyZSgnLi9zaGFwZXMvYml0c01hcCcpO1xuXG4gIFR3ZWVuID0gcmVxdWlyZSgnLi90d2Vlbi90d2VlbicpO1xuXG4gIFRpbWVsaW5lID0gcmVxdWlyZSgnLi90d2Vlbi90aW1lbGluZScpO1xuXG4gIFRyYW5zaXQgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKFRyYW5zaXQsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBUcmFuc2l0KCkge1xuICAgICAgcmV0dXJuIFRyYW5zaXQuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUucHJvZ3Jlc3MgPSAwO1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZGVmYXVsdHMgPSB7XG4gICAgICBzdHJva2VXaWR0aDogMixcbiAgICAgIHN0cm9rZU9wYWNpdHk6IDEsXG4gICAgICBzdHJva2VEYXNoYXJyYXk6IDAsXG4gICAgICBzdHJva2VEYXNob2Zmc2V0OiAwLFxuICAgICAgc3Ryb2tlOiAndHJhbnNwYXJlbnQnLFxuICAgICAgZmlsbDogJ2RlZXBwaW5rJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAndHJhbnNwYXJlbnQnLFxuICAgICAgc3Ryb2tlTGluZWNhcDogJycsXG4gICAgICBwb2ludHM6IDMsXG4gICAgICB4OiAwLFxuICAgICAgeTogMCxcbiAgICAgIHNoaWZ0WDogMCxcbiAgICAgIHNoaWZ0WTogMCxcbiAgICAgIG9wYWNpdHk6IDEsXG4gICAgICByYWRpdXM6IHtcbiAgICAgICAgMDogNTBcbiAgICAgIH0sXG4gICAgICByYWRpdXNYOiB2b2lkIDAsXG4gICAgICByYWRpdXNZOiB2b2lkIDAsXG4gICAgICBhbmdsZTogMCxcbiAgICAgIHNpemU6IG51bGwsXG4gICAgICBzaXplR2FwOiAwLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uQ29tcGxldGU6IG51bGwsXG4gICAgICBvblVwZGF0ZTogbnVsbCxcbiAgICAgIGR1cmF0aW9uOiA1MDAsXG4gICAgICBkZWxheTogMCxcbiAgICAgIHJlcGVhdDogMCxcbiAgICAgIHlveW86IGZhbHNlLFxuICAgICAgZWFzaW5nOiAnTGluZWFyLk5vbmUnXG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvO1xuICAgICAgaWYgKHRoaXMuaCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuaCA9IGg7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5sYXN0U2V0ID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5sYXN0U2V0ID0ge307XG4gICAgICB9XG4gICAgICB0aGlzLmluZGV4ID0gdGhpcy5vLmluZGV4IHx8IDA7XG4gICAgICBpZiAodGhpcy5ydW5Db3VudCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMucnVuQ291bnQgPSAwO1xuICAgICAgfVxuICAgICAgdGhpcy5leHRlbmREZWZhdWx0cygpO1xuICAgICAgbyA9IHRoaXMuaC5jbG9uZU9iaih0aGlzLm8pO1xuICAgICAgdGhpcy5oLmV4dGVuZChvLCB0aGlzLmRlZmF1bHRzKTtcbiAgICAgIHRoaXMuaGlzdG9yeSA9IFtvXTtcbiAgICAgIHRoaXMuaXNGb3JlaWduID0gISF0aGlzLm8uY3R4O1xuICAgICAgdGhpcy5pc0ZvcmVpZ25CaXQgPSAhIXRoaXMuby5iaXQ7XG4gICAgICByZXR1cm4gdGhpcy50aW1lbGluZXMgPSBbXTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoaXMuaXNSZW5kZXJlZCkge1xuICAgICAgICBpZiAoIXRoaXMuaXNGb3JlaWduICYmICF0aGlzLmlzRm9yZWlnbkJpdCkge1xuICAgICAgICAgIHRoaXMuY3R4ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKHRoaXMubnMsICdzdmcnKTtcbiAgICAgICAgICB0aGlzLmN0eC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgICAgdGhpcy5jdHguc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gICAgICAgICAgdGhpcy5jdHguc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgICAgICAgIHRoaXMuY3JlYXRlQml0KCk7XG4gICAgICAgICAgdGhpcy5jYWxjU2l6ZSgpO1xuICAgICAgICAgIHRoaXMuZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICB0aGlzLmVsLmFwcGVuZENoaWxkKHRoaXMuY3R4KTtcbiAgICAgICAgICAodGhpcy5vLnBhcmVudCB8fCBkb2N1bWVudC5ib2R5KS5hcHBlbmRDaGlsZCh0aGlzLmVsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmN0eCA9IHRoaXMuby5jdHg7XG4gICAgICAgICAgdGhpcy5jcmVhdGVCaXQoKTtcbiAgICAgICAgICB0aGlzLmNhbGNTaXplKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc1JlbmRlcmVkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc2V0RWxTdHlsZXMoKTtcbiAgICAgIHRoaXMuc2V0UHJvZ3Jlc3MoMCwgdHJ1ZSk7XG4gICAgICB0aGlzLmNyZWF0ZVR3ZWVuKCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuc2V0RWxTdHlsZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBtYXJnaW5TaXplLCBzaXplLCBfcmVmO1xuICAgICAgaWYgKCF0aGlzLmlzRm9yZWlnbikge1xuICAgICAgICBzaXplID0gXCJcIiArIHRoaXMucHJvcHMuc2l6ZSArIFwicHhcIjtcbiAgICAgICAgbWFyZ2luU2l6ZSA9IFwiXCIgKyAoLXRoaXMucHJvcHMuc2l6ZSAvIDIpICsgXCJweFwiO1xuICAgICAgICB0aGlzLmVsLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgdGhpcy5lbC5zdHlsZS50b3AgPSB0aGlzLnByb3BzLnk7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUubGVmdCA9IHRoaXMucHJvcHMueDtcbiAgICAgICAgdGhpcy5lbC5zdHlsZS53aWR0aCA9IHNpemU7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUuaGVpZ2h0ID0gc2l6ZTtcbiAgICAgICAgdGhpcy5lbC5zdHlsZVsnbWFyZ2luLWxlZnQnXSA9IG1hcmdpblNpemU7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbJ21hcmdpbi10b3AnXSA9IG1hcmdpblNpemU7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbJ21hcmdpbkxlZnQnXSA9IG1hcmdpblNpemU7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbJ21hcmdpblRvcCddID0gbWFyZ2luU2l6ZTtcbiAgICAgIH1cbiAgICAgIGlmICgoX3JlZiA9IHRoaXMuZWwpICE9IG51bGwpIHtcbiAgICAgICAgX3JlZi5zdHlsZS5vcGFjaXR5ID0gdGhpcy5wcm9wcy5vcGFjaXR5O1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuby5pc1Nob3dJbml0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNob3coKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhpZGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuaXNTaG93biB8fCAodGhpcy5lbCA9PSBudWxsKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgcmV0dXJuIHRoaXMuaXNTaG93biA9IHRydWU7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgodGhpcy5pc1Nob3duID09PSBmYWxzZSkgfHwgKHRoaXMuZWwgPT0gbnVsbCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgcmV0dXJuIHRoaXMuaXNTaG93biA9IGZhbHNlO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmJpdC5zZXRQcm9wKHtcbiAgICAgICAgeDogdGhpcy5vcmlnaW4ueCxcbiAgICAgICAgeTogdGhpcy5vcmlnaW4ueSxcbiAgICAgICAgc3Ryb2tlOiB0aGlzLnByb3BzLnN0cm9rZSxcbiAgICAgICAgJ3N0cm9rZS13aWR0aCc6IHRoaXMucHJvcHMuc3Ryb2tlV2lkdGgsXG4gICAgICAgICdzdHJva2Utb3BhY2l0eSc6IHRoaXMucHJvcHMuc3Ryb2tlT3BhY2l0eSxcbiAgICAgICAgJ3N0cm9rZS1kYXNoYXJyYXknOiB0aGlzLnByb3BzLnN0cm9rZURhc2hhcnJheSxcbiAgICAgICAgJ3N0cm9rZS1kYXNob2Zmc2V0JzogdGhpcy5wcm9wcy5zdHJva2VEYXNob2Zmc2V0LFxuICAgICAgICAnc3Ryb2tlLWxpbmVjYXAnOiB0aGlzLnByb3BzLnN0cm9rZUxpbmVjYXAsXG4gICAgICAgIGZpbGw6IHRoaXMucHJvcHMuZmlsbCxcbiAgICAgICAgJ2ZpbGwtb3BhY2l0eSc6IHRoaXMucHJvcHMuZmlsbE9wYWNpdHksXG4gICAgICAgIHJhZGl1czogdGhpcy5wcm9wcy5yYWRpdXMsXG4gICAgICAgIHJhZGl1c1g6IHRoaXMucHJvcHMucmFkaXVzWCxcbiAgICAgICAgcmFkaXVzWTogdGhpcy5wcm9wcy5yYWRpdXNZLFxuICAgICAgICBwb2ludHM6IHRoaXMucHJvcHMucG9pbnRzLFxuICAgICAgICB0cmFuc2Zvcm06IHRoaXMuY2FsY1RyYW5zZm9ybSgpXG4gICAgICB9KTtcbiAgICAgIHRoaXMuYml0LmRyYXcoKTtcbiAgICAgIHJldHVybiB0aGlzLmRyYXdFbCgpO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5kcmF3RWwgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmVsID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLmlzUHJvcENoYW5nZWQoJ29wYWNpdHknKSAmJiAodGhpcy5lbC5zdHlsZS5vcGFjaXR5ID0gdGhpcy5wcm9wcy5vcGFjaXR5KTtcbiAgICAgIGlmICghdGhpcy5pc0ZvcmVpZ24pIHtcbiAgICAgICAgdGhpcy5pc1Byb3BDaGFuZ2VkKCd4JykgJiYgKHRoaXMuZWwuc3R5bGUubGVmdCA9IHRoaXMucHJvcHMueCk7XG4gICAgICAgIHRoaXMuaXNQcm9wQ2hhbmdlZCgneScpICYmICh0aGlzLmVsLnN0eWxlLnRvcCA9IHRoaXMucHJvcHMueSk7XG4gICAgICAgIGlmICh0aGlzLmlzTmVlZHNUcmFuc2Zvcm0oKSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmguc2V0UHJlZml4ZWRTdHlsZSh0aGlzLmVsLCAndHJhbnNmb3JtJywgdGhpcy5maWxsVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmZpbGxUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBcInRyYW5zbGF0ZShcIiArIHRoaXMucHJvcHMuc2hpZnRYICsgXCIsIFwiICsgdGhpcy5wcm9wcy5zaGlmdFkgKyBcIilcIjtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuaXNOZWVkc1RyYW5zZm9ybSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGlzWCwgaXNZO1xuICAgICAgaXNYID0gdGhpcy5pc1Byb3BDaGFuZ2VkKCdzaGlmdFgnKTtcbiAgICAgIGlzWSA9IHRoaXMuaXNQcm9wQ2hhbmdlZCgnc2hpZnRZJyk7XG4gICAgICByZXR1cm4gaXNYIHx8IGlzWTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuaXNQcm9wQ2hhbmdlZCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBfYmFzZTtcbiAgICAgIGlmICgoX2Jhc2UgPSB0aGlzLmxhc3RTZXQpW25hbWVdID09IG51bGwpIHtcbiAgICAgICAgX2Jhc2VbbmFtZV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmxhc3RTZXRbbmFtZV0udmFsdWUgIT09IHRoaXMucHJvcHNbbmFtZV0pIHtcbiAgICAgICAgdGhpcy5sYXN0U2V0W25hbWVdLnZhbHVlID0gdGhpcy5wcm9wc1tuYW1lXTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNhbGNUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnRyYW5zZm9ybSA9IFwicm90YXRlKFwiICsgdGhpcy5wcm9wcy5hbmdsZSArIFwiLFwiICsgdGhpcy5vcmlnaW4ueCArIFwiLFwiICsgdGhpcy5vcmlnaW4ueSArIFwiKVwiO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jYWxjU2l6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGRTdHJva2UsIHJhZGl1cywgc3Ryb2tlLCBfYmFzZTtcbiAgICAgIGlmICh0aGlzLm8uc2l6ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByYWRpdXMgPSB0aGlzLmNhbGNNYXhSYWRpdXMoKTtcbiAgICAgIGRTdHJva2UgPSB0aGlzLmRlbHRhc1snc3Ryb2tlV2lkdGgnXTtcbiAgICAgIHN0cm9rZSA9IGRTdHJva2UgIT0gbnVsbCA/IE1hdGgubWF4KE1hdGguYWJzKGRTdHJva2Uuc3RhcnQpLCBNYXRoLmFicyhkU3Ryb2tlLmVuZCkpIDogdGhpcy5wcm9wcy5zdHJva2VXaWR0aDtcbiAgICAgIHRoaXMucHJvcHMuc2l6ZSA9IDIgKiByYWRpdXMgKyAyICogc3Ryb2tlO1xuICAgICAgc3dpdGNoICh0eXBlb2YgKF9iYXNlID0gdGhpcy5wcm9wcy5lYXNpbmcpLnRvTG93ZXJDYXNlID09PSBcImZ1bmN0aW9uXCIgPyBfYmFzZS50b0xvd2VyQ2FzZSgpIDogdm9pZCAwKSB7XG4gICAgICAgIGNhc2UgJ2VsYXN0aWMub3V0JzpcbiAgICAgICAgY2FzZSAnZWxhc3RpYy5pbm91dCc6XG4gICAgICAgICAgdGhpcy5wcm9wcy5zaXplICo9IDEuMjU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2JhY2sub3V0JzpcbiAgICAgICAgY2FzZSAnYmFjay5pbm91dCc6XG4gICAgICAgICAgdGhpcy5wcm9wcy5zaXplICo9IDEuMTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvcHMuc2l6ZSAqPSB0aGlzLmJpdC5yYXRpbztcbiAgICAgIHRoaXMucHJvcHMuc2l6ZSArPSAyICogdGhpcy5wcm9wcy5zaXplR2FwO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuY2VudGVyID0gdGhpcy5wcm9wcy5zaXplIC8gMjtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuY2FsY01heFJhZGl1cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGZTaXplLCBzZWxmU2l6ZVgsIHNlbGZTaXplWTtcbiAgICAgIHNlbGZTaXplID0gdGhpcy5nZXRSYWRpdXNTaXplKHtcbiAgICAgICAga2V5OiAncmFkaXVzJ1xuICAgICAgfSk7XG4gICAgICBzZWxmU2l6ZVggPSB0aGlzLmdldFJhZGl1c1NpemUoe1xuICAgICAgICBrZXk6ICdyYWRpdXNYJyxcbiAgICAgICAgZmFsbGJhY2s6IHNlbGZTaXplXG4gICAgICB9KTtcbiAgICAgIHNlbGZTaXplWSA9IHRoaXMuZ2V0UmFkaXVzU2l6ZSh7XG4gICAgICAgIGtleTogJ3JhZGl1c1knLFxuICAgICAgICBmYWxsYmFjazogc2VsZlNpemVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIE1hdGgubWF4KHNlbGZTaXplWCwgc2VsZlNpemVZKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZ2V0UmFkaXVzU2l6ZSA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIGlmICh0aGlzLmRlbHRhc1tvLmtleV0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoTWF0aC5hYnModGhpcy5kZWx0YXNbby5rZXldLmVuZCksIE1hdGguYWJzKHRoaXMuZGVsdGFzW28ua2V5XS5zdGFydCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnByb3BzW28ua2V5XSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXMucHJvcHNbby5rZXldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBvLmZhbGxiYWNrIHx8IDA7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNyZWF0ZUJpdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGJpdENsYXNzO1xuICAgICAgYml0Q2xhc3MgPSBiaXRzTWFwLmdldEJpdCh0aGlzLm8udHlwZSB8fCB0aGlzLnR5cGUpO1xuICAgICAgdGhpcy5iaXQgPSBuZXcgYml0Q2xhc3Moe1xuICAgICAgICBjdHg6IHRoaXMuY3R4LFxuICAgICAgICBlbDogdGhpcy5vLmJpdCxcbiAgICAgICAgaXNEcmF3TGVzczogdHJ1ZVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5pc0ZvcmVpZ24gfHwgdGhpcy5pc0ZvcmVpZ25CaXQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwgPSB0aGlzLmJpdC5lbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuc2V0UHJvZ3Jlc3MgPSBmdW5jdGlvbihwcm9ncmVzcywgaXNTaG93KSB7XG4gICAgICBpZiAoIWlzU2hvdykge1xuICAgICAgICB0aGlzLnNob3coKTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB0aGlzLm9uVXBkYXRlKHByb2dyZXNzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5wcm9ncmVzcyA9IHByb2dyZXNzIDwgMCB8fCAhcHJvZ3Jlc3MgPyAwIDogcHJvZ3Jlc3MgPiAxID8gMSA6IHByb2dyZXNzO1xuICAgICAgdGhpcy5jYWxjQ3VycmVudFByb3BzKHByb2dyZXNzKTtcbiAgICAgIHRoaXMuY2FsY09yaWdpbigpO1xuICAgICAgdGhpcy5kcmF3KHByb2dyZXNzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jYWxjQ3VycmVudFByb3BzID0gZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcbiAgICAgIHZhciBhLCBiLCBkYXNoLCBnLCBpLCBpdGVtLCBrZXksIGtleXMsIGxlbiwgciwgc3Ryb2tlLCB1bml0cywgdmFsdWUsIF9yZXN1bHRzO1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuZGVsdGFzKTtcbiAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgIHZhbHVlID0gdGhpcy5kZWx0YXNba2V5XTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnByb3BzW2tleV0gPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgICAgIHN3aXRjaCAodmFsdWUudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnYXJyYXknOlxuICAgICAgICAgICAgICBzdHJva2UgPSBbXTtcbiAgICAgICAgICAgICAgX3JlZiA9IHZhbHVlLmRlbHRhO1xuICAgICAgICAgICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICAgICAgICAgIGl0ZW0gPSBfcmVmW2ldO1xuICAgICAgICAgICAgICAgIGRhc2ggPSB2YWx1ZS5zdGFydFtpXS52YWx1ZSArIGl0ZW0udmFsdWUgKiB0aGlzLnByb2dyZXNzO1xuICAgICAgICAgICAgICAgIHN0cm9rZS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiBkYXNoLFxuICAgICAgICAgICAgICAgICAgdW5pdDogaXRlbS51bml0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHN0cm9rZTtcbiAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5zdGFydCArIHZhbHVlLmRlbHRhICogcHJvZ3Jlc3M7XG4gICAgICAgICAgICBjYXNlICd1bml0JzpcbiAgICAgICAgICAgICAgdW5pdHMgPSB2YWx1ZS5lbmQudW5pdDtcbiAgICAgICAgICAgICAgcmV0dXJuIFwiXCIgKyAodmFsdWUuc3RhcnQudmFsdWUgKyB2YWx1ZS5kZWx0YSAqIHByb2dyZXNzKSArIHVuaXRzO1xuICAgICAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAgICByID0gcGFyc2VJbnQodmFsdWUuc3RhcnQuciArIHZhbHVlLmRlbHRhLnIgKiBwcm9ncmVzcywgMTApO1xuICAgICAgICAgICAgICBnID0gcGFyc2VJbnQodmFsdWUuc3RhcnQuZyArIHZhbHVlLmRlbHRhLmcgKiBwcm9ncmVzcywgMTApO1xuICAgICAgICAgICAgICBiID0gcGFyc2VJbnQodmFsdWUuc3RhcnQuYiArIHZhbHVlLmRlbHRhLmIgKiBwcm9ncmVzcywgMTApO1xuICAgICAgICAgICAgICBhID0gcGFyc2VJbnQodmFsdWUuc3RhcnQuYSArIHZhbHVlLmRlbHRhLmEgKiBwcm9ncmVzcywgMTApO1xuICAgICAgICAgICAgICByZXR1cm4gXCJyZ2JhKFwiICsgciArIFwiLFwiICsgZyArIFwiLFwiICsgYiArIFwiLFwiICsgYSArIFwiKVwiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkuY2FsbCh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNhbGNPcmlnaW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLm9yaWdpbiA9IHRoaXMuby5jdHggPyB7XG4gICAgICAgIHg6IHBhcnNlRmxvYXQodGhpcy5wcm9wcy54KSxcbiAgICAgICAgeTogcGFyc2VGbG9hdCh0aGlzLnByb3BzLnkpXG4gICAgICB9IDoge1xuICAgICAgICB4OiB0aGlzLnByb3BzLmNlbnRlcixcbiAgICAgICAgeTogdGhpcy5wcm9wcy5jZW50ZXJcbiAgICAgIH07XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmV4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGFycmF5LCBkZWZhdWx0c1ZhbHVlLCBmcm9tT2JqZWN0LCBpLCBrZXksIGtleXMsIGxlbiwgb3B0aW9uc1ZhbHVlLCBwcm9wZXJ0eSwgdW5pdCwgdmFsdWUsIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgaWYgKHRoaXMucHJvcHMgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnByb3BzID0ge307XG4gICAgICB9XG4gICAgICBmcm9tT2JqZWN0ID0gbyB8fCB0aGlzLmRlZmF1bHRzO1xuICAgICAgKG8gPT0gbnVsbCkgJiYgKHRoaXMuZGVsdGFzID0ge30pO1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGZyb21PYmplY3QpO1xuICAgICAgbGVuID0ga2V5cy5sZW5ndGg7XG4gICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAga2V5ID0ga2V5c1tsZW5dO1xuICAgICAgICBkZWZhdWx0c1ZhbHVlID0gZnJvbU9iamVjdFtrZXldO1xuICAgICAgICBpZiAoKF9yZWYgPSB0aGlzLnNraXBQcm9wcykgIT0gbnVsbCA/IF9yZWZba2V5XSA6IHZvaWQgMCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvKSB7XG4gICAgICAgICAgdGhpcy5vW2tleV0gPSBkZWZhdWx0c1ZhbHVlO1xuICAgICAgICAgIG9wdGlvbnNWYWx1ZSA9IGRlZmF1bHRzVmFsdWU7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZGVsdGFzW2tleV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3B0aW9uc1ZhbHVlID0gdGhpcy5vW2tleV0gIT0gbnVsbCA/IHRoaXMub1trZXldIDogZGVmYXVsdHNWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuaXNEZWx0YShvcHRpb25zVmFsdWUpKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zVmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1ZhbHVlLm1hdGNoKC9zdGFnZ2VyLykpIHtcbiAgICAgICAgICAgICAgb3B0aW9uc1ZhbHVlID0gdGhpcy5oLnBhcnNlU3RhZ2dlcihvcHRpb25zVmFsdWUsIHRoaXMuaW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnNWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zVmFsdWUubWF0Y2goL3JhbmQvKSkge1xuICAgICAgICAgICAgICBvcHRpb25zVmFsdWUgPSB0aGlzLmgucGFyc2VSYW5kKG9wdGlvbnNWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMucHJvcHNba2V5XSA9IG9wdGlvbnNWYWx1ZTtcbiAgICAgICAgICBpZiAoa2V5ID09PSAncmFkaXVzJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuby5yYWRpdXNYID09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhpcy5wcm9wcy5yYWRpdXNYID0gb3B0aW9uc1ZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuby5yYWRpdXNZID09IG51bGwpIHtcbiAgICAgICAgICAgICAgdGhpcy5wcm9wcy5yYWRpdXNZID0gb3B0aW9uc1ZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5oLnBvc1Byb3BzTWFwW2tleV0pIHtcbiAgICAgICAgICAgIHRoaXMucHJvcHNba2V5XSA9IHRoaXMuaC5wYXJzZVVuaXQodGhpcy5wcm9wc1trZXldKS5zdHJpbmc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmguc3Ryb2tlRGFzaFByb3BzTWFwW2tleV0pIHtcbiAgICAgICAgICAgIHByb3BlcnR5ID0gdGhpcy5wcm9wc1trZXldO1xuICAgICAgICAgICAgdmFsdWUgPSBbXTtcbiAgICAgICAgICAgIHN3aXRjaCAodHlwZW9mIHByb3BlcnR5KSB7XG4gICAgICAgICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAgICAgdmFsdWUucHVzaCh0aGlzLmgucGFyc2VVbml0KHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAgICAgYXJyYXkgPSB0aGlzLnByb3BzW2tleV0uc3BsaXQoJyAnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBhcnJheS5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICAgICAgICAgIHVuaXQgPSBhcnJheVtpXTtcbiAgICAgICAgICAgICAgICAgIHZhbHVlLnB1c2godGhpcy5oLnBhcnNlVW5pdCh1bml0KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5wcm9wc1trZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaXNTa2lwRGVsdGEgfHwgdGhpcy5nZXREZWx0YShrZXksIG9wdGlvbnNWYWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5vblVwZGF0ZSA9IHRoaXMucHJvcHMub25VcGRhdGU7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmlzRGVsdGEgPSBmdW5jdGlvbihvcHRpb25zVmFsdWUpIHtcbiAgICAgIHZhciBpc09iamVjdDtcbiAgICAgIGlzT2JqZWN0ID0gKG9wdGlvbnNWYWx1ZSAhPSBudWxsKSAmJiAodHlwZW9mIG9wdGlvbnNWYWx1ZSA9PT0gJ29iamVjdCcpO1xuICAgICAgaXNPYmplY3QgPSBpc09iamVjdCAmJiAhb3B0aW9uc1ZhbHVlLnVuaXQ7XG4gICAgICByZXR1cm4gISghaXNPYmplY3QgfHwgdGhpcy5oLmlzQXJyYXkob3B0aW9uc1ZhbHVlKSB8fCBoLmlzRE9NKG9wdGlvbnNWYWx1ZSkpO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5nZXREZWx0YSA9IGZ1bmN0aW9uKGtleSwgb3B0aW9uc1ZhbHVlKSB7XG4gICAgICB2YXIgZGVsdGEsIF9yZWY7XG4gICAgICBpZiAoKGtleSA9PT0gJ3gnIHx8IGtleSA9PT0gJ3knKSAmJiAhdGhpcy5vLmN0eCkge1xuICAgICAgICB0aGlzLmgud2FybignQ29uc2lkZXIgdG8gYW5pbWF0ZSBzaGlmdFgvc2hpZnRZIHByb3BlcnRpZXMgaW5zdGVhZCBvZiB4L3ksIGFzIGl0IHdvdWxkIGJlIG11Y2ggbW9yZSBwZXJmb3JtYW50Jywgb3B0aW9uc1ZhbHVlKTtcbiAgICAgIH1cbiAgICAgIGlmICgoX3JlZiA9IHRoaXMuc2tpcFByb3BzRGVsdGEpICE9IG51bGwgPyBfcmVmW2tleV0gOiB2b2lkIDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZGVsdGEgPSB0aGlzLmgucGFyc2VEZWx0YShrZXksIG9wdGlvbnNWYWx1ZSwgdGhpcy5kZWZhdWx0c1trZXldKTtcbiAgICAgIGlmIChkZWx0YS50eXBlICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWx0YXNba2V5XSA9IGRlbHRhO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucHJvcHNba2V5XSA9IGRlbHRhLnN0YXJ0O1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5tZXJnZVRoZW5PcHRpb25zID0gZnVuY3Rpb24oc3RhcnQsIGVuZCkge1xuICAgICAgdmFyIGVuZFZhbHVlLCBpLCBpc0Z1bmN0aW9uLCBrZXksIGtleXMsIG8sIHN0YXJ0S2V5LCBzdGFydEtleXMsIHZhbHVlO1xuICAgICAgbyA9IHt9O1xuICAgICAgZm9yIChrZXkgaW4gc3RhcnQpIHtcbiAgICAgICAgdmFsdWUgPSBzdGFydFtrZXldO1xuICAgICAgICBpZiAoIXRoaXMuaC50d2Vlbk9wdGlvbk1hcFtrZXldICYmICF0aGlzLmguY2FsbGJhY2tzTWFwW2tleV0gfHwga2V5ID09PSAnZHVyYXRpb24nKSB7XG4gICAgICAgICAgb1trZXldID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb1trZXldID0ga2V5ID09PSAnZWFzaW5nJyA/ICcnIDogdm9pZCAwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBrZXlzID0gT2JqZWN0LmtleXMoZW5kKTtcbiAgICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgZW5kVmFsdWUgPSBlbmRba2V5XTtcbiAgICAgICAgaXNGdW5jdGlvbiA9IHR5cGVvZiBlbmRWYWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgICAgaWYgKHRoaXMuaC50d2Vlbk9wdGlvbk1hcFtrZXldIHx8IHR5cGVvZiBlbmRWYWx1ZSA9PT0gJ29iamVjdCcgfHwgaXNGdW5jdGlvbikge1xuICAgICAgICAgIG9ba2V5XSA9IGVuZFZhbHVlICE9IG51bGwgPyBlbmRWYWx1ZSA6IHN0YXJ0W2tleV07XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgc3RhcnRLZXkgPSBzdGFydFtrZXldO1xuICAgICAgICBpZiAoc3RhcnRLZXkgPT0gbnVsbCkge1xuICAgICAgICAgIHN0YXJ0S2V5ID0gdGhpcy5kZWZhdWx0c1trZXldO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoa2V5ID09PSAncmFkaXVzWCcgfHwga2V5ID09PSAncmFkaXVzWScpICYmIChzdGFydEtleSA9PSBudWxsKSkge1xuICAgICAgICAgIHN0YXJ0S2V5ID0gc3RhcnQucmFkaXVzO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygc3RhcnRLZXkgPT09ICdvYmplY3QnICYmIChzdGFydEtleSAhPSBudWxsKSkge1xuICAgICAgICAgIHN0YXJ0S2V5cyA9IE9iamVjdC5rZXlzKHN0YXJ0S2V5KTtcbiAgICAgICAgICBzdGFydEtleSA9IHN0YXJ0S2V5W3N0YXJ0S2V5c1swXV07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZFZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICBvW2tleV0gPSB7fTtcbiAgICAgICAgICBvW2tleV1bc3RhcnRLZXldID0gZW5kVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGksIGl0LCBrZXlzLCBsZW4sIG1lcmdlZCwgb3B0cztcbiAgICAgIGlmICgobyA9PSBudWxsKSB8fCAhT2JqZWN0LmtleXMobykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbWVyZ2VkID0gdGhpcy5tZXJnZVRoZW5PcHRpb25zKHRoaXMuaGlzdG9yeVt0aGlzLmhpc3RvcnkubGVuZ3RoIC0gMV0sIG8pO1xuICAgICAgdGhpcy5oaXN0b3J5LnB1c2gobWVyZ2VkKTtcbiAgICAgIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmgudHdlZW5PcHRpb25NYXApO1xuICAgICAgaSA9IGtleXMubGVuZ3RoO1xuICAgICAgb3B0cyA9IHt9O1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBvcHRzW2tleXNbaV1dID0gbWVyZ2VkW2tleXNbaV1dO1xuICAgICAgfVxuICAgICAgaXQgPSB0aGlzO1xuICAgICAgbGVuID0gaXQuaGlzdG9yeS5sZW5ndGg7XG4gICAgICAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIChmdW5jdGlvbihsZW4pIHtcbiAgICAgICAgICBvcHRzLm9uVXBkYXRlID0gZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLnNldFByb2dyZXNzKHApO1xuICAgICAgICAgIH07XG4gICAgICAgICAgb3B0cy5vblN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICAgIHJldHVybiAoX3JlZiA9IF90aGlzLnByb3BzLm9uU3RhcnQpICE9IG51bGwgPyBfcmVmLmFwcGx5KF90aGlzKSA6IHZvaWQgMDtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG9wdHMub25Db21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vbkNvbXBsZXRlKSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBvcHRzLm9uRmlyc3RVcGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBpdC50dW5lT3B0aW9ucyhpdC5oaXN0b3J5W3RoaXMuaW5kZXhdKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG9wdHMuaXNDaGFpbmVkID0gIW8uZGVsYXk7XG4gICAgICAgICAgcmV0dXJuIF90aGlzLnRpbWVsaW5lLmFwcGVuZChuZXcgVHdlZW4ob3B0cykpO1xuICAgICAgICB9KTtcbiAgICAgIH0pKHRoaXMpKGxlbik7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUudHVuZU9wdGlvbnMgPSBmdW5jdGlvbihvKSB7XG4gICAgICB0aGlzLmV4dGVuZERlZmF1bHRzKG8pO1xuICAgICAgdGhpcy5jYWxjU2l6ZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuc2V0RWxTdHlsZXMoKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuY3JlYXRlVHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpdDtcbiAgICAgIGl0ID0gdGhpcztcbiAgICAgIHRoaXMuY3JlYXRlVGltZWxpbmUoKTtcbiAgICAgIHRoaXMudGltZWxpbmUgPSBuZXcgVGltZWxpbmUoe1xuICAgICAgICBvbkNvbXBsZXRlOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICAgICFfdGhpcy5vLmlzU2hvd0VuZCAmJiBfdGhpcy5oaWRlKCk7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vbkNvbXBsZXRlKSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcylcbiAgICAgIH0pO1xuICAgICAgdGhpcy50aW1lbGluZS5hZGQodGhpcy50d2Vlbik7XG4gICAgICByZXR1cm4gIXRoaXMuby5pc1J1bkxlc3MgJiYgdGhpcy5zdGFydFR3ZWVuKCk7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNyZWF0ZVRpbWVsaW5lID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50d2VlbiA9IG5ldyBUd2Vlbih7XG4gICAgICAgIGR1cmF0aW9uOiB0aGlzLnByb3BzLmR1cmF0aW9uLFxuICAgICAgICBkZWxheTogdGhpcy5wcm9wcy5kZWxheSxcbiAgICAgICAgcmVwZWF0OiB0aGlzLnByb3BzLnJlcGVhdCxcbiAgICAgICAgeW95bzogdGhpcy5wcm9wcy55b3lvLFxuICAgICAgICBlYXNpbmc6IHRoaXMucHJvcHMuZWFzaW5nLFxuICAgICAgICBvblVwZGF0ZTogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5zZXRQcm9ncmVzcyhwKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSxcbiAgICAgICAgb25TdGFydDogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgICBfdGhpcy5zaG93KCk7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vblN0YXJ0KSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uRmlyc3RVcGRhdGVCYWNrd2FyZDogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLmhpc3RvcnkubGVuZ3RoID4gMSAmJiBfdGhpcy50dW5lT3B0aW9ucyhfdGhpcy5oaXN0b3J5WzBdKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSxcbiAgICAgICAgb25SZXZlcnNlQ29tcGxldGU6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgICAgIV90aGlzLm8uaXNTaG93SW5pdCAmJiBfdGhpcy5oaWRlKCk7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vblJldmVyc2VDb21wbGV0ZSkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGtleSwga2V5cywgbGVuO1xuICAgICAgdGhpcy5ydW5Db3VudCsrO1xuICAgICAgaWYgKG8gJiYgT2JqZWN0LmtleXMobykubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0aGlzLmhpc3RvcnkubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhvKTtcbiAgICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICAgIGtleSA9IGtleXNbbGVuXTtcbiAgICAgICAgICAgIGlmIChoLmNhbGxiYWNrc01hcFtrZXldIHx8IGgudHdlZW5PcHRpb25NYXBba2V5XSkge1xuICAgICAgICAgICAgICBoLndhcm4oXCJ0aGUgcHJvcGVydHkgXFxcIlwiICsga2V5ICsgXCJcXFwiIHByb3BlcnR5IGNhbiBub3QgYmUgb3ZlcnJpZGRlbiBvbiBydW4gd2l0aCBcXFwidGhlblxcXCIgY2hhaW4geWV0XCIpO1xuICAgICAgICAgICAgICBkZWxldGUgb1trZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRyYW5zZm9ybUhpc3Rvcnkobyk7XG4gICAgICAgIHRoaXMudHVuZU5ld09wdGlvbihvKTtcbiAgICAgICAgbyA9IHRoaXMuaC5jbG9uZU9iaih0aGlzLm8pO1xuICAgICAgICB0aGlzLmguZXh0ZW5kKG8sIHRoaXMuZGVmYXVsdHMpO1xuICAgICAgICB0aGlzLmhpc3RvcnlbMF0gPSBvO1xuICAgICAgICAhdGhpcy5vLmlzRHJhd0xlc3MgJiYgdGhpcy5zZXRQcm9ncmVzcygwLCB0cnVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudHVuZU5ld09wdGlvbih0aGlzLmhpc3RvcnlbMF0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RhcnRUd2VlbigpO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS50cmFuc2Zvcm1IaXN0b3J5ID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGhpc3RvcnlMZW4sIGksIGosIGtleSwga2V5cywgbGVuLCBvcHRpb25SZWNvcmQsIHZhbHVlLCB2YWx1ZTIsIHZhbHVlS2V5cywgdmFsdWVLZXlzMiwgX3Jlc3VsdHM7XG4gICAgICBrZXlzID0gT2JqZWN0LmtleXMobyk7XG4gICAgICBpID0gLTE7XG4gICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgIGhpc3RvcnlMZW4gPSB0aGlzLmhpc3RvcnkubGVuZ3RoO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlICgrK2kgPCBsZW4pIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgaiA9IDA7XG4gICAgICAgIF9yZXN1bHRzLnB1c2goKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBfcmVzdWx0czE7XG4gICAgICAgICAgX3Jlc3VsdHMxID0gW107XG4gICAgICAgICAgd2hpbGUgKCsraiA8IGhpc3RvcnlMZW4pIHtcbiAgICAgICAgICAgIG9wdGlvblJlY29yZCA9IHRoaXMuaGlzdG9yeVtqXVtrZXldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25SZWNvcmQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIHZhbHVlS2V5cyA9IE9iamVjdC5rZXlzKG9wdGlvblJlY29yZCk7XG4gICAgICAgICAgICAgIHZhbHVlID0gb3B0aW9uUmVjb3JkW3ZhbHVlS2V5c1swXV07XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmhpc3Rvcnlbal1ba2V5XVt2YWx1ZUtleXNbMF1dO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIG9ba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZUtleXMyID0gT2JqZWN0LmtleXMob1trZXldKTtcbiAgICAgICAgICAgICAgICB2YWx1ZTIgPSBvW2tleV1bdmFsdWVLZXlzMlswXV07XG4gICAgICAgICAgICAgICAgdGhpcy5oaXN0b3J5W2pdW2tleV1bdmFsdWUyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuaGlzdG9yeVtqXVtrZXldW29ba2V5XV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIF9yZXN1bHRzMS5wdXNoKHRoaXMuaGlzdG9yeVtqXVtrZXldID0gb1trZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIF9yZXN1bHRzMTtcbiAgICAgICAgfSkuY2FsbCh0aGlzKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnR1bmVOZXdPcHRpb24gPSBmdW5jdGlvbihvLCBpc0ZvcmVpZ24pIHtcbiAgICAgIGlmICgobyAhPSBudWxsKSAmJiAoby50eXBlICE9IG51bGwpICYmIG8udHlwZSAhPT0gKHRoaXMuby50eXBlIHx8IHRoaXMudHlwZSkpIHtcbiAgICAgICAgdGhpcy5oLndhcm4oJ1NvcnJ5LCB0eXBlIGNhbiBub3QgYmUgY2hhbmdlZCBvbiBydW4nKTtcbiAgICAgICAgZGVsZXRlIG8udHlwZTtcbiAgICAgIH1cbiAgICAgIGlmICgobyAhPSBudWxsKSAmJiBPYmplY3Qua2V5cyhvKS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5leHRlbmREZWZhdWx0cyhvKTtcbiAgICAgICAgdGhpcy5yZXNldFRpbWVsaW5lKCk7XG4gICAgICAgICFpc0ZvcmVpZ24gJiYgdGhpcy50aW1lbGluZS5yZWNhbGNEdXJhdGlvbigpO1xuICAgICAgICB0aGlzLmNhbGNTaXplKCk7XG4gICAgICAgIHJldHVybiAhaXNGb3JlaWduICYmIHRoaXMuc2V0RWxTdHlsZXMoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuc3RhcnRUd2VlbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHNldFRpbWVvdXQoKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMudGltZWxpbmUpICE9IG51bGwgPyBfcmVmLnN0YXJ0KCkgOiB2b2lkIDA7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSksIDEpO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5yZXNldFRpbWVsaW5lID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwga2V5LCB0aW1lbGluZU9wdGlvbnMsIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgdGltZWxpbmVPcHRpb25zID0ge307XG4gICAgICBfcmVmID0gT2JqZWN0LmtleXModGhpcy5oLnR3ZWVuT3B0aW9uTWFwKTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IF9yZWYubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgIGtleSA9IF9yZWZbaV07XG4gICAgICAgIHRpbWVsaW5lT3B0aW9uc1trZXldID0gdGhpcy5wcm9wc1trZXldO1xuICAgICAgfVxuICAgICAgdGltZWxpbmVPcHRpb25zLm9uU3RhcnQgPSB0aGlzLnByb3BzLm9uU3RhcnQ7XG4gICAgICB0aW1lbGluZU9wdGlvbnMub25Db21wbGV0ZSA9IHRoaXMucHJvcHMub25Db21wbGV0ZTtcbiAgICAgIHJldHVybiB0aGlzLnR3ZWVuLnNldFByb3AodGltZWxpbmVPcHRpb25zKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZ2V0Qml0TGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnByb3BzLmJpdExlbmd0aCA9IHRoaXMuYml0LmdldExlbmd0aCgpO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuYml0TGVuZ3RoO1xuICAgIH07XG5cbiAgICByZXR1cm4gVHJhbnNpdDtcblxuICB9KShiaXRzTWFwLm1hcC5iaXQpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gVHJhbnNpdDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIFRpbWVsaW5lLCBoLCB0LFxuICAgIF9fc2xpY2UgPSBbXS5zbGljZTtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIHQgPSByZXF1aXJlKCcuL3R3ZWVuZXInKTtcblxuICBUaW1lbGluZSA9IChmdW5jdGlvbigpIHtcbiAgICBUaW1lbGluZS5wcm90b3R5cGUuc3RhdGUgPSAnc3RvcCc7XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuZGVmYXVsdHMgPSB7XG4gICAgICByZXBlYXQ6IDAsXG4gICAgICBkZWxheTogMFxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBUaW1lbGluZShvKSB7XG4gICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICAgIHRoaXMuX2V4dGVuZERlZmF1bHRzKCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnRpbWVsaW5lcyA9IFtdO1xuICAgICAgdGhpcy5wcm9wcyA9IHtcbiAgICAgICAgdGltZTogMCxcbiAgICAgICAgcmVwZWF0VGltZTogMCxcbiAgICAgICAgc2hpZnRlZFJlcGVhdFRpbWU6IDBcbiAgICAgIH07XG4gICAgICB0aGlzLmxvb3AgPSBoLmJpbmQodGhpcy5sb29wLCB0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzLm9uVXBkYXRlID0gdGhpcy5vLm9uVXBkYXRlO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncztcbiAgICAgIGFyZ3MgPSAxIDw9IGFyZ3VtZW50cy5sZW5ndGggPyBfX3NsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSA6IFtdO1xuICAgICAgdGhpcy5wdXNoVGltZWxpbmVBcnJheShhcmdzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucHVzaFRpbWVsaW5lQXJyYXkgPSBmdW5jdGlvbihhcnJheSkge1xuICAgICAgdmFyIGksIHRtLCBfaSwgX2xlbiwgX3Jlc3VsdHM7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gYXJyYXkubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgIHRtID0gYXJyYXlbaV07XG4gICAgICAgIGlmIChoLmlzQXJyYXkodG0pKSB7XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnB1c2hUaW1lbGluZUFycmF5KHRtKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnB1c2hUaW1lbGluZSh0bSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5fZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBrZXksIHZhbHVlLCBfcmVmLCBfcmVzdWx0cztcbiAgICAgIF9yZWYgPSB0aGlzLmRlZmF1bHRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoa2V5IGluIF9yZWYpIHtcbiAgICAgICAgdmFsdWUgPSBfcmVmW2tleV07XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wcm9wc1trZXldID0gdGhpcy5vW2tleV0gIT0gbnVsbCA/IHRoaXMub1trZXldIDogdmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuc2V0UHJvcCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZTtcbiAgICAgIGZvciAoa2V5IGluIHByb3BzKSB7XG4gICAgICAgIHZhbHVlID0gcHJvcHNba2V5XTtcbiAgICAgICAgdGhpcy5wcm9wc1trZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5yZWNhbGNEdXJhdGlvbigpO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucHVzaFRpbWVsaW5lID0gZnVuY3Rpb24odGltZWxpbmUsIHNoaWZ0KSB7XG4gICAgICBpZiAodGltZWxpbmUudGltZWxpbmUgaW5zdGFuY2VvZiBUaW1lbGluZSkge1xuICAgICAgICB0aW1lbGluZSA9IHRpbWVsaW5lLnRpbWVsaW5lO1xuICAgICAgfVxuICAgICAgKHNoaWZ0ICE9IG51bGwpICYmIHRpbWVsaW5lLnNldFByb3Aoe1xuICAgICAgICAnc2hpZnRUaW1lJzogc2hpZnRcbiAgICAgIH0pO1xuICAgICAgdGhpcy50aW1lbGluZXMucHVzaCh0aW1lbGluZSk7XG4gICAgICByZXR1cm4gdGhpcy5fcmVjYWxjVGltZWxpbmVEdXJhdGlvbih0aW1lbGluZSk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbih0aW1lbGluZSkge1xuICAgICAgdmFyIGluZGV4O1xuICAgICAgaW5kZXggPSB0aGlzLnRpbWVsaW5lcy5pbmRleE9mKHRpbWVsaW5lKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGltZWxpbmVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCB0aW1lbGluZSwgdG0sIF9pLCBfbGVuO1xuICAgICAgdGltZWxpbmUgPSAxIDw9IGFyZ3VtZW50cy5sZW5ndGggPyBfX3NsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSA6IFtdO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gdGltZWxpbmUubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgIHRtID0gdGltZWxpbmVbaV07XG4gICAgICAgIGlmIChoLmlzQXJyYXkodG0pKSB7XG4gICAgICAgICAgdGhpcy5fYXBwZW5kVGltZWxpbmVBcnJheSh0bSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5hcHBlbmRUaW1lbGluZSh0bSwgdGhpcy50aW1lbGluZXMubGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5fYXBwZW5kVGltZWxpbmVBcnJheSA9IGZ1bmN0aW9uKHRpbWVsaW5lQXJyYXkpIHtcbiAgICAgIHZhciBpLCBsZW4sIHRpbWUsIF9yZXN1bHRzO1xuICAgICAgaSA9IHRpbWVsaW5lQXJyYXkubGVuZ3RoO1xuICAgICAgdGltZSA9IHRoaXMucHJvcHMucmVwZWF0VGltZSAtIHRoaXMucHJvcHMuZGVsYXk7XG4gICAgICBsZW4gPSB0aGlzLnRpbWVsaW5lcy5sZW5ndGg7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMuYXBwZW5kVGltZWxpbmUodGltZWxpbmVBcnJheVtpXSwgbGVuLCB0aW1lKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5hcHBlbmRUaW1lbGluZSA9IGZ1bmN0aW9uKHRpbWVsaW5lLCBpbmRleCwgdGltZSkge1xuICAgICAgdmFyIHNoaWZ0O1xuICAgICAgc2hpZnQgPSAodGltZSAhPSBudWxsID8gdGltZSA6IHRoaXMucHJvcHMudGltZSk7XG4gICAgICBzaGlmdCArPSB0aW1lbGluZS5wcm9wcy5zaGlmdFRpbWUgfHwgMDtcbiAgICAgIHRpbWVsaW5lLmluZGV4ID0gaW5kZXg7XG4gICAgICByZXR1cm4gdGhpcy5wdXNoVGltZWxpbmUodGltZWxpbmUsIHNoaWZ0KTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnJlY2FsY0R1cmF0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGVuLCBfcmVzdWx0cztcbiAgICAgIGxlbiA9IHRoaXMudGltZWxpbmVzLmxlbmd0aDtcbiAgICAgIHRoaXMucHJvcHMudGltZSA9IDA7XG4gICAgICB0aGlzLnByb3BzLnJlcGVhdFRpbWUgPSAwO1xuICAgICAgdGhpcy5wcm9wcy5zaGlmdGVkUmVwZWF0VGltZSA9IDA7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5fcmVjYWxjVGltZWxpbmVEdXJhdGlvbih0aGlzLnRpbWVsaW5lc1tsZW5dKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5fcmVjYWxjVGltZWxpbmVEdXJhdGlvbiA9IGZ1bmN0aW9uKHRpbWVsaW5lKSB7XG4gICAgICB2YXIgdGltZWxpbmVUaW1lO1xuICAgICAgdGltZWxpbmVUaW1lID0gdGltZWxpbmUucHJvcHMucmVwZWF0VGltZSArICh0aW1lbGluZS5wcm9wcy5zaGlmdFRpbWUgfHwgMCk7XG4gICAgICB0aGlzLnByb3BzLnRpbWUgPSBNYXRoLm1heCh0aW1lbGluZVRpbWUsIHRoaXMucHJvcHMudGltZSk7XG4gICAgICB0aGlzLnByb3BzLnJlcGVhdFRpbWUgPSAodGhpcy5wcm9wcy50aW1lICsgdGhpcy5wcm9wcy5kZWxheSkgKiAodGhpcy5wcm9wcy5yZXBlYXQgKyAxKTtcbiAgICAgIHRoaXMucHJvcHMuc2hpZnRlZFJlcGVhdFRpbWUgPSB0aGlzLnByb3BzLnJlcGVhdFRpbWUgKyAodGhpcy5wcm9wcy5zaGlmdFRpbWUgfHwgMCk7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy5zaGlmdGVkUmVwZWF0VGltZSAtPSB0aGlzLnByb3BzLmRlbGF5O1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24odGltZSwgaXNHcm93KSB7XG4gICAgICBpZiAodGltZSA+IHRoaXMucHJvcHMuZW5kVGltZSkge1xuICAgICAgICB0aW1lID0gdGhpcy5wcm9wcy5lbmRUaW1lO1xuICAgICAgfVxuICAgICAgaWYgKHRpbWUgPT09IHRoaXMucHJvcHMuZW5kVGltZSAmJiB0aGlzLmlzQ29tcGxldGVkKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5fdXBkYXRlVGltZWxpbmVzKHRpbWUsIGlzR3Jvdyk7XG4gICAgICByZXR1cm4gdGhpcy5fY2hlY2tDYWxsYmFja3ModGltZSk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5fdXBkYXRlVGltZWxpbmVzID0gZnVuY3Rpb24odGltZSwgaXNHcm93KSB7XG4gICAgICB2YXIgZWxhcHNlZCwgaSwgbGVuLCBzdGFydFBvaW50LCB0aW1lVG9UaW1lbGluZXM7XG4gICAgICBzdGFydFBvaW50ID0gdGhpcy5wcm9wcy5zdGFydFRpbWUgLSB0aGlzLnByb3BzLmRlbGF5O1xuICAgICAgZWxhcHNlZCA9ICh0aW1lIC0gc3RhcnRQb2ludCkgJSAodGhpcy5wcm9wcy5kZWxheSArIHRoaXMucHJvcHMudGltZSk7XG4gICAgICB0aW1lVG9UaW1lbGluZXMgPSB0aW1lID09PSB0aGlzLnByb3BzLmVuZFRpbWUgPyB0aGlzLnByb3BzLmVuZFRpbWUgOiBzdGFydFBvaW50ICsgZWxhcHNlZCA+PSB0aGlzLnByb3BzLnN0YXJ0VGltZSA/IHRpbWUgPj0gdGhpcy5wcm9wcy5lbmRUaW1lID8gdGhpcy5wcm9wcy5lbmRUaW1lIDogc3RhcnRQb2ludCArIGVsYXBzZWQgOiB0aW1lID4gdGhpcy5wcm9wcy5zdGFydFRpbWUgKyB0aGlzLnByb3BzLnRpbWUgPyB0aGlzLnByb3BzLnN0YXJ0VGltZSArIHRoaXMucHJvcHMudGltZSA6IG51bGw7XG4gICAgICBpZiAodGltZVRvVGltZWxpbmVzICE9IG51bGwpIHtcbiAgICAgICAgaSA9IC0xO1xuICAgICAgICBsZW4gPSB0aGlzLnRpbWVsaW5lcy5sZW5ndGggLSAxO1xuICAgICAgICB3aGlsZSAoaSsrIDwgbGVuKSB7XG4gICAgICAgICAgaWYgKGlzR3JvdyA9PSBudWxsKSB7XG4gICAgICAgICAgICBpc0dyb3cgPSB0aW1lID4gKHRoaXMuX3ByZXZpb3VzVXBkYXRlVGltZSB8fCAwKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy50aW1lbGluZXNbaV0udXBkYXRlKHRpbWVUb1RpbWVsaW5lcywgaXNHcm93KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX3ByZXZpb3VzVXBkYXRlVGltZSA9IHRpbWU7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5fY2hlY2tDYWxsYmFja3MgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICB2YXIgX3JlZiwgX3JlZjEsIF9yZWYyO1xuICAgICAgaWYgKHRoaXMucHJldlRpbWUgPT09IHRpbWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLnByZXZUaW1lIHx8IHRoaXMuaXNDb21wbGV0ZWQgJiYgIXRoaXMuaXNTdGFydGVkKSB7XG4gICAgICAgIGlmICgoX3JlZiA9IHRoaXMuby5vblN0YXJ0KSAhPSBudWxsKSB7XG4gICAgICAgICAgX3JlZi5hcHBseSh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlzU3RhcnRlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuaXNDb21wbGV0ZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aW1lID49IHRoaXMucHJvcHMuc3RhcnRUaW1lICYmIHRpbWUgPCB0aGlzLnByb3BzLmVuZFRpbWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB0aGlzLm9uVXBkYXRlKCh0aW1lIC0gdGhpcy5wcm9wcy5zdGFydFRpbWUpIC8gdGhpcy5wcm9wcy5yZXBlYXRUaW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMucHJldlRpbWUgPiB0aW1lICYmIHRpbWUgPD0gdGhpcy5wcm9wcy5zdGFydFRpbWUpIHtcbiAgICAgICAgaWYgKChfcmVmMSA9IHRoaXMuby5vblJldmVyc2VDb21wbGV0ZSkgIT0gbnVsbCkge1xuICAgICAgICAgIF9yZWYxLmFwcGx5KHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLnByZXZUaW1lID0gdGltZTtcbiAgICAgIGlmICh0aW1lID09PSB0aGlzLnByb3BzLmVuZFRpbWUgJiYgIXRoaXMuaXNDb21wbGV0ZWQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB0aGlzLm9uVXBkYXRlKDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoX3JlZjIgPSB0aGlzLm8ub25Db21wbGV0ZSkgIT0gbnVsbCkge1xuICAgICAgICAgIF9yZWYyLmFwcGx5KHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaXNDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgdGhpcy5zZXRTdGFydFRpbWUodGltZSk7XG4gICAgICAhdGltZSAmJiAodC5hZGQodGhpcyksIHRoaXMuc3RhdGUgPSAncGxheScpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5yZW1vdmVGcm9tVHdlZW5lcigpO1xuICAgICAgdGhpcy5zdGF0ZSA9ICdwYXVzZSc7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnN0b3AgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVtb3ZlRnJvbVR3ZWVuZXIoKTtcbiAgICAgIHRoaXMuc2V0UHJvZ3Jlc3MoMCk7XG4gICAgICB0aGlzLnN0YXRlID0gJ3N0b3AnO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5yZXN0YXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnN0b3AoKTtcbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0KCk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5yZW1vdmVGcm9tVHdlZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdC5yZW1vdmUodGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnNldFN0YXJ0VGltZSA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHRoaXMuZ2V0RGltZW50aW9ucyh0aW1lKTtcbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0VGltZWxpbmVzKHRoaXMucHJvcHMuc3RhcnRUaW1lKTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnN0YXJ0VGltZWxpbmVzID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgdmFyIGksIF9yZXN1bHRzO1xuICAgICAgaSA9IHRoaXMudGltZWxpbmVzLmxlbmd0aDtcbiAgICAgICh0aW1lID09IG51bGwpICYmICh0aW1lID0gdGhpcy5wcm9wcy5zdGFydFRpbWUpO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnRpbWVsaW5lc1tpXS5zdGFydCh0aW1lKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5zZXRQcm9ncmVzcyA9IGZ1bmN0aW9uKHByb2dyZXNzKSB7XG4gICAgICBpZiAodGhpcy5wcm9wcy5zdGFydFRpbWUgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnNldFN0YXJ0VGltZSgpO1xuICAgICAgfVxuICAgICAgcHJvZ3Jlc3MgPSBoLmNsYW1wKHByb2dyZXNzLCAwLCAxKTtcbiAgICAgIHJldHVybiB0aGlzLnVwZGF0ZSh0aGlzLnByb3BzLnN0YXJ0VGltZSArIHByb2dyZXNzICogdGhpcy5wcm9wcy5yZXBlYXRUaW1lKTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLmdldERpbWVudGlvbnMgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICBpZiAodGltZSA9PSBudWxsKSB7XG4gICAgICAgIHRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvcHMuc3RhcnRUaW1lID0gdGltZSArIHRoaXMucHJvcHMuZGVsYXkgKyAodGhpcy5wcm9wcy5zaGlmdFRpbWUgfHwgMCk7XG4gICAgICB0aGlzLnByb3BzLmVuZFRpbWUgPSB0aGlzLnByb3BzLnN0YXJ0VGltZSArIHRoaXMucHJvcHMuc2hpZnRlZFJlcGVhdFRpbWU7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy5lbmRUaW1lIC09IHRoaXMucHJvcHMuc2hpZnRUaW1lIHx8IDA7XG4gICAgfTtcblxuICAgIHJldHVybiBUaW1lbGluZTtcblxuICB9KSgpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gVGltZWxpbmU7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBUd2VlbiwgZWFzaW5nLCBoLCB0O1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgdCA9IHJlcXVpcmUoJy4vdHdlZW5lcicpO1xuXG4gIGVhc2luZyA9IHJlcXVpcmUoJy4uL2Vhc2luZy9lYXNpbmcnKTtcblxuICBUd2VlbiA9IChmdW5jdGlvbigpIHtcbiAgICBUd2Vlbi5wcm90b3R5cGUuZGVmYXVsdHMgPSB7XG4gICAgICBkdXJhdGlvbjogNjAwLFxuICAgICAgZGVsYXk6IDAsXG4gICAgICByZXBlYXQ6IDAsXG4gICAgICB5b3lvOiBmYWxzZSxcbiAgICAgIGVhc2luZzogJ0xpbmVhci5Ob25lJyxcbiAgICAgIG9uU3RhcnQ6IG51bGwsXG4gICAgICBvbkNvbXBsZXRlOiBudWxsLFxuICAgICAgb25SZXZlcnNlQ29tcGxldGU6IG51bGwsXG4gICAgICBvbkZpcnN0VXBkYXRlOiBudWxsLFxuICAgICAgb25VcGRhdGU6IG51bGwsXG4gICAgICBvbkZpcnN0VXBkYXRlQmFja3dhcmQ6IG51bGwsXG4gICAgICBpc0NoYWluZWQ6IGZhbHNlXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIFR3ZWVuKG8pIHtcbiAgICAgIHRoaXMubyA9IG8gIT0gbnVsbCA/IG8gOiB7fTtcbiAgICAgIHRoaXMuZXh0ZW5kRGVmYXVsdHMoKTtcbiAgICAgIHRoaXMudmFycygpO1xuICAgICAgdGhpcztcbiAgICB9XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5oID0gaDtcbiAgICAgIHRoaXMucHJvZ3Jlc3MgPSAwO1xuICAgICAgdGhpcy5wcmV2VGltZSA9IDA7XG4gICAgICByZXR1cm4gdGhpcy5jYWxjRGltZW50aW9ucygpO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuY2FsY0RpbWVudGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucHJvcHMudGltZSA9IHRoaXMucHJvcHMuZHVyYXRpb24gKyB0aGlzLnByb3BzLmRlbGF5O1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMucmVwZWF0VGltZSA9IHRoaXMucHJvcHMudGltZSAqICh0aGlzLnByb3BzLnJlcGVhdCArIDEpO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuZXh0ZW5kRGVmYXVsdHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBrZXksIHZhbHVlLCBfcmVmO1xuICAgICAgdGhpcy5wcm9wcyA9IHt9O1xuICAgICAgX3JlZiA9IHRoaXMuZGVmYXVsdHM7XG4gICAgICBmb3IgKGtleSBpbiBfcmVmKSB7XG4gICAgICAgIHZhbHVlID0gX3JlZltrZXldO1xuICAgICAgICB0aGlzLnByb3BzW2tleV0gPSB0aGlzLm9ba2V5XSAhPSBudWxsID8gdGhpcy5vW2tleV0gOiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvcHMuZWFzaW5nID0gZWFzaW5nLnBhcnNlRWFzaW5nKHRoaXMuby5lYXNpbmcgfHwgdGhpcy5kZWZhdWx0cy5lYXNpbmcpO1xuICAgICAgcmV0dXJuIHRoaXMub25VcGRhdGUgPSB0aGlzLnByb3BzLm9uVXBkYXRlO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICB0aGlzLmlzQ29tcGxldGVkID0gZmFsc2U7XG4gICAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgICAgaWYgKHRpbWUgPT0gbnVsbCkge1xuICAgICAgICB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICB9XG4gICAgICB0aGlzLnByb3BzLnN0YXJ0VGltZSA9IHRpbWUgKyB0aGlzLnByb3BzLmRlbGF5ICsgKHRoaXMucHJvcHMuc2hpZnRUaW1lIHx8IDApO1xuICAgICAgdGhpcy5wcm9wcy5lbmRUaW1lID0gdGhpcy5wcm9wcy5zdGFydFRpbWUgKyB0aGlzLnByb3BzLnJlcGVhdFRpbWUgLSB0aGlzLnByb3BzLmRlbGF5O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbih0aW1lLCBpc0dyb3cpIHtcbiAgICAgIHZhciBfcmVmLCBfcmVmMSwgX3JlZjIsIF9yZWYzLCBfcmVmNDtcbiAgICAgIGlmICgodGltZSA+PSB0aGlzLnByb3BzLnN0YXJ0VGltZSkgJiYgKHRpbWUgPCB0aGlzLnByb3BzLmVuZFRpbWUpKSB7XG4gICAgICAgIHRoaXMuaXNPblJldmVyc2VDb21wbGV0ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmlzQ29tcGxldGVkID0gZmFsc2U7XG4gICAgICAgIGlmICghdGhpcy5pc0ZpcnN0VXBkYXRlKSB7XG4gICAgICAgICAgaWYgKChfcmVmID0gdGhpcy5wcm9wcy5vbkZpcnN0VXBkYXRlKSAhPSBudWxsKSB7XG4gICAgICAgICAgICBfcmVmLmFwcGx5KHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmlzRmlyc3RVcGRhdGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5pc1N0YXJ0ZWQpIHtcbiAgICAgICAgICBpZiAoKF9yZWYxID0gdGhpcy5wcm9wcy5vblN0YXJ0KSAhPSBudWxsKSB7XG4gICAgICAgICAgICBfcmVmMS5hcHBseSh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZUluQWN0aXZlQXJlYSh0aW1lKTtcbiAgICAgICAgaWYgKHRpbWUgPCB0aGlzLnByZXZUaW1lICYmICF0aGlzLmlzRmlyc3RVcGRhdGVCYWNrd2FyZCkge1xuICAgICAgICAgIGlmICgoX3JlZjIgPSB0aGlzLnByb3BzLm9uRmlyc3RVcGRhdGVCYWNrd2FyZCkgIT0gbnVsbCkge1xuICAgICAgICAgICAgX3JlZjIuYXBwbHkodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuaXNGaXJzdFVwZGF0ZUJhY2t3YXJkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRpbWUgPj0gdGhpcy5wcm9wcy5lbmRUaW1lICYmICF0aGlzLmlzQ29tcGxldGVkKSB7XG4gICAgICAgICAgdGhpcy5fY29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGltZSA+IHRoaXMucHJvcHMuZW5kVGltZSkge1xuICAgICAgICAgIHRoaXMuaXNGaXJzdFVwZGF0ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aW1lID4gdGhpcy5wcm9wcy5lbmRUaW1lKSB7XG4gICAgICAgICAgdGhpcy5pc0ZpcnN0VXBkYXRlQmFja3dhcmQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRpbWUgPCB0aGlzLnByZXZUaW1lICYmIHRpbWUgPD0gdGhpcy5wcm9wcy5zdGFydFRpbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzRmlyc3RVcGRhdGVCYWNrd2FyZCkge1xuICAgICAgICAgIGlmICgoX3JlZjMgPSB0aGlzLnByb3BzLm9uRmlyc3RVcGRhdGVCYWNrd2FyZCkgIT0gbnVsbCkge1xuICAgICAgICAgICAgX3JlZjMuYXBwbHkodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuaXNGaXJzdFVwZGF0ZUJhY2t3YXJkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNHcm93KSB7XG4gICAgICAgICAgdGhpcy5fY29tcGxldGUoKTtcbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5pc09uUmV2ZXJzZUNvbXBsZXRlKSB7XG4gICAgICAgICAgdGhpcy5pc09uUmV2ZXJzZUNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnNldFByb2dyZXNzKDAsICF0aGlzLnByb3BzLmlzQ2hhaW5lZCk7XG4gICAgICAgICAgaWYgKChfcmVmNCA9IHRoaXMucHJvcHMub25SZXZlcnNlQ29tcGxldGUpICE9IG51bGwpIHtcbiAgICAgICAgICAgIF9yZWY0LmFwcGx5KHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlzRmlyc3RVcGRhdGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJldlRpbWUgPSB0aW1lO1xuICAgICAgcmV0dXJuIHRoaXMuaXNDb21wbGV0ZWQ7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS5fY29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBfcmVmO1xuICAgICAgdGhpcy5zZXRQcm9ncmVzcygxKTtcbiAgICAgIGlmICgoX3JlZiA9IHRoaXMucHJvcHMub25Db21wbGV0ZSkgIT0gbnVsbCkge1xuICAgICAgICBfcmVmLmFwcGx5KHRoaXMpO1xuICAgICAgfVxuICAgICAgdGhpcy5pc0NvbXBsZXRlZCA9IHRydWU7XG4gICAgICB0aGlzLmlzU3RhcnRlZCA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMuaXNPblJldmVyc2VDb21wbGV0ZSA9IGZhbHNlO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuX3VwZGF0ZUluQWN0aXZlQXJlYSA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHZhciBjbnQsIGVsYXBzZWQsIGVsYXBzZWQyLCBwcm9jLCBzdGFydFBvaW50O1xuICAgICAgc3RhcnRQb2ludCA9IHRoaXMucHJvcHMuc3RhcnRUaW1lIC0gdGhpcy5wcm9wcy5kZWxheTtcbiAgICAgIGVsYXBzZWQgPSAodGltZSAtIHN0YXJ0UG9pbnQpICUgKHRoaXMucHJvcHMuZGVsYXkgKyB0aGlzLnByb3BzLmR1cmF0aW9uKTtcbiAgICAgIGNudCA9IE1hdGguZmxvb3IoKHRpbWUgLSBzdGFydFBvaW50KSAvICh0aGlzLnByb3BzLmRlbGF5ICsgdGhpcy5wcm9wcy5kdXJhdGlvbikpO1xuICAgICAgaWYgKHN0YXJ0UG9pbnQgKyBlbGFwc2VkID49IHRoaXMucHJvcHMuc3RhcnRUaW1lKSB7XG4gICAgICAgIGVsYXBzZWQyID0gKHRpbWUgLSB0aGlzLnByb3BzLnN0YXJ0VGltZSkgJSAodGhpcy5wcm9wcy5kZWxheSArIHRoaXMucHJvcHMuZHVyYXRpb24pO1xuICAgICAgICBwcm9jID0gZWxhcHNlZDIgLyB0aGlzLnByb3BzLmR1cmF0aW9uO1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRQcm9ncmVzcyghdGhpcy5wcm9wcy55b3lvID8gcHJvYyA6IGNudCAlIDIgPT09IDAgPyBwcm9jIDogMSAtIChwcm9jID09PSAxID8gMCA6IHByb2MpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldFByb2dyZXNzKHRoaXMucHJldlRpbWUgPCB0aW1lID8gMSA6IDApO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuc2V0UHJvZ3Jlc3MgPSBmdW5jdGlvbihwLCBpc0NhbGxiYWNrKSB7XG4gICAgICBpZiAoaXNDYWxsYmFjayA9PSBudWxsKSB7XG4gICAgICAgIGlzQ2FsbGJhY2sgPSB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9ncmVzcyA9IHA7XG4gICAgICB0aGlzLmVhc2VkUHJvZ3Jlc3MgPSB0aGlzLnByb3BzLmVhc2luZyh0aGlzLnByb2dyZXNzKTtcbiAgICAgIGlmICh0aGlzLnByb3BzLnByZXZFYXNlZFByb2dyZXNzICE9PSB0aGlzLmVhc2VkUHJvZ3Jlc3MgJiYgaXNDYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMub25VcGRhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHRoaXMub25VcGRhdGUodGhpcy5lYXNlZFByb2dyZXNzLCB0aGlzLnByb2dyZXNzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucHJvcHMucHJldkVhc2VkUHJvZ3Jlc3MgPSB0aGlzLmVhc2VkUHJvZ3Jlc3M7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS5zZXRQcm9wID0gZnVuY3Rpb24ob2JqLCB2YWx1ZSkge1xuICAgICAgdmFyIGtleSwgdmFsO1xuICAgICAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICAgIHZhbCA9IG9ialtrZXldO1xuICAgICAgICAgIHRoaXMucHJvcHNba2V5XSA9IHZhbDtcbiAgICAgICAgICBpZiAoa2V5ID09PSAnZWFzaW5nJykge1xuICAgICAgICAgICAgdGhpcy5wcm9wcy5lYXNpbmcgPSBlYXNpbmcucGFyc2VFYXNpbmcodGhpcy5wcm9wcy5lYXNpbmcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb2JqID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAob2JqID09PSAnZWFzaW5nJykge1xuICAgICAgICAgIHRoaXMucHJvcHMuZWFzaW5nID0gZWFzaW5nLnBhcnNlRWFzaW5nKHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnByb3BzW29ial0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuY2FsY0RpbWVudGlvbnMoKTtcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHRoaXMuc3RhcnQodGltZSk7XG4gICAgICAhdGltZSAmJiAodC5hZGQodGhpcykpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICB0aGlzLnNldFByb2dyZXNzKDApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fcmVtb3ZlRnJvbVR3ZWVuZXIoKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuX3JlbW92ZUZyb21Ud2VlbmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB0LnJlbW92ZSh0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICByZXR1cm4gVHdlZW47XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFR3ZWVuO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgVHdlZW5lciwgaCwgaSwgdDtcblxuICByZXF1aXJlKCcuLi9wb2x5ZmlsbHMvcmFmJyk7XG5cbiAgcmVxdWlyZSgnLi4vcG9seWZpbGxzL3BlcmZvcm1hbmNlJyk7XG5cbiAgaCA9IHJlcXVpcmUoJy4uL2gnKTtcblxuICBpID0gMDtcblxuICBUd2VlbmVyID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIFR3ZWVuZXIoKSB7XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICAgIHRoaXM7XG4gICAgfVxuXG4gICAgVHdlZW5lci5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy50d2VlbnMgPSBbXTtcbiAgICAgIHJldHVybiB0aGlzLmxvb3AgPSBoLmJpbmQodGhpcy5sb29wLCB0aGlzKTtcbiAgICB9O1xuXG4gICAgVHdlZW5lci5wcm90b3R5cGUubG9vcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHRpbWU7XG4gICAgICBpZiAoIXRoaXMuaXNSdW5uaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgIHRoaXMudXBkYXRlKHRpbWUpO1xuICAgICAgaWYgKCF0aGlzLnR3ZWVucy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNSdW5uaW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5sb29wKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUd2VlbmVyLnByb3RvdHlwZS5zdGFydExvb3AgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmlzUnVubmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmlzUnVubmluZyA9IHRydWU7XG4gICAgICByZXR1cm4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMubG9vcCk7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLnN0b3BMb29wID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgVHdlZW5lci5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgdmFyIF9yZXN1bHRzO1xuICAgICAgaSA9IHRoaXMudHdlZW5zLmxlbmd0aDtcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGlmICh0aGlzLnR3ZWVuc1tpXS51cGRhdGUodGltZSkgPT09IHRydWUpIHtcbiAgICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMucmVtb3ZlKGkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBfcmVzdWx0cy5wdXNoKHZvaWQgMCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICB9O1xuXG4gICAgVHdlZW5lci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24odHdlZW4pIHtcbiAgICAgIHRoaXMudHdlZW5zLnB1c2godHdlZW4pO1xuICAgICAgcmV0dXJuIHRoaXMuc3RhcnRMb29wKCk7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLnJlbW92ZUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMudHdlZW5zLmxlbmd0aCA9IDA7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKHR3ZWVuKSB7XG4gICAgICB2YXIgaW5kZXg7XG4gICAgICBpbmRleCA9IHR5cGVvZiB0d2VlbiA9PT0gJ251bWJlcicgPyB0d2VlbiA6IHRoaXMudHdlZW5zLmluZGV4T2YodHdlZW4pO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICByZXR1cm4gdGhpcy50d2VlbnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIFR3ZWVuZXI7XG5cbiAgfSkoKTtcblxuICB0ID0gbmV3IFR3ZWVuZXI7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSB0O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiFcbiAgTGVnb011c2hyb29tIEBsZWdvbXVzaHJvb20gaHR0cDovL2xlZ29tdXNocm9vbS5jb21cbiAgTUlUIExpY2Vuc2UgMjAxNFxuICovXG5cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuKGZ1bmN0aW9uKCkge1xuICAoZnVuY3Rpb24oKSB7XG4gICAgdmFyIE1haW47XG4gICAgTWFpbiA9IChmdW5jdGlvbigpIHtcbiAgICAgIGZ1bmN0aW9uIE1haW4obykge1xuICAgICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICAgIGlmICh3aW5kb3cuaXNBbnlSZXNpemVFdmVudEluaXRlZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnZhcnMoKTtcbiAgICAgICAgdGhpcy5yZWRlZmluZVByb3RvKCk7XG4gICAgICB9XG5cbiAgICAgIE1haW4ucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgd2luZG93LmlzQW55UmVzaXplRXZlbnRJbml0ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLmFsbG93ZWRQcm90b3MgPSBbSFRNTERpdkVsZW1lbnQsIEhUTUxGb3JtRWxlbWVudCwgSFRNTExpbmtFbGVtZW50LCBIVE1MQm9keUVsZW1lbnQsIEhUTUxQYXJhZ3JhcGhFbGVtZW50LCBIVE1MRmllbGRTZXRFbGVtZW50LCBIVE1MTGVnZW5kRWxlbWVudCwgSFRNTExhYmVsRWxlbWVudCwgSFRNTEJ1dHRvbkVsZW1lbnQsIEhUTUxVTGlzdEVsZW1lbnQsIEhUTUxPTGlzdEVsZW1lbnQsIEhUTUxMSUVsZW1lbnQsIEhUTUxIZWFkaW5nRWxlbWVudCwgSFRNTFF1b3RlRWxlbWVudCwgSFRNTFByZUVsZW1lbnQsIEhUTUxCUkVsZW1lbnQsIEhUTUxGb250RWxlbWVudCwgSFRNTEhSRWxlbWVudCwgSFRNTE1vZEVsZW1lbnQsIEhUTUxQYXJhbUVsZW1lbnQsIEhUTUxNYXBFbGVtZW50LCBIVE1MVGFibGVFbGVtZW50LCBIVE1MVGFibGVDYXB0aW9uRWxlbWVudCwgSFRNTEltYWdlRWxlbWVudCwgSFRNTFRhYmxlQ2VsbEVsZW1lbnQsIEhUTUxTZWxlY3RFbGVtZW50LCBIVE1MSW5wdXRFbGVtZW50LCBIVE1MVGV4dEFyZWFFbGVtZW50LCBIVE1MQW5jaG9yRWxlbWVudCwgSFRNTE9iamVjdEVsZW1lbnQsIEhUTUxUYWJsZUNvbEVsZW1lbnQsIEhUTUxUYWJsZVNlY3Rpb25FbGVtZW50LCBIVE1MVGFibGVSb3dFbGVtZW50XTtcbiAgICAgICAgcmV0dXJuIHRoaXMudGltZXJFbGVtZW50cyA9IHtcbiAgICAgICAgICBpbWc6IDEsXG4gICAgICAgICAgdGV4dGFyZWE6IDEsXG4gICAgICAgICAgaW5wdXQ6IDEsXG4gICAgICAgICAgZW1iZWQ6IDEsXG4gICAgICAgICAgb2JqZWN0OiAxLFxuICAgICAgICAgIHN2ZzogMSxcbiAgICAgICAgICBjYW52YXM6IDEsXG4gICAgICAgICAgdHI6IDEsXG4gICAgICAgICAgdGJvZHk6IDEsXG4gICAgICAgICAgdGhlYWQ6IDEsXG4gICAgICAgICAgdGZvb3Q6IDEsXG4gICAgICAgICAgYTogMSxcbiAgICAgICAgICBzZWxlY3Q6IDEsXG4gICAgICAgICAgb3B0aW9uOiAxLFxuICAgICAgICAgIG9wdGdyb3VwOiAxLFxuICAgICAgICAgIGRsOiAxLFxuICAgICAgICAgIGR0OiAxLFxuICAgICAgICAgIGJyOiAxLFxuICAgICAgICAgIGJhc2Vmb250OiAxLFxuICAgICAgICAgIGZvbnQ6IDEsXG4gICAgICAgICAgY29sOiAxLFxuICAgICAgICAgIGlmcmFtZTogMVxuICAgICAgICB9O1xuICAgICAgfTtcblxuICAgICAgTWFpbi5wcm90b3R5cGUucmVkZWZpbmVQcm90byA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaSwgaXQsIHByb3RvLCB0O1xuICAgICAgICBpdCA9IHRoaXM7XG4gICAgICAgIHJldHVybiB0ID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBfaSwgX2xlbiwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICAgICAgX3JlZiA9IHRoaXMuYWxsb3dlZFByb3RvcztcbiAgICAgICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IF9yZWYubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgICAgICBwcm90byA9IF9yZWZbaV07XG4gICAgICAgICAgICBpZiAocHJvdG8ucHJvdG90eXBlID09IG51bGwpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfcmVzdWx0cy5wdXNoKChmdW5jdGlvbihwcm90bykge1xuICAgICAgICAgICAgICB2YXIgbGlzdGVuZXIsIHJlbW92ZXI7XG4gICAgICAgICAgICAgIGxpc3RlbmVyID0gcHJvdG8ucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgfHwgcHJvdG8ucHJvdG90eXBlLmF0dGFjaEV2ZW50O1xuICAgICAgICAgICAgICAoZnVuY3Rpb24obGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICB2YXIgd3JhcHBlZExpc3RlbmVyO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRMaXN0ZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgdmFyIG9wdGlvbjtcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzICE9PSB3aW5kb3cgfHwgdGhpcyAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uID0gYXJndW1lbnRzWzBdID09PSAnb25yZXNpemUnICYmICF0aGlzLmlzQW55UmVzaXplRXZlbnRJbml0ZWQ7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbiAmJiBpdC5oYW5kbGVSZXNpemUoe1xuICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IGFyZ3VtZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICB0aGF0OiB0aGlzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAocHJvdG8ucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBwcm90by5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IHdyYXBwZWRMaXN0ZW5lcjtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudCkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudCA9IHdyYXBwZWRMaXN0ZW5lcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pKGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgcmVtb3ZlciA9IHByb3RvLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyIHx8IHByb3RvLnByb3RvdHlwZS5kZXRhY2hFdmVudDtcbiAgICAgICAgICAgICAgcmV0dXJuIChmdW5jdGlvbihyZW1vdmVyKSB7XG4gICAgICAgICAgICAgICAgdmFyIHdyYXBwZWRSZW1vdmVyO1xuICAgICAgICAgICAgICAgIHdyYXBwZWRSZW1vdmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmlzQW55UmVzaXplRXZlbnRJbml0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgIHRoaXMuaWZyYW1lICYmIHRoaXMucmVtb3ZlQ2hpbGQodGhpcy5pZnJhbWUpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlbW92ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChwcm90by5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3RvLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gd3JhcHBlZFJlbW92ZXI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcm90by5wcm90b3R5cGUuZGV0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBwcm90by5wcm90b3R5cGUuZGV0YWNoRXZlbnQgPSB3cmFwcGVkTGlzdGVuZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KShyZW1vdmVyKTtcbiAgICAgICAgICAgIH0pKHByb3RvKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICAgICAgfSkuY2FsbCh0aGlzKTtcbiAgICAgIH07XG5cbiAgICAgIE1haW4ucHJvdG90eXBlLmhhbmRsZVJlc2l6ZSA9IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgdmFyIGNvbXB1dGVkU3R5bGUsIGVsLCBpZnJhbWUsIGlzRW1wdHksIGlzTm9Qb3MsIGlzU3RhdGljLCBfcmVmO1xuICAgICAgICBlbCA9IGFyZ3MudGhhdDtcbiAgICAgICAgaWYgKCF0aGlzLnRpbWVyRWxlbWVudHNbZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpXSkge1xuICAgICAgICAgIGlmcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgICAgIGVsLmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgICAgICAgIGlmcmFtZS5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICBpZnJhbWUuc3R5bGUuekluZGV4ID0gLTk5OTtcbiAgICAgICAgICBpZnJhbWUuc3R5bGUub3BhY2l0eSA9IDA7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLnRvcCA9IDA7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLmxlZnQgPSAwO1xuICAgICAgICAgIGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSA/IGdldENvbXB1dGVkU3R5bGUoZWwpIDogZWwuY3VycmVudFN0eWxlO1xuICAgICAgICAgIGlzTm9Qb3MgPSBlbC5zdHlsZS5wb3NpdGlvbiA9PT0gJyc7XG4gICAgICAgICAgaXNTdGF0aWMgPSBjb21wdXRlZFN0eWxlLnBvc2l0aW9uID09PSAnc3RhdGljJyAmJiBpc05vUG9zO1xuICAgICAgICAgIGlzRW1wdHkgPSBjb21wdXRlZFN0eWxlLnBvc2l0aW9uID09PSAnJyAmJiBlbC5zdHlsZS5wb3NpdGlvbiA9PT0gJyc7XG4gICAgICAgICAgaWYgKGlzU3RhdGljIHx8IGlzRW1wdHkpIHtcbiAgICAgICAgICAgIGVsLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChfcmVmID0gaWZyYW1lLmNvbnRlbnRXaW5kb3cpICE9IG51bGwpIHtcbiAgICAgICAgICAgIF9yZWYub25yZXNpemUgPSAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX3RoaXMuZGlzcGF0Y2hFdmVudChlbCk7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWwuaWZyYW1lID0gaWZyYW1lO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaW5pdFRpbWVyKGVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZWwuaXNBbnlSZXNpemVFdmVudEluaXRlZCA9IHRydWU7XG4gICAgICB9O1xuXG4gICAgICBNYWluLnByb3RvdHlwZS5pbml0VGltZXIgPSBmdW5jdGlvbihlbCkge1xuICAgICAgICB2YXIgaGVpZ2h0LCB3aWR0aDtcbiAgICAgICAgd2lkdGggPSAwO1xuICAgICAgICBoZWlnaHQgPSAwO1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBuZXdIZWlnaHQsIG5ld1dpZHRoO1xuICAgICAgICAgICAgbmV3V2lkdGggPSBlbC5vZmZzZXRXaWR0aDtcbiAgICAgICAgICAgIG5ld0hlaWdodCA9IGVsLm9mZnNldEhlaWdodDtcbiAgICAgICAgICAgIGlmIChuZXdXaWR0aCAhPT0gd2lkdGggfHwgbmV3SGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgICAgX3RoaXMuZGlzcGF0Y2hFdmVudChlbCk7XG4gICAgICAgICAgICAgIHdpZHRoID0gbmV3V2lkdGg7XG4gICAgICAgICAgICAgIHJldHVybiBoZWlnaHQgPSBuZXdIZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksIHRoaXMuby5pbnRlcnZhbCB8fCA2Mi41KTtcbiAgICAgIH07XG5cbiAgICAgIE1haW4ucHJvdG90eXBlLmRpc3BhdGNoRXZlbnQgPSBmdW5jdGlvbihlbCkge1xuICAgICAgICB2YXIgZTtcbiAgICAgICAgaWYgKGRvY3VtZW50LmNyZWF0ZUV2ZW50KSB7XG4gICAgICAgICAgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdIVE1MRXZlbnRzJyk7XG4gICAgICAgICAgZS5pbml0RXZlbnQoJ29ucmVzaXplJywgZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICByZXR1cm4gZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgICAgIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgICAgICAgIHJldHVybiBlbC5maXJlRXZlbnQoJ29ucmVzaXplJywgZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBNYWluLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpLCBpdCwgcHJvdG8sIF9pLCBfbGVuLCBfcmVmLCBfcmVzdWx0cztcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKTtcbiAgICAgICAgdGhpcy5pbnRlcnZhbCA9IG51bGw7XG4gICAgICAgIHdpbmRvdy5pc0FueVJlc2l6ZUV2ZW50SW5pdGVkID0gZmFsc2U7XG4gICAgICAgIGl0ID0gdGhpcztcbiAgICAgICAgX3JlZiA9IHRoaXMuYWxsb3dlZFByb3RvcztcbiAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gX3JlZi5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICBwcm90byA9IF9yZWZbaV07XG4gICAgICAgICAgaWYgKHByb3RvLnByb3RvdHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCgoZnVuY3Rpb24ocHJvdG8pIHtcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lcjtcbiAgICAgICAgICAgIGxpc3RlbmVyID0gcHJvdG8ucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgfHwgcHJvdG8ucHJvdG90eXBlLmF0dGFjaEV2ZW50O1xuICAgICAgICAgICAgaWYgKHByb3RvLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgIHByb3RvLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gRWxlbWVudC5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvdG8ucHJvdG90eXBlLmF0dGFjaEV2ZW50KSB7XG4gICAgICAgICAgICAgIHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudCA9IEVsZW1lbnQucHJvdG90eXBlLmF0dGFjaEV2ZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHByb3RvLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgIHJldHVybiBwcm90by5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IEVsZW1lbnQucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3RvLnByb3RvdHlwZS5kZXRhY2hFdmVudCkge1xuICAgICAgICAgICAgICByZXR1cm4gcHJvdG8ucHJvdG90eXBlLmRldGFjaEV2ZW50ID0gRWxlbWVudC5wcm90b3R5cGUuZGV0YWNoRXZlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkocHJvdG8pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4gTWFpbjtcblxuICAgIH0pKCk7XG4gICAgaWYgKCh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIpICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIHJldHVybiBkZWZpbmUoXCJhbnktcmVzaXplLWV2ZW50XCIsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNYWluO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICgodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIikgJiYgKHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gXCJvYmplY3RcIikpIHtcbiAgICAgIHJldHVybiBtb2R1bGUuZXhwb3J0cyA9IG5ldyBNYWluO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiAmJiB3aW5kb3cgIT09IG51bGwpIHtcbiAgICAgICAgd2luZG93LkFueVJlc2l6ZUV2ZW50ID0gTWFpbjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIHdpbmRvdyAhPT0gbnVsbCA/IHdpbmRvdy5hbnlSZXNpemVFdmVudCA9IG5ldyBNYWluIDogdm9pZCAwO1xuICAgIH1cbiAgfSkoKTtcblxufSkuY2FsbCh0aGlzKTtcbiIsImltcG9ydCBtb2pzIGZyb20gJ21vLWpzJztcblxuY29uc3QgaWNvbkFuaW1hdGlvbiA9IChpY29uTGluaykgPT4ge1xuXG4gIGNvbnN0IHNjYWxlQ3VydmUgPSBtb2pzLmVhc2luZy5wYXRoKCdNMCwxMDAgTDI1LDk5Ljk5OTk5ODMgQzI2LjIzMjg4MzUsNzUuMDcwODg0NyAxOS43ODQ3ODQzLDAgMTAwLDAnKTtcbiAgY29uc3QgZWwgPSBpY29uTGluayxcbiAgICBlbFNwYW4gPSBlbC5xdWVyeVNlbGVjdG9yKCdzdmcnKSxcbiAgLy8gbW8uanMgdGltZWxpbmUgb2JqXG4gICAgdGltZWxpbmUgPSBuZXcgbW9qcy5UaW1lbGluZSgpLFxuXG4gIC8vIHR3ZWVucyBmb3IgdGhlIGFuaW1hdGlvbjpcblxuICAvLyByaW5nIGFuaW1hdGlvblxuICAgIHR3ZWVuMiA9IG5ldyBtb2pzLlRyYW5zaXQoe1xuICAgICAgcGFyZW50OiBlbCxcbiAgICAgIGR1cmF0aW9uOiA3NTAsXG4gICAgICB0eXBlOiAnY2lyY2xlJyxcbiAgICAgIHJhZGl1czogezA6IDMwfSxcbiAgICAgIGZpbGw6ICd0cmFuc3BhcmVudCcsXG4gICAgICBzdHJva2U6ICdyZWQnLFxuICAgICAgc3Ryb2tlV2lkdGg6IHsxNTogMH0sXG4gICAgICBvcGFjaXR5OiAwLjYsXG4gICAgICB4OiAnNTAlJyxcbiAgICAgIHk6ICc1MCUnLFxuICAgICAgaXNSdW5MZXNzOiB0cnVlLFxuICAgICAgZWFzaW5nOiBtb2pzLmVhc2luZy5iZXppZXIoMCwgMSwgMC41LCAxKSxcbiAgICB9KSxcbiAgLy8gaWNvbiBzY2FsZSBhbmltYXRpb25cbiAgICB0d2VlbjMgPSBuZXcgbW9qcy5Ud2Vlbih7XG4gICAgICBkdXJhdGlvbjogOTAwLFxuICAgICAgb25VcGRhdGU6IChwcm9ncmVzcykgPT4ge1xuICAgICAgICBjb25zdCBzY2FsZVByb2dyZXNzID0gc2NhbGVDdXJ2ZShwcm9ncmVzcyk7XG4gICAgICAgIGVsU3Bhbi5zdHlsZS5XZWJraXRUcmFuc2Zvcm0gPSBlbFNwYW4uc3R5bGUudHJhbnNmb3JtID0gYHNjYWxlM2QoJHtzY2FsZVByb2dyZXNzfSwke3NjYWxlUHJvZ3Jlc3N9LDEpYDtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgLy8gYWRkIHR3ZWVucyB0byB0aW1lbGluZTpcbiAgdGltZWxpbmUuYWRkKHR3ZWVuMiwgdHdlZW4zKTtcblxuICAvLyB3aGVuIGNsaWNraW5nIHRoZSBidXR0b24gc3RhcnQgdGhlIHRpbWVsaW5lL2FuaW1hdGlvbjpcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VlbnRlcicsICgpID0+IHtcbiAgICB0aW1lbGluZS5zdGFydCgpO1xuICB9KTtcblxufTtcblxuZXhwb3J0IGRlZmF1bHQgaWNvbkFuaW1hdGlvbjsiLCJpbXBvcnQgYXR0YWNoRmFzdENsaWNrIGZyb20gJ2Zhc3RjbGljayc7XG5pbXBvcnQgaWNvbkFuaW1hdGlvbiBmcm9tICcuL2NvbXBvbmVudHMvaWNvbkFuaW1hdGlvbic7XG5cbmNvbnN0IGxpbmtzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnc29jaWFsLWxpbmsnKTtcblxuZm9yKGxldCBpID0gMDsgaSA8IGxpbmtzLmxlbmd0aDsgaSsrICkge1xuICBpY29uQW5pbWF0aW9uKGxpbmtzW2ldKTtcbn1cblxuLy9Jbml0aWF0ZSBmYXN0Y2xpY2sgb24gYm9keVxuYXR0YWNoRmFzdENsaWNrKGRvY3VtZW50LmJvZHkpOyJdfQ==
