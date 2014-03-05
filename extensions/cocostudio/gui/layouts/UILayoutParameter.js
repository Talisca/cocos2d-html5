/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org

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


//layout parameter type
ccs.LAYOUT_PARAMETER_NONE = 0;
ccs.LAYOUT_PARAMETER_LINEAR = 1;
ccs.LAYOUT_PARAMETER_RELATIVE = 2;

/**
 * Base class for ccs.LayoutParameter
 * @class
 * @extends ccs.Class
 */
ccs.LayoutParameter = ccs.Class.extend(/** @lends ccs.LayoutParameter# */{
    _margin: null,
    _layoutParameterType: null,
    ctor: function () {
        this._margin = new ccs.Margin();
        this._layoutParameterType = ccs.LAYOUT_PARAMETER_NONE;
    },

    /**
     * Sets Margin parameter for LayoutParameter.
     * @param {ccs.Margin} margin
     */
    setMargin: function (margin) {
        this._margin.left = margin.left;
        this._margin.top = margin.top;
        this._margin.right = margin.right;
        this._margin.bottom = margin.bottom;
    },

    /**
     * Gets Margin parameter of LayoutParameter.
     * @returns {ccs.Margin}
     */
    getMargin: function () {
        return this._margin;
    },

    /**
     * Gets LayoutParameterType of LayoutParameter.
     * @returns {ccs.UILayoutParameterType}
     */
    getLayoutType: function () {
        return this._layoutParameterType;
    },

    clone:function(){
        var parameter = this.createCloneInstance();
        parameter.copyProperties(this);
        return parameter;
    },

    /**
     * create clone instance.
     * @returns {ccs.LayoutParameter}
     */
    createCloneInstance:function(){
        return ccs.LayoutParameter.create();
    },

    /**
     * copy properties
     * @param {ccs.LayoutParameter} model
     */
    copyProperties:function(model){
        this._margin.left = model._margin.left;
        this._margin.top = model._margin.top;
        this._margin.right = model._margin.right;
        this._margin.bottom = model._margin.bottom;
    }
});

/**
 * allocates and initializes a LayoutParameter.
 * @constructs
 * @return {ccs.LayoutParameter}
 * @example
 * // example
 * var uiLayoutParameter = ccs.LayoutParameter.create();
 */
ccs.LayoutParameter.create = function () {
    var parameter = new ccs.LayoutParameter();
    return parameter;
};

/**
 * Base class for ccs.LinearLayoutParameter
 * @class
 * @extends ccs.LayoutParameter
 */
ccs.LinearLayoutParameter = ccs.LayoutParameter.extend(/** @lends ccs.LinearLayoutParameter# */{
    _linearGravity: null,
    ctor: function () {
        ccs.LayoutParameter.prototype.ctor.call(this);
        this._linearGravity = ccs.LINEAR_GRAVITY_NONE;
        this._layoutParameterType = ccs.LAYOUT_PARAMETER_LINEAR;
    },

    /**
     * Sets LinearGravity parameter for LayoutParameter.
     * @param {ccs.LINEAR_GRAVITY_NONE|ccs.LINEAR_GRAVITY_TOP|ccs.LINEAR_GRAVITY_RIGHT|ccs.LINEAR_GRAVITY_BOTTOM|ccs.LINEAR_GRAVITY_CENTER_VERTICAL|ccs.LINEAR_GRAVITY_CENTER_HORIZONTAL} gravity
     */
    setGravity: function (gravity) {
        this._linearGravity = gravity;
    },

    /**
     * Gets LinearGravity parameter for LayoutParameter.
     * @returns {ccs.LINEAR_GRAVITY_NONE|ccs.LINEAR_GRAVITY_TOP|ccs.LINEAR_GRAVITY_RIGHT|ccs.LINEAR_GRAVITY_BOTTOM|ccs.LINEAR_GRAVITY_CENTER_VERTICAL|ccs.LINEAR_GRAVITY_CENTER_HORIZONTAL}
     */
    getGravity: function () {
        return this._linearGravity;
    },

    /**
     * create clone instance.
     * @returns {ccs.LinearLayoutParameter}
     */
    createCloneInstance: function () {
        return ccs.LinearLayoutParameter.create();
    },

    /**
     * copy properties
     * @param {ccs.LinearLayoutParameter} model
     */
    copyProperties: function (model) {
        ccs.LayoutParameter.prototype.copyProperties.call(this, model);
        this.setGravity(model._linearGravity);
    }
});

