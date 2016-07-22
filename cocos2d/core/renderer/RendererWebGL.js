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

cc.rendererWebGL = {
    childrenOrderDirty: true,
    _transformNodePool: [],                              //save nodes transform dirty
    _renderCmds: [],                                     //save renderer commands

    _isCacheToBufferOn: false,                          //a switch that whether cache the rendererCmd to cacheToCanvasCmds
    _cacheToBufferCmds: {},                              // an array saves the renderer commands need for cache to other canvas
    _cacheInstanceIds: [],
    _currentID: 0,
    _clearColor: cc.color(),                            //background color,default BLACK
    _currentFrame: 0,
    getRenderCmd: function (renderableObject) {
        //TODO Add renderCmd pool here
        return renderableObject._createRenderCmd();
    },

    //all of the buffer stuff here references the fact that we try to put renderCmd data with the same vertex layout into the same buffers before uploading it to WebGL
    //I think some work here can be shifted to the visit function of renderCmds. we iterate over all cmds here quite a bit.
    buffers: {
        1: {
            matrixData: null,
            vertexData: null,
            vertexUpload: null,
            matrixUpload: null,
            indexBuffer: null, //everything that draws quads of any kind can share this index buffer
            glBufferSize: -1,
            size: -1 //indicates how many quads have place in these buffers
        }
    },
    vertexFormats: {
        1: null
    },
    initialize: function()
    {
        //QUAD geometry format
        this.buffers[cc.geometryTypes.QUAD].matrixData = gl.createBuffer();
        this.buffers[cc.geometryTypes.QUAD].vertexData = gl.createBuffer();

        var formats = this.vertexFormats[cc.geometryTypes.QUAD] = [];
        var vertexDataFormat = {
            buffer: this.buffers[cc.geometryTypes.QUAD].vertexData,
            formats: []
        };

        vertexDataFormat.formats.push(cc.makeVertexFormat(0, 3, gl.FLOAT, false, 24, 0));
        vertexDataFormat.formats.push(cc.makeVertexFormat(1, 4, gl.UNSIGNED_BYTE, true, 24, 12));
        vertexDataFormat.formats.push(cc.makeVertexFormat(2, 2, gl.FLOAT, false, 24, 16));
        formats.push(vertexDataFormat);

        var matrixDataFormat = {
            buffer: this.buffers[cc.geometryTypes.QUAD].matrixData,
            formats: []
        };

        for (var i = 0; i < 4; ++i)
        {
            matrixDataFormat.formats.push(cc.makeVertexFormat(cc.VERTEX_ATTRIB_MVMAT0 + i, 4, gl.FLOAT, false, cc.kmMat4.BYTES_PER_ELEMENT, cc.kmMat4.BYTES_PER_ROW * i));
        }
        formats.push(matrixDataFormat);
        //end QUAD geometry format
    },
    bufferHandlers: {
        //QUAD handler
        1: function (cmds)
        {
            var cmd;
            var len = cmds.length;
            var buffers = this.buffers[1];

            var numQuads = 0;
            for(var i = 0; i<len;++i)
            {
                cmd = cmds[i];
                cmd._firstQuad = numQuads;
                numQuads += cmd._numQuads;
            }

            if(buffers.size < numQuads || buffers.size > numQuads * 2)
            {
                buffers.vertexUpload = new Uint32Array(cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT * numQuads / 4);
                buffers.matrixUpload = new Float32Array(cc.kmMat4.BYTES_PER_ELEMENT * numQuads); //for now we save 4 matrices for each quad (one for each vertex), so it would be cc.kmMat4.BYTES_PER_ELEMENT * 4 / 4 
                buffers.indexBuffer = cc.Node.WebGLRenderCmd.prototype.getQuadIndexBuffer(numQuads);
                buffers.size = numQuads;

                if(buffers.glBufferSize < numQuads)
                {
                    cc.glBindArrayBuffer(buffers.vertexData);
                    gl.bufferData(gl.ARRAY_BUFFER, buffers.vertexUpload.length * 4, gl.DYNAMIC_DRAW);

                    cc.glBindArrayBuffer(buffers.matrixData);
                    gl.bufferData(gl.ARRAY_BUFFER, buffers.matrixUpload.length * 4, gl.DYNAMIC_DRAW);
                    buffers.glBufferSize = numQuads;
                }
            }

            var vertexUploadBuffer = buffers.vertexUpload;
            var matrixUploadBuffer = buffers.matrixUpload;

            var vertexOffset = 0;
            var matrixOffset = 0;
            for (var i = 0; i < len; ++i)
            {
                cmd = cmds[i];
                var source = cmd._quadU32View;
                vertexUploadBuffer.set(source, vertexOffset);
                vertexOffset += source.length;

                var mat = cmd._stackMatrix.mat;
                for(var j=0;j<cmd._numQuads*4;++j)
                {
                    matrixUploadBuffer.set(mat, matrixOffset);
                    matrixOffset += mat.length;
                }
            }

            //this looks like we create new buffers each frame, but drivers should recognize this pattern and utilize vertex streaming optimizations
            //we will use a bufferdata, null at the end of the frame to signify that we draw this once then discard it
            cc.glBindArrayBuffer( buffers.vertexData);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexUploadBuffer);

            cc.glBindArrayBuffer( buffers.matrixData);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0,  matrixUploadBuffer);
        }
    },
    //these are just 'pooled' arrays for the updateBuffers loop, so we don't throw garbage around. theres nothing for the geometryTypes.NONE renderCmds
    renderCmdArrays: [null, []],

    //keeps buffers required for drawing up-to-date, keep all data for renderCmds with the same underlying geometry type in same buffers, etc.
    updateBuffers: function(){
        var locCmds = this._renderCmds,
            i,
            len = locCmds.length;
        for (i = 1; i < this.renderCmdArrays.length; ++i)
        {
            this.renderCmdArrays[i].length = 0;
        }

        for (i = 0; i < len; ++i)
        {
            var cmd = locCmds[i];
            if(cmd.geometryType)
            {
                this.renderCmdArrays[cmd.geometryType].push(cmd);
            }
        }

        for(i = 1;i<this.renderCmdArrays.length; ++i)
        {
            this.bufferHandlers[i].call(this,this.renderCmdArrays[i]);
        }
    },

    /**
     * drawing all renderer command to context (default is gl)
     * @param {WebGLRenderingContext} [ctx=gl]
     */
    rendering: function (ctx) {
        var locCmds = this._renderCmds,
            i,
            len;
        var context = ctx || gl;
        
        for(i=locCmds.length-1; i>=0;--i)
        {
            var cmd = locCmds[i];
            if(cmd.setRenderZ)
            {
                cmd.setRenderZ(i/10000);
            }     
        }
        
        this.updateBuffers();

        //prepare batching
        for (i = 0, len = locCmds.length; i< len; ) 
        {
            var cmd = locCmds[i];

            var batchedCount = cmd.configureBatch(locCmds, i);
            i += batchedCount;
        }

        for (i = 0, len = locCmds.length; i< len;) {
            var cmd = locCmds[i];

            cmd.rendering();
            i += cmd._batchedCount;
        }

        cc._stateCacheStats.lastFrameVertexFormatSwitches = cc._stateCacheStats.vertexFormatSwitches;
        cc._stateCacheStats.vertexFormatSwitches = 0;
    },

    _turnToCacheMode: function (renderTextureID) {
        this._isCacheToBufferOn = true;
        renderTextureID = renderTextureID || 0;
        this._cacheToBufferCmds[renderTextureID] = [];
        this._cacheInstanceIds.push(renderTextureID);
        this._currentID = renderTextureID;
    },

    _turnToNormalMode: function () {
        this._isCacheToBufferOn = false;
    },

    /**
     * drawing all renderer command to cache canvas' context
     * @param {Number} [renderTextureId]
     */
    _renderingToBuffer: function (renderTextureId) {
        renderTextureId = renderTextureId || this._currentID;
        var locCmds = this._cacheToBufferCmds[renderTextureId], i, len;
        var ctx = gl, locIDs = this._cacheInstanceIds;
        for (i = 0, len = locCmds.length; i < len; i++) {
            locCmds[i].rendering();
        }
        locCmds.length = 0;
        delete this._cacheToBufferCmds[renderTextureId];
        cc.arrayRemoveObject(locIDs, renderTextureId);

        if (locIDs.length === 0)
            this._isCacheToBufferOn = false;
        else
            this._currentID = locIDs[locIDs.length - 1];
    },

    //reset renderer's flag
    resetFlag: function () {
        this.childrenOrderDirty = false;
        this._transformNodePool.length = 0;
    },

    //update the transform data
    transform: function () {
        var locPool = this._transformNodePool;
        //sort the pool
        locPool.sort(this._sortNodeByLevelAsc);
        //transform node
        for (var i = 0, len = locPool.length; i < len; i++) {
             locPool[i].updateStatus();
        }
        locPool.length = 0;
    },

    transformDirty: function () {
        return this._transformNodePool.length > 0;
    },

    _sortNodeByLevelAsc: function (n1, n2) {
        return n1._curLevel - n2._curLevel;
    },

    pushDirtyNode: function (node) {
        //if (this._transformNodePool.indexOf(node) === -1)
        this._transformNodePool.push(node);
    },

    clearRenderCommands: function () {
        this._renderCmds.length = 0;
        this._currentFrame++;
    },

    clear: function () {
        gl.clearColor(this._clearColor.r, this._clearColor.g, this._clearColor.b, this._clearColor.a);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },

    setDepthTest: function (enable){
        if(enable){
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
        }
        else{
            gl.disable(gl.DEPTH_TEST);
        }
    },
    
    pushRenderCommand: function (cmd) {
        if(!cmd._needDraw)
            return;

        var curFrame = this._currentFrame;
        if (this._isCacheToBufferOn) {
            var currentId = this._currentID, locCmdBuffer = this._cacheToBufferCmds;
            var cmdList = locCmdBuffer[currentId];
            if (cmd._frame !== curFrame) {
                cmd._frame = curFrame;
                cmdList.push(cmd);
            }
        } else {
            if (cmd._frame !== curFrame)
            {
                cmd._frame = curFrame;
                this._renderCmds.push(cmd);
            } 
        }
    }
};
