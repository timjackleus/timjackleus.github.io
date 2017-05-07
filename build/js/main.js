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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmFzdGNsaWNrL2xpYi9mYXN0Y2xpY2suanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL2J1cnN0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9lYXNpbmcvYmV6aWVyLWVhc2luZy5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL2Vhc2luZy5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL21peC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvZWFzaW5nL3BhdGgtZWFzaW5nLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9oLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9tb2pzLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9tb3Rpb24tcGF0aC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvcG9seWZpbGxzL3BlcmZvcm1hbmNlLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9wb2x5ZmlsbHMvcmFmLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvYml0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvYml0c01hcC5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL2NpcmNsZS5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL2Nyb3NzLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvZXF1YWwuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3NoYXBlcy9saW5lLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi9zaGFwZXMvcG9seWdvbi5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvc2hhcGVzL3JlY3QuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3NoYXBlcy96aWd6YWcuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3Nwcml0ZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3N0YWdnZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3N3aXJsLmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi90cmFuc2l0LmpzIiwibm9kZV9tb2R1bGVzL21vLWpzL2xpYi90d2Vlbi90aW1lbGluZS5qcyIsIm5vZGVfbW9kdWxlcy9tby1qcy9saWIvdHdlZW4vdHdlZW4uanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3R3ZWVuL3R3ZWVuZXIuanMiLCJub2RlX21vZHVsZXMvbW8tanMvbGliL3ZlbmRvci9yZXNpemUuanMiLCJzb3VyY2UvanMvY29tcG9uZW50cy9pY29uQW5pbWF0aW9uLmpzIiwic291cmNlL2pzL3NjcmlwdHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3owQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzVWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaHFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7QUM1TkE7Ozs7OztBQUVBLElBQU0sZ0JBQWdCLFNBQWhCLGFBQWdCLENBQUMsUUFBRCxFQUFjOztBQUVsQyxNQUFNLGFBQWEsZUFBSyxNQUFMLENBQVksSUFBWixDQUFpQixpRUFBakIsQ0FBbkI7QUFDQSxNQUFNLEtBQUssUUFBWDtBQUFBLE1BQ0UsU0FBUyxHQUFHLGFBQUgsQ0FBaUIsS0FBakIsQ0FEWDs7QUFFQTtBQUNFLGFBQVcsSUFBSSxlQUFLLFFBQVQsRUFIYjs7O0FBS0E7O0FBRUE7QUFDRSxXQUFTLElBQUksZUFBSyxPQUFULENBQWlCO0FBQ3hCLFlBQVEsRUFEZ0I7QUFFeEIsY0FBVSxHQUZjO0FBR3hCLFVBQU0sUUFIa0I7QUFJeEIsWUFBUSxFQUFDLEdBQUcsRUFBSixFQUpnQjtBQUt4QixVQUFNLGFBTGtCO0FBTXhCLFlBQVEsS0FOZ0I7QUFPeEIsaUJBQWEsRUFBQyxJQUFJLENBQUwsRUFQVztBQVF4QixhQUFTLEdBUmU7QUFTeEIsT0FBRyxLQVRxQjtBQVV4QixPQUFHLEtBVnFCO0FBV3hCLGVBQVcsSUFYYTtBQVl4QixZQUFRLGVBQUssTUFBTCxDQUFZLE1BQVosQ0FBbUIsQ0FBbkIsRUFBc0IsQ0FBdEIsRUFBeUIsR0FBekIsRUFBOEIsQ0FBOUI7QUFaZ0IsR0FBakIsQ0FSWDs7QUFzQkE7QUFDRSxXQUFTLElBQUksZUFBSyxLQUFULENBQWU7QUFDdEIsY0FBVSxHQURZO0FBRXRCLGNBQVUsa0JBQUMsUUFBRCxFQUFjO0FBQ3RCLFVBQU0sZ0JBQWdCLFdBQVcsUUFBWCxDQUF0QjtBQUNBLGFBQU8sS0FBUCxDQUFhLGVBQWIsR0FBK0IsT0FBTyxLQUFQLENBQWEsU0FBYixnQkFBb0MsYUFBcEMsU0FBcUQsYUFBckQsUUFBL0I7QUFDRDtBQUxxQixHQUFmLENBdkJYOztBQStCQTtBQUNBLFdBQVMsR0FBVCxDQUFhLE1BQWIsRUFBcUIsTUFBckI7O0FBRUE7QUFDQSxLQUFHLGdCQUFILENBQW9CLFlBQXBCLEVBQWtDLFlBQU07QUFDdEMsYUFBUyxLQUFUO0FBQ0QsR0FGRDtBQUlELENBMUNEOztrQkE0Q2UsYTs7Ozs7QUM5Q2Y7Ozs7QUFDQTs7Ozs7O0FBRUEsSUFBTSxRQUFRLFNBQVMsc0JBQVQsQ0FBZ0MsYUFBaEMsQ0FBZDs7QUFFQSxLQUFJLElBQUksSUFBSSxDQUFaLEVBQWUsSUFBSSxNQUFNLE1BQXpCLEVBQWlDLEdBQWpDLEVBQXVDO0FBQ3JDLCtCQUFjLE1BQU0sQ0FBTixDQUFkO0FBQ0Q7O0FBRUQ7QUFDQSx5QkFBZ0IsU0FBUyxJQUF6QiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCI7KGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdC8qKlxuXHQgKiBAcHJlc2VydmUgRmFzdENsaWNrOiBwb2x5ZmlsbCB0byByZW1vdmUgY2xpY2sgZGVsYXlzIG9uIGJyb3dzZXJzIHdpdGggdG91Y2ggVUlzLlxuXHQgKlxuXHQgKiBAY29kaW5nc3RhbmRhcmQgZnRsYWJzLWpzdjJcblx0ICogQGNvcHlyaWdodCBUaGUgRmluYW5jaWFsIFRpbWVzIExpbWl0ZWQgW0FsbCBSaWdodHMgUmVzZXJ2ZWRdXG5cdCAqIEBsaWNlbnNlIE1JVCBMaWNlbnNlIChzZWUgTElDRU5TRS50eHQpXG5cdCAqL1xuXG5cdC8qanNsaW50IGJyb3dzZXI6dHJ1ZSwgbm9kZTp0cnVlKi9cblx0LypnbG9iYWwgZGVmaW5lLCBFdmVudCwgTm9kZSovXG5cblxuXHQvKipcblx0ICogSW5zdGFudGlhdGUgZmFzdC1jbGlja2luZyBsaXN0ZW5lcnMgb24gdGhlIHNwZWNpZmllZCBsYXllci5cblx0ICpcblx0ICogQGNvbnN0cnVjdG9yXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gbGF5ZXIgVGhlIGxheWVyIHRvIGxpc3RlbiBvblxuXHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIFRoZSBvcHRpb25zIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0c1xuXHQgKi9cblx0ZnVuY3Rpb24gRmFzdENsaWNrKGxheWVyLCBvcHRpb25zKSB7XG5cdFx0dmFyIG9sZE9uQ2xpY2s7XG5cblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgYSBjbGljayBpcyBjdXJyZW50bHkgYmVpbmcgdHJhY2tlZC5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIGJvb2xlYW5cblx0XHQgKi9cblx0XHR0aGlzLnRyYWNraW5nQ2xpY2sgPSBmYWxzZTtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGltZXN0YW1wIGZvciB3aGVuIGNsaWNrIHRyYWNraW5nIHN0YXJ0ZWQuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBudW1iZXJcblx0XHQgKi9cblx0XHR0aGlzLnRyYWNraW5nQ2xpY2tTdGFydCA9IDA7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBlbGVtZW50IGJlaW5nIHRyYWNrZWQgZm9yIGEgY2xpY2suXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBFdmVudFRhcmdldFxuXHRcdCAqL1xuXHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IG51bGw7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFgtY29vcmRpbmF0ZSBvZiB0b3VjaCBzdGFydCBldmVudC5cblx0XHQgKlxuXHRcdCAqIEB0eXBlIG51bWJlclxuXHRcdCAqL1xuXHRcdHRoaXMudG91Y2hTdGFydFggPSAwO1xuXG5cblx0XHQvKipcblx0XHQgKiBZLWNvb3JkaW5hdGUgb2YgdG91Y2ggc3RhcnQgZXZlbnQuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBudW1iZXJcblx0XHQgKi9cblx0XHR0aGlzLnRvdWNoU3RhcnRZID0gMDtcblxuXG5cdFx0LyoqXG5cdFx0ICogSUQgb2YgdGhlIGxhc3QgdG91Y2gsIHJldHJpZXZlZCBmcm9tIFRvdWNoLmlkZW50aWZpZXIuXG5cdFx0ICpcblx0XHQgKiBAdHlwZSBudW1iZXJcblx0XHQgKi9cblx0XHR0aGlzLmxhc3RUb3VjaElkZW50aWZpZXIgPSAwO1xuXG5cblx0XHQvKipcblx0XHQgKiBUb3VjaG1vdmUgYm91bmRhcnksIGJleW9uZCB3aGljaCBhIGNsaWNrIHdpbGwgYmUgY2FuY2VsbGVkLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUgbnVtYmVyXG5cdFx0ICovXG5cdFx0dGhpcy50b3VjaEJvdW5kYXJ5ID0gb3B0aW9ucy50b3VjaEJvdW5kYXJ5IHx8IDEwO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaGUgRmFzdENsaWNrIGxheWVyLlxuXHRcdCAqXG5cdFx0ICogQHR5cGUgRWxlbWVudFxuXHRcdCAqL1xuXHRcdHRoaXMubGF5ZXIgPSBsYXllcjtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBtaW5pbXVtIHRpbWUgYmV0d2VlbiB0YXAodG91Y2hzdGFydCBhbmQgdG91Y2hlbmQpIGV2ZW50c1xuXHRcdCAqXG5cdFx0ICogQHR5cGUgbnVtYmVyXG5cdFx0ICovXG5cdFx0dGhpcy50YXBEZWxheSA9IG9wdGlvbnMudGFwRGVsYXkgfHwgMjAwO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIG1heGltdW0gdGltZSBmb3IgYSB0YXBcblx0XHQgKlxuXHRcdCAqIEB0eXBlIG51bWJlclxuXHRcdCAqL1xuXHRcdHRoaXMudGFwVGltZW91dCA9IG9wdGlvbnMudGFwVGltZW91dCB8fCA3MDA7XG5cblx0XHRpZiAoRmFzdENsaWNrLm5vdE5lZWRlZChsYXllcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTb21lIG9sZCB2ZXJzaW9ucyBvZiBBbmRyb2lkIGRvbid0IGhhdmUgRnVuY3Rpb24ucHJvdG90eXBlLmJpbmRcblx0XHRmdW5jdGlvbiBiaW5kKG1ldGhvZCwgY29udGV4dCkge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkgeyByZXR1cm4gbWV0aG9kLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7IH07XG5cdFx0fVxuXG5cblx0XHR2YXIgbWV0aG9kcyA9IFsnb25Nb3VzZScsICdvbkNsaWNrJywgJ29uVG91Y2hTdGFydCcsICdvblRvdWNoTW92ZScsICdvblRvdWNoRW5kJywgJ29uVG91Y2hDYW5jZWwnXTtcblx0XHR2YXIgY29udGV4dCA9IHRoaXM7XG5cdFx0Zm9yICh2YXIgaSA9IDAsIGwgPSBtZXRob2RzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuXHRcdFx0Y29udGV4dFttZXRob2RzW2ldXSA9IGJpbmQoY29udGV4dFttZXRob2RzW2ldXSwgY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IHVwIGV2ZW50IGhhbmRsZXJzIGFzIHJlcXVpcmVkXG5cdFx0aWYgKGRldmljZUlzQW5kcm9pZCkge1xuXHRcdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgdGhpcy5vbk1vdXNlLCB0cnVlKTtcblx0XHRcdGxheWVyLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMub25Nb3VzZSwgdHJ1ZSk7XG5cdFx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5vbk1vdXNlLCB0cnVlKTtcblx0XHR9XG5cblx0XHRsYXllci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMub25DbGljaywgdHJ1ZSk7XG5cdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMub25Ub3VjaFN0YXJ0LCBmYWxzZSk7XG5cdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5vblRvdWNoTW92ZSwgZmFsc2UpO1xuXHRcdGxheWVyLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy5vblRvdWNoRW5kLCBmYWxzZSk7XG5cdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCB0aGlzLm9uVG91Y2hDYW5jZWwsIGZhbHNlKTtcblxuXHRcdC8vIEhhY2sgaXMgcmVxdWlyZWQgZm9yIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBFdmVudCNzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24gKGUuZy4gQW5kcm9pZCAyKVxuXHRcdC8vIHdoaWNoIGlzIGhvdyBGYXN0Q2xpY2sgbm9ybWFsbHkgc3RvcHMgY2xpY2sgZXZlbnRzIGJ1YmJsaW5nIHRvIGNhbGxiYWNrcyByZWdpc3RlcmVkIG9uIHRoZSBGYXN0Q2xpY2tcblx0XHQvLyBsYXllciB3aGVuIHRoZXkgYXJlIGNhbmNlbGxlZC5cblx0XHRpZiAoIUV2ZW50LnByb3RvdHlwZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24pIHtcblx0XHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaywgY2FwdHVyZSkge1xuXHRcdFx0XHR2YXIgcm12ID0gTm9kZS5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0aWYgKHR5cGUgPT09ICdjbGljaycpIHtcblx0XHRcdFx0XHRybXYuY2FsbChsYXllciwgdHlwZSwgY2FsbGJhY2suaGlqYWNrZWQgfHwgY2FsbGJhY2ssIGNhcHR1cmUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJtdi5jYWxsKGxheWVyLCB0eXBlLCBjYWxsYmFjaywgY2FwdHVyZSk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGxheWVyLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaywgY2FwdHVyZSkge1xuXHRcdFx0XHR2YXIgYWR2ID0gTm9kZS5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcjtcblx0XHRcdFx0aWYgKHR5cGUgPT09ICdjbGljaycpIHtcblx0XHRcdFx0XHRhZHYuY2FsbChsYXllciwgdHlwZSwgY2FsbGJhY2suaGlqYWNrZWQgfHwgKGNhbGxiYWNrLmhpamFja2VkID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHRcdFx0XHRcdGlmICghZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkKSB7XG5cdFx0XHRcdFx0XHRcdGNhbGxiYWNrKGV2ZW50KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSwgY2FwdHVyZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWR2LmNhbGwobGF5ZXIsIHR5cGUsIGNhbGxiYWNrLCBjYXB0dXJlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBJZiBhIGhhbmRsZXIgaXMgYWxyZWFkeSBkZWNsYXJlZCBpbiB0aGUgZWxlbWVudCdzIG9uY2xpY2sgYXR0cmlidXRlLCBpdCB3aWxsIGJlIGZpcmVkIGJlZm9yZVxuXHRcdC8vIEZhc3RDbGljaydzIG9uQ2xpY2sgaGFuZGxlci4gRml4IHRoaXMgYnkgcHVsbGluZyBvdXQgdGhlIHVzZXItZGVmaW5lZCBoYW5kbGVyIGZ1bmN0aW9uIGFuZFxuXHRcdC8vIGFkZGluZyBpdCBhcyBsaXN0ZW5lci5cblx0XHRpZiAodHlwZW9mIGxheWVyLm9uY2xpY2sgPT09ICdmdW5jdGlvbicpIHtcblxuXHRcdFx0Ly8gQW5kcm9pZCBicm93c2VyIG9uIGF0IGxlYXN0IDMuMiByZXF1aXJlcyBhIG5ldyByZWZlcmVuY2UgdG8gdGhlIGZ1bmN0aW9uIGluIGxheWVyLm9uY2xpY2tcblx0XHRcdC8vIC0gdGhlIG9sZCBvbmUgd29uJ3Qgd29yayBpZiBwYXNzZWQgdG8gYWRkRXZlbnRMaXN0ZW5lciBkaXJlY3RseS5cblx0XHRcdG9sZE9uQ2xpY2sgPSBsYXllci5vbmNsaWNrO1xuXHRcdFx0bGF5ZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihldmVudCkge1xuXHRcdFx0XHRvbGRPbkNsaWNrKGV2ZW50KTtcblx0XHRcdH0sIGZhbHNlKTtcblx0XHRcdGxheWVyLm9uY2xpY2sgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQqIFdpbmRvd3MgUGhvbmUgOC4xIGZha2VzIHVzZXIgYWdlbnQgc3RyaW5nIHRvIGxvb2sgbGlrZSBBbmRyb2lkIGFuZCBpUGhvbmUuXG5cdCpcblx0KiBAdHlwZSBib29sZWFuXG5cdCovXG5cdHZhciBkZXZpY2VJc1dpbmRvd3NQaG9uZSA9IG5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZihcIldpbmRvd3MgUGhvbmVcIikgPj0gMDtcblxuXHQvKipcblx0ICogQW5kcm9pZCByZXF1aXJlcyBleGNlcHRpb25zLlxuXHQgKlxuXHQgKiBAdHlwZSBib29sZWFuXG5cdCAqL1xuXHR2YXIgZGV2aWNlSXNBbmRyb2lkID0gbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdBbmRyb2lkJykgPiAwICYmICFkZXZpY2VJc1dpbmRvd3NQaG9uZTtcblxuXG5cdC8qKlxuXHQgKiBpT1MgcmVxdWlyZXMgZXhjZXB0aW9ucy5cblx0ICpcblx0ICogQHR5cGUgYm9vbGVhblxuXHQgKi9cblx0dmFyIGRldmljZUlzSU9TID0gL2lQKGFkfGhvbmV8b2QpLy50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpICYmICFkZXZpY2VJc1dpbmRvd3NQaG9uZTtcblxuXG5cdC8qKlxuXHQgKiBpT1MgNCByZXF1aXJlcyBhbiBleGNlcHRpb24gZm9yIHNlbGVjdCBlbGVtZW50cy5cblx0ICpcblx0ICogQHR5cGUgYm9vbGVhblxuXHQgKi9cblx0dmFyIGRldmljZUlzSU9TNCA9IGRldmljZUlzSU9TICYmICgvT1MgNF9cXGQoX1xcZCk/LykudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuXG5cdC8qKlxuXHQgKiBpT1MgNi4wLTcuKiByZXF1aXJlcyB0aGUgdGFyZ2V0IGVsZW1lbnQgdG8gYmUgbWFudWFsbHkgZGVyaXZlZFxuXHQgKlxuXHQgKiBAdHlwZSBib29sZWFuXG5cdCAqL1xuXHR2YXIgZGV2aWNlSXNJT1NXaXRoQmFkVGFyZ2V0ID0gZGV2aWNlSXNJT1MgJiYgKC9PUyBbNi03XV9cXGQvKS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuXG5cdC8qKlxuXHQgKiBCbGFja0JlcnJ5IHJlcXVpcmVzIGV4Y2VwdGlvbnMuXG5cdCAqXG5cdCAqIEB0eXBlIGJvb2xlYW5cblx0ICovXG5cdHZhciBkZXZpY2VJc0JsYWNrQmVycnkxMCA9IG5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignQkIxMCcpID4gMDtcblxuXHQvKipcblx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgYSBnaXZlbiBlbGVtZW50IHJlcXVpcmVzIGEgbmF0aXZlIGNsaWNrLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fEVsZW1lbnR9IHRhcmdldCBUYXJnZXQgRE9NIGVsZW1lbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgZWxlbWVudCBuZWVkcyBhIG5hdGl2ZSBjbGlja1xuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5uZWVkc0NsaWNrID0gZnVuY3Rpb24odGFyZ2V0KSB7XG5cdFx0c3dpdGNoICh0YXJnZXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSkge1xuXG5cdFx0Ly8gRG9uJ3Qgc2VuZCBhIHN5bnRoZXRpYyBjbGljayB0byBkaXNhYmxlZCBpbnB1dHMgKGlzc3VlICM2Milcblx0XHRjYXNlICdidXR0b24nOlxuXHRcdGNhc2UgJ3NlbGVjdCc6XG5cdFx0Y2FzZSAndGV4dGFyZWEnOlxuXHRcdFx0aWYgKHRhcmdldC5kaXNhYmxlZCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAnaW5wdXQnOlxuXG5cdFx0XHQvLyBGaWxlIGlucHV0cyBuZWVkIHJlYWwgY2xpY2tzIG9uIGlPUyA2IGR1ZSB0byBhIGJyb3dzZXIgYnVnIChpc3N1ZSAjNjgpXG5cdFx0XHRpZiAoKGRldmljZUlzSU9TICYmIHRhcmdldC50eXBlID09PSAnZmlsZScpIHx8IHRhcmdldC5kaXNhYmxlZCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAnbGFiZWwnOlxuXHRcdGNhc2UgJ2lmcmFtZSc6IC8vIGlPUzggaG9tZXNjcmVlbiBhcHBzIGNhbiBwcmV2ZW50IGV2ZW50cyBidWJibGluZyBpbnRvIGZyYW1lc1xuXHRcdGNhc2UgJ3ZpZGVvJzpcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiAoL1xcYm5lZWRzY2xpY2tcXGIvKS50ZXN0KHRhcmdldC5jbGFzc05hbWUpO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIERldGVybWluZSB3aGV0aGVyIGEgZ2l2ZW4gZWxlbWVudCByZXF1aXJlcyBhIGNhbGwgdG8gZm9jdXMgdG8gc2ltdWxhdGUgY2xpY2sgaW50byBlbGVtZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50VGFyZ2V0fEVsZW1lbnR9IHRhcmdldCBUYXJnZXQgRE9NIGVsZW1lbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgZWxlbWVudCByZXF1aXJlcyBhIGNhbGwgdG8gZm9jdXMgdG8gc2ltdWxhdGUgbmF0aXZlIGNsaWNrLlxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5uZWVkc0ZvY3VzID0gZnVuY3Rpb24odGFyZ2V0KSB7XG5cdFx0c3dpdGNoICh0YXJnZXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSkge1xuXHRcdGNhc2UgJ3RleHRhcmVhJzpcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdGNhc2UgJ3NlbGVjdCc6XG5cdFx0XHRyZXR1cm4gIWRldmljZUlzQW5kcm9pZDtcblx0XHRjYXNlICdpbnB1dCc6XG5cdFx0XHRzd2l0Y2ggKHRhcmdldC50eXBlKSB7XG5cdFx0XHRjYXNlICdidXR0b24nOlxuXHRcdFx0Y2FzZSAnY2hlY2tib3gnOlxuXHRcdFx0Y2FzZSAnZmlsZSc6XG5cdFx0XHRjYXNlICdpbWFnZSc6XG5cdFx0XHRjYXNlICdyYWRpbyc6XG5cdFx0XHRjYXNlICdzdWJtaXQnOlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE5vIHBvaW50IGluIGF0dGVtcHRpbmcgdG8gZm9jdXMgZGlzYWJsZWQgaW5wdXRzXG5cdFx0XHRyZXR1cm4gIXRhcmdldC5kaXNhYmxlZCAmJiAhdGFyZ2V0LnJlYWRPbmx5O1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gKC9cXGJuZWVkc2ZvY3VzXFxiLykudGVzdCh0YXJnZXQuY2xhc3NOYW1lKTtcblx0XHR9XG5cdH07XG5cblxuXHQvKipcblx0ICogU2VuZCBhIGNsaWNrIGV2ZW50IHRvIHRoZSBzcGVjaWZpZWQgZWxlbWVudC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudFRhcmdldHxFbGVtZW50fSB0YXJnZXRFbGVtZW50XG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLnNlbmRDbGljayA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQsIGV2ZW50KSB7XG5cdFx0dmFyIGNsaWNrRXZlbnQsIHRvdWNoO1xuXG5cdFx0Ly8gT24gc29tZSBBbmRyb2lkIGRldmljZXMgYWN0aXZlRWxlbWVudCBuZWVkcyB0byBiZSBibHVycmVkIG90aGVyd2lzZSB0aGUgc3ludGhldGljIGNsaWNrIHdpbGwgaGF2ZSBubyBlZmZlY3QgKCMyNClcblx0XHRpZiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSB0YXJnZXRFbGVtZW50KSB7XG5cdFx0XHRkb2N1bWVudC5hY3RpdmVFbGVtZW50LmJsdXIoKTtcblx0XHR9XG5cblx0XHR0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzWzBdO1xuXG5cdFx0Ly8gU3ludGhlc2lzZSBhIGNsaWNrIGV2ZW50LCB3aXRoIGFuIGV4dHJhIGF0dHJpYnV0ZSBzbyBpdCBjYW4gYmUgdHJhY2tlZFxuXHRcdGNsaWNrRXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnTW91c2VFdmVudHMnKTtcblx0XHRjbGlja0V2ZW50LmluaXRNb3VzZUV2ZW50KHRoaXMuZGV0ZXJtaW5lRXZlbnRUeXBlKHRhcmdldEVsZW1lbnQpLCB0cnVlLCB0cnVlLCB3aW5kb3csIDEsIHRvdWNoLnNjcmVlblgsIHRvdWNoLnNjcmVlblksIHRvdWNoLmNsaWVudFgsIHRvdWNoLmNsaWVudFksIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCAwLCBudWxsKTtcblx0XHRjbGlja0V2ZW50LmZvcndhcmRlZFRvdWNoRXZlbnQgPSB0cnVlO1xuXHRcdHRhcmdldEVsZW1lbnQuZGlzcGF0Y2hFdmVudChjbGlja0V2ZW50KTtcblx0fTtcblxuXHRGYXN0Q2xpY2sucHJvdG90eXBlLmRldGVybWluZUV2ZW50VHlwZSA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQpIHtcblxuXHRcdC8vSXNzdWUgIzE1OTogQW5kcm9pZCBDaHJvbWUgU2VsZWN0IEJveCBkb2VzIG5vdCBvcGVuIHdpdGggYSBzeW50aGV0aWMgY2xpY2sgZXZlbnRcblx0XHRpZiAoZGV2aWNlSXNBbmRyb2lkICYmIHRhcmdldEVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2VsZWN0Jykge1xuXHRcdFx0cmV0dXJuICdtb3VzZWRvd24nO1xuXHRcdH1cblxuXHRcdHJldHVybiAnY2xpY2snO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR8RWxlbWVudH0gdGFyZ2V0RWxlbWVudFxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5mb2N1cyA9IGZ1bmN0aW9uKHRhcmdldEVsZW1lbnQpIHtcblx0XHR2YXIgbGVuZ3RoO1xuXG5cdFx0Ly8gSXNzdWUgIzE2MDogb24gaU9TIDcsIHNvbWUgaW5wdXQgZWxlbWVudHMgKGUuZy4gZGF0ZSBkYXRldGltZSBtb250aCkgdGhyb3cgYSB2YWd1ZSBUeXBlRXJyb3Igb24gc2V0U2VsZWN0aW9uUmFuZ2UuIFRoZXNlIGVsZW1lbnRzIGRvbid0IGhhdmUgYW4gaW50ZWdlciB2YWx1ZSBmb3IgdGhlIHNlbGVjdGlvblN0YXJ0IGFuZCBzZWxlY3Rpb25FbmQgcHJvcGVydGllcywgYnV0IHVuZm9ydHVuYXRlbHkgdGhhdCBjYW4ndCBiZSB1c2VkIGZvciBkZXRlY3Rpb24gYmVjYXVzZSBhY2Nlc3NpbmcgdGhlIHByb3BlcnRpZXMgYWxzbyB0aHJvd3MgYSBUeXBlRXJyb3IuIEp1c3QgY2hlY2sgdGhlIHR5cGUgaW5zdGVhZC4gRmlsZWQgYXMgQXBwbGUgYnVnICMxNTEyMjcyNC5cblx0XHRpZiAoZGV2aWNlSXNJT1MgJiYgdGFyZ2V0RWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZSAmJiB0YXJnZXRFbGVtZW50LnR5cGUuaW5kZXhPZignZGF0ZScpICE9PSAwICYmIHRhcmdldEVsZW1lbnQudHlwZSAhPT0gJ3RpbWUnICYmIHRhcmdldEVsZW1lbnQudHlwZSAhPT0gJ21vbnRoJykge1xuXHRcdFx0bGVuZ3RoID0gdGFyZ2V0RWxlbWVudC52YWx1ZS5sZW5ndGg7XG5cdFx0XHR0YXJnZXRFbGVtZW50LnNldFNlbGVjdGlvblJhbmdlKGxlbmd0aCwgbGVuZ3RoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGFyZ2V0RWxlbWVudC5mb2N1cygpO1xuXHRcdH1cblx0fTtcblxuXG5cdC8qKlxuXHQgKiBDaGVjayB3aGV0aGVyIHRoZSBnaXZlbiB0YXJnZXQgZWxlbWVudCBpcyBhIGNoaWxkIG9mIGEgc2Nyb2xsYWJsZSBsYXllciBhbmQgaWYgc28sIHNldCBhIGZsYWcgb24gaXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR8RWxlbWVudH0gdGFyZ2V0RWxlbWVudFxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS51cGRhdGVTY3JvbGxQYXJlbnQgPSBmdW5jdGlvbih0YXJnZXRFbGVtZW50KSB7XG5cdFx0dmFyIHNjcm9sbFBhcmVudCwgcGFyZW50RWxlbWVudDtcblxuXHRcdHNjcm9sbFBhcmVudCA9IHRhcmdldEVsZW1lbnQuZmFzdENsaWNrU2Nyb2xsUGFyZW50O1xuXG5cdFx0Ly8gQXR0ZW1wdCB0byBkaXNjb3ZlciB3aGV0aGVyIHRoZSB0YXJnZXQgZWxlbWVudCBpcyBjb250YWluZWQgd2l0aGluIGEgc2Nyb2xsYWJsZSBsYXllci4gUmUtY2hlY2sgaWYgdGhlXG5cdFx0Ly8gdGFyZ2V0IGVsZW1lbnQgd2FzIG1vdmVkIHRvIGFub3RoZXIgcGFyZW50LlxuXHRcdGlmICghc2Nyb2xsUGFyZW50IHx8ICFzY3JvbGxQYXJlbnQuY29udGFpbnModGFyZ2V0RWxlbWVudCkpIHtcblx0XHRcdHBhcmVudEVsZW1lbnQgPSB0YXJnZXRFbGVtZW50O1xuXHRcdFx0ZG8ge1xuXHRcdFx0XHRpZiAocGFyZW50RWxlbWVudC5zY3JvbGxIZWlnaHQgPiBwYXJlbnRFbGVtZW50Lm9mZnNldEhlaWdodCkge1xuXHRcdFx0XHRcdHNjcm9sbFBhcmVudCA9IHBhcmVudEVsZW1lbnQ7XG5cdFx0XHRcdFx0dGFyZ2V0RWxlbWVudC5mYXN0Q2xpY2tTY3JvbGxQYXJlbnQgPSBwYXJlbnRFbGVtZW50O1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGFyZW50RWxlbWVudCA9IHBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0XHRcdH0gd2hpbGUgKHBhcmVudEVsZW1lbnQpO1xuXHRcdH1cblxuXHRcdC8vIEFsd2F5cyB1cGRhdGUgdGhlIHNjcm9sbCB0b3AgdHJhY2tlciBpZiBwb3NzaWJsZS5cblx0XHRpZiAoc2Nyb2xsUGFyZW50KSB7XG5cdFx0XHRzY3JvbGxQYXJlbnQuZmFzdENsaWNrTGFzdFNjcm9sbFRvcCA9IHNjcm9sbFBhcmVudC5zY3JvbGxUb3A7XG5cdFx0fVxuXHR9O1xuXG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7RXZlbnRUYXJnZXR9IHRhcmdldEVsZW1lbnRcblx0ICogQHJldHVybnMge0VsZW1lbnR8RXZlbnRUYXJnZXR9XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLmdldFRhcmdldEVsZW1lbnRGcm9tRXZlbnRUYXJnZXQgPSBmdW5jdGlvbihldmVudFRhcmdldCkge1xuXG5cdFx0Ly8gT24gc29tZSBvbGRlciBicm93c2VycyAobm90YWJseSBTYWZhcmkgb24gaU9TIDQuMSAtIHNlZSBpc3N1ZSAjNTYpIHRoZSBldmVudCB0YXJnZXQgbWF5IGJlIGEgdGV4dCBub2RlLlxuXHRcdGlmIChldmVudFRhcmdldC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUpIHtcblx0XHRcdHJldHVybiBldmVudFRhcmdldC5wYXJlbnROb2RlO1xuXHRcdH1cblxuXHRcdHJldHVybiBldmVudFRhcmdldDtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBPbiB0b3VjaCBzdGFydCwgcmVjb3JkIHRoZSBwb3NpdGlvbiBhbmQgc2Nyb2xsIG9mZnNldC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uVG91Y2hTdGFydCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0dmFyIHRhcmdldEVsZW1lbnQsIHRvdWNoLCBzZWxlY3Rpb247XG5cblx0XHQvLyBJZ25vcmUgbXVsdGlwbGUgdG91Y2hlcywgb3RoZXJ3aXNlIHBpbmNoLXRvLXpvb20gaXMgcHJldmVudGVkIGlmIGJvdGggZmluZ2VycyBhcmUgb24gdGhlIEZhc3RDbGljayBlbGVtZW50IChpc3N1ZSAjMTExKS5cblx0XHRpZiAoZXZlbnQudGFyZ2V0VG91Y2hlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHR0YXJnZXRFbGVtZW50ID0gdGhpcy5nZXRUYXJnZXRFbGVtZW50RnJvbUV2ZW50VGFyZ2V0KGV2ZW50LnRhcmdldCk7XG5cdFx0dG91Y2ggPSBldmVudC50YXJnZXRUb3VjaGVzWzBdO1xuXG5cdFx0aWYgKGRldmljZUlzSU9TKSB7XG5cblx0XHRcdC8vIE9ubHkgdHJ1c3RlZCBldmVudHMgd2lsbCBkZXNlbGVjdCB0ZXh0IG9uIGlPUyAoaXNzdWUgIzQ5KVxuXHRcdFx0c2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5yYW5nZUNvdW50ICYmICFzZWxlY3Rpb24uaXNDb2xsYXBzZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZGV2aWNlSXNJT1M0KSB7XG5cblx0XHRcdFx0Ly8gV2VpcmQgdGhpbmdzIGhhcHBlbiBvbiBpT1Mgd2hlbiBhbiBhbGVydCBvciBjb25maXJtIGRpYWxvZyBpcyBvcGVuZWQgZnJvbSBhIGNsaWNrIGV2ZW50IGNhbGxiYWNrIChpc3N1ZSAjMjMpOlxuXHRcdFx0XHQvLyB3aGVuIHRoZSB1c2VyIG5leHQgdGFwcyBhbnl3aGVyZSBlbHNlIG9uIHRoZSBwYWdlLCBuZXcgdG91Y2hzdGFydCBhbmQgdG91Y2hlbmQgZXZlbnRzIGFyZSBkaXNwYXRjaGVkXG5cdFx0XHRcdC8vIHdpdGggdGhlIHNhbWUgaWRlbnRpZmllciBhcyB0aGUgdG91Y2ggZXZlbnQgdGhhdCBwcmV2aW91c2x5IHRyaWdnZXJlZCB0aGUgY2xpY2sgdGhhdCB0cmlnZ2VyZWQgdGhlIGFsZXJ0LlxuXHRcdFx0XHQvLyBTYWRseSwgdGhlcmUgaXMgYW4gaXNzdWUgb24gaU9TIDQgdGhhdCBjYXVzZXMgc29tZSBub3JtYWwgdG91Y2ggZXZlbnRzIHRvIGhhdmUgdGhlIHNhbWUgaWRlbnRpZmllciBhcyBhblxuXHRcdFx0XHQvLyBpbW1lZGlhdGVseSBwcmVjZWVkaW5nIHRvdWNoIGV2ZW50IChpc3N1ZSAjNTIpLCBzbyB0aGlzIGZpeCBpcyB1bmF2YWlsYWJsZSBvbiB0aGF0IHBsYXRmb3JtLlxuXHRcdFx0XHQvLyBJc3N1ZSAxMjA6IHRvdWNoLmlkZW50aWZpZXIgaXMgMCB3aGVuIENocm9tZSBkZXYgdG9vbHMgJ0VtdWxhdGUgdG91Y2ggZXZlbnRzJyBpcyBzZXQgd2l0aCBhbiBpT1MgZGV2aWNlIFVBIHN0cmluZyxcblx0XHRcdFx0Ly8gd2hpY2ggY2F1c2VzIGFsbCB0b3VjaCBldmVudHMgdG8gYmUgaWdub3JlZC4gQXMgdGhpcyBibG9jayBvbmx5IGFwcGxpZXMgdG8gaU9TLCBhbmQgaU9TIGlkZW50aWZpZXJzIGFyZSBhbHdheXMgbG9uZyxcblx0XHRcdFx0Ly8gcmFuZG9tIGludGVnZXJzLCBpdCdzIHNhZmUgdG8gdG8gY29udGludWUgaWYgdGhlIGlkZW50aWZpZXIgaXMgMCBoZXJlLlxuXHRcdFx0XHRpZiAodG91Y2guaWRlbnRpZmllciAmJiB0b3VjaC5pZGVudGlmaWVyID09PSB0aGlzLmxhc3RUb3VjaElkZW50aWZpZXIpIHtcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMubGFzdFRvdWNoSWRlbnRpZmllciA9IHRvdWNoLmlkZW50aWZpZXI7XG5cblx0XHRcdFx0Ly8gSWYgdGhlIHRhcmdldCBlbGVtZW50IGlzIGEgY2hpbGQgb2YgYSBzY3JvbGxhYmxlIGxheWVyICh1c2luZyAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2gpIGFuZDpcblx0XHRcdFx0Ly8gMSkgdGhlIHVzZXIgZG9lcyBhIGZsaW5nIHNjcm9sbCBvbiB0aGUgc2Nyb2xsYWJsZSBsYXllclxuXHRcdFx0XHQvLyAyKSB0aGUgdXNlciBzdG9wcyB0aGUgZmxpbmcgc2Nyb2xsIHdpdGggYW5vdGhlciB0YXBcblx0XHRcdFx0Ly8gdGhlbiB0aGUgZXZlbnQudGFyZ2V0IG9mIHRoZSBsYXN0ICd0b3VjaGVuZCcgZXZlbnQgd2lsbCBiZSB0aGUgZWxlbWVudCB0aGF0IHdhcyB1bmRlciB0aGUgdXNlcidzIGZpbmdlclxuXHRcdFx0XHQvLyB3aGVuIHRoZSBmbGluZyBzY3JvbGwgd2FzIHN0YXJ0ZWQsIGNhdXNpbmcgRmFzdENsaWNrIHRvIHNlbmQgYSBjbGljayBldmVudCB0byB0aGF0IGxheWVyIC0gdW5sZXNzIGEgY2hlY2tcblx0XHRcdFx0Ly8gaXMgbWFkZSB0byBlbnN1cmUgdGhhdCBhIHBhcmVudCBsYXllciB3YXMgbm90IHNjcm9sbGVkIGJlZm9yZSBzZW5kaW5nIGEgc3ludGhldGljIGNsaWNrIChpc3N1ZSAjNDIpLlxuXHRcdFx0XHR0aGlzLnVwZGF0ZVNjcm9sbFBhcmVudCh0YXJnZXRFbGVtZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnRyYWNraW5nQ2xpY2sgPSB0cnVlO1xuXHRcdHRoaXMudHJhY2tpbmdDbGlja1N0YXJ0ID0gZXZlbnQudGltZVN0YW1wO1xuXHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IHRhcmdldEVsZW1lbnQ7XG5cblx0XHR0aGlzLnRvdWNoU3RhcnRYID0gdG91Y2gucGFnZVg7XG5cdFx0dGhpcy50b3VjaFN0YXJ0WSA9IHRvdWNoLnBhZ2VZO1xuXG5cdFx0Ly8gUHJldmVudCBwaGFudG9tIGNsaWNrcyBvbiBmYXN0IGRvdWJsZS10YXAgKGlzc3VlICMzNilcblx0XHRpZiAoKGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMubGFzdENsaWNrVGltZSkgPCB0aGlzLnRhcERlbGF5KSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIEJhc2VkIG9uIGEgdG91Y2htb3ZlIGV2ZW50IG9iamVjdCwgY2hlY2sgd2hldGhlciB0aGUgdG91Y2ggaGFzIG1vdmVkIHBhc3QgYSBib3VuZGFyeSBzaW5jZSBpdCBzdGFydGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUudG91Y2hIYXNNb3ZlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0dmFyIHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbMF0sIGJvdW5kYXJ5ID0gdGhpcy50b3VjaEJvdW5kYXJ5O1xuXG5cdFx0aWYgKE1hdGguYWJzKHRvdWNoLnBhZ2VYIC0gdGhpcy50b3VjaFN0YXJ0WCkgPiBib3VuZGFyeSB8fCBNYXRoLmFicyh0b3VjaC5wYWdlWSAtIHRoaXMudG91Y2hTdGFydFkpID4gYm91bmRhcnkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgdGhlIGxhc3QgcG9zaXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5vblRvdWNoTW92ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0aWYgKCF0aGlzLnRyYWNraW5nQ2xpY2spIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSB0b3VjaCBoYXMgbW92ZWQsIGNhbmNlbCB0aGUgY2xpY2sgdHJhY2tpbmdcblx0XHRpZiAodGhpcy50YXJnZXRFbGVtZW50ICE9PSB0aGlzLmdldFRhcmdldEVsZW1lbnRGcm9tRXZlbnRUYXJnZXQoZXZlbnQudGFyZ2V0KSB8fCB0aGlzLnRvdWNoSGFzTW92ZWQoZXZlbnQpKSB7XG5cdFx0XHR0aGlzLnRyYWNraW5nQ2xpY2sgPSBmYWxzZTtcblx0XHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH07XG5cblxuXHQvKipcblx0ICogQXR0ZW1wdCB0byBmaW5kIHRoZSBsYWJlbGxlZCBjb250cm9sIGZvciB0aGUgZ2l2ZW4gbGFiZWwgZWxlbWVudC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudFRhcmdldHxIVE1MTGFiZWxFbGVtZW50fSBsYWJlbEVsZW1lbnRcblx0ICogQHJldHVybnMge0VsZW1lbnR8bnVsbH1cblx0ICovXG5cdEZhc3RDbGljay5wcm90b3R5cGUuZmluZENvbnRyb2wgPSBmdW5jdGlvbihsYWJlbEVsZW1lbnQpIHtcblxuXHRcdC8vIEZhc3QgcGF0aCBmb3IgbmV3ZXIgYnJvd3NlcnMgc3VwcG9ydGluZyB0aGUgSFRNTDUgY29udHJvbCBhdHRyaWJ1dGVcblx0XHRpZiAobGFiZWxFbGVtZW50LmNvbnRyb2wgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGxhYmVsRWxlbWVudC5jb250cm9sO1xuXHRcdH1cblxuXHRcdC8vIEFsbCBicm93c2VycyB1bmRlciB0ZXN0IHRoYXQgc3VwcG9ydCB0b3VjaCBldmVudHMgYWxzbyBzdXBwb3J0IHRoZSBIVE1MNSBodG1sRm9yIGF0dHJpYnV0ZVxuXHRcdGlmIChsYWJlbEVsZW1lbnQuaHRtbEZvcikge1xuXHRcdFx0cmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGxhYmVsRWxlbWVudC5odG1sRm9yKTtcblx0XHR9XG5cblx0XHQvLyBJZiBubyBmb3IgYXR0cmlidXRlIGV4aXN0cywgYXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgZmlyc3QgbGFiZWxsYWJsZSBkZXNjZW5kYW50IGVsZW1lbnRcblx0XHQvLyB0aGUgbGlzdCBvZiB3aGljaCBpcyBkZWZpbmVkIGhlcmU6IGh0dHA6Ly93d3cudzMub3JnL1RSL2h0bWw1L2Zvcm1zLmh0bWwjY2F0ZWdvcnktbGFiZWxcblx0XHRyZXR1cm4gbGFiZWxFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbiwgaW5wdXQ6bm90KFt0eXBlPWhpZGRlbl0pLCBrZXlnZW4sIG1ldGVyLCBvdXRwdXQsIHByb2dyZXNzLCBzZWxlY3QsIHRleHRhcmVhJyk7XG5cdH07XG5cblxuXHQvKipcblx0ICogT24gdG91Y2ggZW5kLCBkZXRlcm1pbmUgd2hldGhlciB0byBzZW5kIGEgY2xpY2sgZXZlbnQgYXQgb25jZS5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRGYXN0Q2xpY2sucHJvdG90eXBlLm9uVG91Y2hFbmQgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdHZhciBmb3JFbGVtZW50LCB0cmFja2luZ0NsaWNrU3RhcnQsIHRhcmdldFRhZ05hbWUsIHNjcm9sbFBhcmVudCwgdG91Y2gsIHRhcmdldEVsZW1lbnQgPSB0aGlzLnRhcmdldEVsZW1lbnQ7XG5cblx0XHRpZiAoIXRoaXMudHJhY2tpbmdDbGljaykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gUHJldmVudCBwaGFudG9tIGNsaWNrcyBvbiBmYXN0IGRvdWJsZS10YXAgKGlzc3VlICMzNilcblx0XHRpZiAoKGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMubGFzdENsaWNrVGltZSkgPCB0aGlzLnRhcERlbGF5KSB7XG5cdFx0XHR0aGlzLmNhbmNlbE5leHRDbGljayA9IHRydWU7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoKGV2ZW50LnRpbWVTdGFtcCAtIHRoaXMudHJhY2tpbmdDbGlja1N0YXJ0KSA+IHRoaXMudGFwVGltZW91dCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzZXQgdG8gcHJldmVudCB3cm9uZyBjbGljayBjYW5jZWwgb24gaW5wdXQgKGlzc3VlICMxNTYpLlxuXHRcdHRoaXMuY2FuY2VsTmV4dENsaWNrID0gZmFsc2U7XG5cblx0XHR0aGlzLmxhc3RDbGlja1RpbWUgPSBldmVudC50aW1lU3RhbXA7XG5cblx0XHR0cmFja2luZ0NsaWNrU3RhcnQgPSB0aGlzLnRyYWNraW5nQ2xpY2tTdGFydDtcblx0XHR0aGlzLnRyYWNraW5nQ2xpY2sgPSBmYWxzZTtcblx0XHR0aGlzLnRyYWNraW5nQ2xpY2tTdGFydCA9IDA7XG5cblx0XHQvLyBPbiBzb21lIGlPUyBkZXZpY2VzLCB0aGUgdGFyZ2V0RWxlbWVudCBzdXBwbGllZCB3aXRoIHRoZSBldmVudCBpcyBpbnZhbGlkIGlmIHRoZSBsYXllclxuXHRcdC8vIGlzIHBlcmZvcm1pbmcgYSB0cmFuc2l0aW9uIG9yIHNjcm9sbCwgYW5kIGhhcyB0byBiZSByZS1kZXRlY3RlZCBtYW51YWxseS4gTm90ZSB0aGF0XG5cdFx0Ly8gZm9yIHRoaXMgdG8gZnVuY3Rpb24gY29ycmVjdGx5LCBpdCBtdXN0IGJlIGNhbGxlZCAqYWZ0ZXIqIHRoZSBldmVudCB0YXJnZXQgaXMgY2hlY2tlZCFcblx0XHQvLyBTZWUgaXNzdWUgIzU3OyBhbHNvIGZpbGVkIGFzIHJkYXI6Ly8xMzA0ODU4OSAuXG5cdFx0aWYgKGRldmljZUlzSU9TV2l0aEJhZFRhcmdldCkge1xuXHRcdFx0dG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1swXTtcblxuXHRcdFx0Ly8gSW4gY2VydGFpbiBjYXNlcyBhcmd1bWVudHMgb2YgZWxlbWVudEZyb21Qb2ludCBjYW4gYmUgbmVnYXRpdmUsIHNvIHByZXZlbnQgc2V0dGluZyB0YXJnZXRFbGVtZW50IHRvIG51bGxcblx0XHRcdHRhcmdldEVsZW1lbnQgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KHRvdWNoLnBhZ2VYIC0gd2luZG93LnBhZ2VYT2Zmc2V0LCB0b3VjaC5wYWdlWSAtIHdpbmRvdy5wYWdlWU9mZnNldCkgfHwgdGFyZ2V0RWxlbWVudDtcblx0XHRcdHRhcmdldEVsZW1lbnQuZmFzdENsaWNrU2Nyb2xsUGFyZW50ID0gdGhpcy50YXJnZXRFbGVtZW50LmZhc3RDbGlja1Njcm9sbFBhcmVudDtcblx0XHR9XG5cblx0XHR0YXJnZXRUYWdOYW1lID0gdGFyZ2V0RWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0aWYgKHRhcmdldFRhZ05hbWUgPT09ICdsYWJlbCcpIHtcblx0XHRcdGZvckVsZW1lbnQgPSB0aGlzLmZpbmRDb250cm9sKHRhcmdldEVsZW1lbnQpO1xuXHRcdFx0aWYgKGZvckVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5mb2N1cyh0YXJnZXRFbGVtZW50KTtcblx0XHRcdFx0aWYgKGRldmljZUlzQW5kcm9pZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRhcmdldEVsZW1lbnQgPSBmb3JFbGVtZW50O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5uZWVkc0ZvY3VzKHRhcmdldEVsZW1lbnQpKSB7XG5cblx0XHRcdC8vIENhc2UgMTogSWYgdGhlIHRvdWNoIHN0YXJ0ZWQgYSB3aGlsZSBhZ28gKGJlc3QgZ3Vlc3MgaXMgMTAwbXMgYmFzZWQgb24gdGVzdHMgZm9yIGlzc3VlICMzNikgdGhlbiBmb2N1cyB3aWxsIGJlIHRyaWdnZXJlZCBhbnl3YXkuIFJldHVybiBlYXJseSBhbmQgdW5zZXQgdGhlIHRhcmdldCBlbGVtZW50IHJlZmVyZW5jZSBzbyB0aGF0IHRoZSBzdWJzZXF1ZW50IGNsaWNrIHdpbGwgYmUgYWxsb3dlZCB0aHJvdWdoLlxuXHRcdFx0Ly8gQ2FzZSAyOiBXaXRob3V0IHRoaXMgZXhjZXB0aW9uIGZvciBpbnB1dCBlbGVtZW50cyB0YXBwZWQgd2hlbiB0aGUgZG9jdW1lbnQgaXMgY29udGFpbmVkIGluIGFuIGlmcmFtZSwgdGhlbiBhbnkgaW5wdXR0ZWQgdGV4dCB3b24ndCBiZSB2aXNpYmxlIGV2ZW4gdGhvdWdoIHRoZSB2YWx1ZSBhdHRyaWJ1dGUgaXMgdXBkYXRlZCBhcyB0aGUgdXNlciB0eXBlcyAoaXNzdWUgIzM3KS5cblx0XHRcdGlmICgoZXZlbnQudGltZVN0YW1wIC0gdHJhY2tpbmdDbGlja1N0YXJ0KSA+IDEwMCB8fCAoZGV2aWNlSXNJT1MgJiYgd2luZG93LnRvcCAhPT0gd2luZG93ICYmIHRhcmdldFRhZ05hbWUgPT09ICdpbnB1dCcpKSB7XG5cdFx0XHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IG51bGw7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5mb2N1cyh0YXJnZXRFbGVtZW50KTtcblx0XHRcdHRoaXMuc2VuZENsaWNrKHRhcmdldEVsZW1lbnQsIGV2ZW50KTtcblxuXHRcdFx0Ly8gU2VsZWN0IGVsZW1lbnRzIG5lZWQgdGhlIGV2ZW50IHRvIGdvIHRocm91Z2ggb24gaU9TIDQsIG90aGVyd2lzZSB0aGUgc2VsZWN0b3IgbWVudSB3b24ndCBvcGVuLlxuXHRcdFx0Ly8gQWxzbyB0aGlzIGJyZWFrcyBvcGVuaW5nIHNlbGVjdHMgd2hlbiBWb2ljZU92ZXIgaXMgYWN0aXZlIG9uIGlPUzYsIGlPUzcgKGFuZCBwb3NzaWJseSBvdGhlcnMpXG5cdFx0XHRpZiAoIWRldmljZUlzSU9TIHx8IHRhcmdldFRhZ05hbWUgIT09ICdzZWxlY3QnKSB7XG5cdFx0XHRcdHRoaXMudGFyZ2V0RWxlbWVudCA9IG51bGw7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoZGV2aWNlSXNJT1MgJiYgIWRldmljZUlzSU9TNCkge1xuXG5cdFx0XHQvLyBEb24ndCBzZW5kIGEgc3ludGhldGljIGNsaWNrIGV2ZW50IGlmIHRoZSB0YXJnZXQgZWxlbWVudCBpcyBjb250YWluZWQgd2l0aGluIGEgcGFyZW50IGxheWVyIHRoYXQgd2FzIHNjcm9sbGVkXG5cdFx0XHQvLyBhbmQgdGhpcyB0YXAgaXMgYmVpbmcgdXNlZCB0byBzdG9wIHRoZSBzY3JvbGxpbmcgKHVzdWFsbHkgaW5pdGlhdGVkIGJ5IGEgZmxpbmcgLSBpc3N1ZSAjNDIpLlxuXHRcdFx0c2Nyb2xsUGFyZW50ID0gdGFyZ2V0RWxlbWVudC5mYXN0Q2xpY2tTY3JvbGxQYXJlbnQ7XG5cdFx0XHRpZiAoc2Nyb2xsUGFyZW50ICYmIHNjcm9sbFBhcmVudC5mYXN0Q2xpY2tMYXN0U2Nyb2xsVG9wICE9PSBzY3JvbGxQYXJlbnQuc2Nyb2xsVG9wKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFByZXZlbnQgdGhlIGFjdHVhbCBjbGljayBmcm9tIGdvaW5nIHRob3VnaCAtIHVubGVzcyB0aGUgdGFyZ2V0IG5vZGUgaXMgbWFya2VkIGFzIHJlcXVpcmluZ1xuXHRcdC8vIHJlYWwgY2xpY2tzIG9yIGlmIGl0IGlzIGluIHRoZSB3aGl0ZWxpc3QgaW4gd2hpY2ggY2FzZSBvbmx5IG5vbi1wcm9ncmFtbWF0aWMgY2xpY2tzIGFyZSBwZXJtaXR0ZWQuXG5cdFx0aWYgKCF0aGlzLm5lZWRzQ2xpY2sodGFyZ2V0RWxlbWVudCkpIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLnNlbmRDbGljayh0YXJnZXRFbGVtZW50LCBldmVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9O1xuXG5cblx0LyoqXG5cdCAqIE9uIHRvdWNoIGNhbmNlbCwgc3RvcCB0cmFja2luZyB0aGUgY2xpY2suXG5cdCAqXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5vblRvdWNoQ2FuY2VsID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy50cmFja2luZ0NsaWNrID0gZmFsc2U7XG5cdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgbW91c2UgZXZlbnRzIHdoaWNoIHNob3VsZCBiZSBwZXJtaXR0ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5vbk1vdXNlID0gZnVuY3Rpb24oZXZlbnQpIHtcblxuXHRcdC8vIElmIGEgdGFyZ2V0IGVsZW1lbnQgd2FzIG5ldmVyIHNldCAoYmVjYXVzZSBhIHRvdWNoIGV2ZW50IHdhcyBuZXZlciBmaXJlZCkgYWxsb3cgdGhlIGV2ZW50XG5cdFx0aWYgKCF0aGlzLnRhcmdldEVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC5mb3J3YXJkZWRUb3VjaEV2ZW50KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBQcm9ncmFtbWF0aWNhbGx5IGdlbmVyYXRlZCBldmVudHMgdGFyZ2V0aW5nIGEgc3BlY2lmaWMgZWxlbWVudCBzaG91bGQgYmUgcGVybWl0dGVkXG5cdFx0aWYgKCFldmVudC5jYW5jZWxhYmxlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBEZXJpdmUgYW5kIGNoZWNrIHRoZSB0YXJnZXQgZWxlbWVudCB0byBzZWUgd2hldGhlciB0aGUgbW91c2UgZXZlbnQgbmVlZHMgdG8gYmUgcGVybWl0dGVkO1xuXHRcdC8vIHVubGVzcyBleHBsaWNpdGx5IGVuYWJsZWQsIHByZXZlbnQgbm9uLXRvdWNoIGNsaWNrIGV2ZW50cyBmcm9tIHRyaWdnZXJpbmcgYWN0aW9ucyxcblx0XHQvLyB0byBwcmV2ZW50IGdob3N0L2RvdWJsZWNsaWNrcy5cblx0XHRpZiAoIXRoaXMubmVlZHNDbGljayh0aGlzLnRhcmdldEVsZW1lbnQpIHx8IHRoaXMuY2FuY2VsTmV4dENsaWNrKSB7XG5cblx0XHRcdC8vIFByZXZlbnQgYW55IHVzZXItYWRkZWQgbGlzdGVuZXJzIGRlY2xhcmVkIG9uIEZhc3RDbGljayBlbGVtZW50IGZyb20gYmVpbmcgZmlyZWQuXG5cdFx0XHRpZiAoZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKSB7XG5cdFx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSBlbHNlIHtcblxuXHRcdFx0XHQvLyBQYXJ0IG9mIHRoZSBoYWNrIGZvciBicm93c2VycyB0aGF0IGRvbid0IHN1cHBvcnQgRXZlbnQjc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIChlLmcuIEFuZHJvaWQgMilcblx0XHRcdFx0ZXZlbnQucHJvcGFnYXRpb25TdG9wcGVkID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2FuY2VsIHRoZSBldmVudFxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIG1vdXNlIGV2ZW50IGlzIHBlcm1pdHRlZCwgcmV0dXJuIHRydWUgZm9yIHRoZSBhY3Rpb24gdG8gZ28gdGhyb3VnaC5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fTtcblxuXG5cdC8qKlxuXHQgKiBPbiBhY3R1YWwgY2xpY2tzLCBkZXRlcm1pbmUgd2hldGhlciB0aGlzIGlzIGEgdG91Y2gtZ2VuZXJhdGVkIGNsaWNrLCBhIGNsaWNrIGFjdGlvbiBvY2N1cnJpbmdcblx0ICogbmF0dXJhbGx5IGFmdGVyIGEgZGVsYXkgYWZ0ZXIgYSB0b3VjaCAod2hpY2ggbmVlZHMgdG8gYmUgY2FuY2VsbGVkIHRvIGF2b2lkIGR1cGxpY2F0aW9uKSwgb3Jcblx0ICogYW4gYWN0dWFsIGNsaWNrIHdoaWNoIHNob3VsZCBiZSBwZXJtaXR0ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5vbkNsaWNrID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgcGVybWl0dGVkO1xuXG5cdFx0Ly8gSXQncyBwb3NzaWJsZSBmb3IgYW5vdGhlciBGYXN0Q2xpY2stbGlrZSBsaWJyYXJ5IGRlbGl2ZXJlZCB3aXRoIHRoaXJkLXBhcnR5IGNvZGUgdG8gZmlyZSBhIGNsaWNrIGV2ZW50IGJlZm9yZSBGYXN0Q2xpY2sgZG9lcyAoaXNzdWUgIzQ0KS4gSW4gdGhhdCBjYXNlLCBzZXQgdGhlIGNsaWNrLXRyYWNraW5nIGZsYWcgYmFjayB0byBmYWxzZSBhbmQgcmV0dXJuIGVhcmx5LiBUaGlzIHdpbGwgY2F1c2Ugb25Ub3VjaEVuZCB0byByZXR1cm4gZWFybHkuXG5cdFx0aWYgKHRoaXMudHJhY2tpbmdDbGljaykge1xuXHRcdFx0dGhpcy50YXJnZXRFbGVtZW50ID0gbnVsbDtcblx0XHRcdHRoaXMudHJhY2tpbmdDbGljayA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gVmVyeSBvZGQgYmVoYXZpb3VyIG9uIGlPUyAoaXNzdWUgIzE4KTogaWYgYSBzdWJtaXQgZWxlbWVudCBpcyBwcmVzZW50IGluc2lkZSBhIGZvcm0gYW5kIHRoZSB1c2VyIGhpdHMgZW50ZXIgaW4gdGhlIGlPUyBzaW11bGF0b3Igb3IgY2xpY2tzIHRoZSBHbyBidXR0b24gb24gdGhlIHBvcC11cCBPUyBrZXlib2FyZCB0aGUgYSBraW5kIG9mICdmYWtlJyBjbGljayBldmVudCB3aWxsIGJlIHRyaWdnZXJlZCB3aXRoIHRoZSBzdWJtaXQtdHlwZSBpbnB1dCBlbGVtZW50IGFzIHRoZSB0YXJnZXQuXG5cdFx0aWYgKGV2ZW50LnRhcmdldC50eXBlID09PSAnc3VibWl0JyAmJiBldmVudC5kZXRhaWwgPT09IDApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHBlcm1pdHRlZCA9IHRoaXMub25Nb3VzZShldmVudCk7XG5cblx0XHQvLyBPbmx5IHVuc2V0IHRhcmdldEVsZW1lbnQgaWYgdGhlIGNsaWNrIGlzIG5vdCBwZXJtaXR0ZWQuIFRoaXMgd2lsbCBlbnN1cmUgdGhhdCB0aGUgY2hlY2sgZm9yICF0YXJnZXRFbGVtZW50IGluIG9uTW91c2UgZmFpbHMgYW5kIHRoZSBicm93c2VyJ3MgY2xpY2sgZG9lc24ndCBnbyB0aHJvdWdoLlxuXHRcdGlmICghcGVybWl0dGVkKSB7XG5cdFx0XHR0aGlzLnRhcmdldEVsZW1lbnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdC8vIElmIGNsaWNrcyBhcmUgcGVybWl0dGVkLCByZXR1cm4gdHJ1ZSBmb3IgdGhlIGFjdGlvbiB0byBnbyB0aHJvdWdoLlxuXHRcdHJldHVybiBwZXJtaXR0ZWQ7XG5cdH07XG5cblxuXHQvKipcblx0ICogUmVtb3ZlIGFsbCBGYXN0Q2xpY2sncyBldmVudCBsaXN0ZW5lcnMuXG5cdCAqXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxuXHQgKi9cblx0RmFzdENsaWNrLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGxheWVyID0gdGhpcy5sYXllcjtcblxuXHRcdGlmIChkZXZpY2VJc0FuZHJvaWQpIHtcblx0XHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlb3ZlcicsIHRoaXMub25Nb3VzZSwgdHJ1ZSk7XG5cdFx0XHRsYXllci5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2UsIHRydWUpO1xuXHRcdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMub25Nb3VzZSwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0bGF5ZXIucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLm9uQ2xpY2ssIHRydWUpO1xuXHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLm9uVG91Y2hTdGFydCwgZmFsc2UpO1xuXHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMub25Ub3VjaE1vdmUsIGZhbHNlKTtcblx0XHRsYXllci5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMub25Ub3VjaEVuZCwgZmFsc2UpO1xuXHRcdGxheWVyLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5vblRvdWNoQ2FuY2VsLCBmYWxzZSk7XG5cdH07XG5cblxuXHQvKipcblx0ICogQ2hlY2sgd2hldGhlciBGYXN0Q2xpY2sgaXMgbmVlZGVkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGxheWVyIFRoZSBsYXllciB0byBsaXN0ZW4gb25cblx0ICovXG5cdEZhc3RDbGljay5ub3ROZWVkZWQgPSBmdW5jdGlvbihsYXllcikge1xuXHRcdHZhciBtZXRhVmlld3BvcnQ7XG5cdFx0dmFyIGNocm9tZVZlcnNpb247XG5cdFx0dmFyIGJsYWNrYmVycnlWZXJzaW9uO1xuXHRcdHZhciBmaXJlZm94VmVyc2lvbjtcblxuXHRcdC8vIERldmljZXMgdGhhdCBkb24ndCBzdXBwb3J0IHRvdWNoIGRvbid0IG5lZWQgRmFzdENsaWNrXG5cdFx0aWYgKHR5cGVvZiB3aW5kb3cub250b3VjaHN0YXJ0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hyb21lIHZlcnNpb24gLSB6ZXJvIGZvciBvdGhlciBicm93c2Vyc1xuXHRcdGNocm9tZVZlcnNpb24gPSArKC9DaHJvbWVcXC8oWzAtOV0rKS8uZXhlYyhuYXZpZ2F0b3IudXNlckFnZW50KSB8fCBbLDBdKVsxXTtcblxuXHRcdGlmIChjaHJvbWVWZXJzaW9uKSB7XG5cblx0XHRcdGlmIChkZXZpY2VJc0FuZHJvaWQpIHtcblx0XHRcdFx0bWV0YVZpZXdwb3J0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtuYW1lPXZpZXdwb3J0XScpO1xuXG5cdFx0XHRcdGlmIChtZXRhVmlld3BvcnQpIHtcblx0XHRcdFx0XHQvLyBDaHJvbWUgb24gQW5kcm9pZCB3aXRoIHVzZXItc2NhbGFibGU9XCJub1wiIGRvZXNuJ3QgbmVlZCBGYXN0Q2xpY2sgKGlzc3VlICM4OSlcblx0XHRcdFx0XHRpZiAobWV0YVZpZXdwb3J0LmNvbnRlbnQuaW5kZXhPZigndXNlci1zY2FsYWJsZT1ubycpICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIENocm9tZSAzMiBhbmQgYWJvdmUgd2l0aCB3aWR0aD1kZXZpY2Utd2lkdGggb3IgbGVzcyBkb24ndCBuZWVkIEZhc3RDbGlja1xuXHRcdFx0XHRcdGlmIChjaHJvbWVWZXJzaW9uID4gMzEgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFdpZHRoIDw9IHdpbmRvdy5vdXRlcldpZHRoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hyb21lIGRlc2t0b3AgZG9lc24ndCBuZWVkIEZhc3RDbGljayAoaXNzdWUgIzE1KVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRldmljZUlzQmxhY2tCZXJyeTEwKSB7XG5cdFx0XHRibGFja2JlcnJ5VmVyc2lvbiA9IG5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goL1ZlcnNpb25cXC8oWzAtOV0qKVxcLihbMC05XSopLyk7XG5cblx0XHRcdC8vIEJsYWNrQmVycnkgMTAuMysgZG9lcyBub3QgcmVxdWlyZSBGYXN0Y2xpY2sgbGlicmFyeS5cblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9mdGxhYnMvZmFzdGNsaWNrL2lzc3Vlcy8yNTFcblx0XHRcdGlmIChibGFja2JlcnJ5VmVyc2lvblsxXSA+PSAxMCAmJiBibGFja2JlcnJ5VmVyc2lvblsyXSA+PSAzKSB7XG5cdFx0XHRcdG1ldGFWaWV3cG9ydCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT12aWV3cG9ydF0nKTtcblxuXHRcdFx0XHRpZiAobWV0YVZpZXdwb3J0KSB7XG5cdFx0XHRcdFx0Ly8gdXNlci1zY2FsYWJsZT1ubyBlbGltaW5hdGVzIGNsaWNrIGRlbGF5LlxuXHRcdFx0XHRcdGlmIChtZXRhVmlld3BvcnQuY29udGVudC5pbmRleE9mKCd1c2VyLXNjYWxhYmxlPW5vJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gd2lkdGg9ZGV2aWNlLXdpZHRoIChvciBsZXNzIHRoYW4gZGV2aWNlLXdpZHRoKSBlbGltaW5hdGVzIGNsaWNrIGRlbGF5LlxuXHRcdFx0XHRcdGlmIChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsV2lkdGggPD0gd2luZG93Lm91dGVyV2lkdGgpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElFMTAgd2l0aCAtbXMtdG91Y2gtYWN0aW9uOiBub25lIG9yIG1hbmlwdWxhdGlvbiwgd2hpY2ggZGlzYWJsZXMgZG91YmxlLXRhcC10by16b29tIChpc3N1ZSAjOTcpXG5cdFx0aWYgKGxheWVyLnN0eWxlLm1zVG91Y2hBY3Rpb24gPT09ICdub25lJyB8fCBsYXllci5zdHlsZS50b3VjaEFjdGlvbiA9PT0gJ21hbmlwdWxhdGlvbicpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIEZpcmVmb3ggdmVyc2lvbiAtIHplcm8gZm9yIG90aGVyIGJyb3dzZXJzXG5cdFx0ZmlyZWZveFZlcnNpb24gPSArKC9GaXJlZm94XFwvKFswLTldKykvLmV4ZWMobmF2aWdhdG9yLnVzZXJBZ2VudCkgfHwgWywwXSlbMV07XG5cblx0XHRpZiAoZmlyZWZveFZlcnNpb24gPj0gMjcpIHtcblx0XHRcdC8vIEZpcmVmb3ggMjcrIGRvZXMgbm90IGhhdmUgdGFwIGRlbGF5IGlmIHRoZSBjb250ZW50IGlzIG5vdCB6b29tYWJsZSAtIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTkyMjg5NlxuXG5cdFx0XHRtZXRhVmlld3BvcnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtZXRhW25hbWU9dmlld3BvcnRdJyk7XG5cdFx0XHRpZiAobWV0YVZpZXdwb3J0ICYmIChtZXRhVmlld3BvcnQuY29udGVudC5pbmRleE9mKCd1c2VyLXNjYWxhYmxlPW5vJykgIT09IC0xIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxXaWR0aCA8PSB3aW5kb3cub3V0ZXJXaWR0aCkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSUUxMTogcHJlZml4ZWQgLW1zLXRvdWNoLWFjdGlvbiBpcyBubyBsb25nZXIgc3VwcG9ydGVkIGFuZCBpdCdzIHJlY29tZW5kZWQgdG8gdXNlIG5vbi1wcmVmaXhlZCB2ZXJzaW9uXG5cdFx0Ly8gaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L3dpbmRvd3MvYXBwcy9IaDc2NzMxMy5hc3B4XG5cdFx0aWYgKGxheWVyLnN0eWxlLnRvdWNoQWN0aW9uID09PSAnbm9uZScgfHwgbGF5ZXIuc3R5bGUudG91Y2hBY3Rpb24gPT09ICdtYW5pcHVsYXRpb24nKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH07XG5cblxuXHQvKipcblx0ICogRmFjdG9yeSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgRmFzdENsaWNrIG9iamVjdFxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGxheWVyIFRoZSBsYXllciB0byBsaXN0ZW4gb25cblx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBUaGUgb3B0aW9ucyB0byBvdmVycmlkZSB0aGUgZGVmYXVsdHNcblx0ICovXG5cdEZhc3RDbGljay5hdHRhY2ggPSBmdW5jdGlvbihsYXllciwgb3B0aW9ucykge1xuXHRcdHJldHVybiBuZXcgRmFzdENsaWNrKGxheWVyLCBvcHRpb25zKTtcblx0fTtcblxuXG5cdGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XG5cblx0XHQvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIEZhc3RDbGljaztcblx0XHR9KTtcblx0fSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRcdG1vZHVsZS5leHBvcnRzID0gRmFzdENsaWNrLmF0dGFjaDtcblx0XHRtb2R1bGUuZXhwb3J0cy5GYXN0Q2xpY2sgPSBGYXN0Q2xpY2s7XG5cdH0gZWxzZSB7XG5cdFx0d2luZG93LkZhc3RDbGljayA9IEZhc3RDbGljaztcblx0fVxufSgpKTtcbiIsIlxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQnVyc3QsIFN3aXJsLCBUcmFuc2l0LCBiaXRzTWFwLCBoLFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIF9fZXh0ZW5kcyA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoX19oYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9O1xuXG4gIGJpdHNNYXAgPSByZXF1aXJlKCcuL3NoYXBlcy9iaXRzTWFwJyk7XG5cbiAgVHJhbnNpdCA9IHJlcXVpcmUoJy4vdHJhbnNpdCcpO1xuXG4gIFN3aXJsID0gcmVxdWlyZSgnLi9zd2lybCcpO1xuXG4gIGggPSByZXF1aXJlKCcuL2gnKTtcblxuICBCdXJzdCA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoQnVyc3QsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBCdXJzdCgpIHtcbiAgICAgIHJldHVybiBCdXJzdC5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuc2tpcFByb3BzID0ge1xuICAgICAgY2hpbGRPcHRpb25zOiAxXG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5kZWZhdWx0cyA9IHtcbiAgICAgIGNvdW50OiA1LFxuICAgICAgZGVncmVlOiAzNjAsXG4gICAgICBvcGFjaXR5OiAxLFxuICAgICAgcmFuZG9tQW5nbGU6IDAsXG4gICAgICByYW5kb21SYWRpdXM6IDAsXG4gICAgICB4OiAxMDAsXG4gICAgICB5OiAxMDAsXG4gICAgICBzaGlmdFg6IDAsXG4gICAgICBzaGlmdFk6IDAsXG4gICAgICBlYXNpbmc6ICdMaW5lYXIuTm9uZScsXG4gICAgICByYWRpdXM6IHtcbiAgICAgICAgMjU6IDc1XG4gICAgICB9LFxuICAgICAgcmFkaXVzWDogdm9pZCAwLFxuICAgICAgcmFkaXVzWTogdm9pZCAwLFxuICAgICAgYW5nbGU6IDAsXG4gICAgICBzaXplOiBudWxsLFxuICAgICAgc2l6ZUdhcDogMCxcbiAgICAgIGR1cmF0aW9uOiA2MDAsXG4gICAgICBkZWxheTogMCxcbiAgICAgIG9uU3RhcnQ6IG51bGwsXG4gICAgICBvbkNvbXBsZXRlOiBudWxsLFxuICAgICAgb25Db21wbGV0ZUNoYWluOiBudWxsLFxuICAgICAgb25VcGRhdGU6IG51bGwsXG4gICAgICBpc1Jlc2V0QW5nbGVzOiBmYWxzZVxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuY2hpbGREZWZhdWx0cyA9IHtcbiAgICAgIHJhZGl1czoge1xuICAgICAgICA3OiAwXG4gICAgICB9LFxuICAgICAgcmFkaXVzWDogdm9pZCAwLFxuICAgICAgcmFkaXVzWTogdm9pZCAwLFxuICAgICAgYW5nbGU6IDAsXG4gICAgICBvcGFjaXR5OiAxLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uQ29tcGxldGU6IG51bGwsXG4gICAgICBvblVwZGF0ZTogbnVsbCxcbiAgICAgIHBvaW50czogMyxcbiAgICAgIGR1cmF0aW9uOiA1MDAsXG4gICAgICBkZWxheTogMCxcbiAgICAgIHJlcGVhdDogMCxcbiAgICAgIHlveW86IGZhbHNlLFxuICAgICAgZWFzaW5nOiAnTGluZWFyLk5vbmUnLFxuICAgICAgdHlwZTogJ2NpcmNsZScsXG4gICAgICBmaWxsOiAnZGVlcHBpbmsnLFxuICAgICAgZmlsbE9wYWNpdHk6IDEsXG4gICAgICBpc1N3aXJsOiBmYWxzZSxcbiAgICAgIHN3aXJsU2l6ZTogMTAsXG4gICAgICBzd2lybEZyZXF1ZW5jeTogMyxcbiAgICAgIHN0cm9rZTogJ3RyYW5zcGFyZW50JyxcbiAgICAgIHN0cm9rZVdpZHRoOiAwLFxuICAgICAgc3Ryb2tlT3BhY2l0eTogMSxcbiAgICAgIHN0cm9rZURhc2hhcnJheTogJycsXG4gICAgICBzdHJva2VEYXNob2Zmc2V0OiAnJyxcbiAgICAgIHN0cm9rZUxpbmVjYXA6IG51bGxcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLm9wdGlvbnNJbnRlcnNlY3Rpb24gPSB7XG4gICAgICByYWRpdXM6IDEsXG4gICAgICByYWRpdXNYOiAxLFxuICAgICAgcmFkaXVzWTogMSxcbiAgICAgIGFuZ2xlOiAxLFxuICAgICAgb3BhY2l0eTogMSxcbiAgICAgIG9uU3RhcnQ6IDEsXG4gICAgICBvbkNvbXBsZXRlOiAxLFxuICAgICAgb25VcGRhdGU6IDFcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBpLCBrZXksIGtleXMsIGxlbiwgb3B0aW9uLCB0ciwgX2Jhc2UsIF9pLCBfbGVuLCBfcmVmLCBfcmVmMTtcbiAgICAgIGlmICgobyAhPSBudWxsKSAmJiBPYmplY3Qua2V5cyhvKS5sZW5ndGgpIHtcbiAgICAgICAgaWYgKG8uY291bnQgfHwgKChfcmVmID0gby5jaGlsZE9wdGlvbnMpICE9IG51bGwgPyBfcmVmLmNvdW50IDogdm9pZCAwKSkge1xuICAgICAgICAgIHRoaXMuaC53YXJuKCdTb3JyeSwgY291bnQgY2FuIG5vdCBiZSBjaGFuZ2VkIG9uIHJ1bicpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZXh0ZW5kRGVmYXVsdHMobyk7XG4gICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhvLmNoaWxkT3B0aW9ucyB8fCB7fSk7XG4gICAgICAgIGlmICgoX2Jhc2UgPSB0aGlzLm8pLmNoaWxkT3B0aW9ucyA9PSBudWxsKSB7XG4gICAgICAgICAgX2Jhc2UuY2hpbGRPcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0ga2V5cy5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICAgIHRoaXMuby5jaGlsZE9wdGlvbnNba2V5XSA9IG8uY2hpbGRPcHRpb25zW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgbGVuID0gdGhpcy50cmFuc2l0cy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICAgIG9wdGlvbiA9IHRoaXMuZ2V0T3B0aW9uKGxlbik7XG4gICAgICAgICAgaWYgKCgoKF9yZWYxID0gby5jaGlsZE9wdGlvbnMpICE9IG51bGwgPyBfcmVmMS5hbmdsZSA6IHZvaWQgMCkgPT0gbnVsbCkgJiYgKG8uYW5nbGVTaGlmdCA9PSBudWxsKSkge1xuICAgICAgICAgICAgb3B0aW9uLmFuZ2xlID0gdGhpcy50cmFuc2l0c1tsZW5dLm8uYW5nbGU7XG4gICAgICAgICAgfSBlbHNlIGlmICghby5pc1Jlc2V0QW5nbGVzKSB7XG4gICAgICAgICAgICBvcHRpb24uYW5nbGUgPSB0aGlzLmdldEJpdEFuZ2xlKG9wdGlvbi5hbmdsZSwgbGVuKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy50cmFuc2l0c1tsZW5dLnR1bmVOZXdPcHRpb24ob3B0aW9uLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnRpbWVsaW5lLnJlY2FsY0R1cmF0aW9uKCk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5wcm9wcy5yYW5kb21BbmdsZSB8fCB0aGlzLnByb3BzLnJhbmRvbVJhZGl1cykge1xuICAgICAgICBsZW4gPSB0aGlzLnRyYW5zaXRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgICAgdHIgPSB0aGlzLnRyYW5zaXRzW2xlbl07XG4gICAgICAgICAgdGhpcy5wcm9wcy5yYW5kb21BbmdsZSAmJiB0ci5zZXRQcm9wKHtcbiAgICAgICAgICAgIGFuZ2xlU2hpZnQ6IHRoaXMuZ2VuZXJhdGVSYW5kb21BbmdsZSgpXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5wcm9wcy5yYW5kb21SYWRpdXMgJiYgdHIuc2V0UHJvcCh7XG4gICAgICAgICAgICByYWRpdXNTY2FsZTogdGhpcy5nZW5lcmF0ZVJhbmRvbVJhZGl1cygpXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0VHdlZW4oKTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmNyZWF0ZUJpdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIG9wdGlvbiwgX2ksIF9yZWYsIF9yZXN1bHRzO1xuICAgICAgdGhpcy50cmFuc2l0cyA9IFtdO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX3JlZiA9IHRoaXMucHJvcHMuY291bnQ7IDAgPD0gX3JlZiA/IF9pIDwgX3JlZiA6IF9pID4gX3JlZjsgaSA9IDAgPD0gX3JlZiA/ICsrX2kgOiAtLV9pKSB7XG4gICAgICAgIG9wdGlvbiA9IHRoaXMuZ2V0T3B0aW9uKGkpO1xuICAgICAgICBvcHRpb24uY3R4ID0gdGhpcy5jdHg7XG4gICAgICAgIG9wdGlvbi5pbmRleCA9IGk7XG4gICAgICAgIG9wdGlvbi5pc0RyYXdMZXNzID0gb3B0aW9uLmlzUnVuTGVzcyA9IG9wdGlvbi5pc1R3ZWVuTGVzcyA9IHRydWU7XG4gICAgICAgIHRoaXMucHJvcHMucmFuZG9tQW5nbGUgJiYgKG9wdGlvbi5hbmdsZVNoaWZ0ID0gdGhpcy5nZW5lcmF0ZVJhbmRvbUFuZ2xlKCkpO1xuICAgICAgICB0aGlzLnByb3BzLnJhbmRvbVJhZGl1cyAmJiAob3B0aW9uLnJhZGl1c1NjYWxlID0gdGhpcy5nZW5lcmF0ZVJhbmRvbVJhZGl1cygpKTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnRyYW5zaXRzLnB1c2gobmV3IFN3aXJsKG9wdGlvbikpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmFkZEJpdE9wdGlvbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhU2hpZnQsIGksIHBvaW50RW5kLCBwb2ludFN0YXJ0LCBwb2ludHMsIHN0ZXAsIHRyYW5zaXQsIF9pLCBfbGVuLCBfcmVmLCBfcmVzdWx0cztcbiAgICAgIHBvaW50cyA9IHRoaXMucHJvcHMuY291bnQ7XG4gICAgICB0aGlzLmRlZ3JlZUNudCA9IHRoaXMucHJvcHMuZGVncmVlICUgMzYwID09PSAwID8gcG9pbnRzIDogcG9pbnRzIC0gMSB8fCAxO1xuICAgICAgc3RlcCA9IHRoaXMucHJvcHMuZGVncmVlIC8gdGhpcy5kZWdyZWVDbnQ7XG4gICAgICBfcmVmID0gdGhpcy50cmFuc2l0cztcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICB0cmFuc2l0ID0gX3JlZltpXTtcbiAgICAgICAgYVNoaWZ0ID0gdHJhbnNpdC5wcm9wcy5hbmdsZVNoaWZ0IHx8IDA7XG4gICAgICAgIHBvaW50U3RhcnQgPSB0aGlzLmdldFNpZGVQb2ludCgnc3RhcnQnLCBpICogc3RlcCArIGFTaGlmdCk7XG4gICAgICAgIHBvaW50RW5kID0gdGhpcy5nZXRTaWRlUG9pbnQoJ2VuZCcsIGkgKiBzdGVwICsgYVNoaWZ0KTtcbiAgICAgICAgdHJhbnNpdC5vLnggPSB0aGlzLmdldERlbHRhRnJvbVBvaW50cygneCcsIHBvaW50U3RhcnQsIHBvaW50RW5kKTtcbiAgICAgICAgdHJhbnNpdC5vLnkgPSB0aGlzLmdldERlbHRhRnJvbVBvaW50cygneScsIHBvaW50U3RhcnQsIHBvaW50RW5kKTtcbiAgICAgICAgaWYgKCF0aGlzLnByb3BzLmlzUmVzZXRBbmdsZXMpIHtcbiAgICAgICAgICB0cmFuc2l0Lm8uYW5nbGUgPSB0aGlzLmdldEJpdEFuZ2xlKHRyYW5zaXQuby5hbmdsZSwgaSk7XG4gICAgICAgIH1cbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0cmFuc2l0LmV4dGVuZERlZmF1bHRzKCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2V0Qml0QW5nbGUgPSBmdW5jdGlvbihhbmdsZSwgaSkge1xuICAgICAgdmFyIGFuZ2xlQWRkaXRpb24sIGFuZ2xlU2hpZnQsIGN1ckFuZ2xlU2hpZnQsIGRlZ0NudCwgZGVsdGEsIGVuZCwga2V5cywgbmV3RW5kLCBuZXdTdGFydCwgcG9pbnRzLCBzdGFydCwgc3RlcDtcbiAgICAgIHBvaW50cyA9IHRoaXMucHJvcHMuY291bnQ7XG4gICAgICBkZWdDbnQgPSB0aGlzLnByb3BzLmRlZ3JlZSAlIDM2MCA9PT0gMCA/IHBvaW50cyA6IHBvaW50cyAtIDEgfHwgMTtcbiAgICAgIHN0ZXAgPSB0aGlzLnByb3BzLmRlZ3JlZSAvIGRlZ0NudDtcbiAgICAgIGFuZ2xlQWRkaXRpb24gPSBpICogc3RlcCArIDkwO1xuICAgICAgYW5nbGVTaGlmdCA9IHRoaXMudHJhbnNpdHNbaV0ucHJvcHMuYW5nbGVTaGlmdCB8fCAwO1xuICAgICAgYW5nbGUgPSB0eXBlb2YgYW5nbGUgIT09ICdvYmplY3QnID8gYW5nbGUgKyBhbmdsZUFkZGl0aW9uICsgYW5nbGVTaGlmdCA6IChrZXlzID0gT2JqZWN0LmtleXMoYW5nbGUpLCBzdGFydCA9IGtleXNbMF0sIGVuZCA9IGFuZ2xlW3N0YXJ0XSwgY3VyQW5nbGVTaGlmdCA9IGFuZ2xlQWRkaXRpb24gKyBhbmdsZVNoaWZ0LCBuZXdTdGFydCA9IHBhcnNlRmxvYXQoc3RhcnQpICsgY3VyQW5nbGVTaGlmdCwgbmV3RW5kID0gcGFyc2VGbG9hdChlbmQpICsgY3VyQW5nbGVTaGlmdCwgZGVsdGEgPSB7fSwgZGVsdGFbbmV3U3RhcnRdID0gbmV3RW5kLCBkZWx0YSk7XG4gICAgICByZXR1cm4gYW5nbGU7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5nZXRTaWRlUG9pbnQgPSBmdW5jdGlvbihzaWRlLCBhbmdsZSkge1xuICAgICAgdmFyIHBvaW50U3RhcnQsIHNpZGVSYWRpdXM7XG4gICAgICBzaWRlUmFkaXVzID0gdGhpcy5nZXRTaWRlUmFkaXVzKHNpZGUpO1xuICAgICAgcmV0dXJuIHBvaW50U3RhcnQgPSB0aGlzLmguZ2V0UmFkaWFsUG9pbnQoe1xuICAgICAgICByYWRpdXM6IHNpZGVSYWRpdXMucmFkaXVzLFxuICAgICAgICByYWRpdXNYOiBzaWRlUmFkaXVzLnJhZGl1c1gsXG4gICAgICAgIHJhZGl1c1k6IHNpZGVSYWRpdXMucmFkaXVzWSxcbiAgICAgICAgYW5nbGU6IGFuZ2xlLFxuICAgICAgICBjZW50ZXI6IHtcbiAgICAgICAgICB4OiB0aGlzLnByb3BzLmNlbnRlcixcbiAgICAgICAgICB5OiB0aGlzLnByb3BzLmNlbnRlclxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdldFNpZGVSYWRpdXMgPSBmdW5jdGlvbihzaWRlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICByYWRpdXM6IHRoaXMuZ2V0UmFkaXVzQnlLZXkoJ3JhZGl1cycsIHNpZGUpLFxuICAgICAgICByYWRpdXNYOiB0aGlzLmdldFJhZGl1c0J5S2V5KCdyYWRpdXNYJywgc2lkZSksXG4gICAgICAgIHJhZGl1c1k6IHRoaXMuZ2V0UmFkaXVzQnlLZXkoJ3JhZGl1c1knLCBzaWRlKVxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdldFJhZGl1c0J5S2V5ID0gZnVuY3Rpb24oa2V5LCBzaWRlKSB7XG4gICAgICBpZiAodGhpcy5kZWx0YXNba2V5XSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRlbHRhc1trZXldW3NpZGVdO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnByb3BzW2tleV0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1trZXldO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuZ2V0RGVsdGFGcm9tUG9pbnRzID0gZnVuY3Rpb24oa2V5LCBwb2ludFN0YXJ0LCBwb2ludEVuZCkge1xuICAgICAgdmFyIGRlbHRhO1xuICAgICAgZGVsdGEgPSB7fTtcbiAgICAgIGlmIChwb2ludFN0YXJ0W2tleV0gPT09IHBvaW50RW5kW2tleV0pIHtcbiAgICAgICAgcmV0dXJuIGRlbHRhID0gcG9pbnRTdGFydFtrZXldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsdGFbcG9pbnRTdGFydFtrZXldXSA9IHBvaW50RW5kW2tleV07XG4gICAgICAgIHJldHVybiBkZWx0YTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbihwcm9ncmVzcykge1xuICAgICAgcmV0dXJuIHRoaXMuZHJhd0VsKCk7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5pc05lZWRzVHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5pc1Byb3BDaGFuZ2VkKCdzaGlmdFgnKSB8fCB0aGlzLmlzUHJvcENoYW5nZWQoJ3NoaWZ0WScpIHx8IHRoaXMuaXNQcm9wQ2hhbmdlZCgnYW5nbGUnKTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmZpbGxUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBcInJvdGF0ZShcIiArIHRoaXMucHJvcHMuYW5nbGUgKyBcImRlZykgdHJhbnNsYXRlKFwiICsgdGhpcy5wcm9wcy5zaGlmdFggKyBcIiwgXCIgKyB0aGlzLnByb3BzLnNoaWZ0WSArIFwiKVwiO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUuY3JlYXRlVHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBfcmVzdWx0cztcbiAgICAgIEJ1cnN0Ll9fc3VwZXJfXy5jcmVhdGVUd2Vlbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgaSA9IHRoaXMudHJhbnNpdHMubGVuZ3RoO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnRpbWVsaW5lLmFkZCh0aGlzLnRyYW5zaXRzW2ldLnR3ZWVuKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5jYWxjU2l6ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGxhcmdlc3RTaXplLCByYWRpdXMsIHRyYW5zaXQsIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgbGFyZ2VzdFNpemUgPSAtMTtcbiAgICAgIF9yZWYgPSB0aGlzLnRyYW5zaXRzO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gX3JlZi5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgdHJhbnNpdCA9IF9yZWZbaV07XG4gICAgICAgIHRyYW5zaXQuY2FsY1NpemUoKTtcbiAgICAgICAgaWYgKGxhcmdlc3RTaXplIDwgdHJhbnNpdC5wcm9wcy5zaXplKSB7XG4gICAgICAgICAgbGFyZ2VzdFNpemUgPSB0cmFuc2l0LnByb3BzLnNpemU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJhZGl1cyA9IHRoaXMuY2FsY01heFJhZGl1cygpO1xuICAgICAgdGhpcy5wcm9wcy5zaXplID0gbGFyZ2VzdFNpemUgKyAyICogcmFkaXVzO1xuICAgICAgdGhpcy5wcm9wcy5zaXplICs9IDIgKiB0aGlzLnByb3BzLnNpemVHYXA7XG4gICAgICB0aGlzLnByb3BzLmNlbnRlciA9IHRoaXMucHJvcHMuc2l6ZSAvIDI7XG4gICAgICByZXR1cm4gdGhpcy5hZGRCaXRPcHRpb25zKCk7XG4gICAgfTtcblxuICAgIEJ1cnN0LnByb3RvdHlwZS5nZXRPcHRpb24gPSBmdW5jdGlvbihpKSB7XG4gICAgICB2YXIga2V5LCBrZXlzLCBsZW4sIG9wdGlvbjtcbiAgICAgIG9wdGlvbiA9IHt9O1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuY2hpbGREZWZhdWx0cyk7XG4gICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgIG9wdGlvbltrZXldID0gdGhpcy5nZXRQcm9wQnlNb2Qoe1xuICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgIGk6IGksXG4gICAgICAgICAgZnJvbTogdGhpcy5vLmNoaWxkT3B0aW9uc1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9uc0ludGVyc2VjdGlvbltrZXldKSB7XG4gICAgICAgICAgaWYgKG9wdGlvbltrZXldID09IG51bGwpIHtcbiAgICAgICAgICAgIG9wdGlvbltrZXldID0gdGhpcy5nZXRQcm9wQnlNb2Qoe1xuICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgaTogaSxcbiAgICAgICAgICAgICAgZnJvbTogdGhpcy5jaGlsZERlZmF1bHRzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbltrZXldID09IG51bGwpIHtcbiAgICAgICAgICBvcHRpb25ba2V5XSA9IHRoaXMuZ2V0UHJvcEJ5TW9kKHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgaTogaSxcbiAgICAgICAgICAgIGZyb206IHRoaXMub1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25ba2V5XSA9PSBudWxsKSB7XG4gICAgICAgICAgb3B0aW9uW2tleV0gPSB0aGlzLmdldFByb3BCeU1vZCh7XG4gICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgIGk6IGksXG4gICAgICAgICAgICBmcm9tOiB0aGlzLmNoaWxkRGVmYXVsdHNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG9wdGlvbjtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdldFByb3BCeU1vZCA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBwcm9wLCBfcmVmO1xuICAgICAgcHJvcCA9IChfcmVmID0gby5mcm9tIHx8IHRoaXMuby5jaGlsZE9wdGlvbnMpICE9IG51bGwgPyBfcmVmW28ua2V5XSA6IHZvaWQgMDtcbiAgICAgIGlmICh0aGlzLmguaXNBcnJheShwcm9wKSkge1xuICAgICAgICByZXR1cm4gcHJvcFtvLmkgJSBwcm9wLmxlbmd0aF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcHJvcDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdlbmVyYXRlUmFuZG9tQW5nbGUgPSBmdW5jdGlvbihpKSB7XG4gICAgICB2YXIgcmFuZGRvbW5lc3MsIHJhbmRvbW5lc3M7XG4gICAgICByYW5kb21uZXNzID0gcGFyc2VGbG9hdCh0aGlzLnByb3BzLnJhbmRvbUFuZ2xlKTtcbiAgICAgIHJhbmRkb21uZXNzID0gcmFuZG9tbmVzcyA+IDEgPyAxIDogcmFuZG9tbmVzcyA8IDAgPyAwIDogdm9pZCAwO1xuICAgICAgcmV0dXJuIHRoaXMuaC5yYW5kKDAsIHJhbmRvbW5lc3MgPyByYW5kb21uZXNzICogMzYwIDogMTgwKTtcbiAgICB9O1xuXG4gICAgQnVyc3QucHJvdG90eXBlLmdlbmVyYXRlUmFuZG9tUmFkaXVzID0gZnVuY3Rpb24oaSkge1xuICAgICAgdmFyIHJhbmRkb21uZXNzLCByYW5kb21uZXNzLCBzdGFydDtcbiAgICAgIHJhbmRvbW5lc3MgPSBwYXJzZUZsb2F0KHRoaXMucHJvcHMucmFuZG9tUmFkaXVzKTtcbiAgICAgIHJhbmRkb21uZXNzID0gcmFuZG9tbmVzcyA+IDEgPyAxIDogcmFuZG9tbmVzcyA8IDAgPyAwIDogdm9pZCAwO1xuICAgICAgc3RhcnQgPSByYW5kb21uZXNzID8gKDEgLSByYW5kb21uZXNzKSAqIDEwMCA6ICgxIC0gLjUpICogMTAwO1xuICAgICAgcmV0dXJuIHRoaXMuaC5yYW5kKHN0YXJ0LCAxMDApIC8gMTAwO1xuICAgIH07XG5cbiAgICBCdXJzdC5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHRoaXMuaC5lcnJvcihcIkJ1cnN0J3MgXFxcInRoZW5cXFwiIG1ldGhvZCBpcyB1bmRlciBjb25zaWRlcmF0aW9uLCB5b3UgY2FuIHZvdGUgZm9yIGl0IGluIGdpdGh1YiByZXBvIGlzc3Vlc1wiKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICByZXR1cm4gQnVyc3Q7XG5cbiAgfSkoVHJhbnNpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBCdXJzdDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIEJlemllckVhc2luZywgYmV6aWVyRWFzaW5nLCBoLFxuICAgIF9faW5kZXhPZiA9IFtdLmluZGV4T2YgfHwgZnVuY3Rpb24oaXRlbSkgeyBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7IGlmIChpIGluIHRoaXMgJiYgdGhpc1tpXSA9PT0gaXRlbSkgcmV0dXJuIGk7IH0gcmV0dXJuIC0xOyB9O1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cblxuICAvKipcbiAgICogQ29weXJpZ2h0IChjKSAyMDE0IEdhw6t0YW4gUmVuYXVkZWF1IGh0dHA6Ly9nb28uZ2wvRWwzazd1XG4gICAqIEFkb3B0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vZ3JlL2Jlemllci1lYXNpbmdcbiAgICovXG5cbiAgQmV6aWVyRWFzaW5nID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIEJlemllckVhc2luZyhvKSB7XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICAgIHJldHVybiB0aGlzLmdlbmVyYXRlO1xuICAgIH1cblxuICAgIEJlemllckVhc2luZy5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZ2VuZXJhdGUgPSBoLmJpbmQodGhpcy5nZW5lcmF0ZSwgdGhpcyk7XG4gICAgfTtcblxuICAgIEJlemllckVhc2luZy5wcm90b3R5cGUuZ2VuZXJhdGUgPSBmdW5jdGlvbihtWDEsIG1ZMSwgbVgyLCBtWTIpIHtcbiAgICAgIHZhciBBLCBCLCBDLCBORVdUT05fSVRFUkFUSU9OUywgTkVXVE9OX01JTl9TTE9QRSwgU1VCRElWSVNJT05fTUFYX0lURVJBVElPTlMsIFNVQkRJVklTSU9OX1BSRUNJU0lPTiwgYXJnLCBiaW5hcnlTdWJkaXZpZGUsIGNhbGNCZXppZXIsIGNhbGNTYW1wbGVWYWx1ZXMsIGYsIGZsb2F0MzJBcnJheVN1cHBvcnRlZCwgZ2V0U2xvcGUsIGdldFRGb3JYLCBpLCBrU2FtcGxlU3RlcFNpemUsIGtTcGxpbmVUYWJsZVNpemUsIG1TYW1wbGVWYWx1ZXMsIG5ld3RvblJhcGhzb25JdGVyYXRlLCBwcmVjb21wdXRlLCBzdHIsIF9pLCBfcHJlY29tcHV0ZWQ7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoJ0JlemllciBmdW5jdGlvbiBleHBlY3RzIDQgYXJndW1lbnRzJyk7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSBfaSA9IDA7IF9pIDwgNDsgaSA9ICsrX2kpIHtcbiAgICAgICAgYXJnID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBpZiAodHlwZW9mIGFyZyAhPT0gXCJudW1iZXJcIiB8fCBpc05hTihhcmcpIHx8ICFpc0Zpbml0ZShhcmcpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZXJyb3IoJ0JlemllciBmdW5jdGlvbiBleHBlY3RzIDQgYXJndW1lbnRzJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChtWDEgPCAwIHx8IG1YMSA+IDEgfHwgbVgyIDwgMCB8fCBtWDIgPiAxKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVycm9yKCdCZXppZXIgeCB2YWx1ZXMgc2hvdWxkIGJlID4gMCBhbmQgPCAxJyk7XG4gICAgICB9XG4gICAgICBORVdUT05fSVRFUkFUSU9OUyA9IDQ7XG4gICAgICBORVdUT05fTUlOX1NMT1BFID0gMC4wMDE7XG4gICAgICBTVUJESVZJU0lPTl9QUkVDSVNJT04gPSAwLjAwMDAwMDE7XG4gICAgICBTVUJESVZJU0lPTl9NQVhfSVRFUkFUSU9OUyA9IDEwO1xuICAgICAga1NwbGluZVRhYmxlU2l6ZSA9IDExO1xuICAgICAga1NhbXBsZVN0ZXBTaXplID0gMS4wIC8gKGtTcGxpbmVUYWJsZVNpemUgLSAxLjApO1xuICAgICAgZmxvYXQzMkFycmF5U3VwcG9ydGVkID0gX19pbmRleE9mLmNhbGwoZ2xvYmFsLCAnRmxvYXQzMkFycmF5JykgPj0gMDtcbiAgICAgIEEgPSBmdW5jdGlvbihhQTEsIGFBMikge1xuICAgICAgICByZXR1cm4gMS4wIC0gMy4wICogYUEyICsgMy4wICogYUExO1xuICAgICAgfTtcbiAgICAgIEIgPSBmdW5jdGlvbihhQTEsIGFBMikge1xuICAgICAgICByZXR1cm4gMy4wICogYUEyIC0gNi4wICogYUExO1xuICAgICAgfTtcbiAgICAgIEMgPSBmdW5jdGlvbihhQTEpIHtcbiAgICAgICAgcmV0dXJuIDMuMCAqIGFBMTtcbiAgICAgIH07XG4gICAgICBjYWxjQmV6aWVyID0gZnVuY3Rpb24oYVQsIGFBMSwgYUEyKSB7XG4gICAgICAgIHJldHVybiAoKEEoYUExLCBhQTIpICogYVQgKyBCKGFBMSwgYUEyKSkgKiBhVCArIEMoYUExKSkgKiBhVDtcbiAgICAgIH07XG4gICAgICBnZXRTbG9wZSA9IGZ1bmN0aW9uKGFULCBhQTEsIGFBMikge1xuICAgICAgICByZXR1cm4gMy4wICogQShhQTEsIGFBMikgKiBhVCAqIGFUICsgMi4wICogQihhQTEsIGFBMikgKiBhVCArIEMoYUExKTtcbiAgICAgIH07XG4gICAgICBuZXd0b25SYXBoc29uSXRlcmF0ZSA9IGZ1bmN0aW9uKGFYLCBhR3Vlc3NUKSB7XG4gICAgICAgIHZhciBjdXJyZW50U2xvcGUsIGN1cnJlbnRYO1xuICAgICAgICBpID0gMDtcbiAgICAgICAgd2hpbGUgKGkgPCBORVdUT05fSVRFUkFUSU9OUykge1xuICAgICAgICAgIGN1cnJlbnRTbG9wZSA9IGdldFNsb3BlKGFHdWVzc1QsIG1YMSwgbVgyKTtcblxuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICAgIGlmIChjdXJyZW50U2xvcGUgPT09IDAuMCkge1xuICAgICAgICAgICAgcmV0dXJuIGFHdWVzc1Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGN1cnJlbnRYID0gY2FsY0JlemllcihhR3Vlc3NULCBtWDEsIG1YMikgLSBhWDtcbiAgICAgICAgICBhR3Vlc3NUIC09IGN1cnJlbnRYIC8gY3VycmVudFNsb3BlO1xuICAgICAgICAgICsraTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYUd1ZXNzVDtcbiAgICAgIH07XG4gICAgICBjYWxjU2FtcGxlVmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGkgPSAwO1xuICAgICAgICB3aGlsZSAoaSA8IGtTcGxpbmVUYWJsZVNpemUpIHtcbiAgICAgICAgICBtU2FtcGxlVmFsdWVzW2ldID0gY2FsY0JlemllcihpICoga1NhbXBsZVN0ZXBTaXplLCBtWDEsIG1YMik7XG4gICAgICAgICAgKytpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgYmluYXJ5U3ViZGl2aWRlID0gZnVuY3Rpb24oYVgsIGFBLCBhQikge1xuICAgICAgICB2YXIgY3VycmVudFQsIGN1cnJlbnRYLCBpc0JpZztcbiAgICAgICAgY3VycmVudFggPSB2b2lkIDA7XG4gICAgICAgIGN1cnJlbnRUID0gdm9pZCAwO1xuICAgICAgICBpID0gMDtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICBjdXJyZW50VCA9IGFBICsgKGFCIC0gYUEpIC8gMi4wO1xuICAgICAgICAgIGN1cnJlbnRYID0gY2FsY0JlemllcihjdXJyZW50VCwgbVgxLCBtWDIpIC0gYVg7XG4gICAgICAgICAgaWYgKGN1cnJlbnRYID4gMC4wKSB7XG4gICAgICAgICAgICBhQiA9IGN1cnJlbnRUO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhQSA9IGN1cnJlbnRUO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpc0JpZyA9IE1hdGguYWJzKGN1cnJlbnRYKSA+IFNVQkRJVklTSU9OX1BSRUNJU0lPTjtcbiAgICAgICAgICBpZiAoIShpc0JpZyAmJiArK2kgPCBTVUJESVZJU0lPTl9NQVhfSVRFUkFUSU9OUykpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3VycmVudFQ7XG4gICAgICB9O1xuICAgICAgZ2V0VEZvclggPSBmdW5jdGlvbihhWCkge1xuICAgICAgICB2YXIgY3VycmVudFNhbXBsZSwgZGVsdGEsIGRpc3QsIGd1ZXNzRm9yVCwgaW5pdGlhbFNsb3BlLCBpbnRlcnZhbFN0YXJ0LCBsYXN0U2FtcGxlO1xuICAgICAgICBpbnRlcnZhbFN0YXJ0ID0gMC4wO1xuICAgICAgICBjdXJyZW50U2FtcGxlID0gMTtcbiAgICAgICAgbGFzdFNhbXBsZSA9IGtTcGxpbmVUYWJsZVNpemUgLSAxO1xuICAgICAgICB3aGlsZSAoY3VycmVudFNhbXBsZSAhPT0gbGFzdFNhbXBsZSAmJiBtU2FtcGxlVmFsdWVzW2N1cnJlbnRTYW1wbGVdIDw9IGFYKSB7XG4gICAgICAgICAgaW50ZXJ2YWxTdGFydCArPSBrU2FtcGxlU3RlcFNpemU7XG4gICAgICAgICAgKytjdXJyZW50U2FtcGxlO1xuICAgICAgICB9XG4gICAgICAgIC0tY3VycmVudFNhbXBsZTtcbiAgICAgICAgZGVsdGEgPSBtU2FtcGxlVmFsdWVzW2N1cnJlbnRTYW1wbGUgKyAxXSAtIG1TYW1wbGVWYWx1ZXNbY3VycmVudFNhbXBsZV07XG4gICAgICAgIGRpc3QgPSAoYVggLSBtU2FtcGxlVmFsdWVzW2N1cnJlbnRTYW1wbGVdKSAvIGRlbHRhO1xuICAgICAgICBndWVzc0ZvclQgPSBpbnRlcnZhbFN0YXJ0ICsgZGlzdCAqIGtTYW1wbGVTdGVwU2l6ZTtcbiAgICAgICAgaW5pdGlhbFNsb3BlID0gZ2V0U2xvcGUoZ3Vlc3NGb3JULCBtWDEsIG1YMik7XG4gICAgICAgIGlmIChpbml0aWFsU2xvcGUgPj0gTkVXVE9OX01JTl9TTE9QRSkge1xuICAgICAgICAgIHJldHVybiBuZXd0b25SYXBoc29uSXRlcmF0ZShhWCwgZ3Vlc3NGb3JUKTtcbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgICAgaWYgKGluaXRpYWxTbG9wZSA9PT0gMC4wKSB7XG4gICAgICAgICAgICByZXR1cm4gZ3Vlc3NGb3JUO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYmluYXJ5U3ViZGl2aWRlKGFYLCBpbnRlcnZhbFN0YXJ0LCBpbnRlcnZhbFN0YXJ0ICsga1NhbXBsZVN0ZXBTaXplKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBwcmVjb21wdXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBfcHJlY29tcHV0ZWQ7XG4gICAgICAgIF9wcmVjb21wdXRlZCA9IHRydWU7XG4gICAgICAgIGlmIChtWDEgIT09IG1ZMSB8fCBtWDIgIT09IG1ZMikge1xuICAgICAgICAgIHJldHVybiBjYWxjU2FtcGxlVmFsdWVzKCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBtU2FtcGxlVmFsdWVzID0gIWZsb2F0MzJBcnJheVN1cHBvcnRlZCA/IG5ldyBBcnJheShrU3BsaW5lVGFibGVTaXplKSA6IG5ldyBGbG9hdDMyQXJyYXkoa1NwbGluZVRhYmxlU2l6ZSk7XG4gICAgICBfcHJlY29tcHV0ZWQgPSBmYWxzZTtcbiAgICAgIGYgPSBmdW5jdGlvbihhWCkge1xuICAgICAgICBpZiAoIV9wcmVjb21wdXRlZCkge1xuICAgICAgICAgIHByZWNvbXB1dGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobVgxID09PSBtWTEgJiYgbVgyID09PSBtWTIpIHtcbiAgICAgICAgICByZXR1cm4gYVg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFYID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFYID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhbGNCZXppZXIoZ2V0VEZvclgoYVgpLCBtWTEsIG1ZMik7XG4gICAgICB9O1xuICAgICAgc3RyID0gXCJiZXppZXIoXCIgKyBbbVgxLCBtWTEsIG1YMiwgbVkyXSArIFwiKVwiO1xuICAgICAgZi50b1N0ciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBmO1xuICAgIH07XG5cbiAgICBCZXppZXJFYXNpbmcucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24obXNnKSB7XG4gICAgICByZXR1cm4gaC5lcnJvcihtc2cpO1xuICAgIH07XG5cbiAgICByZXR1cm4gQmV6aWVyRWFzaW5nO1xuXG4gIH0pKCk7XG5cbiAgYmV6aWVyRWFzaW5nID0gbmV3IEJlemllckVhc2luZztcblxuICBtb2R1bGUuZXhwb3J0cyA9IGJlemllckVhc2luZztcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIEVhc2luZywgUGF0aEVhc2luZywgYmV6aWVyLCBlYXNpbmcsIGgsIG1peDtcblxuICBiZXppZXIgPSByZXF1aXJlKCcuL2Jlemllci1lYXNpbmcnKTtcblxuICBQYXRoRWFzaW5nID0gcmVxdWlyZSgnLi9wYXRoLWVhc2luZycpO1xuXG4gIG1peCA9IHJlcXVpcmUoJy4vbWl4Jyk7XG5cbiAgaCA9IHJlcXVpcmUoJy4uL2gnKTtcblxuICBFYXNpbmcgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gRWFzaW5nKCkge31cblxuICAgIEVhc2luZy5wcm90b3R5cGUuYmV6aWVyID0gYmV6aWVyO1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5QYXRoRWFzaW5nID0gUGF0aEVhc2luZztcblxuICAgIEVhc2luZy5wcm90b3R5cGUucGF0aCA9IChuZXcgUGF0aEVhc2luZygnY3JlYXRvcicpKS5jcmVhdGU7XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLmludmVyc2UgPSBmdW5jdGlvbihwKSB7XG4gICAgICByZXR1cm4gMSAtIHA7XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUubGluZWFyID0ge1xuICAgICAgbm9uZTogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gaztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5lYXNlID0ge1xuICAgICAgXCJpblwiOiBiZXppZXIuYXBwbHkoRWFzaW5nLCBbMC40MiwgMCwgMSwgMV0pLFxuICAgICAgb3V0OiBiZXppZXIuYXBwbHkoRWFzaW5nLCBbMCwgMCwgMC41OCwgMV0pLFxuICAgICAgaW5vdXQ6IGJlemllci5hcHBseShFYXNpbmcsIFswLjQyLCAwLCAwLjU4LCAxXSlcbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5xdWFkID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiBrICogaztcbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIGsgKiAoMiAtIGspO1xuICAgICAgfSxcbiAgICAgIGlub3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIGlmICgoayAqPSAyKSA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gMC41ICogayAqIGs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0wLjUgKiAoLS1rICogKGsgLSAyKSAtIDEpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLmN1YmljID0ge1xuICAgICAgXCJpblwiOiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiBrICogayAqIGs7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAtLWsgKiBrICogayArIDE7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAwLjUgKiBrICogayAqIGs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDAuNSAqICgoayAtPSAyKSAqIGsgKiBrICsgMik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUucXVhcnQgPSB7XG4gICAgICBcImluXCI6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIGsgKiBrICogayAqIGs7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAxIC0gKC0tayAqIGsgKiBrICogayk7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAwLjUgKiBrICogayAqIGsgKiBrO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAtMC41ICogKChrIC09IDIpICogayAqIGsgKiBrIC0gMik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUucXVpbnQgPSB7XG4gICAgICBcImluXCI6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgcmV0dXJuIGsgKiBrICogayAqIGsgKiBrO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gLS1rICogayAqIGsgKiBrICogayArIDE7XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKChrICo9IDIpIDwgMSkge1xuICAgICAgICAgIHJldHVybiAwLjUgKiBrICogayAqIGsgKiBrICogaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMC41ICogKChrIC09IDIpICogayAqIGsgKiBrICogayArIDIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLnNpbiA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gMSAtIE1hdGguY29zKGsgKiBNYXRoLlBJIC8gMik7XG4gICAgICB9LFxuICAgICAgb3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNpbihrICogTWF0aC5QSSAvIDIpO1xuICAgICAgfSxcbiAgICAgIGlub3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHJldHVybiAwLjUgKiAoMSAtIE1hdGguY29zKE1hdGguUEkgKiBrKSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuZXhwbyA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICBpZiAoayA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBNYXRoLnBvdygxMDI0LCBrIC0gMSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKGsgPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gMSAtIE1hdGgucG93KDIsIC0xMCAqIGspO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKGsgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoayA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIGlmICgoayAqPSAyKSA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gMC41ICogTWF0aC5wb3coMTAyNCwgayAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwLjUgKiAoLU1hdGgucG93KDIsIC0xMCAqIChrIC0gMSkpICsgMik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuY2lyYyA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gMSAtIE1hdGguc3FydCgxIC0gayAqIGspO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KDEgLSAoLS1rICogaykpO1xuICAgICAgfSxcbiAgICAgIGlub3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIGlmICgoayAqPSAyKSA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gLTAuNSAqIChNYXRoLnNxcnQoMSAtIGsgKiBrKSAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAwLjUgKiAoTWF0aC5zcXJ0KDEgLSAoayAtPSAyKSAqIGspICsgMSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuYmFjayA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgcztcbiAgICAgICAgcyA9IDEuNzAxNTg7XG4gICAgICAgIHJldHVybiBrICogayAqICgocyArIDEpICogayAtIHMpO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgcztcbiAgICAgICAgcyA9IDEuNzAxNTg7XG4gICAgICAgIHJldHVybiAtLWsgKiBrICogKChzICsgMSkgKiBrICsgcykgKyAxO1xuICAgICAgfSxcbiAgICAgIGlub3V0OiBmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciBzO1xuICAgICAgICBzID0gMS43MDE1OCAqIDEuNTI1O1xuICAgICAgICBpZiAoKGsgKj0gMikgPCAxKSB7XG4gICAgICAgICAgcmV0dXJuIDAuNSAqIChrICogayAqICgocyArIDEpICogayAtIHMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMC41ICogKChrIC09IDIpICogayAqICgocyArIDEpICogayArIHMpICsgMik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuZWxhc3RpYyA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgYSwgcCwgcztcbiAgICAgICAgcyA9IHZvaWQgMDtcbiAgICAgICAgcCA9IDAuNDtcbiAgICAgICAgaWYgKGsgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoayA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIGEgPSAxO1xuICAgICAgICBzID0gcCAvIDQ7XG4gICAgICAgIHJldHVybiAtKGEgKiBNYXRoLnBvdygyLCAxMCAqIChrIC09IDEpKSAqIE1hdGguc2luKChrIC0gcykgKiAoMiAqIE1hdGguUEkpIC8gcCkpO1xuICAgICAgfSxcbiAgICAgIG91dDogZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgYSwgcCwgcztcbiAgICAgICAgcyA9IHZvaWQgMDtcbiAgICAgICAgcCA9IDAuNDtcbiAgICAgICAgaWYgKGsgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoayA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIGEgPSAxO1xuICAgICAgICBzID0gcCAvIDQ7XG4gICAgICAgIHJldHVybiBhICogTWF0aC5wb3coMiwgLTEwICogaykgKiBNYXRoLnNpbigoayAtIHMpICogKDIgKiBNYXRoLlBJKSAvIHApICsgMTtcbiAgICAgIH0sXG4gICAgICBpbm91dDogZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgYSwgcCwgcztcbiAgICAgICAgcyA9IHZvaWQgMDtcbiAgICAgICAgcCA9IDAuNDtcbiAgICAgICAgaWYgKGsgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoayA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICAgIGEgPSAxO1xuICAgICAgICBzID0gcCAvIDQ7XG4gICAgICAgIGlmICgoayAqPSAyKSA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gLTAuNSAqIChhICogTWF0aC5wb3coMiwgMTAgKiAoayAtPSAxKSkgKiBNYXRoLnNpbigoayAtIHMpICogKDIgKiBNYXRoLlBJKSAvIHApKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYSAqIE1hdGgucG93KDIsIC0xMCAqIChrIC09IDEpKSAqIE1hdGguc2luKChrIC0gcykgKiAoMiAqIE1hdGguUEkpIC8gcCkgKiAwLjUgKyAxO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBFYXNpbmcucHJvdG90eXBlLmJvdW5jZSA9IHtcbiAgICAgIFwiaW5cIjogZnVuY3Rpb24oaykge1xuICAgICAgICByZXR1cm4gMSAtIGVhc2luZy5ib3VuY2Uub3V0KDEgLSBrKTtcbiAgICAgIH0sXG4gICAgICBvdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKGsgPCAoMSAvIDIuNzUpKSB7XG4gICAgICAgICAgcmV0dXJuIDcuNTYyNSAqIGsgKiBrO1xuICAgICAgICB9IGVsc2UgaWYgKGsgPCAoMiAvIDIuNzUpKSB7XG4gICAgICAgICAgcmV0dXJuIDcuNTYyNSAqIChrIC09IDEuNSAvIDIuNzUpICogayArIDAuNzU7XG4gICAgICAgIH0gZWxzZSBpZiAoayA8ICgyLjUgLyAyLjc1KSkge1xuICAgICAgICAgIHJldHVybiA3LjU2MjUgKiAoayAtPSAyLjI1IC8gMi43NSkgKiBrICsgMC45Mzc1O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiA3LjU2MjUgKiAoayAtPSAyLjYyNSAvIDIuNzUpICogayArIDAuOTg0Mzc1O1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaW5vdXQ6IGZ1bmN0aW9uKGspIHtcbiAgICAgICAgaWYgKGsgPCAwLjUpIHtcbiAgICAgICAgICByZXR1cm4gZWFzaW5nLmJvdW5jZVtcImluXCJdKGsgKiAyKSAqIDAuNTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZWFzaW5nLmJvdW5jZS5vdXQoayAqIDIgLSAxKSAqIDAuNSArIDAuNTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgRWFzaW5nLnByb3RvdHlwZS5wYXJzZUVhc2luZyA9IGZ1bmN0aW9uKGVhc2luZykge1xuICAgICAgdmFyIGVhc2luZ1BhcmVudCwgdHlwZTtcbiAgICAgIHR5cGUgPSB0eXBlb2YgZWFzaW5nO1xuICAgICAgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChlYXNpbmcuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgPT09ICdtJykge1xuICAgICAgICAgIHJldHVybiB0aGlzLnBhdGgoZWFzaW5nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlYXNpbmcgPSB0aGlzLl9zcGxpdEVhc2luZyhlYXNpbmcpO1xuICAgICAgICAgIGVhc2luZ1BhcmVudCA9IHRoaXNbZWFzaW5nWzBdXTtcbiAgICAgICAgICBpZiAoIWVhc2luZ1BhcmVudCkge1xuICAgICAgICAgICAgaC5lcnJvcihcIkVhc2luZyB3aXRoIG5hbWUgXFxcIlwiICsgZWFzaW5nWzBdICsgXCJcXFwiIHdhcyBub3QgZm91bmQsIGZhbGxiYWNrIHRvIFxcXCJsaW5lYXIubm9uZVxcXCIgaW5zdGVhZFwiKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzWydsaW5lYXInXVsnbm9uZSddO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZWFzaW5nUGFyZW50W2Vhc2luZ1sxXV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChoLmlzQXJyYXkoZWFzaW5nKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5iZXppZXIuYXBwbHkodGhpcywgZWFzaW5nKTtcbiAgICAgIH1cbiAgICAgIGlmICgnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBlYXNpbmc7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEVhc2luZy5wcm90b3R5cGUuX3NwbGl0RWFzaW5nID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICB2YXIgZmlyc3RQYXJ0LCBzZWNvbmRQYXJ0LCBzcGxpdDtcbiAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBzdHJpbmc7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycgJiYgc3RyaW5nLmxlbmd0aCkge1xuICAgICAgICBzcGxpdCA9IHN0cmluZy5zcGxpdCgnLicpO1xuICAgICAgICBmaXJzdFBhcnQgPSBzcGxpdFswXS50b0xvd2VyQ2FzZSgpIHx8ICdsaW5lYXInO1xuICAgICAgICBzZWNvbmRQYXJ0ID0gc3BsaXRbMV0udG9Mb3dlckNhc2UoKSB8fCAnbm9uZSc7XG4gICAgICAgIHJldHVybiBbZmlyc3RQYXJ0LCBzZWNvbmRQYXJ0XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbJ2xpbmVhcicsICdub25lJ107XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBFYXNpbmc7XG5cbiAgfSkoKTtcblxuICBlYXNpbmcgPSBuZXcgRWFzaW5nO1xuXG4gIGVhc2luZy5taXggPSBtaXgoZWFzaW5nKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IGVhc2luZztcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIGNyZWF0ZSwgZWFzaW5nLCBnZXROZWFyZXN0LCBtaXgsIHBhcnNlSWZFYXNpbmcsIHNvcnQsXG4gICAgX19zbGljZSA9IFtdLnNsaWNlO1xuXG4gIGVhc2luZyA9IG51bGw7XG5cbiAgcGFyc2VJZkVhc2luZyA9IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICBpZiAodHlwZW9mIGl0ZW0udmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICByZXR1cm4gaXRlbS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGVhc2luZy5wYXJzZUVhc2luZyhpdGVtLnZhbHVlKTtcbiAgICB9XG4gIH07XG5cbiAgc29ydCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICB2YXIgcmV0dXJuVmFsdWU7XG4gICAgYS52YWx1ZSA9IHBhcnNlSWZFYXNpbmcoYSk7XG4gICAgYi52YWx1ZSA9IHBhcnNlSWZFYXNpbmcoYik7XG4gICAgcmV0dXJuVmFsdWUgPSAwO1xuICAgIGEudG8gPCBiLnRvICYmIChyZXR1cm5WYWx1ZSA9IC0xKTtcbiAgICBhLnRvID4gYi50byAmJiAocmV0dXJuVmFsdWUgPSAxKTtcbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH07XG5cbiAgZ2V0TmVhcmVzdCA9IGZ1bmN0aW9uKGFycmF5LCBwcm9ncmVzcykge1xuICAgIHZhciBpLCBpbmRleCwgdmFsdWUsIF9pLCBfbGVuO1xuICAgIGluZGV4ID0gMDtcbiAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBhcnJheS5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgIHZhbHVlID0gYXJyYXlbaV07XG4gICAgICBpbmRleCA9IGk7XG4gICAgICBpZiAodmFsdWUudG8gPiBwcm9ncmVzcykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluZGV4O1xuICB9O1xuXG4gIG1peCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzO1xuICAgIGFyZ3MgPSAxIDw9IGFyZ3VtZW50cy5sZW5ndGggPyBfX3NsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSA6IFtdO1xuICAgIGlmIChhcmdzLmxlbmd0aCA+IDEpIHtcbiAgICAgIGFyZ3MgPSBhcmdzLnNvcnQoc29ydCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ3NbMF0udmFsdWUgPSBwYXJzZUlmRWFzaW5nKGFyZ3NbMF0pO1xuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcbiAgICAgIHZhciBpbmRleCwgdmFsdWU7XG4gICAgICBpbmRleCA9IGdldE5lYXJlc3QoYXJncywgcHJvZ3Jlc3MpO1xuICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICB2YWx1ZSA9IGFyZ3NbaW5kZXhdLnZhbHVlO1xuICAgICAgICBpZiAoaW5kZXggPT09IGFyZ3MubGVuZ3RoIC0gMSAmJiBwcm9ncmVzcyA+IGFyZ3NbaW5kZXhdLnRvKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHJldHVybiB2YWx1ZShwcm9ncmVzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICBjcmVhdGUgPSBmdW5jdGlvbihlKSB7XG4gICAgZWFzaW5nID0gZTtcbiAgICByZXR1cm4gbWl4O1xuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gY3JlYXRlO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgUGF0aEVhc2luZywgaDtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIFBhdGhFYXNpbmcgPSAoZnVuY3Rpb24oKSB7XG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX3ZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX3ByZWNvbXB1dGUgPSBoLmNsYW1wKHRoaXMuby5wcmVjb21wdXRlIHx8IDE0NTAsIDEwMCwgMTAwMDApO1xuICAgICAgdGhpcy5fc3RlcCA9IDEgLyB0aGlzLl9wcmVjb21wdXRlO1xuICAgICAgdGhpcy5fcmVjdCA9IHRoaXMuby5yZWN0IHx8IDEwMDtcbiAgICAgIHRoaXMuX2FwcHJveGltYXRlTWF4ID0gdGhpcy5vLmFwcHJveGltYXRlTWF4IHx8IDU7XG4gICAgICB0aGlzLl9lcHMgPSB0aGlzLm8uZXBzIHx8IDAuMDAxO1xuICAgICAgcmV0dXJuIHRoaXMuX2JvdW5kc1ByZXZQcm9ncmVzcyA9IC0xO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBQYXRoRWFzaW5nKHBhdGgsIG8pIHtcbiAgICAgIHRoaXMubyA9IG8gIT0gbnVsbCA/IG8gOiB7fTtcbiAgICAgIGlmIChwYXRoID09PSAnY3JlYXRvcicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5wYXRoID0gaC5wYXJzZVBhdGgocGF0aCk7XG4gICAgICBpZiAodGhpcy5wYXRoID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGguZXJyb3IoJ0Vycm9yIHdoaWxlIHBhcnNpbmcgdGhlIHBhdGgnKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3ZhcnMoKTtcbiAgICAgIHRoaXMucGF0aC5zZXRBdHRyaWJ1dGUoJ2QnLCB0aGlzLl9ub3JtYWxpemVQYXRoKHRoaXMucGF0aC5nZXRBdHRyaWJ1dGUoJ2QnKSkpO1xuICAgICAgdGhpcy5wYXRoTGVuZ3RoID0gdGhpcy5wYXRoLmdldFRvdGFsTGVuZ3RoKCk7XG4gICAgICB0aGlzLnNhbXBsZSA9IGguYmluZCh0aGlzLnNhbXBsZSwgdGhpcyk7XG4gICAgICB0aGlzLl9oYXJkU2FtcGxlID0gaC5iaW5kKHRoaXMuX2hhcmRTYW1wbGUsIHRoaXMpO1xuICAgICAgdGhpcy5fcHJlU2FtcGxlKCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9wcmVTYW1wbGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpLCBsZW5ndGgsIHBvaW50LCBwcm9ncmVzcywgX2ksIF9yZWYsIF9yZXN1bHRzO1xuICAgICAgdGhpcy5fc2FtcGxlcyA9IFtdO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX3JlZiA9IHRoaXMuX3ByZWNvbXB1dGU7IDAgPD0gX3JlZiA/IF9pIDw9IF9yZWYgOiBfaSA+PSBfcmVmOyBpID0gMCA8PSBfcmVmID8gKytfaSA6IC0tX2kpIHtcbiAgICAgICAgcHJvZ3Jlc3MgPSBpICogdGhpcy5fc3RlcDtcbiAgICAgICAgbGVuZ3RoID0gdGhpcy5wYXRoTGVuZ3RoICogcHJvZ3Jlc3M7XG4gICAgICAgIHBvaW50ID0gdGhpcy5wYXRoLmdldFBvaW50QXRMZW5ndGgobGVuZ3RoKTtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLl9zYW1wbGVzW2ldID0ge1xuICAgICAgICAgIHBvaW50OiBwb2ludCxcbiAgICAgICAgICBsZW5ndGg6IGxlbmd0aCxcbiAgICAgICAgICBwcm9ncmVzczogcHJvZ3Jlc3NcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9maW5kQm91bmRzID0gZnVuY3Rpb24oYXJyYXksIHApIHtcbiAgICAgIHZhciBidWZmZXIsIGRpcmVjdGlvbiwgZW5kLCBpLCBsZW4sIGxvb3BFbmQsIHBvaW50UCwgcG9pbnRYLCBzdGFydCwgdmFsdWUsIF9pLCBfcmVmO1xuICAgICAgaWYgKHAgPT09IHRoaXMuX2JvdW5kc1ByZXZQcm9ncmVzcykge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJldkJvdW5kcztcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLl9ib3VuZHNTdGFydEluZGV4ID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5fYm91bmRzU3RhcnRJbmRleCA9IDA7XG4gICAgICB9XG4gICAgICBsZW4gPSBhcnJheS5sZW5ndGg7XG4gICAgICBpZiAodGhpcy5fYm91bmRzUHJldlByb2dyZXNzID4gcCkge1xuICAgICAgICBsb29wRW5kID0gMDtcbiAgICAgICAgZGlyZWN0aW9uID0gJ3JldmVyc2UnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9vcEVuZCA9IGxlbjtcbiAgICAgICAgZGlyZWN0aW9uID0gJ2ZvcndhcmQnO1xuICAgICAgfVxuICAgICAgaWYgKGRpcmVjdGlvbiA9PT0gJ2ZvcndhcmQnKSB7XG4gICAgICAgIHN0YXJ0ID0gYXJyYXlbMF07XG4gICAgICAgIGVuZCA9IGFycmF5W2FycmF5Lmxlbmd0aCAtIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhcnQgPSBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICAgICAgZW5kID0gYXJyYXlbMF07XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSBfaSA9IF9yZWYgPSB0aGlzLl9ib3VuZHNTdGFydEluZGV4OyBfcmVmIDw9IGxvb3BFbmQgPyBfaSA8IGxvb3BFbmQgOiBfaSA+IGxvb3BFbmQ7IGkgPSBfcmVmIDw9IGxvb3BFbmQgPyArK19pIDogLS1faSkge1xuICAgICAgICB2YWx1ZSA9IGFycmF5W2ldO1xuICAgICAgICBwb2ludFggPSB2YWx1ZS5wb2ludC54IC8gdGhpcy5fcmVjdDtcbiAgICAgICAgcG9pbnRQID0gcDtcbiAgICAgICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3JldmVyc2UnKSB7XG4gICAgICAgICAgYnVmZmVyID0gcG9pbnRYO1xuICAgICAgICAgIHBvaW50WCA9IHBvaW50UDtcbiAgICAgICAgICBwb2ludFAgPSBidWZmZXI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBvaW50WCA8IHBvaW50UCkge1xuICAgICAgICAgIHN0YXJ0ID0gdmFsdWU7XG4gICAgICAgICAgdGhpcy5fYm91bmRzU3RhcnRJbmRleCA9IGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZW5kID0gdmFsdWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX2JvdW5kc1ByZXZQcm9ncmVzcyA9IHA7XG4gICAgICByZXR1cm4gdGhpcy5fcHJldkJvdW5kcyA9IHtcbiAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICBlbmQ6IGVuZFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuc2FtcGxlID0gZnVuY3Rpb24ocCkge1xuICAgICAgdmFyIGJvdW5kcywgcmVzO1xuICAgICAgcCA9IGguY2xhbXAocCwgMCwgMSk7XG4gICAgICBib3VuZHMgPSB0aGlzLl9maW5kQm91bmRzKHRoaXMuX3NhbXBsZXMsIHApO1xuICAgICAgcmVzID0gdGhpcy5fY2hlY2tJZkJvdW5kc0Nsb3NlRW5vdWdoKHAsIGJvdW5kcyk7XG4gICAgICBpZiAocmVzICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9maW5kQXBwcm94aW1hdGUocCwgYm91bmRzLnN0YXJ0LCBib3VuZHMuZW5kKTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX2NoZWNrSWZCb3VuZHNDbG9zZUVub3VnaCA9IGZ1bmN0aW9uKHAsIGJvdW5kcykge1xuICAgICAgdmFyIHBvaW50LCB5O1xuICAgICAgcG9pbnQgPSB2b2lkIDA7XG4gICAgICB5ID0gdGhpcy5fY2hlY2tJZlBvaW50Q2xvc2VFbm91Z2gocCwgYm91bmRzLnN0YXJ0LnBvaW50KTtcbiAgICAgIGlmICh5ICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5fY2hlY2tJZlBvaW50Q2xvc2VFbm91Z2gocCwgYm91bmRzLmVuZC5wb2ludCk7XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9jaGVja0lmUG9pbnRDbG9zZUVub3VnaCA9IGZ1bmN0aW9uKHAsIHBvaW50KSB7XG4gICAgICBpZiAoaC5jbG9zZUVub3VnaChwLCBwb2ludC54IC8gdGhpcy5fcmVjdCwgdGhpcy5fZXBzKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzb2x2ZVkocG9pbnQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fYXBwcm94aW1hdGUgPSBmdW5jdGlvbihzdGFydCwgZW5kLCBwKSB7XG4gICAgICB2YXIgZGVsdGFQLCBwZXJjZW50UDtcbiAgICAgIGRlbHRhUCA9IGVuZC5wb2ludC54IC0gc3RhcnQucG9pbnQueDtcbiAgICAgIHBlcmNlbnRQID0gKHAgLSAoc3RhcnQucG9pbnQueCAvIHRoaXMuX3JlY3QpKSAvIChkZWx0YVAgLyB0aGlzLl9yZWN0KTtcbiAgICAgIHJldHVybiBzdGFydC5sZW5ndGggKyBwZXJjZW50UCAqIChlbmQubGVuZ3RoIC0gc3RhcnQubGVuZ3RoKTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX2ZpbmRBcHByb3hpbWF0ZSA9IGZ1bmN0aW9uKHAsIHN0YXJ0LCBlbmQsIGFwcHJveGltYXRlTWF4KSB7XG4gICAgICB2YXIgYXBwcm94aW1hdGlvbiwgYXJncywgbmV3UG9pbnQsIHBvaW50LCB4O1xuICAgICAgaWYgKGFwcHJveGltYXRlTWF4ID09IG51bGwpIHtcbiAgICAgICAgYXBwcm94aW1hdGVNYXggPSB0aGlzLl9hcHByb3hpbWF0ZU1heDtcbiAgICAgIH1cbiAgICAgIGFwcHJveGltYXRpb24gPSB0aGlzLl9hcHByb3hpbWF0ZShzdGFydCwgZW5kLCBwKTtcbiAgICAgIHBvaW50ID0gdGhpcy5wYXRoLmdldFBvaW50QXRMZW5ndGgoYXBwcm94aW1hdGlvbik7XG4gICAgICB4ID0gcG9pbnQueCAvIHRoaXMuX3JlY3Q7XG4gICAgICBpZiAoaC5jbG9zZUVub3VnaChwLCB4LCB0aGlzLl9lcHMpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNvbHZlWShwb2ludCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoLS1hcHByb3hpbWF0ZU1heCA8IDEpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fcmVzb2x2ZVkocG9pbnQpO1xuICAgICAgICB9XG4gICAgICAgIG5ld1BvaW50ID0ge1xuICAgICAgICAgIHBvaW50OiBwb2ludCxcbiAgICAgICAgICBsZW5ndGg6IGFwcHJveGltYXRpb25cbiAgICAgICAgfTtcbiAgICAgICAgYXJncyA9IHAgPCB4ID8gW3AsIHN0YXJ0LCBuZXdQb2ludCwgYXBwcm94aW1hdGVNYXhdIDogW3AsIG5ld1BvaW50LCBlbmQsIGFwcHJveGltYXRlTWF4XTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRBcHByb3hpbWF0ZS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX3Jlc29sdmVZID0gZnVuY3Rpb24ocG9pbnQpIHtcbiAgICAgIHJldHVybiAxIC0gKHBvaW50LnkgLyB0aGlzLl9yZWN0KTtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX25vcm1hbGl6ZVBhdGggPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgICB2YXIgY29tbWFuZHMsIGVuZEluZGV4LCBub3JtYWxpemVkUGF0aCwgcG9pbnRzLCBzdGFydEluZGV4LCBzdmdDb21tYW5kc1JlZ2V4cDtcbiAgICAgIHN2Z0NvbW1hbmRzUmVnZXhwID0gL1tNfEx8SHxWfEN8U3xRfFR8QV0vZ2ltO1xuICAgICAgcG9pbnRzID0gcGF0aC5zcGxpdChzdmdDb21tYW5kc1JlZ2V4cCk7XG4gICAgICBwb2ludHMuc2hpZnQoKTtcbiAgICAgIGNvbW1hbmRzID0gcGF0aC5tYXRjaChzdmdDb21tYW5kc1JlZ2V4cCk7XG4gICAgICBzdGFydEluZGV4ID0gMDtcbiAgICAgIHBvaW50c1tzdGFydEluZGV4XSA9IHRoaXMuX25vcm1hbGl6ZVNlZ21lbnQocG9pbnRzW3N0YXJ0SW5kZXhdKTtcbiAgICAgIGVuZEluZGV4ID0gcG9pbnRzLmxlbmd0aCAtIDE7XG4gICAgICBwb2ludHNbZW5kSW5kZXhdID0gdGhpcy5fbm9ybWFsaXplU2VnbWVudChwb2ludHNbZW5kSW5kZXhdLCB0aGlzLl9yZWN0IHx8IDEwMCk7XG4gICAgICByZXR1cm4gbm9ybWFsaXplZFBhdGggPSB0aGlzLl9qb2luTm9ybWFsaXplZFBhdGgoY29tbWFuZHMsIHBvaW50cyk7XG4gICAgfTtcblxuICAgIFBhdGhFYXNpbmcucHJvdG90eXBlLl9qb2luTm9ybWFsaXplZFBhdGggPSBmdW5jdGlvbihjb21tYW5kcywgcG9pbnRzKSB7XG4gICAgICB2YXIgY29tbWFuZCwgaSwgbm9ybWFsaXplZFBhdGgsIHNwYWNlLCBfaSwgX2xlbjtcbiAgICAgIG5vcm1hbGl6ZWRQYXRoID0gJyc7XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBjb21tYW5kcy5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgY29tbWFuZCA9IGNvbW1hbmRzW2ldO1xuICAgICAgICBzcGFjZSA9IGkgPT09IDAgPyAnJyA6ICcgJztcbiAgICAgICAgbm9ybWFsaXplZFBhdGggKz0gXCJcIiArIHNwYWNlICsgY29tbWFuZCArIChwb2ludHNbaV0udHJpbSgpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBub3JtYWxpemVkUGF0aDtcbiAgICB9O1xuXG4gICAgUGF0aEVhc2luZy5wcm90b3R5cGUuX25vcm1hbGl6ZVNlZ21lbnQgPSBmdW5jdGlvbihzZWdtZW50LCB2YWx1ZSkge1xuICAgICAgdmFyIGksIGxhc3RQb2ludCwgblJneCwgcGFpcnMsIHBhcnNlZFgsIHBvaW50LCBzcGFjZSwgeCwgX2ksIF9sZW47XG4gICAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgICB2YWx1ZSA9IDA7XG4gICAgICB9XG4gICAgICBzZWdtZW50ID0gc2VnbWVudC50cmltKCk7XG4gICAgICBuUmd4ID0gLygtfFxcKyk/KChcXGQrKFxcLihcXGR8XFxlKC18XFwrKT8pKyk/KXwoXFwuPyhcXGR8XFxlfChcXC18XFwrKSkrKSkvZ2ltO1xuICAgICAgcGFpcnMgPSB0aGlzLl9nZXRTZWdtZW50UGFpcnMoc2VnbWVudC5tYXRjaChuUmd4KSk7XG4gICAgICBsYXN0UG9pbnQgPSBwYWlyc1twYWlycy5sZW5ndGggLSAxXTtcbiAgICAgIHggPSBsYXN0UG9pbnRbMF07XG4gICAgICBwYXJzZWRYID0gTnVtYmVyKHgpO1xuICAgICAgaWYgKHBhcnNlZFggIT09IHZhbHVlKSB7XG4gICAgICAgIHNlZ21lbnQgPSAnJztcbiAgICAgICAgbGFzdFBvaW50WzBdID0gdmFsdWU7XG4gICAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IHBhaXJzLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICAgIHBvaW50ID0gcGFpcnNbaV07XG4gICAgICAgICAgc3BhY2UgPSBpID09PSAwID8gJycgOiAnICc7XG4gICAgICAgICAgc2VnbWVudCArPSBcIlwiICsgc3BhY2UgKyBwb2ludFswXSArIFwiLFwiICsgcG9pbnRbMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBzZWdtZW50O1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5fZ2V0U2VnbWVudFBhaXJzID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICAgIHZhciBpLCBuZXdBcnJheSwgcGFpciwgdmFsdWUsIF9pLCBfbGVuO1xuICAgICAgaWYgKGFycmF5Lmxlbmd0aCAlIDIgIT09IDApIHtcbiAgICAgICAgaC5lcnJvcignRmFpbGVkIHRvIHBhcnNlIHRoZSBwYXRoIC0gc2VnbWVudCBwYWlycyBhcmUgbm90IGV2ZW4uJywgYXJyYXkpO1xuICAgICAgfVxuICAgICAgbmV3QXJyYXkgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IGFycmF5Lmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gX2kgKz0gMikge1xuICAgICAgICB2YWx1ZSA9IGFycmF5W2ldO1xuICAgICAgICBwYWlyID0gW2FycmF5W2ldLCBhcnJheVtpICsgMV1dO1xuICAgICAgICBuZXdBcnJheS5wdXNoKHBhaXIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld0FycmF5O1xuICAgIH07XG5cbiAgICBQYXRoRWFzaW5nLnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbihwYXRoLCBvKSB7XG4gICAgICB2YXIgaGFuZGxlcjtcbiAgICAgIGhhbmRsZXIgPSBuZXcgUGF0aEVhc2luZyhwYXRoLCBvKTtcbiAgICAgIGhhbmRsZXIuc2FtcGxlLnBhdGggPSBoYW5kbGVyLnBhdGg7XG4gICAgICByZXR1cm4gaGFuZGxlci5zYW1wbGU7XG4gICAgfTtcblxuICAgIHJldHVybiBQYXRoRWFzaW5nO1xuXG4gIH0pKCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBQYXRoRWFzaW5nO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgSGVscGVycywgaDtcblxuICBIZWxwZXJzID0gKGZ1bmN0aW9uKCkge1xuICAgIEhlbHBlcnMucHJvdG90eXBlLk5TID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJztcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmxvZ0JhZGdlQ3NzID0gJ2JhY2tncm91bmQ6IzNBMDgzOTtjb2xvcjojRkY1MTJGO2JvcmRlci1yYWRpdXM6NXB4OyBwYWRkaW5nOiAxcHggNXB4IDJweDsgYm9yZGVyOiAxcHggc29saWQgI0ZGNTEyRjsnO1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuc2hvcnRDb2xvcnMgPSB7XG4gICAgICB0cmFuc3BhcmVudDogJ3JnYmEoMCwwLDAsMCknLFxuICAgICAgbm9uZTogJ3JnYmEoMCwwLDAsMCknLFxuICAgICAgYXF1YTogJ3JnYigwLDI1NSwyNTUpJyxcbiAgICAgIGJsYWNrOiAncmdiKDAsMCwwKScsXG4gICAgICBibHVlOiAncmdiKDAsMCwyNTUpJyxcbiAgICAgIGZ1Y2hzaWE6ICdyZ2IoMjU1LDAsMjU1KScsXG4gICAgICBncmF5OiAncmdiKDEyOCwxMjgsMTI4KScsXG4gICAgICBncmVlbjogJ3JnYigwLDEyOCwwKScsXG4gICAgICBsaW1lOiAncmdiKDAsMjU1LDApJyxcbiAgICAgIG1hcm9vbjogJ3JnYigxMjgsMCwwKScsXG4gICAgICBuYXZ5OiAncmdiKDAsMCwxMjgpJyxcbiAgICAgIG9saXZlOiAncmdiKDEyOCwxMjgsMCknLFxuICAgICAgcHVycGxlOiAncmdiKDEyOCwwLDEyOCknLFxuICAgICAgcmVkOiAncmdiKDI1NSwwLDApJyxcbiAgICAgIHNpbHZlcjogJ3JnYigxOTIsMTkyLDE5MiknLFxuICAgICAgdGVhbDogJ3JnYigwLDEyOCwxMjgpJyxcbiAgICAgIHdoaXRlOiAncmdiKDI1NSwyNTUsMjU1KScsXG4gICAgICB5ZWxsb3c6ICdyZ2IoMjU1LDI1NSwwKScsXG4gICAgICBvcmFuZ2U6ICdyZ2IoMjU1LDEyOCwwKSdcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2hhaW5PcHRpb25NYXAgPSB7XG4gICAgICBkdXJhdGlvbjogMSxcbiAgICAgIGRlbGF5OiAxLFxuICAgICAgcmVwZWF0OiAxLFxuICAgICAgZWFzaW5nOiAxLFxuICAgICAgeW95bzogMSxcbiAgICAgIG9uU3RhcnQ6IDEsXG4gICAgICBvbkNvbXBsZXRlOiAxLFxuICAgICAgb25Db21wbGV0ZUNoYWluOiAxLFxuICAgICAgb25VcGRhdGU6IDEsXG4gICAgICBwb2ludHM6IDFcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2FsbGJhY2tzTWFwID0ge1xuICAgICAgb25TdGFydDogMSxcbiAgICAgIG9uQ29tcGxldGU6IDEsXG4gICAgICBvbkNvbXBsZXRlQ2hhaW46IDEsXG4gICAgICBvblVwZGF0ZTogMVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS50d2Vlbk9wdGlvbk1hcCA9IHtcbiAgICAgIGR1cmF0aW9uOiAxLFxuICAgICAgZGVsYXk6IDEsXG4gICAgICByZXBlYXQ6IDEsXG4gICAgICBlYXNpbmc6IDEsXG4gICAgICB5b3lvOiAxXG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnBvc1Byb3BzTWFwID0ge1xuICAgICAgeDogMSxcbiAgICAgIHk6IDEsXG4gICAgICBzaGlmdFg6IDEsXG4gICAgICBzaGlmdFk6IDEsXG4gICAgICBidXJzdFg6IDEsXG4gICAgICBidXJzdFk6IDEsXG4gICAgICBidXJzdFNoaWZ0WDogMSxcbiAgICAgIGJ1cnN0U2hpZnRZOiAxXG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnN0cm9rZURhc2hQcm9wc01hcCA9IHtcbiAgICAgIHN0cm9rZURhc2hhcnJheTogMSxcbiAgICAgIHN0cm9rZURhc2hvZmZzZXQ6IDFcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuUkFEX1RPX0RFRyA9IDE4MCAvIE1hdGguUEk7XG5cbiAgICBmdW5jdGlvbiBIZWxwZXJzKCkge1xuICAgICAgdGhpcy52YXJzKCk7XG4gICAgfVxuXG4gICAgSGVscGVycy5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHVhO1xuICAgICAgdGhpcy5wcmVmaXggPSB0aGlzLmdldFByZWZpeCgpO1xuICAgICAgdGhpcy5nZXRSZW1CYXNlKCk7XG4gICAgICB0aGlzLmlzRkYgPSB0aGlzLnByZWZpeC5sb3dlcmNhc2UgPT09ICdtb3onO1xuICAgICAgdGhpcy5pc0lFID0gdGhpcy5wcmVmaXgubG93ZXJjYXNlID09PSAnbXMnO1xuICAgICAgdWEgPSBuYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgdGhpcy5pc09sZE9wZXJhID0gdWEubWF0Y2goL3ByZXN0by9naW0pO1xuICAgICAgdGhpcy5pc1NhZmFyaSA9IHVhLmluZGV4T2YoJ1NhZmFyaScpID4gLTE7XG4gICAgICB0aGlzLmlzQ2hyb21lID0gdWEuaW5kZXhPZignQ2hyb21lJykgPiAtMTtcbiAgICAgIHRoaXMuaXNPcGVyYSA9IHVhLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihcIm9wXCIpID4gLTE7XG4gICAgICB0aGlzLmlzQ2hyb21lICYmIHRoaXMuaXNTYWZhcmkgJiYgKHRoaXMuaXNTYWZhcmkgPSBmYWxzZSk7XG4gICAgICAodWEubWF0Y2goL1BoYW50b21KUy9naW0pKSAmJiAodGhpcy5pc1NhZmFyaSA9IGZhbHNlKTtcbiAgICAgIHRoaXMuaXNDaHJvbWUgJiYgdGhpcy5pc09wZXJhICYmICh0aGlzLmlzQ2hyb21lID0gZmFsc2UpO1xuICAgICAgdGhpcy5pczNkID0gdGhpcy5jaGVja0lmM2QoKTtcbiAgICAgIHRoaXMudW5pcUlEcyA9IC0xO1xuICAgICAgdGhpcy5kaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHJldHVybiBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZGl2KTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2xvbmVPYmogPSBmdW5jdGlvbihvYmosIGV4Y2x1ZGUpIHtcbiAgICAgIHZhciBpLCBrZXksIGtleXMsIG5ld09iajtcbiAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgbmV3T2JqID0ge307XG4gICAgICBpID0ga2V5cy5sZW5ndGg7XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgIGlmIChleGNsdWRlICE9IG51bGwpIHtcbiAgICAgICAgICBpZiAoIWV4Y2x1ZGVba2V5XSkge1xuICAgICAgICAgICAgbmV3T2JqW2tleV0gPSBvYmpba2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3T2JqW2tleV0gPSBvYmpba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ld09iajtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZXh0ZW5kID0gZnVuY3Rpb24ob2JqVG8sIG9iakZyb20pIHtcbiAgICAgIHZhciBrZXksIHZhbHVlO1xuICAgICAgZm9yIChrZXkgaW4gb2JqRnJvbSkge1xuICAgICAgICB2YWx1ZSA9IG9iakZyb21ba2V5XTtcbiAgICAgICAgaWYgKG9ialRvW2tleV0gPT0gbnVsbCkge1xuICAgICAgICAgIG9ialRvW2tleV0gPSBvYmpGcm9tW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBvYmpUbztcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZ2V0UmVtQmFzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGh0bWwsIHN0eWxlO1xuICAgICAgaHRtbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2h0bWwnKTtcbiAgICAgIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShodG1sKTtcbiAgICAgIHJldHVybiB0aGlzLnJlbUJhc2UgPSBwYXJzZUZsb2F0KHN0eWxlLmZvbnRTaXplKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2xhbXAgPSBmdW5jdGlvbih2YWx1ZSwgbWluLCBtYXgpIHtcbiAgICAgIGlmICh2YWx1ZSA8IG1pbikge1xuICAgICAgICByZXR1cm4gbWluO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSA+IG1heCkge1xuICAgICAgICByZXR1cm4gbWF4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5zZXRQcmVmaXhlZFN0eWxlID0gZnVuY3Rpb24oZWwsIG5hbWUsIHZhbHVlLCBpc0l0KSB7XG4gICAgICBpZiAobmFtZS5tYXRjaCgvdHJhbnNmb3JtL2dpbSkpIHtcbiAgICAgICAgZWwuc3R5bGVbXCJcIiArIG5hbWVdID0gdmFsdWU7XG4gICAgICAgIHJldHVybiBlbC5zdHlsZVtcIlwiICsgdGhpcy5wcmVmaXguY3NzICsgbmFtZV0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBlbC5zdHlsZVtuYW1lXSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5zdHlsZSA9IGZ1bmN0aW9uKGVsLCBuYW1lLCB2YWx1ZSkge1xuICAgICAgdmFyIGtleSwga2V5cywgbGVuLCBfcmVzdWx0cztcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKG5hbWUpO1xuICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgICAga2V5ID0ga2V5c1tsZW5dO1xuICAgICAgICAgIHZhbHVlID0gbmFtZVtrZXldO1xuICAgICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5zZXRQcmVmaXhlZFN0eWxlKGVsLCBrZXksIHZhbHVlKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0UHJlZml4ZWRTdHlsZShlbCwgbmFtZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wcmVwYXJlRm9yTG9nID0gZnVuY3Rpb24oYXJncykge1xuICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5hcHBseShhcmdzKTtcbiAgICAgIGFyZ3MudW5zaGlmdCgnOjonKTtcbiAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLmxvZ0JhZGdlQ3NzKTtcbiAgICAgIGFyZ3MudW5zaGlmdCgnJWNtb8K3anMlYycpO1xuICAgICAgcmV0dXJuIGFyZ3M7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmxvZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG1vanMuaXNEZWJ1ZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIHRoaXMucHJlcGFyZUZvckxvZyhhcmd1bWVudHMpKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUud2FybiA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG1vanMuaXNEZWJ1ZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnNvbGUud2Fybi5hcHBseShjb25zb2xlLCB0aGlzLnByZXBhcmVGb3JMb2coYXJndW1lbnRzKSk7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAobW9qcy5pc0RlYnVnID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXR1cm4gY29uc29sZS5lcnJvci5hcHBseShjb25zb2xlLCB0aGlzLnByZXBhcmVGb3JMb2coYXJndW1lbnRzKSk7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLnBhcnNlVW5pdCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICB2YXIgYW1vdW50LCBpc1N0cmljdCwgcmVnZXgsIHJldHVyblZhbCwgdW5pdCwgX3JlZjtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiByZXR1cm5WYWwgPSB7XG4gICAgICAgICAgdW5pdDogJ3B4JyxcbiAgICAgICAgICBpc1N0cmljdDogZmFsc2UsXG4gICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIHN0cmluZzogXCJcIiArIHZhbHVlICsgXCJweFwiXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmVnZXggPSAvcHh8JXxyZW18ZW18ZXh8Y218Y2h8bW18aW58cHR8cGN8dmh8dnd8dm1pbi9naW07XG4gICAgICAgIHVuaXQgPSAoX3JlZiA9IHZhbHVlLm1hdGNoKHJlZ2V4KSkgIT0gbnVsbCA/IF9yZWZbMF0gOiB2b2lkIDA7XG4gICAgICAgIGlzU3RyaWN0ID0gdHJ1ZTtcbiAgICAgICAgaWYgKCF1bml0KSB7XG4gICAgICAgICAgdW5pdCA9ICdweCc7XG4gICAgICAgICAgaXNTdHJpY3QgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBhbW91bnQgPSBwYXJzZUZsb2F0KHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHJldHVyblZhbCA9IHtcbiAgICAgICAgICB1bml0OiB1bml0LFxuICAgICAgICAgIGlzU3RyaWN0OiBpc1N0cmljdCxcbiAgICAgICAgICB2YWx1ZTogYW1vdW50LFxuICAgICAgICAgIHN0cmluZzogXCJcIiArIGFtb3VudCArIHVuaXRcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQpIHtcbiAgICAgIHZhciBiaW5kQXJncywgd3JhcHBlcjtcbiAgICAgIHdyYXBwZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MsIHVuc2hpZnRBcmdzO1xuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgdW5zaGlmdEFyZ3MgPSBiaW5kQXJncy5jb25jYXQoYXJncyk7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIHVuc2hpZnRBcmdzKTtcbiAgICAgIH07XG4gICAgICBiaW5kQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgICByZXR1cm4gd3JhcHBlcjtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZ2V0UmFkaWFsUG9pbnQgPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIgcG9pbnQsIHJhZEFuZ2xlLCByYWRpdXNYLCByYWRpdXNZO1xuICAgICAgaWYgKG8gPT0gbnVsbCkge1xuICAgICAgICBvID0ge307XG4gICAgICB9XG4gICAgICBpZiAoKG8ucmFkaXVzID09IG51bGwpIHx8IChvLmFuZ2xlID09IG51bGwpIHx8IChvLmNlbnRlciA9PSBudWxsKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByYWRBbmdsZSA9IChvLmFuZ2xlIC0gOTApICogKE1hdGguUEkgLyAxODApO1xuICAgICAgcmFkaXVzWCA9IG8ucmFkaXVzWCAhPSBudWxsID8gby5yYWRpdXNYIDogby5yYWRpdXM7XG4gICAgICByYWRpdXNZID0gby5yYWRpdXNZICE9IG51bGwgPyBvLnJhZGl1c1kgOiBvLnJhZGl1cztcbiAgICAgIHJldHVybiBwb2ludCA9IHtcbiAgICAgICAgeDogby5jZW50ZXIueCArIChNYXRoLmNvcyhyYWRBbmdsZSkgKiByYWRpdXNYKSxcbiAgICAgICAgeTogby5jZW50ZXIueSArIChNYXRoLnNpbihyYWRBbmdsZSkgKiByYWRpdXNZKVxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuZ2V0UHJlZml4ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZG9tLCBwcmUsIHN0eWxlcywgdjtcbiAgICAgIHN0eWxlcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgXCJcIik7XG4gICAgICB2ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc3R5bGVzKS5qb2luKFwiXCIpLm1hdGNoKC8tKG1venx3ZWJraXR8bXMpLS8pO1xuICAgICAgcHJlID0gKHYgfHwgKHN0eWxlcy5PTGluayA9PT0gXCJcIiAmJiBbXCJcIiwgXCJvXCJdKSlbMV07XG4gICAgICBkb20gPSBcIldlYktpdHxNb3p8TVN8T1wiLm1hdGNoKG5ldyBSZWdFeHAoXCIoXCIgKyBwcmUgKyBcIilcIiwgXCJpXCIpKVsxXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRvbTogZG9tLFxuICAgICAgICBsb3dlcmNhc2U6IHByZSxcbiAgICAgICAgY3NzOiBcIi1cIiArIHByZSArIFwiLVwiLFxuICAgICAgICBqczogcHJlWzBdLnRvVXBwZXJDYXNlKCkgKyBwcmUuc3Vic3RyKDEpXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5zdHJUb0FyciA9IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgdmFyIGFycjtcbiAgICAgIGFyciA9IFtdO1xuICAgICAgaWYgKHR5cGVvZiBzdHJpbmcgPT09ICdudW1iZXInICYmICFpc05hTihzdHJpbmcpKSB7XG4gICAgICAgIGFyci5wdXNoKHRoaXMucGFyc2VVbml0KHN0cmluZykpO1xuICAgICAgICByZXR1cm4gYXJyO1xuICAgICAgfVxuICAgICAgc3RyaW5nLnRyaW0oKS5zcGxpdCgvXFxzKy9naW0pLmZvckVhY2goKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICByZXR1cm4gYXJyLnB1c2goX3RoaXMucGFyc2VVbml0KF90aGlzLnBhcnNlSWZSYW5kKHN0cikpKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpKTtcbiAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmNhbGNBcnJEZWx0YSA9IGZ1bmN0aW9uKGFycjEsIGFycjIpIHtcbiAgICAgIHZhciBkZWx0YSwgaSwgbnVtLCBfaSwgX2xlbjtcbiAgICAgIGRlbHRhID0gW107XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBhcnIxLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICBudW0gPSBhcnIxW2ldO1xuICAgICAgICBkZWx0YVtpXSA9IHRoaXMucGFyc2VVbml0KFwiXCIgKyAoYXJyMltpXS52YWx1ZSAtIGFycjFbaV0udmFsdWUpICsgYXJyMltpXS51bml0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWx0YTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuaXNBcnJheSA9IGZ1bmN0aW9uKHZhcmlhYmxlKSB7XG4gICAgICByZXR1cm4gdmFyaWFibGUgaW5zdGFuY2VvZiBBcnJheTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUubm9ybURhc2hBcnJheXMgPSBmdW5jdGlvbihhcnIxLCBhcnIyKSB7XG4gICAgICB2YXIgYXJyMUxlbiwgYXJyMkxlbiwgY3Vyckl0ZW0sIGksIGxlbkRpZmYsIHN0YXJ0SSwgX2ksIF9qO1xuICAgICAgYXJyMUxlbiA9IGFycjEubGVuZ3RoO1xuICAgICAgYXJyMkxlbiA9IGFycjIubGVuZ3RoO1xuICAgICAgaWYgKGFycjFMZW4gPiBhcnIyTGVuKSB7XG4gICAgICAgIGxlbkRpZmYgPSBhcnIxTGVuIC0gYXJyMkxlbjtcbiAgICAgICAgc3RhcnRJID0gYXJyMi5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IF9pID0gMDsgMCA8PSBsZW5EaWZmID8gX2kgPCBsZW5EaWZmIDogX2kgPiBsZW5EaWZmOyBpID0gMCA8PSBsZW5EaWZmID8gKytfaSA6IC0tX2kpIHtcbiAgICAgICAgICBjdXJySXRlbSA9IGkgKyBzdGFydEk7XG4gICAgICAgICAgYXJyMi5wdXNoKHRoaXMucGFyc2VVbml0KFwiMFwiICsgYXJyMVtjdXJySXRlbV0udW5pdCkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGFycjJMZW4gPiBhcnIxTGVuKSB7XG4gICAgICAgIGxlbkRpZmYgPSBhcnIyTGVuIC0gYXJyMUxlbjtcbiAgICAgICAgc3RhcnRJID0gYXJyMS5sZW5ndGg7XG4gICAgICAgIGZvciAoaSA9IF9qID0gMDsgMCA8PSBsZW5EaWZmID8gX2ogPCBsZW5EaWZmIDogX2ogPiBsZW5EaWZmOyBpID0gMCA8PSBsZW5EaWZmID8gKytfaiA6IC0tX2opIHtcbiAgICAgICAgICBjdXJySXRlbSA9IGkgKyBzdGFydEk7XG4gICAgICAgICAgYXJyMS5wdXNoKHRoaXMucGFyc2VVbml0KFwiMFwiICsgYXJyMltjdXJySXRlbV0udW5pdCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gW2FycjEsIGFycjJdO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5tYWtlQ29sb3JPYmogPSBmdW5jdGlvbihjb2xvcikge1xuICAgICAgdmFyIGFscGhhLCBiLCBjb2xvck9iaiwgZywgaXNSZ2IsIHIsIHJlZ2V4U3RyaW5nMSwgcmVnZXhTdHJpbmcyLCByZXN1bHQsIHJnYkNvbG9yO1xuICAgICAgaWYgKGNvbG9yWzBdID09PSAnIycpIHtcbiAgICAgICAgcmVzdWx0ID0gL14jPyhbYS1mXFxkXXsxLDJ9KShbYS1mXFxkXXsxLDJ9KShbYS1mXFxkXXsxLDJ9KSQvaS5leGVjKGNvbG9yKTtcbiAgICAgICAgY29sb3JPYmogPSB7fTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIHIgPSByZXN1bHRbMV0ubGVuZ3RoID09PSAyID8gcmVzdWx0WzFdIDogcmVzdWx0WzFdICsgcmVzdWx0WzFdO1xuICAgICAgICAgIGcgPSByZXN1bHRbMl0ubGVuZ3RoID09PSAyID8gcmVzdWx0WzJdIDogcmVzdWx0WzJdICsgcmVzdWx0WzJdO1xuICAgICAgICAgIGIgPSByZXN1bHRbM10ubGVuZ3RoID09PSAyID8gcmVzdWx0WzNdIDogcmVzdWx0WzNdICsgcmVzdWx0WzNdO1xuICAgICAgICAgIGNvbG9yT2JqID0ge1xuICAgICAgICAgICAgcjogcGFyc2VJbnQociwgMTYpLFxuICAgICAgICAgICAgZzogcGFyc2VJbnQoZywgMTYpLFxuICAgICAgICAgICAgYjogcGFyc2VJbnQoYiwgMTYpLFxuICAgICAgICAgICAgYTogMVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChjb2xvclswXSAhPT0gJyMnKSB7XG4gICAgICAgIGlzUmdiID0gY29sb3JbMF0gPT09ICdyJyAmJiBjb2xvclsxXSA9PT0gJ2cnICYmIGNvbG9yWzJdID09PSAnYic7XG4gICAgICAgIGlmIChpc1JnYikge1xuICAgICAgICAgIHJnYkNvbG9yID0gY29sb3I7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpc1JnYikge1xuICAgICAgICAgIHJnYkNvbG9yID0gIXRoaXMuc2hvcnRDb2xvcnNbY29sb3JdID8gKHRoaXMuZGl2LnN0eWxlLmNvbG9yID0gY29sb3IsIHRoaXMuY29tcHV0ZWRTdHlsZSh0aGlzLmRpdikuY29sb3IpIDogdGhpcy5zaG9ydENvbG9yc1tjb2xvcl07XG4gICAgICAgIH1cbiAgICAgICAgcmVnZXhTdHJpbmcxID0gJ15yZ2JhP1xcXFwoKFxcXFxkezEsM30pLFxcXFxzPyhcXFxcZHsxLDN9KSwnO1xuICAgICAgICByZWdleFN0cmluZzIgPSAnXFxcXHM/KFxcXFxkezEsM30pLD9cXFxccz8oXFxcXGR7MX18MD9cXFxcLlxcXFxkezEsfSk/XFxcXCkkJztcbiAgICAgICAgcmVzdWx0ID0gbmV3IFJlZ0V4cChyZWdleFN0cmluZzEgKyByZWdleFN0cmluZzIsICdnaScpLmV4ZWMocmdiQ29sb3IpO1xuICAgICAgICBjb2xvck9iaiA9IHt9O1xuICAgICAgICBhbHBoYSA9IHBhcnNlRmxvYXQocmVzdWx0WzRdIHx8IDEpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgY29sb3JPYmogPSB7XG4gICAgICAgICAgICByOiBwYXJzZUludChyZXN1bHRbMV0sIDEwKSxcbiAgICAgICAgICAgIGc6IHBhcnNlSW50KHJlc3VsdFsyXSwgMTApLFxuICAgICAgICAgICAgYjogcGFyc2VJbnQocmVzdWx0WzNdLCAxMCksXG4gICAgICAgICAgICBhOiAoYWxwaGEgIT0gbnVsbCkgJiYgIWlzTmFOKGFscGhhKSA/IGFscGhhIDogMVxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBjb2xvck9iajtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY29tcHV0ZWRTdHlsZSA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgICByZXR1cm4gZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmNhcGl0YWxpemUgPSBmdW5jdGlvbihzdHIpIHtcbiAgICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBFcnJvcignU3RyaW5nIGV4cGVjdGVkIC0gbm90aGluZyB0byBjYXBpdGFsaXplJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyLnN1YnN0cmluZygxKTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUucGFyc2VSYW5kID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICB2YXIgcmFuZCwgcmFuZEFyciwgdW5pdHM7XG4gICAgICByYW5kQXJyID0gc3RyaW5nLnNwbGl0KC9yYW5kXFwofFxcLHxcXCkvKTtcbiAgICAgIHVuaXRzID0gdGhpcy5wYXJzZVVuaXQocmFuZEFyclsyXSk7XG4gICAgICByYW5kID0gdGhpcy5yYW5kKHBhcnNlRmxvYXQocmFuZEFyclsxXSksIHBhcnNlRmxvYXQocmFuZEFyclsyXSkpO1xuICAgICAgaWYgKHVuaXRzLnVuaXQgJiYgcmFuZEFyclsyXS5tYXRjaCh1bml0cy51bml0KSkge1xuICAgICAgICByZXR1cm4gcmFuZCArIHVuaXRzLnVuaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmFuZDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUucGFyc2VTdGFnZ2VyID0gZnVuY3Rpb24oc3RyaW5nLCBpbmRleCkge1xuICAgICAgdmFyIGJhc2UsIG51bWJlciwgc3BsaXR0ZWRWYWx1ZSwgdW5pdCwgdW5pdFZhbHVlLCB2YWx1ZTtcbiAgICAgIHZhbHVlID0gc3RyaW5nLnNwbGl0KC9zdGFnZ2VyXFwofFxcKSQvKVsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgc3BsaXR0ZWRWYWx1ZSA9IHZhbHVlLnNwbGl0KC8ocmFuZFxcKC4qP1xcKXxbXlxcKCxcXHNdKykoPz1cXHMqLHxcXHMqJCkvZ2ltKTtcbiAgICAgIHZhbHVlID0gc3BsaXR0ZWRWYWx1ZS5sZW5ndGggPiAzID8gKGJhc2UgPSB0aGlzLnBhcnNlVW5pdCh0aGlzLnBhcnNlSWZSYW5kKHNwbGl0dGVkVmFsdWVbMV0pKSwgc3BsaXR0ZWRWYWx1ZVszXSkgOiAoYmFzZSA9IHRoaXMucGFyc2VVbml0KDApLCBzcGxpdHRlZFZhbHVlWzFdKTtcbiAgICAgIHZhbHVlID0gdGhpcy5wYXJzZUlmUmFuZCh2YWx1ZSk7XG4gICAgICB1bml0VmFsdWUgPSB0aGlzLnBhcnNlVW5pdCh2YWx1ZSk7XG4gICAgICBudW1iZXIgPSBpbmRleCAqIHVuaXRWYWx1ZS52YWx1ZSArIGJhc2UudmFsdWU7XG4gICAgICB1bml0ID0gYmFzZS5pc1N0cmljdCA/IGJhc2UudW5pdCA6IHVuaXRWYWx1ZS5pc1N0cmljdCA/IHVuaXRWYWx1ZS51bml0IDogJyc7XG4gICAgICBpZiAodW5pdCkge1xuICAgICAgICByZXR1cm4gXCJcIiArIG51bWJlciArIHVuaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVtYmVyO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZUlmU3RhZ2dlciA9IGZ1bmN0aW9uKHZhbHVlLCBpKSB7XG4gICAgICBpZiAoISh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLm1hdGNoKC9zdGFnZ2VyL2cpKSkge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVN0YWdnZXIodmFsdWUsIGkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZUlmUmFuZCA9IGZ1bmN0aW9uKHN0cikge1xuICAgICAgaWYgKHR5cGVvZiBzdHIgPT09ICdzdHJpbmcnICYmIHN0ci5tYXRjaCgvcmFuZFxcKC8pKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcnNlUmFuZChzdHIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUucGFyc2VEZWx0YSA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgIHZhciBkZWx0YSwgZW5kLCBlbmRBcnIsIGVuZENvbG9yT2JqLCBpLCBzdGFydCwgc3RhcnRBcnIsIHN0YXJ0Q29sb3JPYmosIF9pLCBfbGVuO1xuICAgICAgc3RhcnQgPSBPYmplY3Qua2V5cyh2YWx1ZSlbMF07XG4gICAgICBlbmQgPSB2YWx1ZVtzdGFydF07XG4gICAgICBkZWx0YSA9IHtcbiAgICAgICAgc3RhcnQ6IHN0YXJ0XG4gICAgICB9O1xuICAgICAgaWYgKGlzTmFOKHBhcnNlRmxvYXQoc3RhcnQpKSAmJiAhc3RhcnQubWF0Y2goL3JhbmRcXCgvKSkge1xuICAgICAgICBpZiAoa2V5ID09PSAnc3Ryb2tlTGluZWNhcCcpIHtcbiAgICAgICAgICB0aGlzLndhcm4oXCJTb3JyeSwgc3Ryb2tlLWxpbmVjYXAgcHJvcGVydHkgaXMgbm90IGFuaW1hdGFibGUgeWV0LCB1c2luZyB0aGUgc3RhcnQoXCIgKyBzdGFydCArIFwiKSB2YWx1ZSBpbnN0ZWFkXCIsIHZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gZGVsdGE7XG4gICAgICAgIH1cbiAgICAgICAgc3RhcnRDb2xvck9iaiA9IHRoaXMubWFrZUNvbG9yT2JqKHN0YXJ0KTtcbiAgICAgICAgZW5kQ29sb3JPYmogPSB0aGlzLm1ha2VDb2xvck9iaihlbmQpO1xuICAgICAgICBkZWx0YSA9IHtcbiAgICAgICAgICBzdGFydDogc3RhcnRDb2xvck9iaixcbiAgICAgICAgICBlbmQ6IGVuZENvbG9yT2JqLFxuICAgICAgICAgIHR5cGU6ICdjb2xvcicsXG4gICAgICAgICAgZGVsdGE6IHtcbiAgICAgICAgICAgIHI6IGVuZENvbG9yT2JqLnIgLSBzdGFydENvbG9yT2JqLnIsXG4gICAgICAgICAgICBnOiBlbmRDb2xvck9iai5nIC0gc3RhcnRDb2xvck9iai5nLFxuICAgICAgICAgICAgYjogZW5kQ29sb3JPYmouYiAtIHN0YXJ0Q29sb3JPYmouYixcbiAgICAgICAgICAgIGE6IGVuZENvbG9yT2JqLmEgLSBzdGFydENvbG9yT2JqLmFcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ3N0cm9rZURhc2hhcnJheScgfHwga2V5ID09PSAnc3Ryb2tlRGFzaG9mZnNldCcpIHtcbiAgICAgICAgc3RhcnRBcnIgPSB0aGlzLnN0clRvQXJyKHN0YXJ0KTtcbiAgICAgICAgZW5kQXJyID0gdGhpcy5zdHJUb0FycihlbmQpO1xuICAgICAgICB0aGlzLm5vcm1EYXNoQXJyYXlzKHN0YXJ0QXJyLCBlbmRBcnIpO1xuICAgICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBzdGFydEFyci5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICBzdGFydCA9IHN0YXJ0QXJyW2ldO1xuICAgICAgICAgIGVuZCA9IGVuZEFycltpXTtcbiAgICAgICAgICB0aGlzLm1lcmdlVW5pdHMoc3RhcnQsIGVuZCwga2V5KTtcbiAgICAgICAgfVxuICAgICAgICBkZWx0YSA9IHtcbiAgICAgICAgICBzdGFydDogc3RhcnRBcnIsXG4gICAgICAgICAgZW5kOiBlbmRBcnIsXG4gICAgICAgICAgZGVsdGE6IHRoaXMuY2FsY0FyckRlbHRhKHN0YXJ0QXJyLCBlbmRBcnIpLFxuICAgICAgICAgIHR5cGU6ICdhcnJheSdcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghdGhpcy5jaGFpbk9wdGlvbk1hcFtrZXldKSB7XG4gICAgICAgICAgaWYgKHRoaXMucG9zUHJvcHNNYXBba2V5XSkge1xuICAgICAgICAgICAgZW5kID0gdGhpcy5wYXJzZVVuaXQodGhpcy5wYXJzZUlmUmFuZChlbmQpKTtcbiAgICAgICAgICAgIHN0YXJ0ID0gdGhpcy5wYXJzZVVuaXQodGhpcy5wYXJzZUlmUmFuZChzdGFydCkpO1xuICAgICAgICAgICAgdGhpcy5tZXJnZVVuaXRzKHN0YXJ0LCBlbmQsIGtleSk7XG4gICAgICAgICAgICBkZWx0YSA9IHtcbiAgICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICAgICAgICBlbmQ6IGVuZCxcbiAgICAgICAgICAgICAgZGVsdGE6IGVuZC52YWx1ZSAtIHN0YXJ0LnZhbHVlLFxuICAgICAgICAgICAgICB0eXBlOiAndW5pdCdcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVuZCA9IHBhcnNlRmxvYXQodGhpcy5wYXJzZUlmUmFuZChlbmQpKTtcbiAgICAgICAgICAgIHN0YXJ0ID0gcGFyc2VGbG9hdCh0aGlzLnBhcnNlSWZSYW5kKHN0YXJ0KSk7XG4gICAgICAgICAgICBkZWx0YSA9IHtcbiAgICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICAgICAgICBlbmQ6IGVuZCxcbiAgICAgICAgICAgICAgZGVsdGE6IGVuZCAtIHN0YXJ0LFxuICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWx0YTtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUubWVyZ2VVbml0cyA9IGZ1bmN0aW9uKHN0YXJ0LCBlbmQsIGtleSkge1xuICAgICAgaWYgKCFlbmQuaXNTdHJpY3QgJiYgc3RhcnQuaXNTdHJpY3QpIHtcbiAgICAgICAgZW5kLnVuaXQgPSBzdGFydC51bml0O1xuICAgICAgICByZXR1cm4gZW5kLnN0cmluZyA9IFwiXCIgKyBlbmQudmFsdWUgKyBlbmQudW5pdDtcbiAgICAgIH0gZWxzZSBpZiAoZW5kLmlzU3RyaWN0ICYmICFzdGFydC5pc1N0cmljdCkge1xuICAgICAgICBzdGFydC51bml0ID0gZW5kLnVuaXQ7XG4gICAgICAgIHJldHVybiBzdGFydC5zdHJpbmcgPSBcIlwiICsgc3RhcnQudmFsdWUgKyBzdGFydC51bml0O1xuICAgICAgfSBlbHNlIGlmIChlbmQuaXNTdHJpY3QgJiYgc3RhcnQuaXNTdHJpY3QpIHtcbiAgICAgICAgaWYgKGVuZC51bml0ICE9PSBzdGFydC51bml0KSB7XG4gICAgICAgICAgc3RhcnQudW5pdCA9IGVuZC51bml0O1xuICAgICAgICAgIHN0YXJ0LnN0cmluZyA9IFwiXCIgKyBzdGFydC52YWx1ZSArIHN0YXJ0LnVuaXQ7XG4gICAgICAgICAgcmV0dXJuIHRoaXMud2FybihcIlR3byBkaWZmZXJlbnQgdW5pdHMgd2VyZSBzcGVjaWZpZWQgb24gXFxcIlwiICsga2V5ICsgXCJcXFwiIGRlbHRhIHByb3BlcnR5LCBtbyDCtyBqcyB3aWxsIGZhbGxiYWNrIHRvIGVuZCBcXFwiXCIgKyBlbmQudW5pdCArIFwiXFxcIiB1bml0IFwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5yYW5kID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICAgIHJldHVybiAoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKSArIG1pbjtcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuaXNET00gPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIgaXNOb2RlO1xuICAgICAgaWYgKG8gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpc05vZGUgPSB0eXBlb2Ygby5ub2RlVHlwZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIG8ubm9kZU5hbWUgPT09ICdzdHJpbmcnO1xuICAgICAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBpc05vZGU7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmdldENoaWxkRWxlbWVudHMgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgICB2YXIgY2hpbGROb2RlcywgY2hpbGRyZW4sIGk7XG4gICAgICBjaGlsZE5vZGVzID0gZWxlbWVudC5jaGlsZE5vZGVzO1xuICAgICAgY2hpbGRyZW4gPSBbXTtcbiAgICAgIGkgPSBjaGlsZE5vZGVzLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgaWYgKGNoaWxkTm9kZXNbaV0ubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgICBjaGlsZHJlbi51bnNoaWZ0KGNoaWxkTm9kZXNbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmRlbHRhID0gZnVuY3Rpb24oc3RhcnQsIGVuZCkge1xuICAgICAgdmFyIGlzVHlwZTEsIGlzVHlwZTIsIG9iaiwgdHlwZTEsIHR5cGUyO1xuICAgICAgdHlwZTEgPSB0eXBlb2Ygc3RhcnQ7XG4gICAgICB0eXBlMiA9IHR5cGVvZiBlbmQ7XG4gICAgICBpc1R5cGUxID0gdHlwZTEgPT09ICdzdHJpbmcnIHx8IHR5cGUxID09PSAnbnVtYmVyJyAmJiAhaXNOYU4oc3RhcnQpO1xuICAgICAgaXNUeXBlMiA9IHR5cGUyID09PSAnc3RyaW5nJyB8fCB0eXBlMiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKGVuZCk7XG4gICAgICBpZiAoIWlzVHlwZTEgfHwgIWlzVHlwZTIpIHtcbiAgICAgICAgdGhpcy5lcnJvcihcImRlbHRhIG1ldGhvZCBleHBlY3RzIFN0cmluZ3Mgb3IgTnVtYmVycyBhdCBpbnB1dCBidXQgZ290IC0gXCIgKyBzdGFydCArIFwiLCBcIiArIGVuZCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIG9iaiA9IHt9O1xuICAgICAgb2JqW3N0YXJ0XSA9IGVuZDtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfTtcblxuICAgIEhlbHBlcnMucHJvdG90eXBlLmdldFVuaXFJRCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICsrdGhpcy51bmlxSURzO1xuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5wYXJzZVBhdGggPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgICB2YXIgZG9tUGF0aDtcbiAgICAgIGlmICh0eXBlb2YgcGF0aCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKHBhdGguY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgPT09ICdtJykge1xuICAgICAgICAgIGRvbVBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlModGhpcy5OUywgJ3BhdGgnKTtcbiAgICAgICAgICBkb21QYXRoLnNldEF0dHJpYnV0ZU5TKG51bGwsICdkJywgcGF0aCk7XG4gICAgICAgICAgcmV0dXJuIGRvbVBhdGg7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IocGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChwYXRoLnN0eWxlKSB7XG4gICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBIZWxwZXJzLnByb3RvdHlwZS5jbG9zZUVub3VnaCA9IGZ1bmN0aW9uKG51bTEsIG51bTIsIGVwcykge1xuICAgICAgcmV0dXJuIE1hdGguYWJzKG51bTEgLSBudW0yKSA8IGVwcztcbiAgICB9O1xuXG4gICAgSGVscGVycy5wcm90b3R5cGUuY2hlY2tJZjNkID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGl2LCBwcmVmaXhlZCwgc3R5bGUsIHRyO1xuICAgICAgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB0aGlzLnN0eWxlKGRpdiwgJ3RyYW5zZm9ybScsICd0cmFuc2xhdGVaKDApJyk7XG4gICAgICBzdHlsZSA9IGRpdi5zdHlsZTtcbiAgICAgIHByZWZpeGVkID0gXCJcIiArIHRoaXMucHJlZml4LmNzcyArIFwidHJhbnNmb3JtXCI7XG4gICAgICB0ciA9IHN0eWxlW3ByZWZpeGVkXSAhPSBudWxsID8gc3R5bGVbcHJlZml4ZWRdIDogc3R5bGUudHJhbnNmb3JtO1xuICAgICAgcmV0dXJuIHRyICE9PSAnJztcbiAgICB9O1xuXG4gICAgcmV0dXJuIEhlbHBlcnM7XG5cbiAgfSkoKTtcblxuICBoID0gbmV3IEhlbHBlcnM7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBoO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB3aW5kb3cubW9qcyA9IHtcbiAgICByZXZpc2lvbjogJzAuMTQ3LjQnLFxuICAgIGlzRGVidWc6IHRydWUsXG4gICAgaGVscGVyczogcmVxdWlyZSgnLi9oJyksXG4gICAgQml0OiByZXF1aXJlKCcuL3NoYXBlcy9iaXQnKSxcbiAgICBiaXRzTWFwOiByZXF1aXJlKCcuL3NoYXBlcy9iaXRzTWFwJyksXG4gICAgQ2lyY2xlOiByZXF1aXJlKCcuL3NoYXBlcy9jaXJjbGUnKSxcbiAgICBDcm9zczogcmVxdWlyZSgnLi9zaGFwZXMvY3Jvc3MnKSxcbiAgICBMaW5lOiByZXF1aXJlKCcuL3NoYXBlcy9saW5lJyksXG4gICAgUmVjdDogcmVxdWlyZSgnLi9zaGFwZXMvcmVjdCcpLFxuICAgIFBvbHlnb246IHJlcXVpcmUoJy4vc2hhcGVzL3BvbHlnb24nKSxcbiAgICBFcXVhbDogcmVxdWlyZSgnLi9zaGFwZXMvZXF1YWwnKSxcbiAgICBaaWd6YWc6IHJlcXVpcmUoJy4vc2hhcGVzL3ppZ3phZycpLFxuICAgIEJ1cnN0OiByZXF1aXJlKCcuL2J1cnN0JyksXG4gICAgVHJhbnNpdDogcmVxdWlyZSgnLi90cmFuc2l0JyksXG4gICAgU3dpcmw6IHJlcXVpcmUoJy4vc3dpcmwnKSxcbiAgICBTdGFnZ2VyOiByZXF1aXJlKCcuL3N0YWdnZXInKSxcbiAgICBTcHJpdGVyOiByZXF1aXJlKCcuL3Nwcml0ZXInKSxcbiAgICBNb3Rpb25QYXRoOiByZXF1aXJlKCcuL21vdGlvbi1wYXRoJyksXG4gICAgVHdlZW46IHJlcXVpcmUoJy4vdHdlZW4vdHdlZW4nKSxcbiAgICBUaW1lbGluZTogcmVxdWlyZSgnLi90d2Vlbi90aW1lbGluZScpLFxuICAgIHR3ZWVuZXI6IHJlcXVpcmUoJy4vdHdlZW4vdHdlZW5lcicpLFxuICAgIGVhc2luZzogcmVxdWlyZSgnLi9lYXNpbmcvZWFzaW5nJylcbiAgfTtcblxuICBtb2pzLmggPSBtb2pzLmhlbHBlcnM7XG5cbiAgbW9qcy5kZWx0YSA9IG1vanMuaC5kZWx0YTtcblxuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbiAgaWYgKCh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIpICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoXCJtb2pzXCIsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBtb2pzO1xuICAgIH0pO1xuICB9XG5cblxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4gIGlmICgodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIikgJiYgKHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gXCJvYmplY3RcIikpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IG1vanM7XG4gIH1cblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIE1vdGlvblBhdGgsIFRpbWVsaW5lLCBUd2VlbiwgaCwgcmVzaXplLFxuICAgIF9fYmluZCA9IGZ1bmN0aW9uKGZuLCBtZSl7IHJldHVybiBmdW5jdGlvbigpeyByZXR1cm4gZm4uYXBwbHkobWUsIGFyZ3VtZW50cyk7IH07IH07XG5cbiAgaCA9IHJlcXVpcmUoJy4vaCcpO1xuXG4gIHJlc2l6ZSA9IHJlcXVpcmUoJy4vdmVuZG9yL3Jlc2l6ZScpO1xuXG4gIFR3ZWVuID0gcmVxdWlyZSgnLi90d2Vlbi90d2VlbicpO1xuXG4gIFRpbWVsaW5lID0gcmVxdWlyZSgnLi90d2Vlbi90aW1lbGluZScpO1xuXG4gIE1vdGlvblBhdGggPSAoZnVuY3Rpb24oKSB7XG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuZGVmYXVsdHMgPSB7XG4gICAgICBwYXRoOiBudWxsLFxuICAgICAgY3VydmF0dXJlOiB7XG4gICAgICAgIHg6ICc3NSUnLFxuICAgICAgICB5OiAnNTAlJ1xuICAgICAgfSxcbiAgICAgIGlzQ29tcG9zaXRlTGF5ZXI6IHRydWUsXG4gICAgICBkZWxheTogMCxcbiAgICAgIGR1cmF0aW9uOiAxMDAwLFxuICAgICAgZWFzaW5nOiBudWxsLFxuICAgICAgcmVwZWF0OiAwLFxuICAgICAgeW95bzogZmFsc2UsXG4gICAgICBvZmZzZXRYOiAwLFxuICAgICAgb2Zmc2V0WTogMCxcbiAgICAgIGFuZ2xlT2Zmc2V0OiBudWxsLFxuICAgICAgcGF0aFN0YXJ0OiAwLFxuICAgICAgcGF0aEVuZDogMSxcbiAgICAgIG1vdGlvbkJsdXI6IDAsXG4gICAgICB0cmFuc2Zvcm1PcmlnaW46IG51bGwsXG4gICAgICBpc0FuZ2xlOiBmYWxzZSxcbiAgICAgIGlzUmV2ZXJzZTogZmFsc2UsXG4gICAgICBpc1J1bkxlc3M6IGZhbHNlLFxuICAgICAgaXNQcmVzZXRQb3NpdGlvbjogdHJ1ZSxcbiAgICAgIG9uU3RhcnQ6IG51bGwsXG4gICAgICBvbkNvbXBsZXRlOiBudWxsLFxuICAgICAgb25VcGRhdGU6IG51bGxcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gTW90aW9uUGF0aChvKSB7XG4gICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICB0aGlzLmNhbGNIZWlnaHQgPSBfX2JpbmQodGhpcy5jYWxjSGVpZ2h0LCB0aGlzKTtcbiAgICAgIGlmICh0aGlzLnZhcnMoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLmNyZWF0ZVR3ZWVuKCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZ2V0U2NhbGVyID0gaC5iaW5kKHRoaXMuZ2V0U2NhbGVyLCB0aGlzKTtcbiAgICAgIHRoaXMucmVzaXplID0gcmVzaXplO1xuICAgICAgdGhpcy5wcm9wcyA9IGguY2xvbmVPYmoodGhpcy5kZWZhdWx0cyk7XG4gICAgICB0aGlzLmV4dGVuZE9wdGlvbnModGhpcy5vKTtcbiAgICAgIHRoaXMuaXNNb3Rpb25CbHVyUmVzZXQgPSBoLmlzU2FmYXJpIHx8IGguaXNJRTtcbiAgICAgIHRoaXMuaXNNb3Rpb25CbHVyUmVzZXQgJiYgKHRoaXMucHJvcHMubW90aW9uQmx1ciA9IDApO1xuICAgICAgdGhpcy5oaXN0b3J5ID0gW2guY2xvbmVPYmoodGhpcy5wcm9wcyldO1xuICAgICAgcmV0dXJuIHRoaXMucG9zdFZhcnMoKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuY3VydmVUb1BhdGggPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIgYW5nbGUsIGN1cnZhdHVyZSwgY3VydmF0dXJlWCwgY3VydmF0dXJlWSwgY3VydmVQb2ludCwgY3VydmVYUG9pbnQsIGRYLCBkWSwgZW5kUG9pbnQsIHBhdGgsIHBlcmNlbnQsIHJhZGl1cywgc3RhcnQ7XG4gICAgICBwYXRoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKGguTlMsICdwYXRoJyk7XG4gICAgICBzdGFydCA9IG8uc3RhcnQ7XG4gICAgICBlbmRQb2ludCA9IHtcbiAgICAgICAgeDogc3RhcnQueCArIG8uc2hpZnQueCxcbiAgICAgICAgeTogc3RhcnQueCArIG8uc2hpZnQueVxuICAgICAgfTtcbiAgICAgIGN1cnZhdHVyZSA9IG8uY3VydmF0dXJlO1xuICAgICAgZFggPSBvLnNoaWZ0Lng7XG4gICAgICBkWSA9IG8uc2hpZnQueTtcbiAgICAgIHJhZGl1cyA9IE1hdGguc3FydChkWCAqIGRYICsgZFkgKiBkWSk7XG4gICAgICBwZXJjZW50ID0gcmFkaXVzIC8gMTAwO1xuICAgICAgYW5nbGUgPSBNYXRoLmF0YW4oZFkgLyBkWCkgKiAoMTgwIC8gTWF0aC5QSSkgKyA5MDtcbiAgICAgIGlmIChvLnNoaWZ0LnggPCAwKSB7XG4gICAgICAgIGFuZ2xlID0gYW5nbGUgKyAxODA7XG4gICAgICB9XG4gICAgICBjdXJ2YXR1cmVYID0gaC5wYXJzZVVuaXQoY3VydmF0dXJlLngpO1xuICAgICAgY3VydmF0dXJlWCA9IGN1cnZhdHVyZVgudW5pdCA9PT0gJyUnID8gY3VydmF0dXJlWC52YWx1ZSAqIHBlcmNlbnQgOiBjdXJ2YXR1cmVYLnZhbHVlO1xuICAgICAgY3VydmVYUG9pbnQgPSBoLmdldFJhZGlhbFBvaW50KHtcbiAgICAgICAgY2VudGVyOiB7XG4gICAgICAgICAgeDogc3RhcnQueCxcbiAgICAgICAgICB5OiBzdGFydC55XG4gICAgICAgIH0sXG4gICAgICAgIHJhZGl1czogY3VydmF0dXJlWCxcbiAgICAgICAgYW5nbGU6IGFuZ2xlXG4gICAgICB9KTtcbiAgICAgIGN1cnZhdHVyZVkgPSBoLnBhcnNlVW5pdChjdXJ2YXR1cmUueSk7XG4gICAgICBjdXJ2YXR1cmVZID0gY3VydmF0dXJlWS51bml0ID09PSAnJScgPyBjdXJ2YXR1cmVZLnZhbHVlICogcGVyY2VudCA6IGN1cnZhdHVyZVkudmFsdWU7XG4gICAgICBjdXJ2ZVBvaW50ID0gaC5nZXRSYWRpYWxQb2ludCh7XG4gICAgICAgIGNlbnRlcjoge1xuICAgICAgICAgIHg6IGN1cnZlWFBvaW50LngsXG4gICAgICAgICAgeTogY3VydmVYUG9pbnQueVxuICAgICAgICB9LFxuICAgICAgICByYWRpdXM6IGN1cnZhdHVyZVksXG4gICAgICAgIGFuZ2xlOiBhbmdsZSArIDkwXG4gICAgICB9KTtcbiAgICAgIHBhdGguc2V0QXR0cmlidXRlKCdkJywgXCJNXCIgKyBzdGFydC54ICsgXCIsXCIgKyBzdGFydC55ICsgXCIgUVwiICsgY3VydmVQb2ludC54ICsgXCIsXCIgKyBjdXJ2ZVBvaW50LnkgKyBcIiBcIiArIGVuZFBvaW50LnggKyBcIixcIiArIGVuZFBvaW50LnkpO1xuICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnBvc3RWYXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnByb3BzLnBhdGhTdGFydCA9IGguY2xhbXAodGhpcy5wcm9wcy5wYXRoU3RhcnQsIDAsIDEpO1xuICAgICAgdGhpcy5wcm9wcy5wYXRoRW5kID0gaC5jbGFtcCh0aGlzLnByb3BzLnBhdGhFbmQsIHRoaXMucHJvcHMucGF0aFN0YXJ0LCAxKTtcbiAgICAgIHRoaXMuYW5nbGUgPSAwO1xuICAgICAgdGhpcy5zcGVlZFggPSAwO1xuICAgICAgdGhpcy5zcGVlZFkgPSAwO1xuICAgICAgdGhpcy5ibHVyWCA9IDA7XG4gICAgICB0aGlzLmJsdXJZID0gMDtcbiAgICAgIHRoaXMucHJldkNvb3JkcyA9IHt9O1xuICAgICAgdGhpcy5ibHVyQW1vdW50ID0gMjA7XG4gICAgICB0aGlzLnByb3BzLm1vdGlvbkJsdXIgPSBoLmNsYW1wKHRoaXMucHJvcHMubW90aW9uQmx1ciwgMCwgMSk7XG4gICAgICB0aGlzLm9uVXBkYXRlID0gdGhpcy5wcm9wcy5vblVwZGF0ZTtcbiAgICAgIGlmICghdGhpcy5vLmVsKSB7XG4gICAgICAgIGguZXJyb3IoJ01pc3NlZCBcImVsXCIgb3B0aW9uLiBJdCBjb3VsZCBiZSBhIHNlbGVjdG9yLCBET01Ob2RlIG9yIGFub3RoZXIgbW9kdWxlLicpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwgPSB0aGlzLnBhcnNlRWwodGhpcy5wcm9wcy5lbCk7XG4gICAgICB0aGlzLnByb3BzLm1vdGlvbkJsdXIgPiAwICYmIHRoaXMuY3JlYXRlRmlsdGVyKCk7XG4gICAgICB0aGlzLnBhdGggPSB0aGlzLmdldFBhdGgoKTtcbiAgICAgIGlmICghdGhpcy5wYXRoLmdldEF0dHJpYnV0ZSgnZCcpKSB7XG4gICAgICAgIGguZXJyb3IoJ1BhdGggaGFzIG5vIGNvb3JkaW5hdGVzIHRvIHdvcmsgd2l0aCwgYWJvcnRpbmcnKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLmxlbiA9IHRoaXMucGF0aC5nZXRUb3RhbExlbmd0aCgpO1xuICAgICAgdGhpcy5zbGljZWRMZW4gPSB0aGlzLmxlbiAqICh0aGlzLnByb3BzLnBhdGhFbmQgLSB0aGlzLnByb3BzLnBhdGhTdGFydCk7XG4gICAgICB0aGlzLnN0YXJ0TGVuID0gdGhpcy5wcm9wcy5wYXRoU3RhcnQgKiB0aGlzLmxlbjtcbiAgICAgIHRoaXMuZmlsbCA9IHRoaXMucHJvcHMuZmlsbDtcbiAgICAgIGlmICh0aGlzLmZpbGwgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IHRoaXMucGFyc2VFbCh0aGlzLnByb3BzLmZpbGwuY29udGFpbmVyKTtcbiAgICAgICAgdGhpcy5maWxsUnVsZSA9IHRoaXMucHJvcHMuZmlsbC5maWxsUnVsZSB8fCAnYWxsJztcbiAgICAgICAgdGhpcy5nZXRTY2FsZXIoKTtcbiAgICAgICAgaWYgKHRoaXMuY29udGFpbmVyICE9IG51bGwpIHtcbiAgICAgICAgICB0aGlzLnJlbW92ZUV2ZW50KHRoaXMuY29udGFpbmVyLCAnb25yZXNpemUnLCB0aGlzLmdldFNjYWxlcik7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYWRkRXZlbnQodGhpcy5jb250YWluZXIsICdvbnJlc2l6ZScsIHRoaXMuZ2V0U2NhbGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5hZGRFdmVudCA9IGZ1bmN0aW9uKGVsLCB0eXBlLCBoYW5kbGVyKSB7XG4gICAgICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBmYWxzZSk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnJlbW92ZUV2ZW50ID0gZnVuY3Rpb24oZWwsIHR5cGUsIGhhbmRsZXIpIHtcbiAgICAgIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGhhbmRsZXIsIGZhbHNlKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuY3JlYXRlRmlsdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGl2LCBzdmc7XG4gICAgICBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHRoaXMuZmlsdGVySUQgPSBcImZpbHRlci1cIiArIChoLmdldFVuaXFJRCgpKTtcbiAgICAgIGRpdi5pbm5lckhUTUwgPSBcIjxzdmcgaWQ9XFxcInN2Zy1cIiArIHRoaXMuZmlsdGVySUQgKyBcIlxcXCJcXG4gICAgc3R5bGU9XFxcInZpc2liaWxpdHk6aGlkZGVuOyB3aWR0aDowcHg7IGhlaWdodDowcHhcXFwiPlxcbiAgPGZpbHRlciBpZD1cXFwiXCIgKyB0aGlzLmZpbHRlcklEICsgXCJcXFwiIHk9XFxcIi0yMFxcXCIgeD1cXFwiLTIwXFxcIiB3aWR0aD1cXFwiNDBcXFwiIGhlaWdodD1cXFwiNDBcXFwiPlxcbiAgICA8ZmVPZmZzZXRcXG4gICAgICBpZD1cXFwiYmx1ci1vZmZzZXRcXFwiIGluPVxcXCJTb3VyY2VHcmFwaGljXFxcIlxcbiAgICAgIGR4PVxcXCIwXFxcIiBkeT1cXFwiMFxcXCIgcmVzdWx0PVxcXCJvZmZzZXQyXFxcIj48L2ZlT2Zmc2V0PlxcbiAgICA8ZmVHYXVzc2lhbmJsdXJcXG4gICAgICBpZD1cXFwiYmx1clxcXCIgaW49XFxcIm9mZnNldDJcXFwiXFxuICAgICAgc3RkRGV2aWF0aW9uPVxcXCIwLDBcXFwiIHJlc3VsdD1cXFwiYmx1cjJcXFwiPjwvZmVHYXVzc2lhbmJsdXI+XFxuICAgIDxmZU1lcmdlPlxcbiAgICAgIDxmZU1lcmdlTm9kZSBpbj1cXFwiU291cmNlR3JhcGhpY1xcXCI+PC9mZU1lcmdlTm9kZT5cXG4gICAgICA8ZmVNZXJnZU5vZGUgaW49XFxcImJsdXIyXFxcIj48L2ZlTWVyZ2VOb2RlPlxcbiAgICA8L2ZlTWVyZ2U+XFxuICA8L2ZpbHRlcj5cXG48L3N2Zz5cIjtcbiAgICAgIHN2ZyA9IGRpdi5xdWVyeVNlbGVjdG9yKFwiI3N2Zy1cIiArIHRoaXMuZmlsdGVySUQpO1xuICAgICAgdGhpcy5maWx0ZXIgPSBzdmcucXVlcnlTZWxlY3RvcignI2JsdXInKTtcbiAgICAgIHRoaXMuZmlsdGVyT2Zmc2V0ID0gc3ZnLnF1ZXJ5U2VsZWN0b3IoJyNibHVyLW9mZnNldCcpO1xuICAgICAgZG9jdW1lbnQuYm9keS5pbnNlcnRCZWZvcmUoc3ZnLCBkb2N1bWVudC5ib2R5LmZpcnN0Q2hpbGQpO1xuICAgICAgdGhpcy5lbC5zdHlsZVsnZmlsdGVyJ10gPSBcInVybCgjXCIgKyB0aGlzLmZpbHRlcklEICsgXCIpXCI7XG4gICAgICByZXR1cm4gdGhpcy5lbC5zdHlsZVtcIlwiICsgaC5wcmVmaXguY3NzICsgXCJmaWx0ZXJcIl0gPSBcInVybCgjXCIgKyB0aGlzLmZpbHRlcklEICsgXCIpXCI7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnBhcnNlRWwgPSBmdW5jdGlvbihlbCkge1xuICAgICAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpO1xuICAgICAgfVxuICAgICAgaWYgKGVsIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgICAgfVxuICAgICAgaWYgKGVsLnNldFByb3AgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLmlzTW9kdWxlID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcGF0aDtcbiAgICAgIHBhdGggPSBoLnBhcnNlUGF0aCh0aGlzLnByb3BzLnBhdGgpO1xuICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5wcm9wcy5wYXRoLnggfHwgdGhpcy5wcm9wcy5wYXRoLnkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VydmVUb1BhdGgoe1xuICAgICAgICAgIHN0YXJ0OiB7XG4gICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgeTogMFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2hpZnQ6IHtcbiAgICAgICAgICAgIHg6IHRoaXMucHJvcHMucGF0aC54IHx8IDAsXG4gICAgICAgICAgICB5OiB0aGlzLnByb3BzLnBhdGgueSB8fCAwXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjdXJ2YXR1cmU6IHtcbiAgICAgICAgICAgIHg6IHRoaXMucHJvcHMuY3VydmF0dXJlLnggfHwgdGhpcy5kZWZhdWx0cy5jdXJ2YXR1cmUueCxcbiAgICAgICAgICAgIHk6IHRoaXMucHJvcHMuY3VydmF0dXJlLnkgfHwgdGhpcy5kZWZhdWx0cy5jdXJ2YXR1cmUueVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmdldFNjYWxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGVuZCwgc2l6ZSwgc3RhcnQ7XG4gICAgICB0aGlzLmNTaXplID0ge1xuICAgICAgICB3aWR0aDogdGhpcy5jb250YWluZXIub2Zmc2V0V2lkdGggfHwgMCxcbiAgICAgICAgaGVpZ2h0OiB0aGlzLmNvbnRhaW5lci5vZmZzZXRIZWlnaHQgfHwgMFxuICAgICAgfTtcbiAgICAgIHN0YXJ0ID0gdGhpcy5wYXRoLmdldFBvaW50QXRMZW5ndGgoMCk7XG4gICAgICBlbmQgPSB0aGlzLnBhdGguZ2V0UG9pbnRBdExlbmd0aCh0aGlzLmxlbik7XG4gICAgICBzaXplID0ge307XG4gICAgICB0aGlzLnNjYWxlciA9IHt9O1xuICAgICAgc2l6ZS53aWR0aCA9IGVuZC54ID49IHN0YXJ0LnggPyBlbmQueCAtIHN0YXJ0LnggOiBzdGFydC54IC0gZW5kLng7XG4gICAgICBzaXplLmhlaWdodCA9IGVuZC55ID49IHN0YXJ0LnkgPyBlbmQueSAtIHN0YXJ0LnkgOiBzdGFydC55IC0gZW5kLnk7XG4gICAgICBzd2l0Y2ggKHRoaXMuZmlsbFJ1bGUpIHtcbiAgICAgICAgY2FzZSAnYWxsJzpcbiAgICAgICAgICB0aGlzLmNhbGNXaWR0aChzaXplKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jYWxjSGVpZ2h0KHNpemUpO1xuICAgICAgICBjYXNlICd3aWR0aCc6XG4gICAgICAgICAgdGhpcy5jYWxjV2lkdGgoc2l6ZSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2NhbGVyLnkgPSB0aGlzLnNjYWxlci54O1xuICAgICAgICBjYXNlICdoZWlnaHQnOlxuICAgICAgICAgIHRoaXMuY2FsY0hlaWdodChzaXplKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zY2FsZXIueCA9IHRoaXMuc2NhbGVyLnk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmNhbGNXaWR0aCA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICAgIHRoaXMuc2NhbGVyLnggPSB0aGlzLmNTaXplLndpZHRoIC8gc2l6ZS53aWR0aDtcbiAgICAgIHJldHVybiAhaXNGaW5pdGUodGhpcy5zY2FsZXIueCkgJiYgKHRoaXMuc2NhbGVyLnggPSAxKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuY2FsY0hlaWdodCA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICAgIHRoaXMuc2NhbGVyLnkgPSB0aGlzLmNTaXplLmhlaWdodCAvIHNpemUuaGVpZ2h0O1xuICAgICAgcmV0dXJuICFpc0Zpbml0ZSh0aGlzLnNjYWxlci55KSAmJiAodGhpcy5zY2FsZXIueSA9IDEpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbihvKSB7XG4gICAgICB2YXIgZmlzdEl0ZW0sIGtleSwgdmFsdWU7XG4gICAgICBpZiAobykge1xuICAgICAgICBmaXN0SXRlbSA9IHRoaXMuaGlzdG9yeVswXTtcbiAgICAgICAgZm9yIChrZXkgaW4gbykge1xuICAgICAgICAgIHZhbHVlID0gb1trZXldO1xuICAgICAgICAgIGlmIChoLmNhbGxiYWNrc01hcFtrZXldIHx8IGgudHdlZW5PcHRpb25NYXBba2V5XSkge1xuICAgICAgICAgICAgaC53YXJuKFwidGhlIHByb3BlcnR5IFxcXCJcIiArIGtleSArIFwiXFxcIiBwcm9wZXJ0eSBjYW4gbm90IGJlIG92ZXJyaWRkZW4gb24gcnVuIHlldFwiKTtcbiAgICAgICAgICAgIGRlbGV0ZSBvW2tleV07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaGlzdG9yeVswXVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMudHVuZU9wdGlvbnMobyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zdGFydFR3ZWVuKCk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmNyZWF0ZVR3ZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnR3ZWVuID0gbmV3IFR3ZWVuKHtcbiAgICAgICAgZHVyYXRpb246IHRoaXMucHJvcHMuZHVyYXRpb24sXG4gICAgICAgIGRlbGF5OiB0aGlzLnByb3BzLmRlbGF5LFxuICAgICAgICB5b3lvOiB0aGlzLnByb3BzLnlveW8sXG4gICAgICAgIHJlcGVhdDogdGhpcy5wcm9wcy5yZXBlYXQsXG4gICAgICAgIGVhc2luZzogdGhpcy5wcm9wcy5lYXNpbmcsXG4gICAgICAgIG9uU3RhcnQ6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25TdGFydCkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpLFxuICAgICAgICBvbkNvbXBsZXRlOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICAgIF90aGlzLnByb3BzLm1vdGlvbkJsdXIgJiYgX3RoaXMuc2V0Qmx1cih7XG4gICAgICAgICAgICAgIGJsdXI6IHtcbiAgICAgICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgICAgIHk6IDBcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgb2Zmc2V0OiB7XG4gICAgICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgICAgICB5OiAwXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25Db21wbGV0ZSkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpLFxuICAgICAgICBvblVwZGF0ZTogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5zZXRQcm9ncmVzcyhwKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKSxcbiAgICAgICAgb25GaXJzdFVwZGF0ZUJhY2t3YXJkOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuaGlzdG9yeS5sZW5ndGggPiAxICYmIF90aGlzLnR1bmVPcHRpb25zKF90aGlzLmhpc3RvcnlbMF0pO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpXG4gICAgICB9KTtcbiAgICAgIHRoaXMudGltZWxpbmUgPSBuZXcgVGltZWxpbmU7XG4gICAgICB0aGlzLnRpbWVsaW5lLmFkZCh0aGlzLnR3ZWVuKTtcbiAgICAgICF0aGlzLnByb3BzLmlzUnVuTGVzcyAmJiB0aGlzLnN0YXJ0VHdlZW4oKTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLmlzUHJlc2V0UG9zaXRpb24gJiYgdGhpcy5zZXRQcm9ncmVzcygwLCB0cnVlKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuc3RhcnRUd2VlbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHNldFRpbWVvdXQoKChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMudGltZWxpbmUpICE9IG51bGwgPyBfcmVmLnN0YXJ0KCkgOiB2b2lkIDA7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSksIDEpO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5zZXRQcm9ncmVzcyA9IGZ1bmN0aW9uKHAsIGlzSW5pdCkge1xuICAgICAgdmFyIGxlbiwgcG9pbnQsIHgsIHk7XG4gICAgICBsZW4gPSB0aGlzLnN0YXJ0TGVuICsgKCF0aGlzLnByb3BzLmlzUmV2ZXJzZSA/IHAgKiB0aGlzLnNsaWNlZExlbiA6ICgxIC0gcCkgKiB0aGlzLnNsaWNlZExlbik7XG4gICAgICBwb2ludCA9IHRoaXMucGF0aC5nZXRQb2ludEF0TGVuZ3RoKGxlbik7XG4gICAgICB4ID0gcG9pbnQueCArIHRoaXMucHJvcHMub2Zmc2V0WDtcbiAgICAgIHkgPSBwb2ludC55ICsgdGhpcy5wcm9wcy5vZmZzZXRZO1xuICAgICAgdGhpcy5fZ2V0Q3VycmVudEFuZ2xlKHBvaW50LCBsZW4sIHApO1xuICAgICAgdGhpcy5fc2V0VHJhbnNmb3JtT3JpZ2luKHApO1xuICAgICAgdGhpcy5fc2V0VHJhbnNmb3JtKHgsIHksIHAsIGlzSW5pdCk7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy5tb3Rpb25CbHVyICYmIHRoaXMubWFrZU1vdGlvbkJsdXIoeCwgeSk7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnNldEVsUG9zaXRpb24gPSBmdW5jdGlvbih4LCB5LCBwKSB7XG4gICAgICB2YXIgY29tcG9zaXRlLCBpc0NvbXBvc2l0ZSwgcm90YXRlLCB0cmFuc2Zvcm07XG4gICAgICByb3RhdGUgPSB0aGlzLmFuZ2xlICE9PSAwID8gXCJyb3RhdGUoXCIgKyB0aGlzLmFuZ2xlICsgXCJkZWcpXCIgOiAnJztcbiAgICAgIGlzQ29tcG9zaXRlID0gdGhpcy5wcm9wcy5pc0NvbXBvc2l0ZUxheWVyICYmIGguaXMzZDtcbiAgICAgIGNvbXBvc2l0ZSA9IGlzQ29tcG9zaXRlID8gJ3RyYW5zbGF0ZVooMCknIDogJyc7XG4gICAgICB0cmFuc2Zvcm0gPSBcInRyYW5zbGF0ZShcIiArIHggKyBcInB4LFwiICsgeSArIFwicHgpIFwiICsgcm90YXRlICsgXCIgXCIgKyBjb21wb3NpdGU7XG4gICAgICByZXR1cm4gaC5zZXRQcmVmaXhlZFN0eWxlKHRoaXMuZWwsICd0cmFuc2Zvcm0nLCB0cmFuc2Zvcm0pO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5zZXRNb2R1bGVQb3NpdGlvbiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgIHRoaXMuZWwuc2V0UHJvcCh7XG4gICAgICAgIHNoaWZ0WDogXCJcIiArIHggKyBcInB4XCIsXG4gICAgICAgIHNoaWZ0WTogXCJcIiArIHkgKyBcInB4XCIsXG4gICAgICAgIGFuZ2xlOiB0aGlzLmFuZ2xlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLmVsLmRyYXcoKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuX2dldEN1cnJlbnRBbmdsZSA9IGZ1bmN0aW9uKHBvaW50LCBsZW4sIHApIHtcbiAgICAgIHZhciBhdGFuLCBpc1RyYW5zZm9ybUZ1bk9yaWdpbiwgcHJldlBvaW50LCB4MSwgeDI7XG4gICAgICBpc1RyYW5zZm9ybUZ1bk9yaWdpbiA9IHR5cGVvZiB0aGlzLnByb3BzLnRyYW5zZm9ybU9yaWdpbiA9PT0gJ2Z1bmN0aW9uJztcbiAgICAgIGlmICh0aGlzLnByb3BzLmlzQW5nbGUgfHwgKHRoaXMucHJvcHMuYW5nbGVPZmZzZXQgIT0gbnVsbCkgfHwgaXNUcmFuc2Zvcm1GdW5PcmlnaW4pIHtcbiAgICAgICAgcHJldlBvaW50ID0gdGhpcy5wYXRoLmdldFBvaW50QXRMZW5ndGgobGVuIC0gMSk7XG4gICAgICAgIHgxID0gcG9pbnQueSAtIHByZXZQb2ludC55O1xuICAgICAgICB4MiA9IHBvaW50LnggLSBwcmV2UG9pbnQueDtcbiAgICAgICAgYXRhbiA9IE1hdGguYXRhbih4MSAvIHgyKTtcbiAgICAgICAgIWlzRmluaXRlKGF0YW4pICYmIChhdGFuID0gMCk7XG4gICAgICAgIHRoaXMuYW5nbGUgPSBhdGFuICogaC5SQURfVE9fREVHO1xuICAgICAgICBpZiAoKHR5cGVvZiB0aGlzLnByb3BzLmFuZ2xlT2Zmc2V0KSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHJldHVybiB0aGlzLmFuZ2xlICs9IHRoaXMucHJvcHMuYW5nbGVPZmZzZXQgfHwgMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hbmdsZSA9IHRoaXMucHJvcHMuYW5nbGVPZmZzZXQuY2FsbCh0aGlzLCB0aGlzLmFuZ2xlLCBwKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5nbGUgPSAwO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5fc2V0VHJhbnNmb3JtID0gZnVuY3Rpb24oeCwgeSwgcCwgaXNJbml0KSB7XG4gICAgICB2YXIgdHJhbnNmb3JtO1xuICAgICAgaWYgKHRoaXMuc2NhbGVyKSB7XG4gICAgICAgIHggKj0gdGhpcy5zY2FsZXIueDtcbiAgICAgICAgeSAqPSB0aGlzLnNjYWxlci55O1xuICAgICAgfVxuICAgICAgdHJhbnNmb3JtID0gbnVsbDtcbiAgICAgIGlmICghaXNJbml0KSB7XG4gICAgICAgIHRyYW5zZm9ybSA9IHR5cGVvZiB0aGlzLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIgPyB0aGlzLm9uVXBkYXRlKHAsIHtcbiAgICAgICAgICB4OiB4LFxuICAgICAgICAgIHk6IHksXG4gICAgICAgICAgYW5nbGU6IHRoaXMuYW5nbGVcbiAgICAgICAgfSkgOiB2b2lkIDA7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc01vZHVsZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRNb2R1bGVQb3NpdGlvbih4LCB5KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2YgdHJhbnNmb3JtICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNldEVsUG9zaXRpb24oeCwgeSwgcCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGguc2V0UHJlZml4ZWRTdHlsZSh0aGlzLmVsLCAndHJhbnNmb3JtJywgdHJhbnNmb3JtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5fc2V0VHJhbnNmb3JtT3JpZ2luID0gZnVuY3Rpb24ocCkge1xuICAgICAgdmFyIGlzVHJhbnNmb3JtRnVuT3JpZ2luLCB0T3JpZ2luO1xuICAgICAgaWYgKHRoaXMucHJvcHMudHJhbnNmb3JtT3JpZ2luKSB7XG4gICAgICAgIGlzVHJhbnNmb3JtRnVuT3JpZ2luID0gdHlwZW9mIHRoaXMucHJvcHMudHJhbnNmb3JtT3JpZ2luID09PSAnZnVuY3Rpb24nO1xuICAgICAgICB0T3JpZ2luID0gIWlzVHJhbnNmb3JtRnVuT3JpZ2luID8gdGhpcy5wcm9wcy50cmFuc2Zvcm1PcmlnaW4gOiB0aGlzLnByb3BzLnRyYW5zZm9ybU9yaWdpbih0aGlzLmFuZ2xlLCBwKTtcbiAgICAgICAgcmV0dXJuIGguc2V0UHJlZml4ZWRTdHlsZSh0aGlzLmVsLCAndHJhbnNmb3JtLW9yaWdpbicsIHRPcmlnaW4pO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5tYWtlTW90aW9uQmx1ciA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAgIHZhciBhYnNvbHV0ZUFuZ2xlLCBjb29yZHMsIGRYLCBkWSwgc2lnblgsIHNpZ25ZLCB0YWlsQW5nbGU7XG4gICAgICB0YWlsQW5nbGUgPSAwO1xuICAgICAgc2lnblggPSAxO1xuICAgICAgc2lnblkgPSAxO1xuICAgICAgaWYgKCh0aGlzLnByZXZDb29yZHMueCA9PSBudWxsKSB8fCAodGhpcy5wcmV2Q29vcmRzLnkgPT0gbnVsbCkpIHtcbiAgICAgICAgdGhpcy5zcGVlZFggPSAwO1xuICAgICAgICB0aGlzLnNwZWVkWSA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkWCA9IHggLSB0aGlzLnByZXZDb29yZHMueDtcbiAgICAgICAgZFkgPSB5IC0gdGhpcy5wcmV2Q29vcmRzLnk7XG4gICAgICAgIGlmIChkWCA+IDApIHtcbiAgICAgICAgICBzaWduWCA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzaWduWCA8IDApIHtcbiAgICAgICAgICBzaWduWSA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3BlZWRYID0gTWF0aC5hYnMoZFgpO1xuICAgICAgICB0aGlzLnNwZWVkWSA9IE1hdGguYWJzKGRZKTtcbiAgICAgICAgdGFpbEFuZ2xlID0gTWF0aC5hdGFuKGRZIC8gZFgpICogKDE4MCAvIE1hdGguUEkpICsgOTA7XG4gICAgICB9XG4gICAgICBhYnNvbHV0ZUFuZ2xlID0gdGFpbEFuZ2xlIC0gdGhpcy5hbmdsZTtcbiAgICAgIGNvb3JkcyA9IHRoaXMuYW5nVG9Db29yZHMoYWJzb2x1dGVBbmdsZSk7XG4gICAgICB0aGlzLmJsdXJYID0gaC5jbGFtcCgodGhpcy5zcGVlZFggLyAxNikgKiB0aGlzLnByb3BzLm1vdGlvbkJsdXIsIDAsIDEpO1xuICAgICAgdGhpcy5ibHVyWSA9IGguY2xhbXAoKHRoaXMuc3BlZWRZIC8gMTYpICogdGhpcy5wcm9wcy5tb3Rpb25CbHVyLCAwLCAxKTtcbiAgICAgIHRoaXMuc2V0Qmx1cih7XG4gICAgICAgIGJsdXI6IHtcbiAgICAgICAgICB4OiAzICogdGhpcy5ibHVyWCAqIHRoaXMuYmx1ckFtb3VudCAqIE1hdGguYWJzKGNvb3Jkcy54KSxcbiAgICAgICAgICB5OiAzICogdGhpcy5ibHVyWSAqIHRoaXMuYmx1ckFtb3VudCAqIE1hdGguYWJzKGNvb3Jkcy55KVxuICAgICAgICB9LFxuICAgICAgICBvZmZzZXQ6IHtcbiAgICAgICAgICB4OiAzICogc2lnblggKiB0aGlzLmJsdXJYICogY29vcmRzLnggKiB0aGlzLmJsdXJBbW91bnQsXG4gICAgICAgICAgeTogMyAqIHNpZ25ZICogdGhpcy5ibHVyWSAqIGNvb3Jkcy55ICogdGhpcy5ibHVyQW1vdW50XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5wcmV2Q29vcmRzLnggPSB4O1xuICAgICAgcmV0dXJuIHRoaXMucHJldkNvb3Jkcy55ID0geTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuc2V0Qmx1ciA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIGlmICghdGhpcy5pc01vdGlvbkJsdXJSZXNldCkge1xuICAgICAgICB0aGlzLmZpbHRlci5zZXRBdHRyaWJ1dGUoJ3N0ZERldmlhdGlvbicsIFwiXCIgKyBvLmJsdXIueCArIFwiLFwiICsgby5ibHVyLnkpO1xuICAgICAgICB0aGlzLmZpbHRlck9mZnNldC5zZXRBdHRyaWJ1dGUoJ2R4Jywgby5vZmZzZXQueCk7XG4gICAgICAgIHJldHVybiB0aGlzLmZpbHRlck9mZnNldC5zZXRBdHRyaWJ1dGUoJ2R5Jywgby5vZmZzZXQueSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLmV4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGtleSwgdmFsdWUsIF9yZXN1bHRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoa2V5IGluIG8pIHtcbiAgICAgICAgdmFsdWUgPSBvW2tleV07XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpc1trZXldID0gdmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS5leHRlbmRPcHRpb25zID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGtleSwgdmFsdWUsIF9yZXN1bHRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoa2V5IGluIG8pIHtcbiAgICAgICAgdmFsdWUgPSBvW2tleV07XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wcm9wc1trZXldID0gdmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBNb3Rpb25QYXRoLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24obykge1xuICAgICAgdmFyIGl0LCBrZXksIG9wdHMsIHByZXZPcHRpb25zLCB2YWx1ZTtcbiAgICAgIHByZXZPcHRpb25zID0gdGhpcy5oaXN0b3J5W3RoaXMuaGlzdG9yeS5sZW5ndGggLSAxXTtcbiAgICAgIG9wdHMgPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIHByZXZPcHRpb25zKSB7XG4gICAgICAgIHZhbHVlID0gcHJldk9wdGlvbnNba2V5XTtcbiAgICAgICAgaWYgKCFoLmNhbGxiYWNrc01hcFtrZXldICYmICFoLnR3ZWVuT3B0aW9uTWFwW2tleV0gfHwga2V5ID09PSAnZHVyYXRpb24nKSB7XG4gICAgICAgICAgaWYgKG9ba2V5XSA9PSBudWxsKSB7XG4gICAgICAgICAgICBvW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKG9ba2V5XSA9PSBudWxsKSB7XG4gICAgICAgICAgICBvW2tleV0gPSB2b2lkIDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChoLnR3ZWVuT3B0aW9uTWFwW2tleV0pIHtcbiAgICAgICAgICBvcHRzW2tleV0gPSBrZXkgIT09ICdkdXJhdGlvbicgPyBvW2tleV0gOiBvW2tleV0gIT0gbnVsbCA/IG9ba2V5XSA6IHByZXZPcHRpb25zW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuaGlzdG9yeS5wdXNoKG8pO1xuICAgICAgaXQgPSB0aGlzO1xuICAgICAgb3B0cy5vblVwZGF0ZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24ocCkge1xuICAgICAgICAgIHJldHVybiBfdGhpcy5zZXRQcm9ncmVzcyhwKTtcbiAgICAgICAgfTtcbiAgICAgIH0pKHRoaXMpO1xuICAgICAgb3B0cy5vblN0YXJ0ID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vblN0YXJ0KSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKTtcbiAgICAgIG9wdHMub25Db21wbGV0ZSA9IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25Db21wbGV0ZSkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcyk7XG4gICAgICBvcHRzLm9uRmlyc3RVcGRhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGl0LnR1bmVPcHRpb25zKGl0Lmhpc3RvcnlbdGhpcy5pbmRleF0pO1xuICAgICAgfTtcbiAgICAgIG9wdHMuaXNDaGFpbmVkID0gIW8uZGVsYXk7XG4gICAgICB0aGlzLnRpbWVsaW5lLmFwcGVuZChuZXcgVHdlZW4ob3B0cykpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIE1vdGlvblBhdGgucHJvdG90eXBlLnR1bmVPcHRpb25zID0gZnVuY3Rpb24obykge1xuICAgICAgdGhpcy5leHRlbmRPcHRpb25zKG8pO1xuICAgICAgcmV0dXJuIHRoaXMucG9zdFZhcnMoKTtcbiAgICB9O1xuXG4gICAgTW90aW9uUGF0aC5wcm90b3R5cGUuYW5nVG9Db29yZHMgPSBmdW5jdGlvbihhbmdsZSkge1xuICAgICAgdmFyIHJhZEFuZ2xlLCB4LCB5O1xuICAgICAgYW5nbGUgPSBhbmdsZSAlIDM2MDtcbiAgICAgIHJhZEFuZ2xlID0gKChhbmdsZSAtIDkwKSAqIE1hdGguUEkpIC8gMTgwO1xuICAgICAgeCA9IE1hdGguY29zKHJhZEFuZ2xlKTtcbiAgICAgIHkgPSBNYXRoLnNpbihyYWRBbmdsZSk7XG4gICAgICB4ID0geCA8IDAgPyBNYXRoLm1heCh4LCAtMC43KSA6IE1hdGgubWluKHgsIC43KTtcbiAgICAgIHkgPSB5IDwgMCA/IE1hdGgubWF4KHksIC0wLjcpIDogTWF0aC5taW4oeSwgLjcpO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgeDogeCAqIDEuNDI4NTcxNDI5LFxuICAgICAgICB5OiB5ICogMS40Mjg1NzE0MjlcbiAgICAgIH07XG4gICAgfTtcblxuICAgIHJldHVybiBNb3Rpb25QYXRoO1xuXG4gIH0pKCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBNb3Rpb25QYXRoO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIChmdW5jdGlvbihyb290KSB7XG4gICAgdmFyIG9mZnNldCwgX3JlZiwgX3JlZjE7XG4gICAgaWYgKHJvb3QucGVyZm9ybWFuY2UgPT0gbnVsbCkge1xuICAgICAgcm9vdC5wZXJmb3JtYW5jZSA9IHt9O1xuICAgIH1cbiAgICBEYXRlLm5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChuZXcgRGF0ZSkuZ2V0VGltZSgpO1xuICAgIH07XG4gICAgaWYgKHJvb3QucGVyZm9ybWFuY2Uubm93ID09IG51bGwpIHtcbiAgICAgIG9mZnNldCA9ICgoX3JlZiA9IHJvb3QucGVyZm9ybWFuY2UpICE9IG51bGwgPyAoX3JlZjEgPSBfcmVmLnRpbWluZykgIT0gbnVsbCA/IF9yZWYxLm5hdmlnYXRpb25TdGFydCA6IHZvaWQgMCA6IHZvaWQgMCkgPyBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0IDogRGF0ZS5ub3coKTtcbiAgICAgIHJldHVybiByb290LnBlcmZvcm1hbmNlLm5vdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIG9mZnNldDtcbiAgICAgIH07XG4gICAgfVxuICB9KSh3aW5kb3cpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIChmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgdmFyIGNhbmNlbCwgaSwgaXNPbGRCcm93c2VyLCBsYXN0VGltZSwgdmVuZG9ycywgdnAsIHc7XG4gICAgdmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddO1xuICAgIGkgPSAwO1xuICAgIHcgPSB3aW5kb3c7XG4gICAgd2hpbGUgKGkgPCB2ZW5kb3JzLmxlbmd0aCAmJiAhdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcbiAgICAgIHZwID0gdmVuZG9yc1tpXTtcbiAgICAgIHcucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd1t2cCArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICAgIGNhbmNlbCA9IHdbdnAgKyAnQ2FuY2VsQW5pbWF0aW9uRnJhbWUnXTtcbiAgICAgIHcuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjYW5jZWwgfHwgd1t2cCArICdDYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcbiAgICAgICsraTtcbiAgICB9XG4gICAgaXNPbGRCcm93c2VyID0gIXcucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICF3LmNhbmNlbEFuaW1hdGlvbkZyYW1lO1xuICAgIGlmICgvaVAoYWR8aG9uZXxvZCkuKk9TIDYvLnRlc3Qody5uYXZpZ2F0b3IudXNlckFnZW50KSB8fCBpc09sZEJyb3dzZXIpIHtcbiAgICAgIGxhc3RUaW1lID0gMDtcbiAgICAgIHcucmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIG5leHRUaW1lLCBub3c7XG4gICAgICAgIG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpO1xuICAgICAgICB9KSwgbmV4dFRpbWUgLSBub3cpO1xuICAgICAgfTtcbiAgICAgIHcuY2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XG4gICAgfVxuICB9KSgpO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgQml0LCBoO1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgQml0ID0gKGZ1bmN0aW9uKCkge1xuICAgIEJpdC5wcm90b3R5cGUubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuXG4gICAgQml0LnByb3RvdHlwZS50eXBlID0gJ2xpbmUnO1xuXG4gICAgQml0LnByb3RvdHlwZS5yYXRpbyA9IDE7XG5cbiAgICBCaXQucHJvdG90eXBlLmRlZmF1bHRzID0ge1xuICAgICAgcmFkaXVzOiA1MCxcbiAgICAgIHJhZGl1c1g6IHZvaWQgMCxcbiAgICAgIHJhZGl1c1k6IHZvaWQgMCxcbiAgICAgIHBvaW50czogMyxcbiAgICAgIHg6IDAsXG4gICAgICB5OiAwLFxuICAgICAgYW5nbGU6IDAsXG4gICAgICAnc3Ryb2tlJzogJ2hvdHBpbmsnLFxuICAgICAgJ3N0cm9rZS13aWR0aCc6IDIsXG4gICAgICAnc3Ryb2tlLW9wYWNpdHknOiAxLFxuICAgICAgJ2ZpbGwnOiAndHJhbnNwYXJlbnQnLFxuICAgICAgJ2ZpbGwtb3BhY2l0eSc6IDEsXG4gICAgICAnc3Ryb2tlLWRhc2hhcnJheSc6ICcnLFxuICAgICAgJ3N0cm9rZS1kYXNob2Zmc2V0JzogJycsXG4gICAgICAnc3Ryb2tlLWxpbmVjYXAnOiAnJ1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBCaXQobykge1xuICAgICAgdGhpcy5vID0gbyAhPSBudWxsID8gbyA6IHt9O1xuICAgICAgdGhpcy5pbml0KCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIEJpdC5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy52YXJzKCk7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMuby5jdHggJiYgdGhpcy5vLmN0eC50YWdOYW1lID09PSAnc3ZnJykge1xuICAgICAgICB0aGlzLmN0eCA9IHRoaXMuby5jdHg7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLm8uZWwpIHtcbiAgICAgICAgaC5lcnJvcignWW91IHNob3VsZCBwYXNzIGEgcmVhbCBjb250ZXh0KGN0eCkgdG8gdGhlIGJpdCcpO1xuICAgICAgfVxuICAgICAgdGhpcy5zdGF0ZSA9IHt9O1xuICAgICAgdGhpcy5kcmF3TWFwTGVuZ3RoID0gdGhpcy5kcmF3TWFwLmxlbmd0aDtcbiAgICAgIHRoaXMuZXh0ZW5kRGVmYXVsdHMoKTtcbiAgICAgIHJldHVybiB0aGlzLmNhbGNUcmFuc2Zvcm0oKTtcbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5jYWxjVHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcm90YXRlO1xuICAgICAgcm90YXRlID0gXCJyb3RhdGUoXCIgKyB0aGlzLnByb3BzLmFuZ2xlICsgXCIsIFwiICsgdGhpcy5wcm9wcy54ICsgXCIsIFwiICsgdGhpcy5wcm9wcy55ICsgXCIpXCI7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy50cmFuc2Zvcm0gPSBcIlwiICsgcm90YXRlO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLmV4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZSwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICBpZiAodGhpcy5wcm9wcyA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMucHJvcHMgPSB7fTtcbiAgICAgIH1cbiAgICAgIF9yZWYgPSB0aGlzLmRlZmF1bHRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoa2V5IGluIF9yZWYpIHtcbiAgICAgICAgdmFsdWUgPSBfcmVmW2tleV07XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wcm9wc1trZXldID0gdGhpcy5vW2tleV0gIT0gbnVsbCA/IHRoaXMub1trZXldIDogdmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLnNldEF0dHIgPSBmdW5jdGlvbihhdHRyLCB2YWx1ZSkge1xuICAgICAgdmFyIGVsLCBrZXksIGtleXMsIGxlbiwgdmFsLCBfcmVzdWx0cztcbiAgICAgIGlmICh0eXBlb2YgYXR0ciA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGF0dHIpO1xuICAgICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgICAgZWwgPSB2YWx1ZSB8fCB0aGlzLmVsO1xuICAgICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgICAgdmFsID0gYXR0cltrZXldO1xuICAgICAgICAgIF9yZXN1bHRzLnB1c2goZWwuc2V0QXR0cmlidXRlKGtleSwgdmFsKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZWwuc2V0QXR0cmlidXRlKGF0dHIsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5zZXRQcm9wID0gZnVuY3Rpb24oYXR0ciwgdmFsdWUpIHtcbiAgICAgIHZhciBrZXksIHZhbCwgX3Jlc3VsdHM7XG4gICAgICBpZiAodHlwZW9mIGF0dHIgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICAgIGZvciAoa2V5IGluIGF0dHIpIHtcbiAgICAgICAgICB2YWwgPSBhdHRyW2tleV07XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnByb3BzW2tleV0gPSB2YWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzW2F0dHJdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmlzUmVuZGVyZWQgPSB0cnVlO1xuICAgICAgaWYgKHRoaXMuby5lbCAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuZWwgPSB0aGlzLm8uZWw7XG4gICAgICAgIHJldHVybiB0aGlzLmlzRm9yZWlnbiA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKHRoaXMubnMsIHRoaXMudHlwZSB8fCAnbGluZScpO1xuICAgICAgICAhdGhpcy5vLmlzRHJhd0xlc3MgJiYgdGhpcy5kcmF3KCk7XG4gICAgICAgIHJldHVybiB0aGlzLmN0eC5hcHBlbmRDaGlsZCh0aGlzLmVsKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5kcmF3TWFwID0gWydzdHJva2UnLCAnc3Ryb2tlLXdpZHRoJywgJ3N0cm9rZS1vcGFjaXR5JywgJ3N0cm9rZS1kYXNoYXJyYXknLCAnZmlsbCcsICdzdHJva2UtZGFzaG9mZnNldCcsICdzdHJva2UtbGluZWNhcCcsICdmaWxsLW9wYWNpdHknLCAndHJhbnNmb3JtJ107XG5cbiAgICBCaXQucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBsZW4sIG5hbWU7XG4gICAgICB0aGlzLnByb3BzLmxlbmd0aCA9IHRoaXMuZ2V0TGVuZ3RoKCk7XG4gICAgICBsZW4gPSB0aGlzLmRyYXdNYXBMZW5ndGg7XG4gICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgbmFtZSA9IHRoaXMuZHJhd01hcFtsZW5dO1xuICAgICAgICBzd2l0Y2ggKG5hbWUpIHtcbiAgICAgICAgICBjYXNlICdzdHJva2UtZGFzaGFycmF5JzpcbiAgICAgICAgICBjYXNlICdzdHJva2UtZGFzaG9mZnNldCc6XG4gICAgICAgICAgICB0aGlzLmNhc3RTdHJva2VEYXNoKG5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0QXR0cnNJZkNoYW5nZWQobmFtZSwgdGhpcy5wcm9wc1tuYW1lXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zdGF0ZS5yYWRpdXMgPSB0aGlzLnByb3BzLnJhZGl1cztcbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5jYXN0U3Ryb2tlRGFzaCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBjYXN0LCBkYXNoLCBpLCBzdHJva2UsIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgaWYgKGguaXNBcnJheSh0aGlzLnByb3BzW25hbWVdKSkge1xuICAgICAgICBzdHJva2UgPSAnJztcbiAgICAgICAgX3JlZiA9IHRoaXMucHJvcHNbbmFtZV07XG4gICAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IF9yZWYubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgICAgZGFzaCA9IF9yZWZbaV07XG4gICAgICAgICAgY2FzdCA9IGRhc2gudW5pdCA9PT0gJyUnID8gdGhpcy5jYXN0UGVyY2VudChkYXNoLnZhbHVlKSA6IGRhc2gudmFsdWU7XG4gICAgICAgICAgc3Ryb2tlICs9IFwiXCIgKyBjYXN0ICsgXCIgXCI7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9wc1tuYW1lXSA9IHN0cm9rZSA9PT0gJzAgJyA/IHN0cm9rZSA9ICcnIDogc3Ryb2tlO1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1tuYW1lXSA9IHN0cm9rZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5wcm9wc1tuYW1lXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgc3Ryb2tlID0gdGhpcy5wcm9wc1tuYW1lXS51bml0ID09PSAnJScgPyB0aGlzLmNhc3RQZXJjZW50KHRoaXMucHJvcHNbbmFtZV0udmFsdWUpIDogdGhpcy5wcm9wc1tuYW1lXS52YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcHNbbmFtZV0gPSBzdHJva2UgPT09IDAgPyBzdHJva2UgPSAnJyA6IHN0cm9rZTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5jYXN0UGVyY2VudCA9IGZ1bmN0aW9uKHBlcmNlbnQpIHtcbiAgICAgIHJldHVybiBwZXJjZW50ICogKHRoaXMucHJvcHMubGVuZ3RoIC8gMTAwKTtcbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5zZXRBdHRyc0lmQ2hhbmdlZCA9IGZ1bmN0aW9uKG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIga2V5LCBrZXlzLCBsZW4sIF9yZXN1bHRzO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMobmFtZSk7XG4gICAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgICAgdmFsdWUgPSBuYW1lW2tleV07XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnNldEF0dHJJZkNoYW5nZWQoa2V5LCB2YWx1ZSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdmFsdWUgPSB0aGlzLnByb3BzW25hbWVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnNldEF0dHJJZkNoYW5nZWQobmFtZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBCaXQucHJvdG90eXBlLnNldEF0dHJJZkNoYW5nZWQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgaWYgKHRoaXMuaXNDaGFuZ2VkKG5hbWUsIHZhbHVlKSkge1xuICAgICAgICB0aGlzLmVsLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlW25hbWVdID0gdmFsdWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIEJpdC5wcm90b3R5cGUuaXNDaGFuZ2VkID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIHZhbHVlID0gdGhpcy5wcm9wc1tuYW1lXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXRlW25hbWVdICE9PSB2YWx1ZTtcbiAgICB9O1xuXG4gICAgQml0LnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBfcmVmO1xuICAgICAgaWYgKCgoKF9yZWYgPSB0aGlzLmVsKSAhPSBudWxsID8gX3JlZi5nZXRUb3RhbExlbmd0aCA6IHZvaWQgMCkgIT0gbnVsbCkgJiYgdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ2QnKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5lbC5nZXRUb3RhbExlbmd0aCgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIDIgKiAodGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBCaXQ7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IEJpdDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgQml0c01hcCwgQ2lyY2xlLCBDcm9zcywgRXF1YWwsIExpbmUsIFBvbHlnb24sIFJlY3QsIFppZ3phZywgaDtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIENpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5cbiAgTGluZSA9IHJlcXVpcmUoJy4vbGluZScpO1xuXG4gIFppZ3phZyA9IHJlcXVpcmUoJy4vemlnemFnJyk7XG5cbiAgUmVjdCA9IHJlcXVpcmUoJy4vcmVjdCcpO1xuXG4gIFBvbHlnb24gPSByZXF1aXJlKCcuL3BvbHlnb24nKTtcblxuICBDcm9zcyA9IHJlcXVpcmUoJy4vY3Jvc3MnKTtcblxuICBFcXVhbCA9IHJlcXVpcmUoJy4vZXF1YWwnKTtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIEJpdHNNYXAgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gQml0c01hcCgpIHt9XG5cbiAgICBCaXRzTWFwLnByb3RvdHlwZS5oID0gaDtcblxuICAgIEJpdHNNYXAucHJvdG90eXBlLm1hcCA9IHtcbiAgICAgIGJpdDogQml0LFxuICAgICAgY2lyY2xlOiBDaXJjbGUsXG4gICAgICBsaW5lOiBMaW5lLFxuICAgICAgemlnemFnOiBaaWd6YWcsXG4gICAgICByZWN0OiBSZWN0LFxuICAgICAgcG9seWdvbjogUG9seWdvbixcbiAgICAgIGNyb3NzOiBDcm9zcyxcbiAgICAgIGVxdWFsOiBFcXVhbFxuICAgIH07XG5cbiAgICBCaXRzTWFwLnByb3RvdHlwZS5nZXRCaXQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXBbbmFtZV0gfHwgdGhpcy5oLmVycm9yKFwibm8gXFxcIlwiICsgbmFtZSArIFwiXFxcIiBzaGFwZSBhdmFpbGFibGUgeWV0LCBwbGVhc2UgY2hvb3NlIGZyb20gdGhpcyBsaXN0OlwiLCB0aGlzLm1hcCk7XG4gICAgfTtcblxuICAgIHJldHVybiBCaXRzTWFwO1xuXG4gIH0pKCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBuZXcgQml0c01hcDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIlxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblxuKGZ1bmN0aW9uKCkge1xuICB2YXIgQml0LCBDaXJjbGUsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBDaXJjbGUgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKENpcmNsZSwgX3N1cGVyKTtcblxuICAgIGZ1bmN0aW9uIENpcmNsZSgpIHtcbiAgICAgIHJldHVybiBDaXJjbGUuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgQ2lyY2xlLnByb3RvdHlwZS50eXBlID0gJ2VsbGlwc2UnO1xuXG4gICAgQ2lyY2xlLnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcngsIHJ5O1xuICAgICAgcnggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcnkgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgdGhpcy5zZXRBdHRyc0lmQ2hhbmdlZCh7XG4gICAgICAgIHJ4OiByeCxcbiAgICAgICAgcnk6IHJ5LFxuICAgICAgICBjeDogdGhpcy5wcm9wcy54LFxuICAgICAgICBjeTogdGhpcy5wcm9wcy55XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBDaXJjbGUuX19zdXBlcl9fLmRyYXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgQ2lyY2xlLnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByYWRpdXNYLCByYWRpdXNZO1xuICAgICAgcmFkaXVzWCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByYWRpdXNZID0gdGhpcy5wcm9wcy5yYWRpdXNZICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1kgOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJldHVybiAyICogTWF0aC5QSSAqIE1hdGguc3FydCgoTWF0aC5wb3cocmFkaXVzWCwgMikgKyBNYXRoLnBvdyhyYWRpdXNZLCAyKSkgLyAyKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIENpcmNsZTtcblxuICB9KShCaXQpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gQ2lyY2xlO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIENyb3NzLFxuICAgIF9faGFzUHJvcCA9IHt9Lmhhc093blByb3BlcnR5LFxuICAgIF9fZXh0ZW5kcyA9IGZ1bmN0aW9uKGNoaWxkLCBwYXJlbnQpIHsgZm9yICh2YXIga2V5IGluIHBhcmVudCkgeyBpZiAoX19oYXNQcm9wLmNhbGwocGFyZW50LCBrZXkpKSBjaGlsZFtrZXldID0gcGFyZW50W2tleV07IH0gZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9IGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTsgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTsgY2hpbGQuX19zdXBlcl9fID0gcGFyZW50LnByb3RvdHlwZTsgcmV0dXJuIGNoaWxkOyB9O1xuXG4gIEJpdCA9IHJlcXVpcmUoJy4vYml0Jyk7XG5cbiAgQ3Jvc3MgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKENyb3NzLCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gQ3Jvc3MoKSB7XG4gICAgICByZXR1cm4gQ3Jvc3MuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgQ3Jvc3MucHJvdG90eXBlLnR5cGUgPSAncGF0aCc7XG5cbiAgICBDcm9zcy5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGQsIGxpbmUxLCBsaW5lMiwgcmFkaXVzWCwgcmFkaXVzWSwgeDEsIHgyLCB5MSwgeTI7XG4gICAgICBDcm9zcy5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmFkaXVzWCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByYWRpdXNZID0gdGhpcy5wcm9wcy5yYWRpdXNZICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1kgOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHgxID0gdGhpcy5wcm9wcy54IC0gcmFkaXVzWDtcbiAgICAgIHgyID0gdGhpcy5wcm9wcy54ICsgcmFkaXVzWDtcbiAgICAgIGxpbmUxID0gXCJNXCIgKyB4MSArIFwiLFwiICsgdGhpcy5wcm9wcy55ICsgXCIgTFwiICsgeDIgKyBcIixcIiArIHRoaXMucHJvcHMueTtcbiAgICAgIHkxID0gdGhpcy5wcm9wcy55IC0gcmFkaXVzWTtcbiAgICAgIHkyID0gdGhpcy5wcm9wcy55ICsgcmFkaXVzWTtcbiAgICAgIGxpbmUyID0gXCJNXCIgKyB0aGlzLnByb3BzLnggKyBcIixcIiArIHkxICsgXCIgTFwiICsgdGhpcy5wcm9wcy54ICsgXCIsXCIgKyB5MjtcbiAgICAgIGQgPSBcIlwiICsgbGluZTEgKyBcIiBcIiArIGxpbmUyO1xuICAgICAgcmV0dXJuIHRoaXMuc2V0QXR0cih7XG4gICAgICAgIGQ6IGRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBDcm9zcy5wcm90b3R5cGUuZ2V0TGVuZ3RoID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmFkaXVzWCwgcmFkaXVzWTtcbiAgICAgIHJhZGl1c1ggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmFkaXVzWSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByZXR1cm4gMiAqIChyYWRpdXNYICsgcmFkaXVzWSk7XG4gICAgfTtcblxuICAgIHJldHVybiBDcm9zcztcblxuICB9KShCaXQpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gQ3Jvc3M7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIEJpdCwgRXF1YWwsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBFcXVhbCA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoRXF1YWwsIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBFcXVhbCgpIHtcbiAgICAgIHJldHVybiBFcXVhbC5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBFcXVhbC5wcm90b3R5cGUudHlwZSA9ICdwYXRoJztcblxuICAgIEVxdWFsLnByb3RvdHlwZS5yYXRpbyA9IDEuNDM7XG5cbiAgICBFcXVhbC5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGQsIGksIHJhZGl1c1gsIHJhZGl1c1ksIHgxLCB4MiwgeSwgeVN0YXJ0LCB5U3RlcCwgX2ksIF9yZWY7XG4gICAgICBFcXVhbC5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKCF0aGlzLnByb3BzLnBvaW50cykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgeDEgPSB0aGlzLnByb3BzLnggLSByYWRpdXNYO1xuICAgICAgeDIgPSB0aGlzLnByb3BzLnggKyByYWRpdXNYO1xuICAgICAgZCA9ICcnO1xuICAgICAgeVN0ZXAgPSAyICogcmFkaXVzWSAvICh0aGlzLnByb3BzLnBvaW50cyAtIDEpO1xuICAgICAgeVN0YXJ0ID0gdGhpcy5wcm9wcy55IC0gcmFkaXVzWTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX3JlZiA9IHRoaXMucHJvcHMucG9pbnRzOyAwIDw9IF9yZWYgPyBfaSA8IF9yZWYgOiBfaSA+IF9yZWY7IGkgPSAwIDw9IF9yZWYgPyArK19pIDogLS1faSkge1xuICAgICAgICB5ID0gXCJcIiArIChpICogeVN0ZXAgKyB5U3RhcnQpO1xuICAgICAgICBkICs9IFwiTVwiICsgeDEgKyBcIiwgXCIgKyB5ICsgXCIgTFwiICsgeDIgKyBcIiwgXCIgKyB5ICsgXCIgXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zZXRBdHRyKHtcbiAgICAgICAgZDogZFxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIEVxdWFsLnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAyICogKHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gRXF1YWw7XG5cbiAgfSkoQml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IEVxdWFsO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIExpbmUsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBMaW5lID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhMaW5lLCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gTGluZSgpIHtcbiAgICAgIHJldHVybiBMaW5lLl9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIExpbmUucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByYWRpdXNYO1xuICAgICAgcmFkaXVzWCA9IHRoaXMucHJvcHMucmFkaXVzWCAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNYIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICB0aGlzLnNldEF0dHJzSWZDaGFuZ2VkKHtcbiAgICAgICAgeDE6IHRoaXMucHJvcHMueCAtIHJhZGl1c1gsXG4gICAgICAgIHgyOiB0aGlzLnByb3BzLnggKyByYWRpdXNYLFxuICAgICAgICB5MTogdGhpcy5wcm9wcy55LFxuICAgICAgICB5MjogdGhpcy5wcm9wcy55XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBMaW5lLl9fc3VwZXJfXy5kcmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBMaW5lO1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBMaW5lO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIFBvbHlnb24sIGgsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIFBvbHlnb24gPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKFBvbHlnb24sIF9zdXBlcik7XG5cbiAgICBmdW5jdGlvbiBQb2x5Z29uKCkge1xuICAgICAgcmV0dXJuIFBvbHlnb24uX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgUG9seWdvbi5wcm90b3R5cGUudHlwZSA9ICdwYXRoJztcblxuICAgIFBvbHlnb24ucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuZHJhd1NoYXBlKCk7XG4gICAgICByZXR1cm4gUG9seWdvbi5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBQb2x5Z29uLnByb3RvdHlwZS5kcmF3U2hhcGUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjaGFyLCBkLCBpLCBwb2ludCwgc3RlcCwgX2ksIF9qLCBfbGVuLCBfcmVmLCBfcmVmMTtcbiAgICAgIHN0ZXAgPSAzNjAgLyB0aGlzLnByb3BzLnBvaW50cztcbiAgICAgIHRoaXMucmFkaWFsUG9pbnRzID0gW107XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9yZWYgPSB0aGlzLnByb3BzLnBvaW50czsgMCA8PSBfcmVmID8gX2kgPCBfcmVmIDogX2kgPiBfcmVmOyBpID0gMCA8PSBfcmVmID8gKytfaSA6IC0tX2kpIHtcbiAgICAgICAgdGhpcy5yYWRpYWxQb2ludHMucHVzaChoLmdldFJhZGlhbFBvaW50KHtcbiAgICAgICAgICByYWRpdXM6IHRoaXMucHJvcHMucmFkaXVzLFxuICAgICAgICAgIHJhZGl1c1g6IHRoaXMucHJvcHMucmFkaXVzWCxcbiAgICAgICAgICByYWRpdXNZOiB0aGlzLnByb3BzLnJhZGl1c1ksXG4gICAgICAgICAgYW5nbGU6IGkgKiBzdGVwLFxuICAgICAgICAgIGNlbnRlcjoge1xuICAgICAgICAgICAgeDogdGhpcy5wcm9wcy54LFxuICAgICAgICAgICAgeTogdGhpcy5wcm9wcy55XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICBkID0gJyc7XG4gICAgICBfcmVmMSA9IHRoaXMucmFkaWFsUG9pbnRzO1xuICAgICAgZm9yIChpID0gX2ogPSAwLCBfbGVuID0gX3JlZjEubGVuZ3RoOyBfaiA8IF9sZW47IGkgPSArK19qKSB7XG4gICAgICAgIHBvaW50ID0gX3JlZjFbaV07XG4gICAgICAgIGNoYXIgPSBpID09PSAwID8gJ00nIDogJ0wnO1xuICAgICAgICBkICs9IFwiXCIgKyBjaGFyICsgKHBvaW50LngudG9GaXhlZCg0KSkgKyBcIixcIiArIChwb2ludC55LnRvRml4ZWQoNCkpICsgXCIgXCI7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zZXRBdHRyKHtcbiAgICAgICAgZDogZCArPSAneidcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBQb2x5Z29uLnByb3RvdHlwZS5nZXRMZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmVsLmdldFRvdGFsTGVuZ3RoKCk7XG4gICAgfTtcblxuICAgIHJldHVybiBQb2x5Z29uO1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBQb2x5Z29uO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIFJlY3QsXG4gICAgX19oYXNQcm9wID0ge30uaGFzT3duUHJvcGVydHksXG4gICAgX19leHRlbmRzID0gZnVuY3Rpb24oY2hpbGQsIHBhcmVudCkgeyBmb3IgKHZhciBrZXkgaW4gcGFyZW50KSB7IGlmIChfX2hhc1Byb3AuY2FsbChwYXJlbnQsIGtleSkpIGNoaWxkW2tleV0gPSBwYXJlbnRba2V5XTsgfSBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH0gY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlOyBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpOyBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlOyByZXR1cm4gY2hpbGQ7IH07XG5cbiAgQml0ID0gcmVxdWlyZSgnLi9iaXQnKTtcblxuICBSZWN0ID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhSZWN0LCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gUmVjdCgpIHtcbiAgICAgIHJldHVybiBSZWN0Ll9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIFJlY3QucHJvdG90eXBlLnR5cGUgPSAncmVjdCc7XG5cbiAgICBSZWN0LnByb3RvdHlwZS5yYXRpbyA9IDEuNDM7XG5cbiAgICBSZWN0LnByb3RvdHlwZS5kcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgcmFkaXVzWCwgcmFkaXVzWTtcbiAgICAgIFJlY3QuX19zdXBlcl9fLmRyYXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJhZGl1c1ggPSB0aGlzLnByb3BzLnJhZGl1c1ggIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWCA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmFkaXVzWSA9IHRoaXMucHJvcHMucmFkaXVzWSAhPSBudWxsID8gdGhpcy5wcm9wcy5yYWRpdXNZIDogdGhpcy5wcm9wcy5yYWRpdXM7XG4gICAgICByZXR1cm4gdGhpcy5zZXRBdHRyc0lmQ2hhbmdlZCh7XG4gICAgICAgIHdpZHRoOiAyICogcmFkaXVzWCxcbiAgICAgICAgaGVpZ2h0OiAyICogcmFkaXVzWSxcbiAgICAgICAgeDogdGhpcy5wcm9wcy54IC0gcmFkaXVzWCxcbiAgICAgICAgeTogdGhpcy5wcm9wcy55IC0gcmFkaXVzWVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFJlY3QucHJvdG90eXBlLmdldExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJhZGl1c1gsIHJhZGl1c1k7XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcmV0dXJuIDIgKiByYWRpdXNYICsgMiAqIHJhZGl1c1k7XG4gICAgfTtcblxuICAgIHJldHVybiBSZWN0O1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBSZWN0O1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBCaXQsIFppZ3phZyxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBCaXQgPSByZXF1aXJlKCcuL2JpdCcpO1xuXG4gIFppZ3phZyA9IChmdW5jdGlvbihfc3VwZXIpIHtcbiAgICBfX2V4dGVuZHMoWmlnemFnLCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gWmlnemFnKCkge1xuICAgICAgcmV0dXJuIFppZ3phZy5fX3N1cGVyX18uY29uc3RydWN0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBaaWd6YWcucHJvdG90eXBlLnR5cGUgPSAncGF0aCc7XG5cbiAgICBaaWd6YWcucHJvdG90eXBlLnJhdGlvID0gMS40MztcblxuICAgIFppZ3phZy5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNoYXIsIGksIGlYLCBpWDIsIGlZLCBpWTIsIHBvaW50cywgcmFkaXVzWCwgcmFkaXVzWSwgc3RlcFgsIHN0ZXBZLCBzdHJva2VXaWR0aCwgeFN0YXJ0LCB5U3RhcnQsIF9pLCBfcmVmO1xuICAgICAgaWYgKCF0aGlzLnByb3BzLnBvaW50cykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByYWRpdXNYID0gdGhpcy5wcm9wcy5yYWRpdXNYICE9IG51bGwgPyB0aGlzLnByb3BzLnJhZGl1c1ggOiB0aGlzLnByb3BzLnJhZGl1cztcbiAgICAgIHJhZGl1c1kgPSB0aGlzLnByb3BzLnJhZGl1c1kgIT0gbnVsbCA/IHRoaXMucHJvcHMucmFkaXVzWSA6IHRoaXMucHJvcHMucmFkaXVzO1xuICAgICAgcG9pbnRzID0gJyc7XG4gICAgICBzdGVwWCA9IDIgKiByYWRpdXNYIC8gdGhpcy5wcm9wcy5wb2ludHM7XG4gICAgICBzdGVwWSA9IDIgKiByYWRpdXNZIC8gdGhpcy5wcm9wcy5wb2ludHM7XG4gICAgICBzdHJva2VXaWR0aCA9IHRoaXMucHJvcHNbJ3N0cm9rZS13aWR0aCddO1xuICAgICAgeFN0YXJ0ID0gdGhpcy5wcm9wcy54IC0gcmFkaXVzWDtcbiAgICAgIHlTdGFydCA9IHRoaXMucHJvcHMueSAtIHJhZGl1c1k7XG4gICAgICBmb3IgKGkgPSBfaSA9IF9yZWYgPSB0aGlzLnByb3BzLnBvaW50czsgX3JlZiA8PSAwID8gX2kgPCAwIDogX2kgPiAwOyBpID0gX3JlZiA8PSAwID8gKytfaSA6IC0tX2kpIHtcbiAgICAgICAgaVggPSB4U3RhcnQgKyBpICogc3RlcFggKyBzdHJva2VXaWR0aDtcbiAgICAgICAgaVkgPSB5U3RhcnQgKyBpICogc3RlcFkgKyBzdHJva2VXaWR0aDtcbiAgICAgICAgaVgyID0geFN0YXJ0ICsgKGkgLSAxKSAqIHN0ZXBYICsgc3Ryb2tlV2lkdGg7XG4gICAgICAgIGlZMiA9IHlTdGFydCArIChpIC0gMSkgKiBzdGVwWSArIHN0cm9rZVdpZHRoO1xuICAgICAgICBjaGFyID0gaSA9PT0gdGhpcy5wcm9wcy5wb2ludHMgPyAnTScgOiAnTCc7XG4gICAgICAgIHBvaW50cyArPSBcIlwiICsgY2hhciArIGlYICsgXCIsXCIgKyBpWSArIFwiIGwwLCAtXCIgKyBzdGVwWSArIFwiIGwtXCIgKyBzdGVwWCArIFwiLCAwXCI7XG4gICAgICB9XG4gICAgICB0aGlzLnNldEF0dHIoe1xuICAgICAgICBkOiBwb2ludHNcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIFppZ3phZy5fX3N1cGVyX18uZHJhdy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gWmlnemFnO1xuXG4gIH0pKEJpdCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBaaWd6YWc7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBTcHJpdGVyLCBUaW1lbGluZSwgVHdlZW4sIGg7XG5cbiAgaCA9IHJlcXVpcmUoJy4vaCcpO1xuXG4gIFR3ZWVuID0gcmVxdWlyZSgnLi90d2Vlbi90d2VlbicpO1xuXG4gIFRpbWVsaW5lID0gcmVxdWlyZSgnLi90d2Vlbi90aW1lbGluZScpO1xuXG4gIFNwcml0ZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgU3ByaXRlci5wcm90b3R5cGUuX2RlZmF1bHRzID0ge1xuICAgICAgZHVyYXRpb246IDUwMCxcbiAgICAgIGRlbGF5OiAwLFxuICAgICAgZWFzaW5nOiAnbGluZWFyLm5vbmUnLFxuICAgICAgcmVwZWF0OiAwLFxuICAgICAgeW95bzogZmFsc2UsXG4gICAgICBpc1J1bkxlc3M6IGZhbHNlLFxuICAgICAgaXNTaG93RW5kOiBmYWxzZSxcbiAgICAgIG9uU3RhcnQ6IG51bGwsXG4gICAgICBvblVwZGF0ZTogbnVsbCxcbiAgICAgIG9uQ29tcGxldGU6IG51bGxcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gU3ByaXRlcihvKSB7XG4gICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICBpZiAodGhpcy5vLmVsID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGguZXJyb3IoJ05vIFwiZWxcIiBvcHRpb24gc3BlY2lmaWVkLCBhYm9ydGluZycpO1xuICAgICAgfVxuICAgICAgdGhpcy5fdmFycygpO1xuICAgICAgdGhpcy5fZXh0ZW5kRGVmYXVsdHMoKTtcbiAgICAgIHRoaXMuX3BhcnNlRnJhbWVzKCk7XG4gICAgICBpZiAodGhpcy5fZnJhbWVzLmxlbmd0aCA8PSAyKSB7XG4gICAgICAgIGgud2FybihcIlNwcml0ZXI6IG9ubHkgXCIgKyB0aGlzLl9mcmFtZXMubGVuZ3RoICsgXCIgZnJhbWVzIGZvdW5kXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX2ZyYW1lcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIGguZXJyb3IoXCJTcHJpdGVyOiB0aGVyZSBpcyBubyBmcmFtZXMgdG8gYW5pbWF0ZSwgYWJvcnRpbmdcIik7XG4gICAgICB9XG4gICAgICB0aGlzLl9jcmVhdGVUd2VlbigpO1xuICAgICAgdGhpcztcbiAgICB9XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fdmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fcHJvcHMgPSBoLmNsb25lT2JqKHRoaXMubyk7XG4gICAgICB0aGlzLmVsID0gdGhpcy5vLmVsO1xuICAgICAgcmV0dXJuIHRoaXMuX2ZyYW1lcyA9IFtdO1xuICAgIH07XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbihvKSB7XG4gICAgICByZXR1cm4gdGhpcy5fdGltZWxpbmUuc3RhcnQoKTtcbiAgICB9O1xuXG4gICAgU3ByaXRlci5wcm90b3R5cGUuX2V4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaC5leHRlbmQodGhpcy5fcHJvcHMsIHRoaXMuX2RlZmF1bHRzKTtcbiAgICB9O1xuXG4gICAgU3ByaXRlci5wcm90b3R5cGUuX3BhcnNlRnJhbWVzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZnJhbWUsIGksIF9pLCBfbGVuLCBfcmVmO1xuICAgICAgdGhpcy5fZnJhbWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5lbC5jaGlsZHJlbiwgMCk7XG4gICAgICBfcmVmID0gdGhpcy5fZnJhbWVzO1xuICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gX3JlZi5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgZnJhbWUgPSBfcmVmW2ldO1xuICAgICAgICBmcmFtZS5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9mcmFtZVN0ZXAgPSAxIC8gdGhpcy5fZnJhbWVzLmxlbmd0aDtcbiAgICB9O1xuXG4gICAgU3ByaXRlci5wcm90b3R5cGUuX2NyZWF0ZVR3ZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl90d2VlbiA9IG5ldyBUd2Vlbih7XG4gICAgICAgIGR1cmF0aW9uOiB0aGlzLl9wcm9wcy5kdXJhdGlvbixcbiAgICAgICAgZGVsYXk6IHRoaXMuX3Byb3BzLmRlbGF5LFxuICAgICAgICB5b3lvOiB0aGlzLl9wcm9wcy55b3lvLFxuICAgICAgICByZXBlYXQ6IHRoaXMuX3Byb3BzLnJlcGVhdCxcbiAgICAgICAgZWFzaW5nOiB0aGlzLl9wcm9wcy5lYXNpbmcsXG4gICAgICAgIG9uU3RhcnQ6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfYmFzZTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgKF9iYXNlID0gX3RoaXMuX3Byb3BzKS5vblN0YXJ0ID09PSBcImZ1bmN0aW9uXCIgPyBfYmFzZS5vblN0YXJ0KCkgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uQ29tcGxldGU6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfYmFzZTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgKF9iYXNlID0gX3RoaXMuX3Byb3BzKS5vbkNvbXBsZXRlID09PSBcImZ1bmN0aW9uXCIgPyBfYmFzZS5vbkNvbXBsZXRlKCkgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uVXBkYXRlOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24ocCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzLl9zZXRQcm9ncmVzcyhwKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKVxuICAgICAgfSk7XG4gICAgICB0aGlzLl90aW1lbGluZSA9IG5ldyBUaW1lbGluZTtcbiAgICAgIHRoaXMuX3RpbWVsaW5lLmFkZCh0aGlzLl90d2Vlbik7XG4gICAgICByZXR1cm4gIXRoaXMuX3Byb3BzLmlzUnVuTGVzcyAmJiB0aGlzLl9zdGFydFR3ZWVuKCk7XG4gICAgfTtcblxuICAgIFNwcml0ZXIucHJvdG90eXBlLl9zdGFydFR3ZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gc2V0VGltZW91dCgoKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMuX3RpbWVsaW5lLnN0YXJ0KCk7XG4gICAgICAgIH07XG4gICAgICB9KSh0aGlzKSksIDEpO1xuICAgIH07XG5cbiAgICBTcHJpdGVyLnByb3RvdHlwZS5fc2V0UHJvZ3Jlc3MgPSBmdW5jdGlvbihwKSB7XG4gICAgICB2YXIgY3VycmVudE51bSwgcHJvYywgX2Jhc2UsIF9yZWYsIF9yZWYxO1xuICAgICAgcHJvYyA9IE1hdGguZmxvb3IocCAvIHRoaXMuX2ZyYW1lU3RlcCk7XG4gICAgICBpZiAodGhpcy5fcHJldkZyYW1lICE9PSB0aGlzLl9mcmFtZXNbcHJvY10pIHtcbiAgICAgICAgaWYgKChfcmVmID0gdGhpcy5fcHJldkZyYW1lKSAhPSBudWxsKSB7XG4gICAgICAgICAgX3JlZi5zdHlsZS5vcGFjaXR5ID0gMDtcbiAgICAgICAgfVxuICAgICAgICBjdXJyZW50TnVtID0gcCA9PT0gMSAmJiB0aGlzLl9wcm9wcy5pc1Nob3dFbmQgPyBwcm9jIC0gMSA6IHByb2M7XG4gICAgICAgIGlmICgoX3JlZjEgPSB0aGlzLl9mcmFtZXNbY3VycmVudE51bV0pICE9IG51bGwpIHtcbiAgICAgICAgICBfcmVmMS5zdHlsZS5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wcmV2RnJhbWUgPSB0aGlzLl9mcmFtZXNbcHJvY107XG4gICAgICB9XG4gICAgICByZXR1cm4gdHlwZW9mIChfYmFzZSA9IHRoaXMuX3Byb3BzKS5vblVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gX2Jhc2Uub25VcGRhdGUocCkgOiB2b2lkIDA7XG4gICAgfTtcblxuICAgIHJldHVybiBTcHJpdGVyO1xuXG4gIH0pKCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBTcHJpdGVyO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBTdGFnZ2VyLCBTdGFnZ2VyV3JhcHBlciwgVGltZWxpbmUsIGg7XG5cbiAgaCA9IHJlcXVpcmUoJy4vaCcpO1xuXG4gIFRpbWVsaW5lID0gcmVxdWlyZSgnLi90d2Vlbi90aW1lbGluZScpO1xuXG4gIFN0YWdnZXIgPSAoZnVuY3Rpb24oKSB7XG4gICAgZnVuY3Rpb24gU3RhZ2dlcihvcHRpb25zLCBNb2R1bGUpIHtcbiAgICAgIHRoaXMuaW5pdChvcHRpb25zLCBNb2R1bGUpO1xuICAgIH1cblxuICAgIFN0YWdnZXIucHJvdG90eXBlLl9nZXRPcHRpb25CeU1vZCA9IGZ1bmN0aW9uKG5hbWUsIGksIHN0b3JlKSB7XG4gICAgICB2YXIgcHJvcHMsIHZhbHVlO1xuICAgICAgcHJvcHMgPSBzdG9yZVtuYW1lXTtcbiAgICAgIGlmIChwcm9wcyArICcnID09PSAnW29iamVjdCBOb2RlTGlzdF0nKSB7XG4gICAgICAgIHByb3BzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwocHJvcHMsIDApO1xuICAgICAgfVxuICAgICAgaWYgKHByb3BzICsgJycgPT09ICdbb2JqZWN0IEhUTUxDb2xsZWN0aW9uXScpIHtcbiAgICAgICAgcHJvcHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChwcm9wcywgMCk7XG4gICAgICB9XG4gICAgICB2YWx1ZSA9IGguaXNBcnJheShwcm9wcykgPyBwcm9wc1tpICUgcHJvcHMubGVuZ3RoXSA6IHByb3BzO1xuICAgICAgcmV0dXJuIGgucGFyc2VJZlN0YWdnZXIodmFsdWUsIGkpO1xuICAgIH07XG5cbiAgICBTdGFnZ2VyLnByb3RvdHlwZS5fZ2V0T3B0aW9uQnlJbmRleCA9IGZ1bmN0aW9uKGksIHN0b3JlKSB7XG4gICAgICB2YXIga2V5LCBvcHRpb25zLCB2YWx1ZTtcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIHN0b3JlKSB7XG4gICAgICAgIHZhbHVlID0gc3RvcmVba2V5XTtcbiAgICAgICAgb3B0aW9uc1trZXldID0gdGhpcy5fZ2V0T3B0aW9uQnlNb2Qoa2V5LCBpLCBzdG9yZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9O1xuXG4gICAgU3RhZ2dlci5wcm90b3R5cGUuX2dldENoaWxkUXVhbnRpdHkgPSBmdW5jdGlvbihuYW1lLCBzdG9yZSkge1xuICAgICAgdmFyIGFyeSwgcXVhbnRpZmllcjtcbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICB9XG4gICAgICBxdWFudGlmaWVyID0gc3RvcmVbbmFtZV07XG4gICAgICBpZiAoaC5pc0FycmF5KHF1YW50aWZpZXIpKSB7XG4gICAgICAgIHJldHVybiBxdWFudGlmaWVyLmxlbmd0aDtcbiAgICAgIH0gZWxzZSBpZiAocXVhbnRpZmllciArICcnID09PSAnW29iamVjdCBOb2RlTGlzdF0nKSB7XG4gICAgICAgIHJldHVybiBxdWFudGlmaWVyLmxlbmd0aDtcbiAgICAgIH0gZWxzZSBpZiAocXVhbnRpZmllciArICcnID09PSAnW29iamVjdCBIVE1MQ29sbGVjdGlvbl0nKSB7XG4gICAgICAgIGFyeSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHF1YW50aWZpZXIsIDApO1xuICAgICAgICByZXR1cm4gYXJ5Lmxlbmd0aDtcbiAgICAgIH0gZWxzZSBpZiAocXVhbnRpZmllciBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcXVhbnRpZmllciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFN0YWdnZXIucHJvdG90eXBlLl9jcmVhdGVUaW1lbGluZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIGlmIChvcHRpb25zID09IG51bGwpIHtcbiAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMudGltZWxpbmUgPSBuZXcgVGltZWxpbmUoe1xuICAgICAgICBvblN0YXJ0OiBvcHRpb25zLm9uU3RhZ2dlclN0YXJ0LFxuICAgICAgICBvblVwZGF0ZTogb3B0aW9ucy5vblN0YWdnZXJVcGRhdGUsXG4gICAgICAgIG9uQ29tcGxldGU6IG9wdGlvbnMub25TdGFnZ2VyQ29tcGxldGUsXG4gICAgICAgIG9uUmV2ZXJzZUNvbXBsZXRlOiBvcHRpb25zLm9uU3RhZ2dlclJldmVyc2VDb21wbGV0ZSxcbiAgICAgICAgZGVsYXk6IG9wdGlvbnMubW9kdWxlRGVsYXlcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBTdGFnZ2VyLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24ob3B0aW9ucywgTW9kdWxlKSB7XG4gICAgICB2YXIgY291bnQsIGksIG1vZHVsZSwgb3B0aW9uLCBfaTtcbiAgICAgIGNvdW50ID0gdGhpcy5fZ2V0Q2hpbGRRdWFudGl0eShvcHRpb25zLnF1YW50aWZpZXIgfHwgJ2VsJywgb3B0aW9ucyk7XG4gICAgICB0aGlzLl9jcmVhdGVUaW1lbGluZShvcHRpb25zKTtcbiAgICAgIHRoaXMuY2hpbGRNb2R1bGVzID0gW107XG4gICAgICBmb3IgKGkgPSBfaSA9IDA7IDAgPD0gY291bnQgPyBfaSA8IGNvdW50IDogX2kgPiBjb3VudDsgaSA9IDAgPD0gY291bnQgPyArK19pIDogLS1faSkge1xuICAgICAgICBvcHRpb24gPSB0aGlzLl9nZXRPcHRpb25CeUluZGV4KGksIG9wdGlvbnMpO1xuICAgICAgICBvcHRpb24uaXNSdW5MZXNzID0gdHJ1ZTtcbiAgICAgICAgbW9kdWxlID0gbmV3IE1vZHVsZShvcHRpb24pO1xuICAgICAgICB0aGlzLmNoaWxkTW9kdWxlcy5wdXNoKG1vZHVsZSk7XG4gICAgICAgIHRoaXMudGltZWxpbmUuYWRkKG1vZHVsZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgU3RhZ2dlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50aW1lbGluZS5zdGFydCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gU3RhZ2dlcjtcblxuICB9KSgpO1xuXG4gIFN0YWdnZXJXcmFwcGVyID0gKGZ1bmN0aW9uKCkge1xuICAgIGZ1bmN0aW9uIFN0YWdnZXJXcmFwcGVyKE1vZHVsZSkge1xuICAgICAgdmFyIE07XG4gICAgICBNID0gTW9kdWxlO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTdGFnZ2VyKG9wdGlvbnMsIE0pO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gU3RhZ2dlcldyYXBwZXI7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFN0YWdnZXJXcmFwcGVyO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBTd2lybCwgVHJhbnNpdCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBUcmFuc2l0ID0gcmVxdWlyZSgnLi90cmFuc2l0Jyk7XG5cbiAgU3dpcmwgPSAoZnVuY3Rpb24oX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKFN3aXJsLCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gU3dpcmwoKSB7XG4gICAgICByZXR1cm4gU3dpcmwuX19zdXBlcl9fLmNvbnN0cnVjdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgU3dpcmwucHJvdG90eXBlLnNraXBQcm9wc0RlbHRhID0ge1xuICAgICAgeDogMSxcbiAgICAgIHk6IDFcbiAgICB9O1xuXG4gICAgU3dpcmwucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIFN3aXJsLl9fc3VwZXJfXy52YXJzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gIXRoaXMuby5pc1N3aXJsTGVzcyAmJiB0aGlzLmdlbmVyYXRlU3dpcmwoKTtcbiAgICB9O1xuXG4gICAgU3dpcmwucHJvdG90eXBlLmV4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYW5nbGUsIHgsIHksIF9iYXNlO1xuICAgICAgU3dpcmwuX19zdXBlcl9fLmV4dGVuZERlZmF1bHRzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB4ID0gdGhpcy5nZXRQb3NWYWx1ZSgneCcpO1xuICAgICAgeSA9IHRoaXMuZ2V0UG9zVmFsdWUoJ3knKTtcbiAgICAgIGFuZ2xlID0gOTAgKyBNYXRoLmF0YW4oKHkuZGVsdGEgLyB4LmRlbHRhKSB8fCAwKSAqICgxODAgLyBNYXRoLlBJKTtcbiAgICAgIGlmICh4LmRlbHRhIDwgMCkge1xuICAgICAgICBhbmdsZSArPSAxODA7XG4gICAgICB9XG4gICAgICB0aGlzLnBvc2l0aW9uRGVsdGEgPSB7XG4gICAgICAgIHJhZGl1czogTWF0aC5zcXJ0KHguZGVsdGEgKiB4LmRlbHRhICsgeS5kZWx0YSAqIHkuZGVsdGEpLFxuICAgICAgICBhbmdsZTogYW5nbGUsXG4gICAgICAgIHg6IHgsXG4gICAgICAgIHk6IHlcbiAgICAgIH07XG4gICAgICBpZiAoKF9iYXNlID0gdGhpcy5vKS5yYWRpdXNTY2FsZSA9PSBudWxsKSB7XG4gICAgICAgIF9iYXNlLnJhZGl1c1NjYWxlID0gMTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvcHMuYW5nbGVTaGlmdCA9IHRoaXMuaC5wYXJzZUlmUmFuZCh0aGlzLm8uYW5nbGVTaGlmdCB8fCAwKTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnJhZGl1c1NjYWxlID0gdGhpcy5oLnBhcnNlSWZSYW5kKHRoaXMuby5yYWRpdXNTY2FsZSk7XG4gICAgfTtcblxuICAgIFN3aXJsLnByb3RvdHlwZS5nZXRQb3NWYWx1ZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBvcHRWYWwsIHZhbDtcbiAgICAgIG9wdFZhbCA9IHRoaXMub1tuYW1lXTtcbiAgICAgIGlmIChvcHRWYWwgJiYgdHlwZW9mIG9wdFZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdmFsID0gdGhpcy5oLnBhcnNlRGVsdGEobmFtZSwgb3B0VmFsKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGFydDogdmFsLnN0YXJ0LnZhbHVlLFxuICAgICAgICAgIGVuZDogdmFsLmVuZC52YWx1ZSxcbiAgICAgICAgICBkZWx0YTogdmFsLmRlbHRhLFxuICAgICAgICAgIHVuaXRzOiB2YWwuZW5kLnVuaXRcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IHBhcnNlRmxvYXQob3B0VmFsIHx8IHRoaXMuZGVmYXVsdHNbbmFtZV0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXJ0OiB2YWwsXG4gICAgICAgICAgZW5kOiB2YWwsXG4gICAgICAgICAgZGVsdGE6IDAsXG4gICAgICAgICAgdW5pdHM6ICdweCdcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgU3dpcmwucHJvdG90eXBlLnNldFByb2dyZXNzID0gZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcbiAgICAgIHZhciBhbmdsZSwgcG9pbnQsIHgsIHk7XG4gICAgICBhbmdsZSA9IHRoaXMucG9zaXRpb25EZWx0YS5hbmdsZTtcbiAgICAgIGlmICh0aGlzLm8uaXNTd2lybCkge1xuICAgICAgICBhbmdsZSArPSB0aGlzLmdldFN3aXJsKHByb2dyZXNzKTtcbiAgICAgIH1cbiAgICAgIHBvaW50ID0gdGhpcy5oLmdldFJhZGlhbFBvaW50KHtcbiAgICAgICAgYW5nbGU6IGFuZ2xlLFxuICAgICAgICByYWRpdXM6IHRoaXMucG9zaXRpb25EZWx0YS5yYWRpdXMgKiBwcm9ncmVzcyAqIHRoaXMucHJvcHMucmFkaXVzU2NhbGUsXG4gICAgICAgIGNlbnRlcjoge1xuICAgICAgICAgIHg6IHRoaXMucG9zaXRpb25EZWx0YS54LnN0YXJ0LFxuICAgICAgICAgIHk6IHRoaXMucG9zaXRpb25EZWx0YS55LnN0YXJ0XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgeCA9IHBvaW50LngudG9GaXhlZCg0KTtcbiAgICAgIHkgPSBwb2ludC55LnRvRml4ZWQoNCk7XG4gICAgICB0aGlzLnByb3BzLnggPSB0aGlzLm8uY3R4ID8geCA6IHggKyB0aGlzLnBvc2l0aW9uRGVsdGEueC51bml0cztcbiAgICAgIHRoaXMucHJvcHMueSA9IHRoaXMuby5jdHggPyB5IDogeSArIHRoaXMucG9zaXRpb25EZWx0YS55LnVuaXRzO1xuICAgICAgcmV0dXJuIFN3aXJsLl9fc3VwZXJfXy5zZXRQcm9ncmVzcy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBTd2lybC5wcm90b3R5cGUuZ2VuZXJhdGVTd2lybCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIF9iYXNlLCBfYmFzZTE7XG4gICAgICB0aGlzLnByb3BzLnNpZ25SYW5kID0gTWF0aC5yb3VuZCh0aGlzLmgucmFuZCgwLCAxKSkgPyAtMSA6IDE7XG4gICAgICBpZiAoKF9iYXNlID0gdGhpcy5vKS5zd2lybFNpemUgPT0gbnVsbCkge1xuICAgICAgICBfYmFzZS5zd2lybFNpemUgPSAxMDtcbiAgICAgIH1cbiAgICAgIGlmICgoX2Jhc2UxID0gdGhpcy5vKS5zd2lybEZyZXF1ZW5jeSA9PSBudWxsKSB7XG4gICAgICAgIF9iYXNlMS5zd2lybEZyZXF1ZW5jeSA9IDM7XG4gICAgICB9XG4gICAgICB0aGlzLnByb3BzLnN3aXJsU2l6ZSA9IHRoaXMuaC5wYXJzZUlmUmFuZCh0aGlzLm8uc3dpcmxTaXplKTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnN3aXJsRnJlcXVlbmN5ID0gdGhpcy5oLnBhcnNlSWZSYW5kKHRoaXMuby5zd2lybEZyZXF1ZW5jeSk7XG4gICAgfTtcblxuICAgIFN3aXJsLnByb3RvdHlwZS5nZXRTd2lybCA9IGZ1bmN0aW9uKHByb2dyZXNzKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy5zaWduUmFuZCAqIHRoaXMucHJvcHMuc3dpcmxTaXplICogTWF0aC5zaW4odGhpcy5wcm9wcy5zd2lybEZyZXF1ZW5jeSAqIHByb2dyZXNzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFN3aXJsO1xuXG4gIH0pKFRyYW5zaXQpO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gU3dpcmw7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJcbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgdmFyIFRpbWVsaW5lLCBUcmFuc2l0LCBUd2VlbiwgYml0c01hcCwgaCxcbiAgICBfX2hhc1Byb3AgPSB7fS5oYXNPd25Qcm9wZXJ0eSxcbiAgICBfX2V4dGVuZHMgPSBmdW5jdGlvbihjaGlsZCwgcGFyZW50KSB7IGZvciAodmFyIGtleSBpbiBwYXJlbnQpIHsgaWYgKF9faGFzUHJvcC5jYWxsKHBhcmVudCwga2V5KSkgY2hpbGRba2V5XSA9IHBhcmVudFtrZXldOyB9IGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfSBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7IGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7IGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7IHJldHVybiBjaGlsZDsgfTtcblxuICBoID0gcmVxdWlyZSgnLi9oJyk7XG5cbiAgYml0c01hcCA9IHJlcXVpcmUoJy4vc2hhcGVzL2JpdHNNYXAnKTtcblxuICBUd2VlbiA9IHJlcXVpcmUoJy4vdHdlZW4vdHdlZW4nKTtcblxuICBUaW1lbGluZSA9IHJlcXVpcmUoJy4vdHdlZW4vdGltZWxpbmUnKTtcblxuICBUcmFuc2l0ID0gKGZ1bmN0aW9uKF9zdXBlcikge1xuICAgIF9fZXh0ZW5kcyhUcmFuc2l0LCBfc3VwZXIpO1xuXG4gICAgZnVuY3Rpb24gVHJhbnNpdCgpIHtcbiAgICAgIHJldHVybiBUcmFuc2l0Ll9fc3VwZXJfXy5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnByb2dyZXNzID0gMDtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmRlZmF1bHRzID0ge1xuICAgICAgc3Ryb2tlV2lkdGg6IDIsXG4gICAgICBzdHJva2VPcGFjaXR5OiAxLFxuICAgICAgc3Ryb2tlRGFzaGFycmF5OiAwLFxuICAgICAgc3Ryb2tlRGFzaG9mZnNldDogMCxcbiAgICAgIHN0cm9rZTogJ3RyYW5zcGFyZW50JyxcbiAgICAgIGZpbGw6ICdkZWVwcGluaycsXG4gICAgICBmaWxsT3BhY2l0eTogJ3RyYW5zcGFyZW50JyxcbiAgICAgIHN0cm9rZUxpbmVjYXA6ICcnLFxuICAgICAgcG9pbnRzOiAzLFxuICAgICAgeDogMCxcbiAgICAgIHk6IDAsXG4gICAgICBzaGlmdFg6IDAsXG4gICAgICBzaGlmdFk6IDAsXG4gICAgICBvcGFjaXR5OiAxLFxuICAgICAgcmFkaXVzOiB7XG4gICAgICAgIDA6IDUwXG4gICAgICB9LFxuICAgICAgcmFkaXVzWDogdm9pZCAwLFxuICAgICAgcmFkaXVzWTogdm9pZCAwLFxuICAgICAgYW5nbGU6IDAsXG4gICAgICBzaXplOiBudWxsLFxuICAgICAgc2l6ZUdhcDogMCxcbiAgICAgIG9uU3RhcnQ6IG51bGwsXG4gICAgICBvbkNvbXBsZXRlOiBudWxsLFxuICAgICAgb25VcGRhdGU6IG51bGwsXG4gICAgICBkdXJhdGlvbjogNTAwLFxuICAgICAgZGVsYXk6IDAsXG4gICAgICByZXBlYXQ6IDAsXG4gICAgICB5b3lvOiBmYWxzZSxcbiAgICAgIGVhc2luZzogJ0xpbmVhci5Ob25lJ1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbztcbiAgICAgIGlmICh0aGlzLmggPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmggPSBoO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubGFzdFNldCA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMubGFzdFNldCA9IHt9O1xuICAgICAgfVxuICAgICAgdGhpcy5pbmRleCA9IHRoaXMuby5pbmRleCB8fCAwO1xuICAgICAgaWYgKHRoaXMucnVuQ291bnQgPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnJ1bkNvdW50ID0gMDtcbiAgICAgIH1cbiAgICAgIHRoaXMuZXh0ZW5kRGVmYXVsdHMoKTtcbiAgICAgIG8gPSB0aGlzLmguY2xvbmVPYmoodGhpcy5vKTtcbiAgICAgIHRoaXMuaC5leHRlbmQobywgdGhpcy5kZWZhdWx0cyk7XG4gICAgICB0aGlzLmhpc3RvcnkgPSBbb107XG4gICAgICB0aGlzLmlzRm9yZWlnbiA9ICEhdGhpcy5vLmN0eDtcbiAgICAgIHRoaXMuaXNGb3JlaWduQml0ID0gISF0aGlzLm8uYml0O1xuICAgICAgcmV0dXJuIHRoaXMudGltZWxpbmVzID0gW107XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCF0aGlzLmlzUmVuZGVyZWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzRm9yZWlnbiAmJiAhdGhpcy5pc0ZvcmVpZ25CaXQpIHtcbiAgICAgICAgICB0aGlzLmN0eCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyh0aGlzLm5zLCAnc3ZnJyk7XG4gICAgICAgICAgdGhpcy5jdHguc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgIHRoaXMuY3R4LnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgICAgICAgIHRoaXMuY3R4LnN0eWxlLmhlaWdodCA9ICcxMDAlJztcbiAgICAgICAgICB0aGlzLmNyZWF0ZUJpdCgpO1xuICAgICAgICAgIHRoaXMuY2FsY1NpemUoKTtcbiAgICAgICAgICB0aGlzLmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgdGhpcy5lbC5hcHBlbmRDaGlsZCh0aGlzLmN0eCk7XG4gICAgICAgICAgKHRoaXMuby5wYXJlbnQgfHwgZG9jdW1lbnQuYm9keSkuYXBwZW5kQ2hpbGQodGhpcy5lbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5jdHggPSB0aGlzLm8uY3R4O1xuICAgICAgICAgIHRoaXMuY3JlYXRlQml0KCk7XG4gICAgICAgICAgdGhpcy5jYWxjU2l6ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaXNSZW5kZXJlZCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLnNldEVsU3R5bGVzKCk7XG4gICAgICB0aGlzLnNldFByb2dyZXNzKDAsIHRydWUpO1xuICAgICAgdGhpcy5jcmVhdGVUd2VlbigpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnNldEVsU3R5bGVzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbWFyZ2luU2l6ZSwgc2l6ZSwgX3JlZjtcbiAgICAgIGlmICghdGhpcy5pc0ZvcmVpZ24pIHtcbiAgICAgICAgc2l6ZSA9IFwiXCIgKyB0aGlzLnByb3BzLnNpemUgKyBcInB4XCI7XG4gICAgICAgIG1hcmdpblNpemUgPSBcIlwiICsgKC10aGlzLnByb3BzLnNpemUgLyAyKSArIFwicHhcIjtcbiAgICAgICAgdGhpcy5lbC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUudG9wID0gdGhpcy5wcm9wcy55O1xuICAgICAgICB0aGlzLmVsLnN0eWxlLmxlZnQgPSB0aGlzLnByb3BzLng7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUud2lkdGggPSBzaXplO1xuICAgICAgICB0aGlzLmVsLnN0eWxlLmhlaWdodCA9IHNpemU7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbJ21hcmdpbi1sZWZ0J10gPSBtYXJnaW5TaXplO1xuICAgICAgICB0aGlzLmVsLnN0eWxlWydtYXJnaW4tdG9wJ10gPSBtYXJnaW5TaXplO1xuICAgICAgICB0aGlzLmVsLnN0eWxlWydtYXJnaW5MZWZ0J10gPSBtYXJnaW5TaXplO1xuICAgICAgICB0aGlzLmVsLnN0eWxlWydtYXJnaW5Ub3AnXSA9IG1hcmdpblNpemU7XG4gICAgICB9XG4gICAgICBpZiAoKF9yZWYgPSB0aGlzLmVsKSAhPSBudWxsKSB7XG4gICAgICAgIF9yZWYuc3R5bGUub3BhY2l0eSA9IHRoaXMucHJvcHMub3BhY2l0eTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm8uaXNTaG93SW5pdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zaG93KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5oaWRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLmlzU2hvd24gfHwgKHRoaXMuZWwgPT0gbnVsbCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIHJldHVybiB0aGlzLmlzU2hvd24gPSB0cnVlO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5oaWRlID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoKHRoaXMuaXNTaG93biA9PT0gZmFsc2UpIHx8ICh0aGlzLmVsID09IG51bGwpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgIHJldHVybiB0aGlzLmlzU2hvd24gPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5iaXQuc2V0UHJvcCh7XG4gICAgICAgIHg6IHRoaXMub3JpZ2luLngsXG4gICAgICAgIHk6IHRoaXMub3JpZ2luLnksXG4gICAgICAgIHN0cm9rZTogdGhpcy5wcm9wcy5zdHJva2UsXG4gICAgICAgICdzdHJva2Utd2lkdGgnOiB0aGlzLnByb3BzLnN0cm9rZVdpZHRoLFxuICAgICAgICAnc3Ryb2tlLW9wYWNpdHknOiB0aGlzLnByb3BzLnN0cm9rZU9wYWNpdHksXG4gICAgICAgICdzdHJva2UtZGFzaGFycmF5JzogdGhpcy5wcm9wcy5zdHJva2VEYXNoYXJyYXksXG4gICAgICAgICdzdHJva2UtZGFzaG9mZnNldCc6IHRoaXMucHJvcHMuc3Ryb2tlRGFzaG9mZnNldCxcbiAgICAgICAgJ3N0cm9rZS1saW5lY2FwJzogdGhpcy5wcm9wcy5zdHJva2VMaW5lY2FwLFxuICAgICAgICBmaWxsOiB0aGlzLnByb3BzLmZpbGwsXG4gICAgICAgICdmaWxsLW9wYWNpdHknOiB0aGlzLnByb3BzLmZpbGxPcGFjaXR5LFxuICAgICAgICByYWRpdXM6IHRoaXMucHJvcHMucmFkaXVzLFxuICAgICAgICByYWRpdXNYOiB0aGlzLnByb3BzLnJhZGl1c1gsXG4gICAgICAgIHJhZGl1c1k6IHRoaXMucHJvcHMucmFkaXVzWSxcbiAgICAgICAgcG9pbnRzOiB0aGlzLnByb3BzLnBvaW50cyxcbiAgICAgICAgdHJhbnNmb3JtOiB0aGlzLmNhbGNUcmFuc2Zvcm0oKVxuICAgICAgfSk7XG4gICAgICB0aGlzLmJpdC5kcmF3KCk7XG4gICAgICByZXR1cm4gdGhpcy5kcmF3RWwoKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZHJhd0VsID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5lbCA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5pc1Byb3BDaGFuZ2VkKCdvcGFjaXR5JykgJiYgKHRoaXMuZWwuc3R5bGUub3BhY2l0eSA9IHRoaXMucHJvcHMub3BhY2l0eSk7XG4gICAgICBpZiAoIXRoaXMuaXNGb3JlaWduKSB7XG4gICAgICAgIHRoaXMuaXNQcm9wQ2hhbmdlZCgneCcpICYmICh0aGlzLmVsLnN0eWxlLmxlZnQgPSB0aGlzLnByb3BzLngpO1xuICAgICAgICB0aGlzLmlzUHJvcENoYW5nZWQoJ3knKSAmJiAodGhpcy5lbC5zdHlsZS50b3AgPSB0aGlzLnByb3BzLnkpO1xuICAgICAgICBpZiAodGhpcy5pc05lZWRzVHJhbnNmb3JtKCkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5oLnNldFByZWZpeGVkU3R5bGUodGhpcy5lbCwgJ3RyYW5zZm9ybScsIHRoaXMuZmlsbFRyYW5zZm9ybSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5maWxsVHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gXCJ0cmFuc2xhdGUoXCIgKyB0aGlzLnByb3BzLnNoaWZ0WCArIFwiLCBcIiArIHRoaXMucHJvcHMuc2hpZnRZICsgXCIpXCI7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmlzTmVlZHNUcmFuc2Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBpc1gsIGlzWTtcbiAgICAgIGlzWCA9IHRoaXMuaXNQcm9wQ2hhbmdlZCgnc2hpZnRYJyk7XG4gICAgICBpc1kgPSB0aGlzLmlzUHJvcENoYW5nZWQoJ3NoaWZ0WScpO1xuICAgICAgcmV0dXJuIGlzWCB8fCBpc1k7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmlzUHJvcENoYW5nZWQgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgX2Jhc2U7XG4gICAgICBpZiAoKF9iYXNlID0gdGhpcy5sYXN0U2V0KVtuYW1lXSA9PSBudWxsKSB7XG4gICAgICAgIF9iYXNlW25hbWVdID0ge307XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5sYXN0U2V0W25hbWVdLnZhbHVlICE9PSB0aGlzLnByb3BzW25hbWVdKSB7XG4gICAgICAgIHRoaXMubGFzdFNldFtuYW1lXS52YWx1ZSA9IHRoaXMucHJvcHNbbmFtZV07XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jYWxjVHJhbnNmb3JtID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5wcm9wcy50cmFuc2Zvcm0gPSBcInJvdGF0ZShcIiArIHRoaXMucHJvcHMuYW5nbGUgKyBcIixcIiArIHRoaXMub3JpZ2luLnggKyBcIixcIiArIHRoaXMub3JpZ2luLnkgKyBcIilcIjtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuY2FsY1NpemUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBkU3Ryb2tlLCByYWRpdXMsIHN0cm9rZSwgX2Jhc2U7XG4gICAgICBpZiAodGhpcy5vLnNpemUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmFkaXVzID0gdGhpcy5jYWxjTWF4UmFkaXVzKCk7XG4gICAgICBkU3Ryb2tlID0gdGhpcy5kZWx0YXNbJ3N0cm9rZVdpZHRoJ107XG4gICAgICBzdHJva2UgPSBkU3Ryb2tlICE9IG51bGwgPyBNYXRoLm1heChNYXRoLmFicyhkU3Ryb2tlLnN0YXJ0KSwgTWF0aC5hYnMoZFN0cm9rZS5lbmQpKSA6IHRoaXMucHJvcHMuc3Ryb2tlV2lkdGg7XG4gICAgICB0aGlzLnByb3BzLnNpemUgPSAyICogcmFkaXVzICsgMiAqIHN0cm9rZTtcbiAgICAgIHN3aXRjaCAodHlwZW9mIChfYmFzZSA9IHRoaXMucHJvcHMuZWFzaW5nKS50b0xvd2VyQ2FzZSA9PT0gXCJmdW5jdGlvblwiID8gX2Jhc2UudG9Mb3dlckNhc2UoKSA6IHZvaWQgMCkge1xuICAgICAgICBjYXNlICdlbGFzdGljLm91dCc6XG4gICAgICAgIGNhc2UgJ2VsYXN0aWMuaW5vdXQnOlxuICAgICAgICAgIHRoaXMucHJvcHMuc2l6ZSAqPSAxLjI1O1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdiYWNrLm91dCc6XG4gICAgICAgIGNhc2UgJ2JhY2suaW5vdXQnOlxuICAgICAgICAgIHRoaXMucHJvcHMuc2l6ZSAqPSAxLjE7XG4gICAgICB9XG4gICAgICB0aGlzLnByb3BzLnNpemUgKj0gdGhpcy5iaXQucmF0aW87XG4gICAgICB0aGlzLnByb3BzLnNpemUgKz0gMiAqIHRoaXMucHJvcHMuc2l6ZUdhcDtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLmNlbnRlciA9IHRoaXMucHJvcHMuc2l6ZSAvIDI7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNhbGNNYXhSYWRpdXMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmU2l6ZSwgc2VsZlNpemVYLCBzZWxmU2l6ZVk7XG4gICAgICBzZWxmU2l6ZSA9IHRoaXMuZ2V0UmFkaXVzU2l6ZSh7XG4gICAgICAgIGtleTogJ3JhZGl1cydcbiAgICAgIH0pO1xuICAgICAgc2VsZlNpemVYID0gdGhpcy5nZXRSYWRpdXNTaXplKHtcbiAgICAgICAga2V5OiAncmFkaXVzWCcsXG4gICAgICAgIGZhbGxiYWNrOiBzZWxmU2l6ZVxuICAgICAgfSk7XG4gICAgICBzZWxmU2l6ZVkgPSB0aGlzLmdldFJhZGl1c1NpemUoe1xuICAgICAgICBrZXk6ICdyYWRpdXNZJyxcbiAgICAgICAgZmFsbGJhY2s6IHNlbGZTaXplXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBNYXRoLm1heChzZWxmU2l6ZVgsIHNlbGZTaXplWSk7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmdldFJhZGl1c1NpemUgPSBmdW5jdGlvbihvKSB7XG4gICAgICBpZiAodGhpcy5kZWx0YXNbby5rZXldICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KE1hdGguYWJzKHRoaXMuZGVsdGFzW28ua2V5XS5lbmQpLCBNYXRoLmFicyh0aGlzLmRlbHRhc1tvLmtleV0uc3RhcnQpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9wc1tvLmtleV0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCh0aGlzLnByb3BzW28ua2V5XSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gby5mYWxsYmFjayB8fCAwO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jcmVhdGVCaXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBiaXRDbGFzcztcbiAgICAgIGJpdENsYXNzID0gYml0c01hcC5nZXRCaXQodGhpcy5vLnR5cGUgfHwgdGhpcy50eXBlKTtcbiAgICAgIHRoaXMuYml0ID0gbmV3IGJpdENsYXNzKHtcbiAgICAgICAgY3R4OiB0aGlzLmN0eCxcbiAgICAgICAgZWw6IHRoaXMuby5iaXQsXG4gICAgICAgIGlzRHJhd0xlc3M6IHRydWVcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuaXNGb3JlaWduIHx8IHRoaXMuaXNGb3JlaWduQml0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVsID0gdGhpcy5iaXQuZWw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnNldFByb2dyZXNzID0gZnVuY3Rpb24ocHJvZ3Jlc3MsIGlzU2hvdykge1xuICAgICAgaWYgKCFpc1Nob3cpIHtcbiAgICAgICAgdGhpcy5zaG93KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5vblVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdGhpcy5vblVwZGF0ZShwcm9ncmVzcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMucHJvZ3Jlc3MgPSBwcm9ncmVzcyA8IDAgfHwgIXByb2dyZXNzID8gMCA6IHByb2dyZXNzID4gMSA/IDEgOiBwcm9ncmVzcztcbiAgICAgIHRoaXMuY2FsY0N1cnJlbnRQcm9wcyhwcm9ncmVzcyk7XG4gICAgICB0aGlzLmNhbGNPcmlnaW4oKTtcbiAgICAgIHRoaXMuZHJhdyhwcm9ncmVzcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuY2FsY0N1cnJlbnRQcm9wcyA9IGZ1bmN0aW9uKHByb2dyZXNzKSB7XG4gICAgICB2YXIgYSwgYiwgZGFzaCwgZywgaSwgaXRlbSwga2V5LCBrZXlzLCBsZW4sIHIsIHN0cm9rZSwgdW5pdHMsIHZhbHVlLCBfcmVzdWx0cztcbiAgICAgIGtleXMgPSBPYmplY3Qua2V5cyh0aGlzLmRlbHRhcyk7XG4gICAgICBsZW4gPSBrZXlzLmxlbmd0aDtcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICB3aGlsZSAobGVuLS0pIHtcbiAgICAgICAga2V5ID0ga2V5c1tsZW5dO1xuICAgICAgICB2YWx1ZSA9IHRoaXMuZGVsdGFzW2tleV07XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wcm9wc1trZXldID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBfaSwgX2xlbiwgX3JlZjtcbiAgICAgICAgICBzd2l0Y2ggKHZhbHVlLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2FycmF5JzpcbiAgICAgICAgICAgICAgc3Ryb2tlID0gW107XG4gICAgICAgICAgICAgIF9yZWYgPSB2YWx1ZS5kZWx0YTtcbiAgICAgICAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gX3JlZi5sZW5ndGg7IF9pIDwgX2xlbjsgaSA9ICsrX2kpIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gX3JlZltpXTtcbiAgICAgICAgICAgICAgICBkYXNoID0gdmFsdWUuc3RhcnRbaV0udmFsdWUgKyBpdGVtLnZhbHVlICogdGhpcy5wcm9ncmVzcztcbiAgICAgICAgICAgICAgICBzdHJva2UucHVzaCh7XG4gICAgICAgICAgICAgICAgICB2YWx1ZTogZGFzaCxcbiAgICAgICAgICAgICAgICAgIHVuaXQ6IGl0ZW0udW5pdFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBzdHJva2U7XG4gICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICByZXR1cm4gdmFsdWUuc3RhcnQgKyB2YWx1ZS5kZWx0YSAqIHByb2dyZXNzO1xuICAgICAgICAgICAgY2FzZSAndW5pdCc6XG4gICAgICAgICAgICAgIHVuaXRzID0gdmFsdWUuZW5kLnVuaXQ7XG4gICAgICAgICAgICAgIHJldHVybiBcIlwiICsgKHZhbHVlLnN0YXJ0LnZhbHVlICsgdmFsdWUuZGVsdGEgKiBwcm9ncmVzcykgKyB1bml0cztcbiAgICAgICAgICAgIGNhc2UgJ2NvbG9yJzpcbiAgICAgICAgICAgICAgciA9IHBhcnNlSW50KHZhbHVlLnN0YXJ0LnIgKyB2YWx1ZS5kZWx0YS5yICogcHJvZ3Jlc3MsIDEwKTtcbiAgICAgICAgICAgICAgZyA9IHBhcnNlSW50KHZhbHVlLnN0YXJ0LmcgKyB2YWx1ZS5kZWx0YS5nICogcHJvZ3Jlc3MsIDEwKTtcbiAgICAgICAgICAgICAgYiA9IHBhcnNlSW50KHZhbHVlLnN0YXJ0LmIgKyB2YWx1ZS5kZWx0YS5iICogcHJvZ3Jlc3MsIDEwKTtcbiAgICAgICAgICAgICAgYSA9IHBhcnNlSW50KHZhbHVlLnN0YXJ0LmEgKyB2YWx1ZS5kZWx0YS5hICogcHJvZ3Jlc3MsIDEwKTtcbiAgICAgICAgICAgICAgcmV0dXJuIFwicmdiYShcIiArIHIgKyBcIixcIiArIGcgKyBcIixcIiArIGIgKyBcIixcIiArIGEgKyBcIilcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLmNhbGwodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jYWxjT3JpZ2luID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5vcmlnaW4gPSB0aGlzLm8uY3R4ID8ge1xuICAgICAgICB4OiBwYXJzZUZsb2F0KHRoaXMucHJvcHMueCksXG4gICAgICAgIHk6IHBhcnNlRmxvYXQodGhpcy5wcm9wcy55KVxuICAgICAgfSA6IHtcbiAgICAgICAgeDogdGhpcy5wcm9wcy5jZW50ZXIsXG4gICAgICAgIHk6IHRoaXMucHJvcHMuY2VudGVyXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5leHRlbmREZWZhdWx0cyA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBhcnJheSwgZGVmYXVsdHNWYWx1ZSwgZnJvbU9iamVjdCwgaSwga2V5LCBrZXlzLCBsZW4sIG9wdGlvbnNWYWx1ZSwgcHJvcGVydHksIHVuaXQsIHZhbHVlLCBfaSwgX2xlbiwgX3JlZjtcbiAgICAgIGlmICh0aGlzLnByb3BzID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5wcm9wcyA9IHt9O1xuICAgICAgfVxuICAgICAgZnJvbU9iamVjdCA9IG8gfHwgdGhpcy5kZWZhdWx0cztcbiAgICAgIChvID09IG51bGwpICYmICh0aGlzLmRlbHRhcyA9IHt9KTtcbiAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhmcm9tT2JqZWN0KTtcbiAgICAgIGxlbiA9IGtleXMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbbGVuXTtcbiAgICAgICAgZGVmYXVsdHNWYWx1ZSA9IGZyb21PYmplY3Rba2V5XTtcbiAgICAgICAgaWYgKChfcmVmID0gdGhpcy5za2lwUHJvcHMpICE9IG51bGwgPyBfcmVmW2tleV0gOiB2b2lkIDApIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobykge1xuICAgICAgICAgIHRoaXMub1trZXldID0gZGVmYXVsdHNWYWx1ZTtcbiAgICAgICAgICBvcHRpb25zVmFsdWUgPSBkZWZhdWx0c1ZhbHVlO1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmRlbHRhc1trZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9wdGlvbnNWYWx1ZSA9IHRoaXMub1trZXldICE9IG51bGwgPyB0aGlzLm9ba2V5XSA6IGRlZmF1bHRzVmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmlzRGVsdGEob3B0aW9uc1ZhbHVlKSkge1xuICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc1ZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnNWYWx1ZS5tYXRjaCgvc3RhZ2dlci8pKSB7XG4gICAgICAgICAgICAgIG9wdGlvbnNWYWx1ZSA9IHRoaXMuaC5wYXJzZVN0YWdnZXIob3B0aW9uc1ZhbHVlLCB0aGlzLmluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zVmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9uc1ZhbHVlLm1hdGNoKC9yYW5kLykpIHtcbiAgICAgICAgICAgICAgb3B0aW9uc1ZhbHVlID0gdGhpcy5oLnBhcnNlUmFuZChvcHRpb25zVmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnByb3BzW2tleV0gPSBvcHRpb25zVmFsdWU7XG4gICAgICAgICAgaWYgKGtleSA9PT0gJ3JhZGl1cycpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm8ucmFkaXVzWCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJvcHMucmFkaXVzWCA9IG9wdGlvbnNWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLm8ucmFkaXVzWSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIHRoaXMucHJvcHMucmFkaXVzWSA9IG9wdGlvbnNWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRoaXMuaC5wb3NQcm9wc01hcFtrZXldKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzW2tleV0gPSB0aGlzLmgucGFyc2VVbml0KHRoaXMucHJvcHNba2V5XSkuc3RyaW5nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5oLnN0cm9rZURhc2hQcm9wc01hcFtrZXldKSB7XG4gICAgICAgICAgICBwcm9wZXJ0eSA9IHRoaXMucHJvcHNba2V5XTtcbiAgICAgICAgICAgIHZhbHVlID0gW107XG4gICAgICAgICAgICBzd2l0Y2ggKHR5cGVvZiBwcm9wZXJ0eSkge1xuICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgIHZhbHVlLnB1c2godGhpcy5oLnBhcnNlVW5pdChwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgIGFycmF5ID0gdGhpcy5wcm9wc1trZXldLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gX2kgPSAwLCBfbGVuID0gYXJyYXkubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgICAgICAgICAgICB1bml0ID0gYXJyYXlbaV07XG4gICAgICAgICAgICAgICAgICB2YWx1ZS5wdXNoKHRoaXMuaC5wYXJzZVVuaXQodW5pdCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucHJvcHNba2V5XSA9IHZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlzU2tpcERlbHRhIHx8IHRoaXMuZ2V0RGVsdGEoa2V5LCBvcHRpb25zVmFsdWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMub25VcGRhdGUgPSB0aGlzLnByb3BzLm9uVXBkYXRlO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5pc0RlbHRhID0gZnVuY3Rpb24ob3B0aW9uc1ZhbHVlKSB7XG4gICAgICB2YXIgaXNPYmplY3Q7XG4gICAgICBpc09iamVjdCA9IChvcHRpb25zVmFsdWUgIT0gbnVsbCkgJiYgKHR5cGVvZiBvcHRpb25zVmFsdWUgPT09ICdvYmplY3QnKTtcbiAgICAgIGlzT2JqZWN0ID0gaXNPYmplY3QgJiYgIW9wdGlvbnNWYWx1ZS51bml0O1xuICAgICAgcmV0dXJuICEoIWlzT2JqZWN0IHx8IHRoaXMuaC5pc0FycmF5KG9wdGlvbnNWYWx1ZSkgfHwgaC5pc0RPTShvcHRpb25zVmFsdWUpKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUuZ2V0RGVsdGEgPSBmdW5jdGlvbihrZXksIG9wdGlvbnNWYWx1ZSkge1xuICAgICAgdmFyIGRlbHRhLCBfcmVmO1xuICAgICAgaWYgKChrZXkgPT09ICd4JyB8fCBrZXkgPT09ICd5JykgJiYgIXRoaXMuby5jdHgpIHtcbiAgICAgICAgdGhpcy5oLndhcm4oJ0NvbnNpZGVyIHRvIGFuaW1hdGUgc2hpZnRYL3NoaWZ0WSBwcm9wZXJ0aWVzIGluc3RlYWQgb2YgeC95LCBhcyBpdCB3b3VsZCBiZSBtdWNoIG1vcmUgcGVyZm9ybWFudCcsIG9wdGlvbnNWYWx1ZSk7XG4gICAgICB9XG4gICAgICBpZiAoKF9yZWYgPSB0aGlzLnNraXBQcm9wc0RlbHRhKSAhPSBudWxsID8gX3JlZltrZXldIDogdm9pZCAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGRlbHRhID0gdGhpcy5oLnBhcnNlRGVsdGEoa2V5LCBvcHRpb25zVmFsdWUsIHRoaXMuZGVmYXVsdHNba2V5XSk7XG4gICAgICBpZiAoZGVsdGEudHlwZSAhPSBudWxsKSB7XG4gICAgICAgIHRoaXMuZGVsdGFzW2tleV0gPSBkZWx0YTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnByb3BzW2tleV0gPSBkZWx0YS5zdGFydDtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUubWVyZ2VUaGVuT3B0aW9ucyA9IGZ1bmN0aW9uKHN0YXJ0LCBlbmQpIHtcbiAgICAgIHZhciBlbmRWYWx1ZSwgaSwgaXNGdW5jdGlvbiwga2V5LCBrZXlzLCBvLCBzdGFydEtleSwgc3RhcnRLZXlzLCB2YWx1ZTtcbiAgICAgIG8gPSB7fTtcbiAgICAgIGZvciAoa2V5IGluIHN0YXJ0KSB7XG4gICAgICAgIHZhbHVlID0gc3RhcnRba2V5XTtcbiAgICAgICAgaWYgKCF0aGlzLmgudHdlZW5PcHRpb25NYXBba2V5XSAmJiAhdGhpcy5oLmNhbGxiYWNrc01hcFtrZXldIHx8IGtleSA9PT0gJ2R1cmF0aW9uJykge1xuICAgICAgICAgIG9ba2V5XSA9IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ba2V5XSA9IGtleSA9PT0gJ2Vhc2luZycgPyAnJyA6IHZvaWQgMDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKGVuZCk7XG4gICAgICBpID0ga2V5cy5sZW5ndGg7XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgIGVuZFZhbHVlID0gZW5kW2tleV07XG4gICAgICAgIGlzRnVuY3Rpb24gPSB0eXBlb2YgZW5kVmFsdWUgPT09ICdmdW5jdGlvbic7XG4gICAgICAgIGlmICh0aGlzLmgudHdlZW5PcHRpb25NYXBba2V5XSB8fCB0eXBlb2YgZW5kVmFsdWUgPT09ICdvYmplY3QnIHx8IGlzRnVuY3Rpb24pIHtcbiAgICAgICAgICBvW2tleV0gPSBlbmRWYWx1ZSAhPSBudWxsID8gZW5kVmFsdWUgOiBzdGFydFtrZXldO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHN0YXJ0S2V5ID0gc3RhcnRba2V5XTtcbiAgICAgICAgaWYgKHN0YXJ0S2V5ID09IG51bGwpIHtcbiAgICAgICAgICBzdGFydEtleSA9IHRoaXMuZGVmYXVsdHNba2V5XTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKGtleSA9PT0gJ3JhZGl1c1gnIHx8IGtleSA9PT0gJ3JhZGl1c1knKSAmJiAoc3RhcnRLZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICBzdGFydEtleSA9IHN0YXJ0LnJhZGl1cztcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHN0YXJ0S2V5ID09PSAnb2JqZWN0JyAmJiAoc3RhcnRLZXkgIT0gbnVsbCkpIHtcbiAgICAgICAgICBzdGFydEtleXMgPSBPYmplY3Qua2V5cyhzdGFydEtleSk7XG4gICAgICAgICAgc3RhcnRLZXkgPSBzdGFydEtleVtzdGFydEtleXNbMF1dO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmRWYWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgb1trZXldID0ge307XG4gICAgICAgICAgb1trZXldW3N0YXJ0S2V5XSA9IGVuZFZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbztcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBpLCBpdCwga2V5cywgbGVuLCBtZXJnZWQsIG9wdHM7XG4gICAgICBpZiAoKG8gPT0gbnVsbCkgfHwgIU9iamVjdC5rZXlzKG8pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIG1lcmdlZCA9IHRoaXMubWVyZ2VUaGVuT3B0aW9ucyh0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5Lmxlbmd0aCAtIDFdLCBvKTtcbiAgICAgIHRoaXMuaGlzdG9yeS5wdXNoKG1lcmdlZCk7XG4gICAgICBrZXlzID0gT2JqZWN0LmtleXModGhpcy5oLnR3ZWVuT3B0aW9uTWFwKTtcbiAgICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICAgIG9wdHMgPSB7fTtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgb3B0c1trZXlzW2ldXSA9IG1lcmdlZFtrZXlzW2ldXTtcbiAgICAgIH1cbiAgICAgIGl0ID0gdGhpcztcbiAgICAgIGxlbiA9IGl0Lmhpc3RvcnkubGVuZ3RoO1xuICAgICAgKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgIHJldHVybiAoZnVuY3Rpb24obGVuKSB7XG4gICAgICAgICAgb3B0cy5vblVwZGF0ZSA9IGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5zZXRQcm9ncmVzcyhwKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIG9wdHMub25TdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgICByZXR1cm4gKF9yZWYgPSBfdGhpcy5wcm9wcy5vblN0YXJ0KSAhPSBudWxsID8gX3JlZi5hcHBseShfdGhpcykgOiB2b2lkIDA7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBvcHRzLm9uQ29tcGxldGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25Db21wbGV0ZSkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgICAgb3B0cy5vbkZpcnN0VXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gaXQudHVuZU9wdGlvbnMoaXQuaGlzdG9yeVt0aGlzLmluZGV4XSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICBvcHRzLmlzQ2hhaW5lZCA9ICFvLmRlbGF5O1xuICAgICAgICAgIHJldHVybiBfdGhpcy50aW1lbGluZS5hcHBlbmQobmV3IFR3ZWVuKG9wdHMpKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSh0aGlzKShsZW4pO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnR1bmVPcHRpb25zID0gZnVuY3Rpb24obykge1xuICAgICAgdGhpcy5leHRlbmREZWZhdWx0cyhvKTtcbiAgICAgIHRoaXMuY2FsY1NpemUoKTtcbiAgICAgIHJldHVybiB0aGlzLnNldEVsU3R5bGVzKCk7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmNyZWF0ZVR3ZWVuID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaXQ7XG4gICAgICBpdCA9IHRoaXM7XG4gICAgICB0aGlzLmNyZWF0ZVRpbWVsaW5lKCk7XG4gICAgICB0aGlzLnRpbWVsaW5lID0gbmV3IFRpbWVsaW5lKHtcbiAgICAgICAgb25Db21wbGV0ZTogKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIF9yZWY7XG4gICAgICAgICAgICAhX3RoaXMuby5pc1Nob3dFbmQgJiYgX3RoaXMuaGlkZSgpO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25Db21wbGV0ZSkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpXG4gICAgICB9KTtcbiAgICAgIHRoaXMudGltZWxpbmUuYWRkKHRoaXMudHdlZW4pO1xuICAgICAgcmV0dXJuICF0aGlzLm8uaXNSdW5MZXNzICYmIHRoaXMuc3RhcnRUd2VlbigpO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS5jcmVhdGVUaW1lbGluZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMudHdlZW4gPSBuZXcgVHdlZW4oe1xuICAgICAgICBkdXJhdGlvbjogdGhpcy5wcm9wcy5kdXJhdGlvbixcbiAgICAgICAgZGVsYXk6IHRoaXMucHJvcHMuZGVsYXksXG4gICAgICAgIHJlcGVhdDogdGhpcy5wcm9wcy5yZXBlYXQsXG4gICAgICAgIHlveW86IHRoaXMucHJvcHMueW95byxcbiAgICAgICAgZWFzaW5nOiB0aGlzLnByb3BzLmVhc2luZyxcbiAgICAgICAgb25VcGRhdGU6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbihwKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMuc2V0UHJvZ3Jlc3MocCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uU3RhcnQ6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgICAgX3RoaXMuc2hvdygpO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25TdGFydCkgIT0gbnVsbCA/IF9yZWYuYXBwbHkoX3RoaXMpIDogdm9pZCAwO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpLFxuICAgICAgICBvbkZpcnN0VXBkYXRlQmFja3dhcmQ6IChmdW5jdGlvbihfdGhpcykge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5oaXN0b3J5Lmxlbmd0aCA+IDEgJiYgX3RoaXMudHVuZU9wdGlvbnMoX3RoaXMuaGlzdG9yeVswXSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSkodGhpcyksXG4gICAgICAgIG9uUmV2ZXJzZUNvbXBsZXRlOiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX3JlZjtcbiAgICAgICAgICAgICFfdGhpcy5vLmlzU2hvd0luaXQgJiYgX3RoaXMuaGlkZSgpO1xuICAgICAgICAgICAgcmV0dXJuIChfcmVmID0gX3RoaXMucHJvcHMub25SZXZlcnNlQ29tcGxldGUpICE9IG51bGwgPyBfcmVmLmFwcGx5KF90aGlzKSA6IHZvaWQgMDtcbiAgICAgICAgICB9O1xuICAgICAgICB9KSh0aGlzKVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBrZXksIGtleXMsIGxlbjtcbiAgICAgIHRoaXMucnVuQ291bnQrKztcbiAgICAgIGlmIChvICYmIE9iamVjdC5rZXlzKG8pLmxlbmd0aCkge1xuICAgICAgICBpZiAodGhpcy5oaXN0b3J5Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMobyk7XG4gICAgICAgICAgbGVuID0ga2V5cy5sZW5ndGg7XG4gICAgICAgICAgd2hpbGUgKGxlbi0tKSB7XG4gICAgICAgICAgICBrZXkgPSBrZXlzW2xlbl07XG4gICAgICAgICAgICBpZiAoaC5jYWxsYmFja3NNYXBba2V5XSB8fCBoLnR3ZWVuT3B0aW9uTWFwW2tleV0pIHtcbiAgICAgICAgICAgICAgaC53YXJuKFwidGhlIHByb3BlcnR5IFxcXCJcIiArIGtleSArIFwiXFxcIiBwcm9wZXJ0eSBjYW4gbm90IGJlIG92ZXJyaWRkZW4gb24gcnVuIHdpdGggXFxcInRoZW5cXFwiIGNoYWluIHlldFwiKTtcbiAgICAgICAgICAgICAgZGVsZXRlIG9ba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1IaXN0b3J5KG8pO1xuICAgICAgICB0aGlzLnR1bmVOZXdPcHRpb24obyk7XG4gICAgICAgIG8gPSB0aGlzLmguY2xvbmVPYmoodGhpcy5vKTtcbiAgICAgICAgdGhpcy5oLmV4dGVuZChvLCB0aGlzLmRlZmF1bHRzKTtcbiAgICAgICAgdGhpcy5oaXN0b3J5WzBdID0gbztcbiAgICAgICAgIXRoaXMuby5pc0RyYXdMZXNzICYmIHRoaXMuc2V0UHJvZ3Jlc3MoMCwgdHJ1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnR1bmVOZXdPcHRpb24odGhpcy5oaXN0b3J5WzBdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0VHdlZW4oKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUudHJhbnNmb3JtSGlzdG9yeSA9IGZ1bmN0aW9uKG8pIHtcbiAgICAgIHZhciBoaXN0b3J5TGVuLCBpLCBqLCBrZXksIGtleXMsIGxlbiwgb3B0aW9uUmVjb3JkLCB2YWx1ZSwgdmFsdWUyLCB2YWx1ZUtleXMsIHZhbHVlS2V5czIsIF9yZXN1bHRzO1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKG8pO1xuICAgICAgaSA9IC0xO1xuICAgICAgbGVuID0ga2V5cy5sZW5ndGg7XG4gICAgICBoaXN0b3J5TGVuID0gdGhpcy5oaXN0b3J5Lmxlbmd0aDtcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAgIGogPSAwO1xuICAgICAgICBfcmVzdWx0cy5wdXNoKChmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgX3Jlc3VsdHMxO1xuICAgICAgICAgIF9yZXN1bHRzMSA9IFtdO1xuICAgICAgICAgIHdoaWxlICgrK2ogPCBoaXN0b3J5TGVuKSB7XG4gICAgICAgICAgICBvcHRpb25SZWNvcmQgPSB0aGlzLmhpc3Rvcnlbal1ba2V5XTtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uUmVjb3JkID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICB2YWx1ZUtleXMgPSBPYmplY3Qua2V5cyhvcHRpb25SZWNvcmQpO1xuICAgICAgICAgICAgICB2YWx1ZSA9IG9wdGlvblJlY29yZFt2YWx1ZUtleXNbMF1dO1xuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5oaXN0b3J5W2pdW2tleV1bdmFsdWVLZXlzWzBdXTtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgdmFsdWVLZXlzMiA9IE9iamVjdC5rZXlzKG9ba2V5XSk7XG4gICAgICAgICAgICAgICAgdmFsdWUyID0gb1trZXldW3ZhbHVlS2V5czJbMF1dO1xuICAgICAgICAgICAgICAgIHRoaXMuaGlzdG9yeVtqXVtrZXldW3ZhbHVlMl0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhpc3Rvcnlbal1ba2V5XVtvW2tleV1dID0gdmFsdWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBfcmVzdWx0czEucHVzaCh0aGlzLmhpc3Rvcnlbal1ba2V5XSA9IG9ba2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBfcmVzdWx0czE7XG4gICAgICAgIH0pLmNhbGwodGhpcykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUcmFuc2l0LnByb3RvdHlwZS50dW5lTmV3T3B0aW9uID0gZnVuY3Rpb24obywgaXNGb3JlaWduKSB7XG4gICAgICBpZiAoKG8gIT0gbnVsbCkgJiYgKG8udHlwZSAhPSBudWxsKSAmJiBvLnR5cGUgIT09ICh0aGlzLm8udHlwZSB8fCB0aGlzLnR5cGUpKSB7XG4gICAgICAgIHRoaXMuaC53YXJuKCdTb3JyeSwgdHlwZSBjYW4gbm90IGJlIGNoYW5nZWQgb24gcnVuJyk7XG4gICAgICAgIGRlbGV0ZSBvLnR5cGU7XG4gICAgICB9XG4gICAgICBpZiAoKG8gIT0gbnVsbCkgJiYgT2JqZWN0LmtleXMobykubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuZXh0ZW5kRGVmYXVsdHMobyk7XG4gICAgICAgIHRoaXMucmVzZXRUaW1lbGluZSgpO1xuICAgICAgICAhaXNGb3JlaWduICYmIHRoaXMudGltZWxpbmUucmVjYWxjRHVyYXRpb24oKTtcbiAgICAgICAgdGhpcy5jYWxjU2l6ZSgpO1xuICAgICAgICByZXR1cm4gIWlzRm9yZWlnbiAmJiB0aGlzLnNldEVsU3R5bGVzKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLnN0YXJ0VHdlZW4gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBzZXRUaW1lb3V0KCgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBfcmVmO1xuICAgICAgICAgIHJldHVybiAoX3JlZiA9IF90aGlzLnRpbWVsaW5lKSAhPSBudWxsID8gX3JlZi5zdGFydCgpIDogdm9pZCAwO1xuICAgICAgICB9O1xuICAgICAgfSkodGhpcykpLCAxKTtcbiAgICB9O1xuXG4gICAgVHJhbnNpdC5wcm90b3R5cGUucmVzZXRUaW1lbGluZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGksIGtleSwgdGltZWxpbmVPcHRpb25zLCBfaSwgX2xlbiwgX3JlZjtcbiAgICAgIHRpbWVsaW5lT3B0aW9ucyA9IHt9O1xuICAgICAgX3JlZiA9IE9iamVjdC5rZXlzKHRoaXMuaC50d2Vlbk9wdGlvbk1hcCk7XG4gICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICBrZXkgPSBfcmVmW2ldO1xuICAgICAgICB0aW1lbGluZU9wdGlvbnNba2V5XSA9IHRoaXMucHJvcHNba2V5XTtcbiAgICAgIH1cbiAgICAgIHRpbWVsaW5lT3B0aW9ucy5vblN0YXJ0ID0gdGhpcy5wcm9wcy5vblN0YXJ0O1xuICAgICAgdGltZWxpbmVPcHRpb25zLm9uQ29tcGxldGUgPSB0aGlzLnByb3BzLm9uQ29tcGxldGU7XG4gICAgICByZXR1cm4gdGhpcy50d2Vlbi5zZXRQcm9wKHRpbWVsaW5lT3B0aW9ucyk7XG4gICAgfTtcblxuICAgIFRyYW5zaXQucHJvdG90eXBlLmdldEJpdExlbmd0aCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wcm9wcy5iaXRMZW5ndGggPSB0aGlzLmJpdC5nZXRMZW5ndGgoKTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLmJpdExlbmd0aDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFRyYW5zaXQ7XG5cbiAgfSkoYml0c01hcC5tYXAuYml0KTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFRyYW5zaXQ7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBUaW1lbGluZSwgaCwgdCxcbiAgICBfX3NsaWNlID0gW10uc2xpY2U7XG5cbiAgaCA9IHJlcXVpcmUoJy4uL2gnKTtcblxuICB0ID0gcmVxdWlyZSgnLi90d2VlbmVyJyk7XG5cbiAgVGltZWxpbmUgPSAoZnVuY3Rpb24oKSB7XG4gICAgVGltZWxpbmUucHJvdG90eXBlLnN0YXRlID0gJ3N0b3AnO1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLmRlZmF1bHRzID0ge1xuICAgICAgcmVwZWF0OiAwLFxuICAgICAgZGVsYXk6IDBcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gVGltZWxpbmUobykge1xuICAgICAgdGhpcy5vID0gbyAhPSBudWxsID8gbyA6IHt9O1xuICAgICAgdGhpcy52YXJzKCk7XG4gICAgICB0aGlzLl9leHRlbmREZWZhdWx0cygpO1xuICAgICAgdGhpcztcbiAgICB9XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUudmFycyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy50aW1lbGluZXMgPSBbXTtcbiAgICAgIHRoaXMucHJvcHMgPSB7XG4gICAgICAgIHRpbWU6IDAsXG4gICAgICAgIHJlcGVhdFRpbWU6IDAsXG4gICAgICAgIHNoaWZ0ZWRSZXBlYXRUaW1lOiAwXG4gICAgICB9O1xuICAgICAgdGhpcy5sb29wID0gaC5iaW5kKHRoaXMubG9vcCwgdGhpcyk7XG4gICAgICByZXR1cm4gdGhpcy5vblVwZGF0ZSA9IHRoaXMuby5vblVwZGF0ZTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3M7XG4gICAgICBhcmdzID0gMSA8PSBhcmd1bWVudHMubGVuZ3RoID8gX19zbGljZS5jYWxsKGFyZ3VtZW50cywgMCkgOiBbXTtcbiAgICAgIHRoaXMucHVzaFRpbWVsaW5lQXJyYXkoYXJncyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnB1c2hUaW1lbGluZUFycmF5ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICAgIHZhciBpLCB0bSwgX2ksIF9sZW4sIF9yZXN1bHRzO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IGFycmF5Lmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICB0bSA9IGFycmF5W2ldO1xuICAgICAgICBpZiAoaC5pc0FycmF5KHRtKSkge1xuICAgICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wdXNoVGltZWxpbmVBcnJheSh0bSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy5wdXNoVGltZWxpbmUodG0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuX2V4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZSwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICBfcmVmID0gdGhpcy5kZWZhdWx0cztcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICBmb3IgKGtleSBpbiBfcmVmKSB7XG4gICAgICAgIHZhbHVlID0gX3JlZltrZXldO1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMucHJvcHNba2V5XSA9IHRoaXMub1trZXldICE9IG51bGwgPyB0aGlzLm9ba2V5XSA6IHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBfcmVzdWx0cztcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnNldFByb3AgPSBmdW5jdGlvbihwcm9wcykge1xuICAgICAgdmFyIGtleSwgdmFsdWU7XG4gICAgICBmb3IgKGtleSBpbiBwcm9wcykge1xuICAgICAgICB2YWx1ZSA9IHByb3BzW2tleV07XG4gICAgICAgIHRoaXMucHJvcHNba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucmVjYWxjRHVyYXRpb24oKTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnB1c2hUaW1lbGluZSA9IGZ1bmN0aW9uKHRpbWVsaW5lLCBzaGlmdCkge1xuICAgICAgaWYgKHRpbWVsaW5lLnRpbWVsaW5lIGluc3RhbmNlb2YgVGltZWxpbmUpIHtcbiAgICAgICAgdGltZWxpbmUgPSB0aW1lbGluZS50aW1lbGluZTtcbiAgICAgIH1cbiAgICAgIChzaGlmdCAhPSBudWxsKSAmJiB0aW1lbGluZS5zZXRQcm9wKHtcbiAgICAgICAgJ3NoaWZ0VGltZSc6IHNoaWZ0XG4gICAgICB9KTtcbiAgICAgIHRoaXMudGltZWxpbmVzLnB1c2godGltZWxpbmUpO1xuICAgICAgcmV0dXJuIHRoaXMuX3JlY2FsY1RpbWVsaW5lRHVyYXRpb24odGltZWxpbmUpO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24odGltZWxpbmUpIHtcbiAgICAgIHZhciBpbmRleDtcbiAgICAgIGluZGV4ID0gdGhpcy50aW1lbGluZXMuaW5kZXhPZih0aW1lbGluZSk7XG4gICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRpbWVsaW5lcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSwgdGltZWxpbmUsIHRtLCBfaSwgX2xlbjtcbiAgICAgIHRpbWVsaW5lID0gMSA8PSBhcmd1bWVudHMubGVuZ3RoID8gX19zbGljZS5jYWxsKGFyZ3VtZW50cywgMCkgOiBbXTtcbiAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IHRpbWVsaW5lLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICB0bSA9IHRpbWVsaW5lW2ldO1xuICAgICAgICBpZiAoaC5pc0FycmF5KHRtKSkge1xuICAgICAgICAgIHRoaXMuX2FwcGVuZFRpbWVsaW5lQXJyYXkodG0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYXBwZW5kVGltZWxpbmUodG0sIHRoaXMudGltZWxpbmVzLmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuX2FwcGVuZFRpbWVsaW5lQXJyYXkgPSBmdW5jdGlvbih0aW1lbGluZUFycmF5KSB7XG4gICAgICB2YXIgaSwgbGVuLCB0aW1lLCBfcmVzdWx0cztcbiAgICAgIGkgPSB0aW1lbGluZUFycmF5Lmxlbmd0aDtcbiAgICAgIHRpbWUgPSB0aGlzLnByb3BzLnJlcGVhdFRpbWUgLSB0aGlzLnByb3BzLmRlbGF5O1xuICAgICAgbGVuID0gdGhpcy50aW1lbGluZXMubGVuZ3RoO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLmFwcGVuZFRpbWVsaW5lKHRpbWVsaW5lQXJyYXlbaV0sIGxlbiwgdGltZSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuYXBwZW5kVGltZWxpbmUgPSBmdW5jdGlvbih0aW1lbGluZSwgaW5kZXgsIHRpbWUpIHtcbiAgICAgIHZhciBzaGlmdDtcbiAgICAgIHNoaWZ0ID0gKHRpbWUgIT0gbnVsbCA/IHRpbWUgOiB0aGlzLnByb3BzLnRpbWUpO1xuICAgICAgc2hpZnQgKz0gdGltZWxpbmUucHJvcHMuc2hpZnRUaW1lIHx8IDA7XG4gICAgICB0aW1lbGluZS5pbmRleCA9IGluZGV4O1xuICAgICAgcmV0dXJuIHRoaXMucHVzaFRpbWVsaW5lKHRpbWVsaW5lLCBzaGlmdCk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5yZWNhbGNEdXJhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxlbiwgX3Jlc3VsdHM7XG4gICAgICBsZW4gPSB0aGlzLnRpbWVsaW5lcy5sZW5ndGg7XG4gICAgICB0aGlzLnByb3BzLnRpbWUgPSAwO1xuICAgICAgdGhpcy5wcm9wcy5yZXBlYXRUaW1lID0gMDtcbiAgICAgIHRoaXMucHJvcHMuc2hpZnRlZFJlcGVhdFRpbWUgPSAwO1xuICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgIHdoaWxlIChsZW4tLSkge1xuICAgICAgICBfcmVzdWx0cy5wdXNoKHRoaXMuX3JlY2FsY1RpbWVsaW5lRHVyYXRpb24odGhpcy50aW1lbGluZXNbbGVuXSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuX3JlY2FsY1RpbWVsaW5lRHVyYXRpb24gPSBmdW5jdGlvbih0aW1lbGluZSkge1xuICAgICAgdmFyIHRpbWVsaW5lVGltZTtcbiAgICAgIHRpbWVsaW5lVGltZSA9IHRpbWVsaW5lLnByb3BzLnJlcGVhdFRpbWUgKyAodGltZWxpbmUucHJvcHMuc2hpZnRUaW1lIHx8IDApO1xuICAgICAgdGhpcy5wcm9wcy50aW1lID0gTWF0aC5tYXgodGltZWxpbmVUaW1lLCB0aGlzLnByb3BzLnRpbWUpO1xuICAgICAgdGhpcy5wcm9wcy5yZXBlYXRUaW1lID0gKHRoaXMucHJvcHMudGltZSArIHRoaXMucHJvcHMuZGVsYXkpICogKHRoaXMucHJvcHMucmVwZWF0ICsgMSk7XG4gICAgICB0aGlzLnByb3BzLnNoaWZ0ZWRSZXBlYXRUaW1lID0gdGhpcy5wcm9wcy5yZXBlYXRUaW1lICsgKHRoaXMucHJvcHMuc2hpZnRUaW1lIHx8IDApO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuc2hpZnRlZFJlcGVhdFRpbWUgLT0gdGhpcy5wcm9wcy5kZWxheTtcbiAgICB9O1xuXG4gICAgVGltZWxpbmUucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKHRpbWUsIGlzR3Jvdykge1xuICAgICAgaWYgKHRpbWUgPiB0aGlzLnByb3BzLmVuZFRpbWUpIHtcbiAgICAgICAgdGltZSA9IHRoaXMucHJvcHMuZW5kVGltZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aW1lID09PSB0aGlzLnByb3BzLmVuZFRpbWUgJiYgdGhpcy5pc0NvbXBsZXRlZCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3VwZGF0ZVRpbWVsaW5lcyh0aW1lLCBpc0dyb3cpO1xuICAgICAgcmV0dXJuIHRoaXMuX2NoZWNrQ2FsbGJhY2tzKHRpbWUpO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuX3VwZGF0ZVRpbWVsaW5lcyA9IGZ1bmN0aW9uKHRpbWUsIGlzR3Jvdykge1xuICAgICAgdmFyIGVsYXBzZWQsIGksIGxlbiwgc3RhcnRQb2ludCwgdGltZVRvVGltZWxpbmVzO1xuICAgICAgc3RhcnRQb2ludCA9IHRoaXMucHJvcHMuc3RhcnRUaW1lIC0gdGhpcy5wcm9wcy5kZWxheTtcbiAgICAgIGVsYXBzZWQgPSAodGltZSAtIHN0YXJ0UG9pbnQpICUgKHRoaXMucHJvcHMuZGVsYXkgKyB0aGlzLnByb3BzLnRpbWUpO1xuICAgICAgdGltZVRvVGltZWxpbmVzID0gdGltZSA9PT0gdGhpcy5wcm9wcy5lbmRUaW1lID8gdGhpcy5wcm9wcy5lbmRUaW1lIDogc3RhcnRQb2ludCArIGVsYXBzZWQgPj0gdGhpcy5wcm9wcy5zdGFydFRpbWUgPyB0aW1lID49IHRoaXMucHJvcHMuZW5kVGltZSA/IHRoaXMucHJvcHMuZW5kVGltZSA6IHN0YXJ0UG9pbnQgKyBlbGFwc2VkIDogdGltZSA+IHRoaXMucHJvcHMuc3RhcnRUaW1lICsgdGhpcy5wcm9wcy50aW1lID8gdGhpcy5wcm9wcy5zdGFydFRpbWUgKyB0aGlzLnByb3BzLnRpbWUgOiBudWxsO1xuICAgICAgaWYgKHRpbWVUb1RpbWVsaW5lcyAhPSBudWxsKSB7XG4gICAgICAgIGkgPSAtMTtcbiAgICAgICAgbGVuID0gdGhpcy50aW1lbGluZXMubGVuZ3RoIC0gMTtcbiAgICAgICAgd2hpbGUgKGkrKyA8IGxlbikge1xuICAgICAgICAgIGlmIChpc0dyb3cgPT0gbnVsbCkge1xuICAgICAgICAgICAgaXNHcm93ID0gdGltZSA+ICh0aGlzLl9wcmV2aW91c1VwZGF0ZVRpbWUgfHwgMCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMudGltZWxpbmVzW2ldLnVwZGF0ZSh0aW1lVG9UaW1lbGluZXMsIGlzR3Jvdyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9wcmV2aW91c1VwZGF0ZVRpbWUgPSB0aW1lO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuX2NoZWNrQ2FsbGJhY2tzID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgdmFyIF9yZWYsIF9yZWYxLCBfcmVmMjtcbiAgICAgIGlmICh0aGlzLnByZXZUaW1lID09PSB0aW1lKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5wcmV2VGltZSB8fCB0aGlzLmlzQ29tcGxldGVkICYmICF0aGlzLmlzU3RhcnRlZCkge1xuICAgICAgICBpZiAoKF9yZWYgPSB0aGlzLm8ub25TdGFydCkgIT0gbnVsbCkge1xuICAgICAgICAgIF9yZWYuYXBwbHkodGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLmlzQ29tcGxldGVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAodGltZSA+PSB0aGlzLnByb3BzLnN0YXJ0VGltZSAmJiB0aW1lIDwgdGhpcy5wcm9wcy5lbmRUaW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5vblVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdGhpcy5vblVwZGF0ZSgodGltZSAtIHRoaXMucHJvcHMuc3RhcnRUaW1lKSAvIHRoaXMucHJvcHMucmVwZWF0VGltZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnByZXZUaW1lID4gdGltZSAmJiB0aW1lIDw9IHRoaXMucHJvcHMuc3RhcnRUaW1lKSB7XG4gICAgICAgIGlmICgoX3JlZjEgPSB0aGlzLm8ub25SZXZlcnNlQ29tcGxldGUpICE9IG51bGwpIHtcbiAgICAgICAgICBfcmVmMS5hcHBseSh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5wcmV2VGltZSA9IHRpbWU7XG4gICAgICBpZiAodGltZSA9PT0gdGhpcy5wcm9wcy5lbmRUaW1lICYmICF0aGlzLmlzQ29tcGxldGVkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5vblVwZGF0ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdGhpcy5vblVwZGF0ZSgxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKF9yZWYyID0gdGhpcy5vLm9uQ29tcGxldGUpICE9IG51bGwpIHtcbiAgICAgICAgICBfcmVmMi5hcHBseSh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlzQ29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5zdGFydCA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHRoaXMuc2V0U3RhcnRUaW1lKHRpbWUpO1xuICAgICAgIXRpbWUgJiYgKHQuYWRkKHRoaXMpLCB0aGlzLnN0YXRlID0gJ3BsYXknKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVtb3ZlRnJvbVR3ZWVuZXIoKTtcbiAgICAgIHRoaXMuc3RhdGUgPSAncGF1c2UnO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJlbW92ZUZyb21Ud2VlbmVyKCk7XG4gICAgICB0aGlzLnNldFByb2dyZXNzKDApO1xuICAgICAgdGhpcy5zdGF0ZSA9ICdzdG9wJztcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucmVzdGFydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICByZXR1cm4gdGhpcy5zdGFydCgpO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUucmVtb3ZlRnJvbVR3ZWVuZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHQucmVtb3ZlKHRoaXMpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5zZXRTdGFydFRpbWUgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICB0aGlzLmdldERpbWVudGlvbnModGltZSk7XG4gICAgICByZXR1cm4gdGhpcy5zdGFydFRpbWVsaW5lcyh0aGlzLnByb3BzLnN0YXJ0VGltZSk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5zdGFydFRpbWVsaW5lcyA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHZhciBpLCBfcmVzdWx0cztcbiAgICAgIGkgPSB0aGlzLnRpbWVsaW5lcy5sZW5ndGg7XG4gICAgICAodGltZSA9PSBudWxsKSAmJiAodGltZSA9IHRoaXMucHJvcHMuc3RhcnRUaW1lKTtcbiAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIF9yZXN1bHRzLnB1c2godGhpcy50aW1lbGluZXNbaV0uc3RhcnQodGltZSkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgIH07XG5cbiAgICBUaW1lbGluZS5wcm90b3R5cGUuc2V0UHJvZ3Jlc3MgPSBmdW5jdGlvbihwcm9ncmVzcykge1xuICAgICAgaWYgKHRoaXMucHJvcHMuc3RhcnRUaW1lID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5zZXRTdGFydFRpbWUoKTtcbiAgICAgIH1cbiAgICAgIHByb2dyZXNzID0gaC5jbGFtcChwcm9ncmVzcywgMCwgMSk7XG4gICAgICByZXR1cm4gdGhpcy51cGRhdGUodGhpcy5wcm9wcy5zdGFydFRpbWUgKyBwcm9ncmVzcyAqIHRoaXMucHJvcHMucmVwZWF0VGltZSk7XG4gICAgfTtcblxuICAgIFRpbWVsaW5lLnByb3RvdHlwZS5nZXREaW1lbnRpb25zID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgaWYgKHRpbWUgPT0gbnVsbCkge1xuICAgICAgICB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICB9XG4gICAgICB0aGlzLnByb3BzLnN0YXJ0VGltZSA9IHRpbWUgKyB0aGlzLnByb3BzLmRlbGF5ICsgKHRoaXMucHJvcHMuc2hpZnRUaW1lIHx8IDApO1xuICAgICAgdGhpcy5wcm9wcy5lbmRUaW1lID0gdGhpcy5wcm9wcy5zdGFydFRpbWUgKyB0aGlzLnByb3BzLnNoaWZ0ZWRSZXBlYXRUaW1lO1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuZW5kVGltZSAtPSB0aGlzLnByb3BzLnNoaWZ0VGltZSB8fCAwO1xuICAgIH07XG5cbiAgICByZXR1cm4gVGltZWxpbmU7XG5cbiAgfSkoKTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFRpbWVsaW5lO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgVHdlZW4sIGVhc2luZywgaCwgdDtcblxuICBoID0gcmVxdWlyZSgnLi4vaCcpO1xuXG4gIHQgPSByZXF1aXJlKCcuL3R3ZWVuZXInKTtcblxuICBlYXNpbmcgPSByZXF1aXJlKCcuLi9lYXNpbmcvZWFzaW5nJyk7XG5cbiAgVHdlZW4gPSAoZnVuY3Rpb24oKSB7XG4gICAgVHdlZW4ucHJvdG90eXBlLmRlZmF1bHRzID0ge1xuICAgICAgZHVyYXRpb246IDYwMCxcbiAgICAgIGRlbGF5OiAwLFxuICAgICAgcmVwZWF0OiAwLFxuICAgICAgeW95bzogZmFsc2UsXG4gICAgICBlYXNpbmc6ICdMaW5lYXIuTm9uZScsXG4gICAgICBvblN0YXJ0OiBudWxsLFxuICAgICAgb25Db21wbGV0ZTogbnVsbCxcbiAgICAgIG9uUmV2ZXJzZUNvbXBsZXRlOiBudWxsLFxuICAgICAgb25GaXJzdFVwZGF0ZTogbnVsbCxcbiAgICAgIG9uVXBkYXRlOiBudWxsLFxuICAgICAgb25GaXJzdFVwZGF0ZUJhY2t3YXJkOiBudWxsLFxuICAgICAgaXNDaGFpbmVkOiBmYWxzZVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBUd2VlbihvKSB7XG4gICAgICB0aGlzLm8gPSBvICE9IG51bGwgPyBvIDoge307XG4gICAgICB0aGlzLmV4dGVuZERlZmF1bHRzKCk7XG4gICAgICB0aGlzLnZhcnMoKTtcbiAgICAgIHRoaXM7XG4gICAgfVxuXG4gICAgVHdlZW4ucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaCA9IGg7XG4gICAgICB0aGlzLnByb2dyZXNzID0gMDtcbiAgICAgIHRoaXMucHJldlRpbWUgPSAwO1xuICAgICAgcmV0dXJuIHRoaXMuY2FsY0RpbWVudGlvbnMoKTtcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLmNhbGNEaW1lbnRpb25zID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnByb3BzLnRpbWUgPSB0aGlzLnByb3BzLmR1cmF0aW9uICsgdGhpcy5wcm9wcy5kZWxheTtcbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnJlcGVhdFRpbWUgPSB0aGlzLnByb3BzLnRpbWUgKiAodGhpcy5wcm9wcy5yZXBlYXQgKyAxKTtcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLmV4dGVuZERlZmF1bHRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5LCB2YWx1ZSwgX3JlZjtcbiAgICAgIHRoaXMucHJvcHMgPSB7fTtcbiAgICAgIF9yZWYgPSB0aGlzLmRlZmF1bHRzO1xuICAgICAgZm9yIChrZXkgaW4gX3JlZikge1xuICAgICAgICB2YWx1ZSA9IF9yZWZba2V5XTtcbiAgICAgICAgdGhpcy5wcm9wc1trZXldID0gdGhpcy5vW2tleV0gIT0gbnVsbCA/IHRoaXMub1trZXldIDogdmFsdWU7XG4gICAgICB9XG4gICAgICB0aGlzLnByb3BzLmVhc2luZyA9IGVhc2luZy5wYXJzZUVhc2luZyh0aGlzLm8uZWFzaW5nIHx8IHRoaXMuZGVmYXVsdHMuZWFzaW5nKTtcbiAgICAgIHJldHVybiB0aGlzLm9uVXBkYXRlID0gdGhpcy5wcm9wcy5vblVwZGF0ZTtcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24odGltZSkge1xuICAgICAgdGhpcy5pc0NvbXBsZXRlZCA9IGZhbHNlO1xuICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgIGlmICh0aW1lID09IG51bGwpIHtcbiAgICAgICAgdGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgfVxuICAgICAgdGhpcy5wcm9wcy5zdGFydFRpbWUgPSB0aW1lICsgdGhpcy5wcm9wcy5kZWxheSArICh0aGlzLnByb3BzLnNoaWZ0VGltZSB8fCAwKTtcbiAgICAgIHRoaXMucHJvcHMuZW5kVGltZSA9IHRoaXMucHJvcHMuc3RhcnRUaW1lICsgdGhpcy5wcm9wcy5yZXBlYXRUaW1lIC0gdGhpcy5wcm9wcy5kZWxheTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24odGltZSwgaXNHcm93KSB7XG4gICAgICB2YXIgX3JlZiwgX3JlZjEsIF9yZWYyLCBfcmVmMywgX3JlZjQ7XG4gICAgICBpZiAoKHRpbWUgPj0gdGhpcy5wcm9wcy5zdGFydFRpbWUpICYmICh0aW1lIDwgdGhpcy5wcm9wcy5lbmRUaW1lKSkge1xuICAgICAgICB0aGlzLmlzT25SZXZlcnNlQ29tcGxldGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pc0NvbXBsZXRlZCA9IGZhbHNlO1xuICAgICAgICBpZiAoIXRoaXMuaXNGaXJzdFVwZGF0ZSkge1xuICAgICAgICAgIGlmICgoX3JlZiA9IHRoaXMucHJvcHMub25GaXJzdFVwZGF0ZSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgX3JlZi5hcHBseSh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5pc0ZpcnN0VXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuaXNTdGFydGVkKSB7XG4gICAgICAgICAgaWYgKChfcmVmMSA9IHRoaXMucHJvcHMub25TdGFydCkgIT0gbnVsbCkge1xuICAgICAgICAgICAgX3JlZjEuYXBwbHkodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuaXNTdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl91cGRhdGVJbkFjdGl2ZUFyZWEodGltZSk7XG4gICAgICAgIGlmICh0aW1lIDwgdGhpcy5wcmV2VGltZSAmJiAhdGhpcy5pc0ZpcnN0VXBkYXRlQmFja3dhcmQpIHtcbiAgICAgICAgICBpZiAoKF9yZWYyID0gdGhpcy5wcm9wcy5vbkZpcnN0VXBkYXRlQmFja3dhcmQpICE9IG51bGwpIHtcbiAgICAgICAgICAgIF9yZWYyLmFwcGx5KHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmlzRmlyc3RVcGRhdGVCYWNrd2FyZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aW1lID49IHRoaXMucHJvcHMuZW5kVGltZSAmJiAhdGhpcy5pc0NvbXBsZXRlZCkge1xuICAgICAgICAgIHRoaXMuX2NvbXBsZXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWUgPiB0aGlzLnByb3BzLmVuZFRpbWUpIHtcbiAgICAgICAgICB0aGlzLmlzRmlyc3RVcGRhdGUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGltZSA+IHRoaXMucHJvcHMuZW5kVGltZSkge1xuICAgICAgICAgIHRoaXMuaXNGaXJzdFVwZGF0ZUJhY2t3YXJkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aW1lIDwgdGhpcy5wcmV2VGltZSAmJiB0aW1lIDw9IHRoaXMucHJvcHMuc3RhcnRUaW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5pc0ZpcnN0VXBkYXRlQmFja3dhcmQpIHtcbiAgICAgICAgICBpZiAoKF9yZWYzID0gdGhpcy5wcm9wcy5vbkZpcnN0VXBkYXRlQmFja3dhcmQpICE9IG51bGwpIHtcbiAgICAgICAgICAgIF9yZWYzLmFwcGx5KHRoaXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmlzRmlyc3RVcGRhdGVCYWNrd2FyZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzR3Jvdykge1xuICAgICAgICAgIHRoaXMuX2NvbXBsZXRlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNPblJldmVyc2VDb21wbGV0ZSkge1xuICAgICAgICAgIHRoaXMuaXNPblJldmVyc2VDb21wbGV0ZSA9IHRydWU7XG4gICAgICAgICAgdGhpcy5zZXRQcm9ncmVzcygwLCAhdGhpcy5wcm9wcy5pc0NoYWluZWQpO1xuICAgICAgICAgIGlmICgoX3JlZjQgPSB0aGlzLnByb3BzLm9uUmV2ZXJzZUNvbXBsZXRlKSAhPSBudWxsKSB7XG4gICAgICAgICAgICBfcmVmNC5hcHBseSh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc0ZpcnN0VXBkYXRlID0gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aGlzLnByZXZUaW1lID0gdGltZTtcbiAgICAgIHJldHVybiB0aGlzLmlzQ29tcGxldGVkO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuX2NvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgX3JlZjtcbiAgICAgIHRoaXMuc2V0UHJvZ3Jlc3MoMSk7XG4gICAgICBpZiAoKF9yZWYgPSB0aGlzLnByb3BzLm9uQ29tcGxldGUpICE9IG51bGwpIHtcbiAgICAgICAgX3JlZi5hcHBseSh0aGlzKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaXNDb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5pc1N0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgIHJldHVybiB0aGlzLmlzT25SZXZlcnNlQ29tcGxldGUgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLl91cGRhdGVJbkFjdGl2ZUFyZWEgPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICB2YXIgY250LCBlbGFwc2VkLCBlbGFwc2VkMiwgcHJvYywgc3RhcnRQb2ludDtcbiAgICAgIHN0YXJ0UG9pbnQgPSB0aGlzLnByb3BzLnN0YXJ0VGltZSAtIHRoaXMucHJvcHMuZGVsYXk7XG4gICAgICBlbGFwc2VkID0gKHRpbWUgLSBzdGFydFBvaW50KSAlICh0aGlzLnByb3BzLmRlbGF5ICsgdGhpcy5wcm9wcy5kdXJhdGlvbik7XG4gICAgICBjbnQgPSBNYXRoLmZsb29yKCh0aW1lIC0gc3RhcnRQb2ludCkgLyAodGhpcy5wcm9wcy5kZWxheSArIHRoaXMucHJvcHMuZHVyYXRpb24pKTtcbiAgICAgIGlmIChzdGFydFBvaW50ICsgZWxhcHNlZCA+PSB0aGlzLnByb3BzLnN0YXJ0VGltZSkge1xuICAgICAgICBlbGFwc2VkMiA9ICh0aW1lIC0gdGhpcy5wcm9wcy5zdGFydFRpbWUpICUgKHRoaXMucHJvcHMuZGVsYXkgKyB0aGlzLnByb3BzLmR1cmF0aW9uKTtcbiAgICAgICAgcHJvYyA9IGVsYXBzZWQyIC8gdGhpcy5wcm9wcy5kdXJhdGlvbjtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0UHJvZ3Jlc3MoIXRoaXMucHJvcHMueW95byA/IHByb2MgOiBjbnQgJSAyID09PSAwID8gcHJvYyA6IDEgLSAocHJvYyA9PT0gMSA/IDAgOiBwcm9jKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRQcm9ncmVzcyh0aGlzLnByZXZUaW1lIDwgdGltZSA/IDEgOiAwKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLnNldFByb2dyZXNzID0gZnVuY3Rpb24ocCwgaXNDYWxsYmFjaykge1xuICAgICAgaWYgKGlzQ2FsbGJhY2sgPT0gbnVsbCkge1xuICAgICAgICBpc0NhbGxiYWNrID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMucHJvZ3Jlc3MgPSBwO1xuICAgICAgdGhpcy5lYXNlZFByb2dyZXNzID0gdGhpcy5wcm9wcy5lYXNpbmcodGhpcy5wcm9ncmVzcyk7XG4gICAgICBpZiAodGhpcy5wcm9wcy5wcmV2RWFzZWRQcm9ncmVzcyAhPT0gdGhpcy5lYXNlZFByb2dyZXNzICYmIGlzQ2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uVXBkYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB0aGlzLm9uVXBkYXRlKHRoaXMuZWFzZWRQcm9ncmVzcywgdGhpcy5wcm9ncmVzcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnByb3BzLnByZXZFYXNlZFByb2dyZXNzID0gdGhpcy5lYXNlZFByb2dyZXNzO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuc2V0UHJvcCA9IGZ1bmN0aW9uKG9iaiwgdmFsdWUpIHtcbiAgICAgIHZhciBrZXksIHZhbDtcbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3IgKGtleSBpbiBvYmopIHtcbiAgICAgICAgICB2YWwgPSBvYmpba2V5XTtcbiAgICAgICAgICB0aGlzLnByb3BzW2tleV0gPSB2YWw7XG4gICAgICAgICAgaWYgKGtleSA9PT0gJ2Vhc2luZycpIHtcbiAgICAgICAgICAgIHRoaXMucHJvcHMuZWFzaW5nID0gZWFzaW5nLnBhcnNlRWFzaW5nKHRoaXMucHJvcHMuZWFzaW5nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKG9iaiA9PT0gJ2Vhc2luZycpIHtcbiAgICAgICAgICB0aGlzLnByb3BzLmVhc2luZyA9IGVhc2luZy5wYXJzZUVhc2luZyh2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5wcm9wc1tvYmpdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmNhbGNEaW1lbnRpb25zKCk7XG4gICAgfTtcblxuICAgIFR3ZWVuLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbih0aW1lKSB7XG4gICAgICB0aGlzLnN0YXJ0KHRpbWUpO1xuICAgICAgIXRpbWUgJiYgKHQuYWRkKHRoaXMpKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgdGhpcy5zZXRQcm9ncmVzcygwKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBUd2Vlbi5wcm90b3R5cGUucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuX3JlbW92ZUZyb21Ud2VlbmVyKCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVHdlZW4ucHJvdG90eXBlLl9yZW1vdmVGcm9tVHdlZW5lciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdC5yZW1vdmUodGhpcyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgcmV0dXJuIFR3ZWVuO1xuXG4gIH0pKCk7XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBUd2VlbjtcblxufSkuY2FsbCh0aGlzKTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIFR3ZWVuZXIsIGgsIGksIHQ7XG5cbiAgcmVxdWlyZSgnLi4vcG9seWZpbGxzL3JhZicpO1xuXG4gIHJlcXVpcmUoJy4uL3BvbHlmaWxscy9wZXJmb3JtYW5jZScpO1xuXG4gIGggPSByZXF1aXJlKCcuLi9oJyk7XG5cbiAgaSA9IDA7XG5cbiAgVHdlZW5lciA9IChmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBUd2VlbmVyKCkge1xuICAgICAgdGhpcy52YXJzKCk7XG4gICAgICB0aGlzO1xuICAgIH1cblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLnZhcnMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMudHdlZW5zID0gW107XG4gICAgICByZXR1cm4gdGhpcy5sb29wID0gaC5iaW5kKHRoaXMubG9vcCwgdGhpcyk7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLmxvb3AgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB0aW1lO1xuICAgICAgaWYgKCF0aGlzLmlzUnVubmluZykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICB0aGlzLnVwZGF0ZSh0aW1lKTtcbiAgICAgIGlmICghdGhpcy50d2VlbnMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzUnVubmluZyA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMubG9vcCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgVHdlZW5lci5wcm90b3R5cGUuc3RhcnRMb29wID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5pc1J1bm5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgcmV0dXJuIHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLmxvb3ApO1xuICAgIH07XG5cbiAgICBUd2VlbmVyLnByb3RvdHlwZS5zdG9wTG9vcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuaXNSdW5uaW5nID0gZmFsc2U7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgIHZhciBfcmVzdWx0cztcbiAgICAgIGkgPSB0aGlzLnR3ZWVucy5sZW5ndGg7XG4gICAgICBfcmVzdWx0cyA9IFtdO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBpZiAodGhpcy50d2VlbnNbaV0udXBkYXRlKHRpbWUpID09PSB0cnVlKSB7XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh0aGlzLnJlbW92ZShpKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX3Jlc3VsdHMucHVzaCh2b2lkIDApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgfTtcblxuICAgIFR3ZWVuZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHR3ZWVuKSB7XG4gICAgICB0aGlzLnR3ZWVucy5wdXNoKHR3ZWVuKTtcbiAgICAgIHJldHVybiB0aGlzLnN0YXJ0TG9vcCgpO1xuICAgIH07XG5cbiAgICBUd2VlbmVyLnByb3RvdHlwZS5yZW1vdmVBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLnR3ZWVucy5sZW5ndGggPSAwO1xuICAgIH07XG5cbiAgICBUd2VlbmVyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbih0d2Vlbikge1xuICAgICAgdmFyIGluZGV4O1xuICAgICAgaW5kZXggPSB0eXBlb2YgdHdlZW4gPT09ICdudW1iZXInID8gdHdlZW4gOiB0aGlzLnR3ZWVucy5pbmRleE9mKHR3ZWVuKTtcbiAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudHdlZW5zLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBUd2VlbmVyO1xuXG4gIH0pKCk7XG5cbiAgdCA9IG5ldyBUd2VlbmVyO1xuXG4gIG1vZHVsZS5leHBvcnRzID0gdDtcblxufSkuY2FsbCh0aGlzKTtcbiIsIlxuLyohXG4gIExlZ29NdXNocm9vbSBAbGVnb211c2hyb29tIGh0dHA6Ly9sZWdvbXVzaHJvb20uY29tXG4gIE1JVCBMaWNlbnNlIDIwMTRcbiAqL1xuXG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cbihmdW5jdGlvbigpIHtcbiAgKGZ1bmN0aW9uKCkge1xuICAgIHZhciBNYWluO1xuICAgIE1haW4gPSAoZnVuY3Rpb24oKSB7XG4gICAgICBmdW5jdGlvbiBNYWluKG8pIHtcbiAgICAgICAgdGhpcy5vID0gbyAhPSBudWxsID8gbyA6IHt9O1xuICAgICAgICBpZiAod2luZG93LmlzQW55UmVzaXplRXZlbnRJbml0ZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy52YXJzKCk7XG4gICAgICAgIHRoaXMucmVkZWZpbmVQcm90bygpO1xuICAgICAgfVxuXG4gICAgICBNYWluLnByb3RvdHlwZS52YXJzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5pc0FueVJlc2l6ZUV2ZW50SW5pdGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hbGxvd2VkUHJvdG9zID0gW0hUTUxEaXZFbGVtZW50LCBIVE1MRm9ybUVsZW1lbnQsIEhUTUxMaW5rRWxlbWVudCwgSFRNTEJvZHlFbGVtZW50LCBIVE1MUGFyYWdyYXBoRWxlbWVudCwgSFRNTEZpZWxkU2V0RWxlbWVudCwgSFRNTExlZ2VuZEVsZW1lbnQsIEhUTUxMYWJlbEVsZW1lbnQsIEhUTUxCdXR0b25FbGVtZW50LCBIVE1MVUxpc3RFbGVtZW50LCBIVE1MT0xpc3RFbGVtZW50LCBIVE1MTElFbGVtZW50LCBIVE1MSGVhZGluZ0VsZW1lbnQsIEhUTUxRdW90ZUVsZW1lbnQsIEhUTUxQcmVFbGVtZW50LCBIVE1MQlJFbGVtZW50LCBIVE1MRm9udEVsZW1lbnQsIEhUTUxIUkVsZW1lbnQsIEhUTUxNb2RFbGVtZW50LCBIVE1MUGFyYW1FbGVtZW50LCBIVE1MTWFwRWxlbWVudCwgSFRNTFRhYmxlRWxlbWVudCwgSFRNTFRhYmxlQ2FwdGlvbkVsZW1lbnQsIEhUTUxJbWFnZUVsZW1lbnQsIEhUTUxUYWJsZUNlbGxFbGVtZW50LCBIVE1MU2VsZWN0RWxlbWVudCwgSFRNTElucHV0RWxlbWVudCwgSFRNTFRleHRBcmVhRWxlbWVudCwgSFRNTEFuY2hvckVsZW1lbnQsIEhUTUxPYmplY3RFbGVtZW50LCBIVE1MVGFibGVDb2xFbGVtZW50LCBIVE1MVGFibGVTZWN0aW9uRWxlbWVudCwgSFRNTFRhYmxlUm93RWxlbWVudF07XG4gICAgICAgIHJldHVybiB0aGlzLnRpbWVyRWxlbWVudHMgPSB7XG4gICAgICAgICAgaW1nOiAxLFxuICAgICAgICAgIHRleHRhcmVhOiAxLFxuICAgICAgICAgIGlucHV0OiAxLFxuICAgICAgICAgIGVtYmVkOiAxLFxuICAgICAgICAgIG9iamVjdDogMSxcbiAgICAgICAgICBzdmc6IDEsXG4gICAgICAgICAgY2FudmFzOiAxLFxuICAgICAgICAgIHRyOiAxLFxuICAgICAgICAgIHRib2R5OiAxLFxuICAgICAgICAgIHRoZWFkOiAxLFxuICAgICAgICAgIHRmb290OiAxLFxuICAgICAgICAgIGE6IDEsXG4gICAgICAgICAgc2VsZWN0OiAxLFxuICAgICAgICAgIG9wdGlvbjogMSxcbiAgICAgICAgICBvcHRncm91cDogMSxcbiAgICAgICAgICBkbDogMSxcbiAgICAgICAgICBkdDogMSxcbiAgICAgICAgICBicjogMSxcbiAgICAgICAgICBiYXNlZm9udDogMSxcbiAgICAgICAgICBmb250OiAxLFxuICAgICAgICAgIGNvbDogMSxcbiAgICAgICAgICBpZnJhbWU6IDFcbiAgICAgICAgfTtcbiAgICAgIH07XG5cbiAgICAgIE1haW4ucHJvdG90eXBlLnJlZGVmaW5lUHJvdG8gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGksIGl0LCBwcm90bywgdDtcbiAgICAgICAgaXQgPSB0aGlzO1xuICAgICAgICByZXR1cm4gdCA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgX2ksIF9sZW4sIF9yZWYsIF9yZXN1bHRzO1xuICAgICAgICAgIF9yZWYgPSB0aGlzLmFsbG93ZWRQcm90b3M7XG4gICAgICAgICAgX3Jlc3VsdHMgPSBbXTtcbiAgICAgICAgICBmb3IgKGkgPSBfaSA9IDAsIF9sZW4gPSBfcmVmLmxlbmd0aDsgX2kgPCBfbGVuOyBpID0gKytfaSkge1xuICAgICAgICAgICAgcHJvdG8gPSBfcmVmW2ldO1xuICAgICAgICAgICAgaWYgKHByb3RvLnByb3RvdHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3Jlc3VsdHMucHVzaCgoZnVuY3Rpb24ocHJvdG8pIHtcbiAgICAgICAgICAgICAgdmFyIGxpc3RlbmVyLCByZW1vdmVyO1xuICAgICAgICAgICAgICBsaXN0ZW5lciA9IHByb3RvLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyIHx8IHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudDtcbiAgICAgICAgICAgICAgKGZ1bmN0aW9uKGxpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgdmFyIHdyYXBwZWRMaXN0ZW5lcjtcbiAgICAgICAgICAgICAgICB3cmFwcGVkTGlzdGVuZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgIHZhciBvcHRpb247XG4gICAgICAgICAgICAgICAgICBpZiAodGhpcyAhPT0gd2luZG93IHx8IHRoaXMgIT09IGRvY3VtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbiA9IGFyZ3VtZW50c1swXSA9PT0gJ29ucmVzaXplJyAmJiAhdGhpcy5pc0FueVJlc2l6ZUV2ZW50SW5pdGVkO1xuICAgICAgICAgICAgICAgICAgICBvcHRpb24gJiYgaXQuaGFuZGxlUmVzaXplKHtcbiAgICAgICAgICAgICAgICAgICAgICBhcmdzOiBhcmd1bWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgdGhhdDogdGhpc1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKHByb3RvLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gcHJvdG8ucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSB3cmFwcGVkTGlzdGVuZXI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcm90by5wcm90b3R5cGUuYXR0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBwcm90by5wcm90b3R5cGUuYXR0YWNoRXZlbnQgPSB3cmFwcGVkTGlzdGVuZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KShsaXN0ZW5lcik7XG4gICAgICAgICAgICAgIHJlbW92ZXIgPSBwcm90by5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciB8fCBwcm90by5wcm90b3R5cGUuZGV0YWNoRXZlbnQ7XG4gICAgICAgICAgICAgIHJldHVybiAoZnVuY3Rpb24ocmVtb3Zlcikge1xuICAgICAgICAgICAgICAgIHZhciB3cmFwcGVkUmVtb3ZlcjtcbiAgICAgICAgICAgICAgICB3cmFwcGVkUmVtb3ZlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5pc0FueVJlc2l6ZUV2ZW50SW5pdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICB0aGlzLmlmcmFtZSAmJiB0aGlzLnJlbW92ZUNoaWxkKHRoaXMuaWZyYW1lKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiByZW1vdmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAocHJvdG8ucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBwcm90by5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IHdyYXBwZWRSZW1vdmVyO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvdG8ucHJvdG90eXBlLmRldGFjaEV2ZW50KSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gcHJvdG8ucHJvdG90eXBlLmRldGFjaEV2ZW50ID0gd3JhcHBlZExpc3RlbmVyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSkocmVtb3Zlcik7XG4gICAgICAgICAgICB9KShwcm90bykpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gX3Jlc3VsdHM7XG4gICAgICAgIH0pLmNhbGwodGhpcyk7XG4gICAgICB9O1xuXG4gICAgICBNYWluLnByb3RvdHlwZS5oYW5kbGVSZXNpemUgPSBmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgIHZhciBjb21wdXRlZFN0eWxlLCBlbCwgaWZyYW1lLCBpc0VtcHR5LCBpc05vUG9zLCBpc1N0YXRpYywgX3JlZjtcbiAgICAgICAgZWwgPSBhcmdzLnRoYXQ7XG4gICAgICAgIGlmICghdGhpcy50aW1lckVsZW1lbnRzW2VsLnRhZ05hbWUudG9Mb3dlckNhc2UoKV0pIHtcbiAgICAgICAgICBpZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgICBlbC5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICAgICAgICAgIGlmcmFtZS5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICAgICAgICBpZnJhbWUuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuICAgICAgICAgIGlmcmFtZS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLnpJbmRleCA9IC05OTk7XG4gICAgICAgICAgaWZyYW1lLnN0eWxlLm9wYWNpdHkgPSAwO1xuICAgICAgICAgIGlmcmFtZS5zdHlsZS50b3AgPSAwO1xuICAgICAgICAgIGlmcmFtZS5zdHlsZS5sZWZ0ID0gMDtcbiAgICAgICAgICBjb21wdXRlZFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUgPyBnZXRDb21wdXRlZFN0eWxlKGVsKSA6IGVsLmN1cnJlbnRTdHlsZTtcbiAgICAgICAgICBpc05vUG9zID0gZWwuc3R5bGUucG9zaXRpb24gPT09ICcnO1xuICAgICAgICAgIGlzU3RhdGljID0gY29tcHV0ZWRTdHlsZS5wb3NpdGlvbiA9PT0gJ3N0YXRpYycgJiYgaXNOb1BvcztcbiAgICAgICAgICBpc0VtcHR5ID0gY29tcHV0ZWRTdHlsZS5wb3NpdGlvbiA9PT0gJycgJiYgZWwuc3R5bGUucG9zaXRpb24gPT09ICcnO1xuICAgICAgICAgIGlmIChpc1N0YXRpYyB8fCBpc0VtcHR5KSB7XG4gICAgICAgICAgICBlbC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoX3JlZiA9IGlmcmFtZS5jb250ZW50V2luZG93KSAhPSBudWxsKSB7XG4gICAgICAgICAgICBfcmVmLm9ucmVzaXplID0gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF90aGlzLmRpc3BhdGNoRXZlbnQoZWwpO1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkodGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsLmlmcmFtZSA9IGlmcmFtZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmluaXRUaW1lcihlbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVsLmlzQW55UmVzaXplRXZlbnRJbml0ZWQgPSB0cnVlO1xuICAgICAgfTtcblxuICAgICAgTWFpbi5wcm90b3R5cGUuaW5pdFRpbWVyID0gZnVuY3Rpb24oZWwpIHtcbiAgICAgICAgdmFyIGhlaWdodCwgd2lkdGg7XG4gICAgICAgIHdpZHRoID0gMDtcbiAgICAgICAgaGVpZ2h0ID0gMDtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgbmV3SGVpZ2h0LCBuZXdXaWR0aDtcbiAgICAgICAgICAgIG5ld1dpZHRoID0gZWwub2Zmc2V0V2lkdGg7XG4gICAgICAgICAgICBuZXdIZWlnaHQgPSBlbC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgICAgICBpZiAobmV3V2lkdGggIT09IHdpZHRoIHx8IG5ld0hlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgICAgICAgIF90aGlzLmRpc3BhdGNoRXZlbnQoZWwpO1xuICAgICAgICAgICAgICB3aWR0aCA9IG5ld1dpZHRoO1xuICAgICAgICAgICAgICByZXR1cm4gaGVpZ2h0ID0gbmV3SGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH0pKHRoaXMpLCB0aGlzLm8uaW50ZXJ2YWwgfHwgNjIuNSk7XG4gICAgICB9O1xuXG4gICAgICBNYWluLnByb3RvdHlwZS5kaXNwYXRjaEV2ZW50ID0gZnVuY3Rpb24oZWwpIHtcbiAgICAgICAgdmFyIGU7XG4gICAgICAgIGlmIChkb2N1bWVudC5jcmVhdGVFdmVudCkge1xuICAgICAgICAgIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnSFRNTEV2ZW50cycpO1xuICAgICAgICAgIGUuaW5pdEV2ZW50KCdvbnJlc2l6ZScsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgICAgcmV0dXJuIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgICAgICBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICAgICAgICByZXR1cm4gZWwuZmlyZUV2ZW50KCdvbnJlc2l6ZScsIGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgTWFpbi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaSwgaXQsIHByb3RvLCBfaSwgX2xlbiwgX3JlZiwgX3Jlc3VsdHM7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbCk7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICB3aW5kb3cuaXNBbnlSZXNpemVFdmVudEluaXRlZCA9IGZhbHNlO1xuICAgICAgICBpdCA9IHRoaXM7XG4gICAgICAgIF9yZWYgPSB0aGlzLmFsbG93ZWRQcm90b3M7XG4gICAgICAgIF9yZXN1bHRzID0gW107XG4gICAgICAgIGZvciAoaSA9IF9pID0gMCwgX2xlbiA9IF9yZWYubGVuZ3RoOyBfaSA8IF9sZW47IGkgPSArK19pKSB7XG4gICAgICAgICAgcHJvdG8gPSBfcmVmW2ldO1xuICAgICAgICAgIGlmIChwcm90by5wcm90b3R5cGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIF9yZXN1bHRzLnB1c2goKGZ1bmN0aW9uKHByb3RvKSB7XG4gICAgICAgICAgICB2YXIgbGlzdGVuZXI7XG4gICAgICAgICAgICBsaXN0ZW5lciA9IHByb3RvLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyIHx8IHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudDtcbiAgICAgICAgICAgIGlmIChwcm90by5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgICBwcm90by5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IEVsZW1lbnQucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3RvLnByb3RvdHlwZS5hdHRhY2hFdmVudCkge1xuICAgICAgICAgICAgICBwcm90by5wcm90b3R5cGUuYXR0YWNoRXZlbnQgPSBFbGVtZW50LnByb3RvdHlwZS5hdHRhY2hFdmVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcm90by5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgICByZXR1cm4gcHJvdG8ucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBFbGVtZW50LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm90by5wcm90b3R5cGUuZGV0YWNoRXZlbnQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHByb3RvLnByb3RvdHlwZS5kZXRhY2hFdmVudCA9IEVsZW1lbnQucHJvdG90eXBlLmRldGFjaEV2ZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pKHByb3RvKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9yZXN1bHRzO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIE1haW47XG5cbiAgICB9KSgpO1xuICAgIGlmICgodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiKSAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICByZXR1cm4gZGVmaW5lKFwiYW55LXJlc2l6ZS1ldmVudFwiLCBbXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWFpbjtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBtb2R1bGUgPT09IFwib2JqZWN0XCIpICYmICh0eXBlb2YgbW9kdWxlLmV4cG9ydHMgPT09IFwib2JqZWN0XCIpKSB7XG4gICAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHMgPSBuZXcgTWFpbjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgJiYgd2luZG93ICE9PSBudWxsKSB7XG4gICAgICAgIHdpbmRvdy5BbnlSZXNpemVFdmVudCA9IE1haW47XG4gICAgICB9XG4gICAgICByZXR1cm4gdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiAmJiB3aW5kb3cgIT09IG51bGwgPyB3aW5kb3cuYW55UmVzaXplRXZlbnQgPSBuZXcgTWFpbiA6IHZvaWQgMDtcbiAgICB9XG4gIH0pKCk7XG5cbn0pLmNhbGwodGhpcyk7XG4iLCJpbXBvcnQgbW9qcyBmcm9tICdtby1qcyc7XG5cbmNvbnN0IGljb25BbmltYXRpb24gPSAoaWNvbkxpbmspID0+IHtcblxuICBjb25zdCBzY2FsZUN1cnZlID0gbW9qcy5lYXNpbmcucGF0aCgnTTAsMTAwIEwyNSw5OS45OTk5OTgzIEMyNi4yMzI4ODM1LDc1LjA3MDg4NDcgMTkuNzg0Nzg0MywwIDEwMCwwJyk7XG4gIGNvbnN0IGVsID0gaWNvbkxpbmssXG4gICAgZWxTcGFuID0gZWwucXVlcnlTZWxlY3Rvcignc3ZnJyksXG4gIC8vIG1vLmpzIHRpbWVsaW5lIG9ialxuICAgIHRpbWVsaW5lID0gbmV3IG1vanMuVGltZWxpbmUoKSxcblxuICAvLyB0d2VlbnMgZm9yIHRoZSBhbmltYXRpb246XG5cbiAgLy8gcmluZyBhbmltYXRpb25cbiAgICB0d2VlbjIgPSBuZXcgbW9qcy5UcmFuc2l0KHtcbiAgICAgIHBhcmVudDogZWwsXG4gICAgICBkdXJhdGlvbjogNzUwLFxuICAgICAgdHlwZTogJ2NpcmNsZScsXG4gICAgICByYWRpdXM6IHswOiAzMH0sXG4gICAgICBmaWxsOiAndHJhbnNwYXJlbnQnLFxuICAgICAgc3Ryb2tlOiAncmVkJyxcbiAgICAgIHN0cm9rZVdpZHRoOiB7MTU6IDB9LFxuICAgICAgb3BhY2l0eTogMC42LFxuICAgICAgeDogJzUwJScsXG4gICAgICB5OiAnNTAlJyxcbiAgICAgIGlzUnVuTGVzczogdHJ1ZSxcbiAgICAgIGVhc2luZzogbW9qcy5lYXNpbmcuYmV6aWVyKDAsIDEsIDAuNSwgMSksXG4gICAgfSksXG4gIC8vIGljb24gc2NhbGUgYW5pbWF0aW9uXG4gICAgdHdlZW4zID0gbmV3IG1vanMuVHdlZW4oe1xuICAgICAgZHVyYXRpb246IDkwMCxcbiAgICAgIG9uVXBkYXRlOiAocHJvZ3Jlc3MpID0+IHtcbiAgICAgICAgY29uc3Qgc2NhbGVQcm9ncmVzcyA9IHNjYWxlQ3VydmUocHJvZ3Jlc3MpO1xuICAgICAgICBlbFNwYW4uc3R5bGUuV2Via2l0VHJhbnNmb3JtID0gZWxTcGFuLnN0eWxlLnRyYW5zZm9ybSA9IGBzY2FsZTNkKCR7c2NhbGVQcm9ncmVzc30sJHtzY2FsZVByb2dyZXNzfSwxKWA7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gIC8vIGFkZCB0d2VlbnMgdG8gdGltZWxpbmU6XG4gIHRpbWVsaW5lLmFkZCh0d2VlbjIsIHR3ZWVuMyk7XG5cbiAgLy8gd2hlbiBjbGlja2luZyB0aGUgYnV0dG9uIHN0YXJ0IHRoZSB0aW1lbGluZS9hbmltYXRpb246XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7XG4gICAgdGltZWxpbmUuc3RhcnQoKTtcbiAgfSk7XG5cbn07XG5cbmV4cG9ydCBkZWZhdWx0IGljb25BbmltYXRpb247IiwiaW1wb3J0IGF0dGFjaEZhc3RDbGljayBmcm9tICdmYXN0Y2xpY2snO1xuaW1wb3J0IGljb25BbmltYXRpb24gZnJvbSAnLi9jb21wb25lbnRzL2ljb25BbmltYXRpb24nO1xuXG5jb25zdCBsaW5rcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3NvY2lhbC1saW5rJyk7XG5cbmZvcihsZXQgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKyApIHtcbiAgaWNvbkFuaW1hdGlvbihsaW5rc1tpXSk7XG59XG5cbi8vSW5pdGlhdGUgZmFzdGNsaWNrIG9uIGJvZHlcbmF0dGFjaEZhc3RDbGljayhkb2N1bWVudC5ib2R5KTsiXX0=
