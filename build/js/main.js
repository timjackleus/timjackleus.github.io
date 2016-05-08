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

},{"./components/iconAnimation":29,"fastclick":1}]},{},[30]);