/**
 * allocates and initializes a LinearLayoutParameter.
 * @constructs
 * @return {ccs.LinearLayoutParameter}
 * @example
 * // example
 * var uiLinearLayoutParameter = ccs.LinearLayoutParameter.create();
 */
ccs.LinearLayoutParameter.create = function () {
    var parameter = new ccs.LinearLayoutParameter();
    return parameter;
};

/**
 * Base class for ccs.RelativeLayoutParameter
 * @class
 * @extends ccs.LayoutParameter
 */
ccs.RelativeLayoutParameter = ccs.LayoutParameter.extend(/** @lends ccs.RelativeLayoutParameter# */{
    _relativeAlign: null,
    _relativeWidgetName: "",
    _relativeLayoutName: "",
    _put:false,
    ctor: function () {
        ccs.LayoutParameter.prototype.ctor.call(this);
        this._relativeAlign = ccs.RELATIVE_ALIGN_NONE;
        this._relativeWidgetName = "";
        this._relativeLayoutName = "";
        this._put = false;
        this._layoutParameterType = ccs.LAYOUT_PARAMETER_RELATIVE;
    },

    /**
     * Sets RelativeAlign parameter for LayoutParameter.
     * @param {ccs.RELATIVE_ALIGN_*} align
     */
    setAlign: function (align) {
        this._relativeAlign = align;
    },

    /**
     * Gets RelativeAlign parameter for LayoutParameter.
     * @returns {ccs.RELATIVE_ALIGN_*}
     */
    getAlign: function () {
        return this._relativeAlign;
    },

    /**
     * Sets a key for LayoutParameter. Witch widget named this is relative to.
     * @param {String} name
     */
    setRelativeToWidgetName: function (name) {
        this._relativeWidgetName = name;
    },

    /**
     * Gets the key of LayoutParameter. Witch widget named this is relative to.
     * @returns {string}
     */
    getRelativeToWidgetName: function () {
        return this._relativeWidgetName;
    },

    /**
     * Sets a name in Relative Layout for LayoutParameter.
     * @param {String} name
     */
    setRelativeName: function (name) {
        this._relativeLayoutName = name;
    },

    /**
     * Gets a name in Relative Layout of LayoutParameter.
     * @returns {string}
     */
    getRelativeName: function () {
        return this._relativeLayoutName;
    },

    /**
     * create clone instance.
     * @returns {ccs.RelativeLayoutParameter}
     */
    createCloneInstance:function(){
        return ccs.LinearLayoutParameter.create();
    },

    /**
     * copy properties
     * @param {ccs.RelativeLayoutParameter} model
     */
    copyProperties:function(model){
        ccs.LayoutParameter.prototype.copyProperties.call(this, model);
        this.setAlign(model._relativeAlign);
        this.setRelativeToWidgetName(model._relativeWidgetName);
        this.setRelativeName(model._relativeLayoutName);
    }
});

/**
 * allocates and initializes a RelativeLayoutParameter.
 * @constructs
 * @return {ccs.RelativeLayoutParameter}
 * @example
 * // example
 * var uiRelativeLayoutParameter = ccs.RelativeLayoutParameter.create();
 */
ccs.RelativeLayoutParameter.create = function () {
    var parameter = new ccs.RelativeLayoutParameter();
    return parameter;
};