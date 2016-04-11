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
// ------------------------------ The cc.Node's render command for WebGL ----------------------------------
(function() {
    var _cc = cc;
    cc.Node.WebGLRenderCmd = function (renderable) {
        cc.Node.RenderCmd.call(this, renderable);

        var mat4 = new cc.math.Matrix4(), mat = mat4.mat;
        mat[2] = mat[3] = mat[6] = mat[7] = mat[8] = mat[9] = mat[11] = mat[14] = 0.0;
        mat[10] = mat[15] = 1.0;
        this._transform4x4 = mat4;
        this._stackMatrix = new cc.math.Matrix4();
        this._shaderProgram = null;

        this._camera = null;
    };

    var proto = cc.Node.WebGLRenderCmd.prototype = Object.create(cc.Node.RenderCmd.prototype);
    proto.constructor = cc.Node.WebGLRenderCmd;

    proto._updateColor = function(){};

    proto.visit = function (parentCmd) {
        var node = this._node;
        // quick return if not visible
        if (!node._visible)
            return;

        parentCmd = parentCmd || this.getParentRenderCmd();
        if (node._parent && node._parent._renderCmd)
            this._curLevel = node._parent._renderCmd._curLevel + 1;

        var currentStack = cc.current_stack;

        //optimize performance for javascript
        currentStack.stack.push(currentStack.top);
        this._syncStatus(parentCmd);
        currentStack.top = this._stackMatrix;
        this.visitChildren();
        //optimize performance for javascript
        currentStack.top = currentStack.stack.pop();
    };

    var cctransformDirty = cc.Node._dirtyFlags.transformDirty;

    proto.transformWithoutParentCmd = function (recursive)
    {
        var t4x4 = this._transform4x4, stackMatrix = this._stackMatrix, node = this._node;
        var parentMatrix = cc.current_stack.top;

        // Convert 3x3 into 4x4 matrix
        var trans = this.getNodeToParentTransform();

        this._dirtyFlag = this._dirtyFlag & cctransformDirty ^ this._dirtyFlag;

        var t4x4Mat = t4x4.mat;
        t4x4Mat[0] = trans.a;
        t4x4Mat[4] = trans.c;
        t4x4Mat[12] = trans.tx;
        t4x4Mat[1] = trans.b;
        t4x4Mat[5] = trans.d;
        t4x4Mat[13] = trans.ty;

        //optimize performance for Javascript
        //_cc.kmMat4Multiply(stackMatrix, parentMatrix, t4x4);
        
        var pOut = stackMatrix;
        var pM1 = parentMatrix;
        var pM2 = t4x4;
        
        var outArray = pOut.mat, mat1 = pM1.mat, mat2 = pM2.mat;
        var a00 = mat1[0], a01 = mat1[1], a02 = mat1[2], a03 = mat1[3];
        var a10 = mat1[4], a11 = mat1[5], a12 = mat1[6], a13 = mat1[7];
        var a20 = mat1[8], a21 = mat1[9], a22 = mat1[10], a23 = mat1[11];
        var a30 = mat1[12], a31 = mat1[13], a32 = mat1[14], a33 = mat1[15];

        var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
        var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
        var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
        var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];

        outArray[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        outArray[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        outArray[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        outArray[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        outArray[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        outArray[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        outArray[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        outArray[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        outArray[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        outArray[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        outArray[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        outArray[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        outArray[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        outArray[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        outArray[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        outArray[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

        var z = 0;
        if (node.__z) {
            z = node.__z;
        }

        stackMatrix.mat[14] = z;

        if(!recursive)
            return;
        var i, len, locChildren = node._children;
        for(i = 0, len = locChildren.length; i< len; i++){
            locChildren[i]._renderCmd.transform(this, recursive);
        }
    }

    proto.transform = function (parentCmd, recursive) {
        var t4x4 = this._transform4x4, stackMatrix = this._stackMatrix, node = this._node;
        var parentMatrix = parentCmd._stackMatrix;

        // Convert 3x3 into 4x4 matrix
        var trans = this.getNodeToParentTransform();

        this._dirtyFlag = this._dirtyFlag & cctransformDirty ^ this._dirtyFlag;

        var t4x4Mat = t4x4.mat;
        t4x4Mat[0] = trans.a;
        t4x4Mat[4] = trans.c;
        t4x4Mat[12] = trans.tx;
        t4x4Mat[1] = trans.b;
        t4x4Mat[5] = trans.d;
        t4x4Mat[13] = trans.ty;

        //optimize performance for Javascript
        var pOut = stackMatrix;
        var pM1 = parentMatrix;
        var pM2 = t4x4;
        
        var outArray = pOut.mat, mat1 = pM1.mat, mat2 = pM2.mat;
        var a00 = mat1[0], a01 = mat1[1], a02 = mat1[2], a03 = mat1[3];
        var a10 = mat1[4], a11 = mat1[5], a12 = mat1[6], a13 = mat1[7];
        var a20 = mat1[8], a21 = mat1[9], a22 = mat1[10], a23 = mat1[11];
        var a30 = mat1[12], a31 = mat1[13], a32 = mat1[14], a33 = mat1[15];

        var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
        var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
        var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
        var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];

        outArray[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        outArray[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        outArray[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        outArray[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        outArray[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        outArray[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        outArray[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        outArray[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        outArray[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        outArray[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        outArray[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        outArray[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        outArray[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        outArray[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        outArray[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        outArray[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
        
        var z = 0;
        if (node.__z) {
            z = node.__z;
        }
        else {
            var _z = parentCmd._node.__z;
            if (_z) {
                z = _z;
            }
        }

        stackMatrix.mat[14] = z;

        if(!recursive)
            return;
        var i, len, locChildren = node._children;
        for(i = 0, len = locChildren.length; i< len; i++){
            locChildren[i]._renderCmd.transform(this, recursive);
        }
    };

    proto.setShaderProgram = function (shaderProgram) {
        this._shaderProgram = shaderProgram;
    };

    proto.getShaderProgram = function () {
        return this._shaderProgram;
    };
})();
