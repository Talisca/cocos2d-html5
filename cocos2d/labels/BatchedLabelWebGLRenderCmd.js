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

(function () {
    cc.BatchedLabel.WebGLRenderCmd = function (renderable) {
        cc.Node.WebGLRenderCmd.call(this, renderable);
        this._needDraw = true;
        this._quadBuffer = new QuadBuffer();
        this._batchShader = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST_BATCHED);
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST);
        this._shaderProgram.setUniformLocationWith1f(this._shaderProgram._uniforms[cc.UNIFORM_MIPMAPBIAS], -0.65);
        this._drawnQuads = 0;
        this._contentSize = { width: 0, height: 0 };
    };

    var proto = cc.BatchedLabel.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.BatchedLabel.WebGLRenderCmd;

    proto.setString = function(str)
    {
        this._quadBuffer.allocateForSize(str.length);
    }

    proto.rendering = function ()
    {
        var node = this._node;
        if(node._stringDirty)
        {
            this.updateAtlasValues();
        }
        this._shaderProgram.use();
        this._shaderProgram._setUniformForMVPMatrixWithMat4(this._stackMatrix);

        //optimize performance for javascript
        cc.glBindTexture2DN(0, node._atlasTexture);                   // = cc.glBindTexture2D(locTexture);
        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POS_COLOR_TEX);
        //cc.glBlendFunc(gl.ONE, gl.ZERO);
        cc.glBindArrayBuffer( this._quadBuffer.getGLBuffer());

        var indices = this.getQuadIndexBuffer(node._string.length);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);                   //cc.VERTEX_ATTRIB_POSITION
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);           //cc.VERTEX_ATTRIB_COLOR
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);                  //cc.VERTEX_ATTRIB_TEX_COORDS
        gl.drawElements(gl.TRIANGLES, 6 * this._drawnQuads, gl.UNSIGNED_SHORT, 0);

        cc.g_NumberOfDraws++;
    };
    
    //parses and prepares various string like splitting up the string into multiple lines based on the maximum line size
    //returns the maximum measured line length
    proto.prepareStringData = function(string, outLines, outLineWidths)
    {
        var map = this._node._charMap;
        var words = string.split(" ");
        var sizeFactor = this._node._fontSizeFactor;
        var lineWidths = outLineWidths;
        var lines = outLines;
        var maxX = 0;
        var lineWidth = 0;
        var maxLineWidth = this._node._lineWidth;
        var line = "";
        
        var word = words[0];
        var width = 0;
        for(var j=word.length-1;j>=0;--j)
        {
            width += map[word.charCodeAt(j)].xAdvance * sizeFactor;
        }

        line+= word;
        lineWidth += width;
        maxX = Math.max(lineWidth,maxX);
        
        //first and last word must be handled differently (code is above and below this loop) so we start from i = 1
        var spaceWidth = map[" ".charCodeAt(0)].xAdvance * sizeFactor;
        for(var i=1;i< words.length; ++i)
        {
            if(words[i].length ===0)
            {
                words.removeByLastSwap(i);
            }

            word = words[i];
            width = 0;
            for(var j=word.length-1;j>=0;--j)
            {
                width += map[word.charCodeAt(j)].xAdvance;
            }
            width *= sizeFactor;
            
            var newLineWidth = lineWidth + width + spaceWidth;
            if( newLineWidth > maxLineWidth)
            {
                lines.push(line);
                lineWidths.push(lineWidth);
                lineWidth = width;
                line = word;
            }
            else
            {
                line += " ";
                
                line += word;
                lineWidth = newLineWidth;
            }
            maxX = Math.max(lineWidth,maxX);
        }

        lines.push(line);
        var maxLines = this._node._maxHeight / this._node._lineHeight;
        if(lines.length > maxLines)
        {
            lines.length = maxLines;
        }

        lineWidths.push(lineWidth);

        return maxX;
    }

    proto.updateAtlasValues = function () {
        var node = this._node;
        var locString = node._string;
        var lineHeight = node._lineHeight;
        var locTextureAtlas = node._atlasTexture;

        var texture = locTextureAtlas;
        var textureWide = texture.pixelsWidth;
        var textureHigh = texture.pixelsHeight;

        var quads = this._quadBuffer.getQuads();
        var curColor = node._displayedColor;

        var map = node._charMap;
        var x = 0;

        //// PARSE STRING DATA and make sure it doesnt go above max line size, lines, line widths, etc.
        var lineWidths = [];
        var lines = [];
        
        var maxX = this.prepareStringData(locString, lines,lineWidths);
        var maxY = lines.length * lineHeight;

        var invTexHeight = 1 / textureHigh;
        var invTexWidth = 1 / textureWide;

        var currentChar = 0;
        
        var alignmentOffsetX = 0;
        var alignmentOffsetY = 0;
        
        if(node._maxHeight !== Number.MAX_VALUE)
        {
            var maxY = Math.floor(node._maxHeight / lineHeight) * lineHeight;
            switch(node._verticalAlignment)
            {
                case cc.VERTICAL_TEXT_ALIGNMENT_TOP:
                    alignmentOffsetY = maxY - lines.length * lineHeight;
                    break;
                case cc.VERTICAL_TEXT_ALIGNMENT_CENTER:
                    alignmentOffsetY = (maxY - lines.length * lineHeight) / 2;
                    break;
            }
        }
        var sizeFactor = node._fontSizeFactor;
        for (var line = 0; line < lines.length; ++line) {
            var y = -lineHeight * line + lines.length*lineHeight; //the +lineHeight is because we start with an offset of 1 line, so the first line isn't drawn 'below the screen' if you place the text at y =0
            var word = lines[line];
            x = 0;
            
            switch(node._horizontalAlignment)
            {
                case cc.TEXT_ALIGNMENT_CENTER:
                    alignmentOffsetX = (maxX - lineWidths[line]) /2 ;
                    break;
                case cc.TEXT_ALIGNMENT_RIGHT: //offset means shifting it to the right however many pixels are left as a gap between the right character of the line and the end
                    alignmentOffsetX = maxX - lineWidths[line]; 
                    break;
            }

            for (var i = 0; i < word.length; i++) {
                var a = word.charCodeAt(i);
                var mapEntry = map[a];
                var rect = mapEntry.rect; //NOTICE FOR DEBUGGERS: IF THIS LINE CRASHES, MOST LIKELY YOUR FONT IS MISSING SOME CHARACTERS YOU USED IN THE STRING

                var left, right, top, bottom;

                left = (rect.x) * invTexWidth;
                right = (rect.x + rect.width) * invTexWidth;
                top = (rect.y) * invTexHeight;
                bottom = (rect.y + rect.height) * invTexHeight;

                var quad = quads[currentChar];
                var locQuadTL = quad.tl, locQuadTR = quad.tr, locQuadBL = quad.bl, locQuadBR = quad.br;
                locQuadTL.texCoords.u = left;
                locQuadTL.texCoords.v = top;
                locQuadTR.texCoords.u = right;
                locQuadTR.texCoords.v = top;
                locQuadBL.texCoords.u = left;
                locQuadBL.texCoords.v = bottom;
                locQuadBR.texCoords.u = right;
                locQuadBR.texCoords.v = bottom;

                locQuadBL.vertices.x = x + mapEntry.xOffset * sizeFactor + 0.5 + alignmentOffsetX;
                locQuadBL.vertices.y = y - rect.height * sizeFactor- mapEntry.yOffset * sizeFactor + 0.5 + alignmentOffsetY;
                locQuadBL.vertices.z = 0.0;
                locQuadBR.vertices.x = x + rect.width * sizeFactor + mapEntry.xOffset * sizeFactor + 0.5 + alignmentOffsetX;
                locQuadBR.vertices.y = y - rect.height * sizeFactor - mapEntry.yOffset * sizeFactor + 0.5 + alignmentOffsetY;
                locQuadBR.vertices.z = 0.0;
                locQuadTL.vertices.x = x + mapEntry.xOffset * sizeFactor + 0.5 + alignmentOffsetX;
                locQuadTL.vertices.y = y - mapEntry.yOffset * sizeFactor + 0.5 + alignmentOffsetY;
                locQuadTL.vertices.z = 0.0;
                locQuadTR.vertices.x = x + rect.width * sizeFactor + mapEntry.xOffset * sizeFactor + 0.5 + alignmentOffsetX;
                locQuadTR.vertices.y = y - mapEntry.yOffset * sizeFactor + 0.5 + alignmentOffsetY;
                locQuadTR.vertices.z = 0.0;
                locQuadTL.colors = curColor;
                locQuadTR.colors = curColor;
                locQuadBL.colors = curColor;
                locQuadBR.colors = curColor;

                x += mapEntry.xAdvance * sizeFactor;
                currentChar++;
                maxX = Math.max(x, maxX);
            }
        }

        this._contentSize.width = maxX;
        this._contentSize.height = lines.length * lineHeight;
        this._drawnQuads = currentChar;
        node.width = this._contentSize.width;
        node.height = this._contentSize.height;

        this._quadBuffer.updateGLBuffers();
        node._stringDirty = false;
        //this.updateContentSize(i, 1);
        /*if (n > 0) {
            locTextureAtlas.dirty = true;
            var totalQuads = locTextureAtlas.totalQuads;
            if (n > totalQuads)
                locTextureAtlas.increaseTotalQuadsWith(n - totalQuads);
        }*/
    };

    proto.getContentSize = function()
    {
        return this._contentSize;
    }

   proto.configureBatch = function (renderCmds, myIndex) {
       
        var node = this._node;
        var drawnQuads = 0;

        //CAREFUL: assuming that all batchedlabels have same font FOR NOW. simply introduce check for cmd._fontName === this._fontName to fix
        for (var i = myIndex + 1, len = renderCmds.length; i < len; ++i) {
            var cmd = renderCmds[i];

            //only consider other sprites for now
            if (!(cmd.constructor === cc.BatchedLabel.WebGLRenderCmd)) {
                break;
            }
            
            if(cmd._node._stringDirty)
            {
                cmd.updateAtlasValues();
            }

            cmd._batched = true;
            drawnQuads += cmd._drawnQuads;
        }

        var count  = i - myIndex;

        if (count > 1) {
            this._batching = true;
            this._batchedCount = count;
        }
        else {
            return 1;
        }
        
        if(node._stringDirty)
            this.updateAtlasValues();
        
        drawnQuads += this._drawnQuads;
        var buf = this.pooledBuffer = this.getQuadBatchBuffer(count);
        this._batchBuffer = buf.arrayBuffer;
        this._batchedQuads = drawnQuads;
        
        //all of the divisions by 4 are just because we work with uint32arrays instead of uint8 arrays so all indexes need to be shortened by the factor of 4
        var vertexDataOffset = 0;
        var matrixDataOffset = 0;
        
        var totalQuadDataSize = drawnQuads * cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT / 4;
        var totalBufferSize = drawnQuads * (cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT + this.matrixSize * 4);
        var uploadBuffer = new Uint32Array(totalBufferSize / 4);
        var matrixSize = this.matrixSize / 4;

        cc.glBindArrayBuffer( this._batchBuffer);
        
        for (var j = myIndex; j < i; ++j) {
            var cmd = renderCmds[j];
            
            var source = cmd._quadBuffer.getU32Memory();
            var numQuads = cmd._drawnQuads;
            for(var quad = 0; quad<numQuads;++quad)
            {
                var len = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT / 4;

                for (var k = 0; k < len; ++k) {
                    uploadBuffer[vertexDataOffset + k] = source[k + len * quad];
                }

                var matData = new Uint32Array(cmd._stackMatrix.mat.buffer);

                var matSource = matData;
                var matlen = matSource.length;

                var base = totalQuadDataSize + matrixDataOffset;
                var offset0 = base + matrixSize * 0;
                var offset1 = base + matrixSize * 1;
                var offset2 = base + matrixSize * 2;
                var offset3 = base + matrixSize * 3;

                for (var k = 0; k < matlen; ++k) {
                    var val = matSource[k];
                    uploadBuffer[offset0 + k] = val;
                    uploadBuffer[offset1 + k] = val;
                    uploadBuffer[offset2 + k] = val;
                    uploadBuffer[offset3 + k] = val;
                }

                vertexDataOffset += cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT / 4;
                matrixDataOffset += matrixSize * 4;
            }
        }

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, uploadBuffer);
        return count;
    }

    proto.batchedRendering = function (ctx) {
        var node = this._node;
        var locTexture = node._atlasTexture;
        var count = this._batchedQuads;

        var bytesPerRow = 16; //4 floats with 4 bytes each
        var matrixData = this.matrixSize;
        var totalQuadVertexData = cc.V3F_C4B_T2F_Quad.BYTES_PER_ELEMENT * count;

        this._batchShader.use();
        this._batchShader._updateProjectionUniform();
        
        //cc.glBlendFunc(node._blendFunc.src, node._blendFunc.dst);
        cc.glBindTexture2DN(0, locTexture);                   // = cc.glBindTexture2D(locTexture);

        cc.glBindArrayBuffer( this._batchBuffer);

        cc.glEnableVertexAttribs(cc.VERTEX_ATTRIB_FLAG_POS_COLOR_TEX);

        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);                   //cc.VERTEX_ATTRIB_POSITION
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);           //cc.VERTEX_ATTRIB_COLOR
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);                  //cc.VERTEX_ATTRIB_TEX_COORDS
        //enable matrix vertex attribs
        for (var i = 0; i < 4; ++i) {
            gl.enableVertexAttribArray(cc.VERTEX_ATTRIB_MVMAT0 + i);
            gl.vertexAttribPointer(cc.VERTEX_ATTRIB_MVMAT0 + i, 4, gl.FLOAT, false, bytesPerRow * 4, totalQuadVertexData + bytesPerRow * i); //stride is one row
        }
        
        var elemBuffer = this.getQuadIndexBuffer(count);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, 0);

        for (var i = 0; i < 4; ++i) {
            gl.disableVertexAttribArray(cc.VERTEX_ATTRIB_MVMAT0 + i);
        }

        this.storeQuadBatchBuffer(this.pooledBuffer);

        cc.g_NumberOfDraws++;
    }

    proto._addChild = function () { };
})();