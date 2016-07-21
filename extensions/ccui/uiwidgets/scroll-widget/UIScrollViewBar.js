/****************************************************************************
 Copyright (c) 2015 Neo Kim (neo.kim@neofect.com)
 Copyright (c) 2015 Nikita Besshaposhnikov (nikita.besshaposhnikov@gmail.com)

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

/**
 * The ScrollViewBar control of Cocos UI <br/>
 * Scroll bar being attached to ScrollView layout container.
 * @class
 * @extends ccui.ProtectedNode
 *
 * @property {Number}               opacity              - Opacity of the scroll view bar
 * @property {Boolean}              autoHideEnabled             - Auto hide is enabled in the scroll view bar
 * @property {Number}               autoHideTime             - Auto hide time of the scroll view bar
 */
ccui.ScrollViewBar = ccui.ProtectedNode.extend(/** @lends ccui.ScrollViewBar# */{
    _parentScroll: null,
    _direction: null,

    _upperHalfCircle: null,
    _lowerHalfCircle: null,
    _body: null,

    _opacity : 255,

    _marginFromBoundary : 0,
    _marginForLength: 0,
	
	_touchBeganPosition: null,

    _touching: false,

    _autoHideEnabled: true,
    autoHideTime : 0,
    _autoHideRemainingTime : 0,
    _className: "ScrollViewBar",

    /**
     * Allocates and initializes a UIScrollViewBar.
     * Constructor of ccui.ScrollViewBar. override it to extend the construction behavior, remember to call "this._super()" in the extended "ctor" function.
     * @param {ccui.ScrollView} parent A parent of scroll bar.
     * @param {ccui.ScrollView.DIR_NONE | ccui.ScrollView.DIR_HORIZONTAL | ccui.ScrollView.DIR_VERTICAL | ccui.ScrollView.DIR_BOTH} direction
     */
    ctor: function (parent, direction) {
        cc.ProtectedNode.prototype.ctor.call(this);
        this._direction = direction;
        this._parentScroll  = parent;

        this._marginFromBoundary = ccui.ScrollViewBar.DEFAULT_MARGIN;
        this._marginForLength = ccui.ScrollViewBar.DEFAULT_MARGIN;
        this.opacity = 255 * ccui.ScrollViewBar.DEFAULT_SCROLLBAR_OPACITY;
        this.autoHideTime = ccui.ScrollViewBar.DEFAULT_AUTO_HIDE_TIME;
        this._autoHideEnabled = true;

        ccui.ScrollViewBar.prototype.init.call(this);

        this.setCascadeColorEnabled(true);
        this.setCascadeOpacityEnabled(true);
    },

    /**
     * Initializes a ccui.ScrollViewBar. Please do not call this function by yourself, you should pass the parameters to constructor to initialize it.
     * @returns {boolean}
     */
    init: function () {
        this._upperHalfCircle = ccui.helper._createSpriteFromBase64(ccui.ScrollViewBar.HALF_CIRCLE_IMAGE, ccui.ScrollViewBar.HALF_CIRCLE_IMAGE_KEY);
        this._upperHalfCircle.setAnchorPoint(cc.p(0.5, 0));

        this._lowerHalfCircle = ccui.helper._createSpriteFromBase64(ccui.ScrollViewBar.HALF_CIRCLE_IMAGE, ccui.ScrollViewBar.HALF_CIRCLE_IMAGE_KEY);
        this._lowerHalfCircle.setAnchorPoint(cc.p(0.5, 0));
        this._lowerHalfCircle.setScaleY(-1);

        this.addProtectedChild(this._upperHalfCircle);
        this.addProtectedChild(this._lowerHalfCircle);

        this._body =  ccui.helper._createSpriteFromBase64(ccui.ScrollViewBar.BODY_IMAGE_1_PIXEL_HEIGHT, ccui.ScrollViewBar.BODY_IMAGE_1_PIXEL_HEIGHT_KEY);
        this._body.setAnchorPoint(cc.p(0.5, 0));
        this.addProtectedChild(this._body);

        this.setColor(ccui.ScrollViewBar.DEFAULT_COLOR);
        this.onScrolled(cc.p(0, 0));
        cc.ProtectedNode.prototype.setOpacity.call(this, 0);
        this._autoHideRemainingTime = 0;
		
		this._touchBeganPosition = cc.p(0, 0);

        if(this._direction === ccui.ScrollView.DIR_HORIZONTAL)
        {
            this.setRotation(90);
        }
		
		this.setTouchEnabled(true);
    },
	
	removeFromParent: function()
	{
		ccui.ProtectedNode.prototype.removeFromParent.call(this);
		this.setTouchEnabled(false);
	},
	
	setParent: function(node)
	{
		ccui.ProtectedNode.prototype.setParent.apply(this, arguments);
		if(node)
			this.setTouchEnabled(true);
		else
			this.setTouchEnabled(false);
	},
	
	_isAncestorsVisible: function(node){
        if (null == node)
            return true;

        var parent = node.getParent();

        if (parent && !parent.isVisible())
            return false;
        return this._isAncestorsVisible(parent);
    },
	
	/**
     * Sets whether the widget is touch enabled. The default value is false, a widget is default to touch disabled
     * @param {Boolean} enable  true if the widget is touch enabled, false if the widget is touch disabled.
     */
    setTouchEnabled: function (enable) {
        if (this._touchEnabled === enable)
            return;

        this._touchEnabled = enable;                                  //TODO need consider remove and re-add.
        if (this._touchEnabled) {
            if(!this._touchListener)
                this._touchListener = cc.EventListener.create({
                    event: cc.EventListener.TOUCH_ONE_BY_ONE,
                    swallowTouches: true,
                    onTouchBegan: this.onTouchBegan.bind(this),
                    onTouchMoved: this.onTouchMoved.bind(this),
                    onTouchEnded: this.onTouchEnded.bind(this)
                });
            cc.eventManager.addListener(this._touchListener, this);
        } else {
            cc.eventManager.removeListener(this._touchListener);
        }
    },

    /**
     * Set the scroll bar position from the left-bottom corner (horizontal) or right-top corner (vertical).
     * @param {cc.Point} positionFromCorner The position from the left-bottom corner (horizontal) or right-top corner (vertical).
     */
    setPositionFromCorner: function(positionFromCorner)
    {
        if(this._direction === ccui.ScrollView.DIR_VERTICAL)
        {
            this._marginForLength = positionFromCorner.y;
            this._marginFromBoundary = positionFromCorner.x;
        }
        else
        {
            this._marginForLength = positionFromCorner.x;
            this._marginFromBoundary = positionFromCorner.y;
        }
    },

    onEnter: function()
    {
        cc.ProtectedNode.prototype.onEnter.call(this);
        this.scheduleUpdate();
    },

    /**
     * Get the scroll bar position from the left-bottom corner (horizontal) or right-top corner (vertical).
     * @returns {cc.Point}
     */
    getPositionFromCorner: function()
    {
        if(this._direction === ccui.ScrollView.DIR_VERTICAL)
        {
            return cc.p(this._marginFromBoundary, this._marginForLength);
        }
        else
        {
            return cc.p(this._marginForLength, this._marginFromBoundary);
        }
    },
    /**
     * Set the scroll bar's width
     * @param {number} width The scroll bar's width
     */
    setWidth: function(width)
    {
		this._contentSize.width = width;
        var scale = width / this._body.width;
        this._body.setScaleX(scale);
        this._upperHalfCircle.setScale(scale);
        this._lowerHalfCircle.setScale(-scale);
    },

    /**
     * Get the scroll bar's width
     * @returns {number} the scroll bar's width
     */
    getWidth: function()
    {
        return this._body.getBoundingBox().width;
    },

    /**
     * Set scroll bar auto hide state
     * @param {boolean} autoHideEnabled scroll bar auto hide state
     */
    setAutoHideEnabled: function(autoHideEnabled)
    {
        this._autoHideEnabled = autoHideEnabled;

        if(!this._autoHideEnabled/* && !this._touching && this._autoHideRemainingTime <= 0*/)
            cc.ProtectedNode.prototype.setOpacity.call(this, this.opacity);
        else
            cc.ProtectedNode.prototype.setOpacity.call(this, 0);
    },
    /**
     * Query scroll bar auto hide state
     * @returns {boolean} True if scroll bar auto hide is enabled, false otherwise.
     */
    isAutoHideEnabled: function()
    {
        return this._autoHideEnabled;
    },

    /**
     * Set scroll bar opacity
     * @param {number} opacity scroll bar opacity
     */
    setOpacity: function(opacity)
    {
        this._opacity = opacity;
    },

    /**
     * Get scroll bar opacity
     * @returns {number}
     */
    getOpacity: function()
    {
        return this._opacity;
    },

    _updateLength: function(length)
    {
        var ratio = length / this._body.getTextureRect().height;
        this._body.setScaleY(ratio);
        this._upperHalfCircle.setPositionY(this._body.getPositionY() + length);
		this._contentSize.height = length;
    },

    _processAutoHide: function(dt)
    {
        if(!this._autoHideEnabled || this._autoHideRemainingTime <= 0)
        {
            return;
        }
        else if(this._touching)
        {
            // If it is touching, don't auto hide.
            return;
        }

        this._autoHideRemainingTime -= dt;
        if(this._autoHideRemainingTime <= this.autoHideTime)
        {
            this. _autoHideRemainingTime = Math.max(0, this._autoHideRemainingTime);
            cc.ProtectedNode.prototype.setOpacity.call(this, this._opacity * (this._autoHideRemainingTime / this.autoHideTime));
        }
    },


    update: function(dt)
    {
        this._processAutoHide(dt);
    },

    /**
     * The touch began event callback handler of ccui.ScrollViewBar.
     * @param {cc.Touch} touch
     * @param {cc.Event} event
	 * @returns {boolean}
     */
    onTouchBegan: function(touch, event)
    {
		this._hit = false;
        if (this.isVisible() && ccui.Widget.prototype._isAncestorsVisible.call(this, this)){
            var touchPoint = touch.getLocation();
            this._touchBeganPosition.x = touchPoint.x;
            this._touchBeganPosition.y = touchPoint.y;

			var bb = cc.rect(0, 0, this._contentSize.width, this._contentSize.height);
			
			var p = ccui.Widget.prototype.convertToNodeSpace.call(this, this._touchBeganPosition);

			p.x += this._contentSize.width / 2;
			
			if(cc.rectContainsPoint(bb, p))
				this._hit = true;
        }
        if (!this._hit)
        {
			return false;
		}
		
		ccui.ScrollView.prototype.onTouchEnded.apply(this.getParent(), arguments); // just in case its already triggered
		
		this.getParent()._isInterceptTouch = true;

        if(!this._autoHideEnabled)
        {
            return true;
        }
        this._touching = true;
		
		return true;
    },

    /**
     * The touch ended event callback handler of ccui.ScrollViewBar.
     * @param {cc.Touch} touch
     * @param {cc.Event} event
	 * @returns {boolean}
     */
    onTouchEnded: function(touch, event)
    {
		this.getParent()._isInterceptTouch = false;
        if(!this._autoHideEnabled)
        {
            return true;
        }
        this._touching = false;

        if(this._autoHideRemainingTime <= 0)
        {
            // If the remaining time is 0, it means that it didn't moved after touch started so scroll bar is not showing.
            return true;
        }
        this._autoHideRemainingTime = this.autoHideTime;
		return true;
    },
	
	/**
     * The touch moved event callback handler of ccui.ScrollViewBar.
     * @param {cc.Touch} touch
     * @param {cc.Event} event
     */
    onTouchMoved: function (touch, event) {
		var location = touch.getLocation();
		var prevLocation = touch.getPreviousLocation();
		
		var innerContainerSize = ccui.ScrollView.prototype.getInnerContainerSize.call(this.getParent());
		var size = ccui.ScrollView.prototype.getContentSize.call(this.getParent());
		
		var ratio = cc.size(size.width, size.height);
		ratio.width /= innerContainerSize.width;
		ratio.height /= innerContainerSize.height;
		
		// swap the points: we want to follow the direction of the touch
		touch._point.y = prevLocation.y;
		touch._point.x = prevLocation.x;
		touch._prevPoint.y = location.y;
		touch._prevPoint.x = location.x;
		
		touch._point.y += (touch.getDelta().y / ratio.height); // scroll bar should follow the touch location
		touch._point.x += (touch.getDelta().x / ratio.width);
		
		ccui.ScrollView.prototype._handleMoveLogic.call(this.getParent(), touch);
    },

    /**
     * @brief This is called by parent ScrollView when the parent is scrolled. Don't call this directly.
     *
     * @param {cc.Point} outOfBoundary amount how much the inner container of ScrollView is out of boundary
     */
    onScrolled: function(outOfBoundary)
    {
        if(this._autoHideEnabled)
        {
            this._autoHideRemainingTime = this.autoHideTime;
            cc.ProtectedNode.prototype.setOpacity.call(this, this.opacity);
        }

        var innerContainer = this._parentScroll.getInnerContainer();

        var innerContainerMeasure = 0;
        var scrollViewMeasure = 0;
        var outOfBoundaryValue = 0;
        var innerContainerPosition = 0;

        if(this._direction === ccui.ScrollView.DIR_VERTICAL)
        {
            innerContainerMeasure = innerContainer.height;
            scrollViewMeasure = this._parentScroll.height;
            outOfBoundaryValue = outOfBoundary.y;
            innerContainerPosition = -innerContainer.getPositionY();
        }
        else if(this._direction === ccui.ScrollView.DIR_HORIZONTAL)
        {
            innerContainerMeasure = innerContainer.width;
            scrollViewMeasure = this._parentScroll.width;
            outOfBoundaryValue = outOfBoundary.x;
            innerContainerPosition = -innerContainer.getPositionX();
        }

        var length = this._calculateLength(innerContainerMeasure, scrollViewMeasure, outOfBoundaryValue);
        var position = this._calculatePosition(innerContainerMeasure, scrollViewMeasure, innerContainerPosition, outOfBoundaryValue, length);
        this._updateLength(length);
        this.setPosition(position);
    },

    _calculateLength: function(innerContainerMeasure, scrollViewMeasure, outOfBoundaryValue)
    {
        var denominatorValue = innerContainerMeasure;
        if(outOfBoundaryValue !== 0)
        {
            // If it is out of boundary, the length of scroll bar gets shorter quickly.
            var GETTING_SHORTER_FACTOR = 20;
            denominatorValue += (outOfBoundaryValue > 0 ? outOfBoundaryValue : -outOfBoundaryValue) * GETTING_SHORTER_FACTOR;
        }

        var lengthRatio = scrollViewMeasure / denominatorValue;
        return Math.abs(scrollViewMeasure - 2 * this._marginForLength) * lengthRatio;
    },

    _calculatePosition: function(innerContainerMeasure, scrollViewMeasure, innerContainerPosition, outOfBoundaryValue, length)
    {
        var denominatorValue = innerContainerMeasure - scrollViewMeasure;
        if(outOfBoundaryValue !== 0)
        {
            denominatorValue += Math.abs(outOfBoundaryValue);
        }

        var positionRatio = 0;

        if(denominatorValue !== 0)
        {
            positionRatio = innerContainerPosition / denominatorValue;
            positionRatio = Math.max(positionRatio, 0);
            positionRatio = Math.min(positionRatio, 1);
        }

        var position = (scrollViewMeasure - length - 2 * this._marginForLength) * positionRatio + this._marginForLength;

        if(this._direction === ccui.ScrollView.DIR_VERTICAL)
        {
            return cc.p(this._parentScroll.width - this._marginFromBoundary, position);
        }
        else
        {
            return cc.p(position, this._marginFromBoundary);
        }
    }

});

