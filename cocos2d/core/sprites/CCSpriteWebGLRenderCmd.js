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

//Sprite's WebGL render command
(function() {
    var _cc = cc;
    cc.Sprite.WebGLRenderCmd = function (renderable) {
        cc.Node.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._quadU32View = new Uint32Array(cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT / 4);
        this._firstQuad = -1;
        this._batchedCount = 1;
    };

    var proto = cc.Sprite.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);

    proto.constructor = cc.Sprite.WebGLRenderCmd;

    proto.updateBlendFunc = function (blendFunc) {};
    proto.geometryType = cc.geometryTypes.QUAD;
    proto._numQuads = 1; //this stays static, one sprite is always one quad

    proto.setDirtyFlag = function(dirtyFlag){
        _cc.Node.WebGLRenderCmd.prototype.setDirtyFlag.call(this, dirtyFlag);
    };

    proto._handleTextureForRotatedTexture = function (texture) {
        return texture;
    };

    proto.isFrameDisplayed = function (frame) {
        var node = this._node;
        return (cc.rectEqualToRect(frame.getRect(), node._rect) && frame.getTexture().getName() === node._texture.getName()
            && cc.pointEqualToPoint(frame.getOffset(), node._unflippedOffsetPositionFromCenter));
    };

    proto._init = function () {
        cc.flatQuadSetColor(this._quadU32View, 255, 255, 255, 255);
    };

    proto._updateQuadVertices = function()
    {
        this._setQuadVertices(this._quadU32View);
    }

    proto._setQuadVertices = function (u32View)
    {
        var f32View = new Float32Array(u32View.buffer);
        var offset = this._node._offsetPosition;
        var x1 = offset.x;
        var y1 = offset.y;
        var x2 = x1 + this._node._rect.width;
        var y2 = y1 + this._node._rect.height;
        var stride = cc.V3F_C4B_T2F.BYTES_PER_ELEMENT / 4;
        //it's a 1x1  quad so we just set appropriate indices to 1
        f32View[0] = x1; f32View[1] = y2;
        f32View[stride] = x1; f32View[stride + 1] = y1;
        f32View[stride*2] = x2; f32View[stride*2 + 1] = y2;
        f32View[stride*3] = x2; f32View[stride*3 + 1] = y1;
    };

    proto.getQuad = function () {
        return this._quad;
    };

    proto._updateForSetSpriteFrame = function () {};

    proto._spriteFrameLoadedCallback = function (spriteFrame) {
        this.setTextureRect(spriteFrame.getRect(), spriteFrame.isRotated(), spriteFrame.getOriginalSize());
        this.dispatchEvent("load");
    };

    proto._textureLoadedCallback = function (sender) {
        var renderCmd = this._renderCmd;
        if (this._textureLoaded)
            return;

        this._textureLoaded = true;
        var locRect = this._rect;
        if (!locRect) {
            locRect = cc.rect(0, 0, sender.width, sender.height);
        } else if (cc._rectEqualToZero(locRect)) {
            locRect.width = sender.width;
            locRect.height = sender.height;
        }

        this.texture = sender;
        this.setTextureRect(locRect, this._rectRotated);

        this.dispatchEvent("load");
    };

    proto._setTextureCoords = function (rect, needConvert) {
        if (needConvert === undefined)
            needConvert = true;
        if (needConvert)
            rect = cc.rectPointsToPixels(rect);
        var node = this._node;

        var tex =node._texture;
        if (!tex)
            return;

        var atlasWidth = tex.pixelsWidth;
        var atlasHeight = tex.pixelsHeight;

        var left, right, top, bottom, tempSwap;

        if (node._rectRotated) {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.height * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.width * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.height) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.width) / atlasHeight;
            }

            if (node._flippedX) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }

            if (node._flippedY) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }

            cc.flatQuadSetTexCoords(this._quadU32View, right, top, left,top,right,bottom,left,bottom);
        } else {
            if (cc.FIX_ARTIFACTS_BY_STRECHING_TEXEL) {
                left = (2 * rect.x + 1) / (2 * atlasWidth);
                right = left + (rect.width * 2 - 2) / (2 * atlasWidth);
                top = (2 * rect.y + 1) / (2 * atlasHeight);
                bottom = top + (rect.height * 2 - 2) / (2 * atlasHeight);
            } else {
                left = rect.x / atlasWidth;
                right = (rect.x + rect.width) / atlasWidth;
                top = rect.y / atlasHeight;
                bottom = (rect.y + rect.height) / atlasHeight;
            }

            if (node._flippedX) {
                tempSwap = left;
                left = right;
                right = tempSwap;
            }

            if (node._flippedY) {
                tempSwap = top;
                top = bottom;
                bottom = tempSwap;
            }

            cc.flatQuadSetTexCoords(this._quadU32View, left,top,left,bottom,right,top,right,bottom );
        }
    };

    proto._setColorDirty = function () {};

    proto._updateColor = function () {
        var locDisplayedColor = this._displayedColor, locDisplayedOpacity = this._displayedOpacity, node = this._node;
        var r = locDisplayedColor.r, g = locDisplayedColor.g, b = locDisplayedColor.b;
        // special opacity for premultiplied textures
        if (node._opacityModifyRGB) {
            r *= locDisplayedOpacity / 255.0;
            g *= locDisplayedOpacity / 255.0;
            b *= locDisplayedOpacity / 255.0;
        }

        cc.flatQuadSetColor(this._quadU32View, r, g, b, locDisplayedOpacity);

        this._quadDirty = true;
    };

    proto._updateBlendFunc = function () {
        if (this._batchNode) {
            cc.log(cc._LogInfos.Sprite__updateBlendFunc);
            return;
        }

        // it's possible to have an untextured sprite
        var node = this._node,
            blendFunc = node._blendFunc;
        if (!node._texture || !node._texture.hasPremultipliedAlpha()) {
            if (blendFunc.src === cc.ONE && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.SRC_ALPHA;
            }
            node.opacityModifyRGB = false;
        } else {
            if (blendFunc.src === cc.SRC_ALPHA && blendFunc.dst === cc.BLEND_DST) {
                blendFunc.src = cc.ONE;
            }
            node.opacityModifyRGB = true;
        }
    };

    proto._setTexture = function (texture) {
        var node = this._node;
        // If batchnode, then texture id should be the same
        if (node._batchNode) {
            if(node._batchNode.texture !== texture){
                cc.log(cc._LogInfos.Sprite_setTexture);
                return;
            }
        }else{
            if(node._texture !== texture){
                node._textureLoaded = texture ? texture._textureLoaded : false;
                node._texture = texture;
                this._updateBlendFunc();
            }
        }

        if (texture)
            this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST_BATCHED);
        else
            this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_COLOR);

    };

    proto._checkTextureBoundary = function (texture, rect, rotated) {
        if (texture && texture.url) {
            var _x, _y;
            if (rotated) {
                _x = rect.x + rect.height;
                _y = rect.y + rect.width;
            } else {
                _x = rect.x + rect.width;
                _y = rect.y + rect.height;
            }
            if (_x > texture.width) {
                cc.error(cc._LogInfos.RectWidth, texture.url);
            }
            if (_y > texture.height) {
                cc.error(cc._LogInfos.RectHeight, texture.url);
            }
        }
    };

    proto.rendering = function () {
        var node = this._node, locTexture = node._texture;
        var count = this._batchedCount;
        var program = this._shaderProgram;

        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);

        var elemBuffer = cc.renderer.buffers[cc.geometryTypes.QUAD].indexBuffer;
        cc.glBindElementBuffer(elemBuffer);
        cc.glBindVertexFormat(cc.renderer.vertexFormats[1]);

        program.use();
        if (locTexture)
        {
                cc.glBindTexture2DN(0, locTexture); 
                gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, this._firstQuad * 6 * 2);
        }
        else
        {
            program._setUniformForMVPMatrixWithMat4(this._stackMatrix);
            cc.glBindTexture2D(null);

            gl.drawArrays(gl.TRIANGLE_STRIP, this._firstQuad * 4, 4);
        }
        
       
        cc.g_NumberOfDraws++;
    };

    proto.batchedRendering = function (ctx) {
        var node = this._node;
        var locTexture = node._texture;
        var count = this._batchedCount;

        this._shaderProgram.use();

        cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        cc.glBindTexture2DN(0, locTexture);

        cc.glBindVertexFormat(cc.renderer.vertexFormats[cc.geometryTypes.QUAD]);

        var elemBuffer = cc.renderer.buffers[cc.geometryTypes.QUAD].indexBuffer;
        cc.glBindElementBuffer( elemBuffer);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, this._firstQuad * 6 * 2);

        cc.g_NumberOfDraws++;
    }

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
        }

        var count = i - myIndex;
        this._batchedCount = count;

        return count;
    }

    
})();