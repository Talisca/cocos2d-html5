/****************************************************************************
 Copyright (c) 2013-2014 Chukong Technologies Inc.

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

//---------------------- Customer render cmd --------------------
cc.CustomRenderCmd = function (target, func) {
    this._needDraw = true;
    this._target = target;
    this._callback = func;

    this.rendering = function (scaleX, scaleY) {
        if (!this._callback)
            return;
        this._callback.call(this._target, scaleX, scaleY);
    }
};

cc.CustomRenderCmd.prototype.configureBatch = function()
{
    return 1;
}

cc.CustomRenderCmd.prototype._batchedCount = 1;

cc.Node._dirtyFlags =
    {
        transformDirty: 1 << 0,
        visibleDirty: 1 << 1,
        colorDirty: 1 << 2,
        opacityDirty: 1 << 3,
        cacheDirty: 1 << 4,
        orderDirty: 1 << 5,
        textDirty: 1 << 6,
        gradientDirty: 1 << 7,
        quadDirty: 1 << 8,
        all: (1 << 31) - 1
    };

//-------------------------Base -------------------------
cc.Node.RenderCmd = function(renderable){
    this._dirtyFlag = 1;                           //need update the transform at first.

    this._node = renderable;
    this._needDraw = false;
    this._anchorPointInPoints = new cc.Point(0,0);

    this._transform = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};
    this._worldTransform = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};
    this._inverse = {a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0};

    this._displayedOpacity = 255;
    this._displayedColor = cc.color(255, 255, 255, 255);
    this._cascadeColorEnabledDirty = false;
    this._cascadeOpacityEnabledDirty = false;

    this._curLevel = -1;
};

(function(){
    var _cc = cc;
cc.Node.RenderCmd.prototype = {
    constructor: cc.Node.RenderCmd,

    getAnchorPointInPoints: function(){
        return _cc.p(this._anchorPointInPoints);
    },

    getDisplayedColor: function(){
        var tmpColor = this._displayedColor;
        return _cc.color(tmpColor.r, tmpColor.g, tmpColor.b, tmpColor.a);
    },

    getDisplayedOpacity: function(){
        return this._displayedOpacity;
    },

    setCascadeColorEnabledDirty: function(){
        this._cascadeColorEnabledDirty = true;
        this.setDirtyFlag(_cc.Node._dirtyFlags.colorDirty);
    },

    setCascadeOpacityEnabledDirty:function(){
        this._cascadeOpacityEnabledDirty = true;
        this.setDirtyFlag(_cc.Node._dirtyFlags.opacityDirty);
    },

    getParentToNodeTransform: function(){
        if(this._dirtyFlag & _cc.Node._dirtyFlags.transformDirty)
            this._inverse = _cc.affineTransformInvert(this.getNodeToParentTransform());
        return this._inverse;
    },

    detachFromParent: function(){},

    _updateAnchorPointInPoint: function() {
        var locAPP = this._anchorPointInPoints, locSize = this._node._contentSize, locAnchorPoint = this._node._anchorPoint;
        locAPP.x = locSize.width * locAnchorPoint.x;
        locAPP.y = locSize.height * locAnchorPoint.y;
        this.setDirtyFlag(_cc.Node._dirtyFlags.transformDirty);
    },

    setDirtyFlag: function(dirtyFlag){
        if (this._dirtyFlag === 0 && dirtyFlag !== 0)
            _cc.renderer.pushDirtyNode(this);
        this._dirtyFlag |= dirtyFlag;
    },

    getParentRenderCmd: function(){
        if(this._node && this._node._parent && this._node._parent._renderCmd)
            return this._node._parent._renderCmd;
        return null;
    },

    _updateDisplayColor: function (parentColor) {
       var node = this._node;
       var locDispColor = this._displayedColor, locRealColor = node._realColor;
       var i, len, selChildren, item;
       if (this._cascadeColorEnabledDirty && !node._cascadeColorEnabled) {
           locDispColor.r = locRealColor.r;
           locDispColor.g = locRealColor.g;
           locDispColor.b = locRealColor.b;
           var whiteColor = new _cc.Color(255, 255, 255, 255);
           selChildren = node._children;
           for (i = 0, len = selChildren.length; i < len; i++) {
               item = selChildren[i];
               if (item && item._renderCmd)
                   item._renderCmd._updateDisplayColor(whiteColor);
           }
           this._cascadeColorEnabledDirty = false;
       } else {
           if (parentColor === undefined) {
               var locParent = node._parent;
               if (locParent && locParent._cascadeColorEnabled)
                   parentColor = locParent.getDisplayedColor();
               else
                   parentColor = _cc.color.WHITE;
           }
           locDispColor.r = 0 | (locRealColor.r * parentColor.r / 255.0);
           locDispColor.g = 0 | (locRealColor.g * parentColor.g / 255.0);
           locDispColor.b = 0 | (locRealColor.b * parentColor.b / 255.0);
           if (node._cascadeColorEnabled) {
               selChildren = node._children;
               for (i = 0, len = selChildren.length; i < len; i++) {
                   item = selChildren[i];
                   if (item && item._renderCmd){
                       item._renderCmd._updateDisplayColor(locDispColor);
                       item._renderCmd._updateColor();
                   }
               }
           }
       }
       this._dirtyFlag = this._dirtyFlag & _cc.Node._dirtyFlags.colorDirty ^ this._dirtyFlag;
   },

    _updateDisplayOpacity: function (parentOpacity) {
        var node = this._node;
        var i, len, selChildren, item;
        if (this._cascadeOpacityEnabledDirty && !node._cascadeOpacityEnabled) {
            this._displayedOpacity = node._realOpacity;
            selChildren = node._children;
            for (i = 0, len = selChildren.length; i < len; i++) {
                item = selChildren[i];
                if (item && item._renderCmd)
                    item._renderCmd._updateDisplayOpacity(255);
            }
            this._cascadeOpacityEnabledDirty = false;
        } else {
            if (parentOpacity === undefined) {
                var locParent = node._parent;
                parentOpacity = 255;
                if (locParent && locParent._cascadeOpacityEnabled)
                    parentOpacity = locParent.getDisplayedOpacity();
            }
            this._displayedOpacity = node._realOpacity * parentOpacity / 255.0;
            if (node._cascadeOpacityEnabled) {
                selChildren = node._children;
                for (i = 0, len = selChildren.length; i < len; i++) {
                    item = selChildren[i];
                    if (item && item._renderCmd){
                        item._renderCmd._updateDisplayOpacity(this._displayedOpacity);
                        item._renderCmd._updateColor();
                    }
                }
            }
        }
        this._dirtyFlag = this._dirtyFlag & _cc.Node._dirtyFlags.opacityDirty ^ this._dirtyFlag;
    },

    _syncDisplayColor : function (parentColor) {
        var node = this._node, locDispColor = this._displayedColor, locRealColor = node._realColor;
        if (parentColor === undefined) {
            var locParent = node._parent;
            if (locParent && locParent._cascadeColorEnabled)
                parentColor = locParent.getDisplayedColor();
            else
                parentColor = _cc.color.WHITE;
        }
        locDispColor.r = 0 | (locRealColor.r * parentColor.r / 255.0);
        locDispColor.g = 0 | (locRealColor.g * parentColor.g / 255.0);
        locDispColor.b = 0 | (locRealColor.b * parentColor.b / 255.0);
    },

    _syncDisplayOpacity : function (parentOpacity) {
        var node = this._node;
        if (parentOpacity === undefined) {
            var locParent = node._parent;
            parentOpacity = 255;
            if (locParent && locParent._cascadeOpacityEnabled)
                parentOpacity = locParent.getDisplayedOpacity();
        }
        this._displayedOpacity = node._realOpacity * parentOpacity / 255.0;
    },

    _updateColor: function(){},

    updateStatus: function () {
        var flags = _cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        var colorDirty = locFlag & flags.colorDirty,
            opacityDirty = locFlag & flags.opacityDirty;
        if(colorDirty)
            this._updateDisplayColor();

        if(opacityDirty)
            this._updateDisplayOpacity();

        if(colorDirty || opacityDirty)
            this._updateColor();

        if(locFlag & flags.transformDirty){
            //update the transform
            this.transform(this.getParentRenderCmd(), true);
            this._dirtyFlag = this._dirtyFlag & flags.transformDirty ^ this._dirtyFlag;
        }

        if (locFlag & flags.orderDirty)
            this._dirtyFlag = this._dirtyFlag & flags.orderDirty ^ this._dirtyFlag;
    },

    getNodeToParentTransform: function () {
        var node = this._node;
        if (this._dirtyFlag & _cc.Node._dirtyFlags.transformDirty) {
            var t = this._transform;// quick reference

            // base position
            t.tx = node._position.x;
            t.ty = node._position.y;

            // rotation Cos and Sin
            var a = 1, b = 0,
                c = 0, d = 1;
            if (node._rotationX) {
                var rotationRadiansX = node._rotationX * 0.017453292519943295;  //0.017453292519943295 = (Math.PI / 180);   for performance
                c = Math.sin(rotationRadiansX);
                d = Math.cos(rotationRadiansX);

                a = d;
                b = -c;
            }

            t.a = a;
            t.b = b;
            t.c = c;
            t.d = d;

            var lScaleX = node._scaleX, lScaleY = node._scaleY;
            var appX = this._anchorPointInPoints.x, appY = this._anchorPointInPoints.y;

            // scale
            if (lScaleX !== 1 || lScaleY !== 1) {
                a = t.a *= lScaleX;
                b = t.b *= lScaleX;
                c = t.c *= lScaleY;
                d = t.d *= lScaleY;
            }

            // skew
            if (node._skewX || node._skewY) {
                // offset the anchorpoint
                var skx = Math.tan(-node._skewX * Math.PI / 180);
                var sky = Math.tan(-node._skewY * Math.PI / 180);
                if (skx === Infinity)
                    skx = 99999999;
                if (sky === Infinity)
                    sky = 99999999;
                var xx = appY * skx;
                var yy = appX * sky;
                t.a = a - c * sky;
                t.b = b - d * sky;
                t.c = c - a * skx;
                t.d = d - b * skx;
                t.tx += a * xx + c * yy;
                t.ty += b * xx + d * yy;
            }

            // adjust anchorPoint
            t.tx -= a * appX + c * appY;
            t.ty -= b * appX + d * appY;

            // if ignore anchorPoint
            if (node._ignoreAnchorPointForPosition) {
                t.tx += appX;
                t.ty += appY;
            }

        }
        return this._transform;
    },
    setRenderZ: function(z)
    {
        this._stackMatrix.mat[14] = z;
        return;
    },
    _syncStatus: function (parentCmd) {
        
        //  In the visit logic does not restore the _dirtyFlag
        //  Because child elements need parent's _dirtyFlag to change himself
        var flags = _cc.Node._dirtyFlags, locFlag = this._dirtyFlag;
        var parentNode = parentCmd ? parentCmd._node : null;

        //  There is a possibility:
        //    The parent element changed color, child element not change
        //    This will cause the parent element changed color
        //    But while the child element does not enter the circulation
        //    Here will be reset state in last
        //    In order the child elements get the parent state
        if (parentNode)
        {
            if (parentNode._cascadeColorEnabled && (parentCmd._dirtyFlag & flags.colorDirty))
                locFlag |= flags.colorDirty;

            if (parentNode._cascadeOpacityEnabled && (parentCmd._dirtyFlag & flags.opacityDirty))
                locFlag |= flags.opacityDirty;

            if (parentCmd._dirtyFlag & flags.transformDirty)
                locFlag |= flags.transformDirty;
        }
        
        var colorDirty = locFlag & flags.colorDirty,
            opacityDirty = locFlag & flags.opacityDirty;

        this._dirtyFlag = locFlag;

        if (colorDirty)
            //update the color
            this._syncDisplayColor();

        if (opacityDirty)
            //update the opacity
            this._syncDisplayOpacity();

        if(colorDirty || opacityDirty)
            this._updateColor();

        if (locFlag & flags.transformDirty)
        {
            if(parentCmd)
            {
                //update the transform
                this.transform(parentCmd,true);
            }
            else
            {
                this.transformWithoutParentCmd(true);
            }
        }

        if (locFlag & flags.orderDirty)
            this._dirtyFlag = this._dirtyFlag & flags.orderDirty ^ this._dirtyFlag;
    },

    visitChildren: function(){
        var node = this._node;
        var i, children = node._children, child;
        var len = children.length;
        if (len > 0) {
            node.sortAllChildren();
            // draw children zOrder < 0
            for (i = 0; i < len; i++) {
                child = children[i];
                if (child._localZOrder < 0)
                    child._renderCmd.visit(this);
                else
                    break;
            }
            _cc.renderer.pushRenderCommand(this);
            for (; i < len; i++)
                children[i]._renderCmd.visit(this);
        } else {
            _cc.renderer.pushRenderCommand(this);
        }
        this._dirtyFlag = 0;
    }
};})();
