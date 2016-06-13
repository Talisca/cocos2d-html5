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
        this._shaderProgram = cc.shaderCache.programForKey(cc.SHADER_POSITION_TEXTURECOLOR);
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
         //cc.glBlendFunc(gl.ONE,gl.ZERO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer.getGLBuffer());

        var indices = this.getQuadIndexBuffer(node._string.length);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);                   //cc.VERTEX_ATTRIB_POSITION
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);           //cc.VERTEX_ATTRIB_COLOR
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);                  //cc.VERTEX_ATTRIB_TEX_COORDS
        gl.drawElements(gl.TRIANGLES, 6 * this._drawnQuads, gl.UNSIGNED_SHORT, 0);
    };
    
    //parses and prepares various string like splitting up the string into multiple lines based on the maximum line size
    //returns the maximum measured line length
    proto.prepareStringData = function(string, outLines, outLineWidths)
    {
        var map = this._node._charMap;
        var words = string.split(" ");

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
            width += map[word.charCodeAt(j)].xAdvance;
        }

        line+= word;
        lineWidth += width;
        maxX = Math.max(lineWidth,maxX);

        //first and last word must be handled differently (code is above and below this loop) so we start from i = 1
        var spaceWidth = map[" ".charCodeAt(0)].xAdvance;
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
        lineWidths.push(lineWidth);

        return maxX;
    }

    proto.updateAtlasValues = function () {
        var node = this._node;
        var locString = node._string;

        var locTextureAtlas = node._atlasTexture;

        var texture = locTextureAtlas;
        var textureWide = texture.pixelsWidth;
        var textureHigh = texture.pixelsHeight;

        var quads = this._quadBuffer.getQuads();
        var locDisplayedColor = this._displayedColor;
        var curColor = { r: locDisplayedColor.r, g: locDisplayedColor.g, b: locDisplayedColor.b, a: node._displayedOpacity };

        var map = node._charMap;
        var x = 0;

        //// PARSE STRING DATA and make sure it doesnt go above max line size, lines, line widths, etc.
        var lineWidths = [];
        var lines = [];
        
        var maxX = this.prepareStringData(locString, lines,lineWidths);

        var invTexHeight = 1 / textureHigh;
        var invTexWidth = 1 / textureWide;
        var lineHeight = node._lineHeight;

        var currentChar = 0;
        
        var alignmentOffsetX = 0;
        var alignmentOffsetY = 0;
        
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

                locQuadBL.vertices.x = x + mapEntry.xOffset + 0.5 + alignmentOffsetX;
                locQuadBL.vertices.y = y - rect.height - mapEntry.yOffset + 0.5;
                locQuadBL.vertices.z = 0.0;
                locQuadBR.vertices.x = x + rect.width + mapEntry.xOffset + 0.5 + alignmentOffsetX;
                locQuadBR.vertices.y = y - rect.height - mapEntry.yOffset + 0.5;
                locQuadBR.vertices.z = 0.0;
                locQuadTL.vertices.x = x + mapEntry.xOffset + 0.5 + alignmentOffsetX;
                locQuadTL.vertices.y = y - mapEntry.yOffset + 0.5;
                locQuadTL.vertices.z = 0.0;
                locQuadTR.vertices.x = x + rect.width + mapEntry.xOffset + 0.5 + alignmentOffsetX;
                locQuadTR.vertices.y = y - mapEntry.yOffset + 0.5;
                locQuadTR.vertices.z = 0.0;
                locQuadTL.colors = curColor;
                locQuadTR.colors = curColor;
                locQuadBL.colors = curColor;
                locQuadBR.colors = curColor;

                x += mapEntry.xAdvance;
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

    proto._addChild = function () { };
})();