var _p = ccui.ScrollViewBar.prototype;

// Extended properties
/** @expose */
_p.opacity;
cc.defineGetterSetter(_p, "opacity", _p.getOpacity, _p.setOpacity);
/** @expose */
_p.autoHideEnabled;
cc.defineGetterSetter(_p, "autoHideEnabled", _p.isAutoHideEnabled, _p.setAutoHideEnabled);

/**
 * @ignore
 */
ccui.ScrollViewBar.DEFAULT_COLOR = cc.color(52, 65, 87);
ccui.ScrollViewBar.DEFAULT_MARGIN = 20;
ccui.ScrollViewBar.DEFAULT_AUTO_HIDE_TIME = 0.2;
ccui.ScrollViewBar.DEFAULT_SCROLLBAR_OPACITY = 0.4;
ccui.ScrollViewBar.HALF_CIRCLE_IMAGE_KEY = "/__half_circle_image";
ccui.ScrollViewBar.HALF_CIRCLE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAGCAMAAADAMI+zAAAAJ1BMVEX///////////////////////////////////////////////////9Ruv0SAAAADHRSTlMABgcbbW7Hz9Dz+PmlcJP5AAAAMElEQVR4AUXHwQ2AQAhFwYcLH1H6r1djzDK3ASxUpTBeK/uTCyz7dx54b44m4p5cD1MwAooEJyk3AAAAAElFTkSuQmCC";
ccui.ScrollViewBar.BODY_IMAGE_1_PIXEL_HEIGHT_KEY = "/__body_image_height";
ccui.ScrollViewBar.BODY_IMAGE_1_PIXEL_HEIGHT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAABCAMAAADdNb8LAAAAA1BMVEX///+nxBvIAAAACklEQVR4AWNABgAADQABYc2cpAAAAABJRU5ErkJggg==";
