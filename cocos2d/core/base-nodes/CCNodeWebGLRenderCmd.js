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
        this._stackMatrixMat = this._stackMatrix.mat;
        this._shaderProgram = null;
        this._batchedCount = 1;
    };

    var proto = cc.Node.WebGLRenderCmd.prototype = Object.create(cc.Node.RenderCmd.prototype);
    proto.constructor = cc.Node.WebGLRenderCmd;
    proto.geometryType = cc.geometryTypes.NONE;

    proto._updateColor = function(){};
    proto._batchedCount = 1;

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
        if(this._dirtyFlag !==0 ) this._syncStatus(parentCmd);
        currentStack.top = this._stackMatrix;
        this.visitChildren();
        //optimize performance for javascript
        currentStack.top = currentStack.stack.pop();
        
        
    };
    
    
    proto.matrixSize = 4*4*4; //4 bytes per float * 4 floats per row * 4 rows

    proto.createQuadIndexBuffer = function(glBuffer, numQuads)
    {
         //create element buffer
        cc.glBindElementBuffer( glBuffer);

        var indices = new Uint16Array(numQuads * 6);

        var currentQuad = 0;
        for (var i = 0; i < numQuads * 6; i += 6) {
            indices[i] = currentQuad + 0;
            indices[i + 1] = currentQuad + 1;
            indices[i + 2] = currentQuad + 2;
            indices[i + 3] = currentQuad + 1;
            indices[i + 4] = currentQuad + 2;
            indices[i + 5] = currentQuad + 3;

            currentQuad += 4;
        }

        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    proto._quadIndexBuffer = {buffer: null, maxQuads: -1};

    //returns an index buffer that contains indices to draw quads in the 'typical' quad setup
    //i.e. rendering 6 vertices, first index 0 1 2 for the first triangle, then 1 2 3 for the second one.
    //we provide this here because whenever a render cmd needs to draw multiple quads, we can use the same index buffer for indexing.
    proto.getQuadIndexBuffer = function(numQuads)
    {
        var buf = proto._quadIndexBuffer;
        if(buf.buffer === null)
        {
            buf.buffer = gl.createBuffer();
        }

        if(buf.maxQuads < numQuads)
        {
            this.createQuadIndexBuffer(proto._quadIndexBuffer.buffer, numQuads);
            buf.maxQuads = numQuads;
        }

        return proto._quadIndexBuffer.buffer;
    }

    proto.transformWithoutParentCmd = function (recursive)
    {
        var t4x4 = this._transform4x4, stackMatrix = this._stackMatrix, node = this._node;
        var parentMatrix = cc.current_stack.top;

        // Convert 3x3 into 4x4 matrix
        var trans = this.getNodeToParentTransform();

        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.transformDirty ^ this._dirtyFlag;

        var t4x4Mat = t4x4.mat;
        t4x4Mat[0] = trans.a;
        t4x4Mat[4] = trans.c;
        t4x4Mat[12] = trans.tx;
        t4x4Mat[1] = trans.b;
        t4x4Mat[5] = trans.d;
        t4x4Mat[13] = trans.ty;

        //optimize performance for Javascript
        _cc.kmMat4Multiply(stackMatrix, parentMatrix, t4x4);
        
        //this.setRenderZ(null, stackMatrix);

        if(!recursive || !node._children)
            return;
        var i, len, locChildren = node._children;
        for(i = 0, len = locChildren.length; i< len; i++){
            locChildren[i]._renderCmd.transform(this, recursive);
        }
    }
    
    proto.transform = function (parentCmd, recursive) {
        //if(!this._node.isVisible()) return;
        var t4x4 = this._transform4x4, stackMatrix = this._stackMatrix, node = this._node;
        var parentMatrix = parentCmd._stackMatrix;

        // Convert 3x3 into 4x4 matrix
        var trans = this.getNodeToParentTransform();

        this._dirtyFlag = this._dirtyFlag & cc.Node._dirtyFlags.transformDirty ^ this._dirtyFlag;

        var t4x4Mat = t4x4.mat;
        t4x4Mat[0] = trans.a;
        t4x4Mat[4] = trans.c;
        t4x4Mat[12] = trans.tx;
        t4x4Mat[1] = trans.b;
        t4x4Mat[5] = trans.d;
        t4x4Mat[13] = trans.ty;

        //optimize performance for Javascript
        _cc.kmMat4Multiply(stackMatrix, parentMatrix, t4x4);
        
        //this.setRenderZ(parentCmd, stackMatrix);

        if(!recursive || !node._children)
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

    proto.configureBatch = function () {
        return 1;
    }
})();
