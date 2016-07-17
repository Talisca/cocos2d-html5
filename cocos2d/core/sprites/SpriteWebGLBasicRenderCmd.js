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
        //return;
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

        var count = i - myIndex;

        if (count > 1) {
            this._batching = true;
            this._batchedCount = count;
        }
        else {
            return 1;
        }

        return count;
    }

    proto.batchedRendering = function (ctx) {
        var node = this._node;
        var locTexture = node._texture;
        var count = this._batchedCount;

        this._shaderProgram.use();
        this._shaderProgram._updateProjectionUniform();
        
        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        cc.glBindTexture2DN(0, locTexture);
        
        cc.glBindVertexFormat(cc.renderer.vertexFormats[cc.geometryTypes.QUAD]);

        var elemBuffer = cc.renderer.buffers[cc.geometryTypes.QUAD].indexBuffer;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, this._firstQuad * 6 *2);

        cc.g_NumberOfDraws++;
    }
})();