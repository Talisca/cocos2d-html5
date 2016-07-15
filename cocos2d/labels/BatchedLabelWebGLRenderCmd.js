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

        this._numQuads = -1;
        this._firstQuad = -1;
        this._drawnQuads = 0; //we track drawnquads and numQuads separately because the quads stored in the memory of this string might be larger than the actual drawn amount of quads
        this._batchedCount = 1;
        this._prevStrLen = -1;
        this._colorU32View = new Uint32Array(4);
        this._uvFloat32View = new Float32Array(2 * 4);
        this._colorU8View = new Uint8Array(this._colorU32View.buffer);

        this._batchShader = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST_BATCHED);
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLORALPHATEST);
        this._shaderProgram.setUniformLocationWith1f(this._shaderProgram._uniforms[cc.UNIFORM_MIPMAPBIAS], -0.65);
        this._batchShader.setUniformLocationWith1f(this._shaderProgram._uniforms[cc.UNIFORM_MIPMAPBIAS], -0.65);

        this._contentSize = { width: 0, height: 0 };
    };

    var proto = cc.BatchedLabel.WebGLRenderCmd.prototype = Object.create(cc.Node.WebGLRenderCmd.prototype);
    proto.constructor = cc.BatchedLabel.WebGLRenderCmd;
    //proto.geometryType = cc.geometryTypes.QUAD;

    proto.setString = function(str)
    {
        var len = str.length;
        var prevLen = this._prevStrLen;
        if (len > prevLen || prevLen - len > 10) //wanna keep buffers around the size of the string, but not resize every time 1 char changes
        {
            this._colorU32View = new Uint32Array(len * 4);
            this._uvFloat32View = new Float32Array(len * 2 * 4);
            this._colorU8View = new Uint8Array(this._colorU32View.buffer);
            this._prevStrLen = len;
        }

        this._numQuads = this._prevStrLen;
        this._uvFloat32View.fill(0);
        this._colorU32View.fill(0);
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

        var elemBuffer = cc.renderer.buffers[cc.geometryTypes.QUAD].indexBuffer;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);

        cc.glBindVertexFormat(cc.renderer.vertexFormats[1]); //bind the QUAD vertexe format

        gl.drawElements(gl.TRIANGLES, 6 * this._drawnQuads, gl.UNSIGNED_SHORT, this._firstQuad * 6 * 2);

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

        var colorOffset = 0;
        var uvOffset = 0;
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

        node._stringDirty = false;
    };

    proto.getContentSize = function()
    {
        return this._contentSize;
    }

   proto.configureBatch = function (renderCmds, myIndex) {
        //return;
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
                //also, when batching we have to 0 out the vertex data buffer to make sure those quads aren't drawn (they are uploaded to gpu anyways)
            }

            cmd._batched = true;
            drawnQuads += cmd._numQuads;
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
        {
            this.updateAtlasValues();
        }
        
        this._batchedQuads = drawnQuads + this._numQuads;
        
        return count;
    }

    proto.batchedRendering = function (ctx) {
        return;
        var node = this._node;
        var locTexture = node._atlasTexture;
        var count = this._batchedQuads;

        this._batchShader.use();
        this._batchShader._updateProjectionUniform();
        
        cc.glBindTexture2DN(0, locTexture);              

        cc.glBindVertexFormat(cc.renderer.vertexFormats[cc.geometryTypes.QUAD]);

        var elemBuffer = cc.renderer.buffers[cc.geometryTypes.QUAD].indexBuffer;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
        gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_SHORT, this._firstQuad * 6 * 2);

        cc.g_NumberOfDraws++;
    }

    proto._addChild = function () { };
})();