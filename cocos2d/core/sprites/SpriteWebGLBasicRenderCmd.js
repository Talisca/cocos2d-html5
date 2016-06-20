(function() {
    cc.Sprite.BasicWebGLRenderCmd = function (renderable) {
        cc.Sprite.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;

        if(!proto.vertexDataPerSprite)
        {
            proto.vertexDataPerSprite = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT;
            proto.matrixByteSize =  4*4*4; //4 rows of 4 floats, 4 bytes each
            proto.byteSizePerSprite = proto.vertexDataPerSprite + proto.matrixByteSize*4;
            proto.indicesPerSprite = 6;
        }
    };

    var proto = cc.Sprite.BasicWebGLRenderCmd.prototype = Object.create(cc.Sprite.WebGLRenderCmd.prototype);

    proto.constructor = cc.Sprite.BasicWebGLRenderCmd;

    proto.configureBatch = function (renderCmds, myIndex) {
        return;
        var node = this._node;
        var texture = node.getTexture();

        for (var i = myIndex + 1, len = renderCmds.length; i < len; ++i) {
            var cmd = renderCmds[i];

            //only consider other sprites for now
            if (!(cmd instanceof cc.Sprite.WebGLRenderCmd)) {
                break;
            }

            var otherNode = cmd._node;
            if (texture !== otherNode.getTexture()) {
                break;
            }

            cmd._batched = true;
        }

        var count = this._batchedNodes = i - myIndex;

        if (count > 1) {
            this._batching = true;
        }
        else {
            return 0;
        }

        var buf = this.pooledBuffer = this.getQuadBatchBuffer(count);
        this._batchBuffer = buf.arrayBuffer;

        //all of the divisions by 4 are just because we work with uint32arrays instead of uint8 arrays so all indexes need to be shortened by the factor of 4
        var totalSpriteVertexData = this.vertexDataPerSprite * count / 4;
        var matrixData = this.matrixByteSize / 4;
        var vertexDataPerSprite = this.vertexDataPerSprite / 4;
        var vertexDataOffset = 0;
        var matrixDataOffset = 0;

        var totalBufferSize = count * this.byteSizePerSprite;
        var uploadBuffer = buf.uploadBuffer;

        cc.glBindArrayBuffer( this._batchBuffer);

        //data is layed out such that first is quad vertex data, then all the matrices
        for (var j = myIndex; j < i; ++j) {
            var cmd = renderCmds[j];
            //copy(uploadBuffer, cmd._quadBufferView, vertexDataOffset);

            var source = cmd._quadBufferView;
            var len = source.length;
            for (var k = 0; k < len; ++k) {
                uploadBuffer[vertexDataOffset + k] = source[k];
            }

            var matData = new Uint32Array(cmd._stackMatrix.mat.buffer);

            source = matData;
            len = source.length;

            var base = totalSpriteVertexData + matrixDataOffset;
            var offset0 = base + matrixData * 0;
            var offset1 = base + matrixData * 1;
            var offset2 = base + matrixData * 2;
            var offset3 = base + matrixData * 3;

            for (var k = 0; k < len; ++k) {
                var val = source[k];
                uploadBuffer[offset0 + k] = val;
                uploadBuffer[offset1 + k] = val;
                uploadBuffer[offset2 + k] = val;
                uploadBuffer[offset3 + k] = val;
            }

            vertexDataOffset += vertexDataPerSprite;
            matrixDataOffset += matrixData * 4;
        }

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uploadBuffer);
        return count;
    }

    proto.batchedRendering = function (ctx) {
        var node = this._node;
        var locTexture = node._texture;
        var count = this._batchedNodes;

        var bytesPerRow = 16; //4 floats with 4 bytes each
        var matrixData = this.matrixByteSize;
        var totalSpriteVertexData = this.vertexDataPerSprite * count;

        this._batchShader.use();
        this._batchShader._updateProjectionUniform();
        
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        cc.glBindTexture2DN(0, locTexture);                   // = cc.glBindTexture2D(locTexture);

        cc.glBindArrayBuffer( this._batchBuffer);

        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POS_COLOR_TEX);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);                   //cc.VERTEX_ATTRIB_POSITION
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);           //cc.VERTEX_ATTRIB_COLOR
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);                  //cc.VERTEX_ATTRIB_TEX_COORDS
        //enable matrix vertex attribs
        for (var i = 0; i < 4; ++i) {
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_MVMAT0 + i);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_MVMAT0 + i, 4, gl.FLOAT, false, bytesPerRow * 4, totalSpriteVertexData + bytesPerRow * i); //stride is one row
        }
        
        var elemBuffer = this.getQuadIndexBuffer(count);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
        //gl.drawArrays(gl.TRIANGLE_STRIP, 0, count*4);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);

        for (var i = 0; i < 4; ++i) {
            gl.disableVertexAttribArray(cc.VERTEX_ATTRIB_MVMAT0 + i);
        }

        this.storeQuadBatchBuffer(this.pooledBuffer);

        cc.g_NumberOfDraws++;
    }
})();